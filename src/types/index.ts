// Organization/Tenant Types (Multi-tenant support)
export interface Organization {
  id: number;
  name: string;
  slug: string; // URL-friendly identifier (subdomain)
  domain?: string; // Custom domain
  settings: {
    maxDevices: number;
    maxUsers: number;
    features: string[]; // enabled features
  };
  traccarUserId: number; // Maps to Traccar admin user for this tenant
  status: 'active' | 'suspended' | 'trial';
  plan: 'basic' | 'professional' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

export interface TenantContext {
  organizationId: number;
  organization: Organization;
  permissions: string[];
}

// User Types
export type UserRole = 'superadmin' | 'admin' | 'operator' | 'client';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: number; // Tenant association
  clientId?: number;
  phone?: string;
  avatar?: string;
  disabled?: boolean; // Status da conta
  deviceLimit?: number; // Limite de dispositivos
  userLimit?: number; // Limite de usuários subordinados
  token?: string; // Token de sessão atual
  expirationTime?: string; // Expiracao do token
  lastLogin?: string; // Última conexão
  createdAt: string;
  updatedAt: string;
}

// Permissões de usuário (relacionamento User-Device no Traccar)
export interface UserPermission {
  userId: number;
  deviceId: number;
}

export interface AuthResponse {
  user: User;
  token: string;
  organization?: Organization;
}

// Device Types (Baseado no Traccar)
export type DeviceStatus = 'online' | 'offline' | 'moving' | 'stopped' | 'blocked';
export type VehicleCategory = 'car' | 'motorcycle' | 'truck' | 'bus' | 'trailer' | 'bicycle' | 'airplane' | 'boat' | 'van';

export interface Device {
  id: number;
  name: string;
  uniqueId: string;
  plate: string;
  status: DeviceStatus;
  lastUpdate: string;
  positionId?: number;
  clientId?: number;
  category: VehicleCategory;
  model?: string;
  year?: number;
  color?: string;
  phone?: string;
  contact?: string;
  disabled?: boolean;
  speedLimit?: number;
  attributes: {
    ignition?: boolean;
    blocked?: boolean;
    batteryLevel?: number;
  };
}

// Position Types (Baseado no Traccar)
export interface Position {
  id: number;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // km/h
  course: number; // degrees
  address?: string;
  accuracy: number;
  network?: {
    radioType: string;
    cellId: number;
    locationAreaCode: number;
  };
  attributes: {
    ignition?: boolean;
    blocked?: boolean;
    batteryLevel?: number;
    distance?: number;
    totalDistance?: number;
    motion?: boolean;
    sat?: number; // satellites
    odometer?: number;
  };
}

// Event Types
export type EventType = 
  | 'ignitionOn' 
  | 'ignitionOff' 
  | 'speedLimit' 
  | 'geofence' 
  | 'lowBattery' 
  | 'connectionLost'
  | 'connectionRestored'
  | 'deviceBlocked'
  | 'deviceUnblocked';

export interface Event {
  id: number;
  type: EventType;
  deviceId: number;
  positionId?: number;
  serverTime: string;
  attributes: Record<string, any>;
  resolved: boolean;
}

// Command Types
export type CommandType = 'positionRequest' | 'engineStop' | 'engineResume' | 'deviceReboot';

export interface Command {
  id: number;
  deviceId: number;
  type: CommandType;
  sentTime: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  attributes?: Record<string, any>;
}

// Client Types
export interface Client {
  id: number;
  name: string;
  document: string; // CPF/CNPJ
  email: string;
  phone: string;
  address?: string;
  plan: 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'canceled';
  createdAt: string;
  devicesCount: number;
}

// Driver Types
export interface Driver {
  id: number;
  name: string;
  document: string; // CPF
  licenseNumber: string; // CNH
  licenseCategory: 'A' | 'B' | 'C' | 'D' | 'E' | 'AB' | 'AC' | 'AD' | 'AE';
  licenseExpiry: string;
  phone: string;
  email?: string;
  photo?: string;
  status: 'active' | 'inactive' | 'suspended';
  clientId?: number;
  currentDeviceId?: number;
  createdAt: string;
  updatedAt: string;
}

// Maintenance Types
export interface Maintenance {
  id: number;
  deviceId: number;
  deviceName?: string;
  type: 'oil_change' | 'tire_rotation' | 'brake_service' | 'general_inspection' | 'other';
  description: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue';
  scheduledDate?: string;
  completedDate?: string;
  cost?: number;
  odometer?: number;
  nextOdometer?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Route/Trip Types
export interface Trip {
  id: number;
  deviceId: number;
  startTime: string;
  endTime: string;
  distance: number; // km
  duration: number; // seconds
  averageSpeed: number;
  maxSpeed: number;
  startPosition: Position;
  endPosition: Position;
  positions: Position[];
}

// Roteirização: rotas planejadas para dispositivos
export interface PlannedRouteWaypoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface PlannedRoute {
  id: string;
  name: string;
  deviceId: number;
  waypoints: PlannedRouteWaypoint[];
  createdAt: string;
  updatedAt: string;
}

// Statistics Types
export interface DeviceStatistics {
  total: number;
  online: number;
  offline: number;
  moving: number;
  stopped: number;
  blocked: number;
}

export interface DashboardStats {
  devices: DeviceStatistics;
  activeAlerts: number;
  eventsToday: number;
  clients: number;
}

// Geofence Types
export type GeofenceType = 'polygon' | 'circle' | 'rectangle';

export interface Geofence {
  id: number;
  name: string;
  description?: string;
  type: GeofenceType;
  area: string; // WKT format
  color?: string;
  clientId: number;
  active: boolean;
  calendarId?: number;
  attributes?: Record<string, unknown>;
  createdAt: string;
}

// Notification Types
export type NotificationType = 'email' | 'sms' | 'push' | 'webhook';
export type NotificationEvent = EventType | 'geofenceEnter' | 'geofenceExit' | 'maintenance';

export interface Notification {
  id: number;
  name: string;
  type: NotificationType;
  event: NotificationEvent;
  deviceIds?: number[];
  geofenceIds?: number[];
  enabled: boolean;
  attributes: {
    email?: string;
    phone?: string;
    webhookUrl?: string;
    message?: string;
  };
  createdAt: string;
}

export interface NotificationLog {
  id: number;
  notificationId: number;
  deviceId: number;
  eventId: number;
  sentTime: string;
  status: 'sent' | 'failed' | 'pending';
  message?: string;
}

// Driver Types
export interface Driver {
  id: number;
  name: string;
  document: string; // CPF
  license: string; // CNH
  licenseCategory: string;
  licenseExpiry: string;
  phone: string;
  email?: string;
  photo?: string;
  clientId: number;
  active: boolean;
  attributes?: Record<string, any>;
  createdAt: string;
}

// Maintenance Types
export interface Maintenance {
  id: number;
  deviceId: number;
  type: 'preventive' | 'corrective' | 'inspection';
  description: string;
  scheduledDate?: string;
  completedDate?: string;
  odometer?: number;
  cost?: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
  notes?: string;
  createdAt: string;
}

export interface MaintenanceRule {
  id: number;
  deviceId: number;
  name: string;
  type: 'odometer' | 'time' | 'engineHours';
  interval: number; // km, days, or hours
  lastMaintenance?: number;
  nextMaintenance: number;
  enabled: boolean;
  notifyBefore: number; // days or km
}

// Report Types
export type ReportType = 'trips' | 'stops' | 'events' | 'summary' | 'fuel';

export interface ReportFilter {
  deviceIds: number[];
  from: string;
  to: string;
  type: ReportType;
}

export interface TripReport {
  deviceId: number;
  deviceName: string;
  trips: Trip[];
  totalDistance: number;
  totalDuration: number;
  averageSpeed: number;
}

export interface StopReport {
  deviceId: number;
  deviceName: string;
  stops: {
    id: number;
    position: Position;
    startTime: string;
    endTime: string;
    duration: number; // seconds
    address?: string;
  }[];
  totalStops: number;
  totalDuration: number;
}

// Group Types
export interface Group {
  id: number;
  name: string;
  parentId?: number;
  description?: string;
  attributes?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Calendar Types
export interface Calendar {
  id: number;
  name: string;
  description?: string;
  data: string; // iCal format
  attributes?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Computed Attributes Types
export interface ComputedAttribute {
  id: number;
  name: string;
  description?: string;
  attribute: string; // Nome do atributo resultante
  expression: string; // Fórmula de cálculo
  type: 'string' | 'number' | 'boolean';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shared Device Types
export interface SharedDevice {
  id: number;
  deviceId: number;
  userId: number;
  permissions: {
    view: boolean;
    edit: boolean;
    command: boolean;
  };
  createdAt: string;
  expiresAt?: string;
}

// Audit Log Types
export interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  resource: string;
  resourceId?: number;
  details: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

// System Settings Types
export interface SystemSettings {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  updatedAt: string;
  updatedBy?: number;
}

export interface UserPreferences {
  userId: number;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  timezone: string;
  units: {
    distance: 'km' | 'mi';
    speed: 'kmh' | 'mph';
    temperature: 'celsius' | 'fahrenheit';
    volume: 'liter' | 'gallon';
  };
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  mapDefaults: {
    zoom: number;
    center: [number, number];
    layer: string;
  };
}

// OBD-II / Computador de Bordo Types
export interface OBDData {
  deviceId: number;
  timestamp: string;
  rpm?: number;
  speed?: number;
  engineLoad?: number;
  coolantTemp?: number;
  fuelLevel?: number;
  fuelConsumption?: number;
  throttlePosition?: number;
  engineHours?: number;
  batteryVoltage?: number;
  dtcCodes?: string[]; // Diagnostic Trouble Codes
  attributes?: Record<string, any>;
}

export interface OBDStatistics {
  deviceId: number;
  period: 'day' | 'week' | 'month';
  averageRPM: number;
  maxRPM: number;
  averageSpeed: number;
  maxSpeed: number;
  totalFuel: number;
  averageFuelConsumption: number;
  engineHours: number;
  idleTime: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Video Telemetry Types
export type CameraPosition = 'front' | 'rear' | 'left' | 'right' | 'cabin' | 'cargo';
export type CameraStatus = 'online' | 'offline' | 'recording' | 'error';
export type VideoQuality = 'auto' | 'hd' | 'sd' | 'low';
export type StorageType = 'local' | 'cloud' | 'hybrid';

export interface Camera {
  id: number;
  deviceId: number;
  channel: number; // CH1, CH2, CH3, CH4
  position: CameraPosition;
  name: string;
  status: CameraStatus;
  streamUrl?: string;
  recordingUrl?: string;
  resolution: string; // "1920x1080", "1280x720"
  fps: number;
  hasAudio: boolean;
  hasPTZ: boolean; // Pan/Tilt/Zoom
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoStream {
  cameraId: number;
  deviceId: number;
  streamUrl: string;
  quality: VideoQuality;
  isLive: boolean;
  latency: number; // ms
  bitrate: number; // kbps
  viewerCount?: number;
}

export interface VideoRecording {
  id: number;
  cameraId: number;
  deviceId: number;
  startTime: string;
  endTime: string;
  duration: number; // seconds
  fileSize: number; // bytes
  url: string;
  thumbnailUrl?: string;
  hasGPS: boolean;
  eventType?: 'alarm' | 'collision' | 'harsh_brake' | 'manual';
  storageType: StorageType;
  metadata?: {
    speed?: number;
    location?: { lat: number; lng: number };
    events?: string[];
  };
}

export interface VideoEvent {
  id: number;
  deviceId: number;
  cameraId: number;
  recordingId?: number;
  type: 'motion' | 'alarm' | 'collision' | 'harsh_brake' | 'harsh_turn' | 'speeding' | 'smoking' | 'drowsiness' | 'distraction' | 'phone_use' | 'no_seatbelt' | 'dangerous_overtake' | 'tailgating' | 'lane_departure';
  timestamp: string;
  snapshotUrl?: string;
  clipUrl?: string;
  duration?: number; // seconds of clip
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface CameraSettings {
  deviceId: number;
  recordingQuality: VideoQuality;
  streamQuality: VideoQuality;
  recordingMode: 'continuous' | 'event' | 'manual';
  motionDetection: boolean;
  audioRecording: boolean;
  storageType: StorageType;
  retentionDays: number;
  preRecordSeconds: number;
  postRecordSeconds: number;
}
