import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/form_submission.dart';
import '../providers/submissions_provider.dart';
import '../providers/forms_provider.dart';
import '../services/database_service.dart';
import 'form_fill_screen.dart';
import '../models/form.dart' as model;

class DraftsScreen extends StatefulWidget {
  const DraftsScreen({super.key});

  @override
  State<DraftsScreen> createState() => _DraftsScreenState();
}

class _DraftsScreenState extends State<DraftsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);
    final formsProvider = Provider.of<FormsProvider>(context, listen: false);
    
    await submissionsProvider.loadAllSubmissions();
    await formsProvider.loadForms();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ébauches'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Consumer2<SubmissionsProvider, FormsProvider>(
        builder: (context, submissionsProvider, formsProvider, child) {
          // Filtrer les soumissions en brouillon (draft)
          final drafts = submissionsProvider.submissions
              .where((s) => s.status == SubmissionStatus.draft)
              .toList();

          if (drafts.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.edit_outlined,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Aucune ébauche',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Commencez à remplir un formulaire',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade500,
                        ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: drafts.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final submission = drafts[index];
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
              return _buildDraftCard(context, submission, form);
            },
          );
        },
      ),
    );
  }

  Widget _buildDraftCard(
    BuildContext context,
    FormSubmission submission,
    model.FormModel form,
  ) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.orange.shade100,
          child: Icon(
            Icons.edit_outlined,
            color: Colors.orange.shade700,
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
        trailing: PopupMenuButton<String>(
          onSelected: (value) async {
            if (value == 'edit') {
              // Charger les données complètes avant d'ouvrir le formulaire
              final databaseService = DatabaseService();
              final submissionWithData = await databaseService.getSubmissionWithData(submission.id!);
              if (submissionWithData == null) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Impossible de charger les données de l\'ébauche'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
                return;
              }
              // Continuer à remplir le formulaire
              if (mounted) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => FormFillScreen(
                      form: form,
                      existingSubmission: submissionWithData,
                    ),
                  ),
                );
              }
            } else if (value == 'delete') {
              // Supprimer l'ébauche
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Supprimer l\'ébauche'),
                  content: const Text('Êtes-vous sûr de vouloir supprimer cette ébauche ?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Annuler'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.red,
                      ),
                      child: const Text('Supprimer'),
                    ),
                  ],
                ),
              );

              if (confirmed == true && mounted) {
                final databaseService = DatabaseService();
                await databaseService.deleteSubmission(submission.id!);
                final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);
                await submissionsProvider.loadAllSubmissions();
              }
            }
          },
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'edit',
              child: Row(
                children: [
                  Icon(Icons.edit, size: 20),
                  SizedBox(width: 8),
                  Text('Continuer'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'delete',
              child: Row(
                children: [
                  Icon(Icons.delete, size: 20, color: Colors.red),
                  SizedBox(width: 8),
                  Text('Supprimer', style: TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ],
        ),
        onTap: () async {
          // Charger les données complètes avant d'ouvrir le formulaire
          final databaseService = DatabaseService();
          final submissionWithData = await databaseService.getSubmissionWithData(submission.id!);
          if (submissionWithData == null) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Impossible de charger les données de l\'ébauche'),
                  backgroundColor: Colors.red,
                ),
              );
            }
            return;
          }
          // Continuer à remplir le formulaire
          if (mounted) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => FormFillScreen(
                  form: form,
                  existingSubmission: submissionWithData,
                ),
              ),
            );
          }
        },
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}

