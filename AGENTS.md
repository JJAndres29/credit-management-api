# Credit Management System — Project Context

## Regla de Cero Acoplamiento

**Los use cases no dependen de ninguna infraestructura concreta.** Solo reciben interfaces del dominio (`NotificationService`, `EmailService`, `PdfService`, `EventEmitterPort`, repositorios). Los subscribers en `infrastructure/subscribers/` son los únicos que orquestan servicios externos y solo se activan vía Domain Events después de que la transacción ya se commitió. Si falta una env var, el servidor arranca con un `console.warn` y la feature queda deshabilitada — nunca crashea ni afecta la operación financiera.

**Regla adicional — Customer NO importa de User/Client:** El módulo `Customer` (identidad E-commerce) es un bounded context completamente aislado. Ningún archivo dentro de `customer-auth/`, `domain/use-cases/customer-auth/`, `domain/dtos/customer-auth/`, ni `domain/entities/customer.entity.ts` puede importar `UserEntity`, `ClientEntity`, `UserRepository`, `ClientRepository`, ni ninguna otra pieza del módulo Staff. El único recurso compartido permitido es `src/config/regular-exp.ts` (regex puras, sin acoplamiento de dominio) y la interfaz `CustomerJwtService` (definida en `domain/services/customer-jwt.service.ts`, implementada por `CustomerJwtAdapter` con su propio secret).

**Anti-Corruption Layer — `ClientLookupPort`:** La vinculación opcional de un `Customer` con un `Client` de Staff se realiza a través de un puerto de dominio mínimo (`src/domain/services/client-lookup.port.ts`) que expone solo `ClientSummary` (id, creditLimit, balance, isLinkedToCustomer). Los use cases `ClaimClientUseCase` y `GetCustomerProfileUseCase` reciben `ClientLookupPort`, NUNCA `ClientRepository`. La implementación `ClientLookupAdapter` (en `infrastructure/services/`) envuelve `ClientRepository` + `CustomerRepository` y traduce al tipo `ClientSummary`. Esta es la única forma permitida de que el bounded context Customer acceda a datos de Client. El test `no-coupling.test.ts` verifica estructuralmente que ningún archivo en `domain/use-cases/customer-auth/` ni `domain/dtos/customer-auth/` importa `client.repository` o `client.entity`.

---

## Stack & Architecture

- **Framework**: Express + TypeScript (no NestJS)
- **Database**: PostgreSQL 16 via Prisma ORM
- **Port**: 3000
- **Pattern**: Clean Architecture — 3 layers: `presentation/` → `domain/` → `infrastructure/`
- **Auth**: JWT (jsonwebtoken) + bcryptjs for passwords
- **File storage**: Cloudinary (product images)

---

## Module Implementation Status

| Module    | Routes | Use Cases | DTOs | Datasource | Status |
|-----------|--------|-----------|------|------------|--------|
| Auth      | ✅     | ✅        | ✅   | ✅         | Completo |
| Users     | ✅     | ✅        | ✅   | ✅         | Completo |
| Clients   | ✅     | ✅        | ✅   | ✅         | Completo (incl. NotifyClient) |
| Products  | ✅     | ✅        | ✅   | ✅         | Completo |
| Sales     | ✅     | ✅        | ✅   | ✅         | Completo (incl. UpdateSale: collectionDay, createdAt + DeleteSale: sin pagos, stock restaurado, SALE_DELETED audit) |
| Payments  | ✅     | ✅        | ✅   | ✅         | Completo (incl. UpdatePayment + DeletePayment + createdAt) |
| AuditLogs | ✅     | ✅        | N/A  | ✅         | Completo |
| Notifications (WhatsApp + Email) | N/A (Domain Events) | N/A (Subscribers) | N/A | ✅ | Completo |
| Reports (PDF Estado de Cuenta) | ✅     | ✅        | N/A  | N/A (usa repos existentes) | Completo |
| Health Check | ✅ (GET /health) | N/A | N/A | N/A (Prisma $queryRaw) | Completo |
| Logger Service | N/A | N/A (interfaz + PinoLoggerService) | N/A | N/A | Completo |
| Dockerfile multi-stage | N/A | N/A | N/A | N/A | Completo |
| Customer Auth (E-commerce) | ✅ /api/customer-auth | ✅ Register+Login+Renew+ClaimClient+GetProfile+Update+ResetPassword+ForgotPassword+ChangePassword+GetCustomers | ✅ | ✅ | Completo (JWT audience:'customer', aislado de Staff, ClientLookupPort ACL, mustChangePassword, CustomerPasswordResetSubscriber) |

---

## API Endpoints

**Base URL**: `http://localhost:3000`

### Health (`/health`) — Público
- `GET /` — Sin auth. Retorna `{ status, database, uptime }`. 200 si DB responde, 503 si no.

### Auth (`/api/auth`)
- `POST /login` — RateLimit (10/15min). Retorna `{ token, user }`
- `POST /renew` — JWT requerido. Retorna `{ token, user }`

### Users (`/api/users`) — JWT + ADMIN
- `GET /` — Listar todos
- `GET /:id`
- `POST /` — Crear (password fuerte requerida)
- `PUT /:id` — Actualizar nombre/email/role
- `PATCH /:id/status` — Activar/desactivar
- `PATCH /:id/password` — Cambiar contraseña (ADMIN o dueño)

### Clients (`/api/clients`) — JWT
- `GET /` — Solo clientes activos
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id` — ADMIN requerido, soft-delete
- `POST /:id/notify` — Cualquier usuario autenticado. Retorna `{ message, whatsappPayload }`. Emite `CLIENT_NOTIFY_REQUESTED` → `ClientNotifySubscriber` genera PDF y envía email async

### Products (`/api/products`) — JWT
- `GET /` — Con imágenes
- `GET /:id` — Con imágenes
- `POST /` — ADMIN
- `PUT /:id` — ADMIN (solo name)
- `PATCH /:id/stock` — ADMIN, cantidad puede ser negativa para restar
- `POST /:id/images` — ADMIN, multipart, hasta 5 imgs, 5MB cada una, JPEG/PNG/WebP
- `DELETE /:id/images/:imageId` — ADMIN, borra de Cloudinary y BD
- `DELETE /:id` — ADMIN, soft-delete

### Sales (`/api/sales`) — JWT
- `GET /` — Listar todas las ventas con ítems
- `GET /:id` — Detalle de una venta con ítems
- `GET /client/:clientId` — Ventas de un cliente específico
- `POST /` — Crear venta (CASH o CREDIT). El precio unitario de cada ítem se fija en el request. Descuenta stock y actualiza balance en una transacción atómica.
- `PUT /:id` — ADMIN requerido. Actualiza campos no financieros: `collectionDay?`, `collectionDay2?`, `createdAt?` (ISO 8601). `collectionDay2` solo válido para ventas BIWEEKLY. No toca total, status ni ítems.
  Cada ítem acepta **producto existente** (`productId`) o **producto nuevo inline** (`newProduct`):
  ```json
  { "productId": "uuid", "quantity": 3, "unitPrice": 45.00 }
  ```
  ```json
  { "newProduct": { "name": "Camisa Azul", "stock": 20 }, "quantity": 3, "unitPrice": 45.00 }
  ```
  `productId` y `newProduct` son mutuamente excluyentes por ítem. `newProduct.stock` es el stock total que se agrega al inventario; la cantidad vendida se descuenta de él.
  Para ventas CREDIT se pueden incluir campos opcionales:
  ```json
  {
    "installmentsCount": 6,
    "frequency": "MONTHLY",
    "collectionDay": 30
  }
  ```
  Para planes BIWEEKLY también se acepta `collectionDay2` (ej. 15 y 30 = cobra el 15 y el 30 de cada mes).
  El sistema calcula `installmentAmount = total / installmentsCount` vía `InstallmentCalculatorService`.
- `DELETE /:id` — ADMIN requerido. Elimina la venta permanentemente. Solo si no tiene pagos registrados. CREDIT: revierte balance + AuditLog `SALE_DELETED`. CASH: solo restaura stock. Transacción atómica.

### Payments (`/api/payments`) — JWT
- `GET /` — Listar todos los pagos
- `GET /:id` — Detalle de un pago
- `GET /client/:clientId` — Pagos de un cliente (valida que el cliente exista)
- `GET /sale/:saleId` — Pagos de una venta específica (valida que la venta exista)
- `POST /` — Registrar pago. Acepta `createdAt?` (ISO 8601) para registrar pagos en fechas anteriores. Decrementa balance del cliente y actualiza estado de venta en transacción atómica
- `PUT /:id` — ADMIN requerido. Modifica `amount?`, `note?` y/o `createdAt?` de un pago existente. Delta math sobre balance, recálculo de status de venta, AuditLog `PAYMENT_MODIFIED` — todo en transacción atómica
- `DELETE /:id` — ADMIN requerido. Elimina el pago permanentemente. Restaura el balance del cliente, recalcula el status de la venta, escribe AuditLog `PAYMENT_DELETED` — todo en transacción atómica

### Audit Logs (`/api/audit-logs`) — JWT + ADMIN
- `GET /` — Listar todos los registros de auditoría
- `GET /client/:clientId` — Registros de auditoría de un cliente específico

### Reports (`/api/reports`) — JWT + ADMIN
- `GET /account-statement/:clientId` — Genera y descarga el estado de cuenta del cliente en PDF. Retorna `Content-Type: application/pdf`.

### Customer Auth (`/api/customer-auth`) — Público / Customer JWT / Staff JWT+ADMIN
- `POST /register` — Público, RateLimit. Crea cuenta de customer con `password`. Retorna `{ token, customer }`. 409 si email ya existe (indica si debe usar Google o recuperar pass).
- `POST /login` — Público, RateLimit. Inicio de sesión clásico con email y password. Anti-enumeration: mismo 401. Retorna `{ token, customer }`.
- `POST /google` — Público, RateLimit. Login/registro con Google OAuth2. Retorna `{ token, customer }`.
- `POST /renew` — Requiere Customer JWT (`validateCustomerJwt`). Retorna `{ token, customer }`.
- `POST /forgot-password` — Público, anti-enumeration. Genera contraseña temporal, la hashea, actualiza `mustChangePassword: true` y emite `CUSTOMER_PASSWORD_RESET`.
- `POST /claim-client` — Requiere Customer JWT. Vincula customer con Client. 404 si no existe, 409 si ya vinculado.
- `PATCH /change-password` — Requiere Customer JWT. Valida actual, hashea nueva, actualiza `mustChangePassword: false`.
- `GET /me` — Requiere Customer JWT. Retorna `{ customer, client: ClientSummary | null }`.
- `GET /` — Requiere Staff JWT + ADMIN. Lista customers.
- `PATCH /:id` — Requiere Staff JWT + ADMIN. Actualiza datos del customer.
- `POST /:id/reset-password` — Requiere Staff JWT + ADMIN. Genera contraseña temporal, emite evento `CUSTOMER_PASSWORD_RESET`.

---

## Database Schema (Prisma)

### Enums
```
Role:                ADMIN | SELLER
SaleType:            CASH | CREDIT
SaleStatus:          PAID | PENDING | PARTIAL
InstallmentFrequency: MONTHLY | BIWEEKLY | WEEKLY
DocumentType:        CC (Cédula de ciudadanía) | CE (Cédula de extranjería)
```

### Tablas y campos clave

**User**: id, name, email (unique), password (hash), role, isActive, createdAt, updatedAt

**Client**: id, name, phone, email?, documentType (DocumentType), documentNumber (string), address (string), neighborhood (string), creditLimit (decimal), balance (decimal, default 0), isActive, createdAt, updatedAt

**Product**: id, name, stock (int), isActive, createdAt, updatedAt
- Sin campo `price` — el precio se fija por ítem al crear la venta
- Relación 1:M con `ProductImage`

**ProductImage**: id, productId (FK), url, publicId (Cloudinary ID), order (int), createdAt

**Sale**: id, clientId (FK), type (SaleType), status (SaleStatus, default PENDING), total (decimal), createdAt
- `installmentsCount` (int?, solo ventas CREDIT con plan de cuotas — mínimo 1; valor 1 = cuota única)
- `frequency` (InstallmentFrequency?, MONTHLY | BIWEEKLY | WEEKLY — null si no hay plan de cuotas)
- `installmentAmount` (decimal?, monto de cada cuota = (total - initialPayment) / installmentsCount, redondeado 2 dec.)
- `initialPayment` (decimal?, cuota inicial abonada al crear la venta — null si no se dio cuota inicial)
- `collectionDay` (int?) — día del mes para el cobro (1-31). MONTHLY: único día; BIWEEKLY: primer día
- `collectionDay2` (int?) — segundo día de cobro (1-31), exclusivo para planes BIWEEKLY
- Relación 1:M con `SaleItem` y `Payment`

**SaleItem**: id, saleId (FK), productId (FK), quantity (int), basePrice (decimal, nullable), unitPrice (decimal), subtotal (decimal), appliedRule (string, nullable)
- `basePrice`: precio unitario al momento de la venta (igual a `unitPrice` desde que el precio es manual)
- `unitPrice`: precio fijado por el vendedor al crear la venta
- `appliedRule`: null desde que el precio es manual; era la regla automática de pricing en versiones anteriores

**Payment**: id, clientId (FK), saleId? (FK, opcional), amount (decimal), note?, createdAt

**AuditLog**: id, clientId (FK), userId (FK), action, before (decimal), after (decimal), ip, createdAt
- Acciones: `CREDIT_SALE` (balance sube por venta a crédito) | `PAYMENT` (balance baja por pago) | `PAYMENT_MODIFIED` (balance ajustado por corrección de pago) | `PAYMENT_DELETED` (balance restaurado por eliminación de pago)
- Se escribe dentro de la misma transacción atómica de Sale/Payment — si la operación falla, el log también se revierte

**Customer**: id, name, email (unique), password (hash), phone, emailVerifiedAt (DateTime?), isActive (Boolean, default true), clientId (String?, unique, FK → Client), mustChangePassword (Boolean, default false), createdAt, updatedAt
- Bounded context E-commerce, aislado de Staff
- `clientId` — vínculo opcional con Client de Staff, establecido via `POST /claim-client`
- `mustChangePassword` — `true` cuando un admin regenera la contraseña; el frontend debe forzar el cambio al detectarlo en el token de login/renew
- `toJSON()` excluye `password`

---

## Domain Layer — Interfaces definidas (no implementadas)

- `EmailService` — envío de email (Nodemailer/Gmail config lista en envs)
- `NotificationService` — WhatsApp via Meta Cloud API. Métodos: `sendWhatsApp`, `sendTemplate`, `sendDocument(buffer)`, `sendDocumentTemplate(buffer)`. `TwilioWhatsAppService` existe como implementación legacy (no en uso).
- `PdfService` — generación de estados de cuenta PDF

---

## Infrastructure

### Datasources (Prisma)
- `PrismaAuthDatasource`, `PrismaUserDatasource`, `PrismaClientDatasource`, `PrismaProductDatasource`, `PrismaSaleDatasource`, `PrismaPaymentDatasource`
- Todos en `src/infrastructure/datasources/`

### Repositories (implementaciones)
- `AuthRepositoryImpl`, `UserRepositoryImpl`, `ClientRepositoryImpl`, `ProductRepositoryImpl`, `SaleRepositoryImpl`, `PaymentRepositoryImpl`
- Todos en `src/infrastructure/repositories/`

### Adapters
- `JwtAdapter` — wraps jsonwebtoken, métodos: `generateToken(payload, expiresIn?)`, `verifyToken<T>(token)`
- `CloudinaryAdapter` — wraps Cloudinary SDK, métodos: `uploadBuffer(buffer, mimetype, folder?)`, `deleteFile(publicId)`

---

## Middlewares

- **AuthMiddleware** — valida JWT del header `Authorization: Bearer <token>`, adjunta user al request
- **checkRole(...roles)** — verifica rol del usuario autenticado, retorna 403 si no tiene permiso
- **loginLimiter** — rate limit 10 req/15min en POST /login
- **uploadImages** — Multer in-memory, máx 5 files, 5MB, tipos: jpeg/png/webp

---

## Error Handling

`CustomError` con métodos estáticos: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `internalServer`.
El servidor tiene un handler global que captura `CustomError` y retorna el status + message apropiado.

---

## Validation Pattern

Los DTOs usan factory estático que retorna tupla `[error?: string, dto?: DTO]`:
```typescript
const [error, dto] = CreateUserDto.create(body)
if (error) throw CustomError.badRequest(error)
```

Los controladores llaman al DTO, si hay error retornan 400. Si pasa, ejecutan el use case.

---

## Environment Variables

**Requeridas** (falla si no están):
```
PORT, NODE_ENV, DATABASE_URL, JWT_SECRET (64+ hex), JWT_EXPIRES_IN
```

**Opcionales** (features deshabilitadas si no están):
```
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
MAILER_EMAIL, MAILER_SECRET_KEY, MAILER_SERVICE
META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID
ALLOWED_ORIGINS
```

---

## Tests

6 archivos de test (Jest) — **99 tests en total**:

### Auth
- `src/domain/use-cases/auth/login.use-case.test.ts` — 6 suites: credenciales inválidas, usuario inactivo, password incorrecta, login exitoso, payload del token, password no expuesta
- `src/domain/use-cases/auth/renew-token.use-case.test.ts` — 5 suites: usuario inexistente, inactivo, renovación exitosa, payload, password no expuesta

### CreateSaleUseCase — Bloque 1b (22 tests)
- `src/domain/use-cases/sales/create-sale.use-case.test.ts`:
  - Errores: cliente inexistente (404), producto inexistente (404), producto inactivo (400), stock insuficiente (400), crédito insuficiente (400)
  - CASH: `auditLog: undefined` (balance invariable), no emite `CREDIT_SALE_CREATED`, tipo/total correctos, unitPrice del DTO usado directamente
  - CREDIT: emite `CREDIT_SALE_CREATED` con `newBalance`, pasa `auditLog` con `before/after/action/userId/ip`, `appliedRule: null` (precio manual)
  - collectionDay: pasa `collectionDay` en MONTHLY y `collectionDay`+`collectionDay2` en BIWEEKLY al repositorio
  - Sin eventEmitter inyectado: no lanza error

### CreatePaymentUseCase — Bloque 1c (22 tests)
- `src/domain/use-cases/payments/create-payment.use-case.test.ts`:
  - Errores: cliente inexistente (404), cliente inactivo (400), monto > balance (400), venta ajena (403), venta inexistente (404), venta ya PAID (400), monto > pendiente de venta (400)
  - Pago total: pasa `saleTotal` para que el datasource calcule PAID
  - Pago parcial: pasa `saleTotal` para PARTIAL
  - Abono general (sin saleId): `saleId: null`, no consulta SaleRepository
  - AuditLog: `before`, `after = before - amount`, `userId`, `ip`, `action: PAYMENT`
  - Emite `PAYMENT_REGISTERED` con `paymentId`, `clientId`, `amount`, `newBalance`, `note`
  - Sin eventEmitter inyectado: no lanza error

### Notification Subscribers — Bloque 1d (25 tests)
- `src/infrastructure/subscribers/notification-subscribers.test.ts`:
  - `PaymentNotificationSubscriber` (17): registro en PAYMENT_REGISTERED, envío WhatsApp+Email, logs SENT, resiliencia WhatsApp falla→Email enviado, resiliencia Email falla→WhatsApp enviado, logs FAILED con errorMessage, PDF falla→email sin adjunto, PDF ok→email con attachment Buffer, throttle 4ª notif bloqueada (mismo clientId, misma hora), cliente sin teléfono/email, cliente no encontrado en DB
  - `SaleNotificationSubscriber` (8): registro en CREDIT_SALE_CREATED, envío WhatsApp+Email, logs SENT, resiliencia WhatsApp/Email, cliente no encontrado, cliente sin email
  - Estrategia de throttle: clientIds únicos por test para evitar contaminación del singleton

### GenerateAccountStatementUseCase — Bloque 1e (20 tests)
- `src/domain/use-cases/reports/generate-account-statement.use-case.test.ts`:
  - Cliente inexistente (404), no consulta ventas/pagos si falla
  - Consultas en paralelo: `findByClientId` de ventas Y pagos llamados una vez cada uno
  - Cliente sin ventas: retorna Buffer igualmente, arrays vacíos a pdfService, no consulta productos
  - Deduplicación: un mismo productId en 2 ventas → `findById` llamado 1 vez; 4 refs / 3 únicos → 3 calls; nombre real cuando existe; nombre fallback (`Producto ${id.slice(0,8)}`) cuando no
  - Datos al PdfService: cliente, `generatedBy`, pagos mapeados, Buffer del pdfService retornado

### Nota sobre open handle en tests de subscribers
El warning `worker process has failed to exit gracefully` en `notification-subscribers.test.ts` y `jwt-isolation.test.ts` se debe a que Prisma inicializa una conexión al importar el módulo, incluso con el mock. No afecta los resultados ni la CI. Se puede suprimir con `--forceExit` si es necesario.

### Customer Auth — Bloque 2b (216 tests total, 36 en customer-auth)
- `src/domain/use-cases/customer-auth/register-customer.use-case.test.ts` (13 tests):
  - `RegisterCustomerDto`: password débil sin mayúscula, password muy corta, email inválido, DTO válido con email lowercased
  - `RegisterCustomerUseCase`: email duplicado → 409, registro exitoso → `{ token, customer }` con `mustChangePassword: false`, no expone password, hashea password, genera token con id del customer, propaga CustomError
- `src/domain/use-cases/customer-auth/login-customer.use-case.test.ts` (8 tests):
  - Email inexistente → 401 genérico, customer inactivo → 401 genérico, mismo mensaje para email inexistente e inactivo (anti-enumeration), password incorrecta → 401, mismo mensaje para email inexistente y password incorrecta, login exitoso → `{ token, customer }` con `mustChangePassword`, no expone password, genera token con id del customer
- `src/domain/use-cases/customer-auth/claim-client.use-case.test.ts` (10 tests):
  - `ClaimClientDto`: documentType inválido, documentNumber vacío, ausente, DTO válido con trim
  - `ClaimClientUseCase`: 404 si client no existe, 409 si ya vinculado a otro customer, llama linkToClient con ids correctos, retorna ClientSummary con isLinkedToCustomer: true, retorna creditLimit y balance
- `src/domain/use-cases/customer-auth/get-customer-profile.use-case.test.ts` (6 tests):
  - Sin clientId: client null, incluye datos del customer, no expone password
  - Con clientId: llama findById con el clientId, retorna ClientSummary del port
  - Errores: 401 si customer no existe, 401 si inactivo
- `src/domain/use-cases/customer-auth/jwt-isolation.test.ts` (4 tests mutualidad + 2 sin-secret):
  - Token de customer rechazado por staff JwtAdapter, token de staff rechazado por CustomerJwtAdapter, cada adapter acepta sus propios tokens, generateToken lanza 500 sin secret, verifyToken retorna null sin secret
- `src/domain/use-cases/customer-auth/no-coupling.test.ts` (structural guard):
  - Verifica que ningún archivo en `domain/use-cases/customer-auth/` ni `domain/dtos/customer-auth/` importa `client.repository` o `client.entity`

---

## Migrations

1. `20260402050422_init` — Schema completo inicial (8 tablas)
2. `20260407022451_add_product_images` — Elimina `imageUrl` de Product, crea tabla `ProductImage` con soporte multi-imagen ordenada
3. `20260408190326_add_pricing_fields_to_sale_item` — Agrega `basePrice` (Decimal?) y `appliedRule` (String?) a `SaleItem` para trazabilidad de pricing
4. `20260408194544_add_notification_log` — Crea tabla `NotificationLog`
5. `20260414000000_add_installments_to_sale` — Agrega enum `InstallmentFrequency` y columnas `installmentsCount`, `frequency`, `installmentAmount` a `Sale`
6. `20260414100000_add_client_document_address` — Agrega enum `DocumentType` (CC, CE) y columnas `documentType`, `documentNumber`, `address`, `neighborhood` a `Client`
7. `20260414200000_remove_product_price_add_collection_days` — Elimina `price` de `Product`; agrega `collectionDay` y `collectionDay2` (ambos Int?) a `Sale`
8. `20260418000000_add_initial_payment_to_sale` — Agrega `initialPayment` (Decimal?) a `Sale` para separar la cuota inicial de los pagos regulares en el cálculo de cuotas pagadas
9. `20260424000000_add_weekly_installment_frequency` — Agrega `WEEKLY` al enum `InstallmentFrequency` via `ALTER TYPE ... ADD VALUE` (no destructivo, sin downtime)
10. `20260425000000_add_customer` — Crea tabla `Customer` (identidad E-commerce, bounded context aislado de Staff)
11. `20260426000000_add_customer_client_link` — Agrega `clientId String? @unique` a `Customer` con FK → `Client` (ON DELETE SET NULL)
12. `20260426100000_add_customer_must_change_password` — Agrega `mustChangePassword Boolean NOT NULL DEFAULT false` a `Customer`

---

## Scripts útiles

```bash
npm run dev          # ts-node-dev, hot reload
npm run db:migrate   # prisma migrate dev
npm run db:seed      # crea admin: admin@credit.com / Admin1234!
npm run db:studio    # Prisma Studio
npm test             # Jest
```

---

## Archivos clave — leer para replicar patrones

Antes de implementar un módulo nuevo, leer estos archivos para entender los patrones exactos del proyecto. No hace falta releer todo el codebase.

### DTO
`src/domain/dtos/sales/create-sale.dto.ts`
- Factory estático `create(object: Record<string, unknown>): [string?, DTO?]`
- Validación inline, retorna `[errorMsg]` o `[undefined, new DTO(...)]`
- Constructor privado, propiedades `readonly`

### Use Case
`src/domain/use-cases/sales/create-sale.use-case.ts`
- Constructor recibe repositorios, `EventEmitterPort?` e `InstallmentCalculatorService`
- Método `execute(dto)` contiene toda la lógica de negocio
- Llama a `CustomError.notFound/badRequest/forbidden` para errores
- Usa `dto.items[i].unitPrice` directamente (precio fijado por el vendedor, nunca auto-calculado)
- Pasa datos enriquecidos al repositorio (total calculado server-side como suma de unitPrice × quantity)

### Datasource Interface
`src/domain/datasources/sale.datasource.ts`
- Interface pura, sin imports de Prisma
- Exporta también los tipos de datos enriquecidos (ej. `SaleCreateData`)

### Datasource Prisma (implementación)
`src/infrastructure/datasources/prisma-sale.datasource.ts`
- Import `prisma` desde `../../config/prisma`
- Función local `mapToEntity()` para convertir resultado Prisma → Entity
- Transacciones con `prisma.$transaction(async (tx) => { ... })`
- Cast `as unknown as Record<string, unknown>` antes de `mapToEntity`

### Repository Impl
`src/infrastructure/repositories/sale.repository.impl.ts` (patrón)
- Recibe datasource en constructor
- Cada método delega directamente: `return this.datasource.methodName(...)`

### Controller
`src/presentation/sales/sale.controller.ts`
- Constructor recibe use cases como dependencias
- Métodos como arrow functions (`getAll = async ...`) para preservar `this`
- Patrón: DTO → error? → res.status(400) | execute use case
- `private handleError(error, res)` al final, captura `CustomError` o retorna 500

### Router
`src/presentation/sales/sale.router.ts`
- Clase con getter estático `routes(): Router`
- Instancia repositorios, use cases y servicios de dominio aquí (composition root)
- `router.use(middleware.validateJwt)` aplica JWT a todas las rutas del módulo
- Rutas con segmentos fijos (ej. `/client/:id`) van ANTES de `/:id`
- Composition root: instancia `InstallmentCalculatorService` y lo inyecta al use case

### Server
`src/presentation/server.ts`
- Registrar nueva ruta: `this.app.use('/api/nombre', NombreRouter.routes)`

### Index files a actualizar al crear módulo nuevo
```
src/domain/datasources/index.ts       — export { NombreDatasource }
src/domain/repositories/index.ts      — export { NombreRepository }
src/infrastructure/datasources/index.ts   — export { PrismaNombreDatasource }
src/infrastructure/repositories/index.ts  — export { NombreRepositoryImpl }
```

---

## Sales Module — Detalles de implementación

### Archivos creados
```
src/domain/dtos/sales/
  create-sale.dto.ts        — DTO con validación completa + detección de productos duplicados
  index.ts

src/domain/datasources/sale.datasource.ts   — Interface + tipo SaleCreateData (datos enriquecidos)
src/domain/repositories/sale.repository.ts  — Interface del repositorio

src/domain/use-cases/sales/
  create-sale.use-case.ts           — Orquesta validaciones y delega al repositorio
  get-sales.use-case.ts
  get-sale-by-id.use-case.ts
  get-sales-by-client.use-case.ts   — Valida que el cliente exista antes de consultar
  index.ts

src/infrastructure/datasources/prisma-sale.datasource.ts   — Transacción atómica
src/infrastructure/repositories/sale.repository.impl.ts

src/presentation/sales/
  sale.controller.ts
  sale.router.ts
```

### Lógica de negocio clave

**CreateSaleUseCase** — Valida en orden:
1. Cliente existe y está activo
2. Para ítems con `productId`: valida que el producto existe, está activo y tiene stock suficiente
3. Para ítems con `newProduct`: la validación de nombre y stock >= cantidad ya se hizo en el DTO; el use case pasa `newProduct` al repositorio para que lo cree en la transacción
4. Usa `dto.items[i].unitPrice` directamente (precio fijado por el vendedor al momento de la venta)
   - `basePrice = unitPrice` (sin distinción, ya que no hay recargo automático)
   - `appliedRule = null` (sin regla automática; el precio es manual)
   - `total = sum(unitPrice × quantity)`, calculado server-side para evitar manipulación
5. Si `type = CREDIT`: verifica `creditLimit - balance >= total`
6. Pasa datos enriquecidos (`SaleCreateData`) al repositorio incluyendo `collectionDay`/`collectionDay2` si se definieron

**PrismaSaleDatasource.create()** — Transacción `prisma.$transaction()`:
0. (Nuevo) Para ítems con `newProduct`: crea el producto con `tx.product.create()` y asigna el `id` resultante al ítem. Todo ocurre dentro de la transacción — si la venta falla, el producto no queda huérfano en el inventario
1. Descuenta stock de cada producto (`decrement`). Para productos nuevos, el stock declarado es el inicial y la venta resta la cantidad vendida
2. Si es CREDIT: incrementa `balance` del cliente (`increment`)
3. Crea `Sale` + `SaleItem[]` en un solo `create` anidado

**Status automático**: CASH → `PAID` | CREDIT → `PENDING`

**Routing**: `GET /client/:clientId` va antes de `GET /:id` para que Express no confunda "client" con un ID de venta.

---

## Payments Module — Detalles de implementación

### Archivos creados
```
src/domain/dtos/payments/
  create-payment.dto.ts     — Valida clientId, amount (>0, max 2 decimales), saleId?, note? (max 500 chars)
  index.ts

src/domain/datasources/payment.datasource.ts  — Interface + tipo PaymentCreateData
src/domain/repositories/payment.repository.ts — Interface del repositorio

src/domain/use-cases/payments/
  create-payment.use-case.ts           — Orquesta todas las validaciones de negocio
  get-payments.use-case.ts
  get-payment-by-id.use-case.ts
  get-payments-by-client.use-case.ts   — Valida que el cliente exista
  get-payments-by-sale.use-case.ts     — Valida que la venta exista
  index.ts

src/infrastructure/datasources/prisma-payment.datasource.ts  — Transacción atómica
src/infrastructure/repositories/payment.repository.impl.ts

src/presentation/payments/
  payment.controller.ts
  payment.router.ts
```

### Lógica de negocio clave

**CreatePaymentUseCase** — Valida en orden:
1. Cliente existe y está activo
2. `amount <= client.balance` (no se puede pagar más de lo que se debe)
3. Si hay `saleId`:
   - La venta existe
   - `sale.clientId === dto.clientId` (seguridad: evita que se asocie un pago a la venta de otro cliente)
   - La venta no está `PAID`
   - `amount <= (sale.total - totalYaPagado)` (no se puede sobrepagar una venta)
4. Pasa `saleTotal` al repositorio para que la transacción calcule el nuevo estado

**PrismaPaymentDatasource.create()** — Transacción `prisma.$transaction()`:
1. Crea el registro `Payment`
2. Decrementa `client.balance` en `amount`
3. Si hay `saleId`: hace `aggregate._sum.amount` de todos los pagos de esa venta (incluye el recién creado) y actualiza el status a `PARTIAL` o `PAID`

**Cálculo de status**: `totalPaid >= saleTotal` → `PAID` | de lo contrario → `PARTIAL`

**Routing**: `/client/:clientId` y `/sale/:saleId` van antes de `/:id` para evitar que Express confunda los segmentos con un ID de pago.

**PaymentCreateData**:
```typescript
{
  clientId: string;
  saleId: string | null;
  amount: number;
  note: string | null;
  saleTotal?: number; // Solo cuando saleId está presente
}
```

---

---

## AuditLog Module — Detalles de implementación

### Filosofía de diseño

El AuditLog es **solo de escritura desde las transacciones** y **solo de lectura desde la API**. No tiene endpoint de creación propio. Los registros se crean dentro de las transacciones atómicas de Sale y Payment, garantizando que si la operación principal falla, el log también se revierte.

### Archivos creados
```
src/domain/entities/audit-log.entity.ts
  — AuditLogEntity + AuditAction const enum { CREDIT_SALE, PAYMENT }

src/domain/datasources/audit-log.datasource.ts
  — AuditLogDatasource (solo findAll/findByClientId)
  — AuditLogData (tipo embebido en SaleCreateData y PaymentCreateData)

src/domain/repositories/audit-log.repository.ts

src/infrastructure/datasources/prisma-audit-log.datasource.ts
src/infrastructure/repositories/audit-log.repository.impl.ts

src/domain/use-cases/audit-logs/
  get-audit-logs.use-case.ts
  get-audit-logs-by-client.use-case.ts   — Valida que el cliente exista antes de consultar
  index.ts

src/presentation/audit-logs/
  audit-log.controller.ts
  audit-log.router.ts                    — JWT + ADMIN requerido en todas las rutas
```

### Archivos modificados
```
src/domain/datasources/sale.datasource.ts     — SaleCreateData ahora incluye auditLog? (opcional, solo CREDIT)
src/domain/datasources/payment.datasource.ts  — PaymentCreateData ahora incluye auditLog (siempre requerido)

src/infrastructure/datasources/prisma-sale.datasource.ts
  — Escribe tx.auditLog.create() dentro de la misma transacción, solo para ventas CREDIT

src/infrastructure/datasources/prisma-payment.datasource.ts
  — Escribe tx.auditLog.create() dentro de la misma transacción en todos los pagos

src/domain/use-cases/sales/create-sale.use-case.ts
  — execute(dto, userId, ip): calcula before/after y pasa auditLog a saleRepository.create()

src/domain/use-cases/payments/create-payment.use-case.ts
  — execute(dto, userId, ip): calcula before/after y pasa auditLog a paymentRepository.create()

src/presentation/sales/sale.controller.ts
  — Extrae req.user.id y req.ip, los pasa a createSaleUseCase.execute()

src/presentation/payments/payment.controller.ts
  — Extrae req.user.id y req.ip, los pasa a createPaymentUseCase.execute()

src/presentation/server.ts
  — Registra this.app.use('/api/audit-logs', AuditLogRouter.routes)
```

### Flujo de una escritura de AuditLog (ejemplo: pago)

1. `POST /api/payments` — el controller extrae `userId = req.user.id` e `ip = req.ip`
2. `CreatePaymentUseCase.execute(dto, userId, ip)` — calcula `before = client.balance`, `after = before - amount`
3. Llama a `paymentRepository.create({ ..., auditLog: { userId, action: 'PAYMENT', before, after, ip } })`
4. `PrismaPaymentDatasource.create()` dentro de `prisma.$transaction()`:
   - Crea el Payment
   - Decrementa client.balance
   - Crea el AuditLog
   - (si saleId) Recalcula status de la venta
5. Si cualquier paso falla → rollback total (pago + balance + auditLog)

### Seguridad

- Endpoints de lectura requieren JWT + rol ADMIN
- El IP se captura del request real (`req.ip`), no del body — no puede ser falsificado por el cliente
- El userId viene del token JWT verificado, no del body

---

## Pricing — Modelo manual (sin PricingService)

El precio de los productos **no se almacena en el catálogo**. El vendedor define el precio unitario de cada ítem en el momento de crear la venta.

### Decisión arquitectónica

- `Product.price` fue eliminado. El catálogo solo gestiona nombre, stock y disponibilidad.
- El antiguo `PricingService` (CashPricingStrategy, CreditPricingStrategy) y la env var `CREDIT_SURCHARGE_PERCENT` fueron eliminados.
- El `CreateSaleUseCase` recibe `unitPrice` por ítem desde el DTO, calcula `subtotal = unitPrice × quantity` y `total = sum(subtotales)` server-side.
- `SaleItem.basePrice = unitPrice` (precio registrado al momento de la venta). `SaleItem.appliedRule = null` (sin regla automática).

### Trazabilidad

`SaleItem.unitPrice` y `SaleItem.basePrice` persisten el precio cobrado en esa venta — inmutable para auditoría futura.

---

## Installment Calculator Domain Service

### Filosofía de diseño

El cálculo del monto de cuota es un **Domain Service** puro — no tiene dependencias externas, no consulta la base de datos, y su resultado es determinista. Reside en `src/domain/services/installments/`.

El `CreateSaleUseCase` lo recibe por inyección de dependencias con un valor por defecto (`= new InstallmentCalculatorService()`).

### Archivos
```
src/domain/services/installments/
  installment-calculator.service.ts   — Lógica: calculate(total, installmentsCount) → number
  index.ts
```

### Flujo de cuotas en CreateSaleUseCase

1. `CreateSaleDto.create()` valida `installmentsCount` (int ≥ 1) y `frequency` (MONTHLY | BIWEEKLY | WEEKLY)
   - Si el tipo es CASH y se envían campos de cuotas → `400 Bad Request`
   - Ambos campos son requeridos juntos — no se aceptan parcialmente
   - `installmentsCount = 1` es válido: cuota única = `total - initialPayment`
2. El use case suma `unitPrice × quantity` por ítem para obtener el total
3. Llama a `installmentCalculator.calculate(total, dto.installmentsCount)` → `installmentAmount`
4. Persiste `installmentsCount`, `frequency`, `installmentAmount` e `collectionDay`/`collectionDay2` en la tabla `Sale`

### Días de cobro (`collectionDay` / `collectionDay2`)

Opcionales. Solo válidos cuando hay plan de cuotas (`frequency` definida).

| Parámetro | Aplica a | Rango | Descripción |
|-----------|----------|-------|-------------|
| `collectionDay` | MONTHLY y BIWEEKLY | 1-31 | Día del mes para el cobro |
| `collectionDay` | WEEKLY | 1-7 | Día de la semana (1=lunes, 7=domingo) |
| `collectionDay2` | Solo BIWEEKLY | 1-31 | Segundo día de cobro del mes |

Reglas de validación:
- MONTHLY: solo `collectionDay` (1-31, día del mes)
- BIWEEKLY: ambos o ninguno (`collectionDay` y `collectionDay2`, 1-31)
- WEEKLY: solo `collectionDay` (1-7, día de la semana)
- No se pueden definir sin plan de cuotas

### Regla de redondeo

`installmentAmount = Math.round(((total - initialPayment) / installmentsCount) * 100) / 100`

Con `installmentsCount = 1`: `installmentAmount = total - initialPayment` (saldo completo en una sola cuota).

### Cálculo de cuotas pagadas (whatsappPayload)

`paidInstallments = (totalPaidSoFar - sale.initialPayment) / sale.installmentAmount`

La cuota inicial se almacena en `Sale.initialPayment` y se descuenta del numerador para que solo los pagos regulares cuenten. Sin este descuento, la cuota inicial inflaría el conteo de cuotas (bug previo). El campo `initialPayment` en `Sale` es la fuente de verdad — no se depende de filtrar pagos por `note`.

### Migrations
- `20260414000000_add_installments_to_sale` — Agrega `InstallmentFrequency` enum y 3 columnas nullable a `Sale`
- `20260414200000_remove_product_price_add_collection_days` — Elimina `Product.price`, agrega `collectionDay`/`collectionDay2` a `Sale`
- `20260424000000_add_weekly_installment_frequency` — Agrega `WEEKLY` al enum `InstallmentFrequency`

---

## Notifications Module — Detalles de implementación

### Filosofía de diseño

Las notificaciones son **side effects opcionales** de las operaciones financieras. Se implementan con **Domain Events** para desacoplarlas completamente de los use cases:
- Si Twilio o Gmail fallan → el pago/venta ya está commiteado. La notificación falla en silencio.
- Si las env vars no están → el servidor arranca normalmente con un warning. El feature queda deshabilitado.
- Los use cases no saben nada de WhatsApp ni email — solo emiten un evento.

### Archivos creados
```
src/domain/events/
  domain-event.ts               — Interfaz base { eventName, occurredOn, data }
  event-emitter.ts              — Puerto EventEmitterPort: on(event, handler), emit(event, data)
  payment-registered.event.ts   — Tipo PaymentRegisteredEvent + constante PAYMENT_REGISTERED
  credit-sale-created.event.ts  — Tipo CreditSaleCreatedEvent + constante CREDIT_SALE_CREATED
  index.ts

src/infrastructure/events/
  node-event-emitter.ts         — Implementación con EventEmitter de Node.js
                                   + globalEventEmitter (singleton compartido por todos los routers)
  index.ts

src/infrastructure/services/
  meta-whatsapp.service.ts      — Implementa NotificationService vía Meta Cloud API. Métodos: sendWhatsApp, sendTemplate, sendDocument, sendDocumentTemplate. Se deshabilita si faltan META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_NUMBER_ID.
  twilio-whatsapp.service.ts    — Implementa NotificationService (legacy, no usado en producción). sendDocument y sendDocumentTemplate retornan false con console.warn.
  nodemailer-email.service.ts   — Implementa EmailService. Se deshabilita si faltan env vars.

src/infrastructure/subscribers/
  payment-notification.subscriber.ts  — Escucha PaymentRegistered → WhatsApp (sin saldo) + Email (con detalle)
  sale-notification.subscriber.ts     — Escucha CreditSaleCreated → WhatsApp (sin saldo) + Email (con detalle)
  index.ts
```

### Archivos modificados
```
prisma/schema.prisma
  — Nuevo modelo NotificationLog (clientId, channel, event, status, errorMessage?, sentAt)
  — Relación NotificationLog[] en Client

src/domain/use-cases/payments/create-payment.use-case.ts
  — Recibe EventEmitterPort? (opcional) en el constructor
  — Emite PAYMENT_REGISTERED después de await paymentRepository.create()

src/domain/use-cases/sales/create-sale.use-case.ts
  — Recibe EventEmitterPort? (opcional) en el constructor
  — Emite CREDIT_SALE_CREATED después de await saleRepository.create() (solo ventas CREDIT)

src/presentation/payments/payment.router.ts
  — Instancia MetaWhatsAppService, NodemailerEmailService
  — Construye PaymentNotificationSubscriber (se auto-registra en globalEventEmitter)
  — Pasa globalEventEmitter a CreatePaymentUseCase

src/presentation/sales/sale.router.ts
  — Instancia MetaWhatsAppService, NodemailerEmailService
  — Construye SaleNotificationSubscriber (se auto-registra en globalEventEmitter)
  — Pasa globalEventEmitter a CreateSaleUseCase
```

### Migración
`20260408194544_add_notification_log` — Crea tabla `NotificationLog`

### Estado actual de WhatsApp: DORMIDO (envío manual via Deep Link)

El bloque de ejecución de `sendTemplate` y `sendDocumentTemplate` está **comentado** en los subscribers. El frontend usa `wa.me` Deep Links con el texto pre-armado por el backend.

**Qué cambió:**
- `PaymentNotificationSubscriber` y `SaleNotificationSubscriber`: bloques WhatsApp comentados. Email y NotificationLog siguen funcionando.
- `CreatePaymentUseCase.execute()` ahora retorna `{ payment, whatsappPayload }`.
- `CreateSaleUseCase.execute()` ahora retorna `{ sale, whatsappPayload }`.
- `whatsappPayload = { phone: string, message: string } | null` — null si el cliente no tiene teléfono o es venta CASH sin teléfono.
- Los controllers exponen `{ ...entity, whatsappPayload }` en el `201`.

**Para reactivar la API de Meta:** descomentar los bloques en ambos subscribers.

### Flujo completo (ejemplo: pago)

1. `POST /api/payments` — el controller llama a `createPaymentUseCase.execute(dto, userId, ip)`
2. El use case ejecuta la transacción atómica (pago + balance + auditLog)
3. **Después** del `await paymentRepository.create()` emite `eventEmitter.emit('PaymentRegistered', data)` y construye `whatsappPayload`
4. `PaymentNotificationSubscriber.handle()` recibe el evento de forma asíncrona
5. Verifica throttle (máx 3 notificaciones/cliente/hora — protección anti-loop)
6. Busca nombre/teléfono/email del cliente en DB
7. ~~Envía WhatsApp~~ (deshabilitado) + Envía Email con `Promise.allSettled`
8. Persiste cada intento en `NotificationLog` (SENT o FAILED con mensaje de error)
9. El response HTTP ya fue enviado al paso 2 — el email es 100% async

### Seguridad
- WhatsApp: envío manual desde frontend via `wa.me/{phone}?text={message}` — el backend pre-arma el texto
- Email incluye detalle completo (monto, nuevo saldo, nota, referencia)
- Throttle en memoria: máx 3 notificaciones/cliente/hora (evita cargos masivos en Twilio por bugs)
- Credenciales solo desde `envs` — nunca en logs ni en el código

### Variables de entorno
```
META_WHATSAPP_TOKEN           — System User Token permanente de Meta Business (permiso whatsapp_business_messaging)
META_WHATSAPP_PHONE_NUMBER_ID — ID numérico del número de teléfono en Meta Business Suite → WhatsApp → API Setup
MAILER_EMAIL                  — Cuenta Gmail: tucuenta@gmail.com
MAILER_SECRET_KEY             — App Password de 16 chars (Google Account → Security → App passwords)
MAILER_SERVICE                — gmail (default)
```

### Decisión técnica: Opción A — Buffers directos a Meta (sin URLs públicas)

**Decisión:** El PDF se genera en memoria (`Buffer`) y se sube directamente al endpoint `/media` de Meta Cloud API. Meta devuelve un `media_id` efímero que se referencia en el mensaje saliente. El archivo **nunca se expone por URL pública**.

**Motivación (mitigación IDOR):** Si el PDF se sirviera desde una URL pública con el `clientId` en el path, cualquier usuario con la URL podría acceder al estado de cuenta de otro cliente. Al usar `media_id` opaco de Meta, solo el número de WhatsApp registrado puede enviar ese documento — no hay superficie de ataque pública.

**Implementación:** `MetaWhatsAppService.uploadMedia(buffer, filename, mimeType)` — privado, con retry (1 reintento en 5xx, no reintenta en 4xx). Usado por `sendDocument()` y `sendDocumentTemplate()`.

**Alternativas descartadas:**
- **Opción B (URL pública temporal):** Subir a S3/Cloudinary con URL firmada de corta duración — más complejo, requiere infraestructura adicional.
- **Opción C (Twilio MMS):** Solo soportado en algunos países, no en Colombia.

---

## PDF Reports Module — Detalles de implementación

### Filosofía de diseño

La generación de PDF es un **Domain Service** con interfaz en el dominio e implementación en infraestructura. Esto permite:
- Cambiar PDFKit por Puppeteer u otra librería reescribiendo solo un archivo
- Testear el use case con un mock de `PdfService` sin instanciar PDFKit
- Adjuntar el PDF al email de notificación de pago sin tocar disco (Buffer en memoria)

### Archivos creados
```
src/domain/services/pdf.service.ts              — Reescrito: AccountStatementData + PdfService interface. Retorna Buffer.

src/domain/use-cases/reports/
  generate-account-statement.use-case.ts        — Orquesta: cliente + ventas + pagos + nombres de productos → llama PdfService
  index.ts

src/infrastructure/services/
  pdfkit-pdf.service.ts                         — Implementación completa con PDFKit: header, info cliente, barra de crédito,
                                                   tabla de ventas con sub-filas por ítem, tabla de pagos, resumen financiero, footer

src/presentation/reports/
  report.controller.ts                          — GET /:clientId → Buffer → Content-Type: application/pdf
  report.router.ts                              — JWT + ADMIN, composition root del PdfkitPdfService
```

### Archivos modificados
```
src/domain/services/email.service.ts
  — EmailAttachment ahora acepta content?: Buffer además de path?: string
  — Permite adjuntar PDFs generados en memoria sin guardar en disco

src/infrastructure/services/nodemailer-email.service.ts
  — Mapea EmailAttachment al formato de Nodemailer (content vs path)

src/infrastructure/services/index.ts
  — Exporta PdfkitPdfService

src/infrastructure/subscribers/payment-notification.subscriber.ts
  — Recibe GenerateAccountStatementUseCase? (opcional) en constructor
  — Genera el PDF después de registrar el pago y lo adjunta al email
  — Si falla la generación del PDF, continúa sin adjunto

src/presentation/payments/payment.router.ts
  — Instancia GenerateAccountStatementUseCase con PdfkitPdfService
  — Lo pasa al PaymentNotificationSubscriber

src/presentation/server.ts
  — Registra this.app.use('/api/reports', ReportRouter.routes)
```

### Dependencia añadida
```
pdfkit          — Generación de PDF en Node.js (sin binarios externos)
@types/pdfkit   — Tipos de TypeScript para PDFKit
```

### Contenido del PDF generado
1. **Header** — Nombre del negocio, fecha y hora de generación, usuario que lo generó
2. **Información del cliente** — Nombre, teléfono, email, ID
3. **Barra de uso de crédito** — Visual con porcentaje: verde (<50%), ámbar (50–80%), rojo (>80%)
4. **Tabla de ventas** — ID, fecha, tipo (Contado/Crédito), estado (color-coded), total. Sub-filas por ítem: producto, cantidad, precio unitario, subtotal
5. **Tabla de pagos** — ID, fecha, monto, nota, venta asociada
6. **Resumen financiero** — 3 recuadros: total ventas, total abonado, saldo pendiente
7. **Footer** — Fecha/hora exacta, marca "Confidencial"
8. **Paginación automática** — `ensureSpace()` agrega página nueva si no cabe la siguiente sección

### Flujo completo: PDF bajo demanda (endpoint)
```
GET /api/reports/account-statement/:clientId  (JWT + ADMIN)
  → GenerateAccountStatementUseCase.execute(clientId, user.name)
      → clientRepository.findById()
      → saleRepository.findByClientId() + paymentRepository.findByClientId() (paralelo)
      → productRepository.findById() por cada productId único (paralelo)
      → pdfService.generateAccountStatement(data)  →  Buffer
  → res.setHeader('Content-Type', 'application/pdf')
  → res.end(buffer)
```

### Flujo completo: PDF adjunto al email de pago
```
POST /api/payments
  → transacción commitada
  → eventEmitter.emit('PaymentRegistered', data)
  → PaymentNotificationSubscriber.handle()
      → accountStatementUseCase.execute(clientId, 'Sistema')  →  Buffer
      → emailService.sendEmail({ ..., attachments: [{ filename, content: buffer }] })
```

### Seguridad y robustez
- El PDF nunca se guarda en disco — se genera y transmite completamente en memoria
- Si falla la generación del PDF en el subscriber, el email se envía igualmente sin adjunto
- El endpoint retorna 404 si el cliente no existe, 403 si no es ADMIN

---

## Pagination, Filters & Search — Detalles de implementación

### Filosofía de diseño

Todos los endpoints `GET /` de listados soportan paginación y filtros opcionales vía `req.query`. Los DTOs son los únicos que tocan `req.query` — los use cases y repositorios solo reciben tipos del dominio.

### Archivos creados
```
src/domain/types/paginated.type.ts          — PaginatedResult<T> genérico

src/domain/dtos/shared/
  pagination.dto.ts                         — PaginationDto { page, limit } con defaults (1, 20), max limit 100
  index.ts

src/domain/dtos/clients/filter-clients.dto.ts    — search?, minBalance?, maxBalance?, hasDebt?
src/domain/dtos/products/filter-products.dto.ts  — search?, minPrice?, maxPrice?, minStock?, maxStock?
src/domain/dtos/sales/filter-sales.dto.ts        — clientId?, type?, status?, dateFrom?, dateTo?
src/domain/dtos/payments/filter-payments.dto.ts  — clientId?, saleId?, dateFrom?, dateTo?
src/domain/dtos/audit-logs/
  filter-audit-logs.dto.ts                  — clientId?, userId?, action?, dateFrom?, dateTo?
  index.ts
```

### Archivos modificados
```
— Datasource interfaces (5): findAll() ahora recibe PaginationDto + FilterXxxDto, retorna PaginatedResult<T>
— Repository interfaces (5): misma firma que datasources
— Prisma datasources (5): buildWhere() traduce DTOs → cláusula Prisma; findMany + count en Promise.all
— Repository impls (5): pasan parámetros directamente al datasource
— Use cases GetXxx (5): reciben PaginationDto + FilterXxxDto, retornan PaginatedResult<T>
— Controllers (5): parsean req.query → PaginationDto → FilterXxxDto → use case → res.json(result)
```

### PaginationDto — Getter `skip`
```typescript
get skip(): number { return (this.page - 1) * this.limit; }
```
El datasource usa `skip: pagination.skip, take: pagination.limit` directamente en Prisma.

### Response shape
```json
{
  "data": [...],
  "pagination": {
    "total": 47,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Query parameters por módulo

**Clientes** (`GET /api/clients`)
- `page`, `limit` — paginación
- `search` — búsqueda en name, phone, email (insensitive)
- `minBalance`, `maxBalance` — rango de saldo
- `hasDebt=true|false` — tiene saldo > 0

**Productos** (`GET /api/products`)
- `page`, `limit`
- `search` — búsqueda en name (insensitive)
- `minPrice`, `maxPrice` — rango de precio
- `minStock`, `maxStock` — rango de stock

**Ventas** (`GET /api/sales`)
- `page`, `limit`
- `clientId` — ventas de un cliente específico
- `type=CASH|CREDIT`
- `status=PAID|PENDING|PARTIAL`
- `dateFrom`, `dateTo` — rango de fechas ISO 8601 (dateTo es inclusivo, se ajusta a 23:59:59)

**Pagos** (`GET /api/payments`)
- `page`, `limit`
- `clientId` — pagos de un cliente
- `saleId` — pagos de una venta
- `dateFrom`, `dateTo` — rango de fechas ISO 8601

**Audit Logs** (`GET /api/audit-logs`)
- `page`, `limit`
- `clientId`, `userId` — filtros de entidad
- `action=CREDIT_SALE|PAYMENT`
- `dateFrom`, `dateTo` — rango de fechas ISO 8601

### Notas de implementación
- `buildWhere()` es una función local en cada Prisma datasource — traduce el DTO a `where` de Prisma
- `findMany` y `count` se ejecutan en **paralelo** con `Promise.all` (una sola ida a la BD)
- Los filtros de fecha son opcionales e independientes: puedes usar solo `dateFrom`, solo `dateTo`, o ambos
- `hasDebt=true` filtra `balance > 0`; `hasDebt=false` filtra `balance = 0`
- El `search` de clientes usa `OR` sobre name/phone/email; el de productos solo sobre name

---

## Update Sale — Detalles de implementación

### Endpoint
`PUT /api/sales/:id` — requiere ADMIN.

### Archivos creados
```
src/domain/dtos/sales/update-sale.dto.ts
  — Valida collectionDay? (1-31 | null), collectionDay2? (1-31 | null), createdAt? (ISO 8601)
  — Al menos un campo requerido

src/domain/use-cases/sales/update-sale.use-case.ts
  — findById de la venta (404 si no existe)
  — Valida que collectionDay2 solo se use en ventas BIWEEKLY
  — Llama saleRepository.update(id, { collectionDay, collectionDay2, createdAt })
```

### Archivos modificados
```
src/domain/datasources/sale.datasource.ts
  — Agrega SaleUpdateData { collectionDay?, collectionDay2?, createdAt? }
  — Agrega update(id, data: SaleUpdateData): Promise<SaleEntity> a la interface

src/domain/repositories/sale.repository.ts
  — Agrega update(id, data: SaleUpdateData): Promise<SaleEntity>

src/infrastructure/datasources/prisma-sale.datasource.ts
  — Implementa update(): prisma.sale.update con solo los campos proporcionados
  — En create(): pasa createdAt si el DTO lo incluye (permite registrar ventas backdated)

src/infrastructure/repositories/sale.repository.impl.ts
  — Delega update() al datasource

src/domain/dtos/sales/index.ts
  — Exporta UpdateSaleDto

src/domain/use-cases/sales/index.ts
  — Exporta UpdateSaleUseCase

src/presentation/sales/sale.controller.ts
  — Agrega UpdateSaleUseCase al constructor
  — Agrega handler update: parsea UpdateSaleDto, llama useCase.execute

src/presentation/sales/sale.router.ts
  — Agrega ruta PUT /:id con checkRole(Role.ADMIN)
```

### Qué actualiza / qué NO toca
- **Actualiza**: `collectionDay`, `collectionDay2`, `createdAt`
- **No toca**: `total`, `status`, `type`, `items`, `installmentsCount`, `frequency`, `installmentAmount`, `initialPayment`, `clientId`
- Los campos financieros solo cambian mediante pagos (transacciones atómicas con AuditLog)

---

## Custom Dates — Detalles de implementación

### Campo `createdAt` en creación de ventas y pagos

`POST /api/sales` y `POST /api/payments` aceptan el campo opcional `createdAt` (string ISO 8601).
Si no se provee, Prisma usa `@default(now())`. Si se provee, se pasa directamente al INSERT de Prisma.

**Flujo**: `req.body.createdAt` → DTO parsea a `Date` → use case lo pasa en el data → datasource lo incluye en el `create({ data: { ..., createdAt } })`.

`PUT /api/payments/:id` también acepta `createdAt` para corregir la fecha de un pago existente.

### Archivos modificados (campo createdAt)
```
src/domain/dtos/sales/create-sale.dto.ts          — agrega createdAt?: Date
src/domain/datasources/sale.datasource.ts          — agrega createdAt?: Date a SaleCreateData
src/infrastructure/datasources/prisma-sale.datasource.ts — pasa createdAt en sale.create()

src/domain/dtos/payments/create-payment.dto.ts     — agrega createdAt?: Date
src/domain/dtos/payments/update-payment.dto.ts     — agrega createdAt?: Date
src/domain/datasources/payment.datasource.ts       — agrega createdAt?: Date a PaymentCreateData y PaymentUpdateData
src/infrastructure/datasources/prisma-payment.datasource.ts — pasa createdAt en create() y update()
src/domain/use-cases/payments/create-payment.use-case.ts    — pasa dto.createdAt al repositorio
src/domain/use-cases/payments/update-payment.use-case.ts    — pasa dto.createdAt al repositorio
```

---

## Bug fix — Zona horaria en notify-client.use-case.ts

### Síntoma
A las 23:30 hora Colombia (UTC−5 = 04:30 UTC del día siguiente), `fmtDate` mostraba el día siguiente
porque usaba `date.getDate()` que opera en UTC, no en hora local de Bogotá.

### Fix
`src/domain/use-cases/clients/notify-client.use-case.ts` — `fmtDate` reescrita con `Intl.DateTimeFormat` y `timeZone: 'America/Bogota'`, igual que en `create-sale.use-case.ts` y `create-payment.use-case.ts`.

---

## Customer ↔ Client Link — Anti-Corruption Layer

### Principio de diseño (ClientLookupPort como ACL)

El bounded context `Customer` necesita saber el límite de crédito y saldo de su `Client` de Staff, pero NO puede importar `ClientRepository` ni `ClientEntity`. La solución es un puerto de dominio mínimo (`ClientLookupPort`) que expone únicamente el subconjunto de datos que el contexto Customer necesita.

```
Domain:         ClientLookupPort → ClientSummary { id, creditLimit, balance, isLinkedToCustomer }
Infrastructure: ClientLookupAdapter → implements ClientLookupPort
                  wraps: ClientRepository (→ PrismaClientDatasource)
                       + CustomerRepository (→ PrismaCustomerDatasource) [para isLinkedToCustomer]
```

La regla estructural se verifica automáticamente en `no-coupling.test.ts`: ningún archivo en `domain/use-cases/customer-auth/` ni `domain/dtos/customer-auth/` puede contener la cadena `client.repository` o `client.entity`.

### Archivos creados
```
src/domain/services/client-lookup.port.ts            — Interface ClientLookupPort + type ClientSummary
src/domain/dtos/customer-auth/claim-client.dto.ts    — Valida documentType (CC|CE) + documentNumber
src/domain/use-cases/customer-auth/claim-client.use-case.ts        — Claim business logic
src/domain/use-cases/customer-auth/get-customer-profile.use-case.ts — Profile with optional client
src/infrastructure/services/client-lookup.adapter.ts  — Implementa ClientLookupPort
src/domain/use-cases/customer-auth/claim-client.use-case.test.ts       — 10 tests
src/domain/use-cases/customer-auth/get-customer-profile.use-case.test.ts — 6 tests
src/domain/use-cases/customer-auth/no-coupling.test.ts                 — structural isolation guard
prisma/migrations/20260426000000_add_customer_client_link/migration.sql
```

### Archivos modificados
```
prisma/schema.prisma                                        — clientId String? @unique en Customer; customer Customer? en Client
src/domain/entities/customer.entity.ts                      — agrega clientId: string | null
src/domain/datasources/customer.datasource.ts               — agrega findByClientId + linkToClient
src/domain/repositories/customer.repository.ts              — agrega findByClientId + linkToClient
src/domain/datasources/client.datasource.ts                 — agrega findByDocument
src/domain/repositories/client.repository.ts                — agrega findByDocument
src/infrastructure/datasources/prisma-customer.datasource.ts — implementa findByClientId + linkToClient
src/infrastructure/datasources/prisma-client.datasource.ts   — implementa findByDocument
src/infrastructure/repositories/customer.repository.impl.ts  — delega nuevos métodos
src/infrastructure/repositories/client.repository.impl.ts    — delega findByDocument
src/infrastructure/services/index.ts                         — exporta ClientLookupAdapter
src/domain/services/index.ts                                 — exporta ClientLookupPort + ClientSummary
src/domain/dtos/customer-auth/index.ts                       — exporta ClaimClientDto
src/domain/use-cases/customer-auth/index.ts                  — exporta ClaimClientUseCase + GetCustomerProfileUseCase
src/presentation/customer-auth/customer-auth.controller.ts   — handlers claimClient + getProfile
src/presentation/customer-auth/customer-auth.router.ts       — rutas + composition root con ClientLookupAdapter
```

### ClaimClientUseCase — lógica de negocio
1. `clientLookupPort.findByDocument(documentType, documentNumber)` → 404 si no existe
2. Si `client.isLinkedToCustomer` → 409 (ya reclamado por otro customer)
3. `customerRepository.linkToClient(customerId, client.id)` — actualiza `Customer.clientId`
4. Retorna `{ ...clientSummary, isLinkedToCustomer: true }`

Match estricto: documentType + documentNumber exactos. No matchea por phone ni email.

### isLinkedToCustomer — cómo se calcula
`ClientLookupAdapter.toSummary()` llama a `customerRepository.findByClientId(client.id)`. Si retorna un Customer, el campo es `true`. Este lookup usa el índice `@unique` sobre `Customer.clientId` → O(1).

---

## Lo que falta implementar

1. **Tests** — Faltan tests para Users, Clients, Products, AuditLogs, NotifyClientUseCase, UpdatePaymentUseCase, DeletePaymentUseCase, UpdateSaleUseCase y DeleteSaleUseCase. Auth, Sales, Payments, Notification Subscribers, PDF use case y Customer Auth ya tienen tests (216 en total).
2. **Tests de MetaWhatsAppService** — `uploadMedia`, `sendDocumentTemplate`, retry logic y formatPhone no tienen tests unitarios aún.
3. **Tests inline product creation** — Los tests de `CreateSaleUseCase` cubren el flujo de productos existentes. Faltan casos para `newProduct` inline (nombre duplicado, stock < cantidad, flujo exitoso con producto nuevo).
4. **Tests ClientNotifySubscriber** — El subscriber existe pero no tiene tests. Cubre el mismo patrón que `PaymentNotificationSubscriber`.
5. **Tests para fechas custom** — Faltan tests para el campo `createdAt` en CreateSaleDto, CreatePaymentDto, UpdatePaymentDto y UpdateSaleUseCase.
6. **Tests Customer CRUD** — Los nuevos use cases `UpdateCustomerUseCase`, `ResetCustomerPasswordUseCase`, `ForgotCustomerPasswordUseCase`, `ChangeCustomerPasswordUseCase` y `GetCustomersUseCase` no tienen tests aún.

## Delete Sale — Detalles de implementación

### Endpoint
`DELETE /api/sales/:id` — requiere ADMIN.

### Regla de negocio principal
Solo se pueden eliminar ventas **sin pagos registrados**. Esta restricción evita ajustes complejos de balance en cascada y garantiza un invariante simple: si existe algún pago para la venta, la operación falla con `400` y el admin debe eliminar los pagos primero (usando `DELETE /api/payments/:id`).

### Archivos creados
```
src/domain/use-cases/sales/delete-sale.use-case.ts
  — Busca la venta (404 si no existe)
  — Verifica que no existen pagos vía paymentRepository.findBySaleId() (400 si hay pagos)
  — Si CREDIT: busca el cliente para calcular before/after del balance
  — Construye AuditLogData con action: SALE_DELETED (solo CREDIT)
  — Llama saleRepository.delete(id, { items, clientId, total, type, auditLog? })
```

### Archivos modificados
```
src/domain/entities/audit-log.entity.ts
  — Agrega SALE_DELETED: 'SALE_DELETED' al const AuditAction

src/domain/datasources/sale.datasource.ts
  — Agrega SaleDeleteData { items, clientId, total, type, auditLog? }
  — Agrega delete(id, data: SaleDeleteData): Promise<SaleEntity> a la interface

src/domain/repositories/sale.repository.ts
  — Agrega delete(id, data: SaleDeleteData): Promise<SaleEntity>

src/domain/use-cases/sales/index.ts
  — Exporta DeleteSaleUseCase

src/infrastructure/datasources/prisma-sale.datasource.ts
  — Implementa delete() con transacción atómica:
    1. Para cada ítem: increment stock del producto
    2. Si CREDIT: decrement balance del cliente + tx.auditLog.create con SALE_DELETED
    3. Captura la venta (con ítems) antes de eliminarla para retornarla al caller
    4. tx.saleItem.deleteMany({ where: { saleId: id } })
    5. tx.sale.delete({ where: { id } })

src/infrastructure/repositories/sale.repository.impl.ts
  — Delega delete() al datasource

src/presentation/sales/sale.controller.ts
  — Agrega DeleteSaleUseCase al constructor
  — Agrega handler delete: extrae user.id e ip, llama execute

src/presentation/sales/sale.router.ts
  — Agrega DeleteSaleUseCase importado y construido
  — Agrega ruta DELETE /:id con checkRole(Role.ADMIN)
```

### Balance math al eliminar
```
// Solo aplica a ventas CREDIT:
before = client.balance          // saldo actual del cliente
after  = before - sale.total     // revertir el incremento original de la venta

// Ejemplo: cliente debe 1000 (venta CREDIT de 1000 sin pagos)
// before = 1000, after = 0
```

### Restauración de stock
Para cada `SaleItem` de la venta se ejecuta:
```
tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
```
Aplica tanto a ventas CASH como CREDIT.

### AuditLog generado (solo CREDIT)
- `action: 'SALE_DELETED'`
- `before`: balance del cliente antes de la eliminación
- `after`: balance del cliente después de la eliminación (= before - sale.total)
- `userId`, `ip`: del request autenticado

---

## Bug conocido — Búsqueda de productos (frontend)

El backend de búsqueda de productos está implementado correctamente:
- `GET /api/products?search=nombre` usa `mode: 'insensitive'` en Prisma (case-insensitive contains)
- La `FilterProductsDto` valida y propaga el parámetro `search`
- El bug reportado ("toca seleccionar de una lista, el producto no aparece al buscar") es del **frontend**: el componente de selección de productos probablemente no realiza llamadas a la API al escribir, sino que filtra localmente sobre una lista pre-cargada que puede estar desactualizada o vacía.

---

## Infraestructura de Producción — Bloque 2

### Health Check

`GET /health` — público, sin auth, usado por load balancers y Kubernetes.

```
Archivos:
  src/presentation/health/health.router.ts   — Router con SELECT 1 via Prisma
```

**Respuestas:**
- `200 OK` — `{ status: 'ok', database: 'connected', uptime: <segundos> }`
- `503 Service Unavailable` — `{ status: 'error', database: 'disconnected' }` (si Prisma lanza excepción)

**Nota**: La ruta se registra ANTES de las rutas `/api/*` en `server.ts` para que no pase por ningún middleware de autenticación.

---

### Logger Service

Abstracción de logging con interfaz en dominio e implementación Pino en infraestructura.

```
src/domain/services/logger.service.ts               — Interface LoggerService { info, warn, error, debug }
src/infrastructure/services/pino-logger.service.ts  — PinoLoggerService + globalLogger singleton
```

**Comportamiento por entorno:**
- `NODE_ENV !== 'production'`: pretty-print con colores (pino-pretty), nivel `debug`
- `NODE_ENV === 'production'`: JSON estructurado con timestamp ISO, nivel `info`

**Patrón de inyección** (igual que EmailService):
```typescript
constructor(
  private readonly someRepo: SomeRepository,
  private readonly logger?: LoggerService,   // opcional — tests no lo necesitan
) {}

// Uso:
this.logger?.info('Operación completada', { clientId, amount });
this.logger?.error('Fallo al procesar', error, { context: 'CreateSale' });
```

**globalLogger**: singleton compartido importado desde `infrastructure/services/pino-logger.service`.
Se inyecta en `Server` desde `app.ts`. Para inyectar en use cases nuevos, importarlo en el router correspondiente (composition root).

**Dependencias instaladas:**
- `pino` (producción)
- `pino-pretty` (devDependency, solo desarrollo)

---

### Dockerfile Multi-Stage

```
Dockerfile        — Build en 2 stages: builder (npm ci + prisma generate + tsc) y production (imagen mínima)
.dockerignore     — Excluye node_modules, dist, .env, coverage, .git
```

**Stage builder** (`node:20-alpine AS builder`):
1. `npm ci` — instalación reproducible desde lockfile
2. `npx prisma generate` — genera el client para linux-musl (Alpine)
3. `npm run build` — compila TypeScript → `dist/`

**Stage production** (`node:20-alpine AS production`):
- Copia solo: `dist/`, `node_modules/`, `prisma/`, `package.json`
- Usuario no-root: `appuser:appgroup`
- `HEALTHCHECK` Docker nativo apuntando a `GET /health`
- `CMD`: `npx prisma migrate deploy && node dist/app.js`

**Build y ejecución:**
```bash
docker build -t credit-management-system .
docker run -p 3000:3000 --env-file .env credit-management-system
```

---

## Client Notify — Detalles de implementación

### Endpoint
`POST /api/clients/:id/notify` — cualquier usuario autenticado (sin restricción de rol).

### Archivos creados
```
src/domain/events/client-notify-requested.event.ts
  — ClientNotifyRequestedData { clientId, requestedBy }
  — CLIENT_NOTIFY_REQUESTED constante

src/domain/use-cases/clients/notify-client.use-case.ts
  — Busca el cliente (404 si no existe o inactivo)
  — Si hay SaleRepository + PaymentRepository inyectados: busca la venta CREDIT activa (PENDING/PARTIAL con installmentsCount != null, la más reciente) y calcula cuotas pagadas
  — Mensaje con plan de cuotas: crédito No.X, fecha inicial, valor del crédito, cuota inicial (si aplica), cuotas pagadas / total, saldo actual
  — Mensaje sin plan (fallback): balance y cupo disponible en formato COP
  — Números formateados con Intl.NumberFormat('es-CO') — puntos como separador de miles, coma decimal, sin símbolo $
  — Emite CLIENT_NOTIFY_REQUESTED asíncronamente (sin await)
  — Retorna { whatsappPayload } de forma síncrona — no espera el email

src/infrastructure/subscribers/client-notify.subscriber.ts
  — Escucha CLIENT_NOTIFY_REQUESTED
  — Genera PDF vía GenerateAccountStatementUseCase
  — Envía email con PDF adjunto vía EmailService
  — Persiste intento en NotificationLog (SENT / FAILED)
  — Todos los errores se capturan — nunca afectan la respuesta HTTP
```

### Archivos modificados
```
src/domain/events/index.ts
  — Exporta ClientNotifyRequestedEvent, ClientNotifyRequestedData, CLIENT_NOTIFY_REQUESTED

src/domain/use-cases/clients/index.ts
  — Exporta NotifyClientUseCase

src/infrastructure/subscribers/index.ts
  — Exporta ClientNotifySubscriber

src/presentation/clients/client.controller.ts
  — Agrega NotifyClientUseCase al constructor
  — Agrega handler notify: extrae user.name del JWT, llama useCase.execute(id, user.name)

src/presentation/clients/client.router.ts
  — Instancia GenerateAccountStatementUseCase (con todos sus repos + PdfkitPdfService)
  — Instancia ClientNotifySubscriber (auto-registro en globalEventEmitter)
  — Instancia NotifyClientUseCase con clientRepository + globalEventEmitter + saleRepository + paymentRepository
  — Agrega ruta POST /:id/notify
```

### Flujo completo
1. `POST /api/clients/:id/notify`
2. `NotifyClientUseCase.execute(clientId, requestedBy)`:
   - Valida cliente (404 si no existe)
   - Busca ventas CREDIT activas del cliente (PENDING/PARTIAL con `installmentsCount != null`), ordena por fecha descendente, toma la primera
   - Si hay venta activa: suma pagos (`paymentRepository.findByClientId`) y calcula `paidInstallments = Math.max(0, (totalPaid - initialPayment) / installmentAmount)`
   - Construye mensaje con detalle de cuotas o fallback de balance, en formato COP sin símbolo `$`
   - `eventEmitter.emit(CLIENT_NOTIFY_REQUESTED, { clientId, requestedBy })` — no await
   - Retorna `{ whatsappPayload }` inmediatamente
3. Response `200` ya enviado al cliente HTTP
4. `ClientNotifySubscriber.handle()` ejecuta asíncronamente:
   - Busca cliente en DB
   - Genera PDF vía `GenerateAccountStatementUseCase.execute(clientId, requestedBy)`
   - Envía email con PDF adjunto
   - Persiste en `NotificationLog`

---

## Update Payment — Detalles de implementación

### Endpoint
`PUT /api/payments/:id` — requiere ADMIN.

### Archivos creados
```
src/domain/dtos/payments/update-payment.dto.ts
  — Valida amount? (>0, max 2 decimales) y note? (string | null, max 500 chars)
  — Al menos un campo requerido; retorna [error?, UpdatePaymentDto?]

src/domain/use-cases/payments/update-payment.use-case.ts
  — findById del pago (404 si no existe)
  — Si amount cambia: verifica newClientBalance = balance + oldAmount - newAmount >= 0
  — Si saleId + amount: verifica otherPayments + newAmount <= saleTotal
  — Construye AuditLogData con action: PAYMENT_MODIFIED, before = balance, after = newClientBalance
  — Llama paymentRepository.update(id, { amount, note, saleTotal, auditLog })
```

### Archivos modificados
```
src/domain/entities/audit-log.entity.ts
  — Agrega PAYMENT_MODIFIED: 'PAYMENT_MODIFIED' al const AuditAction

src/domain/datasources/payment.datasource.ts
  — Agrega PaymentUpdateData { amount?, note?, saleTotal?, auditLog? }
  — Agrega update(id, data): Promise<PaymentEntity> a la interface

src/domain/repositories/payment.repository.ts
  — Agrega update(id, data: PaymentUpdateData): Promise<PaymentEntity>

src/domain/dtos/payments/index.ts
  — Exporta UpdatePaymentDto

src/domain/use-cases/payments/index.ts
  — Exporta UpdatePaymentUseCase

src/infrastructure/datasources/prisma-payment.datasource.ts
  — Implementa update() con transacción atómica:
    1. Actualiza payment (amount, note)
    2. Si amount cambió: aplica delta al balance del cliente (increment: delta)
    3. Si amount cambió: crea AuditLog con PAYMENT_MODIFIED
    4. Si saleId + saleTotal: recalcula status con aggregate._sum.amount

src/infrastructure/repositories/payment.repository.impl.ts
  — Delega update() al datasource

src/presentation/payments/payment.controller.ts
  — Agrega UpdatePaymentUseCase al constructor
  — Agrega handler update: parsea UpdatePaymentDto, extrae user.id e ip, llama execute

src/presentation/payments/payment.router.ts
  — Agrega UpdatePaymentUseCase importado y construido
  — Agrega ruta PUT /:id con checkRole(Role.ADMIN)

src/domain/use-cases/payments/create-payment.use-case.test.ts
  — Agrega update: jest.fn() al mockPaymentRepo (satisface la interface actualizada)

src/domain/use-cases/reports/generate-account-statement.use-case.test.ts
  — Agrega update: jest.fn() al mockPaymentRepo (satisface la interface actualizada)
```

### Delta math
```
delta = oldPayment.amount - newAmount
newClientBalance = client.balance + delta

// Ejemplos:
// Pago era 100, nuevo 75  → delta = +25 → balance sube 25 (cliente debe más)
// Pago era 100, nuevo 150 → delta = -50 → balance baja 50 (cliente debe menos)
```

### Recálculo de status de venta
Dentro de la transacción, después de actualizar el pago, se hace `aggregate._sum.amount` de todos los pagos de esa venta. Si `totalPaid >= saleTotal` → `PAID`; si `totalPaid > 0` → `PARTIAL`; si no → `PENDING`.

### AuditLog generado
- `action: 'PAYMENT_MODIFIED'`
- `before`: balance del cliente antes del ajuste
- `after`: balance del cliente después del ajuste (= before + delta)
- `userId`, `ip`: del request autenticado

---

## Delete Payment — Detalles de implementación

### Endpoint
`DELETE /api/payments/:id` — requiere ADMIN.

### Archivos creados
```
src/domain/use-cases/payments/delete-payment.use-case.ts
  — findById del pago (404 si no existe)
  — findById del cliente asociado (404 defensivo si el cliente fue eliminado)
  — Si saleId: obtiene sale.total para pasarlo al repositorio
  — Construye AuditLogData con action: PAYMENT_DELETED, before = balance, after = before + amount
  — Llama paymentRepository.delete(id, { saleTotal?, auditLog })
```

### Archivos modificados
```
src/domain/entities/audit-log.entity.ts
  — Agrega PAYMENT_DELETED: 'PAYMENT_DELETED' al const AuditAction

src/domain/datasources/payment.datasource.ts
  — Agrega PaymentDeleteData { saleTotal?, auditLog: AuditLogData }
  — Agrega delete(id, data: PaymentDeleteData): Promise<PaymentEntity> a la interface

src/domain/repositories/payment.repository.ts
  — Agrega delete(id, data: PaymentDeleteData): Promise<PaymentEntity>

src/domain/use-cases/payments/index.ts
  — Exporta DeletePaymentUseCase

src/infrastructure/datasources/prisma-payment.datasource.ts
  — Implementa delete() con transacción atómica:
    1. Busca el pago existente (404 si no existe)
    2. tx.payment.delete({ where: { id } })
    3. tx.client.update — incrementa balance en el monto del pago eliminado
    4. tx.auditLog.create con PAYMENT_DELETED
    5. Si saleId + saleTotal: aggregate._sum.amount → recalcula status de venta (PENDING/PARTIAL/PAID)

src/infrastructure/repositories/payment.repository.impl.ts
  — Delega delete() al datasource

src/presentation/payments/payment.controller.ts
  — Agrega DeletePaymentUseCase al constructor
  — Agrega handler delete: extrae user.id e ip, llama execute

src/presentation/payments/payment.router.ts
  — Agrega DeletePaymentUseCase importado y construido
  — Agrega ruta DELETE /:id con checkRole(Role.ADMIN)

src/domain/use-cases/payments/create-payment.use-case.test.ts
  — Agrega delete: jest.fn() al mockPaymentRepo (satisface la interface actualizada)

src/domain/use-cases/reports/generate-account-statement.use-case.test.ts
  — Agrega delete: jest.fn() al mockPaymentRepo (satisface la interface actualizada)
```

### Balance math al eliminar
```
before = client.balance          // saldo actual
after  = before + payment.amount // restaurar lo que el pago había decrementado

// Ejemplo: cliente debe 200, se elimina un pago de 100
// before = 200, after = 300 (vuelve a deber 300)
```

### Recálculo de status de venta
Dentro de la transacción, después de eliminar el pago, se hace `aggregate._sum.amount` de los pagos restantes de esa venta. Si `totalPaid >= saleTotal` → `PAID`; si `totalPaid > 0` → `PARTIAL`; si no → `PENDING`.

### AuditLog generado
- `action: 'PAYMENT_DELETED'`
- `before`: balance del cliente antes de la eliminación
- `after`: balance del cliente después de la eliminación (= before + monto eliminado)
- `userId`, `ip`: del request autenticado

---

## Customer Auth Module — Detalles de implementación

### Principio de diseño (Opción B — Bounded Context aislado)

`Customer` es un contexto E-commerce completamente separado del contexto Staff (User/Client). No comparten entidades, repositorios ni use cases. La única dependencia cruzada permitida es:
- `src/config/regular-exp.ts` — regex puras sin semántica de dominio
- El patrón Clean Architecture (DTOs, use cases, etc.) que es una convención de implementación, no un acoplamiento de dominio

### Archivos creados
```
prisma/migrations/20260425000000_add_customer/migration.sql
  — CREATE TABLE Customer con índice único en email

src/domain/entities/customer.entity.ts
  — CustomerEntity: id, name, email, password, phone, emailVerifiedAt?, isActive, createdAt, updatedAt
  — toJSON() omite password; fromObject() valida campos obligatorios

src/domain/datasources/customer.datasource.ts
  — CustomerDatasource interface: findByEmail, findById, create
  — CustomerCreateData: name, email, password (ya hasheado), phone

src/domain/repositories/customer.repository.ts
  — CustomerRepository interface (espejo de CustomerDatasource)

src/domain/services/customer-jwt.service.ts
  — CustomerJwtService interface: generateToken, verifyToken
  — Interface propia (no reusa JwtService de Staff) — isolación de bounded context

src/domain/dtos/customer-auth/
  register-customer.dto.ts   — name (≥2 chars), email (regex), strongPassword, phone (≥7 chars)
  login-customer.dto.ts      — email, password
  index.ts

src/domain/use-cases/customer-auth/
  register-customer.use-case.ts      — findByEmail → 409 si existe; bcrypt.hash; create; generateToken
  login-customer.use-case.ts         — Anti-enumeration: mismo 401 para email inexistente/inactivo/password incorrecta
  renew-customer-token.use-case.ts   — findById → 401 si no existe/inactivo; generateToken
  index.ts

src/infrastructure/datasources/prisma-customer.datasource.ts
  — PrismaCustomerDatasource: usa prisma.customer (tabla Customer en la BD)

src/infrastructure/repositories/customer.repository.impl.ts
  — CustomerRepositoryImpl: delega al datasource

src/infrastructure/services/customer-jwt.adapter.ts
  — CustomerJwtAdapter: usa JWT_CUSTOMER_SECRET + audience:'customer' en jwt.sign/verify
  — Si JWT_CUSTOMER_SECRET está vacío: generateToken lanza CustomError 500, verifyToken retorna null

src/presentation/middlewares/customer-auth.middleware.ts
  — CustomerAuthMiddleware.validateCustomerJwt: Bearer token → verifyToken → findById → req.customer
  — NUNCA llama a staffAuthRepository — usa CustomerRepository propio

src/presentation/customer-auth/
  customer-auth.controller.ts   — register (201), login (200), renewToken (200); req.customer tipado
  customer-auth.router.ts       — Composition root; rate limit en /register y /login

src/domain/use-cases/customer-auth/ (tests)
  register-customer.use-case.test.ts   — 13 tests
  login-customer.use-case.test.ts      — 8 tests
  jwt-isolation.test.ts                — 6 tests (mutualidad + sin-secret)
```

### Archivos modificados
```
prisma/schema.prisma                         — nuevo modelo Customer
src/config/envs.ts                           — jwtCustomerSecret, jwtCustomerExpiresIn (opcionales)
src/domain/entities/index.ts                 — export CustomerEntity
src/domain/datasources/index.ts              — export CustomerDatasource, CustomerCreateData
src/domain/repositories/index.ts             — export CustomerRepository
src/domain/services/index.ts                 — export CustomerJwtService
src/infrastructure/datasources/index.ts      — export PrismaCustomerDatasource
src/infrastructure/repositories/index.ts     — export CustomerRepositoryImpl
src/infrastructure/services/index.ts         — export CustomerJwtAdapter
src/presentation/middlewares/index.ts        — export CustomerAuthMiddleware
src/presentation/server.ts                   — app.use('/api/customer-auth', CustomerAuthRouter.routes)
.env.template                                — JWT_CUSTOMER_SECRET, JWT_CUSTOMER_EXPIRES_IN
```

### JWT Isolation — por qué funciona

| Token firmado por | Secret | Audience option | Validado por staff adapter | Validado por customer adapter |
|---|---|---|---|---|
| `JwtAdapter` (staff) | `JWT_SECRET` | ninguna | ✅ | ❌ (secret diferente + audience check falla) |
| `CustomerJwtAdapter` | `JWT_CUSTOMER_SECRET` | `audience:'customer'` | ❌ (secret diferente) | ✅ |

El aislamiento tiene dos capas: secretos diferentes Y la opción `audience` del estándar JWT. Si alguien intentara reusar un token de staff en un endpoint de customer, `jwt.verify` rechazaría por secreto incorrecto. Y viceversa.

### Variables de entorno
```
JWT_CUSTOMER_SECRET    — Requerida para customer auth. Si falta: console.warn, generateToken retorna 500.
JWT_CUSTOMER_EXPIRES_IN — Opcional, default '7d'
```

### cURL para probar
```bash
# Registro
curl -X POST http://localhost:3000/api/customer-auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana García","email":"ana@example.com","password":"Secret1!","phone":"+573001234567"}'

# Login
curl -X POST http://localhost:3000/api/customer-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"Secret1!"}'

# Renovar token (reemplaza TOKEN con el token del login)
curl -X POST http://localhost:3000/api/customer-auth/renew \
  -H "Authorization: Bearer TOKEN"

# Verificar aislamiento: token de customer rechazado por endpoint de staff
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
# Espera: 401 Token inválido o expirado

# Password débil → 400
curl -X POST http://localhost:3000/api/customer-auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"weak","phone":"3001234567"}'
# Espera: 400 con error de validación

# Claim client (reemplaza CUSTOMER_TOKEN con token de customer)
curl -X POST http://localhost:3000/api/customer-auth/claim-client \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentType":"CC","documentNumber":"12345678"}'

# Get profile
curl http://localhost:3000/api/customer-auth/me \
  -H "Authorization: Bearer CUSTOMER_TOKEN"

# Forgot password (siempre 200, anti-enumeration)
curl -X POST http://localhost:3000/api/customer-auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com"}'

# Change password (customer JWT)
curl -X PATCH http://localhost:3000/api/customer-auth/change-password \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"Secret1!","newPassword":"NewPass2@"}'

# Admin: list customers (staff JWT + ADMIN)
curl "http://localhost:3000/api/customer-auth?search=ana&page=1&limit=20" \
  -H "Authorization: Bearer STAFF_TOKEN"

# Admin: update customer
curl -X PATCH http://localhost:3000/api/customer-auth/CUSTOMER_ID \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Actualizada","isActive":true}'

# Admin: reset customer password (envía contraseña temporal por email)
curl -X POST http://localhost:3000/api/customer-auth/CUSTOMER_ID/reset-password \
  -H "Authorization: Bearer STAFF_TOKEN"
```

---

## Customer CRUD — Bloque 2 (Password Management + Admin CRUD)

### Filosofía de diseño

El flujo de recuperación de contraseña usa **Domain Events** para enviar el email de contraseña temporal de forma asíncrona — igual que el patrón de notificaciones de pagos. La contraseña temporal **nunca se expone en el response HTTP**; siempre viaja por email. El campo `mustChangePassword` en la entidad Customer es la señal para que el frontend fuerce el cambio.

### Archivos creados
```
prisma/migrations/20260426000000_add_customer_client_link/migration.sql
  — clientId String? @unique con FK → Client (ON DELETE SET NULL)

prisma/migrations/20260426100000_add_customer_must_change_password/migration.sql
  — mustChangePassword Boolean NOT NULL DEFAULT false

src/domain/events/customer-password-reset.event.ts
  — CUSTOMER_PASSWORD_RESET constante + CustomerPasswordResetData { customerId, customerEmail, customerName, tempPassword }

src/domain/dtos/customer-auth/update-customer.dto.ts
  — name?, email?, phone?, isActive? — al menos un campo

src/domain/dtos/customer-auth/change-password.dto.ts
  — currentPassword, newPassword (strongPassword), deben ser distintas

src/domain/dtos/customer-auth/forgot-password.dto.ts
  — email (validado con regex)

src/domain/dtos/customer-auth/filter-customers.dto.ts
  — search?, isActive? (boolean parseado de string)

src/domain/use-cases/customer-auth/update-customer.use-case.ts
  — Requiere Customer JWT (o admin). findById → 404, update → retorna CustomerEntity actualizado

src/domain/use-cases/customer-auth/reset-customer-password.use-case.ts
  — Admin: findById → 404 si no existe; genera contraseña temporal via generateTempPassword();
  — bcrypt.hash; updatePassword(id, hash, mustChangePassword=true); emite CUSTOMER_PASSWORD_RESET

src/domain/use-cases/customer-auth/forgot-customer-password.use-case.ts
  — Público, anti-enumeration: findByEmail → si no existe o inactivo, retorna sin hacer nada (mismo 200)
  — Si existe: igual que reset pero iniciado por el propio customer

src/domain/use-cases/customer-auth/change-customer-password.use-case.ts
  — Customer JWT: findById → 401; bcrypt.compare(currentPassword) → 401 si falla
  — bcrypt.hash(newPassword); updatePassword(id, hash, mustChangePassword=false)

src/domain/use-cases/customer-auth/get-customers.use-case.ts
  — Admin: customerRepository.findAll(pagination, filters) → PaginatedResult<CustomerEntity>

src/infrastructure/subscribers/customer-password-reset.subscriber.ts
  — Escucha CUSTOMER_PASSWORD_RESET; envía email con contraseña temporal via emailService.sendEmail()
  — Todos los errores capturados — nunca afectan la respuesta HTTP
```

### Archivos modificados
```
prisma/schema.prisma
  — mustChangePassword Boolean @default(false) en Customer
  — clientId String? @unique con relación a Client

src/domain/entities/customer.entity.ts
  — Constructor ahora tiene 11 args: añade clientId (arg 8) y mustChangePassword (arg 9)
  — toJSON() incluye clientId y mustChangePassword (excluye password)

src/domain/datasources/customer.datasource.ts
  — CustomerUpdateData { name?, email?, phone?, isActive? }
  — FilterCustomersData { search?, isActive? }
  — Nuevos métodos: findAll(pagination, filters), update(id, data), updatePassword(id, hash, mustChangePassword)

src/domain/repositories/customer.repository.ts
  — Replica los nuevos métodos de CustomerDatasource

src/infrastructure/datasources/prisma-customer.datasource.ts
  — findAll() con buildWhere() (OR search sobre name/email/phone + isActive filter) + Promise.all([findMany, count])
  — update() con spread de solo campos definidos (undefined excluido)
  — updatePassword() actualiza password + mustChangePassword en un solo update

src/domain/dtos/customer-auth/index.ts
  — Exporta UpdateCustomerDto, ChangePasswordDto, ForgotPasswordDto, FilterCustomersDto

src/domain/use-cases/customer-auth/index.ts
  — Exporta todos los nuevos use cases

src/domain/events/index.ts
  — Exporta CUSTOMER_PASSWORD_RESET + CustomerPasswordResetData

src/infrastructure/services/index.ts
  — Exporta CustomerPasswordResetSubscriber (si aplica)

src/presentation/customer-auth/customer-auth.controller.ts
  — Handlers: update, resetPassword, forgotPassword, changePassword, getCustomers

src/presentation/customer-auth/customer-auth.router.ts
  — Orden crítico de rutas (static antes de dynamic):
    1. POST /register, /login, /forgot-password  → público, rate-limited
    2. POST /renew, /claim-client, PATCH /change-password, GET /me  → Customer JWT
    3. GET /, PATCH /:id, POST /:id/reset-password  → Staff JWT + ADMIN
  — Instancia PrismaAuthDatasource + AuthRepositoryImpl + JwtAdapter + AuthMiddleware para rutas admin
  — Instancia CustomerPasswordResetSubscriber con globalEventEmitter + emailService
```

### generateTempPassword() — generación segura
```typescript
function generateTempPassword(): string {
  const hex = randomBytes(4).toString('hex'); // 8 chars hex lowercase
  const num = (randomBytes(1)[0] % 9) + 1;   // dígito 1-9 (nunca 0)
  return `Tmp${hex}${num}!`;                  // Ej: "Tmp3f8a1c2b4!" — 12 chars
  // Siempre satisface strongPassword: mayúscula (T), minúscula (hex), dígito, especial (!)
}
```

### mustChangePassword — flujo completo
1. Admin hace `POST /:id/reset-password` → `updatePassword(id, hash, mustChangePassword=true)`
2. El email con la contraseña temporal llega al customer via `CustomerPasswordResetSubscriber`
3. Customer hace login con la contraseña temporal → response incluye `customer.mustChangePassword: true`
4. Frontend detecta `mustChangePassword: true` y redirige a pantalla de cambio de contraseña
5. Customer hace `PATCH /change-password` con la contraseña temporal como `currentPassword` → `updatePassword(id, newHash, mustChangePassword=false)`
6. Login/Renew futuros ya retornan `mustChangePassword: false`

### Routing order — por qué importa
```
POST /forgot-password  → debe ir ANTES de POST /:id/* para que Express no confunda "forgot-password" con un :id
PATCH /change-password → debe ir ANTES de PATCH /:id para el mismo motivo
GET /me                → debe ir ANTES de GET /:id
POST /renew            → debe ir ANTES de POST /:id/*
```

### Variables de entorno requeridas para password reset
```
MAILER_EMAIL, MAILER_SECRET_KEY, MAILER_SERVICE  — Si faltan, el email no se envía (silencioso)
```
