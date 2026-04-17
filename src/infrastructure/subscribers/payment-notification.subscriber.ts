import { EventEmitterPort, PAYMENT_REGISTERED, PaymentRegisteredData } from '../../domain/events';
import { NotificationService } from '../../domain/services/notification.service';
import { EmailService } from '../../domain/services/email.service';
import { ClientRepository } from '../../domain/repositories';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';
import { prisma } from '../../config/prisma';

/**
 * Throttle en memoria: evita enviar más de MAX_PER_HOUR notificaciones
 * al mismo cliente en una hora. Protege contra loops de errores que
 * podrían generar cientos de mensajes de WhatsApp (cada uno tiene costo).
 */
class NotificationThrottle {
  private readonly log = new Map<string, number[]>();

  canSend(clientId: string, maxPerHour = 3): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recent = (this.log.get(clientId) ?? []).filter((t) => t > oneHourAgo);
    if (recent.length >= maxPerHour) return false;
    recent.push(now);
    this.log.set(clientId, recent);
    return true;
  }
}

const throttle = new NotificationThrottle();

/**
 * Escucha el evento PaymentRegistered y orquesta las notificaciones.
 *
 * Flujo:
 *   1. El use case emite el evento DESPUÉS de que la transacción se commitea.
 *   2. Este subscriber lo recibe de forma asíncrona.
 *   3. Verifica throttle (máx 3/hora por cliente).
 *   4. Busca los datos del cliente en DB.
 *   5. Envía WhatsApp + Email en paralelo (Promise.allSettled).
 *   6. Persiste cada intento en NotificationLog.
 *   7. Todos los errores se capturan — nunca afectan la respuesta HTTP.
 *
 * Seguridad:
 *   - WhatsApp no incluye saldo ni deuda — solo confirma el movimiento.
 *   - El email incluye detalles completos (el cliente lo ve en privado).
 */
export class PaymentNotificationSubscriber {
  constructor(
    private readonly eventEmitter: EventEmitterPort,
    private readonly clientRepository: ClientRepository,
    private readonly whatsAppService: NotificationService | null,
    private readonly emailService: EmailService | null,
    /**
     * Opcional: si se inyecta, el estado de cuenta en PDF se adjunta al email.
     * Si no se inyecta, el email se envía sin adjunto (comportamiento anterior).
     */
    private readonly accountStatementUseCase?: GenerateAccountStatementUseCase,
  ) {
    this.eventEmitter.on(PAYMENT_REGISTERED, this.handle);
  }

  private handle = async (data: unknown): Promise<void> => {
    try {
      const { paymentId, clientId, amount, newBalance, note, saleInstallmentsCount, saleInstallmentAmount, saleTotalPaidAfter } = data as PaymentRegisteredData;

      if (!throttle.canSend(clientId)) {
        console.warn(
          `[PaymentNotificationSubscriber] Throttle activado para cliente ${clientId} — notificación omitida`,
        );
        return;
      }

      const client = await this.clientRepository.findById(clientId);
      if (!client) return;

      const formattedAmount = this.formatCurrency(amount);
      const formattedBalance = this.formatCurrency(newBalance);
      const date = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

      let installmentInfo = '';
      if (saleInstallmentsCount && saleInstallmentAmount && saleTotalPaidAfter !== undefined) {
        const paidInstallments = Math.min(
          Math.floor(saleTotalPaidAfter / saleInstallmentAmount),
          saleInstallmentsCount,
        );
        const remainingInstallments = saleInstallmentsCount - paidInstallments;
        installmentInfo =
          remainingInstallments > 0
            ? `\nCuotas pagadas: ${paidInstallments} de ${saleInstallmentsCount}. Le quedan *${remainingInstallments} cuota(s)* por pagar.`
            : `\n¡Felicitaciones! Ha completado el pago de todas sus cuotas (${saleInstallmentsCount}/${saleInstallmentsCount}).`;
      }

      const whatsAppMsg =
        `Hola ${client.name}, hemos recibido su abono de *${formattedAmount}*.\n` +
        `Saldo pendiente: *${formattedBalance}*.` +
        installmentInfo +
        `\nPara ver el detalle completo de su cuenta, revise el correo electrónico registrado.`;

      // Email — detalle completo
      const emailHtml = this.buildPaymentEmailHtml({
        clientName: client.name,
        amount: formattedAmount,
        newBalance: formattedBalance,
        note: note ?? undefined,
        date,
        paymentId,
      });

      // Generar PDF del estado de cuenta si el use case está disponible.
      // Si falla, se continúa sin adjunto — la notificación no se cancela.
      let pdfBuffer: Buffer | undefined;
      if (this.accountStatementUseCase) {
        try {
          pdfBuffer = await this.accountStatementUseCase.execute(clientId, 'Sistema');
        } catch (pdfError) {
          console.warn('[PaymentNotificationSubscriber] No se pudo generar el PDF adjunto:', pdfError);
        }
      }

      const tasks: Promise<void>[] = [];

      if (this.whatsAppService && client.phone) {
        tasks.push(
          this.sendAndLog({
            clientId,
            channel: 'WHATSAPP',
            event: 'PAYMENT_REGISTERED',
            send: () => this.whatsAppService!.sendWhatsApp(client.phone, whatsAppMsg),
          }),
        );
      }

      if (this.emailService && client.email) {
        tasks.push(
          this.sendAndLog({
            clientId,
            channel: 'EMAIL',
            event: 'PAYMENT_REGISTERED',
            send: () =>
              this.emailService!.sendEmail({
                to: client.email!,
                subject: `Abono recibido — ${formattedAmount}`,
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

      await Promise.allSettled(tasks);
    } catch (error) {
      // Los errores de notificación nunca deben afectar la transacción financiera
      console.error('[PaymentNotificationSubscriber] Error inesperado:', error);
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
        `[Notification] ${params.channel} PAYMENT_REGISTERED → cliente ${params.clientId} ✓`,
      );
    } else {
      console.warn(
        `[Notification] ${params.channel} PAYMENT_REGISTERED → cliente ${params.clientId} ✗ — ${errorMessage}`,
      );
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
      amount,
    );
  }

  private buildPaymentEmailHtml(params: {
    clientName: string;
    amount: string;
    newBalance: string;
    note?: string;
    date: string;
    paymentId: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2d6a4f;">Abono registrado en su cuenta</h2>
        <p>Hola <strong>${params.clientName}</strong>,</p>
        <p>Se ha registrado el siguiente abono en su cuenta:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f4f4f4;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Monto del abono</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${params.amount}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Saldo actual</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${params.newBalance}</td>
          </tr>
          ${
            params.note
              ? `<tr style="background: #f4f4f4;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Nota</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${params.note}</td>
                </tr>`
              : ''
          }
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Fecha</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${params.date}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px;">Referencia: ${params.paymentId}</p>
        <p style="color: #666; font-size: 12px;">
          Si tiene alguna duda, comuníquese con nosotros.
        </p>
      </div>
    `;
  }
}
