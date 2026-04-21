/**
 * Acciones que generan un registro de auditoría.
 * Solo las operaciones que modifican el balance del cliente producen un log.
 */
export const AuditAction = {
  CREDIT_SALE: 'CREDIT_SALE',         // Venta a crédito — incrementa el balance
  PAYMENT: 'PAYMENT',                  // Pago registrado — decrementa el balance
  PAYMENT_MODIFIED: 'PAYMENT_MODIFIED', // Pago modificado por admin — ajusta el balance con delta
  PAYMENT_DELETED: 'PAYMENT_DELETED',   // Pago eliminado por admin — revierte el decremento del balance
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Representa un registro inmutable de un cambio de balance en la BD.
 * Los campos `before` y `after` son el balance del cliente antes y después de la operación.
 */
export class AuditLogEntity {
  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly userId: string,
    public readonly action: AuditAction,
    public readonly before: number,
    public readonly after: number,
    public readonly ip: string,
    public readonly createdAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): AuditLogEntity {
    const { id, clientId, userId, action, before, after, ip, createdAt } = object;

    if (!id) throw new Error('AuditLog id is required');
    if (!clientId) throw new Error('AuditLog clientId is required');
    if (!userId) throw new Error('AuditLog userId is required');
    if (!action) throw new Error('AuditLog action is required');
    if (before === undefined) throw new Error('AuditLog before is required');
    if (after === undefined) throw new Error('AuditLog after is required');
    if (!ip) throw new Error('AuditLog ip is required');

    return new AuditLogEntity(
      id as string,
      clientId as string,
      userId as string,
      action as AuditAction,
      Number(before),
      Number(after),
      ip as string,
      (createdAt as Date) ?? new Date(),
    );
  }
}
