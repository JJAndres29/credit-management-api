/**
 * Tests — Bloque 1d: Notification Subscribers
 *
 * Cubre: PaymentNotificationSubscriber y SaleNotificationSubscriber.
 * La dependencia de `prisma` se mockea a nivel de módulo para evitar
 * conexiones reales a la base de datos.
 *
 * IMPORTANTE sobre el throttle:
 *   El throttle es un singleton a nivel de módulo, por lo que persiste entre
 *   tests. Cada test usa un clientId único para evitar contaminación de estado.
 *   El test de "4ª notificación bloqueada" usa un clientId exclusivo y realiza
 *   4 invocaciones consecutivas dentro del mismo `it`.
 */

// ─── Mock de Prisma (debe ir antes de cualquier import que use prisma) ─────────

jest.mock('../../config/prisma', () => ({
  prisma: {
    notificationLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

import { prisma } from '../../config/prisma';
import { PaymentNotificationSubscriber } from './payment-notification.subscriber';
import { SaleNotificationSubscriber } from './sale-notification.subscriber';
import { EventEmitterPort, PAYMENT_REGISTERED, CREDIT_SALE_CREATED } from '../../domain/events';
import { ClientRepository } from '../../domain/repositories';
import { NotificationService } from '../../domain/services/notification.service';
import { EmailService } from '../../domain/services/email.service';
import { ClientEntity } from '../../domain/entities/client.entity';
import { GenerateAccountStatementUseCase } from '../../domain/use-cases/reports';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(clientId: string, overrides: Partial<{
  phone: string;
  email: string | null;
}> = {}): ClientEntity {
  return new ClientEntity(
    clientId,
    'María López',
    overrides.phone ?? '555-0001',
    overrides.email !== undefined ? overrides.email : 'maria@example.com',
    'CC',
    '12345678',
    'Calle 1 # 2-3',
    'Centro',
    5_000,
    100,
    true,
    new Date(),
    new Date(),
  );
}

function makePaymentData(clientId: string) {
  return {
    paymentId: `pay-${clientId}`,
    clientId,
    amount: 100,
    newBalance: 200,
    note: null,
  };
}

function makeSaleData(clientId: string) {
  return {
    saleId: `sale-${clientId}`,
    clientId,
    total: 300,
    newBalance: 300,
  };
}

// ─── Mocks base ────────────────────────────────────────────────────────────────

function makeMocks() {
  let capturedPaymentHandler: ((data: unknown) => Promise<void>) | undefined;
  let capturedSaleHandler: ((data: unknown) => Promise<void>) | undefined;

  const mockEventEmitter: jest.Mocked<EventEmitterPort> = {
    on: jest.fn().mockImplementation((event: string, handler: (data: unknown) => void) => {
      if (event === PAYMENT_REGISTERED) capturedPaymentHandler = handler as (data: unknown) => Promise<void>;
      if (event === CREDIT_SALE_CREATED) capturedSaleHandler = handler as (data: unknown) => Promise<void>;
    }),
    emit: jest.fn(),
  };

  const mockClientRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findAll: jest.fn(),
  } as jest.Mocked<ClientRepository>;

  const mockWhatsApp: jest.Mocked<NotificationService> = {
    sendWhatsApp: jest.fn().mockResolvedValue(true),
    sendTemplate: jest.fn().mockResolvedValue(true),
  };

  const mockEmail: jest.Mocked<EmailService> = {
    sendEmail: jest.fn().mockResolvedValue(true),
  };

  const mockPrismaCreate = prisma.notificationLog.create as jest.Mock;

  return {
    mockEventEmitter,
    mockClientRepo,
    mockWhatsApp,
    mockEmail,
    mockPrismaCreate,
    getPaymentHandler: () => capturedPaymentHandler!,
    getSaleHandler: () => capturedSaleHandler!,
  };
}

// ─── PaymentNotificationSubscriber ────────────────────────────────────────────

describe('PaymentNotificationSubscriber', () => {
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = makeMocks();
  });

  function buildSubscriber(accountStatementUseCase?: GenerateAccountStatementUseCase) {
    return new PaymentNotificationSubscriber(
      mocks.mockEventEmitter,
      mocks.mockClientRepo,
      mocks.mockWhatsApp,
      mocks.mockEmail,
      accountStatementUseCase,
    );
  }

  describe('registro del handler', () => {
    it('se suscribe al evento PAYMENT_REGISTERED al construirse', () => {
      buildSubscriber();
      expect(mocks.mockEventEmitter.on).toHaveBeenCalledWith(PAYMENT_REGISTERED, expect.any(Function));
    });
  });

  describe('flujo feliz: cliente con teléfono y email', () => {
    const clientId = 'pay-happy-client';

    beforeEach(() => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
    });

    it('envía WhatsApp cuando el cliente tiene teléfono', async () => {
      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockWhatsApp.sendTemplate).toHaveBeenCalledWith(
        '555-0001',
        'abono_recibido',
        expect.arrayContaining(['María López']),
        'es',
      );
    });

    it('envía Email cuando el cliente tiene email', async () => {
      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'maria@example.com' }),
      );
    });

    it('persiste NotificationLog con status SENT para cada canal', async () => {
      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      const calls = mocks.mockPrismaCreate.mock.calls;
      const statuses = calls.map((c: { data: { status: string } }[]) => c[0].data.status);
      expect(statuses).toEqual(['SENT', 'SENT']);
    });
  });

  describe('resiliencia: fallo de WhatsApp', () => {
    const clientId = 'pay-whatsapp-fail';

    it('envía Email aunque WhatsApp falle (Promise.allSettled)', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockWhatsApp.sendTemplate.mockRejectedValue(new Error('Twilio timeout'));

      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockEmail.sendEmail).toHaveBeenCalled();
    });

    it('persiste WhatsApp como FAILED y Email como SENT', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockWhatsApp.sendTemplate.mockRejectedValue(new Error('Twilio timeout'));

      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      const calls = mocks.mockPrismaCreate.mock.calls;
      const logMap = Object.fromEntries(
        calls.map((c: [{ data: { channel: string; status: string } }]) => [c[0].data.channel, c[0].data.status]),
      );
      expect(logMap['WHATSAPP']).toBe('FAILED');
      expect(logMap['EMAIL']).toBe('SENT');
    });
  });

  describe('resiliencia: fallo de Email', () => {
    const clientId = 'pay-email-fail';

    it('envía WhatsApp aunque Email falle', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockEmail.sendEmail.mockRejectedValue(new Error('Gmail auth error'));

      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockWhatsApp.sendTemplate).toHaveBeenCalled();
    });

    it('persiste Email como FAILED con mensaje de error', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockEmail.sendEmail.mockRejectedValue(new Error('Gmail auth error'));

      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      const emailLog = mocks.mockPrismaCreate.mock.calls.find(
        (c: [{ data: { channel: string } }]) => c[0].data.channel === 'EMAIL',
      );
      expect(emailLog[0].data.status).toBe('FAILED');
      expect(emailLog[0].data.errorMessage).toContain('Gmail auth error');
    });
  });

  describe('resiliencia: fallo de generación de PDF', () => {
    const clientId = 'pay-pdf-fail';

    it('envía Email sin adjunto cuando el PDF falla', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));

      const mockAccountStatement = {
        execute: jest.fn().mockRejectedValue(new Error('PDFKit error')),
      } as unknown as GenerateAccountStatementUseCase;

      buildSubscriber(mockAccountStatement);
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: undefined,
        }),
      );
    });
  });

  describe('PDF adjunto al email', () => {
    const clientId = 'pay-pdf-ok';

    it('adjunta el PDF al email cuando el use case lo genera correctamente', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      const fakeBuffer = Buffer.from('fake-pdf');

      const mockAccountStatement = {
        execute: jest.fn().mockResolvedValue(fakeBuffer),
      } as unknown as GenerateAccountStatementUseCase;

      buildSubscriber(mockAccountStatement);
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ content: fakeBuffer }),
          ]),
        }),
      );
    });
  });

  describe('throttle: máx 3 notificaciones por cliente por hora', () => {
    // clientId exclusivo de este test para que el throttle no se contamine
    const clientId = 'pay-throttle-exclusive-client-001';

    it('bloquea la 4ª notificación al mismo cliente en la misma hora', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));

      buildSubscriber();
      const handler = mocks.getPaymentHandler();
      const data = makePaymentData(clientId);

      // Invocaciones 1, 2, 3 — dentro del límite
      await handler(data);
      await handler(data);
      await handler(data);

      // Limpiar para verificar que la 4ª NO dispara los servicios de notificación
      jest.clearAllMocks();

      // Invocación 4 — debe ser bloqueada por el throttle
      await handler(data);

      expect(mocks.mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
      expect(mocks.mockEmail.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('cliente sin teléfono', () => {
    const clientId = 'pay-no-phone';

    it('no intenta enviar WhatsApp si el cliente no tiene teléfono', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(
        new ClientEntity(clientId, 'Sin Tel', '', 'sin@tel.com', 'CC', '12345678', 'Calle 1 # 2-3', 'Centro', 1000, 0, true, new Date(), new Date()),
      );

      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
      expect(mocks.mockEmail.sendEmail).toHaveBeenCalled();
    });
  });

  describe('cliente sin email', () => {
    const clientId = 'pay-no-email';

    it('no intenta enviar Email si el cliente no tiene email', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId, { email: null }));

      buildSubscriber();
      await mocks.getPaymentHandler()(makePaymentData(clientId));

      expect(mocks.mockEmail.sendEmail).not.toHaveBeenCalled();
      expect(mocks.mockWhatsApp.sendTemplate).toHaveBeenCalled();
    });
  });

  describe('cliente no encontrado en DB', () => {
    it('retorna sin lanzar error y sin enviar notificaciones', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(null);

      buildSubscriber();
      await expect(
        mocks.getPaymentHandler()(makePaymentData('pay-ghost-client')),
      ).resolves.toBeUndefined();

      expect(mocks.mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
      expect(mocks.mockEmail.sendEmail).not.toHaveBeenCalled();
    });
  });
});

// ─── SaleNotificationSubscriber ───────────────────────────────────────────────

describe('SaleNotificationSubscriber', () => {
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = makeMocks();
  });

  function buildSubscriber() {
    return new SaleNotificationSubscriber(
      mocks.mockEventEmitter,
      mocks.mockClientRepo,
      mocks.mockWhatsApp,
      mocks.mockEmail,
    );
  }

  describe('registro del handler', () => {
    it('se suscribe al evento CREDIT_SALE_CREATED al construirse', () => {
      buildSubscriber();
      expect(mocks.mockEventEmitter.on).toHaveBeenCalledWith(CREDIT_SALE_CREATED, expect.any(Function));
    });
  });

  describe('flujo feliz: cliente con teléfono y email', () => {
    const clientId = 'sale-happy-client';

    beforeEach(() => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
    });

    it('envía WhatsApp con el nombre del cliente', async () => {
      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      expect(mocks.mockWhatsApp.sendTemplate).toHaveBeenCalledWith(
        '555-0001',
        'compra_credito',
        expect.arrayContaining(['María López']),
      );
    });

    it('envía Email al correo del cliente', async () => {
      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      expect(mocks.mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'maria@example.com' }),
      );
    });

    it('persiste NotificationLog con status SENT para ambos canales', async () => {
      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      const calls = mocks.mockPrismaCreate.mock.calls;
      const statuses = calls.map((c: [{ data: { status: string } }]) => c[0].data.status);
      expect(statuses).toEqual(['SENT', 'SENT']);
    });
  });

  describe('resiliencia: fallo de WhatsApp', () => {
    const clientId = 'sale-whatsapp-fail';

    it('envía Email aunque WhatsApp falle', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockWhatsApp.sendTemplate.mockRejectedValue(new Error('Twilio down'));

      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      expect(mocks.mockEmail.sendEmail).toHaveBeenCalled();
    });

    it('persiste WhatsApp como FAILED y Email como SENT', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockWhatsApp.sendTemplate.mockRejectedValue(new Error('Twilio down'));

      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      const calls = mocks.mockPrismaCreate.mock.calls;
      const logMap = Object.fromEntries(
        calls.map((c: [{ data: { channel: string; status: string } }]) => [c[0].data.channel, c[0].data.status]),
      );
      expect(logMap['WHATSAPP']).toBe('FAILED');
      expect(logMap['EMAIL']).toBe('SENT');
    });
  });

  describe('resiliencia: fallo de Email', () => {
    const clientId = 'sale-email-fail';

    it('envía WhatsApp aunque Email falle', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId));
      mocks.mockEmail.sendEmail.mockRejectedValue(new Error('SMTP error'));

      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      expect(mocks.mockWhatsApp.sendTemplate).toHaveBeenCalled();
    });
  });

  describe('cliente no encontrado en DB', () => {
    it('retorna sin lanzar error y sin enviar notificaciones', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(null);

      buildSubscriber();
      await expect(
        mocks.getSaleHandler()(makeSaleData('sale-ghost-client')),
      ).resolves.toBeUndefined();

      expect(mocks.mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
      expect(mocks.mockEmail.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('cliente sin email (solo WhatsApp)', () => {
    const clientId = 'sale-no-email';

    it('solo envía WhatsApp si el cliente no tiene email', async () => {
      mocks.mockClientRepo.findById.mockResolvedValue(makeClient(clientId, { email: null }));

      buildSubscriber();
      await mocks.getSaleHandler()(makeSaleData(clientId));

      expect(mocks.mockWhatsApp.sendTemplate).toHaveBeenCalled();
      expect(mocks.mockEmail.sendEmail).not.toHaveBeenCalled();
    });
  });
});
