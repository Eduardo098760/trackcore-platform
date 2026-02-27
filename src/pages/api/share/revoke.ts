import type { NextApiRequest, NextApiResponse } from 'next';
import { revokeShare } from '@/lib/server/share-store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shareId } = req.body as { shareId?: string };
  if (!shareId) {
    return res.status(400).json({ error: 'shareId é obrigatório' });
  }

  const revoked = revokeShare(shareId);
  if (!revoked) {
    // Pode ter expirado ou nunca existido — trata como sucesso silencioso
    return res.status(200).json({ success: true, alreadyGone: true });
  }

  return res.status(200).json({ success: true });
}
