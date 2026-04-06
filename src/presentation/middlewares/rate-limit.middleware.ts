import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';


export class RateLimitMiddleware {

  static loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // ventana de 15 minutos
    max: 10,                   // máximo 10 intentos por IP en esa ventana
    standardHeaders: true,     // envía headers RateLimit-* en la respuesta
    legacyHeaders: false,      // desactiva los X-RateLimit-* más viejos

    // Mensaje de error consistente con tu CustomError
    message: {
      error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
    },

    // Handler cuando se supera el límite
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
      });
    },
  });

}