import { envs } from '../../config/envs';
import { NotificationService } from '../../domain/services/notification.service';

/**
 * Adapter de Meta Cloud API para envío de mensajes de WhatsApp.
 *
 * Valida las credenciales al construirse. Si alguna env var falta,
 * el servicio se deshabilita con un warning — igual que CloudinaryAdapter.
 * El servidor arranca normalmente; solo se omiten las notificaciones.
 *
 * Configuración requerida:
 *   META_WHATSAPP_TOKEN           = Token permanente del sistema (System User Token)
 *   META_WHATSAPP_PHONE_NUMBER_ID = ID del número (no el número en sí — lo encuentras
 *                                   en Meta Business > WhatsApp > Configuración de API)
 *
 * A diferencia del Sandbox de Twilio, cualquier destinatario puede recibir mensajes
 * sin haber enviado nada previamente (número aprobado por Meta requerido).
 *
 * Seguridad:
 * - Credenciales solo desde envs (nunca hardcodeadas ni en logs).
 * - Los mensajes de WhatsApp NO exponen saldos ni deudas exactas —
 *   solo confirman que hubo un movimiento y dirigen al correo para detalles.
 */
export class MetaWhatsAppService implements NotificationService {
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly enabled: boolean;
  private readonly apiUrl: string;

  constructor() {
    const { token, phoneNumberId } = envs.meta;

    if (!token || !phoneNumberId) {
      console.warn(
        '⚠️  META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_NUMBER_ID no configurados — ' +
          'notificaciones por WhatsApp deshabilitadas.',
      );
      this.enabled = false;
      this.token = '';
      this.phoneNumberId = '';
      this.apiUrl = '';
      return;
    }

    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async sendWhatsApp(to: string, message: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: this.formatPhone(to),
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[MetaWhatsAppService] Error de API:', response.status, errorBody);
        return false;
      }

      console.log('[MetaWhatsAppService] Mensaje enviado a:', this.formatPhone(to));
      return true;
    } catch (error) {
      console.error('[MetaWhatsAppService] Error al enviar mensaje:', error);
      return false;
    }
  }

  /**
   * Normaliza el número al formato E.164 requerido por Meta Cloud API.
   *
   * Asume que los teléfonos en DB están en formato colombiano (10 dígitos, sin +57).
   * Si ya incluyen código de país (+), los respeta.
   */
  private formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (phone.startsWith('+')) return cleaned;
    // Número colombiano de 10 dígitos → agregar código de país 57
    if (cleaned.length === 10) return `57${cleaned}`;
    return cleaned;
  }
}
