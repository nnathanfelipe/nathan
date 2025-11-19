import ffmpeg from 'fluent-ffmpeg';
import { logger } from './logger';

export interface VideoFormat {
  width: number;
  height: number;
  aspectRatio: string;
}

const FORMATS: Record<string, VideoFormat> = {
  vertical: { width: 1080, height: 1920, aspectRatio: '9:16' },
  feed: { width: 1080, height: 1080, aspectRatio: '1:1' },
  landscape: { width: 1920, height: 1080, aspectRatio: '16:9' },
};

/**
 * Cut video segment and convert to target format
 */
export async function cutVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  format: string
): Promise<void> {
  logger.info({ inputPath, outputPath, startTime, endTime, format }, 'Cutting video');

  const targetFormat = FORMATS[format] || FORMATS.vertical;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .size(`${targetFormat.width}x${targetFormat.height}`)
      .aspect(targetFormat.aspectRatio)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        logger.debug({ commandLine }, 'FFmpeg started');
      })
      .on('progress', (progress) => {
        logger.debug({ progress }, 'FFmpeg progress');
      })
      .on('end', () => {
        logger.info({ outputPath }, 'FFmpeg completed');
        resolve();
      })
      .on('error', (err) => {
        logger.error({ error: err }, 'FFmpeg error');
        reject(err);
      })
      .run();
  });
}

/**
 * Extract audio from video for transcription
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  logger.info({ inputPath, outputPath }, 'Extracting audio');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(outputPath)
      .on('end', () => {
        logger.info({ outputPath }, 'Audio extraction completed');
        resolve();
      })
      .on('error', (err) => {
        logger.error({ error: err }, 'Audio extraction error');
        reject(err);
      })
      .run();
  });
}
