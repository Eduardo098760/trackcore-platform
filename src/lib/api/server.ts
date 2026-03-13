import { api } from './client';

export interface TraccarServer {
  id: number;
  registration: boolean;
  readonly: boolean;
  deviceReadonly: boolean;
  limitCommands: boolean;
  map: string;
  bingKey: string;
  mapUrl: string;
  latitude: number;
  longitude: number;
  zoom: number;
  twelveHourFormat: boolean;
  forceSettings: boolean;
  coordinateFormat: string;
  openIdEnabled: boolean;
  openIdForce: boolean;
  attributes: Record<string, any>;
}

export async function getServerSettings(): Promise<TraccarServer> {
  return api.get<TraccarServer>('/server');
}

export async function updateServerSettings(data: Partial<TraccarServer>): Promise<TraccarServer> {
  return api.put<TraccarServer>('/server', data);
}
