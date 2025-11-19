import { Worker, Job } from 'bullmq';
import { config } from './config';
import { logger } from './lib/logger';
import { processVideo } from './processors/video-processor';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export interface VideoProcessingJobData {
  jobId: string;
  userId: string;
  videoUrl: string;
  videoKey: string;
  videoDuration: number;
  stylePreset: string;
  targetFormats: string[];
}

const worker = new Worker<VideoProcessingJobData>(
  'video-processing',
  async (job: Job<VideoProcessingJobData>) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing video job');

    try {
      await processVideo(job);
      logger.info({ jobId: job.id }, 'Video processing completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Video processing failed');
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 videos at a time
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Job failed');
});

worker.on('error', (err) => {
  logger.error({ error: err }, 'Worker error');
});

logger.info('🎬 Video processing worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});
