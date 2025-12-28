import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../config/app_config.dart';

/// Utilitaires pour la détection réseau et la configuration de l'URL API
class NetworkUtils {
  /// Détecte si l'application tourne sur un émulateur Android
  /// 
  /// Note: Pour une détection précise en production, utilisez le package device_info_plus
  static bool get isEmulator {
    if (Platform.isAndroid) {
      // En mode debug, on peut supposer que c'est peut-être un émulateur
      // En production, vous devriez utiliser device_info_plus pour détecter précisément
      // Pour l'instant, on retourne false par défaut (appareil physique)
      return false;
    }
    return false;
  }

  /// Teste une URL pour voir si le serveur répond
  /// Retourne true si le serveur répond (même avec une erreur HTTP), false si connexion impossible
  static Future<bool> testConnection(String url) async {
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 6), // 6 secondes pour homebox (augmenté)
        receiveTimeout: const Duration(seconds: 6),
        // Accepter TOUS les codes de statut - même une erreur 404/500 signifie que le serveur répond
        validateStatus: (_) => true,
      ));
      
      // Tester l'endpoint /api (documentation Swagger NestJS)
      try {
        final response = await dio.get(
          '$url/api',
          options: Options(
            followRedirects: true,
            validateStatus: (_) => true, // Accepter tous les codes
          ),
        );
        // Si on reçoit une réponse HTTP (même 404/500), le serveur est accessible
        // Seules les erreurs de connexion/timeout signifient que le serveur n'est pas accessible
        return response.statusCode != null;
      } on DioException catch (e) {
        // DioException avec type de connexion/timeout signifie que le serveur n'est pas accessible
        if (e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.connectionError) {
          // Essayer la racine en dernier recours
          try {
            final response2 = await dio.get(
              url,
              options: Options(
                followRedirects: true,
                validateStatus: (_) => true,
              ),
            );
            return response2.statusCode != null;
          } catch (e2) {
            return false;
          }
        }
        // Autres erreurs DioException (comme badResponse) signifient que le serveur répond
        return true;
      } catch (e) {
        // Toute autre exception signifie probablement que le serveur n'est pas accessible
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  /// Génère une liste d'IPs à tester dans une plage donnée
  static List<String> _generateIPRange(String baseIP, int start, int end) {
    final parts = baseIP.split('.');
    if (parts.length != 4) return [];
    
    final base = '${parts[0]}.${parts[1]}.${parts[2]}.';
    final ips = <String>[];
    
    for (int i = start; i <= end; i++) {
      ips.add('$base$i');
    }
    
    return ips;
  }

  /// Détecte automatiquement l'IP du serveur en testant différentes IPs
  /// Amélioré pour supporter les connexions homebox/hotspot avec différentes plages d'IP
  /// [quickMode] : si true, ne teste que les IPs prioritaires (pour éviter les blocages au démarrage)
  static Future<String?> detectWorkingIP({bool quickMode = false}) async {
    print('🔍 [NetworkUtils] Début de la détection IP (quickMode: $quickMode)');
    
    // Phase 1: Tester les IPs spécifiques connues (rapide)
    // Priorité aux IPs détectées sur l'ordinateur et aux gateways communs
    final specificIPs = [
      // IPs détectées sur l'ordinateur (priorité absolue)
      '192.168.56.1',      // Interface Ethernet virtuelle (détectée) - PRIORITÉ 1
      '192.168.0.21',      // Réseau local (détectée)
      '172.31.208.1',      // Autre interface détectée
      // Gateways et IPs homebox/hotspot communes
      '172.20.10.1',       // Gateway homebox/hotspot commun (172.20.10.x)
      '172.20.10.2',       // IP hotspot actuelle (peut être le téléphone)
      '172.20.10.3',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.4',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.5',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.6',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.7',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.8',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.9',       // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.10',      // IP possible de l'ordinateur dans le réseau homebox
      '172.20.16.1',       // Autre IP détectée
      '10.135.194.178',    // IP hotspot précédente
      '192.168.1.100',     // IP réseau local typique
      '192.168.1.1',       // Gateway réseau local commun
      '192.168.0.100',     // Autre IP réseau local typique
      '192.168.0.1',       // Gateway réseau local alternatif
      '192.168.43.1',      // Gateway hotspot Android commun
      '192.168.137.1',     // Gateway hotspot Windows commun
      '10.0.2.2',          // Pour émulateur Android
      '10.0.0.1',          // Gateway réseau 10.x
    ];

    // Tester les IPs spécifiques d'abord (plus rapide)
    // Commencer par tester 192.168.56.1 en premier car c'est l'IP qui fonctionne
    print(' [NetworkUtils] Test de ${specificIPs.length} IPs prioritaires...');
    for (int i = 0; i < specificIPs.length; i++) {
      final ip = specificIPs[i];
      final url = 'http://$ip:3001';
      print(' [NetworkUtils] Test ${i + 1}/${specificIPs.length}: $url');
      final isWorking = await testConnection(url);
      if (isWorking) {
        print(' [NetworkUtils] IP trouvée: $url');
        return url;
      } else {
        print(' [NetworkUtils] $url ne répond pas');
      }
    }
    print(' [NetworkUtils] Aucune IP prioritaire ne fonctionne');

    // Si en mode rapide, arrêter ici pour éviter les blocages
    if (quickMode) {
      return null;
    }

    // Phase 2: Scanner les plages d'IP communes pour homeboxs/hotspots
    // Important: Avec un homebox, l'IP de l'ordinateur peut être n'importe quelle IP dans la plage
    final commonRanges = [
      // Plage 172.20.10.x (homebox/hotspot iPhone) - scan étendu car souvent utilisé
      // L'IP 172.20.10.2 est souvent le téléphone, l'ordinateur peut être 172.20.10.3 à 172.20.10.50
      _generateIPRange('172.20.10.1', 11, 50), // Skip les premières (déjà testées)
      // Plage 172.31.208.x (interface détectée sur l'ordinateur)
      _generateIPRange('172.31.208.1', 1, 20),
      // Plage 192.168.0.x (réseau local - IP détectée: 192.168.0.21)
      _generateIPRange('192.168.0.1', 2, 30), // Skip .1 (gateway)
      // Plage 192.168.56.x (interface virtuelle détectée)
      _generateIPRange('192.168.56.1', 2, 10),
      // Plage 172.20.x.x (autres sous-réseaux homebox possibles)
      _generateIPRange('172.20.16.1', 2, 15),
      // Plage 192.168.43.x (hotspot Android)
      _generateIPRange('192.168.43.1', 2, 30),
      // Plage 192.168.1.x (réseau local typique)
      _generateIPRange('192.168.1.1', 2, 30),
    ];

    // Tester les plages communes avec timeout global pour éviter les blocages
    try {
      final scanFuture = Future<String?>(() async {
        for (final range in commonRanges) {
          for (final ip in range) {
            final url = 'http://$ip:3001';
            final isWorking = await testConnection(url);
            if (isWorking) {
              return url;
            }
          }
        }
        return null;
      });
      
      // Timeout de 30 secondes maximum pour le scan complet
      final result = await scanFuture.timeout(
        const Duration(seconds: 30),
        onTimeout: () => null,
      );
      
      return result;
    } catch (e) {
      // En cas d'erreur, retourner null
      return null;
    }
  }

  /// Obtient l'URL de l'API en fonction de l'environnement
  /// MODE PRODUCTION: Utilise toujours l'URL Railway
  static String getApiUrl({String? customUrl}) {
    // Si une URL personnalisée est fournie, l'utiliser
    if (customUrl != null && customUrl.isNotEmpty) {
      return customUrl;
    }

    // En production, utiliser directement l'URL de production
    if (AppConfig.isProduction) {
      return AppConfig.productionApiUrl;
    }

    // En développement uniquement (ne devrait jamais être atteint en production)
    // Détecter si c'est un émulateur
    if (isEmulator) {
      return 'http://10.0.2.2:3001';
    }

    // Pour un appareil physique en développement, on utilise une IP par défaut
    // La détection automatique sera faite au moment de la connexion
    return 'http://192.168.56.1:3001';
  }

  /// Liste des IPs par défaut à essayer
  static List<String> getDefaultIPs() {
    return [
      // IPs détectées sur l'ordinateur (priorité)
      '192.168.56.1',     // Interface Ethernet virtuelle (détectée)
      '192.168.0.21',     // Réseau local (détectée)
      '172.31.208.1',     // Autre interface détectée
      // Gateways et IPs homebox/hotspot
      '172.20.10.1',      // Gateway homebox commun
      '172.20.10.2',      // IP hotspot actuelle (peut être le téléphone)
      '172.20.10.3',      // IP possible de l'ordinateur dans le réseau homebox
      '172.20.10.4',      // Autres IPs possibles homebox
      '172.20.10.5',
      '172.20.10.6',
      '172.20.10.7',
      '172.20.10.8',
      '172.20.10.9',
      '172.20.10.10',
      '172.20.16.1',      // Autre IP détectée
      '10.135.194.178',   // IP hotspot précédente
      '192.168.1.100',    // IP réseau local typique
      '192.168.1.1',      // Gateway réseau local
      '192.168.0.100',    // Autre IP réseau local typique
      '192.168.0.1',      // Gateway réseau local alternatif
      '192.168.43.1',     // Gateway hotspot Android
      '10.0.2.2',         // Pour émulateur
    ];
  }

  /// Valide si une URL est valide
  static bool isValidUrl(String url) {
    try {
      final uri = Uri.parse(url);
      return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
    } catch (e) {
      return false;
    }
  }

  /// Nettoie et formate une URL
  static String cleanUrl(String url) {
    url = url.trim();
    // Supprimer le slash final s'il existe
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    return url;
  }
}

