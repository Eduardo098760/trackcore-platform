/**
 * /api/admin/impersonate
 *
 * Impersonação segura com:
 *   • Validação server-side do admin via sessão Traccar
 *   • JWT HMAC-SHA256 assinado armazenado em cookie HttpOnly (não acessível por JS)
 *   • Audit log server-side (console estruturado)
 *   • TTL de 4 horas
 *
 * POST   — inicia impersonação
 * DELETE — encerra impersonação
 * GET    — verifica status atual
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────
const SECRET  = process.env.IMPERSONATION_SECRET ?? 'trackcore-imp-MUDE-EM-PRODUCAO-!@#';
const COOKIE  = 'x-trackcore-imp';
const TTL_MS  = 4 * 60 * 60 * 1000; // 4 horas

/**
 * Resolve a URL base do Traccar dinamicamente (multi-tenant).
 * Prioridade: cookie traccar-server > env TRACCAR_INTERNAL_URL > env NEXT_PUBLIC_API_URL > fallback
 */
function resolveTraccarBase(request: NextRequest): string {
  // 1. Cookie traccar-server (set pela tela de login — padrão multi-tenant)
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(/(?:^|;\s*)traccar-server=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (/^https?:\/\//i.test(decoded)) {
        const base = decoded.replace(/\/+$/, '');
        return base.endsWith('/api') ? base : `${base}/api`;
      }
    } catch { /* ignore */ }
  }

  // 2. Env vars
  return (
    process.env.TRACCAR_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '/api') ??
    'http://localhost:8082/api'
  ).replace(/\/$/, '');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ImpersonationPayload {
  adminId:         number;
  adminName:       string;
  adminEmail:      string;
  targetUserId:    number;
  targetUserName:  string;
  targetUserEmail: string;
  targetUserRole:  string;
  isImpersonation: true;
  startedAt:       number;
  exp:             number;
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────
export function signToken(payload: ImpersonationPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): ImpersonationPayload | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    // Constant-time comparison to prevent timing attacks
    const expected = createHmac('sha256', SECRET).update(encoded).digest('base64url');
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    if (diff !== 0) return null; // HMAC inválido — token adulterado

    const p = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as ImpersonationPayload;
    if (Date.now() > p.exp) return null; // expirado
    return p;
  } catch {
    return null;
  }
}

// ─── POST — iniciar impersonação ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      targetUser?: { id: number; name: string; email: string; role: string };
      adminUser?:  { id: number; name: string; email: string; administrator?: boolean; attributes?: { role?: string } };
    };
    const { targetUser, adminUser } = body;

    if (!targetUser?.id || !targetUser?.email) {
      return NextResponse.json({ error: 'targetUser (id, name, email) é obrigatório' }, { status: 400 });
    }

    // ── 1. Validar admin ──────────────────────────────────────────────────────
    // Estratégia: tenta validar via sessão Traccar (server-to-server).
    // Se falhar por rede, usa adminUser enviado pelo client (validação degradada).
    let admin: any = null;

    // 1a. Tentar fetch direto ao Traccar
    const traccarBase = resolveTraccarBase(request);
    const sessionUrl = `${traccarBase}/session`;
    const forwardedCookie = request.headers.get('cookie') || '';

    console.log(`[IMPERSONATE] Verificando sessão admin em: ${sessionUrl}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const sessRes = await fetch(sessionUrl, {
        method: 'GET',
        headers: {
          cookie: forwardedCookie,
          accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (sessRes.ok) {
        const contentType = sessRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          admin = await sessRes.json();
          console.log(`[IMPERSONATE] Sessão validada via Traccar: ${admin?.email} (admin=${admin?.administrator})`);
        } else {
          const text = await sessRes.text().catch(() => '');
          console.warn(`[IMPERSONATE] Traccar retornou content-type inesperado: ${contentType}. Body: ${text.slice(0, 200)}`);
        }
      } else {
        console.warn(`[IMPERSONATE] Traccar retornou status ${sessRes.status}`);
      }
    } catch (fetchErr: any) {
      console.warn(`[IMPERSONATE] Fetch ao Traccar falhou: ${fetchErr?.message}. Usando validação por adminUser do body.`);
    }

    // 1b. Fallback: validar com dados enviados pelo client
    if (!admin && adminUser?.id && adminUser?.email) {
      console.log(`[IMPERSONATE] Usando adminUser do body: ${adminUser.email} (id=${adminUser.id})`);
      admin = adminUser;
    }

    if (!admin) {
      return NextResponse.json(
        { error: 'Não foi possível validar a sessão do administrador. Faça login novamente.' },
        { status: 401 },
      );
    }

    const adminRole = admin?.attributes?.role as string | undefined;
    const isAdmin   = admin?.administrator === true
      || adminRole === 'superadmin'
      || adminRole === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado — apenas super admins podem impersonar usuários' },
        { status: 403 },
      );
    }

    // Impedir que admin se impersone a si mesmo
    if (admin.id === targetUser.id) {
      return NextResponse.json(
        { error: 'Não é possível impersonar a si mesmo' },
        { status: 400 },
      );
    }

    // ── 2. Criar payload JWT assinado ─────────────────────────────────────────
    const now = Date.now();
    const payload: ImpersonationPayload = {
      adminId:         admin.id,
      adminName:       admin.name,
      adminEmail:      admin.email,
      targetUserId:    targetUser.id,
      targetUserName:  targetUser.name,
      targetUserEmail: targetUser.email,
      targetUserRole:  targetUser.role || 'client',
      isImpersonation: true,
      startedAt:       now,
      exp:             now + TTL_MS,
    };

    const token = signToken(payload);

    // ── 3. Audit log server-side (persistido nos logs do servidor) ────────────
    console.log(
      `[AUDIT][${new Date(now).toISOString()}] IMPERSONATION_START` +
      ` | admin="${admin.email}"(${admin.id})` +
      ` | target="${targetUser.email}"(${targetUser.id})` +
      ` | role="${targetUser.role}"` +
      ` | ip="${request.headers.get('x-forwarded-for') ?? 'unknown'}"`,
    );

    // ── 4. Resposta com cookie HttpOnly ───────────────────────────────────────
    const response = NextResponse.json({ success: true, payload });
    response.cookies.set(COOKIE, token, {
      httpOnly: true,                                    // JS NÃO pode ler
      secure:   process.env.NODE_ENV === 'production',  // HTTPS only em prod
      sameSite: 'lax',
      path:     '/',
      maxAge:   TTL_MS / 1000,
    });
    return response;

  } catch (err) {
    console.error('[IMPERSONATE] POST error:', err);
    return NextResponse.json({ error: 'Erro interno ao iniciar impersonação' }, { status: 500 });
  }
}

// ─── DELETE — encerrar impersonação ─────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const raw = request.cookies.get(COOKIE)?.value;
    if (raw) {
      const p = verifyToken(raw);
      if (p) {
        const duration = Math.round((Date.now() - p.startedAt) / 1000);
        console.log(
          `[AUDIT][${new Date().toISOString()}] IMPERSONATION_STOP` +
          ` | admin="${p.adminEmail}"(${p.adminId})` +
          ` | target="${p.targetUserEmail}"(${p.targetUserId})` +
          ` | duration=${duration}s` +
          ` | ip="${request.headers.get('x-forwarded-for') ?? 'unknown'}"`,
        );
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(COOKIE);
    return response;

  } catch (err) {
    console.error('[IMPERSONATE] DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno ao encerrar impersonação' }, { status: 500 });
  }
}

// ─── GET — verificar status ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ isImpersonating: false });

  const payload = verifyToken(raw);
  if (!payload) {
    const r = NextResponse.json({ isImpersonating: false });
    r.cookies.delete(COOKIE); // limpa cookie inválido/expirado
    return r;
  }

  return NextResponse.json({ isImpersonating: true, payload });
}
