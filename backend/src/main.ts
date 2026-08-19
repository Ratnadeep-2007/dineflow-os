import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  // rawBody is required to verify Meta's X-Hub-Signature-256 (per security.md 3.3)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  
  // Apply Helmet to set security-focused HTTP headers (HSTS, CSRF mitigation support, etc. per security.md 7)
  app.use(helmet());
  
  app.useGlobalFilters(new AllExceptionsFilter());
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
