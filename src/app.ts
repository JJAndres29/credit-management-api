import { envs } from './config/envs';
import { Server } from './presentation/server';

const main = (): void => {
  new Server({ port: envs.port }).start();
};

main();
