#!/bin/bash
# Script pour exécuter les migrations sur Railway
# Ce script peut être exécuté via Railway CLI: railway run ./railway-migrate.sh

echo "========================================="
echo "  Exécution des migrations de base de données"
echo "========================================="
echo ""

# Vérifier que les variables d'environnement sont définies
if [ -z "$DB_HOST" ]; then
    echo "ERREUR: DB_HOST n'est pas défini"
    exit 1
fi

echo "Connexion à la base de données: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Exécuter les migrations
echo "Exécution des migrations..."
npm run migration:run

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "  Migrations exécutées avec succès! ✓"
    echo "========================================="
else
    echo ""
    echo "========================================="
    echo "  ERREUR: Échec des migrations"
    echo "========================================="
    exit 1
fi

