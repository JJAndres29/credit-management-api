import { envs } from './config/envs';
import { Server } from './presentation/server';
import { globalLogger } from './infrastructure/services/pino-logger.service';

const main = (): void => {
  new Server({ port: envs.port, logger: globalLogger }).start();
};

main();
