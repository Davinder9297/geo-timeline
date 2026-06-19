import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { json, urlencoded } from 'body-parser';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3002','https://geo-timeline-trackers.vercel.app','https://geo-timeline-dashboard.vercel.app','http://10.129.106.148:3002'],
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
