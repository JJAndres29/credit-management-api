# Credit Management System

> API REST para gestionar clientes de crédito, ventas y pagos para un negocio minorista. Construido con Node.js, TypeScript, Express y PostgreSQL siguiendo principios de **Clean Architecture**, ahora mejorado con una robusta plataforma de comercio electrónico, variantes dinámicas de productos, analíticas completas y colas de fondo resilientes.

---

### 🌐 Language / Idioma
*   **[Read in English 🇬🇧](README.md)**
*   **Español** (Actual)

---

## Por qué este repositorio es público

Es un backend **completo y ejecutable** — no un mockup. El código fuente, las migraciones y **2.056 tests automatizados** están aquí para que reclutadores y tech leads evalúen calidad real: Clean Architecture, bounded contexts, transacciones financieras atómicas, webhooks de Mercado Pago, workers BullMQ y guards estructurales de acoplamiento.

**Clónalo, corre `npm test`, explora `src/domain/use-cases/`.**

### En cifras

| Métrica | Valor |
|---------|-------|
| Tests automatizados | **2.056** (32 suites) |
| Archivos TypeScript | **470+** en `src/` |
| Modelos de base de datos | **30+** (Prisma / PostgreSQL 16) |
| Bounded contexts | **3** — Staff, Customer (e-commerce), Online Orders |
| Endpoints API | **80+** entre staff, storefront, admin y SEO |

### Profundización de arquitectura

| Documento | Contenido |
|-----------|-----------|
| [docs/architecture.md](docs/architecture.md) | Capas, bounded contexts, flujos financieros, Domain Events |
| [docs/modules.md](docs/modules.md) | Mapa de módulos e integraciones |
| [docs/highlights.md](docs/highlights.md) | Decisiones de producción: idempotencia, webhooks, ACL, feature flags |
| [docs/testing.md](docs/testing.md) | Estrategia de tests y áreas de cobertura |
| [docs/operation-modes.md](docs/operation-modes.md) | Modos HYBRID vs ECOMMERCE_ONLY |

### Muestras de patrones (`examples/`)

Fragmentos anotados que reflejan patrones del código real — lectura rápida antes de entrar a `src/`:

- [use-case-with-audit.ts](examples/use-case-with-audit.ts) — ledger atómico + audit log
- [domain-events.ts](examples/domain-events.ts) — side effects post-commit
- [anti-corruption-layer.ts](examples/anti-corruption-layer.ts) — aislamiento Customer ↔ Staff
- [dto-validation.ts](examples/dto-validation.ts) — factory de validación en el boundary

---

## Tabla de Contenidos

- [Por qué este repositorio es público](#por-qué-este-repositorio-es-público)
- [Resumen](#resumen)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Primeros Pasos](#primeros-pasos)
- [Variables de Entorno](#variables-de-entorno)
- [Esquema de Base de Datos](#esquema-de-base-de-datos)
- [Referencia de la API](#referencia-de-la-api)
- [Seguridad](#seguridad)
- [Pruebas (Testing)](#pruebas-testing)
- [Scripts](#scripts)
- [Ruta de Desarrollo (Roadmap)](#ruta-de-desarrollo-roadmap)
- [Paginación y Filtrado](#paginación-y-filtrado)
- [Sistema de Precios](#sistema-de-precios)
- [Sistema de Notificaciones](#sistema-de-notificaciones)
- [Sistema de Reportes PDF](#sistema-de-reportes-pdf)
- [Categorización de Productos y Atributos Dinámicos](#categorización-de-productos-y-atributos-dinámicos)
- [Cobros y Resumen Mensual en Dashboard](#cobros-y-resumen-mensual-en-dashboard)
- [Pasarela de Pago (Mercado Pago)](#pasarela-de-pago-mercado-pago)
- [Comercio Electrónico y Carrito de Compras](#comercio-electrónico-y-carrito-de-compras)
- [Variantes y Recursos de Productos](#variantes-y-recursos-de-productos)
- [Feature Flags (Banderas de Funcionalidad)](#feature-flags-banderas-de-funcionalidad)
- [Analíticas y Marketing de Administración](#analíticas-y-marketing-de-administración)
- [Tareas Programadas en Segundo Plano](#tareas-programadas-en-segundo-plano)
- [Trabajadores Asíncronos BullMQ](#trabajadores-asíncronos-bullmq)
- [Protección de Idempotencia](#protección-de-idempotencia)
- [Sistema SEO y Sitemap](#sistema-seo-y-sitemap)

---

## Resumen

Este sistema permite a un negocio minorista gestionar las operaciones de crédito para sus clientes. Los miembros del personal (administradores y vendedores) interactúan con el sistema a través de una API privada. Los clientes no tienen acceso directo al sistema del personal — reciben estados de cuenta externamente a través de WhatsApp y correo electrónico, y pueden iniciar sesión en una plataforma de comercio electrónico completamente desacoplada para ver productos, gestionar un carrito de compras, configurar zonas de envío y realizar pedidos en línea utilizando Mercado Pago o checkout manual de WhatsApp.

**Qué maneja el sistema:**
- **Autenticación de Personal y RBAC**: Credenciales seguras para administradores y vendedores, mecanismos de renovación y permisos granulares.
- **Libro Mayor de Clientes y Saldos**: Seguimiento completo de créditos, límites disponibles y cálculo de saldos.
- **Ventas de Contado y Crédito**: Transacciones atómicas que descuentan existencias (stock) y actualizan la deuda del cliente.
- **Pagos y Correcciones**: Soporte completo para actualizaciones PUT y acciones DELETE en pagos que calculan automáticamente las diferencias de saldo y registran logs de auditoría dentro de transacciones atómicas.
- **Tienda en Línea y Checkout**: Flujos de pago para clientes registrados y de tipo "invitado" con desgloses de impuestos (IVA), redención de cupones, calculadora de zonas de envío y reserva de existencias en tiempo real.
- **Carrito de Compras**: Gestión de sesión de modo dual que admite tanto a clientes conectados (guardados en la base de datos) como sesiones anónimas de invitados (cabecera `X-Cart-Session`).
- **Variantes de Productos**: Mapeo rico de atributos que admite categorización extensible (color, tamaño, peso) y control individual de existencias y precios a nivel de SKU.
- **Analíticas y Marketing Cheados**: Caché de vistas materializadas para ventas diarias, retención de cohortes, rentabilidad, stock inactivo (muerto), LTV de clientes, tamaño promedio del ticket y pruebas A/B de experimentos de precios.
- **Notificaciones Automáticas**: Suscriptores dinámicos que activan correo electrónico (Nodemailer) y enlaces directos de WhatsApp manuales, limitados a un máximo de 3 solicitudes por cliente por hora.
- **Colas de Fondo BullMQ**: Integración de BullMQ y Redis para procesar colas de notificaciones pesadas de forma asíncrona, respaldada por una política de disyuntor (circuit breaker).
- **Tareas Cron Programadas**: Temporizadores en el proceso con protección de reentrada para limpiar pedidos vencidos, actualizar paneles de analíticas y evaluar alarmas de negocio críticas.
- **Apagado Resiliente (Graceful Shutdown)**: Capturadores de señales Unix (`SIGTERM`/`SIGINT`) para cerrar servidores HTTP de manera limpia, liberar intervalos de tareas de fondo y desconectar de forma segura el pool de conexiones de Prisma.

---

## Arquitectura

El proyecto sigue **Clean Architecture**, organizado en tres capas estrictas. Las capas internas nunca dependen de las externas.

```
┌──────────────────────────────────────────────────────┐
│                  Capa de Presentación                │
│      Routers de Express · Controladores · Middlewares│
├──────────────────────────────────────────────────────┤
│                    Capa de Dominio                   │
│   Entidades · Casos de Uso · DTOs · Interfaces       │
├──────────────────────────────────────────────────────┤
│              Capa de Infraestructura                 │
│     Datasources Prisma · Repositorios Implementados  │
│         Adaptadores de Servicios (JWT · Cloudinary)  │
└──────────────────────────────────────────────────────┘
```

**Patrones aplicados:**

| Patrón | Propósito |
|---------|---------|
| **Repository** | Abstrae el acceso a datos — cambiar PostgreSQL no requiere cambios en el dominio. |
| **Use Case** | Cada acción de negocio es una clase aislada y testable. |
| **Adapter** | Las librerías externas implementan interfaces de dominio — permite reemplazar cualquier librería sin tocar la lógica de negocio. |
| **DTO** | La validación de entrada ocurre en el límite del sistema antes de llegar a los casos de uso. |
| **Inyección de Dependencias** | Basada en constructores en todo el sistema — sin localizadores de servicios ni estado global. |
| **Servicio de Dominio (Cuotas)** | Lógica pura de negocio para el cálculo de planes de pago, sin dependencias de frameworks o bases de datos, totalmente testable con pruebas unitarias. |
| **Eventos de Dominio** | Los casos de uso emiten eventos después de confirmar transacciones. Los suscriptores manejan efectos secundarios de forma asíncrona. |
| **Capa de Anti-Corrupción (ACL)** | `ClientLookupPort` actúa como un límite limpio entre el contexto de `Customer` (E-commerce) y el contexto de `Client` (Personal), traduciendo entidades y previniendo el acoplamiento directo de esquemas. |
| **Feature Flags** | Middleware de verificación dinámica que permite activar o desactivar módulos en tiempo de ejecución sin despliegues ni caídas de servidor. |
| **Idempotencia** | Seguridad contra dobles envíos en transacciones mediante cabeceras `Idempotency-Key` respaldadas por un registro de auditoría en la base de datos. |
| **Servicio de Impuestos** | Desglose automático de precios brutos en campos neto e IVA siguiendo las directrices colombianas de facturación. |
| **Evaluación de Riesgo** | Puntuación antifraude que evalúa pedidos según velocidad por IP, categorías de riesgo de clientes y validación de direcciones. |

---

## Stack Tecnológico

| Área | Tecnología |
|---------|-----------|
| Runtime | Node.js 20 |
| Lenguaje | TypeScript 5 (modo estricto) |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Base de Datos | PostgreSQL 16 |
| Caché y Colas | Redis (`ioredis` + **BullMQ** para colas de tareas en segundo plano) |
| Autenticación | JWT (`jsonwebtoken` / claves secretas independientes para personal y clientes) + Google OAuth 2.0 |
| Hashing de Contraseñas | `bcryptjs` |
| Carga de Archivos | `multer` (almacenamiento en memoria) |
| Alojamiento de Imágenes | Cloudinary (`cloudinary` v2) |
| Cabeceras de Seguridad | `helmet` |
| CORS | `cors` (soporta listas blancas dinámicas y credenciales) |
| Limitación de Tasa | `express-rate-limit` (límites personalizados para inicios de sesión, checkouts y lecturas públicas) |
| Pruebas (Testing) | Jest + ts-jest |
| Generación de PDF | PDFKit |
| Registro de Logs | `pino` + `pino-http` (JSON estructurado, marcas de tiempo ISO, redacción de campos sensibles) |
| Apagado Resiliente | Capturadores nativos de señales Unix con tiempo de espera de seguridad de 25 segundos |

---

## Estructura del Proyecto

```
credit-management-system/
├── prisma/
│   ├── schema.prisma              # ~30+ modelos: Contabilidad Principal + E-commerce + Cupones + Carrito + Variantes
│   └── seed.ts                    # Crea el usuario administrador por defecto y banderas de configuración
├── src/
│   ├── app.ts                     # Punto de entrada del servidor, inicializador cron y manejador de señales
│   ├── config/
│   │   ├── envs.ts                # Valida las variables de entorno requeridas al arrancar
│   │   ├── prisma.ts              # Singleton del cliente Prisma
│   │   └── regular-exp.ts         # Patrones regex compartidos (correo, contraseña fuerte)
│   ├── domain/                    # Lógica de negocio pura — sin dependencias de frameworks
│   │   ├── datasources/           # Interfaces abstractas de origen de datos
│   │   ├── types/
│   │   │   └── paginated.type.ts  # Genérico PaginatedResult<T>
│   │   ├── dtos/
│   │   │   ├── auth/              # LoginDto
│   │   │   ├── clients/           # CreateClientDto, UpdateClientDto, FilterClientsDto
│   │   │   ├── customer-auth/     # Registro de clientes E-commerce, vinculación, DTOs de direcciones
│   │   │   ├── online-orders/     # DTOs de checkout de pedidos en línea
│   │   │   ├── payments/          # CreatePaymentDto, FilterPaymentsDto
│   │   │   ├── products/          # CreateProductDto, AdjustStockDto
│   │   │   ├── sales/             # CreateSaleDto, FilterSalesDto
│   │   │   └── admin/             # FeatureFlagUpdateDto, CreateCouponDto
│   │   ├── entities/              # Entidades principales de negocio (User, Client, Product, Variant, OnlineOrder, Cart)
│   │   ├── value-objects/         # Money (Objeto de valor seguro para COP/USD)
│   │   ├── errors/                # CustomError con métodos de fábrica de estado HTTP
│   │   ├── repositories/          # Interfaces de repositorios (puertos)
│   │   ├── services/
│   │   │   └── ...                # FeatureFlagPort, ClientLookupPort, Servicio de Impuestos, PDFService
│   │   └── use-cases/
│   │       ├── analytics/         # Lógica de analíticas y vistas materializadas
│   │       ├── auth/              # LoginUseCase, RenewTokenUseCase
│   │       ├── business-alerts/   # Evaluación de alertas y disparadores
│   │       ├── cart/              # Obtención, adición, fusión y vaciado de carritos
│   │       ├── categories/        # Categorías, atributos dinámicos y valores permitidos
│   │       ├── clients/           # GetClients, GetClientById, ClaimClient, NotifyClient
│   │       ├── customer-auth/     # GoogleAuth, Cambio de contraseña, Gestión de direcciones
│   │       ├── online-orders/     # Checkout, Temporizadores de vencimiento, Webhooks
│   │       ├── payments/          # CreatePayment, UpdatePayment, DeletePayment
│   │       ├── products/          # QuickCreate, AdjustStock, Carga de imágenes
│   │       ├── variants/          # CRUD de gestión de variantes
│   │       └── users/             # GetUsers, ToggleUserStatus, ChangePassword
│   ├── infrastructure/            # Implementación de interfaces de dominio (adaptadores)
│   │   ├── datasources/           # Implementaciones Prisma de todos los orígenes de datos
│   │   ├── repositories/          # Implementaciones de repositorios
│   │   ├── jobs/                  # Temporizadores cron (Vencimiento de pedidos, Vistas analíticas, Alertas)
│   │   ├── messaging/             # Cola BullMQ con Redis, trabajadores serializables, respaldos locales
│   │   └── services/              # JwtAdapter, CloudinaryAdapter, MetaWhatsApp, Nodemailer, PinoLogger
│   ├── presentation/              # Capa HTTP Express controladores y rutas
│   │   ├── admin/                 # Feature flags, dead letters, cupones, analíticas
│   │   ├── cart/                  # CartController, CartRouter
│   │   ├── categories/            # Routers de Categoría y Atributos
│   │   ├── customer-auth/         # Router de autenticación de clientes E-commerce
│   │   ├── ecommerce/             # Receptor crudo de webhooks de Mercado Pago
│   │   ├── health/                # Monitoreo de salud (Prisma SELECT 1)
│   │   ├── middlewares/           # FeatureFlagMiddleware, IdempotencyMiddleware, RBAC, CachePublic
│   │   ├── online-orders/         # Router de pedidos en línea
│   │   └── server.ts              # Configuración de Express y cascadas de middlewares
│   └── workers/
│       └── notification.worker.ts # Trabajador BullMQ independiente en Redis para correos/WhatsApp
├── docs/                          # Profundización de arquitectura (portafolio)
├── examples/                      # Fragmentos de patrones anotados
├── Dockerfile                     # Construcción de producción en múltiples etapas (Node 20 Alpine)
├── docker-compose.yml             # Contenedores de PostgreSQL 16 + Redis
├── jest.config.js
└── package.json
```

---

## Primeros Pasos

### Requisitos Previos

- Node.js 20+
- Docker y Docker Compose
- Redis (opcional, cae automáticamente en memoria si redis no está corriendo)
- npm

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd credit-management-system
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.template .env
```

Abre `.env` y configura tus valores. Como mínimo, genera claves secretas fuertes:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Consulta [Variables de Entorno](#variables-de-entorno) para ver la referencia completa.

### 4. Iniciar la base de datos y caché

```bash
docker-compose up -d
```

Esto inicia los contenedores de PostgreSQL 16 y Redis.

### 5. Ejecutar migraciones

```bash
npm run db:migrate
```

### 6. Sembrar el usuario administrador por defecto

```bash
npm run db:seed
```

| Campo | Valor |
|-------|-------|
| Correo | `admin@credit.com` |
| Contraseña | `Admin1234!` |
| Rol | `ADMIN` |

### 7. Iniciar el servidor de desarrollo

```bash
npm run dev
```

API disponible en: `http://localhost:3000`

### 8. Ejecutar colas de fondo (Opcional)

En otra ventana de terminal:
```bash
npm run worker:notifications
```

---

## Variables de Entorno

| Variable | Requerida | Descripción |
|----------|----------|-------------|
| `PORT` | Sí | Puerto del servidor (ej. `3000`) |
| `NODE_ENV` | No | `development` o `production` |
| `DATABASE_URL` | Sí | Cadena de conexión para transacciones de PostgreSQL |
| `DIRECT_URL` | Sí | Cadena de conexión directa para migraciones de PostgreSQL |
| `JWT_SECRET` | Sí | Clave de firma JWT para el personal — 64+ caracteres hex |
| `JWT_EXPIRES_IN` | Sí | TTL del token del personal (ej. `24h`) |
| `JWT_CUSTOMER_SECRET` | Sí* | Clave de firma JWT para clientes de E-commerce |
| `JWT_CUSTOMER_EXPIRES_IN` | No | TTL del token de clientes (defecto: `7d`) |
| `GOOGLE_CLIENT_ID` | No | Client ID para el inicio de sesión con Google OAuth2 |
| `REDIS_URL` | No | URL de conexión de Redis (ej. `redis://localhost:6379`). Habilita colas BullMQ. |
| `APP_URL` | Sí | URL pública de origen del servidor (requerida para webhooks y rutas SEO) |
| `CLOUDINARY_CLOUD_NAME` | Sí* | Nombre de la cuenta de Cloudinary |
| `CLOUDINARY_API_KEY` | Sí* | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | Sí* | API Secret de Cloudinary |
| `MP_ACCESS_TOKEN` | Sí* | Credenciales de acceso de Mercado Pago |
| `MP_WEBHOOK_SECRET` | Sí* | Clave de validación de firma para Mercado Pago |
| `MP_WEBHOOK_DEBUG` | No | Activa logs verbosos para eventos webhook de MP (`true`/`false`) |
| `MP_SANDBOX_MODE` | No | Fuerza el entorno de prueba para la integración de la pasarela |
| `MP_BACK_URL_SUCCESS` | No | URL de redirección en caso de pago exitoso |
| `MP_BACK_URL_FAILURE` | No | URL de redirección en caso de pago fallido |
| `MP_BACK_URL_PENDING` | No | URL de redirección en caso de pago pendiente |
| `MAILER_EMAIL` | No† | Dirección de correo del remitente para reportes |
| `MAILER_SECRET_KEY` | No† | Contraseña de aplicación de Gmail (16 caracteres) |
| `META_WHATSAPP_TOKEN` | No‡ | Token de usuario del sistema permanente de WhatsApp Meta |
| `META_WHATSAPP_PHONE_NUMBER_ID`| No‡ | Identidad del teléfono remitente de WhatsApp Meta |
| `SEO_PRODUCT_PATH_PREFIX` | No | Prefijo de ruta de producto para el sitemap (defecto: `/api/products/by-slug`) |
| `SEO_CATEGORY_PATH_PREFIX` | No | Prefijo de ruta de categoría para el sitemap (defecto: `/api/categories/by-slug`) |
| `BUSINESS_ALERT_EMAILS` | No | Correos de administradores separados por comas para alertas de negocio |

> \* Requerida si el módulo de E-commerce, inicio de sesión de clientes, catálogo de imágenes o checkout está activo.
> † Las credenciales de correo son obligatorias para despachar estados de cuenta.
> ‡ Las credenciales de WhatsApp son obligatorias para disparar eventos de mensajes directos.

---

## Esquema de Base de Datos

```
User             — Personal del sistema con rol (ADMIN | SELLER)
Client           — Clientes de crédito: límite, saldo actual e información de contacto
Product          — Productos del inventario: nombre, cantidad de existencias, peso y precio sugerido
ProductVariant   — Variación a nivel de SKU del producto con existencias, MSRP y hash de atributos combinados
ProductImage     — Fotos del producto: URL de Cloudinary, publicId, orden de visualización
ProductAsset     — Gestor de recursos multimedia enriquecidos que vincula imágenes/videos a variantes específicas
StockMovement    — Seguimiento completo del inventario físico y reservas de pedidos en línea
Category         — Categorías del catálogo con tasas impositivas (IVA) por defecto y llaves meta de SEO
CategoryAttribute— Atributos extensibles en categorías (Color, Talla, Material)
AttributeValue   — Términos permitidos vinculados a atributos (Rojo, XL, Algodón)
ProductAttribute — Vincula plantillas de productos a valores de atributos específicos
Cart             — Carritos de compras que contienen artículos para clientes o sesiones de invitados
CartItem         — Artículos específicos dentro de los carritos que rastrean precios al momento de agregarse
Coupon           — Catálogo de códigos de descuento (PORCENTAJE / FIJO) con restricción por producto, categoría o pedido
CouponRedemption — Historial de uso de cupones vinculados a checkouts de pedidos
ShippingZone     — Directorio de zonas de envío
ShippingRate     — Reglas de costo de envío específicas y multiplicadores de peso por zona
CustomerAddress  — Direcciones guardadas por clientes, listando la principal
OnlineOrder      — Pedidos en línea con datos de clientes/invitados, direcciones de envío, impuestos y estados
OnlineOrderItem  — Registro de artículos del pedido en línea y capturas de cantidad
OrderEvent       — Registro operacional de auditoría que registra los cambios de estado del pedido en línea
IdempotencyRecord— Log de respuestas que mapea hashes de cuerpos de solicitudes a llaves de idempotencia
ProcessedWebhook — Registro de webhooks procesados para asegurar procesamiento único
FeatureFlag      — Registro de banderas de configuración en tiempo de ejecución (Checkout, MP, límites físicos, etc.)
LedgerEntry      — Libro mayor de contabilidad limpio que registra movimientos firmados de saldo del cliente
DianResolution   — Contenedor de rangos de resolución de facturación de la DIAN (Colombia)
ElectronicInvoice— Payload de factura electrónica, hash CUFE, enlaces XML y estados
ElectronicInvoiceItem — Artículos facturados con sus desgloses de IVA
InvoiceAuditLog  — Registro de trazabilidad de cambios de estado de facturas electrónicas
CustomerFiscalData— Perfil estándar de NIT/Cédula para facturación
DiscountCampaign — Campañas de descuento a nivel de categoría
PriceExperiment  — Configuración de experimentos de precios A/B con ganadores por conversión o ingresos
ProductSlugHistory— Rastreador de cambios de slugs de productos para activar redireccionamientos 301 limpios
AuditLog         — Registro inmutable de acciones del personal sobre saldos
NotificationLog  — Logs de envíos de correos electrónicos y mensajes de WhatsApp
```

---

## Referencia de la API

URL Base: `http://localhost:3000/api`

### Monitoreo de Salud
- `GET /health` — Monitor anónimo de estado. Retorna salud de la base de datos y tiempo de actividad.

### Autenticación de Personal
- `POST /api/auth/login` — Autenticación de personal limitada por tasa. Retorna JWT y datos del usuario.
- `POST /api/auth/renew` — Renovación del token de personal.

### Autenticación de Clientes (E-commerce)
- `POST /api/customer-auth/register` — Registro de clientes locales.
- `POST /api/customer-auth/login` — Inicio de sesión de clientes.
- `POST /api/customer-auth/google` — Inicio con token de Google OAuth (`idToken`).
- `POST /api/customer-auth/forgot-password` — Generación y envío de contraseña temporal.
- `POST /api/customer-auth/renew` — Renovación de token de cliente (Requiere JWT de Cliente).
- `POST /api/customer-auth/claim-client` — Vincula un Customer a un Client del personal (JWT de Cliente).
- `PATCH /api/customer-auth/change-password` — Cambio de contraseña del cliente (JWT de Cliente).
- `GET /api/customer-auth/me` — Perfil del cliente y saldo resumido (JWT de Cliente).
- `PATCH /api/customer-auth/me` — Actualización de información de perfil (JWT de Cliente).
- `GET /api/customer-auth/me/addresses` — Lista de direcciones guardadas.
- `POST /api/customer-auth/me/addresses` — Registra una nueva dirección.
- `PATCH /api/customer-auth/me/addresses/:addressId/default` — Establece la dirección predeterminada.
- `PATCH /api/customer-auth/me/addresses/:addressId` — Modifica datos de una dirección.
- `DELETE /api/customer-auth/me/addresses/:addressId` — Elimina una dirección guardada.
- `GET /api/customer-auth` — Lista de clientes (Staff JWT + ADMIN).
- `PATCH /api/customer-auth/:id` — Edita datos del cliente (Staff JWT + ADMIN).
- `POST /api/customer-auth/:id/reset-password` — Fuerza el reinicio de contraseña del cliente (Staff JWT + ADMIN).

### Productos y Variantes
- `GET /api/products` — Retorna productos activos.
- `GET /api/products/:id` — Ficha detallada de producto.
- `GET /api/products/by-slug/:slug` — Obtiene producto por su slug de SEO.
- `POST /api/products` — Crea un producto (Staff JWT + ADMIN).
- `PUT /api/products/:id` — Actualiza detalles de producto (Staff JWT + ADMIN).
- `DELETE /api/products/:id` — Eliminación suave (soft delete) del producto (Staff JWT + ADMIN).
- `POST /api/products/quick-create` — Creación rápida de producto (Staff JWT + ADMIN).
- `POST /api/products/quick-create-with-variants` — Crea producto y variantes hijas en una sola petición (Staff JWT + ADMIN).
- `PATCH /api/products/:id/stock` — Ajusta existencias (Staff JWT + ADMIN).
- `PATCH /api/products/:id/retail-price` — Modifica precio de vitrina sugerido (Staff JWT + ADMIN).
- `POST /api/products/:id/images` — Sube fotos para la galería (Staff JWT + ADMIN).
- `DELETE /api/products/:id/images/:imageId` — Elimina foto de Cloudinary (Staff JWT + ADMIN).
- `GET /api/products/:productId/variants` — Variantes de un producto.
- `POST /api/products/:productId/variants` — Crea una variante (Staff JWT + ADMIN).
- `PUT /api/products/:productId/variants/:variantId` — Modifica variante (Staff JWT + ADMIN).
- `DELETE /api/products/:productId/variants/:variantId` — Elimina variante (Staff JWT + ADMIN).
- `POST /api/products/:id/attributes` — Sincroniza atributos dinámicos (Staff JWT + ADMIN).
- `PUT /api/products/:id/attributes` — Reemplaza atributos dinámicos (Staff JWT + ADMIN).
- `DELETE /api/products/:id/attributes/:valueId` — Elimina vinculación de atributo (Staff JWT + ADMIN).
- `POST /api/products/:id/assets` — Sube assets de variantes (Staff JWT + ADMIN).
- `POST /api/products/:id/assets/reuse` — Reutiliza asset existente en variante (Staff JWT + ADMIN).
- `DELETE /api/products/:id/assets/:assetId` — Elimina registro de asset (Staff JWT + ADMIN).

### Categorías y Atributos
- `GET /api/categories` — Obtiene categorías activas.
- `GET /api/categories/by-slug/:slug` — Categoría por slug de SEO.
- `POST /api/categories` — Crea categoría (Staff JWT + ADMIN).
- `PUT /api/categories/:id` — Actualiza categoría (Staff JWT + ADMIN).
- `DELETE /api/categories/:id` — Elimina categoría (Staff JWT + ADMIN).
- `GET /api/categories/:id/attributes` — Obtiene atributos de la categoría.
- `POST /api/categories/:id/attributes` — Agrega atributo a categoría (Staff JWT + ADMIN).
- `PUT /api/attributes/:id` — Cambia nombre de la llave de atributo (Staff JWT + ADMIN).
- `DELETE /api/attributes/:id` — Elimina atributo de categoría (Staff JWT + ADMIN).
- `GET /api/attributes/:id/values` — Valores permitidos de un atributo.
- `POST /api/attributes/:id/values` — Registra un valor permitido (Staff JWT + ADMIN).
- `PUT /api/values/:id` — Renombra valor permitido (Staff JWT + ADMIN).
- `DELETE /api/values/:id` — Elimina valor permitido (Staff JWT + ADMIN).

### Comercio Electrónico y Carrito
- `GET /api/cart` — Obtiene el carrito (X-Cart-Session o JWT de Cliente).
- `POST /api/cart/items` — Agrega un SKU de variante al carrito (X-Cart-Session o JWT de Cliente).
- `PATCH /api/cart/items/:itemId` — Actualiza cantidad del ítem (X-Cart-Session o JWT de Cliente).
- `DELETE /api/cart/items/:itemId` — Elimina ítem del carrito (X-Cart-Session o JWT de Cliente).
- `POST /api/online-orders` — Checkout de pedido. Admite invitados o clientes. (Idempotency Key soportada).
- `GET /api/online-orders/:id` — Detalles del pedido (JWT de Cliente dueño o verificación de correo de invitado).
- `GET /api/online-orders` — Lista pedidos en línea (Staff JWT + ADMIN).
- `PATCH /api/online-orders/:id/status` — Actualiza estado de preparación/envío del pedido (Staff JWT + ADMIN).
- `GET /api/shipping/zones` — Zonas de envío activas y costos base.
- `POST /api/ecommerce/webhooks/mercadopago` — Webhook de Mercado Pago (Validación HMAC).

### Clientes (Personal)
- `GET /api/clients` — Lista clientes activos (Staff JWT).
- `GET /api/clients/:id` — Detalle del cliente (Staff JWT).
- `POST /api/clients` — Registra cliente nuevo (Staff JWT).
- `PUT /api/clients/:id` — Modifica datos del cliente (Staff JWT).
- `DELETE /api/clients/:id` — Eliminación suave (Staff JWT + ADMIN).
- `POST /api/clients/:id/notify` — Dispara recordatorio de saldo a cliente (Staff JWT).

### Ventas y Cobros (Personal)
- `GET /api/sales` — Lista ventas físicas (Staff JWT).
- `GET /api/sales/client/:clientId` — Ventas de un cliente (Staff JWT).
- `GET /api/sales/:id` — Ficha de venta (Staff JWT).
- `POST /api/sales` — Crea venta física de contado o crédito (Staff JWT + Idempotency Key).
- `PUT /api/sales/:id` — Corrige días de cobro y fechas de venta (Staff JWT + ADMIN).
- `DELETE /api/sales/:id` — Borra venta de forma atómica y restaura stock (Staff JWT + ADMIN).
- `GET /api/collections/installments` — Obtiene cuotas pendientes, parciales o vencidas (Staff JWT).

### Pagos (Personal)
- `GET /api/payments` — Obtiene pagos (Staff JWT).
- `GET /api/payments/client/:clientId` — Pagos de un cliente (Staff JWT).
- `GET /api/payments/sale/:saleId` — Pagos de una venta (Staff JWT).
- `GET /api/payments/:id` — Ficha de pago (Staff JWT).
- `POST /api/payments` — Registra un abono/pago (Staff JWT + Idempotency Key).
- `PUT /api/payments/:id` — Corrige monto, fecha o notas de pago de forma atómica (Staff JWT + ADMIN).
- `DELETE /api/payments/:id` — Revierte el pago y restaura la deuda original (Staff JWT + ADMIN).

### Registro de Auditoría y Reportes
- `GET /api/audit-logs` — Registros de auditoría financiera (Staff JWT + ADMIN).
- `GET /api/audit-logs/client/:clientId` — Logs de auditoría de un cliente (Staff JWT + ADMIN).
- `GET /api/reports/account-statement/:clientId` — Descarga directa del PDF de estado de cuenta (Staff JWT + ADMIN).
- `GET /api/dashboard` — Métricas y cobros destacados en dashboard (Staff JWT).
- `GET /api/dashboard/monthly-summary` — Resumen mensual de recaudos en dashboard (Staff JWT).

### Funcionalidades de Administrador
- `GET /api/admin/feature-flags` — Lista las banderas del sistema (Staff JWT + ADMIN).
- `PATCH /api/admin/feature-flags/:key` — Activa/desactiva una bandera de funcionalidad (Staff JWT + ADMIN).
- `POST /api/admin/coupons` — Crea un cupón de descuento para checkout (Staff JWT + ADMIN).
- `PATCH /api/admin/products/bulk-active` — Cambio masivo de estado de productos (Staff JWT + ADMIN).
- `GET /api/admin/dead-letters` — Inspecciona colas de envío de correos fallidos (Staff JWT + ADMIN).

### Analíticas y Marketing
- `POST /api/admin/analytics/read-models/refresh` — Actualiza manualmente vistas de analíticas (Staff JWT + ADMIN).
- `GET /api/admin/analytics/daily-sales` — Reporte de ventas diarias (Staff JWT + ADMIN).
- `GET /api/admin/analytics/profitability` — Reporte de rentabilidad por producto (Staff JWT + ADMIN).
- `GET /api/admin/analytics/dead-stock` — Alerta de existencias de rotación nula (Staff JWT + ADMIN).
- `GET /api/admin/analytics/inventory-turnover` — Velocidad de rotación del catálogo (Staff JWT + ADMIN).
- `GET /api/admin/analytics/cohorts` — Cohortes de retención mensual de compradores (Staff JWT + ADMIN).
- `GET /api/admin/analytics/customer-ltv` — LTV (Lifetime Value) de compradores (Staff JWT + ADMIN).
- `GET /api/admin/analytics/ticket-average` — Tamaño de ticket de compra (Staff JWT + ADMIN).
- `POST /api/admin/analytics/business-alerts/evaluate` — Evalúa reglas de alarmas de negocio (Staff JWT + ADMIN).
- `POST /api/admin/marketing/discount-campaigns` — Campaña de descuento por categorías (Staff JWT + ADMIN).
- `GET /api/admin/marketing/discount-campaigns` — Obtiene las campañas activas (Staff JWT + ADMIN).
- `POST /api/admin/marketing/price-experiments` — Experimento de precios A/B (Staff JWT + ADMIN).
- `GET /api/admin/marketing/price-experiments` — Obtiene experimentos A/B activos (Staff JWT + ADMIN).
- `GET /api/admin/marketing/rotation-alerts` — Listado de alertas por baja rotación (Staff JWT + ADMIN).

### Rutas SEO
- `GET /sitemap.xml` — Sitemap XML generado dinámicamente (cacheado, público, limitado).
- `GET /robots.txt` — Políticas estándar de rastreo para buscadores.

---

## Seguridad

### Medidas Implementadas

| Medida | Detalles |
|---------|---------|
| **Hashing de Contraseñas** | Encriptación `bcryptjs` con 10 rondas de sal. |
| **Aislamiento de Tokens** | Claves secretas diferentes para personal (`JWT_SECRET`) y clientes (`JWT_CUSTOMER_SECRET`). |
| **Middlewares Separados** | `AuthMiddleware` valida rutas internas y `CustomerAuthMiddleware` maneja accesos de clientes. |
| **Validación HMAC** | Asegura integridad de firmas de Mercado Pago con comparaciones seguras de `timingSafeEqual`. |
| **Middleware de Idempotencia** | Evalúa firmas hash SHA256 de las peticiones POST contra la llave `Idempotency-Key`. |
| **Capa de Anti-Corrupción** | Mantiene bajo acoplamiento: por ejemplo, el motor e-commerce consulta bases del personal solo mediante `ClientLookupPort`. |
| **Protección de Feature Flags** | Middlewares dinámicos que validan banderas antes de dar paso a los controladores. |
| **Resiliencia de BullMQ** | Despacha correos/WhatsApp de fondo en Redis, con caída controlada a modo síncrono si Redis está caído. |
| **Limitadores de Tasa (Rate Limits)** | Políticas dinámicas que resguardan accesos públicos, inicios de sesión, checkouts y reinicios de contraseñas. |
| **Apagado Limpio (Graceful)** | Escucha de señales SIGTERM/SIGINT para apagar servidores y liberar base de datos. |
| **Carga Máxima de Entrada** | Limita cuerpos de solicitudes JSON a 10 KB para prevenir desbordamientos y denegaciones de servicio (DoS). |

---

## Pruebas (Testing)

**2.056 tests** en **32 suites**, escritos con **Jest + ts-jest** y ubicados junto al código que prueban (`*.test.ts`).

```bash
npm test              # Ejecuta todas las pruebas
npm run test:watch    # Modo de observación (watch mode)
```

Estrategia completa: [docs/testing.md](docs/testing.md)

### Áreas Destacadas de Cobertura

- **Customer Auth (36 pruebas)**: Asegura registro, login, vinculaciones, perfil de direcciones, aislamiento y guards estáticos.
- **Online Orders**: Valida vaciado de carritos tras compra, vencimientos de pedidos y reglas de riesgo.
- **Variantes**: Asegura hashes únicos para cada SKU y control de existencias.
- **Mercado Pago**: Valida preferencias y firmas HMAC de webhooks.
- **Structural Struct Guard (`no-coupling.test.ts`)**: Pruebas de análisis estático que aseguran que el negocio de clientes de e-commerce no importe repositorios o entidades internas del personal.
- **Subscriptores (25 pruebas)**: Comprueba envío de PDF, plantillas y throttles.
- **PDF Report System (20 pruebas)**: Valida consultas en paralelo, deduplicación de productos y flujos de stream.

---

## Scripts

```bash
npm run dev                 # Inicia servidor con recarga en caliente (hot reload)
npm run build               # Compila TypeScript -> dist/
npm start                   # Ejecuta el build de producción compilado
npm run worker:notifications# Inicia el trabajador BullMQ para la cola de Redis
npm test                    # Ejecuta las pruebas unitarias e integración
npm run test:watch          # Ejecuta pruebas en modo de observación
npm run db:migrate          # Aplica migraciones Prisma pendientes
npm run db:generate         # Regenera el Cliente Prisma
npm run db:seed             # Siembra registros por defecto
npm run db:studio           # Consola visual para editar la base de datos
```

---

## Ruta de Desarrollo (Roadmap)

| Fase | Módulo | Estado |
|-------|--------|--------|
| 1-22 | Sistemas base: personal, clientes, productos, ventas físicas, abonos, planes de cuotas, logs de auditoría, PDF de cuentas y enlaces WhatsApp manuales. | ✅ Completado |
| 23 | **E-commerce**: Variantes, atributos de categorías, flujos de checkout, pasarela de pago Mercado Pago, OAuth con Google. | ✅ Completado |
| 24 | **Analíticas y Dashboard Admin**: Caching de vistas materializadas, retención por cohortes, LTV, rotaciones, experimentos de precios. | ✅ Completado |
| 25 | **Infraestructura de Alta Resiliencia**: Colas BullMQ/Redis, tareas programadas seguras, llaves de idempotencia, esquema DIAN, graceful shutdowns. | ✅ Completado |

---

## Paginación y Filtrado

Todos los listados GET soportan paginación opcional y filtros a través de la cadena de consulta (query string).

### Estructura de Respuesta

```json
{
  "data": [...],
  "pagination": {
    "total": 47,
    "page": 2,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

---

## Sistema de Precios

Los precios de las ventas físicas del personal se **fijan manualmente al momento de la venta**, mientras que las compras de e-commerce obtienen valores directamente de las variantes activas (`ProductVariant.retailPrice`) y aplican descuentos de cupones calculados en el servidor.

### Facturación de Tienda y Desglose de IVA (DIAN)

Los pedidos del e-commerce se resuelven utilizando precios con **IVA incluido (bruto)** según directrices DIAN. El servidor separa automáticamente subtotal e impuesto basándose en el IVA del producto o su categoría:

```
TotalBruto = SubtotalNeto + MontoIva
SubtotalNeto = TotalBruto / (1 + PorcentajeIva / 100)
MontoIva = TotalBruto - SubtotalNeto
```

---

## Sistema de Notificaciones

Al confirmar pagos o ventas de crédito, el sistema envía notificaciones mediante eventos de dominio asíncronos.

### Distribuidor de Fondo con BullMQ

Si `REDIS_URL` está configurado, las notificaciones se delegan a una cola de BullMQ en Redis. Un trabajador independiente (`npm run worker:notifications`) consume las tareas con reintentos y tolerancia a fallos, previniendo cuellos de botella en la API. Si Redis está inactivo, cae automáticamente a una ejecución secuencial e inline segura.

### Límite de Envío (Throttle)

El sistema aplica un control estricto que limita el envío a un **máximo de 3 notificaciones por cliente por hora**, evitando cargos excesivos de WhatsApp Meta o spam en correos.

---

## Sistema de Reportes PDF

La generación de estados de cuenta PDF se resuelve completamente en memoria a través de **PDFKit**. El dominio expone la interfaz `PdfService` garantizando que capas superiores desconozcan a PDFKit. Si se requiere reemplazar el motor de PDF, solo es necesario modificar el adaptador `src/infrastructure/services/pdfkit-pdf.service.ts`.

---

## Categorización de Productos y Atributos Dinámicos

Mapeo de productos a clasificaciones flexibles y atributos extensibles sin columnas fijas (`color`, `talla`, etc.) mediante relaciones en base de datos.

### Payload de Producto con Atributos

```json
{
  "id": "product-id",
  "name": "Sabana Premium",
  "categoryId": "category-id",
  "categoryName": "Sabanas",
  "attributes": [
    { "attribute": "Color", "value": "Rojo" },
    { "attribute": "Tamano", "value": "Queen" }
  ]
}
```

---

## Pasarela de Pago (Mercado Pago)

### Flujo Seguro de Validación de Webhooks

El servidor implementa un flujo estricto y seguro para procesar devoluciones de llamada de pagos externos:

```
POST /api/ecommerce/webhooks/mercadopago
  ├── express.raw() -> captura bytes del cuerpo crudo
  ├── Verificación HMAC -> timingSafeEqual para firmas
  ├── ProcessedWebhook -> protección contra doble procesamiento
  ├── GET /v1/payments/{paymentId} -> consulta directa a MP (nunca confía en el body enviado)
  └── Transacción Atómica -> Actualiza estado (PAID/CANCELLED) + registra ProcessedWebhook
```

---

## Comercio Electrónico y Carrito de Compras

### Tiempos de Vencimiento de Pedidos

Para resguardar las existencias reservadas frente a carritos huérfanos, el servidor ejecuta la tarea `OnlineOrderExpiryJob` cada 5 minutos:
- **ONLINE_GATEWAY (Mercado Pago)**: Expira a los **30 minutos** si no se registra pago.
- **WHATSAPP_MANUAL**: Expira a las **24 horas** si el cliente no envía el soporte.
- Al expirar, se liberan automáticamente las unidades retenidas de vuelta al inventario.

---

## Variantes y Recursos de Productos

### Modelo de Variación SKU

Las variantes se administran en la tabla `ProductVariant`, la cual rastrea stock, costo, precio, peso y almacena un hash de combinación (`attributeHash`). Los recursos visuales de las variantes (imágenes/videos) se enlazan mediante el gestor `ProductAsset`.

---

## Feature Flags (Banderas de Funcionalidad)

Interruptores en tiempo de ejecución que configuran dinámicamente las rutas de la API:
- `checkout_enabled` — Habilita/desactiva rutas de carrito y compras (retorna 503 si está apagado).
- `mp_enabled` — Controla el checkout por pasarela de Mercado Pago.
- `email_enabled` — Activa/desactiva envíos de correo.
- `whatsapp_enabled` — Activa/desactiva integraciones de WhatsApp Meta.
- `coupon_enabled` — Controla la validación de cupones de descuento.
- `fraud_strict_mode` — Fuerza reglas antifraude severas en compras.
- `credit_module_enabled` — Habilita funcionalidades de créditos del personal.
- `physical_sales_enabled` — Habilita ventas de contado/crédito físicas para el personal.

---

## Analíticas y Marketing de Administración

Las consultas se obtienen de vistas materializadas. Para forzar la actualización, el administrador puede realizar una petición a `POST /api/admin/analytics/read-models/refresh`:
- **Cohortes de Retención**: Mapea compras recurrentes en lapsos mensuales.
- **LTV de Clientes**: Suma compras consolidadas por comprador para identificar VIPs.
- **Márgenes de Utilidad**: Cruza costos de inversión (`investmentCost`) con ventas reales.
- **Alertas de Rotación**: Advierte sobre productos de bajo movimiento.
- **Experimentos A/B**: Configura precios alternativos y determina ganadores por conversión o ingresos.

---

## Tareas Programadas en Segundo Plano

Tareas recurrentes definidas en `app.ts` e impulsadas mediante intervalos con bloqueos de reentrada:
1. `OnlineOrderExpiryJob` — Vence pedidos impagos acumulados (intervalo de 5 min).
2. `AnalyticsReadModelsRefreshJob` — Refresca las vistas materializadas de analíticas de PostgreSQL (intervalo de 1 hora).
3. `BusinessAlertsEvaluationJob` — Evalúa métricas clave y despacha alertas de negocio `BUSINESS_ALERT_TRIGGERED` (intervalo de 15 min).

---

## Trabajadores Asíncronos BullMQ

Procesos de alta carga de trabajo (envíos de correos y cargas multimedia de WhatsApp) desacoplados a colas rápidas:
- **Ejecución**: Trabajadores escuchan conexiones mediante `npm run worker:notifications`.
- **Tolerancia a fallos**: Caída automática y transparente a ejecución síncrona si Redis no está configurado o falla.
- **Auditoría**: Intentos y fallos del despachador quedan registrados en la tabla `NotificationLog`.

---

## Protección de Idempotencia

Previene dobles cobros o duplicidades provocados por interrupciones de red en peticiones sensibles (ventas físicas, abonos de pago, órdenes de e-commerce) mediante cabeceras `Idempotency-Key`:
- Al recibir la petición, el servidor genera un hash SHA256 del cuerpo y almacena la respuesta HTTP asociada en `IdempotencyRecord`.
- Solicitudes repetidas que compartan la misma llave reciben la respuesta cacheada al instante, evitando reinserciones.

---

## Sistema SEO y Sitemap

Tienda en línea provista con optimizaciones dinámicas para motores de búsqueda:
- **Sitemap XML**: Generación dinámica en `GET /sitemap.xml` para indexación de productos y categorías activas.
- **Historial de Redirecciones**: Guarda slugs antiguos en `ProductSlugHistory` para responder con redirecciones 301 limpias, reteniendo el posicionamiento web (SEO).
- **Desempeño**: Emplea cabeceras `cachePublic` y controles estrictos de tasa para proteger al catálogo frente a scrapers agresivos.
