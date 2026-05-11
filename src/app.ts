import { envs } from './config/envs';
import { prisma } from './config/prisma';
import { Server } from './presentation/server';
import { globalLogger } from './infrastructure/services/pino-logger.service';
import {
  AnalyticsReadModelsRefreshJob,
  BusinessAlertsEvaluationJob,
  OnlineOrderExpiryJob,
} from './infrastructure/jobs';
import { ExpireOnlineOrdersUseCase } from './domain/use-cases/online-orders';
import { OnlineOrderRepositoryImpl } from './infrastructure/repositories';
import { PrismaOnlineOrderDatasource } from './infrastructure/datasources';
import { ProductCatalogAdapter } from './infrastructure/services';
import { PrismaAnalyticsReadModelDatasource } from './infrastructure/datasources/prisma-analytics-read-model.datasource';
import { PrismaBusinessMetricsSnapshotDatasource } from './infrastructure/datasources/prisma-business-metrics-snapshot.datasource';
import { RefreshAnalyticsReadModelsUseCase } from './domain/use-cases/analytics';
import { EvaluateBusinessAlertsUseCase } from './domain/use-cases/business-alerts';
import { globalEventEmitter } from './infrastructure/events';
import { BusinessAlertSubscriber } from './infrastructure/subscribers';
import { NodemailerEmailService } from './infrastructure/services/nodemailer-email.service';

void new BusinessAlertSubscriber(globalEventEmitter, new NodemailerEmailService());

const expireUseCase = new ExpireOnlineOrdersUseCase(
  new OnlineOrderRepositoryImpl(new PrismaOnlineOrderDatasource()),
  new ProductCatalogAdapter(),
  globalLogger,
);
const expiryJob = new OnlineOrderExpiryJob(expireUseCase, globalLogger);

const analyticsReadModels = new PrismaAnalyticsReadModelDatasource();
const businessMetrics = new PrismaBusinessMetricsSnapshotDatasource();
const analyticsRefreshJob = new AnalyticsReadModelsRefreshJob(
  new RefreshAnalyticsReadModelsUseCase(analyticsReadModels),
  globalLogger,
);
const businessAlertsJob = new BusinessAlertsEvaluationJob(
  new EvaluateBusinessAlertsUseCase(analyticsReadModels, businessMetrics, globalEventEmitter),
  globalLogger,
);

const server = new Server({ port: envs.port, logger: globalLogger });
const httpServer = server.start();
expiryJob.start();
analyticsRefreshJob.start();
businessAlertsJob.start();

function shutdown(signal: string): void {
  globalLogger.info('Apagado en curso', { signal });
  expiryJob.stop();
  analyticsRefreshJob.stop();
  businessAlertsJob.stop();
  httpServer.close((err) => {
    if (err) {
      globalLogger.error('Error al cerrar el servidor HTTP', err);
    }
    void prisma.$disconnect().finally(() => process.exit(err ? 1 : 0));
  });

  setTimeout(() => {
    globalLogger.error('Forzando salida: timeout de apagado');
    process.exit(1);
  }, 25_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  globalLogger.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  globalLogger.error('[unhandledRejection]', reason);
});
