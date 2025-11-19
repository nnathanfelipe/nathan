import { logger } from './logger';

export interface Timestamp {
  start: number;
  end: number;
  score: number;
  reason: string;
}

/**
 * Generate timestamps (points of interest) for video cutting
 * This is a basic heuristic - can be enhanced with ML/AI later
 */
export async function generateTimestamps(
  videoPath: string,
  videoDuration: number,
  stylePreset: string
): Promise<Timestamp[]> {
  logger.info({ videoPath, videoDuration, stylePreset }, 'Generating timestamps');

  const timestamps: Timestamp[] = [];

  // Basic heuristic based on style preset
  switch (stylePreset) {
    case 'viral':
      // For viral content: shorter clips (15-30s), more frequent
      timestamps.push(...generateViralTimestamps(videoDuration));
      break;

    case 'educational':
      // For educational: longer clips (60-90s), topic-based
      timestamps.push(...generateEducationalTimestamps(videoDuration));
      break;

    case 'podcast':
      // For podcasts: longer clips (90-120s), conversation-based
      timestamps.push(...generatePodcastTimestamps(videoDuration));
      break;

    case 'auto':
    default:
      // Auto: mix of different lengths
      timestamps.push(...generateAutoTimestamps(videoDuration));
      break;
  }

  logger.info({ count: timestamps.length }, 'Generated timestamps');
  return timestamps;
}

function generateViralTimestamps(duration: number): Timestamp[] {
  const timestamps: Timestamp[] = [];
  const clipLength = 20; // 20 seconds
  const overlap = 5; // 5 seconds overlap

  for (let start = 0; start < duration - clipLength; start += clipLength - overlap) {
    const end = Math.min(start + clipLength, duration);
    timestamps.push({
      start,
      end,
      score: 0.8,
      reason: 'viral-segment',
    });
  }

  return timestamps;
}

function generateEducationalTimestamps(duration: number): Timestamp[] {
  const timestamps: Timestamp[] = [];
  const clipLength = 75; // 75 seconds
  const overlap = 10;

  for (let start = 0; start < duration - clipLength; start += clipLength - overlap) {
    const end = Math.min(start + clipLength, duration);
    timestamps.push({
      start,
      end,
      score: 0.7,
      reason: 'educational-segment',
    });
  }

  return timestamps;
}

function generatePodcastTimestamps(duration: number): Timestamp[] {
  const timestamps: Timestamp[] = [];
  const clipLength = 105; // 105 seconds
  const overlap = 15;

  for (let start = 0; start < duration - clipLength; start += clipLength - overlap) {
    const end = Math.min(start + clipLength, duration);
    timestamps.push({
      start,
      end,
      score: 0.6,
      reason: 'podcast-segment',
    });
  }

  return timestamps;
}

function generateAutoTimestamps(duration: number): Timestamp[] {
  const timestamps: Timestamp[] = [];
  
  // Mix of short (30s), medium (60s), and long (90s) clips
  const patterns = [30, 60, 90];
  let currentTime = 0;
  let patternIndex = 0;

  while (currentTime < duration - 30) {
    const clipLength = patterns[patternIndex % patterns.length];
    const end = Math.min(currentTime + clipLength, duration);
    
    timestamps.push({
      start: currentTime,
      end,
      score: 0.75,
      reason: 'auto-segment',
    });

    currentTime += clipLength - 10; // 10s overlap
    patternIndex++;
  }

  return timestamps;
}
