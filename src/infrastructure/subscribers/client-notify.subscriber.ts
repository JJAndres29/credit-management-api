import { EventEmitterPort, CLIENT_NOTIFY_REQUESTED, ClientNotifyRequestedData } from '../../domain/events';
import { EmailService } from '../../domain/services/email.service';
import { LoggerService } from '../../domain/services/logger.service';
import { ClientRepository } from '../../domain/repositories';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';
import { prisma } from '../../config/prisma';

/**
 * Escucha el evento ClientNotifyRequested y envía el estado de cuenta por email.
 *
 * Flujo:
 *   1. El use case NotifyClientUseCase emite el evento.
 *   2. Este subscriber lo recibe de forma asíncrona.
 *   3. Busca los datos del cliente.
 *   4. Genera el PDF del estado de cuenta.
 *   5. Envía el email con el PDF adjunto.
 *   6. Registra el intento en NotificationLog.
 *   7. Todos los errores se capturan — nunca afectan la respuesta HTTP.
 */
export class ClientNotifySubscriber {
  constructor(
    private readonly eventEmitter: EventEmitterPort,
    private readonly clientRepository: ClientRepository,
    private readonly emailService: EmailService | null,
    private readonly accountStatementUseCase?: GenerateAccountStatementUseCase,
    private readonly logger?: LoggerService,
  ) {
    this.eventEmitter.on(CLIENT_NOTIFY_REQUESTED, this.handle);
  }

  private handle = async (data: unknown): Promise<void> => {
    try {
      const { clientId, requestedBy } = data as ClientNotifyRequestedData;

      const client = await this.clientRepository.findById(clientId);
      if (!client) return;

      if (!this.emailService || !client.email) return;

      let pdfBuffer: Buffer | undefined;
      if (this.accountStatementUseCase) {
        try {
          pdfBuffer = await this.accountStatementUseCase.execute(clientId, requestedBy);
        } catch (pdfError) {
          this.logger?.warn('[ClientNotifySubscriber] No se pudo generar el PDF adjunto');
        }
      }

      const formattedBalance = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(Number(client.balance));

      const date = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #2d6a4f;">Estado de Cuenta</h2>
          <p>Hola <strong>${client.name}</strong>,</p>
          <p>A continuación encontrará su estado de cuenta actual:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f4f4f4;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Saldo pendiente</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${formattedBalance}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Fecha de consulta</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
            </tr>
          </table>
          ${pdfBuffer ? '<p>Se adjunta su estado de cuenta completo en formato PDF.</p>' : ''}
          <p style="color: #666; font-size: 12px;">Si tiene alguna duda, comuníquese con nosotros.</p>
        </div>
      `;

      let status = 'SENT';
      let errorMessage: string | undefined;

      try {
        const ok = await this.emailService.sendEmail({
          to: client.email,
          subject: 'Estado de cuenta — consulta de saldo',
          htmlBody: emailHtml,
          attachments: pdfBuffer
            ? [
                {
                  filename: `estado-cuenta-${clientId.slice(0, 8)}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                },
              ]
            : undefined,
        });

        if (!ok) {
          status = 'FAILED';
          errorMessage = 'El servicio de email retornó false';
        }
      } catch (err) {
        status = 'FAILED';
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      await prisma.notificationLog.create({
        data: {
          clientId,
          channel: 'EMAIL',
          event: 'CLIENT_NOTIFY_REQUESTED',
          status,
          errorMessage,
        },
      });

      if (status === 'SENT') {
        this.logger?.info(`[Notification] EMAIL CLIENT_NOTIFY_REQUESTED → cliente ${clientId} ✓`);
      } else {
        this.logger?.warn(
          `[Notification] EMAIL CLIENT_NOTIFY_REQUESTED → cliente ${clientId} ✗ — ${errorMessage}`,
        );
      }
    } catch (error) {
      console.error('[ClientNotifySubscriber] Error inesperado:', error);
    }
  };
}
