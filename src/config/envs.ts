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

export const envs = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN!,
  /**
   * Porcentaje de recargo aplicado a ventas a crédito (CREDIT).
   * Ejemplo: 15 → los productos cuestan 15% más en ventas a crédito.
   * Default: 0 (sin recargo) si la variable no está definida.
   * Cambiar este valor no requiere modificar código, solo reiniciar el proceso.
   */
  creditSurchargePercent: Number(process.env.CREDIT_SURCHARGE_PERCENT ?? 0),
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
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
  },
};
