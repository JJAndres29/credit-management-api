import nodemailer, { Transporter } from 'nodemailer';
import { envs } from '../../config/envs';
import { EmailAttachment, EmailService, SendEmailOptions } from '../../domain/services/email.service';
import { globalLogger } from './pino-logger.service';

/**
 * Adapter de Nodemailer para envío de emails.
 *
 * Valida las credenciales al construirse. Si alguna env var falta,
 * el servicio se deshabilita con un warning — igual que CloudinaryAdapter.
 * El servidor arranca normalmente; solo se omiten los emails.
 *
 * Configuración para Gmail:
 *   MAILER_EMAIL      = tucuenta@gmail.com
 *   MAILER_SECRET_KEY = App Password de 16 caracteres (no la contraseña de Gmail)
 *   MAILER_SERVICE    = gmail  (valor por defecto)
 *
 * Para usar otro proveedor (Outlook, Sendgrid, etc.) cambiar MAILER_SERVICE.
 */
export class NodemailerEmailService implements EmailService {
  private readonly transporter: Transporter | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor() {
    const { email, secretKey, service } = envs.mailer;

    if (!email || !secretKey) {
      globalLogger.warn('MAILER_EMAIL o MAILER_SECRET_KEY no configurados - notificaciones por email deshabilitadas');
      this.enabled = false;
      this.from = '';
      return;
    }

    // Configuración SMTP explícita para forzar IPv4 (Railway no soporta IPv6).
    // Gmail usa host directo con family:4; otros servicios usan el shorthand `service`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transportOptions: any =
      service === 'gmail'
        ? { host: 'smtp.gmail.com', port: 465, secure: true, family: 4, auth: { user: email, pass: secretKey } }
        : { service, auth: { user: email, pass: secretKey } };

    this.transporter = nodemailer.createTransport(transportOptions);

    this.from = email;
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.enabled || !this.transporter) return false;

    try {
      const attachments = options.attachments?.map((att: EmailAttachment) => ({
        filename: att.filename,
        ...(att.content ? { content: att.content, contentType: att.contentType } : { path: att.path }),
      }));

      await this.transporter.sendMail({
        from: this.from,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.htmlBody,
        attachments,
      });
      return true;
    } catch (error) {
      globalLogger.error('[NodemailerEmailService] Error al enviar email', error);
      return false;
    }
  }
}
