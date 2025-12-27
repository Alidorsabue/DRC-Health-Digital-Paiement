class AppConfig {
  // URL de l'API par défaut
  static const String defaultApiUrl = 'https://drc-health-digital-paiement-production.up.railway.app';
  
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

