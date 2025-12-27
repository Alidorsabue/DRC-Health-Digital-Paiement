import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import * as os from 'os';

async function bootstrap() {
  // Créer l'application avec body parser désactivé pour le configurer manuellement
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Augmenter la limite de taille du body pour gérer les images/vidéos en base64
  // Accéder à l'instance Express sous-jacente et configurer le body parser AVANT les autres middlewares
  const expressApp = app.getHttpAdapter().getInstance();
  
  // Configurer le body parser avec une limite de 50MB pour les images/vidéos en base64
  // Ces middlewares doivent être ajoutés en premier
  expressApp.use(express.json({ limit: '50mb' }));
  expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Autoriser toutes les origines en développement pour permettre l'accès mobile
  // Nettoyer FRONTEND_URL (supprimer le slash final s'il existe)
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const corsOrigins = process.env.NODE_ENV === 'production' 
    ? frontendUrl
    : '*';
    
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('DRC Digit Payment API')
    .setDescription('API pour la plateforme de gestion des paiements des prestataires de santé publique')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  // Écouter sur toutes les interfaces réseau (0.0.0.0) pour permettre l'accès depuis d'autres appareils
  await app.listen(port, '0.0.0.0');
  
  // Détecter automatiquement toutes les IPs disponibles
  const networkInterfaces = os.networkInterfaces();
  const ipAddresses: string[] = [];
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const addresses = networkInterfaces[interfaceName];
    if (addresses) {
      addresses.forEach((address) => {
        // Filtrer les adresses IPv4 et exclure localhost
        if (address.family === 'IPv4' && !address.internal) {
          ipAddresses.push(address.address);
        }
      });
    }
  });
  
  console.log(`\n========================================`);
  console.log(`🚀 Application démarrée avec succès!`);
  console.log(`========================================`);
  console.log(`📡 Écoute sur toutes les interfaces (0.0.0.0:${port})`);
  console.log(`\n📍 Accès locaux:`);
  console.log(`   - http://localhost:${port}`);
  console.log(`   - http://127.0.0.1:${port}`);
  
  if (ipAddresses.length > 0) {
    console.log(`\n🌐 Accès réseau (IPs détectées sur cet ordinateur):`);
    ipAddresses.forEach((ip) => {
      console.log(`   - http://${ip}:${port}`);
    });
  } else {
    console.log(`\n🌐 Accès réseau (exemples):`);
    console.log(`   - http://192.168.56.1:${port}`);
    console.log(`   - http://172.20.10.2:${port}`);
    console.log(`   - http://172.20.16.1:${port}`);
  }
  
  console.log(`\n📚 Documentation Swagger:`);
  console.log(`   - http://localhost:${port}/api`);
  if (ipAddresses.length > 0) {
    console.log(`   - http://${ipAddresses[0]}:${port}/api`);
  }
  console.log(`========================================\n`);
}

bootstrap().catch((error) => {
  console.error('❌ Erreur lors du démarrage de l\'application:', error);
  process.exit(1);
});

