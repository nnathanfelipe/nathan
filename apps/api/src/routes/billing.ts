import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { config } from '../config';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-12-18.acacia',
});

const subscribeSchema = z.object({
  plan: z.enum(['PRO', 'PRO_PLUS']),
});

export async function billingRoutes(fastify: FastifyInstance) {
  // Create Stripe checkout session
  fastify.post('/subscribe', {
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
      const { plan } = subscribeSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Get price ID based on plan
      const priceId = plan === 'PRO' 
        ? config.stripe.plans.pro.priceId 
        : config.stripe.plans.proPLus.priceId;

      if (!priceId) {
        return reply.status(400).send({ error: 'Plan not configured' });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        
        customerId = customer.id;
        
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${config.cors.origin}/dashboard?success=true`,
        cancel_url: `${config.cors.origin}/dashboard?canceled=true`,
        metadata: {
          userId: user.id,
          plan,
        },
      });

      return reply.send({
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  // Stripe webhook handler
  fastify.post('/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;

    try {
      const event = stripe.webhooks.constructEvent(
        request.body as string | Buffer,
        sig,
        config.stripe.webhookSecret
      );

      // Log webhook event
      await prisma.webhookEvent.create({
        data: {
          type: event.type,
          payload: event.data.object as any,
        },
      });

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const plan = session.metadata?.plan as 'PRO' | 'PRO_PLUS';

          if (userId && plan) {
            const minutesLimit = plan === 'PRO' 
              ? config.stripe.plans.pro.minutesLimit 
              : config.stripe.plans.proPLus.minutesLimit;

            await prisma.user.update({
              where: { id: userId },
              data: {
                plan,
                minutesLimit,
                stripeSubscriptionId: session.subscription as string,
              },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          
          await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              plan: 'FREE',
              minutesLimit: config.stripe.plans.free.minutesLimit,
              stripeSubscriptionId: null,
            },
          });
          break;
        }
      }

      return reply.send({ received: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(400).send({ error: 'Webhook error' });
    }
  });

  // Get billing info
  fastify.get('/info', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      plan: user.plan,
      minutesUsed: user.minutesUsed,
      minutesLimit: user.minutesLimit,
      stripeCustomerId: user.stripeCustomerId,
      hasActiveSubscription: !!user.stripeSubscriptionId,
    });
  });
}
