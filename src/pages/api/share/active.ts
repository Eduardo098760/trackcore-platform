import type { NextApiRequest, NextApiResponse } from 'next';
import { getSharesForDevice, getAllActiveShares } from '@/lib/server/share-store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deviceId } = req.query as { deviceId?: string };

  if (deviceId) {
    return res.status(200).json(getSharesForDevice(Number(deviceId)));
  }

  return res.status(200).json(getAllActiveShares());
}
