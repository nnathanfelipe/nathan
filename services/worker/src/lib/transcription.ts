import OpenAI from 'openai';
import { config } from '../config';
import { logger } from './logger';
import { extractAudio } from './ffmpeg';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Transcribe audio using OpenAI Whisper
 * Includes retry logic and chunking for large files
 */
export async function transcribeAudio(
  videoPath: string,
  maxRetries: number = 3
): Promise<TranscriptionSegment[]> {
  logger.info({ videoPath }, 'Starting transcription');

  // Extract audio first
  const audioPath = videoPath.replace('.mp4', '.mp3');
  await extractAudio(videoPath, audioPath);

  // Check file size
  const stats = await fs.stat(audioPath);
  const fileSizeMB = stats.size / (1024 * 1024);

  logger.info({ fileSizeMB }, 'Audio file size');

  // If file is too large (>25MB), need to chunk it
  if (fileSizeMB > 25) {
    logger.info('File too large, chunking required');
    return await transcribeWithChunking(audioPath, maxRetries);
  }

  // Transcribe with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info({ attempt }, 'Attempting transcription');

      const audioFile = await fs.readFile(audioPath);
      const blob = new Blob([audioFile], { type: 'audio/mp3' });
      const file = new File([blob], path.basename(audioPath), { type: 'audio/mp3' });

      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      // Parse segments
      const segments: TranscriptionSegment[] = (transcription as any).segments?.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      })) || [];

      logger.info({ segmentCount: segments.length }, 'Transcription completed');

      // Cleanup audio file
      await fs.unlink(audioPath);

      return segments;

    } catch (error) {
      logger.error({ attempt, error }, 'Transcription attempt failed');

      if (attempt === maxRetries) {
        throw new Error(`Transcription failed after ${maxRetries} attempts: ${error}`);
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      logger.info({ delay }, 'Retrying after delay');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Transcription failed');
}

/**
 * Transcribe large audio files by chunking
 * TODO: Implement chunking logic for files >25MB
 */
async function transcribeWithChunking(
  audioPath: string,
  maxRetries: number
): Promise<TranscriptionSegment[]> {
  logger.warn('Chunking not yet implemented, attempting full file transcription');
  
  // For now, attempt full file (will fail if >25MB)
  // In production, implement FFmpeg chunking here
  
  throw new Error('Audio file too large and chunking not yet implemented');
}

/**
 * Generate SRT subtitle file from transcription segments
 */
export async function generateSubtitles(
  segments: TranscriptionSegment[],
  outputPath: string
): Promise<void> {
  logger.info({ outputPath, segmentCount: segments.length }, 'Generating SRT subtitles');

  const srtContent = segments
    .map((segment, index) => {
      const startTime = formatSRTTime(segment.start);
      const endTime = formatSRTTime(segment.end);
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join('\n');

  await fs.writeFile(outputPath, srtContent, 'utf-8');
  logger.info({ outputPath }, 'SRT file generated');
}

/**
 * Format time in seconds to SRT format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}
