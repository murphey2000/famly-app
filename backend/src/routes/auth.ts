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
      app.logger.info({}, '[/api/auth/token] Fetching JWT token from session');

      try {
        // Check for Bearer token first (it takes precedence for simplicity)
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          // Validate the token by running requireAuth — it will send 401 if invalid
          const session = await requireAuth(request, reply);
          if (!session) return;
          app.logger.info({ userId: session.user.id }, '[/api/auth/token] Bearer token validated');
          return { token: authHeader.substring(7) };
        }

        // Try cookie-based session
        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) {
            headers.append(key, Array.isArray(value) ? value[0] : value);
          }
        });

        const session = await app.auth.api.getSession({ headers });

        if (!session) {
          app.logger.warn({}, '[/api/auth/token] No valid session or Bearer token found');
          return reply.status(401).send({ error: 'No valid session found' });
        }

        app.logger.info({ userId: session.user.id }, '[/api/auth/token] Session found');

        // Try to get token using Better Auth API
        const tokenResult = await (app.auth.api as any).getToken({ headers });

        if (tokenResult?.token) {
          app.logger.info({ userId: session.user.id }, '[/api/auth/token] JWT token retrieved successfully');
          return { token: tokenResult.token };
        }

        // Fallback: try generateToken if available
        if (typeof (app.auth as any).generateToken === 'function') {
          const token = await (app.auth as any).generateToken({
            userId: session.user.id,
          });

          if (token) {
            app.logger.info({ userId: session.user.id }, '[/api/auth/token] JWT token generated successfully');
            return { token };
          }
        }

        app.logger.error({}, '[/api/auth/token] Failed to generate JWT token from session');
        return reply.status(401).send({ error: 'No valid session found' });
      } catch (error) {
        app.logger.error({ err: error }, '[/api/auth/token] Error processing token request');
        return reply.status(401).send({ error: 'No valid session found' });
      }
    }
  );
}
