import 'package:flutter/foundation.dart';
import '../services/sync_service.dart';

class SyncProvider with ChangeNotifier {
  final SyncService _syncService;
  bool _isSyncing = false;
  bool _isConnected = false;
  SyncResult? _lastSyncResult;

  SyncProvider(this._syncService) {
    _checkConnectivity();
  }

  bool get isSyncing => _isSyncing;
  bool get isConnected => _isConnected;
  SyncResult? get lastSyncResult => _lastSyncResult;
  
  // Exposer le SyncService pour vérifier la connexion
  SyncService get syncService => _syncService;

  Future<void> _checkConnectivity() async {
    _isConnected = await _syncService.isConnected();
    notifyListeners();
  }

  Future<void> syncAll() async {
    _isSyncing = true;
    notifyListeners();

    try {
      await _checkConnectivity();
      _lastSyncResult = await _syncService.syncAll();
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> syncPendingSubmissions() async {
    _isSyncing = true;
    notifyListeners();

    try {
      await _checkConnectivity();
      _lastSyncResult = await _syncService.syncPendingSubmissions();
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }
}

