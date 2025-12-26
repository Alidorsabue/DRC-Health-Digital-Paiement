import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/network_utils.dart';
import 'forms_list_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _apiUrlController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _showApiUrl = false;

  @override
  void initState() {
    super.initState();
    _loadApiUrl();
  }

  Future<void> _loadApiUrl({bool forceDetection = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final apiService = ApiService(); // Utiliser le singleton
    
    // Utiliser l'URL sauvegardée ou détecter automatiquement
    final savedUrl = prefs.getString('api_url');
    
    if (!forceDetection && savedUrl != null && savedUrl.isNotEmpty) {
      // Vérifier que l'URL sauvegardée fonctionne encore
      _apiUrlController.text = 'Vérification de l\'URL...';
      if (mounted) setState(() {});
      
      final isWorking = await NetworkUtils.testConnection(savedUrl);
      if (isWorking) {
        _apiUrlController.text = savedUrl;
        apiService.setBaseUrl(savedUrl);
        if (mounted) setState(() {});
        return;
      }
    }
    
    // Détecter automatiquement l'IP qui fonctionne
    _apiUrlController.text = 'Détection automatique en cours...';
    if (mounted) setState(() {});
    
    try {
      // Utiliser un timeout plus long pour la détection complète
      final detectedUrl = await NetworkUtils.detectWorkingIP(quickMode: false).timeout(
        const Duration(seconds: 45),
        onTimeout: () {
          print('⚠️ Timeout lors de la détection IP');
          return null;
        },
      );
      
      if (detectedUrl != null) {
        _apiUrlController.text = detectedUrl;
        apiService.setBaseUrl(detectedUrl);
        await prefs.setString('api_url', detectedUrl);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ IP détectée automatiquement: $detectedUrl'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } else {
        final defaultUrl = NetworkUtils.getApiUrl();
        _apiUrlController.text = defaultUrl;
        apiService.setBaseUrl(defaultUrl);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚠️ Aucune IP détectée automatiquement. Veuillez configurer manuellement.'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      final defaultUrl = NetworkUtils.getApiUrl();
      _apiUrlController.text = defaultUrl;
      apiService.setBaseUrl(defaultUrl);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de la détection: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
    
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _apiUrlController.dispose();
    super.dispose();
  }

  Future<void> _saveApiUrl() async {
    if (_apiUrlController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = 'Veuillez entrer une URL valide';
      });
      return;
    }
    
    final url = _apiUrlController.text.trim();
    final apiService = ApiService(); // Utiliser le singleton
    await apiService.saveApiUrl(url);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('URL sauvegardée'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() {
        _showApiUrl = false;
      });
    }
  }

  Widget _buildQuickIPButton(BuildContext context, String ip, {bool isPrimary = false}) {
    return OutlinedButton(
      onPressed: () {
        _apiUrlController.text = 'http://$ip:3001';
        // Optionnel : tester automatiquement après sélection
        // _testCurrentUrl();
      },
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        minimumSize: const Size(0, 36),
        side: BorderSide(
          color: isPrimary ? Colors.green : Colors.grey,
          width: isPrimary ? 2 : 1,
        ),
        backgroundColor: isPrimary ? Colors.green.shade50 : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isPrimary) ...[
            const Icon(Icons.star, size: 16, color: Colors.green),
            const SizedBox(width: 4),
          ],
          Text(
            ip,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isPrimary ? FontWeight.bold : FontWeight.normal,
              color: isPrimary ? Colors.green.shade700 : null,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogin() async {
    // Sauvegarder l'URL si elle a été modifiée
    if (_showApiUrl && _apiUrlController.text.trim().isNotEmpty) {
      await _saveApiUrl();
    }
    
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.login(
        _usernameController.text.trim(),
        _passwordController.text,
      );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const FormsListScreen()),
        );
      }
    } catch (e) {
      String errorMsg = e.toString();
      // Améliorer le message d'erreur
      if (errorMsg.contains('connection') || errorMsg.contains('Failed host lookup')) {
        errorMsg = 'Impossible de se connecter au serveur. Vérifiez:\n'
            '1. Que le serveur est démarré\n'
            '2. L\'URL du serveur est correcte (${_apiUrlController.text})\n'
            '3. Que l\'appareil est sur le même réseau';
      }
      setState(() {
        _errorMessage = errorMsg;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.assignment,
                    size: 80,
                    color: Theme.of(context).primaryColor,
                  ),
                  const SizedBox(height: 32),
                  Text(
                    'DRC Digit Payment',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Collecte de données',
                    style: Theme.of(context).textTheme.bodyLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),
                  if (_showApiUrl) ...[
                    TextFormField(
                      controller: _apiUrlController,
                      decoration: InputDecoration(
                        labelText: 'URL du serveur',
                        hintText: 'http://192.168.56.1:3001',
                        prefixIcon: const Icon(Icons.link),
                        border: const OutlineInputBorder(),
                        helperText: 'Entrez l\'IP de votre ordinateur (ex: http://192.168.56.1:3001)\nOu cliquez sur une IP suggérée ci-dessous',
                        helperMaxLines: 2,
                      ),
                      keyboardType: TextInputType.url,
                    ),
                    const SizedBox(height: 16),
                    // Message d'aide
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.blue.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'Solution rapide',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.blue.shade700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Si la détection automatique ne fonctionne pas:\n\n'
                            '1. Cliquez sur l\'IP ⭐ 192.168.56.1 (ou une autre)\n'
                            '2. Cliquez sur "Sauvegarder l\'URL" (même si le test échoue)\n'
                            '3. Essayez de vous connecter\n\n'
                            '💡 Astuce: Testez d\'abord dans le navigateur du téléphone:\n'
                            '   http://192.168.56.1:3001/api\n'
                            '   Si ça fonctionne, l\'IP est correcte!',
                            style: TextStyle(fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Boutons d'IPs rapides
                    const Text(
                      'IPs suggérées (cliquez pour sélectionner)',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _buildQuickIPButton(context, '192.168.56.1', isPrimary: true),
                        _buildQuickIPButton(context, '192.168.0.21'),
                        _buildQuickIPButton(context, '172.20.10.2'),
                        _buildQuickIPButton(context, '172.20.10.3'),
                        _buildQuickIPButton(context, '172.20.10.4'),
                        _buildQuickIPButton(context, '172.20.10.5'),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Bouton pour forcer une nouvelle détection
                    ElevatedButton.icon(
                      onPressed: _isLoading ? null : () async {
                        setState(() {
                          _isLoading = true;
                        });
                        await _loadApiUrl(forceDetection: true);
                        setState(() {
                          _isLoading = false;
                        });
                      },
                      icon: const Icon(Icons.search),
                      label: const Text('Détecter automatiquement l\'IP'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _isLoading ? null : () async {
                              setState(() {
                                _isLoading = true;
                              });
                              
                              final url = _apiUrlController.text.trim();
                              if (url.isEmpty) {
                                setState(() {
                                  _isLoading = false;
                                });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Veuillez entrer une URL'),
                                      backgroundColor: Colors.orange,
                                    ),
                                  );
                                }
                                return;
                              }

                              // Tester l'URL saisie
                              final isWorking = await NetworkUtils.testConnection(url);
                              setState(() {
                                _isLoading = false;
                              });

                              if (mounted) {
                                if (isWorking) {
                                  final apiService = ApiService();
                                  apiService.setBaseUrl(url);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('✅ Connexion réussie: $url\nCliquez sur "Sauvegarder l\'URL" pour continuer.'),
                                      backgroundColor: Colors.green,
                                      duration: const Duration(seconds: 3),
                                    ),
                                  );
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        '❌ Connexion échouée: $url\n\n'
                                        'Vérifications:\n'
                                        '1. Le serveur backend est démarré?\n'
                                        '2. Testez dans le navigateur: $url/api\n'
                                        '3. Si ça fonctionne dans le navigateur, ignorez ce message et sauvegardez l\'URL.',
                                      ),
                                      backgroundColor: Colors.orange,
                                      duration: const Duration(seconds: 5),
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
                                : const Icon(Icons.check_circle),
                            label: const Text('Tester cette IP'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.orange.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton.icon(
                      onPressed: _isLoading ? null : () async {
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
                          final apiService = ApiService();
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
                                content: Text('Aucune IP fonctionnelle détectée. Essayez une IP suggérée ci-dessus.'),
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
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _saveApiUrl,
                            icon: const Icon(Icons.save),
                            label: const Text('Sauvegarder l\'URL'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green.shade700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              // Sauvegarder sans tester - utile si le test échoue mais que l'IP fonctionne dans le navigateur
                              final url = _apiUrlController.text.trim();
                              if (url.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Veuillez entrer une URL'),
                                    backgroundColor: Colors.orange,
                                  ),
                                );
                                return;
                              }
                              _saveApiUrl();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('URL sauvegardée: $url\nSi ça ne fonctionne pas, testez dans le navigateur d\'abord.'),
                                  backgroundColor: Colors.blue,
                                  duration: const Duration(seconds: 3),
                                ),
                              );
                            },
                            icon: const Icon(Icons.save_outlined),
                            label: const Text('Sauvegarder sans test'),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: Colors.green.shade700),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _showApiUrl = !_showApiUrl;
                      });
                    },
                    icon: Icon(_showApiUrl ? Icons.arrow_upward : Icons.settings),
                    label: Text(_showApiUrl ? 'Masquer la configuration' : 'Configurer l\'URL du serveur'),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Nom d\'utilisateur',
                      prefixIcon: Icon(Icons.person),
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Veuillez entrer votre nom d\'utilisateur';
                      }
                      return null;
                    },
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    decoration: const InputDecoration(
                      labelText: 'Mot de passe',
                      prefixIcon: Icon(Icons.lock),
                      border: OutlineInputBorder(),
                    ),
                    obscureText: true,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Veuillez entrer votre mot de passe';
                      }
                      return null;
                    },
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _handleLogin(),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red.shade700),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: TextStyle(color: Colors.red.shade700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Se connecter'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

