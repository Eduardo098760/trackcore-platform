import type { KPIEvaluationResult, KPIReportFrequency, KPIReportPeriod } from "@/types/kpi";
import type { DashboardStats } from "@/types";

export interface DashboardSummarySettings {
  enabled: boolean;
  recipientEmail: string;
  frequency: KPIReportFrequency;
  period: KPIReportPeriod;
  deliveryTime: string;
  weeklyDay: number;
  lastSentAt?: string | null;
  nextRunAt?: string | null;
}

export interface DashboardSummaryPayload {
  stats: DashboardStats;
  customKpis: KPIEvaluationResult[];
  issueTotals: {
    totalProblems: number;
    vehiclesAffected: number;
    overspeedEvents: number;
    alarms: number;
    batteryAlerts: number;
    connectivityIssues: number;
    maintenanceAlerts: number;
  };
  problemVehicles: DashboardSummaryVehicleIssue[];
  periodLabel: string;
  generatedAt: string;
}

export interface DashboardSummaryVehicleIssue {
  deviceId: number;
  name: string;
  plate: string;
  currentStatus: string;
  issueCount: number;
  overspeedCount: number;
  alarmCount: number;
  batteryCount: number;
  connectivityCount: number;
  maintenanceCount: number;
  lastIssueAt: string;
  issueLabels: string[];
  latestIssueLabel: string;
  maxRecordedSpeed?: number | null;
  maxAllowedSpeed?: number | null;
  maxExcessSpeed?: number | null;
}
