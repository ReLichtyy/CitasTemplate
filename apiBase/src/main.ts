import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ExcepcionesFilter } from './common/filters/excepciones.filter.js';
import { SobreInterceptor } from './common/interceptors/sobre.interceptor.js';

/**
 * Ningun cuerpo legitimo de esta API se acerca a esto: no se suben archivos, y la peticion
 * mas grande es una cita con adicionales. El limite por defecto de Express (100 kb) ya es
 * generoso; bajarlo es gratis y le quita al atacante una forma barata de ocupar memoria.
 */
const LIMITE_CUERPO = '64kb';

async function bootstrap() {
  // `rawBody` guarda el cuerpo sin parsear. La firma HMAC del webhook de WhatsApp se
  // calcula sobre esos bytes exactos: recalcularla sobre el JSON re-serializado cambia
  // espacios y orden de claves, y entonces ninguna firma legitima coincide.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const logger = new Logger('Bootstrap');
  const esProduccion = process.env.NODE_ENV === 'production';

  // Cabeceras de seguridad. `contentSecurityPolicy` en su default estricto sirve para una
  // API que solo devuelve JSON; la unica pagina que se sirve es /docs, y solo fuera de
  // produccion.
  app.use(helmet());

  app.useBodyParser('json', { limit: LIMITE_CUERPO });
  app.useBodyParser('urlencoded', { limit: LIMITE_CUERPO, extended: true });

  /**
   * Detras de nginx o de un balanceador, `request.ip` es la del proxy salvo que Express
   * confie en el. `LimiteIntentosGuard` cuenta por IP, asi que sin esto el limite de
   * intentos se aplicaria a todo el trafico junto.
   *
   * Se declara explicito y no `true`: confiar en cualquier `X-Forwarded-For` deja que el
   * cliente se invente la IP y esquive el limite. El valor es el numero de saltos de
   * confianza (`TRUST_PROXY=1` con un solo nginx delante).
   */
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
  }

  // Un solo origen, del entorno. En produccion tiene que venir puesto: el default de
  // desarrollo apunta a Vite, y dejarlo asi en el VPS rompe el frontend real en silencio.
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  if (esProduccion && !process.env.CORS_ORIGIN) {
    throw new Error('Falta CORS_ORIGIN en produccion. Ver apiBase/.env.example.');
  }
  app.enableCors({ origin: corsOrigin, credentials: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Un campo de mas es un cliente desactualizado o alguien probando: se rechaza en vez
      // de ignorarse en silencio, que es lo que hacia que `rol` en el cuerpo pareciera
      // aceptado.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Los mensajes de los DTOs estan en español; el de "propiedad desconocida" lo
      // redacta class-validator en ingles y no se puede traducir desde el decorador.
      exceptionFactory: (errores) => {
        const primero = Object.values(errores[0]?.constraints ?? {})[0];
        return new BadRequestException(
          primero?.includes('should not exist')
            ? 'La peticion tiene campos que no se admiten.'
            : (primero ?? 'La peticion no es valida.'),
        );
      },
    }),
  );

  // El sobre y el filtro son la misma decision vista desde los dos lados. Ver
  // 04-contrato-api.md.
  app.useGlobalInterceptors(new SobreInterceptor());
  app.useGlobalFilters(new ExcepcionesFilter());

  /**
   * `/docs` se monta con `app.use()`, que es middleware de Express crudo y no pasa por los
   * guards de Nest: publicarlo es publicar la referencia completa del API, rutas de
   * administracion incluidas. Solo fuera de produccion.
   */
  if (!esProduccion) {
    // Import dinamico: `@nestjs/swagger` y Scalar solo hacen falta aqui, y en
    // produccion este bloque no corre. Arriba se cargaban siempre, en el arranque del
    // proceso que nunca va a servir /docs.
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const { apiReference } = await import('@scalar/nestjs-api-reference');

    const config = new DocumentBuilder()
      .setTitle('CitasTemplate API')
      .setDescription('API para gestion de citas')
      .setVersion('0.0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    app.use('/docs', apiReference({ content: document }));
    logger.log('/docs habilitado (no es produccion)');
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
