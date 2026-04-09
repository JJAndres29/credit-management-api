import express, { Application, NextFunction, Request, Response } from 'express';
import { CustomError } from '../domain/errors';
import { AuthRouter } from './auth/auth.router';
import { ClientRouter } from './clients/client.router';
import { ProductRouter } from './products/product.router';
import { UserRouter } from './users/user.router';
import { SaleRouter } from './sales/sale.router';
import { PaymentRouter } from './payments/payment.router';
import { AuditLogRouter } from './audit-logs/audit-log.router';
import { ReportRouter } from './reports/report.router';
import helmet from 'helmet';
import cors from 'cors';

interface ServerOptions {
  port: number;
}

export class Server {
  private readonly app: Application = express();

  constructor(private readonly options: ServerOptions) {}

  start(): void {

    this.app.use(helmet());

    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }));

    this.app.use(express.json({ limit: '10kb' }) );
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    this.app.use('/api/auth', AuthRouter.routes);
    this.app.use('/api/clients', ClientRouter.routes);
    this.app.use('/api/products', ProductRouter.routes);
    this.app.use('/api/users', UserRouter.routes);
    this.app.use('/api/sales', SaleRouter.routes);
    this.app.use('/api/payments', PaymentRouter.routes);
    this.app.use('/api/audit-logs', AuditLogRouter.routes);
    this.app.use('/api/reports', ReportRouter.routes);

    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    this.app.use(this.handleError);

    this.app.listen(this.options.port, () => {
      console.log(`Server running on port ${this.options.port}`);
    });
  }

  private getAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS ?? '';
    
    if (!origins) {
      console.warn('⚠️  ALLOWED_ORIGINS no configurado — solo localhost permitido');
      return ['http://localhost:4200', 'http://localhost:5173'];
    }

    return origins.split(',').map(o => o.trim());
  }


  private handleError = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    console.error('[Unhandled error]', err);
    res.status(500).json({ error: 'Internal server error' });
  };
}
