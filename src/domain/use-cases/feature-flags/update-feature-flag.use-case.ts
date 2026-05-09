import { CustomError } from '../../errors';
import { FeatureFlag, FeatureFlagKey, FeatureFlagPort } from '../../services';

const VALID_KEYS = new Set<string>(Object.values(FeatureFlagKey));

export class UpdateFeatureFlagUseCase {
  constructor(private readonly featureFlags: FeatureFlagPort) {}

  execute(key: string, enabled: boolean, updatedBy: string | null): Promise<FeatureFlag> {
    if (!VALID_KEYS.has(key)) {
      throw CustomError.badRequest(`Feature flag no soportado: ${key}`);
    }

    return this.featureFlags.update(key, { enabled, updatedBy });
  }
}
