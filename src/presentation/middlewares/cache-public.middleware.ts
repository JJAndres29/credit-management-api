import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';

type CachePublicOptions = {
  maxAgeSeconds?: number;
};

function collectUpdatedAt(value: unknown, output: string[] = []): string[] {
  if (!value || typeof value !== 'object') return output;

  if (Array.isArray(value)) {
    value.forEach((item) => collectUpdatedAt(item, output));
    return output;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.updatedAt === 'string') {
    output.push(record.updatedAt);
  } else if (record.updatedAt instanceof Date) {
    output.push(record.updatedAt.toISOString());
  }

  Object.values(record).forEach((item) => collectUpdatedAt(item, output));
  return output;
}

function hashEtag(seed: unknown): string {
  const updatedAtValues = collectUpdatedAt(seed).sort();
  const source = updatedAtValues.length > 0 ? updatedAtValues.join('|') : JSON.stringify(seed);
  const hash = createHash('sha256').update(source).digest('base64url');
  return `"${hash}"`;
}

export function cachePublic(options: CachePublicOptions = {}) {
  const maxAgeSeconds = options.maxAgeSeconds ?? 60;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const originalJson = res.json.bind(res);

    res.json = (body: unknown): Response => {
      const etag = hashEtag(body);
      res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 5}`);
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      return originalJson(body);
    };

    next();
  };
}
