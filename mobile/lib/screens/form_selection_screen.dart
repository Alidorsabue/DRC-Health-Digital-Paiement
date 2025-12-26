import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/form.dart' as model;
import '../providers/forms_provider.dart';
import 'form_fill_screen.dart';

class FormSelectionScreen extends StatefulWidget {
  const FormSelectionScreen({super.key});

  @override
  State<FormSelectionScreen> createState() => _FormSelectionScreenState();
}

class _FormSelectionScreenState extends State<FormSelectionScreen> {
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    // Charger les formulaires au démarrage
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadForms();
      // Synchroniser automatiquement en arrière-plan
      _performAutoSync();
    });
  }

  Future<void> _performAutoSync() async {
    try {
      final formsProvider = Provider.of<FormsProvider>(context, listen: false);
      // Synchroniser silencieusement en arrière-plan
      await formsProvider.refreshForms();
    } catch (e) {
      // Ignorer les erreurs silencieusement pour la synchronisation automatique
    }
  }

  Future<void> _loadForms() async {
    final formsProvider = Provider.of<FormsProvider>(context, listen: false);
    await formsProvider.loadForms();
  }

  Future<void> _handleRefresh() async {
    setState(() {
      _isRefreshing = true;
    });

    try {
      final formsProvider = Provider.of<FormsProvider>(context, listen: false);
      final success = await formsProvider.refreshForms();
      
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Formulaires synchronisés avec succès'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(formsProvider.errorMessage ?? 'Erreur lors de la synchronisation'),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Text('Sélectionner un formulaire'),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: _isRefreshing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.sync),
              onPressed: _isRefreshing ? null : _handleRefresh,
              tooltip: 'Synchroniser les formulaires',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Consumer<FormsProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.forms.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          // Filtrer uniquement les formulaires publiés
          final publishedForms = provider.forms
              .where((form) => form.publishedVersion != null)
              .toList();

          if (publishedForms.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.assignment_outlined,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Aucun formulaire disponible',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Synchronisez pour télécharger les formulaires',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade500,
                        ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _isRefreshing ? null : _handleRefresh,
                    icon: _isRefreshing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.sync),
                    label: const Text('Synchroniser'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: publishedForms.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final form = publishedForms[index];
              return _buildFormCard(context, form);
            },
          );
        },
      ),
    );
  }

  Widget _buildFormCard(BuildContext context, model.FormModel form) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).primaryColor,
          child: const Icon(
            Icons.description,
            color: Colors.white,
          ),
        ),
        title: Text(
          form.name,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (form.description != null) ...[
              const SizedBox(height: 4),
              Text(
                form.description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.category, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 4),
                Text(
                  form.type,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ],
        ),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => FormFillScreen(form: form),
            ),
          );
        },
      ),
    );
  }
}

