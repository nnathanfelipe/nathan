import { Queue } from 'bullmq';
import { config } from '../config';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const videoProcessingQueue = new Queue('video-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

export interface VideoProcessingJobData {
  jobId: string;
  userId: string;
  videoUrl: string;
  videoKey: string;
  videoDuration: number;
  stylePreset: string;
  targetFormats: string[];
}
