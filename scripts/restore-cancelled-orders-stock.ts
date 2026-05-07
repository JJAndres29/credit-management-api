/**
 * One-shot remediation: restores inventory for online orders that were
 * cancelled or expired BEFORE the stockRestoredAt marker was introduced
 * (migration 20260507000000_add_stock_restored_at_to_online_order).
 *
 * Targets:  status IN ('CANCELLED','EXPIRED') AND stockRestoredAt IS NULL
 *
 * Usage:
 *   npx ts-node scripts/restore-cancelled-orders-stock.ts                # dry-run
 *   npx ts-node scripts/restore-cancelled-orders-stock.ts --apply        # actually update
 *
 * Idempotent: after a successful apply, re-running the script lists 0 orders.
 *
 * Safety: each order is processed in its own Prisma transaction. If a single
 * `Product.update` fails, that order is rolled back and reported as an error,
 * but the remaining orders continue. Run again after fixing the underlying
 * cause.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PendingOrder {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: number;
  createdAt: Date;
  guestEmail: string | null;
  customerEmail: string | null;
  items: Array<{ productId: string; productName: string; quantity: number }>;
}

async function loadCandidates(): Promise<PendingOrder[]> {
  const rows = await prisma.onlineOrder.findMany({
    where: {
      status: { in: ['CANCELLED', 'EXPIRED'] },
      stockRestoredAt: null,
    },
    include: {
      items: { select: { productId: true, productNameSnapshot: true, quantity: true } },
      customer: { select: { email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    status: r.status,
    totalAmount: Number(r.totalAmount),
    createdAt: r.createdAt,
    guestEmail: r.guestEmail,
    customerEmail: r.customer?.email ?? null,
    items: r.items.map((i) => ({
      productId: i.productId,
      productName: i.productNameSnapshot,
      quantity: i.quantity,
    })),
  }));
}

function printSummary(orders: PendingOrder[]): void {
  if (orders.length === 0) {
    console.log('\n✓ No hay órdenes pendientes de restauración. Inventario está sincronizado.\n');
    return;
  }

  console.log(`\n=== ${orders.length} órdenes con stock pendiente de restaurar ===\n`);
  for (const order of orders) {
    const who = order.guestEmail ?? order.customerEmail ?? '(sin email)';
    console.log(`#${order.orderNumber}  [${order.status}]  ${who}  $${order.totalAmount.toLocaleString('es-CO')}`);
    console.log(`  ID: ${order.id}`);
    console.log(`  Creada: ${order.createdAt.toISOString()}`);
    for (const item of order.items) {
      console.log(`    - ${item.productName}  ×${item.quantity}  (productId: ${item.productId})`);
    }
    console.log();
  }

  // Aggregate by product so the operator can sanity-check totals against
  // physical inventory before applying.
  const byProduct = new Map<string, { name: string; quantity: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = byProduct.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byProduct.set(item.productId, { name: item.productName, quantity: item.quantity });
      }
    }
  }

  console.log('=== Stock que se devolverá al inventario ===');
  const sorted = [...byProduct.entries()].sort((a, b) => b[1].quantity - a[1].quantity);
  for (const [productId, { name, quantity }] of sorted) {
    console.log(`  +${quantity}\t${name}\t(${productId})`);
  }
  console.log();
}

async function applyRestoration(orders: PendingOrder[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      await prisma.$transaction(async (tx) => {
        // Set the marker first under the same status guard the use cases use.
        // If the marker was set by a concurrent process between loadCandidates
        // and this transaction, updateMany returns count=0 and we skip the
        // increments.
        const guard = await tx.onlineOrder.updateMany({
          where: { id: order.id, stockRestoredAt: null },
          data: { stockRestoredAt: new Date() },
        });
        if (guard.count === 0) return;

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      });
      ok++;
      console.log(`  ✓ #${order.orderNumber}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ #${order.orderNumber}  ${msg}`);
    }
  }

  return { ok, failed };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const orders = await loadCandidates();
  printSummary(orders);

  if (orders.length === 0) return;

  if (!apply) {
    console.log('Dry-run completo. Para aplicar los cambios ejecuta:');
    console.log('  npx ts-node scripts/restore-cancelled-orders-stock.ts --apply\n');
    return;
  }

  console.log('Aplicando restauración...\n');
  const result = await applyRestoration(orders);
  console.log(`\n=== Resultado: ${result.ok} OK, ${result.failed} fallidas ===\n`);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('Error fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
