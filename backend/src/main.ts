import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json, urlencoded } from 'body-parser';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3002',
      'https://geo-timeline-trackers.vercel.app',
      'https://geo-timeline-dashboard.vercel.app',
      'http://10.129.106.148:3002',
    ],
    credentials: true,
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  if (process.env.DEBUG_REQUESTS === 'true') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      console.log('[REQ]', req.method, req.originalUrl);
      console.log(' headers:', req.headers);
      console.log(' query:', req.query);
      console.log(' params:', req.params);
      console.log(' body:', req.body);
      next();
    });
  }

  // Validate/transform incoming DTOs (class-validator decorators were previously unenforced)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  // Use global exception filter to normalize error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
