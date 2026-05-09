import { EventEmitterPort } from '../../domain/events';
import { CUSTOMER_PASSWORD_RESET, CustomerPasswordResetData } from '../../domain/events/customer-password-reset.event';
import { EmailService } from '../../domain/services';
import { globalLogger } from '../services';

export class CustomerPasswordResetSubscriber {
  constructor(
    private readonly eventEmitter: EventEmitterPort,
    private readonly emailService: EmailService,
  ) {
    this.eventEmitter.on(CUSTOMER_PASSWORD_RESET, (data) => {
      this.handle(data as CustomerPasswordResetData).catch((err) => {
        globalLogger.error('[CustomerPasswordReset] Subscriber error', err);
      });
    });
  }

  private async handle(data: CustomerPasswordResetData): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: data.customerEmail,
        subject: 'Restablecimiento de contraseña',
        htmlBody: `
          <h2>Hola ${data.customerName},</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Tu contraseña temporal es: <strong>${data.tempPassword}</strong></p>
          <p>Por seguridad, deberás cambiarla al iniciar sesión.</p>
          <p>Si no solicitaste este cambio, ignora este correo.</p>
        `,
      });
      globalLogger.info('[CustomerPasswordReset] Email enviado', { customerEmail: data.customerEmail });
    } catch (err) {
      globalLogger.error('[CustomerPasswordReset] Email fallido', err, { customerEmail: data.customerEmail });
    }
  }
}
