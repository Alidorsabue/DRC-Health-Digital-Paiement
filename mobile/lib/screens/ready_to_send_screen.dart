import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/form_submission.dart';
import '../providers/submissions_provider.dart';
import '../providers/forms_provider.dart';
import '../providers/sync_provider.dart';
import '../models/form.dart' as model;

class ReadyToSendScreen extends StatefulWidget {
  const ReadyToSendScreen({super.key});

  @override
  State<ReadyToSendScreen> createState() => _ReadyToSendScreenState();
}

class _ReadyToSendScreenState extends State<ReadyToSendScreen> with RouteAware, WidgetsBindingObserver {
  // État local pour stocker les soumissions pending
  // Utiliser un Set pour éviter les doublons basé sur l'ID
  final Set<String> _localPendingSubmissionIds = {};
  final Map<String, FormSubmission> _localPendingSubmissionsMap = {};
  bool _isLoading = false;
  bool _isInitialized = false;
  DateTime? _lastLoadTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // Recharger les données quand l'app revient au premier plan
    if (state == AppLifecycleState.resumed && _isInitialized) {
      // Attendre un peu pour laisser le temps aux autres écrans de sauvegarder
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          _refreshDataSilently();
        }
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Recharger les données quand on revient sur cet écran après un délai
    // pour détecter les nouvelles soumissions créées depuis un autre écran
    if (_isInitialized && _lastLoadTime != null) {
      final timeSinceLastLoad = DateTime.now().difference(_lastLoadTime!);
      // Recharger si plus de 2 secondes se sont écoulées depuis le dernier chargement
      if (timeSinceLastLoad.inSeconds > 2) {
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            _refreshDataSilently();
          }
        });
      }
    }
  }

  Future<void> _loadData() async {
    if (_isLoading) return; // Éviter les chargements multiples
    
    setState(() {
      _isLoading = true;
    });

    try {
      final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);
      final formsProvider = Provider.of<FormsProvider>(context, listen: false);
      
      // Charger les soumissions depuis la base de données locale uniquement
      // NE PAS déclencher de synchronisation automatique
      await submissionsProvider.loadAllSubmissions();
      await formsProvider.loadForms();
      
      // Filtrer et stocker localement les soumissions pending
      final allSubmissions = submissionsProvider.submissions;
      final pendingSubmissions = allSubmissions
          .where((s) => s.status == SubmissionStatus.pending || 
                       s.status == SubmissionStatus.syncing)
          .toList();
      
      // Mettre à jour l'état local avec toutes les soumissions pending ou syncing
      // Cela permet de garder les soumissions même si elles sont en cours de synchronisation
      if (mounted) {
        setState(() {
          _localPendingSubmissionIds.clear();
          _localPendingSubmissionsMap.clear();
          
          for (var submission in pendingSubmissions) {
            if (submission.id != null) {
              _localPendingSubmissionIds.add(submission.id!);
              _localPendingSubmissionsMap[submission.id!] = submission;
            }
          }
          
          _isLoading = false;
          _isInitialized = true;
          _lastLoadTime = DateTime.now();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isInitialized = true;
        });
      }
    }
  }

  /// Rafraîchit les données silencieusement sans réinitialiser complètement
  Future<void> _refreshDataSilently() async {
    try {
      final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);
      await submissionsProvider.loadAllSubmissions();
      
      final allSubmissions = submissionsProvider.submissions;
      final pendingSubmissions = allSubmissions
          .where((s) => s.status == SubmissionStatus.pending || 
                       s.status == SubmissionStatus.syncing)
          .toList();
      
      // Ajouter les nouvelles soumissions sans supprimer celles qui existent déjà
      // Cela protège contre les synchronisations automatiques qui changent le statut
      if (mounted) {
        setState(() {
          for (var submission in pendingSubmissions) {
            if (submission.id != null) {
              _localPendingSubmissionIds.add(submission.id!);
              _localPendingSubmissionsMap[submission.id!] = submission;
            }
          }
          
          // Retirer seulement les soumissions qui sont maintenant synced ou error
          final syncedOrErrorIds = allSubmissions
              .where((s) => s.status == SubmissionStatus.synced || 
                           s.status == SubmissionStatus.error)
              .map((s) => s.id)
              .where((id) => id != null)
              .cast<String>()
              .toSet();
          
          for (var id in syncedOrErrorIds) {
            _localPendingSubmissionIds.remove(id);
            _localPendingSubmissionsMap.remove(id);
          }
        });
      }
    } catch (e) {
      // Ignorer les erreurs silencieuses
    }
  }

  /// Obtient la liste des soumissions pending à afficher
  /// Triées par date de création (plus récentes en premier)
  List<FormSubmission> get _localPendingSubmissions {
    return _localPendingSubmissionIds
        .map((id) => _localPendingSubmissionsMap[id])
        .where((s) => s != null)
        .cast<FormSubmission>()
        .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Prêt à envoyer'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          Builder(
            builder: (context) {
              // Utiliser l'état local pour déterminer si on doit afficher le bouton
              final readyToSend = _localPendingSubmissions;
              
              if (readyToSend.isEmpty) {
                return const SizedBox.shrink();
              }
              
              return TextButton.icon(
                onPressed: () => _sendAll(context),
                icon: const Icon(Icons.send, color: Colors.blue),
                label: Text(
                  'Tout envoyer (${readyToSend.length})',
                  style: const TextStyle(color: Colors.blue),
                ),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Consumer2<SubmissionsProvider, FormsProvider>(
              builder: (context, submissionsProvider, formsProvider, child) {
                // Utiliser l'état local pour éviter que les soumissions disparaissent
                // lors d'une synchronisation automatique en arrière-plan
                var readyToSend = _localPendingSubmissions;

                // Si l'état local est vide et qu'on est initialisé, vérifier le provider
                // pour détecter les nouvelles soumissions
                if (readyToSend.isEmpty && _isInitialized) {
                  // Vérifier si le provider a des soumissions pending ou syncing
                  final providerPending = submissionsProvider.submissions
                      .where((s) => s.status == SubmissionStatus.pending || 
                                   s.status == SubmissionStatus.syncing)
                      .toList();
                  
                  if (providerPending.isNotEmpty) {
                    // Ajouter les nouvelles soumissions à l'état local de manière asynchrone
                    // pour éviter les problèmes de reconstruction
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        setState(() {
                          for (var submission in providerPending) {
                            if (submission.id != null) {
                              _localPendingSubmissionIds.add(submission.id!);
                              _localPendingSubmissionsMap[submission.id!] = submission;
                            }
                          }
                        });
                      }
                    });
                    readyToSend = providerPending;
                  }
                }

                if (readyToSend.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.send_outlined,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Aucun formulaire prêt à envoyer',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Complétez un formulaire pour l\'envoyer',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade500,
                        ),
                  ),
                ],
              ),
            );
          }

                return RefreshIndicator(
                  onRefresh: () async {
                    await _loadData();
                  },
                  child: ListView.builder(
                    itemCount: readyToSend.length,
                    padding: const EdgeInsets.all(8),
                    itemBuilder: (context, index) {
                      final submission = readyToSend[index];
                      final form = formsProvider.forms.firstWhere(
                        (f) => f.id == submission.formId,
                        orElse: () => model.FormModel(
                          id: submission.formId,
                          name: 'Formulaire supprimé',
                          type: 'unknown',
                          versions: [],
                          createdAt: DateTime.now(),
                          updatedAt: DateTime.now(),
                        ),
                      );
                      return _buildReadyToSendCard(context, submission, form);
                    },
                  ),
                );
              },
            ),
    );
  }

  Widget _buildReadyToSendCard(
    BuildContext context,
    FormSubmission submission,
    model.FormModel form,
  ) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue.shade100,
          child: Icon(
            Icons.send_outlined,
            color: Colors.blue.shade700,
          ),
        ),
        title: Text(
          form.name,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              'Créé le ${_formatDate(submission.createdAt)}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
        trailing: Consumer<SyncProvider>(
          builder: (context, syncProvider, child) {
            if (syncProvider.isSyncing) {
              return const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              );
            }
            return IconButton(
              icon: const Icon(Icons.send, color: Colors.blue),
              onPressed: () => _sendSubmission(context, submission),
              tooltip: 'Envoyer',
            );
          },
        ),
        onTap: () {
          // Afficher les détails ou envoyer
          _sendSubmission(context, submission);
        },
      ),
    );
  }

  Future<void> _sendSubmission(BuildContext context, FormSubmission submission) async {
    final syncProvider = Provider.of<SyncProvider>(context, listen: false);
    final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);

    try {
      // Synchroniser uniquement cette soumission spécifique
      await syncProvider.syncPendingSubmissions();
      
      // Recharger les soumissions depuis la base de données
      await submissionsProvider.loadAllSubmissions();
      
      // Mettre à jour l'état local après l'envoi
      // Retirer la soumission envoyée de l'état local
      if (mounted && submission.id != null) {
        setState(() {
          _localPendingSubmissionIds.remove(submission.id!);
          _localPendingSubmissionsMap.remove(submission.id!);
        });
        
        // Rafraîchir pour voir s'il y a d'autres soumissions
        await _refreshDataSilently();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Formulaire envoyé avec succès'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de l\'envoi: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _sendAll(BuildContext context) async {
    final syncProvider = Provider.of<SyncProvider>(context, listen: false);
    final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);

    try {
      // Synchroniser toutes les soumissions pending
      await syncProvider.syncPendingSubmissions();
      
      // Recharger les soumissions depuis la base de données
      await submissionsProvider.loadAllSubmissions();
      
      // Vider l'état local car toutes les soumissions ont été envoyées
      if (mounted) {
        setState(() {
          _localPendingSubmissionIds.clear();
          _localPendingSubmissionsMap.clear();
        });
        
        // Rafraîchir pour voir s'il y a de nouvelles soumissions
        await _refreshDataSilently();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tous les formulaires ont été envoyés'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de l\'envoi: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}

