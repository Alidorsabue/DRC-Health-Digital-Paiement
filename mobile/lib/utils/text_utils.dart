/// Utilitaires pour l'affichage de texte, notamment pour tronquer les valeurs longues
class TextUtils {
  /// Tronque une valeur si elle est trop longue (utile pour les images base64)
  static String truncateValue(dynamic value, {int maxLength = 50}) {
    if (value == null) return 'null';
    
    final String stringValue = value.toString();
    
    // Si c'est une image base64, tronquer plus agressivement
    if (stringValue.startsWith('data:image') || stringValue.startsWith('data:video')) {
      // Extraire juste le type MIME et la longueur
      final parts = stringValue.split(',');
      if (parts.length > 1) {
        final mimeType = parts[0].replaceAll('data:', '').split(';')[0];
        final dataLength = parts[1].length;
        return '$mimeType (${_formatBytes(dataLength)} base64)';
      }
      return stringValue.length > maxLength 
          ? '${stringValue.substring(0, maxLength)}...' 
          : stringValue;
    }
    
    // Pour les autres valeurs, tronquer normalement
    if (stringValue.length > maxLength) {
      return '${stringValue.substring(0, maxLength)}...';
    }
    
    return stringValue;
  }
  
  /// Formate une taille en bytes en format lisible
  static String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
  
  /// Vérifie si une valeur est une image base64
  static bool isBase64Image(dynamic value) {
    if (value == null) return false;
    final String stringValue = value.toString();
    return stringValue.startsWith('data:image');
  }
  
  /// Vérifie si une valeur est une signature base64
  static bool isBase64Signature(dynamic value) {
    if (value == null) return false;
    final String stringValue = value.toString();
    return stringValue.startsWith('data:image') && 
           (stringValue.contains('signature') || stringValue.contains('draw'));
  }
}

