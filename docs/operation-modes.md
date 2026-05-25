# Modos de Operación

El backend soporta tres modos con feature flags. Los flags viven en Postgres y se leen con cache en memoria por replica durante 60 segundos. Los flags viven en Postgres y se leen con cache en memoria por replica durante 60 segundos.

## HYBRID

Modo por defecto. Mantiene activo el negocio fisico, ecommerce y modulo crediticio.

Flags esperados:

- `checkout_enabled=true`
- `mp_enabled=true`
- `credit_module_enabled=true`
- `physical_sales_enabled=true`

## ECOMMERCE_ONLY

Oculta las rutas del modulo crediticio y ventas fisicas. El ecommerce sigue activo.

Flags esperados:

- `checkout_enabled=true`
- `credit_module_enabled=false`
- `physical_sales_enabled=false`

Rutas afectadas:

- `/api/clients`
- `/api/sales`
- `/api/payments`
- `/api/audit-logs`
- `/api/reports`
- `/api/collections`

El backend responde `404` para que la superficie parezca inexistente en este modo. El frontend debe leer `/api/admin/feature-flags` con un staff ADMIN y construir el menu segun los flags.

## POS_INTEGRATED

Preparacion para un POS externo como fuente de inventario. Todavia no implementa adapters POS concretos; por ahora se expresa como configuracion operativa:

- `checkout_enabled=true`
- `credit_module_enabled=false` si la tienda no ofrece credito
- `physical_sales_enabled=false` si las ventas fisicas se hacen solo en el POS

Cuando llegue la integracion POS, el port externo se agregara sin cambiar estos flags.
