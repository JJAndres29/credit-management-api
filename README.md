# Credit Management System

> REST API for managing credit clients, sales, and payments for a retail business. Built with Node.js, TypeScript, Express, and PostgreSQL following **Clean Architecture** principles.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Security](#security)
- [Testing](#testing)
- [Scripts](#scripts)
- [Roadmap](#roadmap)
- [Pagination & Filtering](#pagination--filtering)
- [Pricing System](#pricing-system)
- [Notification System](#notification-system)
- [PDF Report System](#pdf-report-system)
- [Product Categorization & Dynamic Attributes](#product-categorization--dynamic-attributes)

---

## Overview

This system allows a retail business to manage credit operations for its clients. Staff members (admins and sellers) interact with the system through a private API. Clients themselves have no system access — they receive account statements externally via WhatsApp and email.

**What it handles:**
- Staff authentication and role-based authorization
- Client management with credit limits and balance tracking
- Product catalog management with stock control and multi-image uploads via Cloudinary
- Cash and credit sales with automatic stock deduction and client balance update (atomic transaction)
- **Manual pricing at sale time** — the seller sets the unit price for each item when creating a sale. The server computes subtotals and total; the frontend cannot override them
- Payment registration with automatic sale status update (PENDING → PARTIAL → PAID) and client balance reduction (atomic transaction)
- **Payment correction and deletion** — Admins can modify (`PUT /api/payments/:id`) or permanently delete (`DELETE /api/payments/:id`) any existing payment. Both operations atomically adjust the client balance, recompute the sale status, and write an audit entry (`PAYMENT_MODIFIED` / `PAYMENT_DELETED`) — all in a single transaction
- **Custom dates on sales and payments** — Any authenticated user can pass an optional `createdAt` (ISO 8601) when registering a sale or payment to record the real date of the operation. Admins can also correct the date of an existing payment via `PUT /api/payments/:id` using the same `createdAt` field. No schema change required — Prisma accepts an explicit `createdAt` and skips the `@default(now())` only when a value is provided
- **Sale metadata correction** — Admins can update collection-day fields (`collectionDay`, `collectionDay2`) and the sale date (`createdAt`) via `PUT /api/sales/:id`. This endpoint does not touch financial fields (total, status, items) — those only change through payments
- Immutable audit log of every balance-changing operation (credit sales, payments, and payment corrections), written atomically inside each transaction
- **Automatic notifications** — Email (via Nodemailer/Gmail) sent after every payment and credit sale, with the PDF account statement attached. WhatsApp integration is **dormant**: the backend pre-builds a `whatsappPayload { phone, message }` returned in every `POST /api/payments` and `POST /api/sales` (201) response so the frontend can open a `wa.me` Deep Link for manual sending. The Meta Cloud API send blocks are commented out and can be reactivated without touching business logic. Notifications are optional and best-effort: if the provider fails or credentials are missing, the financial operation is not affected
- **On-demand client notification** — Any authenticated user can trigger a notification to a client via `POST /api/clients/:id/notify`. Returns a `whatsappPayload` immediately for manual `wa.me` sending — the message includes full installment detail (sale number, initial date, credit amount, initial payment, paid installments, current balance) when an active credit plan exists. Asynchronously emails the client's full PDF account statement
- **PDF account statements** — On-demand PDF generation for any client via `GET /api/reports/account-statement/:clientId`. The PDF is generated in memory and streamed directly to the browser — nothing is ever saved to disk

---

## Architecture

The project follows **Clean Architecture**, organized in three strict layers. Inner layers never depend on outer layers.

```
┌──────────────────────────────────────────────────────┐
│                  Presentation Layer                   │
│      Express Routers · Controllers · Middlewares      │
├──────────────────────────────────────────────────────┤
│                    Domain Layer                       │
│   Entities · Use Cases · DTOs · Interfaces (ports)   │
├──────────────────────────────────────────────────────┤
│                Infrastructure Layer                   │
│     Prisma Datasources · Repository Implementations  │
│         Service Adapters (JWT · Cloudinary)          │
└──────────────────────────────────────────────────────┘
```

**Patterns applied:**

| Pattern | Purpose |
|---------|---------|
| **Repository** | Abstracts data access — swapping PostgreSQL requires no domain changes |
| **Use Case** | Each business action is an isolated, testable class |
| **Adapter** | External libraries (JWT, Cloudinary, Meta Cloud API, Nodemailer) implement domain interfaces — replace any library without touching business logic |
| **DTO** | Input validation happens at the system boundary before reaching use cases |
| **Dependency Injection** | Constructor-based throughout — no service locator or global state |
| **Domain Service (Installments)** | `InstallmentCalculatorService` lives in the domain layer — pure business logic, no framework or DB dependencies, fully unit-testable |
| **Domain Events** | Use cases emit events after committing transactions. Subscribers handle side effects (notifications) asynchronously — financial operations never wait for or fail because of notifications |
| **Domain Service (PDF)** | `PdfService` interface lives in the domain layer. `PdfkitPdfService` in infrastructure is the only file that knows about PDFKit. Replacing the PDF library requires changing only one file |

---

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Runtime | Node.js 20 |
| Language | TypeScript 5 (strict mode) |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Authentication | JWT (`jsonwebtoken`) |
| Password hashing | `bcryptjs` |
| File uploads | `multer` (memory storage) |
| Image hosting | Cloudinary (`cloudinary` v2) |
| Security headers | `helmet` |
| CORS | `cors` |
| Rate limiting | `express-rate-limit` |
| Testing | Jest + ts-jest |
| PDF generation | PDFKit |
| Logging | `pino` (JSON structured, ISO timestamps) |
| Dev server | ts-node-dev |
| Containerization | Docker (multi-stage, Node 20 Alpine) + Docker Compose (PostgreSQL) |

---

## Project Structure

```
credit-management-system/
├── prisma/
│   ├── schema.prisma              # 9 models: User, Client, Product, ProductImage, Sale, SaleItem, Payment, AuditLog
│   └── seed.ts                    # Creates default admin user
├── src/
│   ├── app.ts                     # Entry point
│   ├── config/
│   │   ├── envs.ts                # Validates required env vars at startup
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── regular-exp.ts         # Shared regex patterns (email, strong password)
│   ├── domain/                    # Pure business logic — no framework dependencies
│   │   ├── datasources/           # Abstract datasource interfaces
│   │   ├── types/
│   │   │   └── paginated.type.ts  # PaginatedResult<T> generic — returned by all paginated endpoints
│   │   ├── dtos/
│   │   │   ├── auth/              # LoginDto
│   │   │   ├── clients/           # CreateClientDto, UpdateClientDto, FilterClientsDto
│   │   │   ├── payments/          # CreatePaymentDto, FilterPaymentsDto
│   │   │   ├── products/          # CreateProductDto, UpdateProductDto, AdjustStockDto, FilterProductsDto
│   │   │   ├── sales/             # CreateSaleDto, FilterSalesDto
│   │   │   ├── shared/            # PaginationDto (page, limit, skip getter)
│   │   │   ├── audit-logs/        # FilterAuditLogsDto
│   │   │   └── users/             # CreateUserDto, UpdateUserDto, ChangePasswordDto
│   │   ├── entities/              # UserEntity, ClientEntity, ProductEntity, ProductImageEntity, SaleEntity, SaleItemEntity, PaymentEntity
│   │   ├── errors/                # CustomError with HTTP status factory methods
│   │   ├── repositories/          # Repository interfaces (ports)
│   │   ├── services/
│   │   │   └── ...                # JwtService, EmailService, NotificationService, PdfService, FileStorageService, InstallmentCalculatorService
│   │   └── use-cases/
│   │       ├── auth/              # LoginUseCase, RenewTokenUseCase
│   │       ├── clients/           # CreateClient, GetClients, GetClientById, UpdateClient, DeleteClient, NotifyClient
│   │       ├── audit-logs/        # GetAuditLogs, GetAuditLogsByClient
│   │       ├── payments/          # CreatePayment, GetPayments, GetPaymentById, GetPaymentsByClient, GetPaymentsBySale, UpdatePayment, DeletePayment
│   │       ├── products/          # GetProducts, GetProductById, CreateProduct, UpdateProduct, AdjustStock, DeleteProduct, UploadProductImages, DeleteProductImage
│   │       ├── reports/           # GenerateAccountStatement
│   │       ├── sales/             # CreateSale, GetSales, GetSaleById, GetSalesByClient
│   │       └── users/             # GetUsers, GetUserById, CreateUser, UpdateUser, ToggleUserStatus, ChangePassword
│   ├── infrastructure/            # Implements domain interfaces (adapters)
│   │   ├── datasources/           # PrismaAuthDatasource, PrismaClientDatasource, PrismaProductDatasource, PrismaUserDatasource, PrismaSaleDatasource, PrismaPaymentDatasource, PrismaAuditLogDatasource
│   │   ├── repositories/          # AuthRepositoryImpl, ClientRepositoryImpl, ProductRepositoryImpl, UserRepositoryImpl, SaleRepositoryImpl, PaymentRepositoryImpl, AuditLogRepositoryImpl
│   │   └── services/              # JwtAdapter, CloudinaryAdapter, MetaWhatsAppService, TwilioWhatsAppService (legacy/unused), NodemailerEmailService, PdfkitPdfService, PinoLoggerService
│   └── presentation/              # HTTP layer
│       ├── auth/                  # AuthController, AuthRouter
│       ├── audit-logs/            # AuditLogController, AuditLogRouter
│       ├── clients/               # ClientController, ClientRouter
│       ├── payments/              # PaymentController, PaymentRouter
│       ├── products/              # ProductController, ProductRouter
│       ├── health/                # HealthRouter (GET /health — public, Prisma SELECT 1)
│       ├── reports/               # ReportController, ReportRouter
│       ├── sales/                 # SaleController, SaleRouter
│       ├── users/                 # UserController, UserRouter
│       ├── middlewares/
│       │   ├── auth.middleware.ts         # JWT validation + DB user check
│       │   ├── rbac.middleware.ts         # Role-based access control (checkRole)
│       │   ├── rate-limit.middleware.ts   # Login rate limiter
│       │   └── upload.middleware.ts       # Multer: memory storage, file type + size validation
│       └── server.ts              # Express app setup (helmet, cors, body limit, routes)
├── .env.template                  # Environment variables template
├── Dockerfile                     # Multi-stage build (builder + production, Node 20 Alpine)
├── .dockerignore
├── docker-compose.yml             # PostgreSQL 16 container
├── jest.config.js
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm

### 1. Clone the repository

```bash
git clone <repository-url>
cd credit-management-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.template .env
```

Open `.env` and set your values. At minimum, generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

See [Environment Variables](#environment-variables) for the full reference.

### 4. Start the database

```bash
docker-compose up -d
```

This starts a PostgreSQL 16 container on port `5433`.

### 5. Run migrations

```bash
npm run db:migrate
```

### 6. Seed the default admin user

```bash
npm run db:seed
```

| Field | Value |
|-------|-------|
| Email | `admin@credit.com` |
| Password | `Admin1234!` |
| Role | `ADMIN` |

> Change these credentials immediately in any non-local environment.

### 7. Start the development server

```bash
npm run dev
```

API available at: `http://localhost:3000`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (e.g. `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret — use 64+ random hex chars in production |
| `JWT_EXPIRES_IN` | Yes | Token TTL (e.g. `7d`, `24h`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Defaults to `localhost:4200,localhost:5173` |
| `CLOUDINARY_CLOUD_NAME` | Yes* | Required for product image uploads |
| `CLOUDINARY_API_KEY` | Yes* | Required for product image uploads |
| `CLOUDINARY_API_SECRET` | Yes* | Required for product image uploads |
| `MAILER_EMAIL` | No† | Gmail address used as the sender: `youraddress@gmail.com` |
| `MAILER_SECRET_KEY` | No† | Gmail App Password (16 chars). Generate at: Google Account → Security → 2-Step Verification → App passwords. **Not your Gmail password** |
| `MAILER_SERVICE` | No | Email provider (default: `gmail`) |
| `META_WHATSAPP_TOKEN` | No‡ | Permanent System User Token from Meta Business. Generate at: Meta Business Suite → Settings → System Users → Generate Token (with `whatsapp_business_messaging` permission) |
| `META_WHATSAPP_PHONE_NUMBER_ID` | No‡ | Phone Number ID (not the number itself) — found in Meta Business Suite → WhatsApp → API Setup |

> \* Required if you use the `POST /api/products/:id/images` endpoint.
> † Both `MAILER_EMAIL` and `MAILER_SECRET_KEY` must be set together to enable email notifications. If either is missing, the server starts normally with a warning and emails are skipped.
> ‡ Both Meta variables must be set together to enable WhatsApp notifications. Same behavior — missing vars = warning + feature disabled, no crash.

---

## Database Schema

```
User             — System staff with role (ADMIN | SELLER)
Client           — Credit customers: credit limit, current balance, contact info
Product          — Inventory items: name, stock count, optional retailPrice (suggested display price — not used in sale calculations)
ProductImage     — Product photos: Cloudinary URL, publicId, display order (one product → many images)
Sale             — Orders per client: type (CASH | CREDIT), status (PAID | PENDING | PARTIAL), optional installment plan and collection days
SaleItem         — Line items per sale: product, quantity, basePrice (price at sale time), unitPrice, subtotal
Payment          — Payments per client/sale: amount, optional note
AuditLog         — Immutable log of balance changes: user, IP, before/after values
NotificationLog  — Log of every notification attempt: channel (WHATSAPP|EMAIL), event, status (SENT|FAILED), errorMessage
```

**`SaleItem` price fields:**

| Field | Description |
|-------|-------------|
| `basePrice` | Price set by the seller at the time of the sale — immutable, for audit purposes |
| `unitPrice` | Same as `basePrice` — the manually entered price per unit |
| `appliedRule` | Always `null` — no automatic pricing rule is applied; price is set manually |

**`Sale` installment + collection day fields:**

| Field | Description |
|-------|-------------|
| `installmentsCount` | Number of installments agreed (null if no plan) |
| `frequency` | `MONTHLY`, `BIWEEKLY`, or `WEEKLY` (null if no plan) |
| `installmentAmount` | `(total - initialPayment) / installmentsCount`, rounded to 2 decimals |
| `initialPayment` | Down payment applied at sale creation time (null if none) |
| `collectionDay` | Day of the month for billing (1-31). MONTHLY: the single day; BIWEEKLY: first day |
| `collectionDay2` | Second billing day (1-31), BIWEEKLY plans only |

**Enums:**

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `SELLER` |
| `SaleType` | `CASH`, `CREDIT` |
| `SaleStatus` | `PAID`, `PENDING`, `PARTIAL` |
| `InstallmentFrequency` | `MONTHLY`, `BIWEEKLY`, `WEEKLY` |

All entities use **soft deletes** (`isActive` flag) — no data is ever permanently removed.

**ProductImage relation:**

`ProductImage` stores each photo separately, linked to its product by `productId`. The `order` field controls display priority (0 = cover/primary image). Uploading multiple images in a single request assigns sequential `order` values starting after the last existing image.

---

## API Reference

Base URL: `http://localhost:3000/api`

### Health check

```http
GET /health
```

**Response `200`:**
```json
{ "status": "ok" }
```

No authentication required.

---

### Authentication

#### POST `/api/auth/login`

Authenticate and receive a JWT.

> Rate limited: **10 requests per 15 minutes per IP**.

**Request body:**
```json
{
  "email": "admin@credit.com",
  "password": "Admin1234!"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Administrador",
    "email": "admin@credit.com",
    "role": "ADMIN"
  }
}
```

**Response `401`:** `{ "error": "Credenciales inválidas" }` — same message whether email or password is wrong (prevents email enumeration).

**Response `429`:** Rate limit exceeded.

---

#### POST `/api/auth/renew`

Exchange a valid JWT for a new one (extends session).

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** Same structure as login response with a fresh token.

---

### Customer Authentication

These endpoints are for the E-commerce platform (customers).

#### POST `/api/customer-auth/register`

Register a new customer account using local credentials.

> Rate limited: **10 requests per 15 minutes**.

**Request body:**
```json
{
  "name": "Ana García",
  "email": "ana@example.com",
  "password": "StrongPassword1!",
  "phone": "+573001234567"
}
```

**Response `201`:** Returns token and customer data.
**Response `409`:** Returns conflict error. If the email is already registered via Google without a password, it will indicate the user should sign in via Google or recover their password.

#### POST `/api/customer-auth/login`

Authenticate a customer using email and password.

> Rate limited: **10 requests per 15 minutes**.

**Response `401`:** `{ "error": "Credenciales inválidas" }` — Anti-enumeration protection.

#### POST `/api/customer-auth/google`

Authenticate or register a customer using Google OAuth 2.0.

> Rate limited: **10 requests per 15 minutes**.

**Request body:**
```json
{
  "idToken": "eyJhbG..."
}
```

**Response `200`:** Returns token and customer data.

#### POST `/api/customer-auth/forgot-password`

Request a password reset for a local account.

**Request body:**
```json
{
  "email": "ana@example.com"
}
```

**Response `200`:** Returns success message regardless of whether the email exists (anti-enumeration).

#### PATCH `/api/customer-auth/change-password`

Change the password for the currently authenticated customer.

> Requires Customer JWT.

**Request body:**
```json
{
  "currentPassword": "OldPassword1!",
  "newPassword": "NewPassword1!"
}
```

#### GET `/api/customer-auth/me`

Get the authenticated customer's profile and linked client summary (if any).

> Requires Customer JWT.

---
### Products

All product endpoints require `Authorization: Bearer <token>`.

> Endpoints that modify data (`POST`, `PUT`, `PATCH`, `DELETE`) require `ADMIN` role. `GET` endpoints are available to any authenticated user.

#### GET `/api/products`

Returns active products with their images, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `search` | string | Filter by product name (case-insensitive) |
| `minStock` | integer | Minimum stock |
| `maxStock` | integer | Maximum stock |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Camisa Azul",
      "stock": 100,
      "retailPrice": 59900,
      "images": [
        {
          "id": "uuid",
          "productId": "uuid",
          "url": "https://res.cloudinary.com/...",
          "publicId": "products/abc123",
          "order": 0,
          "createdAt": "2026-04-07T00:00:00.000Z"
        }
      ],
      "isActive": true,
      "createdAt": "2026-04-07T00:00:00.000Z",
      "updatedAt": "2026-04-07T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/products/:id`

Returns a single active product with its images.

**Response `404`:** Product not found or inactive.

---

#### POST `/api/products`

Create a new product. Images are added separately via `POST /:id/images`.

> **Requires `ADMIN` role.**

**Request body:**
```json
{
  "name": "Camisa Azul",
  "stock": 100
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `stock` | number | No | Integer >= 0, defaults to `0` |
| `categoryId` | string | No | Must reference an existing category |

> Products have no fixed price. The seller sets the price per unit when creating each sale. `retailPrice` is an optional reference price set separately via `PATCH /:id/retail-price`.

**Response `201`:** Created product object with empty `images` array.

---

#### PUT `/api/products/:id`

Update the product name. Use dedicated endpoints for stock (`PATCH /:id/stock`) and images (`POST /:id/images`). Products no longer have a fixed price — prices are set at sale time.

> **Requires `ADMIN` role.**

**Request body:**
```json
{
  "name": "Camisa Azul Premium"
}
```

**Response `404`:** Product not found or inactive.

---

#### PATCH `/api/products/:id/stock`

Adjust stock by a positive or negative integer. The use case validates the resulting stock never goes below 0.

> **Requires `ADMIN` role.**

**Request body:**
```json
{ "quantity": -10 }
```

| Field | Type | Validation |
|-------|------|-----------|
| `quantity` | integer | Non-zero. Positive to add, negative to subtract |

**Response `400`:** Insufficient stock (would result in negative stock).

**Response `404`:** Product not found or inactive.

---

#### PATCH `/api/products/:id/retail-price`

Set or clear the suggested retail price (precio de vitrina) for a product. This is a reference price shown to staff — the actual sale price is still set manually per item when creating a sale.

> **Requires `ADMIN` role.**

**Request body:**
```json
{ "retailPrice": 59900 }
```

To clear the price:
```json
{ "retailPrice": null }
```

| Field | Type | Validation |
|-------|------|-----------|
| `retailPrice` | number \| null | Required field. If number: must be > 0, max 2 decimal places. Pass `null` to clear |

**Response `200`:** Updated product object with the new `retailPrice`.

**Response `400`:** Validation error (missing field, negative value, more than 2 decimals).

**Response `404`:** Product not found or inactive.

---

#### POST `/api/products/:id/images`

Upload one or more images for a product. Images are stored in Cloudinary and referenced in the `ProductImage` table. Each request can include up to **5 files**. Multiple calls accumulate — existing images are preserved.

> **Requires `ADMIN` role.**

**Request:** `multipart/form-data`

| Field | Type | Details |
|-------|------|---------|
| `images` | file(s) | 1–5 files. Accepted formats: **JPG, PNG, WebP**. Max size per file: **5 MB** |

**Response `200`:** Updated product object with all images (including newly uploaded ones), sorted by `order` ascending.

**Response `400`:** No files sent, invalid format, or file exceeds 5 MB.

**Response `404`:** Product not found or inactive.

---

#### DELETE `/api/products/:id/images/:imageId`

Delete a specific image. The file is permanently removed from Cloudinary before the database record is deleted. If Cloudinary deletion fails, the database record is not touched.

> **Requires `ADMIN` role.**

**Response `200`:** Updated product object without the deleted image.

**Response `404`:** Product not found, or image does not belong to this product.

---

#### DELETE `/api/products/:id`

Soft delete — sets `isActive = false`. The product (and its images) remain in the database and are preserved for historical sale records.

> **Requires `ADMIN` role.**

---

### Clients

All client endpoints require `Authorization: Bearer <token>`.

#### GET `/api/clients`

Returns active clients, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `search` | string | Filter by name, phone, or email (case-insensitive) |
| `minBalance` | number | Minimum balance |
| `maxBalance` | number | Maximum balance |
| `hasDebt` | boolean | `true` = clients with balance > 0; `false` = clients with balance = 0 |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "María García",
      "phone": "3001234567",
      "email": "maria@ejemplo.com",
      "creditLimit": 500000,
      "balance": 150000,
      "isActive": true,
      "createdAt": "2026-04-06T00:00:00.000Z",
      "updatedAt": "2026-04-06T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 18,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/clients/:id`

**Response `404`:** Client not found or inactive.

---

#### POST `/api/clients`

Create a new client.

**Request body:**
```json
{
  "name": "María García",
  "phone": "3001234567",
  "email": "maria@ejemplo.com",
  "creditLimit": 500000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `phone` | string | Yes | |
| `email` | string | No | Valid format, must be unique |
| `creditLimit` | number | Yes | >= 0 |

**Response `201`:** Created client object.

**Response `409`:** Email already registered.

---

#### PUT `/api/clients/:id`

Update one or more fields. At least one field required.

**Request body (all fields optional):**
```json
{
  "name": "María García López",
  "phone": "3009876543",
  "email": "nuevo@ejemplo.com",
  "creditLimit": 750000
}
```

---

#### DELETE `/api/clients/:id`

Soft delete — sets `isActive = false`. Client history is preserved.

> **Requires `ADMIN` role.** Returns `403` for `SELLER` accounts.

---

#### POST `/api/clients/:id/notify`

Send the client a reminder of their current account status. Returns a `whatsappPayload` synchronously for the frontend to open a `wa.me` deep link. Asynchronously generates the PDF account statement and emails it to the client (if email credentials are configured and the client has an email address).

**Request body:** none required.

**Response `200`:**
```json
{
  "message": "Notificación enviada",
  "whatsappPayload": {
    "phone": "573001234567",
    "message": "Hola María, te informamos que tu saldo actual es $150.000..."
  }
}
```

`whatsappPayload` is `null` if the client has no phone number.

**Response `404`:** Client not found or inactive.

**Business rules:**
- Any authenticated user (ADMIN or SELLER) can trigger this endpoint — no ADMIN role required
- The email is sent asynchronously after the HTTP response is returned — it never delays or blocks the response
- If email is not configured or the client has no email address, the endpoint still returns `200` with the `whatsappPayload`

---

### Sales

All sales endpoints require `Authorization: Bearer <token>`. Any authenticated user (ADMIN or SELLER) can create and view sales.

#### GET `/api/sales`

Returns sales with their line items, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `clientId` | string | Filter by client ID |
| `type` | string | `CASH` or `CREDIT` |
| `status` | string | `PAID`, `PENDING`, or `PARTIAL` |
| `dateFrom` | string | ISO 8601 date — start of range (inclusive) |
| `dateTo` | string | ISO 8601 date — end of range (inclusive, adjusted to 23:59:59) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "type": "CREDIT",
      "status": "PENDING",
      "total": 135000,
      "createdAt": "2026-04-08T00:00:00.000Z",
      "items": [
        {
          "id": "uuid",
          "saleId": "uuid",
          "productId": "uuid",
          "quantity": 3,
          "unitPrice": 45000,
          "subtotal": 135000
        }
      ]
    }
  ],
  "pagination": {
    "total": 63,
    "page": 1,
    "limit": 20,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/sales/client/:clientId`

Returns all sales for a specific client, sorted by creation date (newest first). Returns `404` if the client does not exist or is inactive.

---

#### GET `/api/sales/:id`

Returns a single sale with its line items. Returns `404` if not found.

---

#### DELETE `/api/sales/:id`

Permanently delete a sale. Only allowed when the sale has **no associated payments** — this guarantees no complex balance cascade is needed. For CREDIT sales, the client balance is reverted and a `SALE_DELETED` audit log entry is written. For CASH sales, only the product stock is restored. All operations run in a single atomic transaction.

> **Requires `ADMIN` role.**

**Business rules applied:**
- The sale must have no payments. If any payment exists, `400` is returned — delete the payments first
- CREDIT sales: decrements the client balance by `sale.total` and writes a `SALE_DELETED` audit entry
- CASH sales: restores product stock only (CASH sales never modify client balance)
- Product stock is incremented by `item.quantity` for every line item, regardless of sale type

**Response `200`:** The deleted sale object (with its items).

**Response `400`:** Sale has existing payments and cannot be deleted.

**Response `403`:** Authenticated but not ADMIN.

**Response `404`:** Sale not found.

---

#### PUT `/api/sales/:id`

Update non-financial metadata of a sale: collection days and/or sale date. Does not modify total, status, or line items.

> **Requires `ADMIN` role.**

**Request body (at least one field required):**
```json
{
  "collectionDay": 15,
  "collectionDay2": 30,
  "createdAt": "2026-04-20T23:30:00-05:00"
}
```

| Field | Type | Validation |
|-------|------|-----------|
| `collectionDay` | integer \| null | 1–31. Pass `null` to clear |
| `collectionDay2` | integer \| null | 1–31, BIWEEKLY plans only. Pass `null` to clear |
| `createdAt` | string | ISO 8601. Corrects the recorded date of the sale |

**Business rules:**
- `collectionDay2` can only be set on sales with `frequency: BIWEEKLY`
- Financial fields (total, status, items, client balance) are never touched by this endpoint

**Response `200`:** Updated sale object.

**Response `400`:** Validation error or `collectionDay2` on a non-BIWEEKLY sale.

**Response `404`:** Sale not found.

---

#### POST `/api/sales`

Create a new sale. The seller sets the unit price for each item at the time of the sale. Each item can reference an **existing product** (`productId`) or create a **new product inline** (`newProduct`) — both are mutually exclusive per item.

**Request body — existing products:**
```json
{
  "clientId": "uuid",
  "type": "CREDIT",
  "items": [
    { "productId": "uuid", "quantity": 3, "unitPrice": 45.00 },
    { "productId": "uuid", "quantity": 1, "unitPrice": 120.50 }
  ],
  "installmentsCount": 6,
  "frequency": "BIWEEKLY",
  "collectionDay": 15,
  "collectionDay2": 30
}
```

**Request body — inline product creation:**
```json
{
  "clientId": "uuid",
  "type": "CASH",
  "items": [
    {
      "newProduct": { "name": "Camisa Azul", "stock": 20 },
      "quantity": 3,
      "unitPrice": 45.00
    }
  ]
}
```

Items can be mixed — some referencing existing products and others creating new ones in the same request.

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `clientId` | string | Yes | Client must exist and be active |
| `type` | string | Yes | `CASH` or `CREDIT` |
| `items` | array | Yes | Min 1 item. Cannot mix `productId` and `newProduct` in the same item |
| `items[].productId` | string | Yes* | Existing product — must exist, be active, and have sufficient stock. *Required if `newProduct` not provided |
| `items[].newProduct` | object | Yes* | Inline product to create. *Required if `productId` not provided |
| `items[].newProduct.name` | string | Yes | Min 2 characters. No duplicate names in same request |
| `items[].newProduct.stock` | integer | Yes | Integer ≥ 0. Must be ≥ `quantity` (stock to add; quantity is deducted from it) |
| `items[].quantity` | integer | Yes | Positive integer |
| `items[].unitPrice` | number | Yes | Price per unit set by the seller (> 0) |
| `installmentsCount` | integer | No | ≥ 2. Only for `CREDIT` sales. Requires `frequency` |
| `frequency` | string | No | `MONTHLY`, `BIWEEKLY`, or `WEEKLY`. Requires `installmentsCount` |
| `collectionDay` | integer | No | Billing day. MONTHLY/BIWEEKLY: day of month 1–31; WEEKLY: day of week 1–7 (1=Mon, 7=Sun). Requires plan |
| `collectionDay2` | integer | No | 1–31. Second billing day of month. `BIWEEKLY` only. Requires `collectionDay` |

**Business rules applied:**
- Stock is verified before creating the sale — insufficient stock returns `400`
- **`total` is always computed server-side** as `sum(unitPrice × quantity)` — the frontend cannot override it
- For `CREDIT` sales: `client.creditLimit - client.balance >= total`, otherwise `400`
- All operations (new product creation, stock deduction, balance update, sale + items creation) run in a **single atomic database transaction** — if anything fails, no product is created and no stock is changed
- Inline new products (`newProduct`) are created atomically within the sale transaction: the product lands in inventory with `stock - quantity` remaining after the sale
- `CASH` sales are created with status `PAID`. `CREDIT` sales start as `PENDING`
- Each `SaleItem` records `basePrice = unitPrice` and `appliedRule = null` for audit traceability

**Response `201`:** Created sale object with items. Each item includes `basePrice` and `unitPrice`.

**Response `400`:** Validation error, insufficient stock, or insufficient credit.

**Response `404`:** Client or any product not found.

---

### Payments

All payment endpoints require `Authorization: Bearer <token>`. Any authenticated user (ADMIN or SELLER) can register and view payments.

#### GET `/api/payments`

Returns payments, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `clientId` | string | Filter by client ID |
| `saleId` | string | Filter by sale ID |
| `dateFrom` | string | ISO 8601 date — start of range (inclusive) |
| `dateTo` | string | ISO 8601 date — end of range (inclusive) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "saleId": "uuid",
      "amount": 50000,
      "note": "Abono parcial",
      "createdAt": "2026-04-08T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 31,
    "page": 1,
    "limit": 20,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/payments/client/:clientId`

Returns all payments for a specific client, sorted by creation date (newest first). Returns `404` if the client does not exist.

---

#### GET `/api/payments/sale/:saleId`

Returns all payments associated with a specific sale. Returns `404` if the sale does not exist.

---

#### GET `/api/payments/:id`

Returns a single payment. Returns `404` if not found.

---

#### POST `/api/payments`

Register a payment from a client. Optionally links the payment to a specific sale, which triggers an automatic sale status update.

**Request body:**
```json
{
  "clientId": "uuid",
  "amount": 50000,
  "saleId": "uuid",
  "note": "Abono parcial"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `clientId` | string | Yes | Client must exist and be active |
| `amount` | number | Yes | Greater than 0, max 2 decimal places |
| `saleId` | string | No | If provided, sale must exist, belong to the client, and not be `PAID` |
| `note` | string | No | Max 500 characters |
| `createdAt` | string | No | ISO 8601. Records the real date of the payment. If omitted, uses server time |

**Business rules applied:**
- `amount` cannot exceed the client's current `balance` (prevents overpayment)
- If `saleId` is provided: the sale must belong to the same `clientId` (prevents cross-client manipulation), and `amount` cannot exceed the remaining unpaid amount on that sale
- All operations (payment creation, client balance decrement, sale status update) run in a **single atomic database transaction**
- Sale status is computed inside the transaction by summing all payments for that sale: if `totalPaid >= sale.total` → `PAID`, otherwise → `PARTIAL`

**Response `201`:** Created payment object.

**Response `400`:** Validation error, amount exceeds client balance, sale already paid, or amount exceeds sale's remaining balance.

**Response `403`:** Sale does not belong to the specified client.

**Response `404`:** Client or sale not found.

---

#### PUT `/api/payments/:id`

Modify an existing payment's `amount` and/or `note`. All changes are applied atomically: the client balance is recalculated using delta math, the associated sale's status is recomputed, and a `PAYMENT_MODIFIED` audit log entry is written — all in a single database transaction.

> **Requires `ADMIN` role.**

**Request body (at least one field required):**
```json
{
  "amount": 75000,
  "note": "Corrección — monto ingresado incorrectamente"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `amount` | number | No | Greater than 0, max 2 decimal places. Cannot exceed the client's adjusted balance |
| `note` | string \| null | No | Max 500 characters. Pass `null` to clear the note |
| `createdAt` | string | No | ISO 8601. Corrects the recorded date of the payment |

**Business rules applied:**
- `delta = oldAmount - newAmount`. The client balance is adjusted by `balance + delta`. The resulting balance cannot go below 0 (rejects if new amount exceeds what the client actually owes)
- If the payment is linked to a sale: the new amount cannot exceed the sale total minus other payments on that sale
- If the payment is linked to a sale: the sale status is recomputed inside the transaction from the sum of all its payments (PENDING / PARTIAL / PAID)
- An `AuditLog` entry with `action: PAYMENT_MODIFIED` is written inside the same transaction, recording `before` and `after` balance, `userId`, and request IP

**Response `200`:** Updated payment object.

**Response `400`:** Validation error, new amount exceeds client balance, or new amount exceeds sale's adjusted total.

**Response `404`:** Payment not found.

---

#### DELETE `/api/payments/:id`

Permanently delete a payment. The client's balance is restored and the associated sale's status is recomputed, all in a single atomic transaction. A `PAYMENT_DELETED` audit log entry is written.

> **Requires `ADMIN` role.**

**Business rules applied:**
- The client's balance is incremented by the deleted payment's amount (the client owes that amount again)
- If the payment was linked to a sale: the sale status is recomputed from remaining payments (PENDING / PARTIAL / PAID)
- An `AuditLog` entry with `action: PAYMENT_DELETED` is written inside the same transaction, recording `before` and `after` balance, `userId`, and request IP

**Response `200`:** The deleted payment object.

**Response `404`:** Payment not found.

---

### Audit Logs

All audit log endpoints require `Authorization: Bearer <token>` and **`ADMIN` role**.

Audit log entries are created automatically inside the atomic transactions of credit sales and payments — there is no public creation endpoint. The log records every client balance change with who triggered it, from which IP, and the before/after values.

#### GET `/api/audit-logs`

Returns audit log entries, sorted by creation date (newest first). Supports pagination and filters.

> **Requires `ADMIN` role.**

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `clientId` | string | Filter by client ID |
| `userId` | string | Filter by user (staff member) who triggered the operation |
| `action` | string | `CREDIT_SALE` or `PAYMENT` |
| `dateFrom` | string | ISO 8601 date — start of range (inclusive) |
| `dateTo` | string | ISO 8601 date — end of range (inclusive) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "userId": "uuid",
      "action": "PAYMENT",
      "before": 150000,
      "after": 100000,
      "ip": "::1",
      "createdAt": "2026-04-08T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 9,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

| `action` value | Meaning |
|----------------|---------|
| `CREDIT_SALE` | Client balance increased — a credit sale was registered |
| `PAYMENT` | Client balance decreased — a payment was registered |
| `PAYMENT_MODIFIED` | Client balance adjusted — an existing payment's amount was corrected by an admin |
| `PAYMENT_DELETED` | Client balance restored — a payment was permanently deleted by an admin |
| `SALE_DELETED` | Client balance reverted — a credit sale with no payments was permanently deleted by an admin |

---

#### GET `/api/audit-logs/client/:clientId`

Returns all audit log entries for a specific client. Returns `404` if the client does not exist.

> **Requires `ADMIN` role.**

---

### Users

All user endpoints require `Authorization: Bearer <token>`.

> Most endpoints require `ADMIN` role. The only exception is `PATCH /:id/password`, which allows the authenticated user to change their own password.

#### GET `/api/users`

Returns all users (active and inactive), sorted by creation date.

> **Requires `ADMIN` role.**

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Juan Vendedor",
    "email": "juan@empresa.com",
    "role": "SELLER",
    "isActive": true,
    "createdAt": "2026-04-07T00:00:00.000Z",
    "updatedAt": "2026-04-07T00:00:00.000Z"
  }
]
```

Password is never included in any response.

---

#### GET `/api/users/:id`

> **Requires `ADMIN` role.**

**Response `404`:** User not found.

---

#### POST `/api/users`

Create a new user (admin or seller).

> **Requires `ADMIN` role.**

**Request body:**
```json
{
  "name": "Juan Vendedor",
  "email": "juan@empresa.com",
  "password": "Password123!",
  "role": "SELLER"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `email` | string | Yes | Valid format, must be unique |
| `password` | string | Yes | Min 8 chars, uppercase, lowercase, number, special character |
| `role` | string | No | `ADMIN` or `SELLER` (defaults to `SELLER`) |

**Response `201`:** Created user object (no password).

**Response `409`:** Email already registered.

---

#### PUT `/api/users/:id`

Update one or more fields. At least one field required. Password changes use a dedicated endpoint.

> **Requires `ADMIN` role.**

**Request body (all fields optional):**
```json
{
  "name": "Juan Vendedor Actualizado",
  "email": "nuevo@empresa.com",
  "role": "ADMIN"
}
```

---

#### PATCH `/api/users/:id/status`

Activate or deactivate a user. Deactivated users are immediately blocked from all endpoints.

> **Requires `ADMIN` role.**

**Request body:**
```json
{ "isActive": false }
```

**Response `400`:** User is already in the requested state.

---

#### PATCH `/api/users/:id/password`

Change a user's password.

> **Allowed for:** the authenticated user changing their own password, or any `ADMIN` changing anyone's password.

**Request body:**
```json
{
  "currentPassword": "Password123!",
  "newPassword": "NuevoPassword456@"
}
```

**Response `200`:** `{ "message": "Contraseña actualizada correctamente" }`

**Response `401`:** Current password is incorrect.

**Response `400`:** New password is the same as the current one, or does not meet the password policy.

---

### Reports

All report endpoints require `Authorization: Bearer <token>` and **`ADMIN` role**.

#### GET `/api/reports/account-statement/:clientId`

Generates and downloads the full account statement for a client as a PDF file.

> **Requires `ADMIN` role.**

**Response `200`:** Binary PDF file.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="estado-cuenta-{clientId}.pdf"` |

**PDF contents:**
1. **Header** — Business name, generation date and time, name of the user who generated it
2. **Client info** — Name, phone, email, client ID
3. **Credit usage bar** — Visual bar with percentage used: green (<50%), amber (50–80%), red (>80%). Shows debt, available credit, and limit
4. **Sales table** — Each sale shows ID, date, type (Contado/Crédito), status (color-coded), and total. Sub-rows list each line item: product name, quantity, unit price, subtotal
5. **Payments table** — Each payment shows ID, date, amount, note, and associated sale ID
6. **Financial summary** — Three cards: total sales, total paid, current balance
7. **Footer** — Exact generation timestamp, marked "Confidencial"

**Automatic page breaks:** The generator checks available vertical space before each section and adds a new page if needed — tables are never cut mid-row.

**Response `403`:** Not authenticated or not ADMIN.

**Response `404`:** Client not found.

---

### Error format

All errors follow this consistent structure:

```json
{ "error": "Descriptive error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error |
| `401` | Missing, invalid, or expired token |
| `403` | Authenticated but insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Security

### Implemented measures

| Measure | Details |
|---------|---------|
| **Password hashing** | bcryptjs, 10 salt rounds |
| **JWT authentication** | Signed tokens verified on every protected request |
| **Active user check** | On every request: token validity + user confirmed active in DB |
| **Anti-enumeration** | Login always returns the same error regardless of whether the email exists |
| **Role-based access control** | Per-endpoint role enforcement (`ADMIN` / `SELLER`) |
| **Rate limiting** | Login: max 10 attempts / 15 min per IP |
| **Security headers** | `helmet` sets `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`, and more |
| **CORS whitelist** | Configurable via `ALLOWED_ORIGINS` — defaults to localhost dev ports |
| **Request body size limit** | 10 KB cap — prevents payload-based DoS |
| **Strong password policy** | Enforced at user creation: min 8 chars + uppercase + lowercase + number + special character |
| **SQL injection prevention** | Prisma ORM uses parameterized queries exclusively |
| **No hardcoded secrets** | All sensitive values from environment variables; server refuses to start if any required variable is missing |
| **Soft deletes** | Data is never permanently deleted — full history preserved |
| **File upload validation** | Multer enforces allowed MIME types (JPG, PNG, WebP), 5 MB per-file limit, and max 5 files per request — malformed or oversized uploads are rejected before reaching business logic |
| **Cloudinary-side storage** | Uploaded images never touch the server disk — processed in memory and streamed to Cloudinary, eliminating local file exposure |
| **Image ownership check** | `DELETE /products/:id/images/:imageId` verifies the image belongs to the specified product before deletion |
| **Cross-client payment prevention** | `POST /payments` validates that the provided `saleId` belongs to the same `clientId` in the request body — prevents a malicious actor from linking a payment to another client's sale |
| **Payment overpayment protection** | Amount is validated against both the client's total balance and the specific sale's remaining balance before the transaction executes |

| **Immutable audit log** | Every credit sale and payment writes an `AuditLog` entry inside the same atomic transaction — records `userId`, `clientId`, `action`, `before`/`after` balance, and request IP. If the operation rolls back, the log entry rolls back too |

### Planned

- Refresh token + short-lived access tokens (15 min access / 7 day refresh)
- Account lockout after N consecutive failed login attempts
- Structured security event logging (login failures, invalid tokens)

---

## Testing

Tests are written with **Jest + ts-jest** and located alongside the code they test (`*.test.ts`).

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (re-runs on file save)
```

### Current coverage — 99 tests across 6 suites

| Module | File | Tests |
|--------|------|-------|
| `LoginUseCase` | `src/domain/use-cases/auth/login.use-case.test.ts` | 6 — invalid user, inactive user, wrong password, success, token payload, password not exposed |
| `RenewTokenUseCase` | `src/domain/use-cases/auth/renew-token.use-case.test.ts` | 5 — invalid user, inactive user, success, payload, password not exposed |
| `CreateSaleUseCase` | `src/domain/use-cases/sales/create-sale.use-case.test.ts` | 22 — client/product not found, inactive product, insufficient stock/credit, CASH (no event, no auditLog, unitPrice used directly), CREDIT (event emitted, auditLog, appliedRule null), collectionDay passed for MONTHLY and BIWEEKLY |
| `CreatePaymentUseCase` | `src/domain/use-cases/payments/create-payment.use-case.test.ts` | 22 — inactive client, amount > balance, foreign sale (403), PAID sale, overpayment, full/partial/general payment, auditLog, PAYMENT_REGISTERED event |
| `PaymentNotificationSubscriber` / `SaleNotificationSubscriber` | `src/infrastructure/subscribers/notification-subscribers.test.ts` | 25 — WhatsApp disabled (not called), Email resilience, FAILED logs with errorMessage, PDF attachment, throttle (4th notification blocked), client with no phone/email, client not found in DB |
| `GenerateAccountStatementUseCase` | `src/domain/use-cases/reports/generate-account-statement.use-case.test.ts` | 20 — client not found, parallel queries, client with no sales, product deduplication across sales, fallback name for deleted products, generatedBy propagated, Buffer returned |
| User / Client / Product use cases | — | Pending |
| DTOs | — | Pending |

---

## Scripts

```bash
npm run dev             # Start dev server with hot reload
npm run build           # Compile TypeScript → dist/
npm start               # Run compiled production build
npm test                # Run test suite once
npm run test:watch      # Run tests in watch mode
npm run db:migrate      # Apply pending Prisma migrations
npm run db:generate     # Regenerate Prisma client after schema changes
npm run db:studio       # Open Prisma Studio (visual database browser)
npm run db:seed         # Create default admin user
```

---

## Roadmap

| Phase | Module | Status |
|-------|--------|--------|
| 1 | Security baseline (helmet, cors, rate-limit, RBAC, password policy) | ✅ Done |
| 2 | User management (CRUD for admins and sellers) | ✅ Done |
| 3 | Products (catalog, stock control, multi-image upload via Cloudinary) | ✅ Done |
| 4 | Sales (cash + credit, stock deduction, balance update) | ✅ Done |
| 5 | Payments (register payments, update sale status, reduce client balance) | ✅ Done |
| 6 | Audit log (atomic writes on balance changes + read API) | ✅ Done |
| 7 | Pricing Domain Service (Strategy Pattern — differential pricing by sale type) | ✅ Done |
| 8 | Notifications (WhatsApp via Twilio + email via Nodemailer, Domain Events pattern) | ✅ Done |
| 9 | PDF reports (on-demand account statements + auto-attach on payment emails) | ✅ Done |
| 10 | API improvements (pagination, filters, search) | ✅ Done |
| 11 | On-demand client notification (`POST /clients/:id/notify` — WhatsApp payload + async email with PDF) | ✅ Done |
| 12 | Payment correction (`PUT /payments/:id` — ADMIN, atomic delta balance + sale status recompute + audit log) | ✅ Done |
| 13 | Payment deletion (`DELETE /payments/:id` — ADMIN, balance restored + sale status recompute + `PAYMENT_DELETED` audit log) + notify with installment detail (cuotas pagadas, valor crédito, cuota inicial) | ✅ Done |
| 14 | Custom dates — optional `createdAt` (ISO 8601) on sale/payment creation; `createdAt` correction on payment update (`PUT /payments/:id`); `PUT /sales/:id` for collection days + sale date (ADMIN) | ✅ Done |
| 15 | Timezone fix — `notify-client.use-case.ts` `fmtDate` now uses `Intl.DateTimeFormat` with `timeZone: 'America/Bogota'` (was calling `Date.getDate()` in UTC) | ✅ Done |
| 16 | Sale deletion (`DELETE /api/sales/:id` — ADMIN, no-payments guard, stock restored, CREDIT balance reverted + `SALE_DELETED` audit log, atomic transaction) | ✅ Done |
| 17 | Product retail price (`PATCH /api/products/:id/retail-price` — ADMIN, sets/clears optional suggested display price `retailPrice Decimal?` on Product; pure reference field, never affects sale calculations) | ✅ Done |

---

## Pagination & Filtering

Every `GET /` listing endpoint supports optional pagination and module-specific filters via query string. No change to the URL path — only query parameters differ.

### Response shape (all paginated endpoints)

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

### Pagination parameters (all modules)

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | `1` | — | Page number (1-indexed) |
| `limit` | `20` | `100` | Items per page |

### Filter quick reference

```
GET /api/clients?search=maria&hasDebt=true&page=1&limit=10
GET /api/products?search=camisa&maxStock=5
GET /api/sales?type=CREDIT&status=PENDING&dateFrom=2026-01-01&dateTo=2026-04-30
GET /api/payments?clientId=uuid&dateFrom=2026-04-01
GET /api/audit-logs?action=PAYMENT&userId=uuid&limit=50
```

### Architecture

Filters follow Clean Architecture: `req.query` → `PaginationDto` + `FilterXxxDto` (validation in domain layer) → Use Case → Repository → Prisma datasource (`buildWhere()` translates DTOs to Prisma `where`). `findMany` and `count` run in parallel via `Promise.all` — one database round trip per request.

---

## Pricing System

Prices are **set manually at sale time** by the seller. There is no automatic price catalog or surcharge.

### How it works

1. When creating a sale, the frontend (seller) provides `unitPrice` for each line item
2. `CreateSaleUseCase` validates product existence, activity, and stock — but trusts the provided price
3. The server computes `subtotal = unitPrice × quantity` and `total = sum(subtotals)` — clients cannot override the total
4. `SaleItem.basePrice = unitPrice` and `appliedRule = null` are persisted for audit traceability

### Installment plans and collection days

Credit sales support optional installment plans:

| Field | Description |
|-------|-------------|
| `installmentsCount` | Number of installments (integer ≥ 2) |
| `frequency` | `MONTHLY`, `BIWEEKLY`, or `WEEKLY` |
| `collectionDay` | Billing day. MONTHLY/BIWEEKLY: day of month 1–31. WEEKLY: day of week 1–7 (1=Mon, 7=Sun) |
| `collectionDay2` | Second billing day of month (1–31), BIWEEKLY plans only |

BIWEEKLY example — collect on the 15th and 30th every month:
```json
{
  "installmentsCount": 6,
  "frequency": "BIWEEKLY",
  "collectionDay": 15,
  "collectionDay2": 30
}
```

WEEKLY example — collect every Monday (1):
```json
{
  "installmentsCount": 12,
  "frequency": "WEEKLY",
  "collectionDay": 1
}
```

---

## Notification System

After every payment and every credit sale, the system automatically sends a WhatsApp message and an email to the client. Notifications are **decoupled from the financial transaction** using the Domain Events pattern.

### How it works

1. `CreatePaymentUseCase` / `CreateSaleUseCase` execute the atomic DB transaction (payment/sale + balance + audit log)
2. After the transaction commits, the use case emits a domain event via `EventEmitterPort`
3. The corresponding subscriber receives the event asynchronously
4. The subscriber applies a **throttle** (max 3 notifications per client per hour) to prevent accidental message floods
5. WhatsApp and email are sent in parallel via `Promise.allSettled` — one channel can fail without affecting the other
6. Every attempt (success or failure) is persisted to the `NotificationLog` table

The HTTP response is already returned at step 2. Notifications never block the API response and never roll back the transaction.

### Security

| Concern | Implementation |
|---------|---------------|
| **WhatsApp content** | Messages confirm a movement occurred and redirect to email for details — no balance or debt amount exposed (stolen phone scenario) |
| **Email content** | Full detail: amount, new balance, note, date, reference ID |
| **Throttle** | In-memory cap of 3 notifications per client per hour — prevents Meta API charges from runaway loops |
| **NotificationLog** | Every attempt is recorded with channel, event, status (SENT/FAILED), and error message |
| **Graceful degradation** | Missing env vars → server starts normally, feature disabled with a console warning |

### Channels

| Channel | Triggered by | Content |
|---------|-------------|---------|
| WhatsApp Deep Link *(manual, frontend)* | Payment registered | `whatsappPayload.message` pre-built by backend — frontend opens `wa.me/{phone}?text={message}` |
| Email | Payment registered | Amount, new balance, note, date, reference + **PDF account statement attached** |
| WhatsApp Deep Link *(manual, frontend)* | Credit sale created | `whatsappPayload.message` pre-built by backend |
| Email | Credit sale created | Total, new balance, date, sale reference + **PDF account statement attached** |
| WhatsApp Deep Link *(manual, frontend)* | `POST /clients/:id/notify` | `whatsappPayload.message` pre-built by backend — current balance summary |
| Email | `POST /clients/:id/notify` | Current balance summary + **PDF account statement attached** |

> **WhatsApp via Meta Cloud API** (templates `abono_recibido`, `abono_estado_cuenta`, `compra_credito`, `credito_estado_cuenta`) is **dormant** — the send blocks are commented in `payment-notification.subscriber.ts` and `sale-notification.subscriber.ts`. To reactivate, uncomment those blocks.

> **PDF delivery strategy (Opción A — buffers directos):** The PDF is generated in memory as a `Buffer` and uploaded directly to Meta's `/media` endpoint. Meta returns a `media_id` which is referenced in the outbound message. The PDF is **never exposed via a public URL** — this prevents IDOR attacks where a guessable URL could let one client access another client's statement. The upload retries once on transient 5xx errors and does not retry on 4xx. If PDF generation or upload fails, email is sent without attachment and WhatsApp document is skipped — the text template still sends.

### Enabling notifications

Set the following in `.env` (see [Environment Variables](#environment-variables) for details):

```env
# WhatsApp (Meta Cloud API)
META_WHATSAPP_TOKEN=your_system_user_token
META_WHATSAPP_PHONE_NUMBER_ID=123456789012345

# Email (Gmail + App Password)
MAILER_EMAIL=youraddress@gmail.com
MAILER_SECRET_KEY=abcd efgh ijkl mnop
MAILER_SERVICE=gmail
```

Both services are independent — you can enable only WhatsApp, only email, or both.

**Required approved templates in Meta Business Manager:**

| Template name | Trigger | Header | Body variables |
|---|---|---|---|
| `abono_recibido` | Payment registered | — | `{{1}}` name, `{{2}}` amount, `{{3}}` new balance |
| `abono_estado_cuenta` | Payment registered | DOCUMENT (media_id) | `{{1}}` name, `{{2}}` amount, `{{3}}` date |
| `compra_credito` | Credit sale created | — | `{{1}}` name, `{{2}}` total, `{{3}}` new balance |
| `credito_estado_cuenta` | Credit sale created | DOCUMENT (media_id) | `{{1}}` name, `{{2}}` total, `{{3}}` date |

### Checking notification logs

```bash
npm run db:studio   # Open Prisma Studio → NotificationLog table
```

---

## PDF Report System

The PDF report module generates account statements fully in memory using **PDFKit**. The domain layer defines a `PdfService` interface — the presentation and domain layers are completely unaware of PDFKit. If the PDF library needs to change, only `src/infrastructure/services/pdfkit-pdf.service.ts` needs to be rewritten.

### Two ways to get a PDF

**1. On-demand via API (admin panel / staff use)**

```http
GET /api/reports/account-statement/:clientId
Authorization: Bearer <admin-token>
```

The browser or API client receives the PDF as a binary download. No file is ever saved to the server.

**2. Automatic delivery on payment/sale notifications (client-facing)**

When `POST /api/payments` or `POST /api/sales` (credit) commits, the subscriber automatically:
1. Generates the account statement PDF for that client (using the same use case as the endpoint)
2. Uploads the `Buffer` to Meta `/media` → gets a `media_id` → sends as WhatsApp document via approved template (no public URL exposed)
3. Attaches the same `Buffer` to the confirmation email as `estado-cuenta-{clientId}.pdf`
4. If PDF generation fails — the email sends without attachment and the WhatsApp document step is skipped (text template still sends)

### Architecture

```
GET /api/reports/account-statement/:clientId
  └── ReportController
        └── GenerateAccountStatementUseCase
              ├── ClientRepository.findById()
              ├── SaleRepository.findByClientId()    ─┐ parallel
              ├── PaymentRepository.findByClientId() ─┘
              ├── ProductRepository.findById() ×N    (deduplicated, parallel)
              └── PdfService.generateAccountStatement(data)
                    └── PdfkitPdfService             (only file that knows about PDFKit)
                          └── Buffer → HTTP response / email attachment
```

### Extending the PDF

To add new sections to the PDF, edit only `src/infrastructure/services/pdfkit-pdf.service.ts`. The interface in `src/domain/services/pdf.service.ts` only changes if the data contract changes (e.g. adding a new field to `AccountStatementData`).

---

## Product Categorization & Dynamic Attributes

The product catalog now supports **extensible categorization and dynamic attributes** with zero hardcoded fields (`color`, `size`, etc.).  
`Product` remains generic; category metadata is modeled in separate tables and linked by relations.

### Data model

- `Category` → category catalog (`name`)
- `CategoryAttribute` → attributes per category (`Color`, `Tamaño`, `Material`, ...)
- `AttributeValue` → allowed values per attribute (`Rojo`, `Queen`, `Algodón`, ...)
- `ProductAttribute` → many-to-many link between product and selected values
- `Product.categoryId` (nullable) → optional category assigned to each product

### API endpoints

All routes require JWT. `ADMIN` is required for create/update/delete operations.

#### Categories
- `POST /api/categories` (ADMIN) — create category
- `GET /api/categories` — list categories
- `PUT /api/categories/:id` (ADMIN) — rename category
- `DELETE /api/categories/:id` (ADMIN) — delete category

#### Category attributes
- `POST /api/categories/:id/attributes` (ADMIN) — create attribute in category
- `GET /api/categories/:id/attributes` — list attributes by category
- `PUT /api/attributes/:id` (ADMIN) — rename attribute
- `DELETE /api/attributes/:id` (ADMIN) — delete attribute

#### Attribute values
- `POST /api/attributes/:id/values` (ADMIN) — create value in attribute
- `GET /api/attributes/:id/values` — list values by attribute
- `PUT /api/values/:id` (ADMIN) — rename value
- `DELETE /api/values/:id` (ADMIN) — delete value

#### Product ↔ attributes
- `POST /api/products/:id/attributes` (ADMIN) — append values to product (non-destructive)
- `PUT /api/products/:id/attributes` (ADMIN) — replace full attribute set (destructive sync)
- `DELETE /api/products/:id/attributes/:valueId` (ADMIN) — remove one value from product

### Product payload changes

`GET /api/products/:id` and `GET /api/products` now include:

```json
{
  "id": "product-id",
  "name": "Sabana Premium",
  "categoryId": "category-id-or-null",
  "categoryName": "Sabanas",
  "attributes": [
    { "attribute": "Color", "value": "Rojo" },
    { "attribute": "Tamano", "value": "Queen" }
  ]
}
```

`POST /api/products` accepts optional `categoryId`:

```json
{
  "name": "Sabana Premium",
  "stock": 10,
  "categoryId": "uuid-opcional"
}
```

`PUT /api/products/:id` supports partial update of:
- `name?: string`
- `categoryId?: string | null`

### Critical business rules

1. A product can have multiple values for the same attribute (e.g. multiple colors).
2. Attribute values are category-scoped; there are no global attributes.
3. New attributes can be added without code changes.
4. A product cannot receive values from a different category.
5. When product category changes:
   - if new category is set, old value links outside the new category are auto-cleaned
   - if category becomes `null`, all product value links are removed

### Frontend integration guide

Recommended admin UI flow:

1. Load categories (`GET /api/categories`)
2. For selected category, load attributes (`GET /api/categories/:id/attributes`)
3. For each attribute, load values (`GET /api/attributes/:id/values`)
4. On product edit:
   - update base product (`PUT /api/products/:id` with `name` and/or `categoryId`)
   - then sync selections using `PUT /api/products/:id/attributes` with complete `valueIds`
5. Render product chips from `product.attributes`

`PUT /api/products/:id/attributes` body:

```json
{
  "valueIds": ["uuid-color-rojo", "uuid-size-queen"]
}
```

To clear all attributes:

```json
{
  "valueIds": []
}
```

