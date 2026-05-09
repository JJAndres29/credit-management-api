import { NextFunction, Request, Response } from 'express';
import { FeatureFlagPort } from '../../domain/services';

type FeatureFlagMiddlewareOptions = {
  disabledStatus?: 403 | 404 | 503;
  disabledMessage?: string;
  defaultValue?: boolean;
};

export class FeatureFlagMiddleware {
  static requireEnabled(
    featureFlags: FeatureFlagPort,
    key: string,
    options: FeatureFlagMiddlewareOptions = {},
  ) {
    return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      const enabled = await featureFlags.isEnabled(key, options.defaultValue ?? true);
      if (enabled) {
        next();
        return;
      }

      res.status(options.disabledStatus ?? 403).json({
        error: options.disabledMessage ?? 'Funcionalidad temporalmente deshabilitada',
      });
    };
  }

  static requireAllEnabled(
    featureFlags: FeatureFlagPort,
    keys: string[],
    options: FeatureFlagMiddlewareOptions = {},
  ) {
    return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      for (const key of keys) {
        const enabled = await featureFlags.isEnabled(key, options.defaultValue ?? true);
        if (!enabled) {
          res.status(options.disabledStatus ?? 403).json({
            error: options.disabledMessage ?? 'Funcionalidad temporalmente deshabilitada',
          });
          return;
        }
      }

      next();
    };
  }
}
