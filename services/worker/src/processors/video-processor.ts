import { Job } from 'bullmq';
import { VideoProcessingJobData } from '../index';
import { logger } from '../lib/logger';
import { downloadVideo, uploadClip } from '../lib/s3';
import { generateTimestamps } from '../lib/timestamps';
import { cutVideo } from '../lib/ffmpeg';
import { transcribeAudio, generateSubtitles } from '../lib/transcription';
import { updateJobStatus, createClip } from '../lib/database';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';

export async function processVideo(job: Job<VideoProcessingJobData>) {
  const { jobId, userId, videoUrl, videoKey, videoDuration, stylePreset, targetFormats } = job.data;

  try {
    // Update job status to PROCESSING
    await updateJobStatus(jobId, 'PROCESSING', 0);

    // 1. Download video from S3
    logger.info({ jobId }, 'Downloading video from S3');
    const tempDir = path.join(config.processing.tempDir, jobId);
    await fs.mkdir(tempDir, { recursive: true });
    
    const videoPath = path.join(tempDir, 'original.mp4');
    await downloadVideo(videoKey, videoPath);
    await job.updateProgress(10);

    // 2. Generate timestamps (points of interest)
    logger.info({ jobId }, 'Generating timestamps');
    const timestamps = await generateTimestamps(videoPath, videoDuration, stylePreset);
    await job.updateProgress(20);

    // 3. Transcribe audio
    logger.info({ jobId }, 'Transcribing audio');
    const transcription = await transcribeAudio(videoPath);
    await job.updateProgress(40);

    // 4. Process each clip
    const totalClips = timestamps.length * targetFormats.length;
    let processedClips = 0;

    for (const timestamp of timestamps) {
      for (const format of targetFormats) {
        logger.info({ jobId, timestamp, format }, 'Processing clip');

        // Cut video
        const clipPath = path.join(tempDir, `clip-${timestamp.start}-${format}.mp4`);
        await cutVideo(videoPath, clipPath, timestamp.start, timestamp.end, format);

        // Generate subtitles for this clip segment
        const clipTranscription = transcription.filter(
          (t) => t.start >= timestamp.start && t.end <= timestamp.end
        );
        const srtPath = path.join(tempDir, `clip-${timestamp.start}-${format}.srt`);
        await generateSubtitles(clipTranscription, srtPath);

        // Upload clip and subtitles to S3
        const clipKey = `${userId}/${jobId}/clip-${timestamp.start}-${format}.mp4`;
        const srtKey = `${userId}/${jobId}/clip-${timestamp.start}-${format}.srt`;
        
        const clipUrl = await uploadClip(clipPath, clipKey);
        const subtitlesUrl = await uploadClip(srtPath, srtKey);

        // Get clip file size
        const stats = await fs.stat(clipPath);
        const clipSize = stats.size;

        // Save clip to database
        await createClip({
          jobId,
          clipUrl,
          clipKey,
          subtitlesUrl,
          format,
          duration: timestamp.end - timestamp.start,
          size: clipSize,
          startTime: timestamp.start,
          endTime: timestamp.end,
          transcription: clipTranscription.map((t) => t.text).join(' '),
        });

        processedClips++;
        const progress = 40 + Math.floor((processedClips / totalClips) * 50);
        await job.updateProgress(progress);
      }
    }

    // 5. Cleanup temp files
    logger.info({ jobId }, 'Cleaning up temp files');
    await fs.rm(tempDir, { recursive: true, force: true });

    // 6. Update job status to COMPLETED
    await updateJobStatus(jobId, 'COMPLETED', 100);
    await job.updateProgress(100);

  } catch (error) {
    logger.error({ jobId, error }, 'Error processing video');
    
    // Update job status to FAILED
    await updateJobStatus(jobId, 'FAILED', 0, (error as Error).message);
    
    throw error;
  }
}
