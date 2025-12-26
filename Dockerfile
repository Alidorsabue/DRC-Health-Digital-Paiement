# Dockerfile à la racine pour Railway
# Ce fichier construit le backend depuis la racine du projet
FROM node:18-alpine AS builder

# Installer les dépendances système nécessaires
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier les fichiers de configuration du backend
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Créer nest-cli.json (nécessaire pour nest build)
RUN echo '{"$schema":"https://json.schemastore.org/nest-cli","collection":"@nestjs/schematics","sourceRoot":"src","compilerOptions":{"deleteOutDir":true}}' > nest-cli.json

# Installer les dépendances
RUN npm ci

# Copier le reste du code source du backend (src et nest-cli.json si présent)
COPY backend/src ./src
COPY backend/nest-cli.json* ./

# Builder l'application
RUN npm run build

# Image de production
FROM node:18-alpine

WORKDIR /app

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Exposer le port (Railway utilisera la variable PORT)
EXPOSE 3001

# Commande de démarrage
CMD ["node", "dist/main.js"]

