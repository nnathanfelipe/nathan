import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { videoProcessingQueue, VideoProcessingJobData } from '../lib/queue';
import { getPublicUrl } from '../lib/s3';
import { config } from '../config';

const createJobSchema = z.object({
  videoUrl: z.string().url(),
  videoKey: z.string(),
  videoDuration: z.number().optional(),
  stylePreset: z.enum(['auto', 'viral', 'educational', 'podcast']).default('auto'),
  targetFormats: z.array(z.enum(['vertical', 'feed', 'landscape'])).default(['vertical', 'feed']),
});

export async function jobRoutes(fastify: FastifyInstance) {
  // Create processing job
  fastify.post('/', {
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
      const data = createJobSchema.parse(request.body);

      // Check user's minutes limit
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const estimatedMinutes = Math.ceil((data.videoDuration || 0) / 60);
      
      if (user.minutesUsed + estimatedMinutes > user.minutesLimit) {
        return reply.status(403).send({
          error: 'Minutes limit exceeded',
          minutesUsed: user.minutesUsed,
          minutesLimit: user.minutesLimit,
        });
      }

      // Create job in database
      const job = await prisma.job.create({
        data: {
          userId,
          videoUrl: data.videoUrl,
          videoKey: data.videoKey,
          videoDuration: data.videoDuration,
          stylePreset: data.stylePreset,
          targetFormats: data.targetFormats,
          status: 'PENDING',
        },
      });

      // Add to processing queue
      const queueData: VideoProcessingJobData = {
        jobId: job.id,
        userId,
        videoUrl: data.videoUrl,
        videoKey: data.videoKey,
        videoDuration: data.videoDuration || 0,
        stylePreset: data.stylePreset,
        targetFormats: data.targetFormats,
      };

      await videoProcessingQueue.add('process-video', queueData, {
        jobId: job.id,
      });

      return reply.status(201).send({ job });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  // Get job by ID
  fastify.get('/:id', {
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

    const job = await prisma.job.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        clips: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send({ job });
  });

  // List user's jobs
  fastify.get('/', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { limit = 20, offset = 0 } = request.query as { limit?: number; offset?: number };

    const jobs = await prisma.job.findMany({
      where: { userId },
      include: {
        clips: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.job.count({
      where: { userId },
    });

    return reply.send({
      jobs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  });
}
