import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { envs } from '../../config/envs';
import { SendEmailOptions } from '../../domain/services/email.service';
import { globalLogger } from '../services/pino-logger.service';

export const STAFF_NOTIFICATION_QUEUE_NAME = 'staff_notifications';

export type StaffNotificationEmailJob = {
  kind: 'email';
  options: SendEmailOptionsSerializable;
};

/** JSON-safe email payload (buffers → base64) */
export type SendEmailOptionsSerializable = Omit<SendEmailOptions, 'attachments'> & {
  attachments?: Array<{
    filename: string;
    contentBase64?: string;
    path?: string;
    contentType?: string;
  }>;
};

let sharedQueue: Queue | null | undefined;

export function getStaffNotificationQueue(): Queue | null {
  if (sharedQueue !== undefined) return sharedQueue;
  if (!envs.redisUrl) {
    sharedQueue = null;
    return sharedQueue;
  }
  try {
    const connection = new Redis(envs.redisUrl, { maxRetriesPerRequest: null });
    sharedQueue = new Queue(STAFF_NOTIFICATION_QUEUE_NAME, { connection });
    return sharedQueue;
  } catch (err) {
    globalLogger.error('[staff-notification.queue] No se pudo inicializar la cola Redis', err);
    sharedQueue = null;
    return sharedQueue;
  }
}

export function serializeEmailJob(options: SendEmailOptions): StaffNotificationEmailJob {
  return {
    kind: 'email',
    options: {
      to: options.to,
      subject: options.subject,
      htmlBody: options.htmlBody,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        contentBase64: a.content ? a.content.toString('base64') : undefined,
        path: a.path,
        contentType: a.contentType,
      })),
    },
  };
}

export function deserializeEmailJob(job: StaffNotificationEmailJob): SendEmailOptions {
  const { options } = job;
  return {
    to: options.to,
    subject: options.subject,
    htmlBody: options.htmlBody,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      path: a.path,
      contentType: a.contentType,
      content: a.contentBase64 ? Buffer.from(a.contentBase64, 'base64') : undefined,
    })),
  };
}
