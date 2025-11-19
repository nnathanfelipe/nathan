import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generatePresignedUploadUrl } from '../lib/s3';
import { config } from '../config';
import crypto from 'crypto';

const presignSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
});

// Simple nanoid alternative using crypto
function generateId(size: number = 21): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.randomBytes(size);
  for (let i = 0; i < size; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

export async function uploadRoutes(fastify: FastifyInstance) {
  // Generate presigned URL for video upload
  fastify.post('/presign', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { fileName, fileSize, contentType } = presignSchema.parse(request.body);

      // Validate file size (max 2GB)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (fileSize > maxSize) {
        return reply.status(400).send({ error: 'File too large. Max 2GB allowed.' });
      }

      // Validate content type
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
      if (!allowedTypes.includes(contentType)) {
        return reply.status(400).send({ error: 'Invalid file type. Only video files allowed.' });
      }

      // Generate unique key
      const fileId = generateId();
      const extension = fileName.split('.').pop();
      const key = `${userId}/${fileId}.${extension}`;

      // Generate presigned URL
      const uploadUrl = await generatePresignedUploadUrl(
        config.s3.buckets.videos,
        key,
        contentType,
        3600 // 1 hour
      );

      return reply.send({
        uploadUrl,
        key,
        fileId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      throw error;
    }
  });
}
