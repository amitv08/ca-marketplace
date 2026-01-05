import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  PLATFORM_FEE_PERCENTAGE: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
}

const getEnvVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

export const env: EnvConfig = {
  PORT: parseInt(getEnvVariable('PORT', '5000'), 10),
  NODE_ENV: getEnvVariable('NODE_ENV', 'development'),
  DATABASE_URL: getEnvVariable('DATABASE_URL'),
  JWT_SECRET: getEnvVariable('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVariable('JWT_EXPIRES_IN', '15m'),
  JWT_REFRESH_SECRET: getEnvVariable('JWT_REFRESH_SECRET', getEnvVariable('JWT_SECRET') + '_refresh'),
  JWT_REFRESH_EXPIRES_IN: getEnvVariable('JWT_REFRESH_EXPIRES_IN', '7d'),
  CORS_ORIGIN: getEnvVariable('CORS_ORIGIN', 'http://localhost:3000'),
  RAZORPAY_KEY_ID: getEnvVariable('RAZORPAY_KEY_ID', 'test_key_id'),
  RAZORPAY_KEY_SECRET: getEnvVariable('RAZORPAY_KEY_SECRET', 'test_key_secret'),
  RAZORPAY_WEBHOOK_SECRET: getEnvVariable('RAZORPAY_WEBHOOK_SECRET', 'test_webhook_secret'),
  PLATFORM_FEE_PERCENTAGE: parseInt(getEnvVariable('PLATFORM_FEE_PERCENTAGE', '10'), 10),
  REDIS_HOST: getEnvVariable('REDIS_HOST', 'localhost'),
  REDIS_PORT: parseInt(getEnvVariable('REDIS_PORT', '6379'), 10),
  REDIS_PASSWORD: getEnvVariable('REDIS_PASSWORD', ''),
};

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
