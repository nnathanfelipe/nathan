import dotenv from 'dotenv';

dotenv.config();

export const config = {
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
    forcePathStyle: true,
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  
  processing: {
    tempDir: process.env.TEMP_DIR || '/tmp/cliplyx',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '2', 10),
  },
};
