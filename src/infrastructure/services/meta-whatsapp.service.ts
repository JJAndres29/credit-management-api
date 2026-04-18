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
  private readonly enabled: boolean;
  private readonly apiUrl: string;

  private readonly mediaUrl: string;

  constructor() {
    const { token, phoneNumberId } = envs.meta;

    if (!token || !phoneNumberId) {
      console.warn(
        '⚠️  META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_NUMBER_ID no configurados — ' +
          'notificaciones por WhatsApp deshabilitadas.',
      );
      this.enabled = false;
      this.token = '';
      this.apiUrl = '';
      this.mediaUrl = '';
      return;
    }

    this.token = token;
    this.apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    this.mediaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/media`;
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async sendTemplate(to: string, templateName: string, variables: string[], languageCode = 'es_CO'): Promise<boolean> {
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
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [
              {
                type: 'body',
                parameters: variables.map((v) => ({ type: 'text', text: v })),
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[MetaWhatsAppService] Error de plantilla:', response.status, errorBody);
        return false;
      }

      console.log('[MetaWhatsAppService] Plantilla enviada a:', this.formatPhone(to));
      return true;
    } catch (error) {
      console.error('[MetaWhatsAppService] Error al enviar plantilla:', error);
      return false;
    }
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
   * Sube un archivo binario (Buffer) al endpoint /media de Meta y retorna el media_id.
   *
   * Seguridad:
   * - El archivo nunca se expone por URL pública. Solo tu número de Meta puede
   *   referenciar este media_id en mensajes salientes.
   * - El mimetype se fuerza a 'application/pdf' en el FormData para evitar
   *   inferencias incorrectas por parte de Meta.
   *
   * Retry: hasta 2 intentos (1 inicial + 1 reintento) ante fallos de red/5xx.
   * No reintenta ante 4xx (error del cliente — token inválido, formato mal).
   */
  private async uploadMedia(buffer: Buffer, filename: string, _mimeType: string): Promise<string> {
    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', 'application/pdf');
        form.append(
          'file',
          new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
          filename,
        );

        const response = await fetch(this.mediaUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` },
          body: form,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`Meta /media 4xx (no-retry): ${response.status} ${errorBody}`);
          }
          throw new Error(`Meta /media ${response.status}: ${errorBody}`);
        }

        const json = (await response.json()) as { id?: string };
        if (!json.id) throw new Error('Meta /media respondió sin campo id');
        return json.id;
      } catch (error) {
        lastError = error;
        const is4xx = error instanceof Error && error.message.includes('4xx (no-retry)');
        if (is4xx || attempt === maxAttempts) break;
        console.warn(`[MetaWhatsAppService] uploadMedia intento ${attempt} falló, reintentando…`);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('uploadMedia falló');
  }

  async sendDocument(
    to: string,
    document: Buffer,
    filename: string,
    caption?: string,
    mimeType = 'application/pdf',
  ): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const mediaId = await this.uploadMedia(document, filename, mimeType);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: this.formatPhone(to),
          type: 'document',
          document: {
            id: mediaId,
            filename,
            ...(caption ? { caption } : {}),
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[MetaWhatsAppService] Error al enviar documento:', response.status, errorBody);
        return false;
      }

      console.log('[MetaWhatsAppService] Documento enviado a:', this.formatPhone(to));
      return true;
    } catch (error) {
      console.error('[MetaWhatsAppService] Error en sendDocument:', error);
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
