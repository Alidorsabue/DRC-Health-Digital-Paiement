import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/sync_provider.dart';
import '../providers/forms_provider.dart';
import '../providers/submissions_provider.dart';

class SyncScreen extends StatefulWidget {
  const SyncScreen({super.key});

  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Synchronisation'),
      ),
      body: Consumer<SyncProvider>(
        builder: (context, syncProvider, child) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            syncProvider.isConnected
                                ? Icons.cloud_done
                                : Icons.cloud_off,
                            color: syncProvider.isConnected
                                ? Colors.green
                                : Colors.red,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            syncProvider.isConnected
                                ? 'Connecté'
                                : 'Hors ligne',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        syncProvider.isConnected
                            ? 'Vous êtes connecté à internet. Vous pouvez synchroniser vos données.'
                            : 'Vous êtes hors ligne. Les données seront synchronisées automatiquement lorsque vous serez connecté.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (syncProvider.lastSyncResult != null) ...[
                Card(
                  color: syncProvider.lastSyncResult!.success
                      ? Colors.green.shade50
                      : Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              syncProvider.lastSyncResult!.success
                                  ? Icons.check_circle
                                  : Icons.error,
                              color: syncProvider.lastSyncResult!.success
                                  ? Colors.green
                                  : Colors.red,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              syncProvider.lastSyncResult!.success
                                  ? 'Synchronisation réussie'
                                  : 'Erreur de synchronisation',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(syncProvider.lastSyncResult!.message),
                        const SizedBox(height: 8),
                        if (syncProvider.lastSyncResult!.success) ...[
                          Text(
                            'Formulaires téléchargés: ${syncProvider.lastSyncResult!.downloadedForms}',
                          ),
                          Text(
                            'Campagnes téléchargées: ${syncProvider.lastSyncResult!.downloadedCampaigns}',
                          ),
                          Text(
                            'Soumissions synchronisées: ${syncProvider.lastSyncResult!.syncedSubmissions}',
                          ),
                          if (syncProvider.lastSyncResult!.failedSubmissions > 0)
                            Text(
                              'Échecs: ${syncProvider.lastSyncResult!.failedSubmissions}',
                              style: const TextStyle(color: Colors.red),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              ElevatedButton.icon(
                onPressed: syncProvider.isSyncing
                    ? null
                    : () async {
                        final formsProvider =
                            Provider.of<FormsProvider>(context, listen: false);
                        await syncProvider.syncAll();
                        await formsProvider.loadForms();
                      },
                icon: syncProvider.isSyncing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.sync),
                label: Text(syncProvider.isSyncing
                    ? 'Synchronisation...'
                    : 'Synchroniser maintenant'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
              const SizedBox(height: 16),
              Consumer<SubmissionsProvider>(
                builder: (context, submissionsProvider, child) {
                  return FutureBuilder<int>(
                    future: submissionsProvider.getPendingCount(),
                    builder: (context, snapshot) {
                      final count = snapshot.data ?? 0;
                      if (count == 0) return const SizedBox.shrink();

                      return Card(
                        color: Colors.orange.shade50,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Icon(Icons.pending_actions,
                                  color: Colors.orange.shade700),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '$count soumission(s) en attente de synchronisation',
                                  style: TextStyle(
                                    color: Colors.orange.shade700,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

