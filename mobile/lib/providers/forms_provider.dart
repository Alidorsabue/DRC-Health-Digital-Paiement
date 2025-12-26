import 'package:flutter/foundation.dart';
import '../models/form.dart' as model;
import '../services/database_service.dart';
import '../services/api_service.dart';
import '../services/sync_service.dart';

class FormsProvider with ChangeNotifier {
  final DatabaseService _databaseService;
  final ApiService _apiService;
  final SyncService _syncService;
  
  List<model.FormModel> _forms = [];
  bool _isLoading = false;
  String? _errorMessage;

  FormsProvider(this._databaseService, this._apiService, this._syncService);

  List<model.FormModel> get forms => _forms;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> loadForms() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _forms = await _databaseService.getForms();
    } catch (e) {
      _errorMessage = 'Erreur lors du chargement: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Synchronise les formulaires depuis le serveur
  /// Utilise l'endpoint /mobile/sync qui filtre uniquement les formulaires avec isSentToMobile: true
  Future<bool> refreshForms() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Utiliser SyncService qui appelle l'endpoint /mobile/sync
      // Cet endpoint retourne uniquement les formulaires avec isSentToMobile: true
      final syncResult = await _syncService.syncAll(force: true);
      
      if (syncResult.success) {
        // Recharger les formulaires depuis la base de données locale
        _forms = await _databaseService.getForms();
        return true;
      } else {
        _errorMessage = syncResult.message;
        return false;
      }
    } catch (e) {
      _errorMessage = 'Erreur lors de la synchronisation: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

