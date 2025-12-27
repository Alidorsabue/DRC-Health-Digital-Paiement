class AppConfig {
  // Mode production : désactive la détection d'IP et utilise uniquement l'URL de production
  static const bool isProduction = true;
  
  // URL de l'API de production (sans /api car les endpoints sont ajoutés par le service)
  static const String productionApiUrl = 'https://drc-health-digital-paiement-production.up.railway.app';
  
  // URL de l'API par défaut (pour compatibilité)
  static const String defaultApiUrl = productionApiUrl;
  
  // Timeouts
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  
  // Nom de la base de données
  static const String databaseName = 'drc_payment.db';
  static const int databaseVersion = 1;
  
  // Clés de préférences
  static const String prefApiUrl = 'api_url';
  static const String prefAccessToken = 'access_token';
  static const String prefUser = 'user';
}

