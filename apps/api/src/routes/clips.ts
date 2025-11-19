import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { generatePresignedDownloadUrl } from '../lib/s3';
import { config } from '../config';

export async function clipRoutes(fastify: FastifyInstance) {
  // Get clip preview URL
  fastify.get('/:id/preview', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    const clip = await prisma.clip.findFirst({
      where: {
        id,
        job: {
          userId,
        },
      },
      include: {
        job: true,
      },
    });

    if (!clip) {
      return reply.status(404).send({ error: 'Clip not found' });
    }

    // Increment views
    await prisma.clip.update({
      where: { id },
      data: {
        views: {
          increment: 1,
        },
      },
    });

    return reply.send({
      clip: {
        ...clip,
        clipUrl: clip.clipUrl, // Public URL from CDN
      },
    });
  });

  // Download clip
  fastify.get('/:id/download', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    const clip = await prisma.clip.findFirst({
      where: {
        id,
        job: {
          userId,
        },
      },
    });

    if (!clip) {
      return reply.status(404).send({ error: 'Clip not found' });
    }

    // Generate presigned download URL
    const downloadUrl = await generatePresignedDownloadUrl(
      config.s3.buckets.clips,
      clip.clipKey,
      3600 // 1 hour
    );

    // Increment downloads
    await prisma.clip.update({
      where: { id },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });

    return reply.send({
      downloadUrl,
      fileName: `clip-${clip.id}.mp4`,
    });
  });
}
