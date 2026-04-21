import { DashboardDatasource, DashboardRawMetrics } from '../../domain/datasources/dashboard.datasource';
import { DashboardRepository } from '../../domain/repositories/dashboard.repository';

export class DashboardRepositoryImpl implements DashboardRepository {
  constructor(private readonly datasource: DashboardDatasource) {}

  getRawMetrics(monthStart: Date, monthEnd: Date): Promise<DashboardRawMetrics> {
    return this.datasource.getRawMetrics(monthStart, monthEnd);
  }
}
