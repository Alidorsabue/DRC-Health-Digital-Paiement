import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
    _baseUrl = 'http://localhost:3001'; // Par défaut, peut être configuré
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl!,
      headers: {
        'Content-Type': 'application/json',
      },
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
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
      // En cas d'erreur de connexion, essayer de détecter automatiquement l'IP
      if (e is DioException && 
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
            throw _handleError(retryError);
          }
        }
      }
      throw _handleError(e);
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
      throw _handleError(e);
    }
  }

  Future<form_models.FormModel> getForm(String id) async {
    try {
      final response = await _dio.get('/forms/$id');
      return form_models.FormModel.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getPublicForm(String id) async {
    try {
      final response = await _dio.get('/forms/public/$id');
      return response.data;
    } catch (e) {
      throw _handleError(e);
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
      throw _handleError(e);
    }
  }

  // Campaigns
  Future<List<Campaign>> getCampaigns() async {
    try {
      final response = await _dio.get('/campaigns');
      final List<dynamic> data = response.data;
      return data.map((json) => Campaign.fromJson(json)).toList();
    } catch (e) {
      throw _handleError(e);
    }
  }

  // Prestataires
  Future<Map<String, dynamic>> getPrestataire(String id) async {
    try {
      final response = await _dio.get('/prestataires/$id');
      return response.data;
    } catch (e) {
      throw _handleError(e);
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
      throw _handleError(e);
    }
  }

  /// Récupérer tous les prestataires
  Future<List<Map<String, dynamic>>> getPrestataires() async {
    try {
      final response = await _dio.get('/prestataires');
      return List<Map<String, dynamic>>.from(response.data);
    } catch (e) {
      throw _handleError(e);
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
      throw _handleError(e);
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
      throw _handleError(e);
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
      throw _handleError(e);
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
      throw _handleError(e);
    }
  }

  /// Invalider un prestataire (remettre le status à ENREGISTRE)
  Future<Map<String, dynamic>> invalidatePrestataire(String id) async {
    try {
      final response = await _dio.patch('/prestataires/$id/invalidate');
      return response.data;
    } catch (e) {
      throw _handleError(e);
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
      throw _handleError(e);
    }
  }

  /// Récupérer toutes les validations d'un prestataire (historique des campagnes)
  Future<List<Map<String, dynamic>>> getPrestataireValidations(String id) async {
    try {
      final response = await _dio.get('/prestataires/$id/validations');
      final List<dynamic> data = response.data;
      return data.map((json) => Map<String, dynamic>.from(json)).toList();
    } catch (e) {
      throw _handleError(e);
    }
  }

  String _handleError(dynamic error) {
    if (error is DioException) {
      if (error.response != null) {
        final message = error.response?.data['message'] ?? 
                       error.response?.data['error'] ?? 
                       'Erreur serveur';
        return message;
      } else if (error.type == DioExceptionType.connectionTimeout ||
                 error.type == DioExceptionType.receiveTimeout) {
        return 'Timeout de connexion.\n\nURL utilisée: ${_baseUrl ?? "non configuré"}\n\nVérifications:\n1. Le serveur est démarré?\n2. L\'URL est correcte\n3. Le firewall autorise le port 3001?\n4. Testez dans le navigateur: ${_baseUrl ?? "http://localhost:3001"}/api\n\n💡 L\'application va essayer de détecter automatiquement une IP qui fonctionne.';
      } else if (error.type == DioExceptionType.connectionError) {
        return 'Connexion refusée.\n\nURL utilisée: ${_baseUrl ?? "non configuré"}\n\nVérifications:\n1. Le serveur backend est démarré\n2. Le serveur écoute sur 0.0.0.0:3001\n3. Testez dans le navigateur: ${_baseUrl ?? "http://localhost:3001"}/api\n\n💡 L\'application va essayer de détecter automatiquement une IP qui fonctionne.';
      } else if (error.type == DioExceptionType.unknown) {
        final errorMessage = error.message ?? '';
        if (errorMessage.contains('Failed host lookup') || errorMessage.contains('Network is unreachable')) {
          return 'Réseau inaccessible.\n\nURL utilisée: ${_baseUrl ?? "non configuré"}\n\nVérifications:\n1. Le téléphone et l\'ordinateur sont sur le même réseau\n2. Testez dans le navigateur: ${_baseUrl ?? "http://localhost:3001"}/api\n\n💡 L\'application va essayer de détecter automatiquement une IP qui fonctionne.';
        }
        return 'Impossible de se connecter.\n\nURL: ${_baseUrl ?? "non configuré"}\n\nVérifiez:\n1. Serveur démarré\n2. URL correcte\n3. Firewall autorisé\n4. Test navigateur: ${_baseUrl ?? "http://localhost:3001"}/api\n\n💡 L\'application va essayer de détecter automatiquement une IP qui fonctionne.';
      }
      return error.message ?? 'Erreur inconnue';
    }
    return error.toString();
  }
}

