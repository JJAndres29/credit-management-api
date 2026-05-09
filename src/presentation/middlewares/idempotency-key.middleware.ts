import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

function hashBody(body: unknown): string {
  return createHash('sha256')
    .update(stableStringify(body === undefined ? {} : body))
    .digest('hex');
}

function buildOperationKey(req: Request): string {
  const user = (req as Request & { user?: { id: string } }).user?.id;
  const customer = (req as Request & { customer?: { id: string } }).customer?.id;
  const scope = user ?? customer ?? 'guest';
  return `${req.method}|${req.baseUrl}|${req.path}|${scope}`;
}

/**
 * When `Idempotency-Key` is present on a POST, replays the first successful (2xx) JSON response
 * for the same key + route + actor scope. Conflicting body → 409.
 */
export function idempotencyKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers['idempotency-key'];
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) {
    next();
    return;
  }
  if (key.length > 128) {
    res.status(400).json({ error: 'Idempotency-Key no puede exceder 128 caracteres' });
    return;
  }

  const operation = buildOperationKey(req);
  const bodyHash = hashBody(req.body);

  prisma.idempotencyRecord
    .findUnique({
      where: { key_operation: { key, operation } },
    })
    .then((existing) => {
      if (existing) {
        if (existing.bodyHash !== bodyHash) {
          res.status(409).json({ error: 'Idempotency-Key reutilizada con un cuerpo distinto' });
          return;
        }
        res.status(existing.statusCode).json(existing.responseBody);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = function idempotentJson(body: unknown): Response {
        const code = res.statusCode;
        if (code < 200 || code >= 300) {
          res.json = originalJson;
          return originalJson(body);
        }

        prisma.idempotencyRecord
          .create({
            data: {
              key,
              operation,
              bodyHash,
              statusCode: code,
              responseBody: body as Prisma.InputJsonValue,
            },
          })
          .then(() => {
            res.json = originalJson;
            return originalJson(body);
          })
          .catch(async (err: unknown) => {
            res.json = originalJson;
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
              const row = await prisma.idempotencyRecord.findUnique({
                where: { key_operation: { key, operation } },
              });
              if (row && row.bodyHash === bodyHash) {
                res.status(row.statusCode);
                return originalJson(row.responseBody);
              }
              res.status(409).json({ error: 'Idempotency-Key reutilizada con un cuerpo distinto' });
              return;
            }
            next(err);
          });
        return res;
      };

      next();
    })
    .catch(next);
}
