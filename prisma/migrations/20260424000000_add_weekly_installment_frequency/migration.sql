-- AlterEnum: agrega la opción WEEKLY a InstallmentFrequency
-- En PostgreSQL, ALTER TYPE ... ADD VALUE es la única forma de extender un enum existente.
-- Es una operación no destructiva: las filas existentes (MONTHLY / BIWEEKLY) no se modifican.
-- No requiere bloqueo de tabla — se puede aplicar en producción sin downtime.
ALTER TYPE "InstallmentFrequency" ADD VALUE 'WEEKLY';
