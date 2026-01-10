import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyRawBody from 'fastify-raw-body';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads', 'bets');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const fastifyAdapter = new FastifyAdapter({
    logger: false, // We'll use Pino logger instead
    trustProxy: true, // Important for nginx reverse proxy
    bodyLimit: 5 * 1024 * 1024, // 5MB body limit
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      bodyParser: false, // Disable NestJS body parser to avoid conflict with Fastify's built-in parser
      bufferLogs: true,
      logger: ['error', 'fatal'], // Only show errors, suppress warnings
    },
  );

  // Register Cookie Plugin (Must be before others that use cookies)
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error('COOKIE_SECRET environment variable must be set and at least 32 characters long');
  }
  await app.register(cookie, {
    secret: cookieSecret,
    parseOptions: {}
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Register raw body parser for Stripe webhooks
  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: false, // Keep as Buffer
    runFirst: true,
    routes: ['/api/webhooks/stripe'],
  });

  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      fieldSize: 1024 * 1024, // 1MB for field values (some mobile browsers send large metadata)
      fields: 20, // Max number of non-file fields
      files: 5, // Max number of file fields
    },
    attachFieldsToBody: false, // We handle parsing manually in controller
  });

  // Register static file serving for uploads
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Register static file serving for branding assets (logo, favicon)
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'public', 'branding'),
    prefix: '/branding/',
    decorateReply: false,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Security headers with Helmet
  const isProduction = configService.get('NODE_ENV') === 'production';
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`], // unsafe-inline needed for CSS-in-JS
        imgSrc: [`'self'`, 'data:', 'https:', 'blob:'],
        scriptSrc: isProduction 
          ? [`'self'`] // Strict in production
          : [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`], // Relaxed for development
        connectSrc: [`'self'`, ...(configService.get('CORS_ORIGIN')?.split(',') || [])],
        fontSrc: [`'self'`, 'https:', 'data:'],
        objectSrc: [`'none'`],
        frameAncestors: [`'none'`], // Prevent clickjacking
        baseUri: [`'self'`],
        formAction: [`'self'`],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded from other origins
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  });

  // CORS configuration
  const corsOrigins = configService.get<string>('CORS_ORIGIN')?.split(',') || ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix for API routes (must be set BEFORE Swagger setup)
  app.setGlobalPrefix('api', {
    exclude: ['/health', '/ready', '/uploads/*', '/branding/*'], // Health checks, uploads and branding without prefix
  });

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Libero Bets API')
    .setDescription('Production-ready NestJS + Fastify betting platform')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('subscriptions', 'Subscription and pack management')
    .addTag('bets', 'Premium bets')
    .addTag('admin', 'Admin endpoints')
    .addTag('webhooks', 'Webhook handlers')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Swagger docs controlled by SWAGGER_ENABLED env var (defaults to false in production)
  const swaggerEnabled = configService.get('SWAGGER_ENABLED') === 'true' || configService.get('NODE_ENV') !== 'production';
  if (swaggerEnabled) {
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger documentation enabled');
  }

  const port = 3000; // Hardcoded port
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  if (swaggerEnabled) {
    logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
