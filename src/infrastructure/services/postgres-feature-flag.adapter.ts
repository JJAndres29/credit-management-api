import { prisma } from '../../config/prisma';
import { CustomError } from '../../domain/errors';
import { FeatureFlag, FeatureFlagPort, UpdateFeatureFlagData } from '../../domain/services';

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  value: boolean;
  expiresAt: number;
};

type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  description: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapToFeatureFlag(row: FeatureFlagRow): FeatureFlag {
  return {
    key: row.key,
    enabled: row.enabled,
    description: row.description,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PostgresFeatureFlagAdapter implements FeatureFlagPort {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly featureFlagModel = (prisma as unknown as { featureFlag: {
    findUnique(args: { where: { key: string } }): Promise<FeatureFlagRow | null>;
    findMany(args: { orderBy: { key: 'asc' } }): Promise<FeatureFlagRow[]>;
    update(args: {
      where: { key: string };
      data: { enabled: boolean; updatedBy: string | null };
    }): Promise<FeatureFlagRow>;
  } }).featureFlag;

  async isEnabled(key: string, defaultValue = true): Promise<boolean> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const flag = await this.featureFlagModel.findUnique({ where: { key } });
    const value = flag?.enabled ?? defaultValue;
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async findAll(): Promise<FeatureFlag[]> {
    const flags = await this.featureFlagModel.findMany({ orderBy: { key: 'asc' } });
    return flags.map(mapToFeatureFlag);
  }

  async update(key: string, data: UpdateFeatureFlagData): Promise<FeatureFlag> {
    try {
      const flag = await this.featureFlagModel.update({
        where: { key },
        data: {
          enabled: data.enabled,
          updatedBy: data.updatedBy,
        },
      });

      this.cache.set(key, { value: flag.enabled, expiresAt: Date.now() + CACHE_TTL_MS });
      return mapToFeatureFlag(flag);
    } catch {
      throw CustomError.notFound(`Feature flag ${key} no existe`);
    }
  }
}
