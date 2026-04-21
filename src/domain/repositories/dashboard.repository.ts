import { DashboardRawMetrics } from '../datasources/dashboard.datasource';

export interface DashboardRepository {
  getRawMetrics(monthStart: Date, monthEnd: Date): Promise<DashboardRawMetrics>;
}
