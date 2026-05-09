# Restore Drill Mensual

Objetivo: confirmar que el backup realmente se puede restaurar y medir el RTO.

## Frecuencia

Mensual, y adicionalmente antes de cambios grandes de schema.

## Procedimiento

1. Crear una base Postgres staging vacia.
2. Restaurar el backup mas reciente o un punto PITR elegido.
3. Ejecutar migraciones pendientes si el backup viene de una version anterior.
4. Ejecutar validaciones de integridad:
   - Conteos por tabla critica: `Product`, `OnlineOrder`, `Sale`, `Payment`, `Client`, `Customer`.
   - Foreign keys sin huerfanos en items y pagos.
   - Ordenes `PENDING_PAYMENT` con `expiresAt` coherente.
   - `ProcessedWebhook` sin duplicados por `(provider, eventId)`.
5. Levantar la API contra staging restaurada.
6. Probar lectura de endpoints criticos: health, productos, orden por id, clientes y pagos.
7. Registrar inicio, fin, RTO real, responsable y hallazgos.

## Criterio de Exito

- La base restaurada arranca sin errores.
- La API responde `GET /health` con base conectada.
- No hay violaciones de integridad referencial.
- RTO inicial objetivo: menor o igual a 1 hora.
- RPO esperado: menor o igual a 15 minutos si el proveedor ofrece PITR.

## Evidencia a Guardar

- Fecha del drill.
- Backup/PITR usado.
- Duracion total.
- Comandos ejecutados.
- Resultado de validaciones.
- Acciones correctivas si algo fallo.
