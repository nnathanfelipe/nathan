import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '7d',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://cliplyx:cliplyx_dev_password@localhost:5432/cliplyx',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    buckets: {
      videos: process.env.S3_BUCKET_VIDEOS || 'cliplyx-videos',
      clips: process.env.S3_BUCKET_CLIPS || 'cliplyx-clips',
    },
    forcePathStyle: true, // Required for MinIO
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    plans: {
      free: {
        minutesLimit: 30,
        price: 0,
      },
      pro: {
        minutesLimit: 300,
        priceId: process.env.STRIPE_PRO_PRICE_ID || '',
        price: 29,
      },
      proPLus: {
        minutesLimit: 1000,
        priceId: process.env.STRIPE_PRO_PLUS_PRICE_ID || '',
        price: 79,
      },
    },
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
};
