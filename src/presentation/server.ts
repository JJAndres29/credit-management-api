import express, { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import type { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { CustomError } from '../domain/errors';
import { LoggerService } from '../domain/services/logger.service';
import { AuthRouter } from './auth/auth.router';
import { ClientRouter } from './clients/client.router';
import { ProductRouter } from './products/product.router';
import { UserRouter } from './users/user.router';
import { SaleRouter } from './sales/sale.router';
import { PaymentRouter } from './payments/payment.router';
import { AuditLogRouter } from './audit-logs/audit-log.router';
import { ReportRouter } from './reports/report.router';
import { DashboardRouter } from './dashboard/dashboard.router';
import { HealthRouter } from './health/health.router';
import { CustomerAuthRouter } from './customer-auth/customer-auth.router';
import { CategoryRouter } from './categories/category.router';
import { AttributeRouter } from './categories/attribute.router';
import { OnlineOrderRouter } from './online-orders/online-order.router';
import { EcommerceRouter } from './ecommerce/ecommerce.router';
import { CollectionRouter } from './collections/collection.router';
import { FeatureFlagRouter } from './admin/feature-flag.router';
import { CartRouter } from './cart/cart.router';
import { ShippingRouter } from './shipping/shipping.router';
import { CouponAdminRouter } from './admin/coupon.router';
import { DeadLetterRouter } from './admin/dead-letter.router';
import helmet from 'helmet';
import cors from 'cors';
import type pino from 'pino';
import { FeatureFlagKey, FeatureFlagPort } from '../domain/services';
import { PostgresFeatureFlagAdapter } from '../infrastructure/services';
import { FeatureFlagMiddleware } from './middlewares';

interface ServerOptions {
  port: number;
  logger?: LoggerService;
}

export class Server {
  private readonly app: Application = express();
  private readonly logger?: LoggerService;
  private readonly featureFlags: FeatureFlagPort = new PostgresFeatureFlagAdapter();
  private httpServer?: HttpServer;

  constructor(private readonly options: ServerOptions) {
    this.logger = options.logger;
  }

  /**
   * Returns the underlying HTTP server for graceful shutdown (close + Prisma disconnect).
   */
  start(): HttpServer {
    this.app.set('trust proxy', 1);

    this.app.use(helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }));

    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Cart-Session'],
      credentials: true,
    }));

    this.app.use(pinoHttp({
      logger: this.getNativeLogger(),
      genReqId: (req: Request, res: Response) => {
        const existing = req.headers['x-request-id'];
        const requestId = Array.isArray(existing) ? existing[0] : existing;
        const id = requestId || randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req: Request, res: Response, err?: Error) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customProps: (req: Request & { id?: string }) => ({
        requestId: req.id,
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.token',
          'req.body.accessToken',
          'req.body.refreshToken',
        ],
        censor: '[REDACTED]',
      },
    }) as unknown as RequestHandler);

    // Register webhook route BEFORE express.json() so rawBody is preserved for HMAC verification
    this.app.use('/api/ecommerce', EcommerceRouter.routes);

    this.app.use(express.json({ limit: '10kb' }) );
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    this.app.use('/health', HealthRouter.routes(this.logger));

    this.app.use('/api/auth', AuthRouter.routes);
    this.app.use('/api/admin/feature-flags', FeatureFlagRouter.routes);
    this.app.use('/api/admin/coupons', CouponAdminRouter.routes);
    this.app.use('/api/admin/dead-letters', DeadLetterRouter.routes);
    this.app.use(
      '/api/clients',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CREDIT_MODULE_ENABLED, {
        disabledStatus: 404,
        disabledMessage: 'Ruta no disponible en el modo de operación actual',
      }),
      ClientRouter.routes,
    );
    this.app.use('/api/products', ProductRouter.routes);
    this.app.use('/api/users', UserRouter.routes);
    this.app.use(
      '/api/sales',
      FeatureFlagMiddleware.requireAllEnabled(
        this.featureFlags,
        [FeatureFlagKey.CREDIT_MODULE_ENABLED, FeatureFlagKey.PHYSICAL_SALES_ENABLED],
        {
          disabledStatus: 404,
          disabledMessage: 'Ruta no disponible en el modo de operación actual',
        },
      ),
      SaleRouter.routes,
    );
    this.app.use(
      '/api/payments',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CREDIT_MODULE_ENABLED, {
        disabledStatus: 404,
        disabledMessage: 'Ruta no disponible en el modo de operación actual',
      }),
      PaymentRouter.routes,
    );
    this.app.use(
      '/api/audit-logs',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CREDIT_MODULE_ENABLED, {
        disabledStatus: 404,
        disabledMessage: 'Ruta no disponible en el modo de operación actual',
      }),
      AuditLogRouter.routes,
    );
    this.app.use(
      '/api/reports',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CREDIT_MODULE_ENABLED, {
        disabledStatus: 404,
        disabledMessage: 'Ruta no disponible en el modo de operación actual',
      }),
      ReportRouter.routes,
    );
    this.app.use('/api/dashboard', DashboardRouter.routes);
    this.app.use('/api/customer-auth', CustomerAuthRouter.routes);
    this.app.use(
      '/api/collections',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CREDIT_MODULE_ENABLED, {
        disabledStatus: 404,
        disabledMessage: 'Ruta no disponible en el modo de operación actual',
      }),
      CollectionRouter.routes,
    );
    this.app.use('/api/categories', CategoryRouter.routes);
    this.app.use(
      '/api/cart',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CHECKOUT_ENABLED, {
        disabledStatus: 503,
        disabledMessage: 'Carrito no disponible — checkout deshabilitado',
      }),
      CartRouter.routes,
    );
    this.app.use(
      '/api/shipping',
      FeatureFlagMiddleware.requireEnabled(this.featureFlags, FeatureFlagKey.CHECKOUT_ENABLED, {
        disabledStatus: 503,
        disabledMessage: 'Envíos no disponibles — checkout deshabilitado',
      }),
      ShippingRouter.routes,
    );
    this.app.use('/api/online-orders', OnlineOrderRouter.routes);
    this.app.use('/api', AttributeRouter.routes);

    this.app.use(this.handleError);

    this.httpServer = this.app.listen(this.options.port, '0.0.0.0', () => {
      this.logger?.info(`Server running on port ${this.options.port}`, { port: this.options.port });
    });
    return this.httpServer;
  }

  getHttpServer(): HttpServer | undefined {
    return this.httpServer;
  }

  private getAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS ?? '';

    if (!origins) {
      this.logger?.warn('ALLOWED_ORIGINS no configurado — solo localhost permitido');
      return ['http://localhost:4200', 'http://localhost:5173'];
    }

    return origins.split(',').map(o => o.trim());
  }

  private getNativeLogger(): pino.Logger | undefined {
    const maybePino = this.logger as (LoggerService & { getNativeLogger?: () => pino.Logger }) | undefined;
    return maybePino?.getNativeLogger?.();
  }

  private handleError = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    this.logger?.error('[Unhandled error]', err);
    res.status(500).json({ error: 'Internal server error' });
  };
}

