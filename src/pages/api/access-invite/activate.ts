import type { NextApiRequest, NextApiResponse } from 'next';
import { consumeAccessInvite, getAccessInvite } from '@/lib/server/access-invite-store';

function extractCookieHeader(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader
    .split(/,(?=[^;]+?=)/)
    .map((entry) => entry.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'token e password são obrigatórios' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  const invite = getAccessInvite(String(token));
  if (!invite) {
    return res.status(400).json({ error: 'Link inválido ou expirado' });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('email', invite.email);
    formData.append('password', invite.tempPassword);

    const sessionResponse = await fetch(`${invite.traccarBase}/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: formData.toString(),
    });

    if (!sessionResponse.ok) {
      return res.status(409).json({ error: 'Este link não pode mais ser usado. Gere um novo primeiro acesso.' });
    }

    const sessionCookie = extractCookieHeader(sessionResponse.headers.get('set-cookie'));
    const userResponse = await fetch(`${invite.traccarBase}/users/${invite.userId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
        accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      return res.status(userResponse.status).json({ error: 'Não foi possível carregar o usuário para ativação' });
    }

    const rawUser = await userResponse.json();
    const updatedAttributes = { ...(rawUser.attributes || {}) };
    delete updatedAttributes.accessInvitePending;
    delete updatedAttributes.accessInviteExpiresAt;
    updatedAttributes.accessInviteCompletedAt = new Date().toISOString();

    const updateResponse = await fetch(`${invite.traccarBase}/users/${invite.userId}`, {
      method: 'PUT',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        ...rawUser,
        id: invite.userId,
        password: String(password),
        attributes: updatedAttributes,
      }),
    });

    await fetch(`${invite.traccarBase}/session`, {
      method: 'DELETE',
      headers: {
        cookie: sessionCookie,
      },
    }).catch(() => undefined);

    if (!updateResponse.ok) {
      const detailText = await updateResponse.text().catch(() => '');
      return res.status(updateResponse.status).json({ error: detailText || 'Falha ao definir a senha inicial' });
    }

    consumeAccessInvite(String(token));

    return res.status(200).json({ success: true, email: invite.email });
  } catch (error: any) {
    console.error('[access-invite/activate] error:', error);
    return res.status(500).json({ error: error?.message || 'Erro interno ao ativar acesso' });
  }
}