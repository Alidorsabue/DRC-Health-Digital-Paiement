import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    // Charger les données utilisateur au démarrage de l'écran
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (authProvider.user == null) {
        authProvider.loadUser();
      }
    });
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


  String _getInitials(String? fullName, String? username) {
    // Utiliser fullName si disponible
    if (fullName != null && fullName.isNotEmpty) {
      final parts = fullName.trim().split(' ').where((p) => p.isNotEmpty).toList();
      if (parts.length >= 2) {
        // Prendre la première lettre du prénom (premier mot) et la première lettre du nom (deuxième mot)
        // Exemple: "Héritier WATA" -> "HW"
        return '${parts[0][0].toUpperCase()}${parts[1][0].toUpperCase()}';
      } else if (parts.length == 1) {
        return parts[0][0].toUpperCase();
      }
    }
    
    // Utiliser username comme fallback si fullName n'est pas disponible
    if (username != null && username.isNotEmpty) {
      return username[0].toUpperCase();
    }
    
    // Fallback par défaut
    return 'IT';
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

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Section profil utilisateur
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      // Avatar amélioré
                      CircleAvatar(
                        radius: 50,
                        backgroundColor: Colors.blue.shade700,
                        child: Text(
                          _getInitials(user?.fullName, user?.username),
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Nom complet (Prénom + Nom) ou nom d'utilisateur
                      if (user != null) ...[
                        Text(
                          (user!.fullName != null && user!.fullName!.isNotEmpty)
                              ? user!.fullName!
                              : user!.username,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                      // Zone de santé (pour IT)
                      if (user?.role == 'IT' && user?.zoneId != null && user!.zoneId!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          user!.zoneId!,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.grey.shade700,
                              ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                      // Aire de santé (pour IT)
                      if (user?.role == 'IT' && user?.aireId != null && user!.aireId!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          user!.aireId!,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.grey.shade700,
                              ),
                          textAlign: TextAlign.center,
                        ),
                      ],
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

