import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { isRevoked } from '@/lib/server/share-store';

const SECRET = process.env.SHARE_TOKEN_SECRET || 'trackcore-share-secret-v1';

interface SharePayload {
  shareId?:        string; // pode não existir em tokens gerados antes da atualização
  deviceId:        number;
  deviceName:      string;
  plate:           string;
  exp:             number;
  iat:             number;
  traccarSession?: string;
}

function verifyShareToken(token: string): SharePayload | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sig     = token.slice(dot + 1);
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('base64url')
      .slice(0, 16);
    if (sig !== expected) return null;
    const data: SharePayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query as { token: string };

  // 1. Validar token
  const payload = verifyShareToken(token);
  if (!payload) {
    return res.status(401).json({ valid: false, error: 'expired_or_invalid' });
  }

  // 2. Verificar se foi revogado manualmente
  if (payload.shareId && isRevoked(payload.shareId)) {
    return res.status(401).json({ valid: false, error: 'revoked' });
  }

  // 2. Reutiliza o proxy interno /api/traccar (já configurado com a URL correta do Traccar)
  //    passando o cookie de sessão que foi capturado na criação do link.
  const host     = req.headers.host || 'localhost:3000';
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  const base     = `${protocol}://${host}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };

  // Cookie de sessão do criador do link (armazenado de forma segura no token assinado)
  if (payload.traccarSession) {
    headers['Cookie'] = payload.traccarSession;
  }

  try {
    const [posRes, devRes] = await Promise.all([
      fetch(`${base}/api/traccar/positions?deviceId=${payload.deviceId}`, { headers }),
      fetch(`${base}/api/traccar/devices/${payload.deviceId}`,            { headers }),
    ]);

    const positions  = posRes.ok  ? await posRes.json()  : [];
    const deviceData = devRes.ok  ? await devRes.json()  : null;
    const position   = Array.isArray(positions) ? positions[0] : null;

    // Retorna apenas dados seguros (sem credenciais ou atributos internos)
    const safeDevice = {
      id:         payload.deviceId,
      name:       payload.deviceName || deviceData?.name || 'Veículo',
      plate:      payload.plate,
      status:     deviceData?.status || 'unknown',
      category:   deviceData?.category || 'car',
      lastUpdate: deviceData?.lastUpdate || null,
    };

    const safePosition = position
      ? {
          latitude:  position.latitude,
          longitude: position.longitude,
          speed:     position.speed,
          course:    position.course,
          fixTime:   position.fixTime,
          address:   position.address || null,
          attributes: {
            ignition: position.attributes?.ignition,
            motion:   position.attributes?.motion,
            sat:      position.attributes?.sat,
          },
        }
      : null;

    return res.status(200).json({
      valid:     true,
      device:    safeDevice,
      position:  safePosition,
      expiresAt: payload.exp,
    });
  } catch (error: any) {
    console.error('[share-token] Erro ao buscar dados no Traccar:', error?.message);
    // Retorna dados básicos do token mesmo sem posição
    return res.status(200).json({
      valid: true,
      device: {
        id:         payload.deviceId,
        name:       payload.deviceName,
        plate:      payload.plate,
        status:     'unknown',
        category:   'car',
        lastUpdate: null,
      },
      position:  null,
      expiresAt: payload.exp,
      error:     'position_unavailable',
    });
  }
}
