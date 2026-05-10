import { EmailService } from '../../domain/services/email.service';
import { NotificationService } from '../../domain/services/notification.service';
import { LoggerService } from '../../domain/services/logger.service';
import { NodemailerEmailService } from '../services/nodemailer-email.service';
import { MetaWhatsAppService } from '../services/meta-whatsapp.service';
import { QueuedEmailService } from './queued-email.service';
import { CircuitBreakerEmailService } from './circuit-breaker-email.service';
import { CircuitBreakerNotificationService } from './circuit-breaker-notification.service';

export type StaffChannelServices = {
  /** Null cuando MAILER_* ausentes */
  emailService: EmailService | null;
  whatsAppService: NotificationService | null;
};

/**
 * Composition root para subscribers de staff (pagos, ventas, notify cliente).
 * - Sin REDIS_URL: envío sincrónico con breaker en SMTP/WhatsApp.
 * - Con REDIS_URL: emails encolados (worker separado); breaker en worker/procesador.
 */
export function buildStaffChannelServices(logger?: LoggerService): StaffChannelServices {
  const innerMail = new NodemailerEmailService();
  const queuedMail = new QueuedEmailService(innerMail);
  const emailService: EmailService | null = innerMail.isEnabled
    ? new CircuitBreakerEmailService(queuedMail, {
        failureThreshold: 5,
        openMs: 30_000,
        logger,
        serviceLabel: 'Email',
      })
    : null;

  const innerWa = new MetaWhatsAppService();
  const whatsAppService: NotificationService | null = innerWa.isEnabled
    ? new CircuitBreakerNotificationService(innerWa, {
        failureThreshold: 5,
        openMs: 30_000,
        logger,
      })
    : null;

  return { emailService, whatsAppService };
}
