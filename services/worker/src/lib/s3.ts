import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import fs from 'fs';
import { Readable } from 'stream';
import { logger } from './logger';

export const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

export async function downloadVideo(key: string, destinationPath: string): Promise<void> {
  logger.info({ key, destinationPath }, 'Downloading video from S3');

  const command = new GetObjectCommand({
    Bucket: config.s3.buckets.videos,
    Key: key,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error('No body in S3 response');
  }

  const stream = response.Body as Readable;
  const writeStream = fs.createWriteStream(destinationPath);

  return new Promise((resolve, reject) => {
    stream.pipe(writeStream);
    stream.on('error', reject);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

export async function uploadClip(filePath: string, key: string): Promise<string> {
  logger.info({ key, filePath }, 'Uploading clip to S3');

  const fileStream = fs.createReadStream(filePath);
  const contentType = key.endsWith('.srt') ? 'text/plain' : 'video/mp4';

  const command = new PutObjectCommand({
    Bucket: config.s3.buckets.clips,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return public URL
  return `${config.s3.endpoint}/${config.s3.buckets.clips}/${key}`;
}
