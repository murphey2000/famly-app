import { createApplication } from "@specific-dev/framework";
import { jwt } from "better-auth/plugins";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerFamiliesRoutes } from './routes/families.js';
import { registerPostsRoutes } from './routes/posts.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerFeedRoutes } from './routes/feed.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerNewsletterRoutes } from './routes/newsletter.js';
import { register as registerAnniversariesRoutes } from './routes/anniversaries.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);

export type App = typeof app;

app.withAuth({
  trustedOrigins: [
    process.env.APP_URL || 'https://vqprhrdr6pemce78dksqkeqpdfka3x56.app.specular.dev',
    "https://2b74c067-e8de-4846-ada9-033ab988fdfb.newly.dev",
    "famly://",
  ],
  plugins: [
    jwt(),
  ],
});
app.withStorage();

// Hook to inject JWT token into JSON response body for iOS compatibility
app.fastify.addHook('onSend', async (request, reply, payload) => {
  // Only intercept JSON responses from specific auth routes
  const authRoutes = [
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/get-session',
  ];

  if (!authRoutes.includes(request.url) || reply.getHeader('content-type')?.toString().includes('application/json') === false) {
    return payload;
  }

  // Get the JWT token from the set-auth-jwt header
  const jwtToken = reply.getHeader('set-auth-jwt');
  if (!jwtToken) {
    return payload;
  }

  try {
    // Parse the response body
    let body = payload;
    if (Buffer.isBuffer(body)) {
      body = body.toString('utf-8');
    }

    const parsed = JSON.parse(body as string);

    // Inject the token
    parsed.token = jwtToken;

    // Return the modified body
    return JSON.stringify(parsed);
  } catch (error) {
    app.logger.debug({ err: error }, 'Failed to inject JWT into response body');
    return payload;
  }
});

registerFamiliesRoutes(app);
registerPostsRoutes(app);
registerMediaRoutes(app);
registerProfileRoutes(app);
registerFeedRoutes(app);
registerAuthRoutes(app);
registerNewsletterRoutes(app);
registerAnniversariesRoutes(app, app.fastify);

await app.run();
app.logger.info('FamilyBook backend initialized');
