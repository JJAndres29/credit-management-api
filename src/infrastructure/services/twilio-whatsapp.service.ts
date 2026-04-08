import { envs } from '../../config/envs';
import { NotificationService } from '../../domain/services/notification.service';

/**
 * Adapter de Twilio para envío de mensajes de WhatsApp.
 *
 * Valida las credenciales al construirse. Si alguna env var falta,
 * el servicio se deshabilita con un warning — igual que CloudinaryAdapter.
 * El servidor arranca normalmente; solo se omiten las notificaciones.
 *
 * Seguridad:
 * - Credenciales solo desde envs (nunca hardcodeadas ni en logs).
 * - Los mensajes de WhatsApp NO exponen saldos ni deudas exactas —
 *   solo confirman que hubo un movimiento y dirigen al correo para detalles.
 */
export class TwilioWhatsAppService implements NotificationService {
  private readonly client: import('twilio').Twilio | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor() {
    const { accountSid, authToken, whatsappFrom } = envs.twilio;

    if (!accountSid || !authToken || !whatsappFrom) {
      console.warn(
        '⚠️  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_WHATSAPP_FROM no configurados — ' +
          'notificaciones por WhatsApp deshabilitadas.',
      );
      this.enabled = false;
      this.from = '';
      return;
    }

    // Import dinámico para evitar error al arrancar si las vars no están
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    this.client = twilio(accountSid, authToken) as import('twilio').Twilio;
    this.from = whatsappFrom;
    this.enabled = true;
  }

  async sendWhatsApp(to: string, message: string): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      await this.client.messages.create({
        from: this.from,
        to: this.formatPhone(to),
        body: message,
      });
      return true;
    } catch (error) {
      console.error('[TwilioWhatsAppService] Error al enviar mensaje:', error);
      return false;
    }
  }

  /**
   * Normaliza el número al formato requerido por Twilio: whatsapp:+[número]
   *
   * Asume que los teléfonos en DB están en formato colombiano (10 dígitos, sin +57).
   * Si ya incluyen código de país (+) o prefijo 'whatsapp:', los respeta.
   */
  private formatPhone(phone: string): string {
    if (phone.startsWith('whatsapp:')) return phone;
    if (phone.startsWith('+')) return `whatsapp:${phone}`;
    return `whatsapp:+57${phone}`;
  }
}
