import { EventEmitterPort, CREDIT_SALE_CREATED, CreditSaleCreatedData } from '../../domain/events';
import { NotificationService } from '../../domain/services/notification.service';
import { EmailService } from '../../domain/services/email.service';
import { LoggerService } from '../../domain/services/logger.service';
import { ClientRepository } from '../../domain/repositories';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';
import { prisma } from '../../config/prisma';

/**
 * Escucha el evento CreditSaleCreated y orquesta las notificaciones.
 *
 * Solo se emite para ventas CREDIT — las ventas CASH se pagan al contado
 * y no generan deuda, por lo que no requieren notificación de saldo.
 *
 * Misma lógica de throttle, sendAndLog y seguridad que PaymentNotificationSubscriber.
 */
export class SaleNotificationSubscriber {
  constructor(
    private readonly eventEmitter: EventEmitterPort,
    private readonly clientRepository: ClientRepository,
    private readonly whatsAppService: NotificationService | null,
    private readonly emailService: EmailService | null,
    /**
     * Opcional: si se inyecta, el estado de cuenta en PDF se adjunta al email
     * y se envía también como documento por WhatsApp mediante plantilla.
     * Si no se inyecta, el email se envía sin adjunto y no se manda PDF por WhatsApp.
     */
    private readonly accountStatementUseCase?: GenerateAccountStatementUseCase,
    private readonly logger?: LoggerService,
  ) {
    this.eventEmitter.on(CREDIT_SALE_CREATED, this.handle);
  }

  private handle = async (data: unknown): Promise<void> => {
    try {
      const { saleId, clientId, total, newBalance } = data as CreditSaleCreatedData;

      const client = await this.clientRepository.findById(clientId);
      if (!client) return;

      const formattedTotal = this.formatCurrency(total);
      const formattedBalance = this.formatCurrency(newBalance);
      const date = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });


      // Email — detalle completo
      const emailHtml = this.buildSaleEmailHtml({
        clientName: client.name,
        total: formattedTotal,
        newBalance: formattedBalance,
        date,
        saleId,
      });

      // Generar PDF del estado de cuenta si el use case está disponible.
      // Si falla, se continúa sin adjunto — la notificación no se cancela.
      let pdfBuffer: Buffer | undefined;
      if (this.accountStatementUseCase) {
        try {
          pdfBuffer = await this.accountStatementUseCase.execute(clientId, 'Sistema');
        } catch (pdfError) {
          console.warn('[SaleNotificationSubscriber] No se pudo generar el PDF adjunto:', pdfError);
        }
      }

      const tasks: Promise<void>[] = [];

      if (this.whatsAppService && client.phone) {
        tasks.push(
          this.sendAndLog({
            clientId,
            channel: 'WHATSAPP',
            event: 'CREDIT_SALE_CREATED',
            send: () =>
              this.whatsAppService!.sendTemplate(client.phone, 'compra_credito', [
                client.name,
                formattedTotal,
                formattedBalance,
              ]),
          }),
        );
      }

      if (this.emailService && client.email) {
        tasks.push(
          this.sendAndLog({
            clientId,
            channel: 'EMAIL',
            event: 'CREDIT_SALE_CREATED',
            send: () =>
              this.emailService!.sendEmail({
                to: client.email!,
                subject: `Compra a crédito registrada — ${formattedTotal}`,
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
              }),
          }),
        );
      }

      // WhatsApp con PDF adjunto — se envía en paralelo con el email.
      // Usa el mismo Buffer generado para el email (no se regenera).
      // Enviado mediante plantilla aprobada (`credito_estado_cuenta`) para que
      // funcione fuera de la ventana de 24h de Meta — las notificaciones
      // iniciadas por el negocio no tienen garantía de ventana abierta.
      // Si falla, se registra con el logger y en NotificationLog; el email sigue su curso.
      if (this.whatsAppService && client.phone && pdfBuffer) {
        const pdfFilename = `estado-cuenta-${clientId.slice(0, 8)}.pdf`;
        tasks.push(
          this.sendAndLog({
            clientId,
            channel: 'WHATSAPP_DOCUMENT',
            event: 'CREDIT_SALE_CREATED',
            send: async () => {
              try {
                return await this.whatsAppService!.sendDocumentTemplate(
                  client.phone,
                  'credito_estado_cuenta',
                  pdfBuffer!,
                  pdfFilename,
                  [client.name, formattedTotal, date],
                  'es_CO',
                );
              } catch (err) {
                this.logger?.error(
                  'Fallo al enviar estado de cuenta por WhatsApp',
                  err,
                  { clientId, saleId, channel: 'WHATSAPP_DOCUMENT' },
                );
                return false;
              }
            },
          }),
        );
      }

      await Promise.allSettled(tasks);
    } catch (error) {
      console.error('[SaleNotificationSubscriber] Error inesperado:', error);
    }
  };

  private async sendAndLog(params: {
    clientId: string;
    channel: string;
    event: string;
    send: () => Promise<boolean>;
  }): Promise<void> {
    let status = 'SENT';
    let errorMessage: string | undefined;

    try {
      const ok = await params.send();
      if (!ok) {
        status = 'FAILED';
        errorMessage = 'El servicio retornó false sin lanzar excepción';
      }
    } catch (err) {
      status = 'FAILED';
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await prisma.notificationLog.create({
      data: {
        clientId: params.clientId,
        channel: params.channel,
        event: params.event,
        status,
        errorMessage,
      },
    });

    if (status === 'SENT') {
      console.log(
        `[Notification] ${params.channel} CREDIT_SALE_CREATED → cliente ${params.clientId} ✓`,
      );
    } else {
      console.warn(
        `[Notification] ${params.channel} CREDIT_SALE_CREATED → cliente ${params.clientId} ✗ — ${errorMessage}`,
      );
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
      amount,
    );
  }

  private buildSaleEmailHtml(params: {
    clientName: string;
    total: string;
    newBalance: string;
    date: string;
    saleId: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1d4e89;">Compra a crédito registrada</h2>
        <p>Hola <strong>${params.clientName}</strong>,</p>
        <p>Se ha registrado la siguiente compra a crédito en su cuenta:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f4f4f4;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total de la compra</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${params.total}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Saldo actual</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${params.newBalance}</td>
          </tr>
          <tr style="background: #f4f4f4;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Fecha</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${params.date}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px;">Referencia de venta: ${params.saleId}</p>
        <p style="color: #666; font-size: 12px;">
          Si tiene alguna duda, comuníquese con nosotros.
        </p>
      </div>
    `;
  }
}
