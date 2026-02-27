import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { registerShare } from '@/lib/server/share-store';

const SECRET = process.env.SHARE_TOKEN_SECRET || 'trackcore-share-secret-v1';

export interface SharePayload {
  shareId:        string; // ID único para rastreamento e revogação
  deviceId:       number;
  deviceName:     string;
  plate:          string;
  exp:            number; // Unix ms
  iat:            number; // Unix ms
  traccarSession: string; // cookie de sessão do criador
}

export function createShareToken(data: SharePayload): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url')
    .slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifyShareToken(token: string): SharePayload | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('base64url')
      .slice(0, 16);
    if (sig !== expectedSig) return null;
    const data: SharePayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null; // expirado
    return data;
  } catch {
    return null;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deviceId, deviceName, plate, durationMs } = req.body;

  if (!deviceId || !durationMs) {
    return res.status(400).json({ error: 'deviceId e durationMs são obrigatórios' });
  }

  const now = Date.now();
  // Captura o cookie de sessão do criador para autenticar chamadas futuras ao Traccar
  const traccarSession = req.headers.cookie || '';

  // ID curto e único para rastreamento / revogação
  const shareId = crypto.randomBytes(8).toString('hex');

  const payload: SharePayload = {
    shareId,
    deviceId:       Number(deviceId),
    deviceName:     String(deviceName || ''),
    plate:          String(plate || ''),
    exp:            now + Number(durationMs),
    iat:            now,
    traccarSession,
  };

  const token = createShareToken(payload);

  // Registra no store para monitoramento e revogação
  registerShare({
    shareId,
    deviceId:   payload.deviceId,
    deviceName: payload.deviceName,
    plate:      payload.plate,
    createdAt:  now,
    expiresAt:  payload.exp,
  });

  return res.status(200).json({ token, shareId, expiresAt: payload.exp });
}
