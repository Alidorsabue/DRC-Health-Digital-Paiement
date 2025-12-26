import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/form.dart' as model;
import '../models/form_submission.dart';
import '../providers/submissions_provider.dart';
import '../providers/forms_provider.dart';
import '../services/database_service.dart';
import 'form_fill_screen.dart';

class SubmissionsListScreen extends StatefulWidget {
  final model.FormModel form;

  const SubmissionsListScreen({super.key, required this.form});

  @override
  State<SubmissionsListScreen> createState() => _SubmissionsListScreenState();
}

class _SubmissionsListScreenState extends State<SubmissionsListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSubmissions();
    });
  }

  Future<void> _loadSubmissions() async {
    final provider =
        Provider.of<SubmissionsProvider>(context, listen: false);
    await provider.loadSubmissions(widget.form.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Soumissions - ${widget.form.name}'),
      ),
      body: Consumer<SubmissionsProvider>(
        builder: (context, provider, child) {
          final submissions = provider.getSubmissionsForForm(widget.form.id);

          if (submissions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.inbox_outlined,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Aucune soumission',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: submissions.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final submission = submissions[index];
              return _buildSubmissionCard(context, submission);
            },
          );
        },
      ),
    );
  }

  Widget _buildSubmissionCard(BuildContext context, FormSubmission submission) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');
    final statusColor = _getStatusColor(submission.status);
    final statusIcon = _getStatusIcon(submission.status);
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: colorScheme.primaryContainer,
          child: Icon(statusIcon, color: colorScheme.onPrimaryContainer),
        ),
        title: Text(
          'Soumission du ${dateFormat.format(submission.createdAt)}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _getStatusLabel(submission.status),
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurface,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            if (submission.errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                submission.errorMessage!,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.red.shade700,
                ),
              ),
            ],
          ],
        ),
        trailing: submission.status == SubmissionStatus.error
            ? IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () async {
                  final provider =
                      Provider.of<SubmissionsProvider>(context, listen: false);
                  await provider.retrySubmission(submission.id!);
                  await _loadSubmissions();
                },
                tooltip: 'Réessayer',
              )
            : null,
        onTap: () async {
          await _showSubmissionDetails(context, submission);
        },
      ),
    );
  }

  Future<void> _editSubmission(BuildContext context, FormSubmission submission) async {
    // Charger les données complètes si nécessaire
    FormSubmission submissionToEdit = submission;
    if (submission.data.isEmpty && submission.id != null) {
      final databaseService = DatabaseService();
      final submissionWithData = await databaseService.getSubmissionWithData(submission.id!);
      if (submissionWithData != null) {
        submissionToEdit = submissionWithData;
      }
    }

    if (!context.mounted) return;

    // Naviguer vers l'écran d'édition du formulaire
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FormFillScreen(
          form: widget.form,
          existingSubmission: submissionToEdit,
        ),
      ),
    ).then((_) {
      // Recharger les soumissions après l'édition
      _loadSubmissions();
    });
  }

  Future<void> _showSubmissionDetails(BuildContext context, FormSubmission submission) async {
    // Charger les données complètes si elles ne sont pas déjà chargées
    FormSubmission submissionToShow = submission;
    if (submission.data.isEmpty && submission.id != null) {
      final databaseService = DatabaseService();
      final submissionWithData = await databaseService.getSubmissionWithData(submission.id!);
      if (submissionWithData != null) {
        submissionToShow = submissionWithData;
      }
    }

    if (!context.mounted) return;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Détails de la soumission'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Date: ${DateFormat('dd/MM/yyyy HH:mm').format(submissionToShow.createdAt)}'),
              Text('Statut: ${_getStatusLabel(submissionToShow.status)}'),
              if (submissionToShow.syncedAt != null)
                Text('Synchronisé le: ${DateFormat('dd/MM/yyyy HH:mm').format(submissionToShow.syncedAt!)}'),
              const SizedBox(height: 16),
              const Text('Données:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (submissionToShow.data.isEmpty)
                const Text('Aucune donnée disponible', style: TextStyle(fontStyle: FontStyle.italic))
              else
                ...submissionToShow.data.entries.map((entry) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('${entry.key}: ${entry.value}'),
                  );
                }),
            ],
          ),
        ),
        actions: [
          // Bouton Éditer - seulement pour les ébauches et les soumissions en attente
          if (submissionToShow.status == SubmissionStatus.draft || 
              submissionToShow.status == SubmissionStatus.pending)
            TextButton.icon(
              onPressed: () async {
                Navigator.pop(context); // Fermer le dialogue
                await _editSubmission(context, submissionToShow);
              },
              icon: const Icon(Icons.edit, size: 18),
              label: const Text('Éditer'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Fermer'),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(SubmissionStatus status) {
    switch (status) {
      case SubmissionStatus.draft:
        return Colors.grey;
      case SubmissionStatus.pending:
        return Colors.orange;
      case SubmissionStatus.syncing:
        return Colors.blue;
      case SubmissionStatus.synced:
        return Colors.green;
      case SubmissionStatus.error:
        return Colors.red;
    }
  }

  IconData _getStatusIcon(SubmissionStatus status) {
    switch (status) {
      case SubmissionStatus.draft:
        return Icons.edit_outlined;
      case SubmissionStatus.pending:
        return Icons.pending;
      case SubmissionStatus.syncing:
        return Icons.sync;
      case SubmissionStatus.synced:
        return Icons.check_circle;
      case SubmissionStatus.error:
        return Icons.error;
    }
  }

  String _getStatusLabel(SubmissionStatus status) {
    switch (status) {
      case SubmissionStatus.draft:
        return 'Ébauche';
      case SubmissionStatus.pending:
        return 'En attente';
      case SubmissionStatus.syncing:
        return 'Synchronisation';
      case SubmissionStatus.synced:
        return 'Synchronisé';
      case SubmissionStatus.error:
        return 'Erreur';
    }
  }
}

