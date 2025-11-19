import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { config } from './config';
import { logger } from './lib/logger';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import { jobRoutes } from './routes/jobs';
import { clipRoutes } from './routes/clips';
import { billingRoutes } from './routes/billing';

const fastify = Fastify({
  logger: logger,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
});

// Plugins
fastify.register(cors, {
  origin: config.cors.origin,
  credentials: true,
});

fastify.register(jwt, {
  secret: config.jwt.secret,
});

fastify.register(multipart, {
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
  },
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(uploadRoutes, { prefix: '/upload' });
fastify.register(jobRoutes, { prefix: '/jobs' });
fastify.register(clipRoutes, { prefix: '/clips' });
fastify.register(billingRoutes, { prefix: '/billing' });

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
    statusCode: error.statusCode || 500,
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });
    
    fastify.log.info(`🚀 API Server running on http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
