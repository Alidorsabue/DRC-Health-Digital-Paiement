# Dockerfile pour le frontend Next.js
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
# Utiliser npm install (plus flexible que npm ci qui nécessite package-lock.json)
RUN npm install

# Copier le code source
COPY . .

# Builder l'application Next.js
RUN npm run build

# Image de production
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./next.config.js

# Exposer le port (Railway utilisera la variable PORT)
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "start"]

