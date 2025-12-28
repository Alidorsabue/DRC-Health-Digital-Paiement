import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';
import '../models/form.dart' as form_models;
import '../models/user.dart';
import '../models/campaign.dart';
import '../models/form_submission.dart';
import '../utils/network_utils.dart';

class ApiService {
  static ApiService? _instance;
  late Dio _dio;
  String? _baseUrl;

  // Singleton pattern
  factory ApiService() {
    _instance ??= ApiService._internal();
    return _instance!;
  }

  ApiService._internal() {
    _baseUrl = AppConfig.productionApiUrl; // URL de production par défaut
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl!,
      headers: {
        'Content-Type': 'application/json',
      },
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ));
  }

  void setBaseUrl(String url) {
    _baseUrl = url;
    _dio.options.baseUrl = url;
  }
  
  Future<void> saveApiUrl(String url) async {
    setBaseUrl(url);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_url', url);
  }
  
  String? getBaseUrl() => _baseUrl;

  // Authentication
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'username': username,
        'password': password,
      });

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', response.data['access_token']);
      await prefs.setString('user', jsonEncode(response.data['user']));

      return response.data;
    } catch (e) {
      // En cas d'erreur de connexion, essayer de détecter automatiquement l'IP (uniquement en développement)
      if (!AppConfig.isProduction && 
          e is DioException && 
          (e.type == DioExceptionType.connectionTimeout ||
           e.type == DioExceptionType.receiveTimeout ||
           e.type == DioExceptionType.connectionError)) {
        // Essayer de détecter une IP qui fonctionne
        final detectedUrl = await NetworkUtils.detectWorkingIP();
        if (detectedUrl != null && detectedUrl != _baseUrl) {
          // Mettre à jour l'URL et réessayer
          setBaseUrl(detectedUrl);
          await saveApiUrl(detectedUrl);
          
          // Réessayer la connexion avec la nouvelle URL
          try {
            final response = await _dio.post('/auth/login', data: {
              'username': username,
              'password': password,
            });

            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('access_token', response.data['access_token']);
            await prefs.setString('user', jsonEncode(response.data['user']));

            return response.data;
          } catch (retryError) {
            throw Exception(_handleError(retryError));
          }
        }
      }
      throw Exception(_handleError(e));
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('user');
  }

  // Forms
  Future<List<form_models.FormModel>> getForms() async {
    try {
      final response = await _dio.get('/forms');
      final List<dynamic> data = response.data;
      return data.map((json) => form_models.FormModel.fromJson(json)).toList();
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  Future<form_models.FormModel> getForm(String id) async {
    try {
      final response = await _dio.get('/forms/$id');
      return form_models.FormModel.fromJson(response.data);
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  Future<Map<String, dynamic>> getPublicForm(String id) async {
    try {
      final response = await _dio.get('/forms/public/$id');
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  Future<Map<String, dynamic>> submitForm(
    String formId,
    Map<String, dynamic> data, {
    String? campaignId,
  }) async {
    try {
      final response = await _dio.post(
        '/forms/public/$formId/submit',
        data: {
          'data': data,
          if (campaignId != null) 'campaignId': campaignId,
        },
      );
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  // Campaigns
  Future<List<Campaign>> getCampaigns() async {
    try {
      final response = await _dio.get('/campaigns');
      final List<dynamic> data = response.data;
      return data.map((json) => Campaign.fromJson(json)).toList();
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  // Prestataires
  Future<Map<String, dynamic>> getPrestataire(String id) async {
    try {
      final response = await _dio.get('/prestataires/$id');
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  // Mobile Sync (IT only)
  Future<Map<String, dynamic>> sync({
    bool downloadForms = true,
    bool downloadCampaigns = true,
    bool downloadPrestataires = false,
    String? campaignId,
    bool uploadPrestataires = false,
    List<Map<String, dynamic>>? prestataires,
    bool uploadValidations = false,
    List<Map<String, dynamic>>? validations,
  }) async {
    try {
      final response = await _dio.post('/mobile/sync', data: {
        'downloadForms': downloadForms,
        'downloadCampaigns': downloadCampaigns,
        'downloadPrestataires': downloadPrestataires,
        if (campaignId != null) 'campaignId': campaignId,
        'uploadPrestataires': uploadPrestataires,
        if (prestataires != null) 'prestataires': prestataires,
        'uploadValidations': uploadValidations,
        if (validations != null) 'validations': validations,
      });
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Récupérer tous les prestataires
  Future<List<Map<String, dynamic>>> getPrestataires() async {
    try {
      final response = await _dio.get('/prestataires');
      return List<Map<String, dynamic>>.from(response.data);
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Récupérer les prestataires en attente de validation depuis la table du formulaire
  Future<List<Map<String, dynamic>>> getPrestatairesPendingValidation({String? formId}) async {
    try {
      String url = '/prestataires/pending/validation';
      if (formId != null) {
        url += '?formId=$formId';
      }
      final response = await _dio.get(url);
      return List<Map<String, dynamic>>.from(response.data);
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Récupérer les prestataires depuis la table du formulaire
  Future<Map<String, dynamic>> getPrestatairesByForm(
    String formId, {
    int page = 1,
    int limit = 100,
  }) async {
    try {
      final response = await _dio.get(
        '/forms/$formId/prestataires/data',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Récupérer les approbations depuis la table du formulaire
  Future<List<Map<String, dynamic>>> getApprovalsByForm(
    String formId, {
    String? zoneId,
    String? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{'formId': formId};
      if (zoneId != null) queryParams['zoneId'] = zoneId;
      if (status != null) queryParams['status'] = status;
      
      final response = await _dio.get(
        '/approbations',
        queryParameters: queryParams,
      );
      return List<Map<String, dynamic>>.from(response.data);
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Valider un prestataire avec le nombre de jours de présence, la date de validation et la campagne
  Future<Map<String, dynamic>> validatePrestataire(
    String id, 
    int presenceDays, {
    DateTime? validationDate,
    String? campaignId,
  }) async {
    try {
      final data = <String, dynamic>{
        'presenceDays': presenceDays,
      };
      if (validationDate != null) {
        data['validationDate'] = validationDate.toIso8601String();
      }
      if (campaignId != null && campaignId.isNotEmpty) {
        data['campaignId'] = campaignId;
      }
      final response = await _dio.patch(
        '/prestataires/$id/validate',
        data: data,
      );
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Invalider un prestataire (remettre le status à ENREGISTRE)
  Future<Map<String, dynamic>> invalidatePrestataire(String id) async {
    try {
      final response = await _dio.patch('/prestataires/$id/invalidate');
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Mettre à jour les informations d'un prestataire
  Future<Map<String, dynamic>> updatePrestataire(
    String id,
    Map<String, dynamic> updateData, {
    String? formId,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (formId != null) {
        queryParams['formId'] = formId;
      }
      
      final response = await _dio.patch(
        '/prestataires/$id',
        data: updateData,
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );
      return response.data;
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  /// Récupérer toutes les validations d'un prestataire (historique des campagnes)
  Future<List<Map<String, dynamic>>> getPrestataireValidations(String id) async {
    try {
      final response = await _dio.get('/prestataires/$id/validations');
      final List<dynamic> data = response.data;
      return data.map((json) => Map<String, dynamic>.from(json)).toList();
    } catch (e) {
      throw Exception(_handleError(e));
    }
  }

  String _handleError(dynamic error) {
    if (error is DioException) {
      // Erreur avec réponse HTTP (codes de statut)
      if (error.response != null) {
        final status = error.response?.statusCode;
        final responseData = error.response?.data;
        final serverMessage = responseData is Map
            ? (responseData['message'] ?? responseData['error'] ?? '')
            : '';
        final requestUrl = error.requestOptions.path;
        
        // Gérer les codes HTTP spécifiques avec messages détaillés et solutions
        switch (status) {
          case 400:
            return serverMessage.isNotEmpty
                ? serverMessage
                : 'Requête invalide. Vérifiez les données envoyées.';
          
          case 401:
            // Pour les routes d'authentification, utiliser le message du serveur
            if (requestUrl.contains('/auth/login') || 
                requestUrl.contains('/auth/register') ||
                requestUrl.contains('/auth/')) {
              return serverMessage.isNotEmpty
                  ? serverMessage
                  : 'Identifiants incorrects. Vérifiez votre nom d\'utilisateur et mot de passe.';
            }
            return 'Session expirée. Veuillez vous reconnecter.';
          
          case 403:
            return serverMessage.isNotEmpty
                ? serverMessage
                : 'Accès refusé. Vous n\'avez pas les permissions nécessaires pour cette action.';
          
          case 404:
            return serverMessage.isNotEmpty
                ? serverMessage
                : 'Ressource non trouvée. L\'élément demandé n\'existe pas.';
          
          case 409:
            return serverMessage.isNotEmpty
                ? serverMessage
                : 'Conflit. Cette ressource existe déjà ou a été modifiée.';
          
          case 422:
            return serverMessage.isNotEmpty
                ? serverMessage
                : 'Données invalides. Veuillez vérifier les champs du formulaire.';
          
          case 429:
            return 'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.';
          
          case 500:
            final apiUrl = _baseUrl ?? (AppConfig.isProduction 
                ? 'https://drc-health-digital-paiement-production.up.railway.app'
                : AppConfig.productionApiUrl);
            return serverMessage.isNotEmpty
                ? '$serverMessage\n\nSolutions possibles:\n1. Réessayez dans quelques instants\n2. Vérifiez que le serveur est accessible: $apiUrl\n3. Contactez l\'administrateur si le problème persiste'
                : 'Erreur serveur interne.\n\nSolutions possibles:\n1. Réessayez dans quelques instants\n2. Vérifiez que le serveur est accessible: $apiUrl\n3. Contactez l\'administrateur si le problème persiste';
          
          case 502:
            final apiUrl502 = _baseUrl ?? (AppConfig.isProduction 
                ? 'https://drc-health-digital-paiement-production.up.railway.app'
                : AppConfig.productionApiUrl);
            return 'Serveur indisponible (Bad Gateway).\n\nSolutions possibles:\n1. Le serveur backend est peut-être en cours de redémarrage\n2. Vérifiez que le serveur est accessible: $apiUrl502\n3. Réessayez dans quelques instants';
          
          case 503:
            final apiUrl503 = _baseUrl ?? (AppConfig.isProduction 
                ? 'https://drc-health-digital-paiement-production.up.railway.app'
                : AppConfig.productionApiUrl);
            return 'Service temporairement indisponible.\n\nSolutions possibles:\n1. Le serveur est en maintenance\n2. Réessayez dans quelques minutes\n3. Vérifiez l\'état du serveur: $apiUrl503';
          
          case 504:
            return 'Timeout de la passerelle.\n\nSolutions possibles:\n1. Le serveur met trop de temps à répondre\n2. Vérifiez votre connexion internet\n3. Réessayez plus tard';
          
          default:
            return serverMessage.isNotEmpty
                ? serverMessage
                : 'Erreur HTTP ${status ?? "inconnu"}. Veuillez réessayer ou contacter le support.';
        }
      }
      
      // Erreurs réseau (pas de réponse du serveur)
      final apiUrl = _baseUrl ?? (AppConfig.isProduction 
          ? 'https://drc-health-digital-paiement-production.up.railway.app'
          : AppConfig.productionApiUrl);
      
      // Timeout
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'Timeout de connexion.\n\nURL utilisée: $apiUrl\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Le serveur est peut-être surchargé\n3. Réessayez dans quelques instants\n4. Testez dans le navigateur: $apiUrl/api';
      }
      
      // Erreur de connexion
      if (error.type == DioExceptionType.connectionError) {
        return 'Connexion refusée.\n\nURL utilisée: $apiUrl\n\nSolutions possibles:\n1. Le serveur backend n\'est peut-être pas démarré\n2. Vérifiez que le serveur est accessible: $apiUrl\n3. Testez dans le navigateur: $apiUrl/api\n4. Contactez l\'administrateur';
      }
      
      // Erreur inconnue (peut inclure DNS, réseau inaccessible, etc.)
      if (error.type == DioExceptionType.unknown) {
        final errorMessage = error.message ?? '';
        
        // Erreur DNS/hostname
        if (errorMessage.contains('Failed host lookup') || 
            errorMessage.contains('Network is unreachable') ||
            errorMessage.contains('getaddrinfo')) {
          return 'Réseau inaccessible.\n\nURL utilisée: $apiUrl\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Vérifiez que l\'URL du serveur est correcte\n3. Testez dans le navigateur: $apiUrl/api';
        }
        
        // Erreur générique
        return 'Impossible de contacter le serveur.\n\nURL utilisée: $apiUrl\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Vérifiez que le serveur est accessible: $apiUrl\n3. Testez dans le navigateur: $apiUrl/api\n4. Réessayez dans quelques instants';
      }
      
      // Autres types d'erreurs DioException
      return error.message ?? 'Erreur de connexion. Veuillez réessayer.';
    }
    
    // Erreur non-DioException
    return error.toString();
  }
}

