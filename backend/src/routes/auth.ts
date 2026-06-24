import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function registerAuthRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get(
    '/api/auth/token',
    {
      schema: {
        description: 'Get current user JWT token from session or Bearer token',
        tags: ['auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      app.logger.info({}, 'Fetching JWT token from session');

      try {
        // First, check if Authorization header has a Bearer token
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7); // Remove 'Bearer ' prefix
          app.logger.info({}, 'Returning Bearer token from Authorization header');
          return { token };
        }

        // Try to get session from cookies
        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) {
            headers.append(key, Array.isArray(value) ? value[0] : value);
          }
        });

        const session = await app.auth.api.getSession({ headers });

        if (!session) {
          app.logger.warn({}, 'No valid session found for token request');
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        app.logger.info({ userId: session.user.id }, 'Session found, generating JWT token');

        // Try to get token using Better Auth API
        const tokenResult = await (app.auth.api as any).getToken({ headers });

        if (!tokenResult?.token) {
          app.logger.warn({}, 'getToken not available, trying alternative method');

          // Fallback: try generateToken if available
          if (typeof (app.auth as any).generateToken === 'function') {
            const token = await (app.auth as any).generateToken({
              userId: session.user.id,
            });

            if (token) {
              app.logger.info({ userId: session.user.id }, 'JWT token generated successfully');
              return { token };
            }
          }

          app.logger.error({}, 'Failed to generate JWT token from session');
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        app.logger.info({ userId: session.user.id }, 'JWT token retrieved successfully');
        return { token: tokenResult.token };
      } catch (error) {
        app.logger.error({ err: error }, 'Error generating JWT token');
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  );
}
