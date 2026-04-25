import 'dotenv/config';

const requiredEnvs = [
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
] as const;

for (const key of requiredEnvs) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (!process.env.JWT_CUSTOMER_SECRET) {
  console.warn('[envs] JWT_CUSTOMER_SECRET not set — customer auth disabled');
}

export const envs = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL!,
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
};
