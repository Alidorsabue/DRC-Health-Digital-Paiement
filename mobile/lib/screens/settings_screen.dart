import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../utils/network_utils.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _apiUrlController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final apiService = ApiService(); // Utiliser le singleton
    final savedUrl = prefs.getString('api_url');
    
    if (savedUrl != null && savedUrl.isNotEmpty) {
      // Vérifier que l'URL sauvegardée fonctionne encore
      final isWorking = await NetworkUtils.testConnection(savedUrl);
      if (isWorking) {
        _apiUrlController.text = savedUrl;
      } else {
        // L'URL sauvegardée ne fonctionne plus, détecter automatiquement
        setState(() {
          _isLoading = true;
          _apiUrlController.text = 'Détection en cours...';
        });
        
        final detectedUrl = await NetworkUtils.detectWorkingIP();
        if (detectedUrl != null) {
          setState(() {
            _apiUrlController.text = detectedUrl;
            _isLoading = false;
          });
          await prefs.setString('api_url', detectedUrl);
          apiService.setBaseUrl(detectedUrl);
        } else {
          setState(() {
            _apiUrlController.text = NetworkUtils.getApiUrl();
            _isLoading = false;
          });
        }
      }
    } else {
      // Détecter automatiquement l'IP qui fonctionne
      setState(() {
        _isLoading = true;
        _apiUrlController.text = 'Détection en cours...';
      });
      
      final detectedUrl = await NetworkUtils.detectWorkingIP();
      if (detectedUrl != null) {
        setState(() {
          _apiUrlController.text = detectedUrl;
          _isLoading = false;
        });
        await prefs.setString('api_url', detectedUrl);
        apiService.setBaseUrl(detectedUrl);
      } else {
        setState(() {
          _apiUrlController.text = NetworkUtils.getApiUrl();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _saveApiUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_url', _apiUrlController.text.trim());
    
    final apiService = ApiService(); // Utiliser le singleton
    apiService.setBaseUrl(_apiUrlController.text.trim());

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('URL de l\'API sauvegardée'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Êtes-vous sûr de vouloir vous déconnecter ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.logout();

      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  void dispose() {
    _apiUrlController.dispose();
    super.dispose();
  }

  String _getInitials(String? fullName) {
    if (fullName == null || fullName.isEmpty) return '??';
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0].toUpperCase()}${parts[1][0].toUpperCase()}';
    } else if (parts.length == 1) {
      return parts[0][0].toUpperCase();
    }
    return '??';
  }

  String _getPrenom(String? fullName) {
    if (fullName == null || fullName.isEmpty) return '';
    final parts = fullName.trim().split(' ');
    return parts.isNotEmpty ? parts[0] : '';
  }

  String _getNom(String? fullName) {
    if (fullName == null || fullName.isEmpty) return '';
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return parts.sublist(1).join(' ');
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Paramètres'),
      ),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          final user = authProvider.user;
          final fullName = user?.fullName ?? '';
          final prenom = _getPrenom(fullName);
          final nom = _getNom(fullName);
          final aireId = user?.aireId;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Section profil utilisateur
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundColor: Colors.blue.shade700,
                        child: Text(
                          _getInitials(fullName),
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (prenom.isNotEmpty || nom.isNotEmpty) ...[
                        Text(
                          '$prenom $nom'.trim(),
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                      ],
                      if (aireId != null && aireId.isNotEmpty) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.location_on,
                              size: 16,
                              color: Colors.grey.shade600,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              aireId,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Colors.grey.shade600,
                                  ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Configuration API',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _apiUrlController,
                    decoration: const InputDecoration(
                      labelText: 'URL de l\'API',
                      hintText: 'http://192.168.1.100:3001',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.link),
                      helperText: 'URL détectée automatiquement. Modifiez si nécessaire.',
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () async {
                      setState(() {
                        _isLoading = true;
                        _apiUrlController.text = 'Détection en cours...';
                      });
                      
                      final detectedUrl = await NetworkUtils.detectWorkingIP();
                      if (detectedUrl != null) {
                        setState(() {
                          _apiUrlController.text = detectedUrl;
                          _isLoading = false;
                        });
                        final apiService = ApiService(); // Utiliser le singleton
                        apiService.setBaseUrl(detectedUrl);
                        
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('IP détectée: $detectedUrl'),
                              backgroundColor: Colors.green,
                            ),
                          );
                        }
                      } else {
                        setState(() {
                          _apiUrlController.text = NetworkUtils.getApiUrl();
                          _isLoading = false;
                        });
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Aucune IP fonctionnelle détectée. Vérifiez que le serveur est démarré.'),
                              backgroundColor: Colors.orange,
                            ),
                          );
                        }
                      }
                    },
                    icon: _isLoading 
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                    label: const Text('Détecter automatiquement'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue.shade700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _saveApiUrl,
                    icon: const Icon(Icons.save),
                    label: const Text('Sauvegarder'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Section Migration
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Migration des IDs',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Migrer les IDs de soumission vers le nouveau format (ID-YYMM-HHmm-XXX)',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Migration des IDs'),
                          content: const Text(
                            'Cette action va migrer tous les IDs de soumission vers le nouveau format.\n\n'
                            'Voulez-vous continuer ?',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Annuler'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Migrer'),
                            ),
                          ],
                        ),
                      );

                      if (confirmed == true) {
                        setState(() {
                          _isLoading = true;
                        });

                        try {
                          final prefs = await SharedPreferences.getInstance();
                          // Réinitialiser le flag de migration pour forcer la réexécution
                          await prefs.remove('submission_ids_migrated');
                          
                          final databaseService = DatabaseService();
                          final migratedCount = await databaseService.migrateSubmissionIds();
                          await prefs.setBool('submission_ids_migrated', true);

                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Migration terminée: $migratedCount soumissions migrées'),
                                backgroundColor: Colors.green,
                                duration: const Duration(seconds: 3),
                              ),
                            );
                          }
                        } catch (e) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Erreur lors de la migration: $e'),
                                backgroundColor: Colors.red,
                                duration: const Duration(seconds: 5),
                              ),
                            );
                          }
                        } finally {
                          if (mounted) {
                            setState(() {
                              _isLoading = false;
                            });
                          }
                        }
                      }
                    },
                    icon: _isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.upgrade),
                    label: const Text('Migrer les IDs de soumission'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange.shade700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('À propos'),
              subtitle: const Text('DRC Digit Payment v1.0.0'),
              onTap: () {
                showAboutDialog(
                  context: context,
                  applicationName: 'DRC Digit Payment',
                  applicationVersion: '1.0.0',
                  applicationLegalese: 'Application mobile pour la collecte de données',
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text(
                'Déconnexion',
                style: TextStyle(color: Colors.red),
              ),
              onTap: _handleLogout,
            ),
          ),
            ],
          );
        },
      ),
    );
  }
}

