import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/sync_service.dart';

class SyncProvider with ChangeNotifier {
  final SyncService _syncService;
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;
  bool _isSyncing = false;
  bool _isConnected = false;
  SyncResult? _lastSyncResult;
  bool _wasDisconnected = false; // Pour détecter la reconnexion

  SyncProvider(this._syncService) {
    _checkConnectivity();
    _startConnectivityListener();
  }

  bool get isSyncing => _isSyncing;
  bool get isConnected => _isConnected;
  SyncResult? get lastSyncResult => _lastSyncResult;
  
  // Exposer le SyncService pour vérifier la connexion
  SyncService get syncService => _syncService;

  // Callback pour la synchronisation automatique lors de la reconnexion
  VoidCallback? onReconnected;

  void _startConnectivityListener() {
    // Écouter les changements de connectivité en temps réel
    // Note: connectivity_plus 5.0.2 retourne un seul ConnectivityResult, pas une liste
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
      (ConnectivityResult result) async {
        final wasConnected = _isConnected;
        _isConnected = result != ConnectivityResult.none;
        
        // Si on passe de déconnecté à connecté, déclencher la synchronisation automatique
        if (!wasConnected && _isConnected && _wasDisconnected) {
          _wasDisconnected = false;
          // Notifier les listeners du changement de statut
          notifyListeners();
          // Déclencher la synchronisation automatique si un callback est défini
          if (onReconnected != null) {
            onReconnected!();
          }
        } else if (!_isConnected) {
          _wasDisconnected = true;
        }
        
        notifyListeners();
      },
    );
  }

  Future<void> _checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    final wasConnected = _isConnected;
    _isConnected = result != ConnectivityResult.none;
    
    if (!_isConnected) {
      _wasDisconnected = true;
    } else if (!wasConnected && _isConnected && _wasDisconnected) {
      // Reconnexion détectée
      _wasDisconnected = false;
      if (onReconnected != null) {
        onReconnected!();
      }
    }
    
    notifyListeners();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
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

