/// Fonction utilitaire pour extraire un message d'erreur formaté depuis une exception
/// 
/// Cette fonction extrait le message formaté avec solutions depuis les exceptions
/// lancées par ApiService._handleError().
/// 
/// @param error - L'erreur capturée (peut être de type dynamic)
/// @param fallbackMessage - Message par défaut si aucun message n'est trouvé
/// @returns Le message d'erreur formaté avec solutions
/// 
/// @example
/// ```dart
/// try {
///   await apiService.getForms();
/// } catch (e) {
///   final message = getErrorMessage(e, 'Une erreur est survenue');
///   ScaffoldMessenger.of(context).showSnackBar(
///     SnackBar(content: Text(message)),
///   );
/// }
/// ```
String getErrorMessage(dynamic error, [String fallbackMessage = 'Une erreur est survenue']) {
  if (error == null) {
    return fallbackMessage;
  }
  
  // Si c'est une Exception, extraire le message directement
  if (error is Exception) {
    final message = error.toString().replaceFirst('Exception: ', '');
    return message.isNotEmpty ? message : fallbackMessage;
  }
  
  // Si c'est une String, l'utiliser directement
  if (error is String) {
    return error.isNotEmpty ? error : fallbackMessage;
  }
  
  // Sinon, convertir en String
  final message = error.toString();
  return message.isNotEmpty ? message : fallbackMessage;
}

/// Vérifie si une erreur est une erreur réseau (pas de réponse du serveur)
bool isNetworkError(dynamic error) {
  final message = getErrorMessage(error, '').toLowerCase();
  return message.contains('timeout') ||
         message.contains('connexion') ||
         message.contains('réseau') ||
         message.contains('connection') ||
         message.contains('network');
}

/// Vérifie si une erreur nécessite une reconnexion (401, 403)
bool requiresReauth(dynamic error) {
  final message = getErrorMessage(error, '').toLowerCase();
  return message.contains('session expirée') ||
         message.contains('401') ||
         message.contains('403') ||
         message.contains('reconnecter');
}

