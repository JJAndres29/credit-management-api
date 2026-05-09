import { FeatureFlag, FeatureFlagPort } from '../../services';

export class GetFeatureFlagsUseCase {
  constructor(private readonly featureFlags: FeatureFlagPort) {}

  execute(): Promise<FeatureFlag[]> {
    return this.featureFlags.findAll();
  }
}
