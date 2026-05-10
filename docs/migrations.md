# Política de migraciones (expand / contract)

Toda migración que toque datos financieros, inventario o contratos públicos debe seguir **expand → dual-write → backfill → switch reads → contract**.

## Checklist obligatorio (PR con cambio de schema)

1. **¿Es expand-only?** Solo `ADD COLUMN`, `CREATE TABLE`, nuevos valores de enum, índices. Nunca `DROP COLUMN` / `RENAME` en el mismo deploy que cambia código dependiente.
2. **¿Hay dual-write?** Si se introduce una fuente de verdad nueva (ej. `ProductVariant.stock` junto a `Product.stock`), el código debe escribir ambas hasta el deploy de “switch reads”.
3. **¿Hay script de backfill?** Datos históricos deben tener un camino documentado (SQL en migración o job offline) y validación `count` antes/después.
4. **¿Plan de rollback?** Qué deploy revertir y qué columnas legacy siguen pobladas si se vuelve atrás.
5. **¿Quién valida?** Revisor + prueba en staging con `prisma migrate deploy` sobre copia de prod.

## Convenciones del repo

- **Ledger (`LedgerEntry`)** es append-only por diseño: no `UPDATE`/`DELETE` salvo herramientas de administración excepcionales.
- **Variantes**: `SaleItem.variantId` y `OnlineOrderItem.variantId` son dual-write con `productId` hasta una fase “contract” futura.
- **IVA en órdenes web**: `subtotalAmount` / `taxAmount` son informativos; `totalAmount` sigue siendo el cobro bruto al cliente.

## Referencia

Ver roadmap P2 en el plan de auditoría ecommerce (variantes, money/tax, ledger, factura, assets, order events).
