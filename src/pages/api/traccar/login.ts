import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const traccarUrl = process.env.TRACCAR_API_URL || 'http://localhost:8082';
    const base = traccarUrl.replace(/\/$/, '');

    console.log('[traccar-login] Authenticating with', `${base}/api/session`);

    const response = await fetch(`${base}/api/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email,
        password,
      }).toString(),
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('set-cookie', setCookie);
      console.log('[traccar-login] Session cookie received');
    }

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: 'Authentication failed',
        details: text.substring(0, 500),
      });
    }

    const data = await response.json();
    console.log('[traccar-login] Authentication successful');
    
    return res.status(200).json({
      ok: true,
      message: 'Authenticated successfully',
      user: data,
    });
  } catch (error: any) {
    console.error('[traccar-login] Error:', error?.message);
    return res.status(500).json({
      error: 'Login failed',
      details: error?.message,
    });
  }
}
