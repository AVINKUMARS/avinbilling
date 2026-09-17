import { config } from 'dotenv';
import { z } from 'zod';

config({ path: new URL('../../../../.env', import.meta.url) });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/meera_business_suite'),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-before-production'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
