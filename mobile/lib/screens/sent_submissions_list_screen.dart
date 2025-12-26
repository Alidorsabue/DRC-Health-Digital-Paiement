import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/form_submission.dart';
import '../providers/submissions_provider.dart';
import '../providers/forms_provider.dart';
import '../models/form.dart' as model;

class SentSubmissionsListScreen extends StatefulWidget {
  const SentSubmissionsListScreen({super.key});

  @override
  State<SentSubmissionsListScreen> createState() => _SentSubmissionsListScreenState();
}

class _SentSubmissionsListScreenState extends State<SentSubmissionsListScreen> {
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
        title: const Text('Envoyé'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Actualiser',
          ),
        ],
      ),
      body: Consumer2<SubmissionsProvider, FormsProvider>(
        builder: (context, submissionsProvider, formsProvider, child) {
          // Filtrer les soumissions envoyées (synced)
          final sentSubmissions = submissionsProvider.submissions
              .where((s) => s.status == SubmissionStatus.synced)
              .toList();

          if (sentSubmissions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.check_circle_outline,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Aucun formulaire envoyé',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Les formulaires envoyés apparaîtront ici',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade500,
                        ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _loadData,
            child: ListView.builder(
              itemCount: sentSubmissions.length,
              padding: const EdgeInsets.all(8),
              itemBuilder: (context, index) {
                final submission = sentSubmissions[index];
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
                return _buildSentCard(context, submission, form);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildSentCard(
    BuildContext context,
    FormSubmission submission,
    model.FormModel form,
  ) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.green.shade100,
          child: Icon(
            Icons.check_circle,
            color: Colors.green.shade700,
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
              'Envoyé le ${_formatDate(submission.syncedAt ?? submission.createdAt)}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
            if (submission.syncedAt != null)
              Text(
                'Créé le ${_formatDate(submission.createdAt)}',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade500,
                ),
              ),
          ],
        ),
        trailing: const Icon(Icons.check_circle, color: Colors.green),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}

