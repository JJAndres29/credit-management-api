import pino from 'pino';
import { LoggerService } from '../../domain/services/logger.service';

/**
 * Implementación de LoggerService con Pino.
 *
 * Salida:
 *   - development: pretty-print legible en consola (pino/pretty).
 *   - production:  JSON estructurado con timestamp ISO — apto para Datadog, CloudWatch, etc.
 *
 * No expone credenciales ni datos sensibles; los use cases son responsables
 * de omitir campos confidenciales en el `meta` que pasan al logger.
 */
export class PinoLoggerService implements LoggerService {
  private readonly logger: pino.Logger;

  constructor() {
    const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';

    this.logger = pino({
      level: isDev ? 'debug' : 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      ...(isDev
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : {}),
    });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta ?? {}, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta ?? {}, message);
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    this.logger.error({ ...(meta ?? {}), err: error }, message);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta ?? {}, message);
  }
}

/**
 * Singleton compartido por toda la aplicación.
 *
 * Los routers (composition roots) importan esta instancia para inyectarla
 * en use cases o pasarla al Server — igual que globalEventEmitter.
 *
 * En tests, se puede reemplazar con un mock de LoggerService
 * sin importar este módulo.
 */
export const globalLogger = new PinoLoggerService();
