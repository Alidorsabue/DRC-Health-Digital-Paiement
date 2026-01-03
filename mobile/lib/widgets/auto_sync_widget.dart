import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/forms_provider.dart';
import '../providers/sync_provider.dart';
import '../providers/auth_provider.dart';
import '../services/sync_service.dart';

/// Widget qui gère la synchronisation automatique des formulaires
/// - Synchronise au démarrage de l'application
/// - Synchronise quand l'application revient au premier plan
/// - Synchronise périodiquement en arrière-plan
class AutoSyncWidget extends StatefulWidget {
  final Widget child;

  const AutoSyncWidget({
    super.key,
    required this.child,
  });

  @override
  State<AutoSyncWidget> createState() => _AutoSyncWidgetState();
}

class _AutoSyncWidgetState extends State<AutoSyncWidget> with WidgetsBindingObserver {
  Timer? _periodicSyncTimer;
  DateTime? _lastSyncTime;
  bool _isSyncing = false;
  bool _isSyncingSubmissions = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    
    // Synchroniser immédiatement au démarrage
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _performAutoSync(silent: true);
      _syncPendingSubmissionsOnReconnect();
    });

    // Démarrer le timer de synchronisation périodique (toutes les 5 minutes)
    _startPeriodicSync();
    
    // Configurer le callback de reconnexion dans SyncProvider
    _setupReconnectListener();
  }

  void _setupReconnectListener() {
    // Attendre que le contexte soit disponible
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final syncProvider = Provider.of<SyncProvider>(context, listen: false);
      syncProvider.onReconnected = () {
        // Synchroniser automatiquement les soumissions en attente lors de la reconnexion
        _syncPendingSubmissionsOnReconnect();
      };
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _periodicSyncTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    // Synchroniser quand l'application revient au premier plan
    if (state == AppLifecycleState.resumed) {
      _performAutoSync(silent: true);
      _syncPendingSubmissionsOnReconnect(silent: true);
    }
  }

  void _startPeriodicSync() {
    // Synchroniser toutes les 5 minutes
    _periodicSyncTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) {
        _performAutoSync(silent: true);
        _syncPendingSubmissionsOnReconnect(silent: true);
      },
    );
  }

  Future<void> _performAutoSync({bool silent = false}) async {
    // Éviter les synchronisations simultanées
    if (_isSyncing) return;
    
    // Vérifier que l'utilisateur est authentifié
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (!authProvider.isAuthenticated) {
      return; // Ne pas synchroniser si l'utilisateur n'est pas connecté
    }
    
    // Éviter les synchronisations trop fréquentes (minimum 30 secondes entre deux syncs)
    if (_lastSyncTime != null) {
      final timeSinceLastSync = DateTime.now().difference(_lastSyncTime!);
      if (timeSinceLastSync.inSeconds < 30) {
        return;
      }
    }

    // Vérifier la connexion avant de synchroniser
    final syncProvider = Provider.of<SyncProvider>(context, listen: false);
    if (!await syncProvider.syncService.isConnected()) {
      // Pas de connexion, on ne synchronise pas silencieusement
      if (!silent) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pas de connexion internet pour la synchronisation automatique'),
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
      return;
    }

    _isSyncing = true;
    _lastSyncTime = DateTime.now();

    try {
      final formsProvider = Provider.of<FormsProvider>(context, listen: false);
      final success = await formsProvider.refreshForms();
      
      if (!silent && mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(formsProvider.forms.isEmpty 
                  ? 'Aucun formulaire disponible'
                  : '${formsProvider.forms.length} formulaire(s) synchronisé(s)'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 2),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(formsProvider.errorMessage ?? 'Erreur lors de la synchronisation'),
              backgroundColor: Colors.orange,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (e) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } finally {
      _isSyncing = false;
    }
  }

  /// Synchronise automatiquement les soumissions en attente (prestataires) lors de la reconnexion
  Future<void> _syncPendingSubmissionsOnReconnect({bool silent = true}) async {
    // Éviter les synchronisations simultanées des soumissions
    if (_isSyncingSubmissions) return;
    
    // Vérifier que l'utilisateur est authentifié
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (!authProvider.isAuthenticated) {
      return;
    }

    // Vérifier la connexion
    final syncProvider = Provider.of<SyncProvider>(context, listen: false);
    if (!await syncProvider.syncService.isConnected()) {
      return;
    }

    _isSyncingSubmissions = true;

    try {
      // Synchroniser les soumissions en attente (prestataires enregistrés)
      await syncProvider.syncPendingSubmissions();
      final syncResult = syncProvider.lastSyncResult;
      
      if (syncResult != null && syncResult.success && syncResult.syncedSubmissions > 0) {
        // Afficher un message de succès même en mode silencieux pour informer l'utilisateur
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '${syncResult.syncedSubmissions} prestataire(s) synchronisé(s) automatiquement',
              ),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } else if (syncResult != null && syncResult.failedSubmissions > 0) {
        // Afficher un avertissement si certaines soumissions ont échoué
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '${syncResult.failedSubmissions} prestataire(s) n\'ont pas pu être synchronisés. Veuillez réessayer.',
              ),
              backgroundColor: Colors.orange,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      // Ne pas afficher d'erreur en mode silencieux pour éviter de perturber l'utilisateur
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de la synchronisation automatique: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } finally {
      _isSyncingSubmissions = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

