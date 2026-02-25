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
    };
    const { targetUser } = body;

    if (!targetUser?.id || !targetUser?.email) {
      return NextResponse.json({ error: 'targetUser (id, name, email) é obrigatório' }, { status: 400 });
    }

    // ── 1. Validar admin via sessão Traccar (server-to-server) ────────────────
    // TRACCAR_INTERNAL_URL aponta diretamente para o Traccar sem passar pelo proxy Next.js
    // Ex: http://unotracker.rastrear.app.br/api
    const traccarBase = (
      process.env.TRACCAR_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '/api') ??
      'http://localhost:8082/api'
    ).replace(/\/$/, ''); // remove trailing slash

    const sessionUrl = `${traccarBase}/session`;
    const forwardedCookie = request.headers.get('cookie') || '';

    console.log(`[IMPERSONATE] Verificando sessão em: ${sessionUrl}`);

    let sessRes: Response;
    try {
      sessRes = await fetch(sessionUrl, {
        headers: { cookie: forwardedCookie },
        signal: AbortSignal.timeout(8000), // timeout de 8s
      });
    } catch (fetchErr: any) {
      console.error(`[IMPERSONATE] Falha ao conectar ao Traccar (${sessionUrl}):`, fetchErr?.message ?? fetchErr);
      return NextResponse.json(
        { error: `Não foi possível conectar ao servidor Traccar. Verifique TRACCAR_INTERNAL_URL no .env.local` },
        { status: 502 },
      );
    }

    if (!sessRes.ok) {
      const body = await sessRes.text().catch(() => '');
      console.warn(`[IMPERSONATE] Traccar retornou ${sessRes.status} para ${sessionUrl}. Body: ${body.slice(0, 200)}`);
      return NextResponse.json(
        { error: 'Sessão Traccar inválida — faça login novamente' },
        { status: 401 },
      );
    }

    const admin = await sessRes.json();
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
