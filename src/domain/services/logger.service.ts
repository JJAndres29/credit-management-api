/**
 * Puerto del Logger — capa de dominio.
 *
 * Las implementaciones concretas viven en infraestructura (pino).
 * Los use cases y el error handler reciben LoggerService por constructor,
 * igual que EmailService o NotificationService.
 *
 * Uso en un use case:
 *   constructor(
 *     private readonly someRepo: SomeRepository,
 *     private readonly logger?: LoggerService,
 *   ) {}
 *
 *   this.logger?.info('Operación completada', { id });
 */
export interface LoggerService {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  /** @param error  La instancia del Error original (se serializa con stack trace en producción) */
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
