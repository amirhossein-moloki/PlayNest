import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import routes from './routes';
import { errorHandler } from './common/errors/errorHandler';
import { responseMiddleware } from './common/middleware/response';
import { apiKeyMiddleware } from './common/middleware/apiKey';
import { env } from './config/env';

if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    environment: env.NODE_ENV,
  });
}

const app = express();

app.set('trust proxy', env.TRUST_PROXY);

app.use(express.json());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: env.CORS_CREDENTIALS,
}));
app.use(helmet({
  crossOriginResourcePolicy: false,
  hsts: false,
}));

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

import loggerMiddleware from './common/middleware/logger';

// Disable pino-http logger in test environment to avoid Jest compatibility issues
if (env.NODE_ENV !== 'test') {
  app.use(loggerMiddleware);
}

app.use(responseMiddleware);
app.use(apiKeyMiddleware);

// Swagger Documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'docs/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/v1', routes);

if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

export default app;
