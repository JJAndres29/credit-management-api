/**
 * Worker BullMQ para procesar emails de staff encolados (`QueuedEmailService`).
 * Ejecutar: `npm run worker:notifications` (requiere REDIS_URL + MAILER_*).
 */
import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { envs } from '../config/envs';
import {
  STAFF_NOTIFICATION_QUEUE_NAME,
  deserializeEmailJob,
  StaffNotificationEmailJob,
} from '../infrastructure/messaging/staff-notification.queue';
import { NodemailerEmailService } from '../infrastructure/services/nodemailer-email.service';
import { CircuitBreakerEmailService } from '../infrastructure/messaging/circuit-breaker-email.service';
import { globalLogger } from '../infrastructure/services/pino-logger.service';

async function main(): Promise<void> {
  if (!envs.redisUrl) {
    globalLogger.error('[notification.worker] REDIS_URL es obligatoria para este proceso');
    process.exit(1);
  }

  const connection = new Redis(envs.redisUrl, { maxRetriesPerRequest: null });
  const inner = new NodemailerEmailService();
  const mail = new CircuitBreakerEmailService(inner, {
    failureThreshold: 5,
    openMs: 30_000,
    logger: globalLogger,
    serviceLabel: 'WorkerEmail',
  });

  const worker = new Worker(
    STAFF_NOTIFICATION_QUEUE_NAME,
    async (job) => {
      if (job.name !== 'email') return;
      const payload = job.data as StaffNotificationEmailJob;
      await mail.sendEmail(deserializeEmailJob(payload));
    },
    { connection },
  );

  worker.on('completed', (job) => {
    globalLogger.debug('[notification.worker] job ok', { id: job.id });
  });
  worker.on('failed', (job, err) => {
    globalLogger.error('[notification.worker] job failed', err, { id: job?.id });
  });

  globalLogger.info('[notification.worker] Escuchando cola', { queue: STAFF_NOTIFICATION_QUEUE_NAME });
}

main().catch((err) => {
  globalLogger.error('[notification.worker] fatal', err);
  process.exit(1);
});
