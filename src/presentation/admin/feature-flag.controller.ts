import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { GetFeatureFlagsUseCase, UpdateFeatureFlagUseCase } from '../../domain/use-cases/feature-flags';

export class FeatureFlagController {
  constructor(
    private readonly getFeatureFlagsUseCase: GetFeatureFlagsUseCase,
    private readonly updateFeatureFlagUseCase: UpdateFeatureFlagUseCase,
  ) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const flags = await this.getFeatureFlagsUseCase.execute();
      res.json(flags);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { enabled } = req.body as Record<string, unknown>;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled debe ser boolean' });
      return;
    }

    try {
      const user = (req as Request & { user?: { id?: string } }).user;
      const flag = await this.updateFeatureFlagUseCase.execute(
        req.params.key,
        enabled,
        user?.id ?? null,
      );
      res.json(flag);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: unknown, res: Response): void {
    if (error instanceof CustomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
