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

---

## Overview

This system allows a retail business to manage credit operations for its clients. Staff members (admins and sellers) interact with the system through a private API. Clients themselves have no system access — they receive account statements externally via WhatsApp and email.

**What it handles:**
- Staff authentication and role-based authorization
- Client management with credit limits and balance tracking
- Product catalog management with stock control and multi-image uploads via Cloudinary
- Cash and credit sales with automatic stock deduction and client balance update (atomic transaction)
- Payment registration with automatic sale status update (PENDING → PARTIAL → PAID) and client balance reduction (atomic transaction)
- *(Coming soon)* Account statement delivery via WhatsApp and email
- *(Coming soon)* PDF report generation

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
| **Adapter** | External libraries (JWT, Cloudinary, etc.) implement domain interfaces — replace any library without touching business logic |
| **DTO** | Input validation happens at the system boundary before reaching use cases |
| **Dependency Injection** | Constructor-based throughout — no service locator or global state |

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
| Dev server | ts-node-dev |
| Containerization | Docker Compose (PostgreSQL) |

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
│   │   ├── dtos/
│   │   │   ├── auth/              # LoginDto
│   │   │   ├── clients/           # CreateClientDto, UpdateClientDto
│   │   │   ├── payments/          # CreatePaymentDto
│   │   │   ├── products/          # CreateProductDto, UpdateProductDto, AdjustStockDto
│   │   │   ├── sales/             # CreateSaleDto (items array, type CASH|CREDIT)
│   │   │   └── users/             # CreateUserDto, UpdateUserDto, ChangePasswordDto
│   │   ├── entities/              # UserEntity, ClientEntity, ProductEntity, ProductImageEntity, SaleEntity, SaleItemEntity, PaymentEntity
│   │   ├── errors/                # CustomError with HTTP status factory methods
│   │   ├── repositories/          # Repository interfaces (ports)
│   │   ├── services/              # Service interfaces: JwtService, FileStorageService, EmailService, PdfService, NotificationService
│   │   └── use-cases/
│   │       ├── auth/              # LoginUseCase, RenewTokenUseCase
│   │       ├── clients/           # CreateClient, GetClients, GetClientById, UpdateClient, DeleteClient
│   │       ├── payments/          # CreatePayment, GetPayments, GetPaymentById, GetPaymentsByClient, GetPaymentsBySale
│   │       ├── products/          # GetProducts, GetProductById, CreateProduct, UpdateProduct, AdjustStock, DeleteProduct, UploadProductImages, DeleteProductImage
│   │       ├── sales/             # CreateSale, GetSales, GetSaleById, GetSalesByClient
│   │       └── users/             # GetUsers, GetUserById, CreateUser, UpdateUser, ToggleUserStatus, ChangePassword
│   ├── infrastructure/            # Implements domain interfaces (adapters)
│   │   ├── datasources/           # PrismaAuthDatasource, PrismaClientDatasource, PrismaProductDatasource, PrismaUserDatasource, PrismaSaleDatasource, PrismaPaymentDatasource
│   │   ├── repositories/          # AuthRepositoryImpl, ClientRepositoryImpl, ProductRepositoryImpl, UserRepositoryImpl, SaleRepositoryImpl, PaymentRepositoryImpl
│   │   └── services/              # JwtAdapter, CloudinaryAdapter
│   └── presentation/              # HTTP layer
│       ├── auth/                  # AuthController, AuthRouter
│       ├── clients/               # ClientController, ClientRouter
│       ├── payments/              # PaymentController, PaymentRouter
│       ├── products/              # ProductController, ProductRouter
│       ├── sales/                 # SaleController, SaleRouter
│       ├── users/                 # UserController, UserRouter
│       ├── middlewares/
│       │   ├── auth.middleware.ts         # JWT validation + DB user check
│       │   ├── rbac.middleware.ts         # Role-based access control (checkRole)
│       │   ├── rate-limit.middleware.ts   # Login rate limiter
│       │   └── upload.middleware.ts       # Multer: memory storage, file type + size validation
│       └── server.ts              # Express app setup (helmet, cors, body limit, routes)
├── .env.template                  # Environment variables template
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
| `MAILER_EMAIL` | No | Required when enabling email notifications |
| `MAILER_SECRET_KEY` | No | Required when enabling email notifications |
| `MAILER_SERVICE` | No | Email provider (default: `gmail`) |
| `TWILIO_ACCOUNT_SID` | No | Required when enabling WhatsApp notifications |
| `TWILIO_AUTH_TOKEN` | No | Required when enabling WhatsApp notifications |
| `TWILIO_WHATSAPP_FROM` | No | Twilio WhatsApp sender number |

> \* Required if you use the `POST /api/products/:id/images` endpoint.

---

## Database Schema

```
User          — System staff with role (ADMIN | SELLER)
Client        — Credit customers: credit limit, current balance, contact info
Product       — Inventory items: name, price, stock count
ProductImage  — Product photos: Cloudinary URL, publicId, display order (one product → many images)
Sale          — Orders per client: type (CASH | CREDIT), status (PAID | PENDING | PARTIAL)
SaleItem      — Line items per sale: product, quantity, unit price, subtotal
Payment       — Payments per client/sale: amount, optional note
AuditLog      — Immutable log of balance changes: user, IP, before/after values
```

**Enums:**

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `SELLER` |
| `SaleType` | `CASH`, `CREDIT` |
| `SaleStatus` | `PAID`, `PENDING`, `PARTIAL` |

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

### Products

All product endpoints require `Authorization: Bearer <token>`.

> Endpoints that modify data (`POST`, `PUT`, `PATCH`, `DELETE`) require `ADMIN` role. `GET` endpoints are available to any authenticated user.

#### GET `/api/products`

Returns all active products with their images, sorted by creation date (newest first).

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Camisa Azul",
    "price": 45000,
    "stock": 100,
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
]
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
  "price": 45000,
  "stock": 100
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `price` | number | Yes | Greater than 0 |
| `stock` | number | No | Integer >= 0, defaults to `0` |

**Response `201`:** Created product object with empty `images` array.

---

#### PUT `/api/products/:id`

Update product name and/or price. At least one field required. Use dedicated endpoints for stock (`PATCH /:id/stock`) and images (`POST /:id/images`).

> **Requires `ADMIN` role.**

**Request body (all fields optional):**
```json
{
  "name": "Camisa Azul Premium",
  "price": 55000
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

Returns all active clients, sorted by creation date (newest first).

**Response `200`:**
```json
[
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
]
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

### Sales

All sales endpoints require `Authorization: Bearer <token>`. Any authenticated user (ADMIN or SELLER) can create and view sales.

#### GET `/api/sales`

Returns all sales with their line items, sorted by creation date (newest first).

**Response `200`:**
```json
[
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
]
```

---

#### GET `/api/sales/client/:clientId`

Returns all sales for a specific client, sorted by creation date (newest first). Returns `404` if the client does not exist or is inactive.

---

#### GET `/api/sales/:id`

Returns a single sale with its line items. Returns `404` if not found.

---

#### POST `/api/sales`

Create a new sale. Prices are always taken from the current product catalog — client cannot supply prices.

**Request body:**
```json
{
  "clientId": "uuid",
  "type": "CREDIT",
  "items": [
    { "productId": "uuid", "quantity": 3 },
    { "productId": "uuid", "quantity": 1 }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `clientId` | string | Yes | Client must exist and be active |
| `type` | string | Yes | `CASH` or `CREDIT` |
| `items` | array | Yes | Min 1 item. No duplicate `productId` values |
| `items[].productId` | string | Yes | Product must exist, be active, and have sufficient stock |
| `items[].quantity` | integer | Yes | Positive integer |

**Business rules applied:**
- Stock is verified before creating the sale — insufficient stock returns `400`
- For `CREDIT` sales: `client.creditLimit - client.balance >= total`, otherwise `400`
- All operations (stock deduction, balance update, sale + items creation) run in a **single atomic database transaction**
- `CASH` sales are created with status `PAID`. `CREDIT` sales start as `PENDING`

**Response `201`:** Created sale object with items.

**Response `400`:** Validation error, insufficient stock, or insufficient credit.

**Response `404`:** Client or any product not found.

---

### Payments

All payment endpoints require `Authorization: Bearer <token>`. Any authenticated user (ADMIN or SELLER) can register and view payments.

#### GET `/api/payments`

Returns all payments, sorted by creation date (newest first).

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "clientId": "uuid",
    "saleId": "uuid",
    "amount": 50000,
    "note": "Abono parcial",
    "createdAt": "2026-04-08T00:00:00.000Z"
  }
]
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

### Planned

- Refresh token + short-lived access tokens (15 min access / 7 day refresh)
- Account lockout after N consecutive failed login attempts
- Structured security event logging (login failures, invalid tokens)
- Full audit log writes on balance-changing operations

---

## Testing

Tests are written with **Jest + ts-jest** and located alongside the code they test (`*.test.ts`).

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (re-runs on file save)
```

### Current coverage

| Module | Unit tests |
|--------|-----------|
| `LoginUseCase` | Covered — invalid user, inactive user, wrong password, success, token payload, password not exposed |
| `RenewTokenUseCase` | Covered — invalid user, inactive user, success |
| User use cases | Pending |
| Client use cases | Pending |
| Product use cases | Pending |
| Sales use cases | Pending |
| Payments use cases | Pending |
| DTOs | Pending |

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
| 6 | Audit log (full write implementation) | Planned |
| 7 | Notifications (WhatsApp via Twilio, email via Nodemailer) | Planned |
| 8 | PDF reports (account statements) | Planned |
| 9 | API improvements (pagination, filters, search) | Planned |
