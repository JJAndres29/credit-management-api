export const BUSINESS_ALERT_TRIGGERED = 'BusinessAlertTriggered' as const;

export type BusinessAlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface BusinessAlertTriggeredData {
  code: string;
  message: string;
  severity: BusinessAlertSeverity;
  /** Safe, small JSON-serializable context for logs / email */
  details?: Record<string, unknown>;
}
