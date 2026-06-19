import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json } from "express";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./observability/http-error.filter";
import { createObservabilityMiddleware } from "./observability/observability.middleware";
import { ObservabilityService } from "./observability/observability.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: "20mb" }));
  const observabilityService = app.get(ObservabilityService);
  app.enableCors();
  app.setGlobalPrefix(process.env.API_PREFIX ?? "api/v1");
  app.use(createObservabilityMiddleware(observabilityService));
  app.useGlobalFilters(new HttpErrorFilter(observabilityService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
