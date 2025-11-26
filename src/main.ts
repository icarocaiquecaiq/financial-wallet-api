import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationError, ValidatorOptions } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
export interface ValidationPipeOptions extends ValidatorOptions {
  transform?: boolean;
  disableErrorMessages?: boolean;
  exceptionFactory?: (errors: ValidationError[]) => any;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
