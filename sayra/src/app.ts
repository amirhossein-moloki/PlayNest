import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import routes from './routes';
import { ADMIN_CONSTANTS } from './platform-admin/config/admin.constants';
import healthRouter from './routes/health.routes';
import { errorHandler } from './common/errors/errorHandler';
import { notFoundHandler } from './common/errors/notFoundHandler';
import { responseMiddleware } from './common/middleware/response';
import { env } from './config/env';
import logger from './config/logger';
import { initReservationEvents } from './modules/reservation/reservation.events';
import { maintenanceModeMiddleware } from './common/middleware/maintenanceMode';

// Initialize Event Listeners
initReservationEvents();

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

if (env.NODE_ENV === 'production' && env.TRUST_PROXY === 0) {
  logger.warn(
    'TRUST_PROXY is 0 in production; if behind Nginx/reverse proxy, Express per-IP rate limiting will collapse to the proxy IP.'
  );
}

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: env.CORS_CREDENTIALS,
}));
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: env.NODE_ENV === 'production' ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', '\'unsafe-inline\'', '\'unsafe-eval\'', 'https://cdn.redoc.ly', 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ['\'unsafe-inline\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https:', 'http:'],
      imgSrc: ['\'self\'', 'data:', 'blob:', 'https:', 'http:'],
      fontSrc: ['\'self\'', 'https:', 'http:', 'data:'],
      workerSrc: ['\'self\'', 'blob:'],
      connectSrc: ['\'self\'', 'https:', 'http:'],
      upgradeInsecureRequests: null,
    },
  },
}));
app.use(express.json());
app.use(cookieParser(ADMIN_CONSTANTS.COOKIE_SECRET));

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Serve ReDoc static assets (locally hosted for offline/intranet reliability)
const redocAssetsPath = path.join(__dirname, 'public/redoc');
app.use('/redoc-assets', express.static(redocAssetsPath));

import loggerMiddleware from './common/middleware/logger';

// Disable pino-http logger in test environment to avoid Jest compatibility issues
if (env.NODE_ENV !== 'test') {
  app.use(loggerMiddleware);
}

app.use(responseMiddleware);
app.use(maintenanceModeMiddleware);

// Prevent search engines from indexing backend API/docs subdomains directly
app.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

// Health Check (Public - root level)
app.use('/health', healthRouter);

// Swagger Documentation & OpenAPI Spec (Public / Configurable)
const openapiFilePath = path.join(__dirname, 'docs/openapi.yaml');
const swaggerDocument = YAML.load(openapiFilePath);

const enableDocs = env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true';
if (enableDocs) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.get('/openapi.yaml', (_req, res) => {
    res.sendFile(openapiFilePath);
  });

  app.get('/openapi.json', (_req, res) => {
    res.json(swaggerDocument);
  });

  // ReDoc Documentation (Public)
  const redocHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>PlayNest API Documentation - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="/redoc-assets/redoc.standalone.js"></script>
  </body>
</html>`;

  const renderRedoc: express.RequestHandler = (_req, res) => {
    res.type('html');
    res.send(redocHtml);
  };

  app.get('/redoc', renderRedoc);
  app.get('/redoc/*', renderRedoc);
} else {
  const disabledDocsHandler: express.RequestHandler = (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'API documentation is disabled in this environment',
      },
    });
  };
  app.use(['/api-docs', '/swagger', '/docs', '/redoc', '/openapi.yaml', '/openapi.json'], disabledDocsHandler);
}

// API Routes
app.use('/api/v1', routes);

// Platform Admin Panel slot (populated asynchronously during server bootstrap
// so /platform-admin-panel sits before the 404 and error handlers)
app.locals.hasPlatformAdminSlot = true;
app.use(ADMIN_CONSTANTS.ROOT_PATH, (req, res, next) => {
  const adminRouter = app.locals.platformAdminRouter as express.RequestHandler | undefined;
  if (adminRouter) {
    return adminRouter(req, res, next);
  }
  return next();
});

// 404 Handler for unmatched routes and unsupported HTTP methods
app.use(notFoundHandler);

if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

export default app;
