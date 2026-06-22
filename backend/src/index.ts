import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerFamiliesRoutes } from './routes/families.js';
import { registerPostsRoutes } from './routes/posts.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerProfileRoutes } from './routes/profile.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);

export type App = typeof app;

app.withAuth();
app.withStorage();

registerFamiliesRoutes(app);
registerPostsRoutes(app);
registerMediaRoutes(app);
registerProfileRoutes(app);

await app.run();
app.logger.info('FamilyBook backend initialized');
