import { EventEmitterPort } from '../../domain/events';
import { BUSINESS_ALERT_TRIGGERED, type BusinessAlertTriggeredData } from '../../domain/events/business-alert-triggered.event';
import { EmailService } from '../../domain/services';
import { envs } from '../../config/envs';
import { globalLogger } from '../services';

export class BusinessAlertSubscriber {
  constructor(
    private readonly eventEmitter: EventEmitterPort,
    private readonly emailService: EmailService,
  ) {
    this.eventEmitter.on(BUSINESS_ALERT_TRIGGERED, (data) => {
      this.handle(data as BusinessAlertTriggeredData).catch((err) => {
        globalLogger.error('[BusinessAlert] Subscriber error', err);
      });
    });
  }

  private async handle(data: BusinessAlertTriggeredData): Promise<void> {
    const recipients = envs.businessAlertEmails;
    if (recipients.length === 0) {
      globalLogger.debug('[BusinessAlert] Sin BUSINESS_ALERT_EMAILS — solo log', { code: data.code });
      return;
    }
    if (!envs.mailer.email || !envs.mailer.secretKey) {
      globalLogger.warn('[BusinessAlert] Mailer no configurado — alerta no enviada', { code: data.code });
      return;
    }

    const subject = `[${data.severity}] ${data.code}`;
    const body = `<p><strong>${data.message}</strong></p><pre>${JSON.stringify(data.details ?? {}, null, 2)}</pre>`;

    for (const to of recipients) {
      try {
        await this.emailService.sendEmail({ to, subject, htmlBody: body });
        globalLogger.info('[BusinessAlert] Email enviado', { to, code: data.code });
      } catch (err) {
        globalLogger.error('[BusinessAlert] Fallo al enviar', err, { to, code: data.code });
      }
    }
  }
}
