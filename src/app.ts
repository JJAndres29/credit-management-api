import { envs } from './config/envs';
import { Server } from './presentation/server';
import { globalLogger } from './infrastructure/services/pino-logger.service';
import { OnlineOrderExpiryJob } from './infrastructure/jobs';
import { ExpireOnlineOrdersUseCase } from './domain/use-cases/online-orders';
import { OnlineOrderRepositoryImpl } from './infrastructure/repositories';
import { PrismaOnlineOrderDatasource } from './infrastructure/datasources';
import { ProductCatalogAdapter } from './infrastructure/services';

const main = (): void => {
  new Server({ port: envs.port, logger: globalLogger }).start();

  // Background sweeper: cancels and refunds stock for unpaid orders past expiry.
  // Composed here at the entry point so the test suite can import the use case
  // without booting the timer.
  const expireUseCase = new ExpireOnlineOrdersUseCase(
    new OnlineOrderRepositoryImpl(new PrismaOnlineOrderDatasource()),
    new ProductCatalogAdapter(),
  );
  new OnlineOrderExpiryJob(expireUseCase, globalLogger).start();
};

main();
