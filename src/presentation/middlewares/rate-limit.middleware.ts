import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';

export class RateLimitMiddleware {
  static loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
      });
    },
  });

  /** P0 — anonymous checkout / stock reservation abuse */
  static onlineOrderCreateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Demasiadas órdenes desde esta IP. Intenta más tarde.' });
    },
  });

  /** P0 — forgot-password enumeration / email spam */
  static forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Demasiadas solicitudes de recuperación. Intenta más tarde.' });
    },
  });

  /** P0 — notify triggers PDF + email */
  static clientNotifyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Demasiadas notificaciones enviadas. Intenta más tarde.' });
    },
  });

  /** P0 — public catalog scraping */
  static publicProductsReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Demasiadas solicitudes al catálogo. Espera un momento.' });
    },
  });
}