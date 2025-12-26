import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/prestataire.dart';
import '../models/campaign.dart';

class EditPrestataireScreen extends StatefulWidget {
  final Prestataire prestataire;

  const EditPrestataireScreen({
    super.key,
    required this.prestataire,
  });

  @override
  State<EditPrestataireScreen> createState() => _EditPrestataireScreenState();
}

class _EditPrestataireScreenState extends State<EditPrestataireScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _apiService = ApiService();
  bool _isLoading = false;
  bool _isLoadingForm = false;
  List<String> _roleOptions = [];
  String? _selectedRole;

  late TextEditingController _nomController;
  late TextEditingController _prenomController;
  late TextEditingController _postnomController;
  late TextEditingController _telephoneController;

  @override
  void initState() {
    super.initState();
    _nomController = TextEditingController(text: widget.prestataire.nom);
    _prenomController = TextEditingController(text: widget.prestataire.prenom);
    _postnomController = TextEditingController(text: widget.prestataire.postnom ?? '');
    _telephoneController = TextEditingController(text: widget.prestataire.telephone ?? '');
    _selectedRole = widget.prestataire.categorie;
    
    // Charger le formId et les options de rôle depuis le formulaire
    _loadFormId().then((_) {
      _loadRoleOptions();
    });
  }

  String? _formId; // Stocker le formId pour l'utiliser lors de la sauvegarde

  /// Récupère le formId depuis la campagne du prestataire ou la campagne active
  Future<void> _loadFormId() async {
    try {
      // D'abord, essayer de récupérer depuis la campagne du prestataire
      if (widget.prestataire.campaignId != null) {
        final campaigns = await _apiService.getCampaigns();
        final campaign = campaigns.firstWhere(
          (c) => c.id == widget.prestataire.campaignId,
          orElse: () => Campaign(
            id: '',
            name: '',
            isActive: false,
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          ),
        );

        if (campaign.enregistrementFormId != null) {
          _formId = campaign.enregistrementFormId;
          return;
        }
      }

      // Si pas trouvé, essayer la campagne active
      final campaigns = await _apiService.getCampaigns();
      Campaign? activeCampaign;
      try {
        activeCampaign = campaigns.firstWhere((c) => c.isActive);
      } catch (e) {
        // Si aucune campagne active, prendre la première disponible
        if (campaigns.isNotEmpty) {
          activeCampaign = campaigns.first;
        }
      }

      if (activeCampaign != null && activeCampaign.enregistrementFormId != null) {
        _formId = activeCampaign.enregistrementFormId;
        return;
      }

      // Si toujours pas trouvé, essayer de récupérer depuis les données du prestataire
      if (widget.prestataire.enregistrementData != null) {
        final data = widget.prestataire.enregistrementData!;
        if (data['form_id'] != null) {
          _formId = data['form_id'].toString();
          return;
        }
        if (data['formId'] != null) {
          _formId = data['formId'].toString();
          return;
        }
      }

      print('ATTENTION: Impossible de récupérer le formId pour le prestataire ${widget.prestataire.id}');
    } catch (e) {
      print('Erreur lors de la récupération du formId: $e');
    }
  }

  Future<void> _loadRoleOptions() async {
    setState(() {
      _isLoadingForm = true;
    });

    try {
      // S'assurer que le formId est chargé
      if (_formId == null) {
        await _loadFormId();
      }

      if (_formId == null) {
        print('ATTENTION: formId non disponible, impossible de charger les options de rôle');
        return;
      }
        
      // Récupérer le formulaire
      final formData = await _apiService.getPublicForm(_formId!);
        final schema = formData['schema'] ?? formData['publishedVersion']?['schema'];
        
        if (schema != null && schema['properties'] != null) {
          // Chercher le champ "role", "categorie", "role_prestataire", "campaign_role_i_f", etc.
          final properties = schema['properties'] as Map<String, dynamic>;
          
          // Chercher dans différents noms possibles
          String? roleFieldName;
          Map<String, dynamic>? roleField;
          
          for (final fieldName in [
            'campaign_role_i_f', // Nom du champ dans le formulaire actuel
            'role', 
            'categorie', 
            'role_prestataire', 
            'rolePrestataire', 
            'categorie_prestataire',
            'campaign_role',
          ]) {
            if (properties.containsKey(fieldName)) {
              roleFieldName = fieldName;
              roleField = properties[fieldName] as Map<String, dynamic>?;
              break;
            }
          }

          if (roleField != null) {
            // Extraire les options
            List<String> options = [];
            
            // Vérifier x-options
            if (roleField!['x-options'] != null && roleField!['x-options'] is List) {
              final xOptions = roleField!['x-options'] as List;
              options = xOptions.map((opt) {
                if (opt is Map && opt['value'] != null) {
                  return opt['value'].toString();
                } else if (opt is Map && opt['label'] != null) {
                  return opt['label'].toString();
                }
                return opt.toString();
              }).toList();
            }
            // Vérifier enum
            else if (roleField!['enum'] != null && roleField!['enum'] is List) {
              options = (roleField!['enum'] as List).map((e) => e.toString()).toList();
            }
            // Vérifier items.enum (pour select_multiple)
            else if (roleField!['items'] != null && 
                     roleField!['items']['enum'] != null && 
                     roleField!['items']['enum'] is List) {
              options = (roleField!['items']['enum'] as List).map((e) => e.toString()).toList();
            }

            if (options.isNotEmpty) {
              setState(() {
                _roleOptions = options;
              });
            }
          }
        }
    } catch (e) {
      // Ignorer les erreurs silencieusement
      print('Erreur lors du chargement des options de rôle: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingForm = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _nomController.dispose();
    _prenomController.dispose();
    _postnomController.dispose();
    _telephoneController.dispose();
    super.dispose();
  }

  Future<void> _saveChanges() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Préparer les données à mettre à jour
      final updateData = {
        'nom': _nomController.text.trim(),
        'prenom': _prenomController.text.trim(),
        'postnom': _postnomController.text.trim().isEmpty ? null : _postnomController.text.trim(),
        'telephone': _telephoneController.text.trim().isEmpty ? null : _telephoneController.text.trim(),
        'categorie': _selectedRole?.isEmpty ?? true ? null : _selectedRole,
      };

      // S'assurer que le formId est chargé avant de sauvegarder
      if (_formId == null) {
        await _loadFormId();
      }

      // Mettre à jour via l'API avec formId
      if (_formId == null) {
        throw Exception('formId requis pour mettre à jour un prestataire. Veuillez vérifier que le prestataire est associé à une campagne avec un formulaire d\'enregistrement.');
      }
      
      await _apiService.updatePrestataire(
        widget.prestataire.id, 
        updateData,
        formId: _formId,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prestataire modifié avec succès'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true); // Retourner true pour indiquer une modification
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de la modification: $e'),
            backgroundColor: Colors.red,
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Modifier le prestataire',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            TextButton(
              onPressed: _saveChanges,
              child: const Text(
                'Enregistrer',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ID du prestataire (non modifiable)
            Card(
              color: const Color(0xFF1E1E1E),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ID du prestataire',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.prestataire.id,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Nom
            TextFormField(
              controller: _nomController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Nom *',
                labelStyle: const TextStyle(color: Colors.white70),
                hintText: 'Entrez le nom',
                hintStyle: TextStyle(color: Colors.white60),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Le nom est obligatoire';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Prénom
            TextFormField(
              controller: _prenomController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Prénom *',
                labelStyle: const TextStyle(color: Colors.white70),
                hintText: 'Entrez le prénom',
                hintStyle: TextStyle(color: Colors.white60),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Le prénom est obligatoire';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Postnom
            TextFormField(
              controller: _postnomController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Postnom',
                labelStyle: const TextStyle(color: Colors.white70),
                hintText: 'Entrez le postnom (optionnel)',
                hintStyle: TextStyle(color: Colors.white60),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
            ),
            const SizedBox(height: 16),

            // Afficher l'ancien numéro de téléphone
            if (widget.prestataire.telephone != null && widget.prestataire.telephone!.isNotEmpty)
              Card(
                color: Theme.of(context).colorScheme.surface.withOpacity(0.5),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, 
                        color: Theme.of(context).colorScheme.primary, 
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ancien numéro de téléphone',
                              style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.prestataire.telephone!,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (widget.prestataire.telephone != null && widget.prestataire.telephone!.isNotEmpty)
              const SizedBox(height: 16),

            // Téléphone
            TextFormField(
              controller: _telephoneController,
              style: const TextStyle(color: Colors.white),
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Numéro de téléphone',
                labelStyle: const TextStyle(color: Colors.white70),
                hintText: 'Entrez le nouveau numéro de téléphone',
                hintStyle: TextStyle(color: Colors.white60),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                prefixIcon: const Icon(Icons.phone, color: Colors.white70),
              ),
            ),
            const SizedBox(height: 16),

            // Afficher l'ancien rôle
            if (widget.prestataire.categorie != null && widget.prestataire.categorie!.isNotEmpty)
              Card(
                color: Theme.of(context).colorScheme.surface.withOpacity(0.5),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, 
                        color: Theme.of(context).colorScheme.primary, 
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ancien rôle',
                              style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.prestataire.categorie!,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (widget.prestataire.categorie != null && widget.prestataire.categorie!.isNotEmpty)
              const SizedBox(height: 16),

            // Rôle (Catégorie) - Selectbox
            if (_isLoadingForm)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_roleOptions.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _selectedRole != null && _roleOptions.contains(_selectedRole)
                    ? _selectedRole
                    : null,
                decoration: InputDecoration(
                  labelText: 'Rôle',
                  labelStyle: const TextStyle(color: Colors.white70),
                  hintText: 'Sélectionnez le rôle (optionnel)',
                  hintStyle: TextStyle(color: Colors.white60),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  prefixIcon: const Icon(Icons.work, color: Colors.white70),
                ),
                dropdownColor: const Color(0xFF2C2C2C),
                style: const TextStyle(color: Colors.white),
                items: [
                  const DropdownMenuItem<String>(
                    value: null,
                    child: Text('Aucun rôle', style: TextStyle(color: Colors.white70)),
                  ),
                  ..._roleOptions.map((role) {
                    return DropdownMenuItem<String>(
                      value: role,
                      child: Text(role, style: const TextStyle(color: Colors.white)),
                    );
                  }),
                ],
                onChanged: (value) {
                  setState(() {
                    _selectedRole = value;
                  });
                },
              )
            else
              TextFormField(
                controller: TextEditingController(text: widget.prestataire.categorie ?? ''),
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Rôle',
                  labelStyle: const TextStyle(color: Colors.white70),
                  hintText: 'Entrez le rôle (optionnel)',
                  hintStyle: TextStyle(color: Colors.white60),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  prefixIcon: const Icon(Icons.work, color: Colors.white70),
                ),
                onChanged: (value) {
                  setState(() {
                    _selectedRole = value.isEmpty ? null : value;
                  });
                },
              ),
            const SizedBox(height: 32),

            // Bouton Enregistrer
            ElevatedButton(
              onPressed: _isLoading ? null : _saveChanges,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text(
                      'Enregistrer les modifications',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

