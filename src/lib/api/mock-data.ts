import { User, Device, Position, Event, Client, Command, DeviceStatus } from '@/types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: 1,
    name: 'Admin Master',
    email: 'admin@nova.com',
    role: 'admin',
    phone: '(11) 98765-4321',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Operador Sistema',
    email: 'operador@nova.com',
    role: 'operator',
    phone: '(11) 98765-4322',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    name: 'Cliente Demo',
    email: 'cliente@nova.com',
    role: 'client',
    clientId: 1,
    phone: '(11) 98765-4323',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

// Mock Clients
export const mockClients: Client[] = [
  {
    id: 1,
    name: 'Transportadora ABC Ltda',
    document: '12.345.678/0001-90',
    email: 'contato@transportadoraabc.com',
    phone: '(11) 3456-7890',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    plan: 'professional',
    status: 'active',
    createdAt: '2024-01-15T00:00:00Z',
    devicesCount: 15
  },
  {
    id: 2,
    name: 'Logística XYZ',
    document: '98.765.432/0001-10',
    email: 'contato@logisticaxyz.com',
    phone: '(11) 3456-7891',
    address: 'Rua Consolação, 500 - São Paulo, SP',
    plan: 'enterprise',
    status: 'active',
    createdAt: '2024-02-01T00:00:00Z',
    devicesCount: 50
  },
  {
    id: 3,
    name: 'Entregas Rápidas',
    document: '11.222.333/0001-44',
    email: 'contato@entregasrapidas.com',
    phone: '(11) 3456-7892',
    address: 'Av. Brigadeiro, 200 - São Paulo, SP',
    plan: 'basic',
    status: 'active',
    createdAt: '2024-03-10T00:00:00Z',
    devicesCount: 5
  }
];

// Mock Devices
export const mockDevices: Device[] = [
  {
    id: 1,
    name: 'Chevrolet Onix - ABC1234',
    uniqueId: 'device001',
    plate: 'ABC-1234',
    status: 'moving',
    lastUpdate: new Date(Date.now() - 30000).toISOString(),
    positionId: 1,
    clientId: 1,
    category: 'car',
    model: 'Chevrolet Onix',
    year: 2022,
    color: 'Branco',
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 85
    }
  },
  {
    id: 2,
    name: 'Honda CG 160 - XYZ9876',
    uniqueId: 'device002',
    plate: 'XYZ-9876',
    status: 'moving',
    lastUpdate: new Date(Date.now() - 120000).toISOString(),
    positionId: 2,
    clientId: 1,
    category: 'motorcycle',
    model: 'Honda CG 160',
    year: 2023,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 92
    }
  },
  {
    id: 3,
    name: 'Volkswagen Gol - DEF5678',
    uniqueId: 'device003',
    plate: 'DEF-5678',
    status: 'offline',
    lastUpdate: new Date(Date.now() - 3600000).toISOString(),
    positionId: 3,
    clientId: 2,
    category: 'car',
    model: 'Volkswagen Gol',
    year: 2020,
    attributes: {
      ignition: false,
      blocked: false,
      batteryLevel: 45
    }
  },
  {
    id: 4,
    name: 'Fiat Toro - GHI1357',
    uniqueId: 'device004',
    plate: 'GHI-1357',
    status: 'moving',
    lastUpdate: new Date(Date.now() - 15000).toISOString(),
    positionId: 4,
    clientId: 2,
    category: 'truck',
    model: 'Fiat Toro',
    year: 2021,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 78
    }
  },
  {
    id: 5,
    name: 'Mercedes Sprinter - JKL2468',
    uniqueId: 'device005',
    plate: 'JKL-2468',
    status: 'blocked',
    lastUpdate: new Date(Date.now() - 900000).toISOString(),
    positionId: 5,
    clientId: 1,
    category: 'bus',
    model: 'Mercedes Sprinter',
    year: 2019,
    attributes: {
      ignition: false,
      blocked: true,
      batteryLevel: 60
    }
  },
  {
    id: 6,
    name: 'Toyota Corolla - MNO3579',
    uniqueId: 'device006',
    plate: 'MNO-3579',
    status: 'online',
    lastUpdate: new Date(Date.now() - 45000).toISOString(),
    positionId: 6,
    clientId: 3,
    category: 'car',
    model: 'Toyota Corolla',
    year: 2023,
    attributes: {
      ignition: false,
      blocked: false,
      batteryLevel: 95
    }
  },
  {
    id: 7,
    name: 'Hyundai HB20 - PQR4680',
    uniqueId: 'device007',
    plate: 'PQR-4680',
    status: 'moving',
    lastUpdate: new Date(Date.now() - 20000).toISOString(),
    positionId: 7,
    clientId: 3,
    category: 'car',
    model: 'Hyundai HB20',
    year: 2022,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 88
    }
  },
  {
    id: 8,
    name: 'Ford Ranger - STU7891',
    uniqueId: 'device008',
    plate: 'STU-7891',
    status: 'stopped',
    lastUpdate: new Date(Date.now() - 180000).toISOString(),
    positionId: 8,
    clientId: 2,
    category: 'truck',
    model: 'Ford Ranger',
    year: 2021,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 72
    }
  }
];

// Mock Positions (São Paulo region)
export const mockPositions: Position[] = [
  {
    id: 1,
    deviceId: 1,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 30000).toISOString(),
    deviceTime: new Date(Date.now() - 30000).toISOString(),
    fixTime: new Date(Date.now() - 30000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5505,
    longitude: -46.6333,
    altitude: 760,
    speed: 45,
    course: 90,
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    accuracy: 10,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 85,
      distance: 5.2,
      totalDistance: 1520.5,
      motion: true,
      sat: 12,
      odometer: 25000
    }
  },
  {
    id: 2,
    deviceId: 2,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 120000).toISOString(),
    deviceTime: new Date(Date.now() - 120000).toISOString(),
    fixTime: new Date(Date.now() - 120000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5629,
    longitude: -46.6544,
    altitude: 740,
    speed: 0,
    course: 180,
    address: 'Rua da Consolação, 500 - Consolação, São Paulo - SP',
    accuracy: 8,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 92,
      distance: 0,
      totalDistance: 850.3,
      motion: false,
      sat: 10,
      odometer: 12000
    }
  },
  {
    id: 3,
    deviceId: 3,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 3600000).toISOString(),
    deviceTime: new Date(Date.now() - 3600000).toISOString(),
    fixTime: new Date(Date.now() - 3600000).toISOString(),
    outdated: true,
    valid: true,
    latitude: -23.5489,
    longitude: -46.6388,
    altitude: 755,
    speed: 0,
    course: 270,
    address: 'Av. Ipiranga, 200 - República, São Paulo - SP',
    accuracy: 15,
    attributes: {
      ignition: false,
      blocked: false,
      batteryLevel: 45,
      distance: 0,
      totalDistance: 2100.8,
      motion: false,
      sat: 8,
      odometer: 45000
    }
  },
  {
    id: 4,
    deviceId: 4,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 15000).toISOString(),
    deviceTime: new Date(Date.now() - 15000).toISOString(),
    fixTime: new Date(Date.now() - 15000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5475,
    longitude: -46.6361,
    altitude: 745,
    speed: 60,
    course: 45,
    address: 'Av. São João, 800 - Centro, São Paulo - SP',
    accuracy: 12,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 78,
      distance: 8.5,
      totalDistance: 3200.5,
      motion: true,
      sat: 11,
      odometer: 32000
    }
  },
  {
    id: 5,
    deviceId: 5,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 900000).toISOString(),
    deviceTime: new Date(Date.now() - 900000).toISOString(),
    fixTime: new Date(Date.now() - 900000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5558,
    longitude: -46.6396,
    altitude: 765,
    speed: 0,
    course: 0,
    address: 'Av. Brigadeiro Luís Antônio, 500 - Bela Vista, São Paulo - SP',
    accuracy: 10,
    attributes: {
      ignition: false,
      blocked: true,
      batteryLevel: 60,
      distance: 0,
      totalDistance: 5600.2,
      motion: false,
      sat: 9,
      odometer: 78000
    }
  },
  {
    id: 6,
    deviceId: 6,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 45000).toISOString(),
    deviceTime: new Date(Date.now() - 45000).toISOString(),
    fixTime: new Date(Date.now() - 45000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5733,
    longitude: -46.6417,
    altitude: 735,
    speed: 0,
    course: 90,
    address: 'Av. Rebouças, 1200 - Pinheiros, São Paulo - SP',
    accuracy: 8,
    attributes: {
      ignition: false,
      blocked: false,
      batteryLevel: 95,
      distance: 0,
      totalDistance: 450.5,
      motion: false,
      sat: 13,
      odometer: 5000
    }
  },
  {
    id: 7,
    deviceId: 7,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 20000).toISOString(),
    deviceTime: new Date(Date.now() - 20000).toISOString(),
    fixTime: new Date(Date.now() - 20000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5650,
    longitude: -46.6500,
    altitude: 750,
    speed: 35,
    course: 180,
    address: 'R. Augusta, 1500 - Consolação, São Paulo - SP',
    accuracy: 9,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 88,
      distance: 3.2,
      totalDistance: 890.7,
      motion: true,
      sat: 11,
      odometer: 8500
    }
  },
  {
    id: 8,
    deviceId: 8,
    protocol: 'gt06',
    serverTime: new Date(Date.now() - 180000).toISOString(),
    deviceTime: new Date(Date.now() - 180000).toISOString(),
    fixTime: new Date(Date.now() - 180000).toISOString(),
    outdated: false,
    valid: true,
    latitude: -23.5425,
    longitude: -46.6250,
    altitude: 770,
    speed: 0,
    course: 270,
    address: 'Av. do Estado, 300 - Brás, São Paulo - SP',
    accuracy: 11,
    attributes: {
      ignition: true,
      blocked: false,
      batteryLevel: 72,
      distance: 0,
      totalDistance: 4200.3,
      motion: false,
      sat: 10,
      odometer: 52000
    }
  }
];

// Mock Events
export const mockEvents: Event[] = [
  {
    id: 1,
    type: 'ignitionOn',
    deviceId: 1,
    positionId: 1,
    serverTime: new Date(Date.now() - 1800000).toISOString(),
    attributes: {},
    resolved: false
  },
  {
    id: 2,
    type: 'speedLimit',
    deviceId: 4,
    positionId: 4,
    serverTime: new Date(Date.now() - 900000).toISOString(),
    attributes: { speed: 85, limit: 60 },
    resolved: false
  },
  {
    id: 3,
    type: 'lowBattery',
    deviceId: 3,
    positionId: 3,
    serverTime: new Date(Date.now() - 7200000).toISOString(),
    attributes: { batteryLevel: 45 },
    resolved: false
  },
  {
    id: 4,
    type: 'deviceBlocked',
    deviceId: 5,
    positionId: 5,
    serverTime: new Date(Date.now() - 900000).toISOString(),
    attributes: {},
    resolved: false
  },
  {
    id: 5,
    type: 'ignitionOff',
    deviceId: 2,
    positionId: 2,
    serverTime: new Date(Date.now() - 3600000).toISOString(),
    attributes: {},
    resolved: true
  },
  {
    id: 6,
    type: 'connectionLost',
    deviceId: 3,
    positionId: 3,
    serverTime: new Date(Date.now() - 5400000).toISOString(),
    attributes: {},
    resolved: false
  }
];

// Mock Commands
export const mockCommands: Command[] = [
  {
    id: 1,
    deviceId: 5,
    type: 'engineStop',
    sentTime: new Date(Date.now() - 900000).toISOString(),
    status: 'delivered',
    attributes: {}
  },
  {
    id: 2,
    deviceId: 1,
    type: 'positionRequest',
    sentTime: new Date(Date.now() - 300000).toISOString(),
    status: 'delivered',
    attributes: {}
  }
];

// Helper functions
export function getDeviceById(id: number): Device | undefined {
  return mockDevices.find(d => d.id === id);
}

export function getPositionByDeviceId(deviceId: number): Position | undefined {
  return mockPositions.find(p => p.deviceId === deviceId);
}

export function getEventsByDeviceId(deviceId: number): Event[] {
  return mockEvents.filter(e => e.deviceId === deviceId);
}

export function getClientById(id: number): Client | undefined {
  return mockClients.find(c => c.id === id);
}

export function updateDevicePosition(deviceId: number): Position {
  const position = mockPositions.find(p => p.deviceId === deviceId);
  if (!position) throw new Error('Position not found');
  
  // Simular movimento aleatório
  const now = new Date().toISOString();
  const newPosition = {
    ...position,
    id: position.id,
    serverTime: now,
    deviceTime: now,
    fixTime: now,
    latitude: position.latitude + (Math.random() - 0.5) * 0.001,
    longitude: position.longitude + (Math.random() - 0.5) * 0.001,
    speed: position.attributes.motion ? Math.random() * 80 : 0,
    course: Math.random() * 360
  };
  
  return newPosition;
}
