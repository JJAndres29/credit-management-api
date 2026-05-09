import 'dotenv/config';

const requiredEnvs = [
  'PORT',
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
] as const;

const HEX_64_REGEX = /^[a-f0-9]{64,}$/i;

function warnOptional(message: string): void {
  process.stderr.write(`${message}\n`);
}

for (const key of requiredEnvs) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (!HEX_64_REGEX.test(process.env.JWT_SECRET!)) {
  throw new Error('JWT_SECRET must be a hexadecimal secret with at least 64 characters');
}

if (!process.env.JWT_CUSTOMER_SECRET) {
  warnOptional('[envs] JWT_CUSTOMER_SECRET not set - customer auth disabled');
}

if (!process.env.GOOGLE_CLIENT_ID) {
  warnOptional('[envs] GOOGLE_CLIENT_ID not set - Google OAuth disabled');
}

if (!process.env.MP_ACCESS_TOKEN || !process.env.MP_WEBHOOK_SECRET) {
  warnOptional('[envs] MP_ACCESS_TOKEN or MP_WEBHOOK_SECRET not set - Mercado Pago gateway disabled');
}

export const envs = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL!,
  directUrl: process.env.DIRECT_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN!,
  jwtCustomerSecret: process.env.JWT_CUSTOMER_SECRET ?? '',
  jwtCustomerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN ?? '7d',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  mailer: {
    email: process.env.MAILER_EMAIL ?? '',
    secretKey: process.env.MAILER_SECRET_KEY ?? '',
    service: process.env.MAILER_SERVICE ?? 'gmail',
  },
  meta: {
    token: process.env.META_WHATSAPP_TOKEN ?? '',
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '',
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  mercadopago: {
    accessToken: process.env.MP_ACCESS_TOKEN ?? '',
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? '',
    webhookDebug: process.env.MP_WEBHOOK_DEBUG === 'true',
    baseUrl: process.env.MP_BASE_URL ?? 'https://api.mercadopago.com',
    sandboxMode: process.env.MP_SANDBOX_MODE === 'true',
    appUrl: process.env.APP_URL ?? '',
    backUrls: {
      success: process.env.MP_BACK_URL_SUCCESS ?? '',
      failure: process.env.MP_BACK_URL_FAILURE ?? '',
      pending: process.env.MP_BACK_URL_PENDING ?? '',
    },
  },
};
