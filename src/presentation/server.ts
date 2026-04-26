import express, { Application, NextFunction, Request, Response } from 'express';
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
import helmet from 'helmet';
import cors from 'cors';

interface ServerOptions {
  port: number;
  logger?: LoggerService;
}

export class Server {
  private readonly app: Application = express();
  private readonly logger?: LoggerService;

  constructor(private readonly options: ServerOptions) {
    this.logger = options.logger;
  }

  start(): void {

    this.app.use(helmet());

    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }));

    // Register webhook route BEFORE express.json() so rawBody is preserved for HMAC verification
    this.app.use('/api/ecommerce', EcommerceRouter.routes);

    this.app.use(express.json({ limit: '10kb' }) );
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    this.app.use('/health', HealthRouter.routes(this.logger));

    this.app.use('/api/auth', AuthRouter.routes);
    this.app.use('/api/clients', ClientRouter.routes);
    this.app.use('/api/products', ProductRouter.routes);
    this.app.use('/api/users', UserRouter.routes);
    this.app.use('/api/sales', SaleRouter.routes);
    this.app.use('/api/payments', PaymentRouter.routes);
    this.app.use('/api/audit-logs', AuditLogRouter.routes);
    this.app.use('/api/reports', ReportRouter.routes);
    this.app.use('/api/dashboard', DashboardRouter.routes);
    this.app.use('/api/customer-auth', CustomerAuthRouter.routes);
    this.app.use('/api/categories', CategoryRouter.routes);
    this.app.use('/api', AttributeRouter.routes);
    this.app.use('/api/online-orders', OnlineOrderRouter.routes);

    this.app.use(this.handleError);

    this.app.listen(this.options.port,'0.0.0.0', () => {
      this.logger?.info(`Server running on port ${this.options.port}`, { port: this.options.port });
    });
  }

  private getAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS ?? '';

    if (!origins) {
      this.logger?.warn('ALLOWED_ORIGINS no configurado — solo localhost permitido');
      return ['http://localhost:4200', 'http://localhost:5173'];
    }

    return origins.split(',').map(o => o.trim());
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

