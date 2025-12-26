# Dockerfile pour le backend NestJS
FROM node:18-alpine AS builder

# Installer les dépendances système nécessaires
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier les fichiers de configuration nécessaires pour npm ci
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci

# Créer nest-cli.json si absent (nécessaire pour nest build)
# Le fichier sera écrasé par COPY . . s'il existe dans le repo
RUN echo '{"$schema":"https://json.schemastore.org/nest-cli","collection":"@nestjs/schematics","sourceRoot":"src","compilerOptions":{"deleteOutDir":true}}' > nest-cli.json

# Copier le reste du code source (écrasera nest-cli.json si présent dans le repo)
COPY . .

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

