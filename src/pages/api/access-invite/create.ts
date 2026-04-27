import type { NextApiRequest, NextApiResponse } from 'next';
import { createAccessInvite } from '@/lib/server/access-invite-store';
const DEFAULT_DURATION_MS = 1000 * 60 * 60 * 24 * 3;

function resolveTraccarBase(req: NextApiRequest): string {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/(?:^|;\s*)traccar-server=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]).replace(/\/+$/, '');
      if (/^https?:\/\//i.test(decoded)) {
        return decoded.endsWith('/api') ? decoded : `${decoded}/api`;
      }
    } catch {
      // ignore
    }
  }

  return (
    process.env.TRACCAR_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '/api') ??
    'http://localhost:8082/api'
  ).replace(/\/$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, name, email, tempPassword, durationMs } = req.body || {};
  if (!userId || !email || !tempPassword) {
    return res.status(400).json({ error: 'userId, email e tempPassword são obrigatórios' });
  }

  const traccarBase = resolveTraccarBase(req);
  const forwardedCookie = req.headers.cookie || '';

  try {
    const userResponse = await fetch(`${traccarBase}/users/${userId}`, {
      method: 'GET',
      headers: {
        cookie: forwardedCookie,
        accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      return res.status(userResponse.status).json({ error: 'Não foi possível carregar o usuário para gerar o link' });
    }

    const rawUser = await userResponse.json();
    const expiresAt = new Date(Date.now() + Number(durationMs || DEFAULT_DURATION_MS)).toISOString();
    const updatedAttributes = {
      ...(rawUser.attributes || {}),
      accessInvitePending: true,
      accessInviteExpiresAt: expiresAt,
      accessInviteCreatedAt: new Date().toISOString(),
    };

    const updateResponse = await fetch(`${traccarBase}/users/${userId}`, {
      method: 'PUT',
      headers: {
        cookie: forwardedCookie,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        ...rawUser,
        id: Number(userId),
        password: String(tempPassword),
        attributes: updatedAttributes,
      }),
    });

    if (!updateResponse.ok) {
      const detailText = await updateResponse.text().catch(() => '');
      return res.status(updateResponse.status).json({ error: detailText || 'Falha ao preparar o usuário para primeiro acesso' });
    }

    const invite = createAccessInvite({
      userId: Number(userId),
      name: String(name || rawUser.name || ''),
      email: String(email),
      tempPassword: String(tempPassword),
      traccarBase,
      expiresAt: new Date(expiresAt).getTime(),
    });

    return res.status(200).json({ token: invite.inviteId, expiresAt });
  } catch (error: any) {
    console.error('[access-invite/create] error:', error);
    return res.status(500).json({ error: error?.message || 'Erro interno ao gerar link de acesso' });
  }
}