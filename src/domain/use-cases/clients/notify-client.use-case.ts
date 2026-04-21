import { CustomError } from '../../errors';
import { ClientRepository } from '../../repositories';
import { EventEmitterPort, CLIENT_NOTIFY_REQUESTED } from '../../events';

export interface NotifyClientResult {
  whatsappPayload: { phone: string; message: string } | null;
}

export class NotifyClientUseCase {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  async execute(clientId: string, requestedBy: string): Promise<NotifyClientResult> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);
    if (!client.isActive) throw CustomError.badRequest('El cliente no está activo');

    // Emitir evento para que el subscriber envíe email con PDF adjunto de forma asíncrona.
    // La respuesta HTTP no espera ni depende de este envío.
    this.eventEmitter?.emit(CLIENT_NOTIFY_REQUESTED, {
      clientId,
      requestedBy,
    });

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    let whatsappPayload: { phone: string; message: string } | null = null;

    if (client.phone) {
      const balance = Number(client.balance);
      const creditLimit = Number(client.creditLimit);
      const available = creditLimit - balance;

      whatsappPayload = {
        phone: client.phone,
        message:
          `***\nESTADO DE CUENTA\n***\n\n` +
          `Sr(a) ${client.name}, a continuación su estado de cuenta actual:\n\n` +
          `Saldo pendiente: $${fmt(balance)}.\n\n` +
          `Cupo disponible: $${fmt(available > 0 ? available : 0)}.\n\n` +
          `Para más detalles, consulte el estado de cuenta adjunto en su correo.`,
      };
    }

    return { whatsappPayload };
  }
}
