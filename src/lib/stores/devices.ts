import { create } from 'zustand';
import { Device, Position } from '@/types';

interface DevicesState {
  devices: Device[];
  positions: Map<number, Position>;
  selectedDeviceId: number | null;
  setDevices: (devices: Device[]) => void;
  updatePositions: (positions: Position[]) => void;
  selectDevice: (deviceId: number | null) => void;
  getDevicePosition: (deviceId: number) => Position | undefined;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: [],
  positions: new Map(),
  selectedDeviceId: null,
  
  setDevices: (devices) => set({ devices }),
  
  updatePositions: (positions) => {
    const positionsMap = new Map<number, Position>();
    positions.forEach(pos => {
      positionsMap.set(pos.deviceId, pos);
    });
    set({ positions: positionsMap });
  },
  
  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId }),
  
  getDevicePosition: (deviceId) => get().positions.get(deviceId),
}));
