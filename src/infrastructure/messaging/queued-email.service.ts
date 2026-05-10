import { JobsOptions } from 'bullmq';
import { EmailService, SendEmailOptions } from '../../domain/services/email.service';
import { NodemailerEmailService } from '../services/nodemailer-email.service';
import {
  getStaffNotificationQueue,
  serializeEmailJob,
  StaffNotificationEmailJob,
} from './staff-notification.queue';
import { globalLogger } from '../services/pino-logger.service';

/**
 * Producer-side adapter: encola envíos SMTP. Requiere worker (`npm run worker:notifications`).
 */
export class QueuedEmailService implements EmailService {
  constructor(private readonly inner: NodemailerEmailService) {}

  get isEnabled(): boolean {
    return this.inner.isEnabled;
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.inner.isEnabled) return false;
    const queue = getStaffNotificationQueue();
    if (!queue) {
      return this.inner.sendEmail(options);
    }
    try {
      const payload: StaffNotificationEmailJob = serializeEmailJob(options);
      const opts: JobsOptions = {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      };
      await queue.add('email', payload, opts);
      return true;
    } catch (err) {
      globalLogger.error('[QueuedEmailService] Fallo al encolar — fallback inline', err);
      return this.inner.sendEmail(options);
    }
  }
}
