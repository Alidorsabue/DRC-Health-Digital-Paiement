import 'package:flutter/material.dart';
import '../../models/form.dart' as model;

class FieldSettingsDialog extends StatefulWidget {
  final model.FormFieldModel field;
  final List<model.FormFieldModel> allFields; // Tous les champs pour les dépendances
  final ValueChanged<model.FormFieldModel> onSave;

  const FieldSettingsDialog({
    super.key,
    required this.field,
    required this.allFields,
    required this.onSave,
  });

  @override
  State<FieldSettingsDialog> createState() => _FieldSettingsDialogState();
}

class _FieldSettingsDialogState extends State<FieldSettingsDialog> {
  late bool _required;
  late String? _defaultValue;
  late String? _dependsOn;
  late String? _dependsValue;
  late String? _noteText;
  late String? _group;

  @override
  void initState() {
    super.initState();
    _required = widget.field.required;
    _defaultValue = widget.field.defaultValue?.toString();
    _dependsOn = widget.field.dependsOn;
    _dependsValue = widget.field.dependsValue;
    _noteText = widget.field.noteText;
    _group = widget.field.group;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.settings, color: Colors.blue),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Paramètres: ${widget.field.label}',
              style: const TextStyle(fontSize: 18),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type de champ (lecture seule)
            _buildInfoRow('Type', _getFieldTypeLabel(widget.field.type)),
            
            const Divider(height: 24),
            
            // Réponse obligatoire
            SwitchListTile(
              title: const Text('Réponse obligatoire'),
              subtitle: const Text('Ce champ doit être rempli'),
              value: _required,
              onChanged: (value) {
                setState(() {
                  _required = value;
                });
              },
            ),
            
            const SizedBox(height: 8),
            
            // Groupe
            TextField(
              decoration: const InputDecoration(
                labelText: 'Groupe',
                hintText: 'Ex: Informations personnelles',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.folder_outlined),
              ),
              controller: TextEditingController(text: _group ?? '')
                ..selection = TextSelection.collapsed(offset: _group?.length ?? 0),
              onChanged: (value) {
                _group = value.isEmpty ? null : value;
              },
            ),
            
            const SizedBox(height: 16),
            
            // Note/Description
            TextField(
              decoration: const InputDecoration(
                labelText: 'Note / Description',
                hintText: 'Texte d\'aide pour l\'utilisateur',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.info_outline),
              ),
              maxLines: 3,
              controller: TextEditingController(text: _noteText ?? '')
                ..selection = TextSelection.collapsed(offset: _noteText?.length ?? 0),
              onChanged: (value) {
                _noteText = value.isEmpty ? null : value;
              },
            ),
            
            const SizedBox(height: 16),
            
            // Réponse par défaut (selon le type de champ)
            if (_canHaveDefaultValue(widget.field.type)) ...[
              TextField(
                decoration: InputDecoration(
                  labelText: 'Réponse par défaut',
                  hintText: _getDefaultValueHint(widget.field.type),
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.edit_outlined),
                ),
                controller: TextEditingController(text: _defaultValue ?? '')
                  ..selection = TextSelection.collapsed(offset: _defaultValue?.length ?? 0),
                keyboardType: _getKeyboardType(widget.field.type),
                onChanged: (value) {
                  _defaultValue = value.isEmpty ? null : value;
                },
              ),
              const SizedBox(height: 16),
            ],
            
            // Dépendance (Hiérarchisation)
            ExpansionTile(
              title: const Row(
                children: [
                  Icon(Icons.account_tree, size: 20),
                  SizedBox(width: 8),
                  Text('Dépendance (Hiérarchisation)'),
                ],
              ),
              subtitle: Text(
                _dependsOn != null
                    ? 'Dépend de: ${_getFieldLabel(_dependsOn!)}'
                    : 'Aucune dépendance',
                style: TextStyle(
                  fontSize: 12,
                  color: _dependsOn != null ? Colors.blue : Colors.grey,
                ),
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Ce champ s\'affichera uniquement si:',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      
                      // Sélection du champ de dépendance
                      DropdownButtonFormField<String>(
                        decoration: const InputDecoration(
                          labelText: 'Champ de dépendance',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.link),
                        ),
                        value: _dependsOn,
                        items: [
                          const DropdownMenuItem<String>(
                            value: null,
                            child: Text('Aucune dépendance'),
                          ),
                          ...widget.allFields
                              .where((f) => f.name != widget.field.name)
                              .map((field) => DropdownMenuItem<String>(
                                    value: field.name,
                                    child: Text('${field.label} (${field.name})'),
                                  )),
                        ],
                        onChanged: (value) {
                          setState(() {
                            _dependsOn = value;
                            if (value == null) {
                              _dependsValue = null;
                            } else {
                              // Réinitialiser la valeur de dépendance
                              final dependsField = widget.allFields.firstWhere(
                                (f) => f.name == value,
                              );
                              // Si c'est un champ select, prendre la première option
                              if (dependsField.options != null && dependsField.options!.isNotEmpty) {
                                _dependsValue = dependsField.options!.first.value;
                              } else {
                                _dependsValue = null;
                              }
                            }
                          });
                        },
                      ),
                      
                      const SizedBox(height: 16),
                      
                      // Valeur de dépendance
                      if (_dependsOn != null) ...[
                        _buildDependsValueField(),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            
            // Validation (min/max pour les nombres)
            if (widget.field.type == 'integer' || widget.field.type == 'decimal') ...[
              const SizedBox(height: 16),
              ExpansionTile(
                title: const Row(
                  children: [
                    Icon(Icons.rule, size: 20),
                    SizedBox(width: 8),
                    Text('Validation (Min/Max)'),
                  ],
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        TextField(
                          decoration: InputDecoration(
                            labelText: 'Valeur minimale',
                            hintText: widget.field.validation?['min']?.toString() ?? 'Aucune',
                            border: const OutlineInputBorder(),
                            prefixIcon: const Icon(Icons.arrow_downward),
                          ),
                          keyboardType: TextInputType.number,
                          controller: TextEditingController(
                            text: widget.field.validation?['min']?.toString() ?? '',
                          ),
                          onChanged: (value) {
                            // Note: La validation serait sauvegardée dans le schéma
                            // Pour l'instant, on affiche seulement
                          },
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          decoration: InputDecoration(
                            labelText: 'Valeur maximale',
                            hintText: widget.field.validation?['max']?.toString() ?? 'Aucune',
                            border: const OutlineInputBorder(),
                            prefixIcon: const Icon(Icons.arrow_upward),
                          ),
                          keyboardType: TextInputType.number,
                          controller: TextEditingController(
                            text: widget.field.validation?['max']?.toString() ?? '',
                          ),
                          onChanged: (value) {
                            // Note: La validation serait sauvegardée dans le schéma
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annuler'),
        ),
        ElevatedButton(
          onPressed: () {
            final updatedField = widget.field.copyWith(
              required: _required,
              defaultValue: _defaultValue,
              dependsOn: _dependsOn,
              dependsValue: _dependsValue,
              noteText: _noteText,
              group: _group,
            );
            widget.onSave(updatedField);
            Navigator.pop(context);
          },
          child: const Text('Enregistrer'),
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: Text(value),
          ),
        ],
      ),
    );
  }

  Widget _buildDependsValueField() {
    final dependsField = widget.allFields.firstWhere(
      (f) => f.name == _dependsOn,
      orElse: () => widget.field,
    );

    // Si c'est un champ select, afficher un dropdown
    if (dependsField.options != null && dependsField.options!.isNotEmpty) {
      return DropdownButtonFormField<String>(
        decoration: const InputDecoration(
          labelText: 'Valeur requise',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.check_circle_outline),
        ),
        value: _dependsValue,
        items: dependsField.options!.map((option) {
          return DropdownMenuItem<String>(
            value: option.value,
            child: Text(option.label),
          );
        }).toList(),
        onChanged: (value) {
          setState(() {
            _dependsValue = value;
          });
        },
      );
    } else {
      // Sinon, champ texte libre
      return TextField(
        decoration: const InputDecoration(
          labelText: 'Valeur requise',
          hintText: 'Entrez la valeur exacte',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.check_circle_outline),
        ),
        controller: TextEditingController(text: _dependsValue ?? '')
          ..selection = TextSelection.collapsed(offset: _dependsValue?.length ?? 0),
        onChanged: (value) {
          _dependsValue = value.isEmpty ? null : value;
        },
      );
    }
  }

  String _getFieldTypeLabel(String type) {
    const typeLabels = {
      'text': 'Texte',
      'integer': 'Nombre entier',
      'decimal': 'Nombre décimal',
      'date': 'Date',
      'datetime': 'Date et heure',
      'select_one': 'Choix unique',
      'select_multiple': 'Choix multiple',
      'image': 'Photographie',
      'video': 'Vidéo',
      'barcode': 'Code-barres/QR',
      'draw': 'Signature',
      'geopoint': 'Position GPS',
      'calculate': 'Calcul',
      'note': 'Note',
    };
    return typeLabels[type] ?? type;
  }

  String _getFieldLabel(String fieldName) {
    try {
      return widget.allFields.firstWhere((f) => f.name == fieldName).label;
    } catch (e) {
      return fieldName;
    }
  }

  bool _canHaveDefaultValue(String type) {
    return !['image', 'video', 'barcode', 'draw', 'geopoint', 'note', 'calculate'].contains(type);
  }

  String _getDefaultValueHint(String type) {
    switch (type) {
      case 'integer':
      case 'decimal':
        return 'Ex: 0, 100, etc.';
      case 'date':
        return 'Format: YYYY-MM-DD';
      case 'datetime':
        return 'Format: YYYY-MM-DD HH:MM';
      case 'select_one':
      case 'select_multiple':
        return 'Valeur par défaut';
      default:
        return 'Valeur par défaut';
    }
  }

  TextInputType _getKeyboardType(String type) {
    switch (type) {
      case 'integer':
      case 'decimal':
        return TextInputType.number;
      case 'date':
      case 'datetime':
        return TextInputType.datetime;
      default:
        return TextInputType.text;
    }
  }
}

