import 'package:flutter/material.dart';
import 'package:flutter_form_builder/flutter_form_builder.dart';
import 'package:provider/provider.dart';
import '../models/form.dart' as model;
import '../models/form_submission.dart';
import '../providers/submissions_provider.dart';
import '../providers/sync_provider.dart';
import '../services/sync_service.dart';
import '../widgets/form_fields/form_field_group.dart';
import '../services/database_service.dart';
import '../services/api_service.dart';
import '../utils/error_handler.dart';
import 'submissions_list_screen.dart';

class FormFillScreen extends StatefulWidget {
  final model.FormModel form;
  final FormSubmission? existingSubmission;

  const FormFillScreen({
    super.key,
    required this.form,
    this.existingSubmission,
  });

  @override
  State<FormFillScreen> createState() => _FormFillScreenState();
}

class _FormFillScreenState extends State<FormFillScreen> {
  final _formKey = GlobalKey<FormBuilderState>();
  final PageController _pageController = PageController();
  final Map<String, dynamic> _formValues = {};
  List<model.FormFieldModel> _fields = [];
  List<MapEntry<String, List<model.FormFieldModel>>> _orderedGroups = [];
  int _currentPage = 0;
  
  // Pour les formulaires de validation
  Map<String, String>? _fieldMappings; // Mapping: validationField -> enregistrementField
  String? _prestataireId;
  bool _isLoadingPrestataire = false;
  bool _isSubmitting = false; // Flag pour empêcher les soumissions multiples

  @override
  void initState() {
    super.initState();
    print('DEBUG initState: Formulaire reçu - ID: ${widget.form.id}, Nom: ${widget.form.name}');
    print('DEBUG initState: Type: ${widget.form.type}');
    print('DEBUG initState: publishedVersion: ${widget.form.publishedVersion != null ? "OUI (version ${widget.form.publishedVersion!.version})" : "NON"}');
    print('DEBUG initState: Nombre de versions: ${widget.form.versions.length}');
    
    _parseSchema();
    // Charger les données existantes si une soumission est fournie
    if (widget.existingSubmission != null) {
      _formValues.addAll(widget.existingSubmission!.data);
    }
    // Si le schéma n'est pas trouvé, essayer de recharger depuis l'API
    if (_fields.isEmpty && _orderedGroups.isEmpty) {
      print('DEBUG initState: Aucun champ trouvé, tentative de rechargement depuis l\'API');
      _tryReloadFormFromApi();
    } else {
      print('DEBUG initState: ${_fields.length} champs trouvés dans ${_orderedGroups.length} groupes');
    }
  }

  /// Tente de recharger le formulaire depuis l'API si le schéma n'est pas trouvé localement
  Future<void> _tryReloadFormFromApi() async {
    print('DEBUG _tryReloadFormFromApi: Tentative de rechargement depuis l\'API pour le formulaire ${widget.form.id}');
    try {
      final apiService = ApiService();
      final databaseService = DatabaseService();
      
      // Essayer d'abord avec getForm qui retourne le formulaire complet avec toutes les versions
      final form = await apiService.getForm(widget.form.id);
      print('DEBUG _tryReloadFormFromApi: Formulaire récupéré depuis l\'API - publishedVersion=${form.publishedVersion != null ? "OUI (version ${form.publishedVersion!.version})" : "NON"}');
      
      if (form.publishedVersion != null) {
        // Sauvegarder le formulaire dans la base de données locale avec la version publiée
        await databaseService.saveForm(form, form.publishedVersion!);
        print('DEBUG _tryReloadFormFromApi: Formulaire sauvegardé dans la base de données locale avec isPublished=true');
        
        // Re-parser le schéma avec la version publiée
        _parseSchemaFromData(form.publishedVersion!.schema);
      } else {
        // Essayer avec getPublicForm comme solution de secours
        print('DEBUG _tryReloadFormFromApi: Aucune version publiée trouvée avec getForm, essai avec getPublicForm...');
        final publicFormData = await apiService.getPublicForm(widget.form.id);
        if (publicFormData['schema'] != null || publicFormData['publishedVersion']?['schema'] != null) {
          final schema = publicFormData['schema'] ?? publicFormData['publishedVersion']?['schema'];
          print('DEBUG _tryReloadFormFromApi: Schéma trouvé avec getPublicForm');
          
          // Créer une nouvelle version avec le schéma de l'API
          final newVersion = model.FormVersion(
            id: publicFormData['publishedVersion']?['id'] ?? '',
            formId: widget.form.id,
            version: publicFormData['publishedVersion']?['version'] ?? 1,
            schema: schema as Map<String, dynamic>,
            isPublished: true,
            createdAt: DateTime.parse(publicFormData['publishedVersion']?['createdAt'] ?? DateTime.now().toIso8601String()),
          );
          
          // Sauvegarder dans la base de données locale
          await databaseService.saveForm(form, newVersion);
          print('DEBUG _tryReloadFormFromApi: Formulaire sauvegardé dans la base de données locale');
          
          // Re-parser le schéma
          _parseSchemaFromData(schema as Map<String, dynamic>);
        } else {
          print('DEBUG _tryReloadFormFromApi: ERREUR - Aucun schéma trouvé ni avec getForm ni avec getPublicForm');
        }
      }
    } catch (e) {
      print('DEBUG _tryReloadFormFromApi: Erreur lors du rechargement depuis l\'API: $e');
      print('DEBUG _tryReloadFormFromApi: Stack trace: ${StackTrace.current}');
    }
  }

  /// Parse le schéma à partir de données brutes
  void _parseSchemaFromData(Map<String, dynamic> schema) {
    if (schema['properties'] == null) {
      print('DEBUG _parseSchemaFromData: schema properties is null');
      return;
    }

    // Charger les mappings si présents (pour les formulaires de validation)
    if (schema['x-fieldMappings'] != null) {
      _fieldMappings = Map<String, String>.from(schema['x-fieldMappings']);
    }

    final properties = schema['properties'] as Map<String, dynamic>;
    final requiredFields = List<String>.from(schema['required'] ?? []);

    _fields = [];
    final Map<String, List<model.FormFieldModel>> groupsMap = {};
    final Map<String, int> groupOrder = {};

    // Convertir les propriétés en liste et trier selon l'ordre de conception (x-order)
    final propertiesList = properties.entries.toList();
    propertiesList.sort((a, b) {
      final orderA = a.value['x-order'] ?? 0;
      final orderB = b.value['x-order'] ?? 0;
      return (orderA as num).compareTo(orderB as num);
    });

    // Parcourir les propriétés dans l'ordre de conception
    int fieldIndex = 0;
    for (final entry in propertiesList) {
      final name = entry.key;
      final prop = entry.value;
      
      // Ignorer les champs cachés (métadonnées) et les champs calculate
      if (prop['x-type'] == 'hidden' || prop['x-metadata'] == true) {
        continue;
      }

      final fieldType = prop['x-type'] ?? prop['type'] ?? 'text';
      // Pour les champs calculate, les évaluer et stocker dans formValues mais ne pas les afficher
      if (fieldType == 'calculate' || prop['x-displayOnly'] == true) {
        final formula = prop['x-calculate'] ?? prop['calculate'];
        if (formula != null) {
          try {
            final calculatedValue = _evaluateCalculation(formula.toString());
            _formValues[name] = calculatedValue;
          } catch (e) {
            print('Erreur lors de l\'évaluation initiale de $name: $e');
          }
        }
        continue;
      }
      
      var field = model.FormFieldModel.fromSchema(name, prop, requiredFields);
      if (field.order == 0) {
        field = field.copyWith(order: fieldIndex);
      }
      _fields.add(field);

      final groupName = field.group ?? 'Général';
      if (!groupsMap.containsKey(groupName)) {
        groupsMap[groupName] = [];
        groupOrder[groupName] = field.order;
      }
      groupsMap[groupName]!.add(field);
      fieldIndex++;
    }

    // Trier les champs dans chaque groupe par ordre de conception
    groupsMap.forEach((key, value) {
      value.sort((a, b) => a.order.compareTo(b.order));
    });

    // Créer une liste ordonnée des groupes selon l'ordre du premier champ de chaque groupe
    _orderedGroups = groupsMap.entries.toList()
      ..sort((a, b) => (groupOrder[a.key] ?? 0).compareTo(groupOrder[b.key] ?? 0));
    
    print('DEBUG _parseSchemaFromData: Parsed ${_fields.length} fields in ${_orderedGroups.length} groups');
    
    // Évaluer tous les champs calculate après le chargement initial
    _evaluateAllCalculateFields(schema);
    
    setState(() {});
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Obtient le schéma du formulaire publié et envoyé (celui utilisé pour l'envoi)
  /// Cette méthode détecte automatiquement le formulaire qui enregistre les données
  Map<String, dynamic>? _getPublishedSchema() {
    final formId = widget.form.id;
    print('DEBUG _getPublishedSchema: Recherche du schéma pour le formulaire $formId');
    
    // Priorité 1: Utiliser la version publiée directement
    if (widget.form.publishedVersion != null) {
      print('DEBUG _getPublishedSchema: Version publiée trouvée directement (version ${widget.form.publishedVersion!.version})');
      print('DEBUG _getPublishedSchema: Schéma a ${widget.form.publishedVersion!.schema['properties']?.length ?? 0} propriétés');
      return widget.form.publishedVersion!.schema;
    }
    
    print('DEBUG _getPublishedSchema: Aucune version publiée directe, recherche dans les versions...');
    print('DEBUG _getPublishedSchema: Nombre de versions disponibles: ${widget.form.versions.length}');
    
    // Priorité 2: Chercher dans les versions celle qui est publiée
    if (widget.form.versions.isNotEmpty) {
      try {
        // Chercher d'abord une version publiée
        final publishedVersions = widget.form.versions.where((v) => v.isPublished).toList();
        if (publishedVersions.isNotEmpty) {
          print('DEBUG _getPublishedSchema: Version publiée trouvée dans la liste (version ${publishedVersions.first.version})');
          return publishedVersions.first.schema;
        }
        
        // Si aucune version publiée, utiliser la première version disponible
        print('DEBUG _getPublishedSchema: Aucune version publiée trouvée, utilisation de la première version (version ${widget.form.versions.first.version})');
        print('DEBUG _getPublishedSchema: isPublished = ${widget.form.versions.first.isPublished}');
        return widget.form.versions.first.schema;
      } catch (e) {
        print('DEBUG _getPublishedSchema: Erreur lors de la recherche de version: $e');
        return null;
      }
    }
    
    print('DEBUG _getPublishedSchema: Aucune version disponible, retour null');
    return null;
  }

  // Fonction pour convertir récursivement les DateTime en chaînes
  Map<String, dynamic> _convertDataForStorage(Map<String, dynamic> data) {
    final Map<String, dynamic> converted = {};
    data.forEach((key, value) {
      if (value is DateTime) {
        converted[key] = value.toIso8601String();
      } else if (value is Map) {
        converted[key] = _convertDataForStorage(Map<String, dynamic>.from(value));
      } else if (value is List) {
        converted[key] = value.map((item) {
          if (item is DateTime) {
            return item.toIso8601String();
          } else if (item is Map) {
            return _convertDataForStorage(Map<String, dynamic>.from(item));
          }
          return item;
        }).toList();
      } else {
        converted[key] = value;
      }
    });
    return converted;
  }

  void _parseSchema() {
    print('DEBUG _parseSchema: Début du parsing pour le formulaire ${widget.form.id} (${widget.form.name})');
    print('DEBUG _parseSchema: Type du formulaire: ${widget.form.type}');
    
    final schema = _getPublishedSchema();
    if (schema == null) {
      print('DEBUG _parseSchema: ERREUR - schema is null for form ${widget.form.id}');
      print('DEBUG _parseSchema: publishedVersion is ${widget.form.publishedVersion}');
      print('DEBUG _parseSchema: versions count = ${widget.form.versions.length}');
      if (widget.form.versions.isNotEmpty) {
        print('DEBUG _parseSchema: Détails des versions:');
        for (var i = 0; i < widget.form.versions.length; i++) {
          final v = widget.form.versions[i];
          print('DEBUG _parseSchema:   Version $i: id=${v.id}, version=${v.version}, isPublished=${v.isPublished}, schemaKeys=${v.schema.keys.toList()}');
        }
      }
      return;
    }
    if (schema['properties'] == null) {
      print('DEBUG FormFillScreen: schema properties is null for form ${widget.form.id}');
      return;
    }

    // Charger les mappings si présents (pour les formulaires de validation)
    if (schema['x-fieldMappings'] != null) {
      _fieldMappings = Map<String, String>.from(schema['x-fieldMappings']);
    }

    final properties = schema['properties'] as Map<String, dynamic>;
    final requiredFields = List<String>.from(schema['required'] ?? []);

    _fields = [];
    final Map<String, List<model.FormFieldModel>> groupsMap = {};
    final Map<String, int> groupOrder = {}; // Pour conserver l'ordre d'apparition du premier champ de chaque groupe

    // Convertir les propriétés en liste et trier selon l'ordre de conception (x-order)
    final propertiesList = properties.entries.toList();
    propertiesList.sort((a, b) {
      final orderA = a.value['x-order'] ?? 0;
      final orderB = b.value['x-order'] ?? 0;
      return (orderA as num).compareTo(orderB as num);
    });

    // Parcourir les propriétés dans l'ordre de conception
    int fieldIndex = 0;
    for (final entry in propertiesList) {
      final name = entry.key;
      final prop = entry.value;
      
      // Ignorer les champs cachés (métadonnées) et les champs calculate
      if (prop['x-type'] == 'hidden' || prop['x-metadata'] == true) {
        continue; // Ne pas afficher les champs métadonnées
      }

      final fieldType = prop['x-type'] ?? prop['type'] ?? 'text';
      // Pour les champs calculate, les évaluer et stocker dans formValues mais ne pas les afficher
      if (fieldType == 'calculate' || prop['x-displayOnly'] == true) {
        // Évaluer le champ calculate et stocker sa valeur dans formValues
        final formula = prop['x-calculate'] ?? prop['calculate'];
        if (formula != null) {
          try {
            final calculatedValue = _evaluateCalculation(formula.toString());
            _formValues[name] = calculatedValue;
          } catch (e) {
            print('Erreur lors de l\'évaluation initiale de $name: $e');
          }
        }
        continue; // Ne pas afficher les champs calculate
      }
      
      var field = model.FormFieldModel.fromSchema(name, prop, requiredFields);
      // Si l'ordre n'est pas défini dans le schéma, utiliser l'index d'apparition
      if (field.order == 0) {
        field = field.copyWith(order: fieldIndex);
      }
      _fields.add(field);

      final groupName = field.group ?? 'Général';
      if (!groupsMap.containsKey(groupName)) {
        groupsMap[groupName] = [];
        groupOrder[groupName] = field.order; // Utiliser l'ordre du premier champ du groupe
      }
      groupsMap[groupName]!.add(field);
      fieldIndex++;
    }

    // Trier les champs dans chaque groupe par ordre de conception
    groupsMap.forEach((key, value) {
      value.sort((a, b) => a.order.compareTo(b.order));
    });

    // Créer une liste ordonnée des groupes selon l'ordre du premier champ de chaque groupe
    _orderedGroups = groupsMap.entries.toList()
      ..sort((a, b) => (groupOrder[a.key] ?? 0).compareTo(groupOrder[b.key] ?? 0));
    
    print('DEBUG FormFillScreen: Parsed ${_fields.length} fields in ${_orderedGroups.length} groups');
    print('DEBUG FormFillScreen: Groups: ${_orderedGroups.map((e) => e.key).toList()}');
    if (_fields.isEmpty) {
      print('DEBUG FormFillScreen: WARNING - No fields parsed!');
      print('DEBUG FormFillScreen: Schema properties count: ${properties.length}');
      print('DEBUG FormFillScreen: Schema keys: ${schema.keys.toList()}');
    }
    
    // Évaluer tous les champs calculate après le chargement initial
    _evaluateAllCalculateFields(schema);
    
    setState(() {});
  }
  
  /// Évalue tous les champs calculate et met à jour formValues
  void _evaluateAllCalculateFields(Map<String, dynamic> schema) {
    if (schema['properties'] == null) return;
    
    final properties = schema['properties'] as Map<String, dynamic>;
    properties.forEach((name, prop) {
      final fieldType = prop['x-type'] ?? prop['type'] ?? 'text';
      if (fieldType == 'calculate' || prop['x-displayOnly'] == true) {
        final formula = prop['x-calculate'] ?? prop['calculate'];
        if (formula != null) {
          try {
            final calculatedValue = _evaluateCalculation(formula.toString());
            _formValues[name] = calculatedValue;
          } catch (e) {
            print('Erreur lors de l\'évaluation de $name: $e');
          }
        }
      }
    });
  }

  Future<void> _loadPrestataireData(String prestataireId) async {
    if (_fieldMappings == null || _fieldMappings!.isEmpty) return;
    
    setState(() {
      _isLoadingPrestataire = true;
    });

    try {
      final apiService = ApiService();
      final prestataire = await apiService.getPrestataire(prestataireId);
      
      // Extraire les données d'enregistrement
      final enregistrementData = prestataire['enregistrementData'] as Map<String, dynamic>?;
      if (enregistrementData == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Aucune donnée d\'enregistrement trouvée pour ce prestataire'),
              backgroundColor: Colors.orange,
            ),
          );
        }
        return;
      }

      // Pré-remplir les champs mappés
      final updatedValues = Map<String, dynamic>.from(_formValues);
      _fieldMappings!.forEach((validationField, enregistrementField) {
        if (enregistrementData.containsKey(enregistrementField)) {
          updatedValues[validationField] = enregistrementData[enregistrementField];
        }
      });

      setState(() {
        _formValues.addAll(updatedValues);
        _prestataireId = prestataireId;
      });

      // Mettre à jour le formulaire
      _formKey.currentState?.patchValue(updatedValues);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Données du prestataire chargées avec succès'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors du chargement: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingPrestataire = false;
        });
      }
    }
  }

  /// Détermine si un champ est visible selon ses dépendances
  bool _isFieldVisible(model.FormFieldModel field) {
    if (field.dependsOn == null) return true;
    final dependsValue = _formValues[field.dependsOn];
    return dependsValue?.toString() == field.dependsValue;
  }

  /// Collecte automatiquement les valeurs des champs métadonnées et calculate
  Map<String, dynamic> _collectHiddenFields(Map<String, dynamic> schema) {
    final hiddenData = <String, dynamic>{};
    final now = DateTime.now().toIso8601String();
    
    // Collecter les champs métadonnées et calculate depuis le schéma
    if (schema['properties'] != null) {
      final properties = schema['properties'] as Map<String, dynamic>;
      properties.forEach((name, prop) {
        final fieldType = prop['x-type'] ?? prop['type'] ?? 'text';
        
        // Collecter les champs métadonnées (hidden)
        if (prop['x-type'] == 'hidden' || prop['x-metadata'] == true) {
          // Collecter automatiquement les valeurs des métadonnées
          if (name == 'start' || name == 'end') {
            hiddenData[name] = now;
          } else if (name == 'deviceid') {
            // TODO: Utiliser device_info_plus pour obtenir l'ID du dispositif
            hiddenData[name] = 'device_${DateTime.now().millisecondsSinceEpoch}';
          } else if (name == 'audit') {
            // L'audit sera géré par le backend si nécessaire
            hiddenData[name] = 'audit_enabled';
          }
        }
        
        // Évaluer les champs calculate
        if (fieldType == 'calculate' || prop['x-displayOnly'] == true) {
          final formula = prop['x-calculate'] ?? prop['calculate'];
          if (formula != null) {
            try {
              final calculatedValue = _evaluateCalculation(formula.toString());
              hiddenData[name] = calculatedValue;
            } catch (e) {
              print('Erreur lors du calcul de $name: $e');
              hiddenData[name] = null;
            }
          }
        }
      });
    }
    
    return hiddenData;
  }

  /// Évalue une formule de calcul simple
  dynamic _evaluateCalculation(String formula) {
    if (formula.isEmpty) return null;
    
    // Remplacer les références aux champs par leurs valeurs
    String expression = formula;
    final fieldPattern = RegExp(r'\$\{([^}]+)\}');
    
    // Sauvegarder les valeurs du formulaire actuel
    _formKey.currentState?.save();
    final currentFormData = _formKey.currentState?.value ?? {};
    final allValues = {..._formValues, ...currentFormData};
    
    fieldPattern.allMatches(formula).forEach((match) {
      final fieldName = match.group(1)!;
      final fieldValue = allValues[fieldName];
      if (fieldValue != null) {
        expression = expression.replaceAll(match.group(0)!, fieldValue.toString());
      } else {
        expression = expression.replaceAll(match.group(0)!, '0');
      }
    });
    
    // Évaluer l'expression (simple évaluation arithmétique)
    try {
      // Gérer les conditions if()
      if (expression.contains('if(')) {
        // Format: if(condition, value_if_true, value_if_false)
        final ifPattern = RegExp(r'if\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)');
        final ifMatch = ifPattern.firstMatch(expression);
        if (ifMatch != null) {
          final condition = ifMatch.group(1)!.trim();
          final trueValue = ifMatch.group(2)!.trim().replaceAll("'", '').replaceAll('"', '');
          final falseValue = ifMatch.group(3)!.trim().replaceAll("'", '').replaceAll('"', '');
          
          // Évaluer la condition
          bool conditionResult = false;
          if (condition.contains('!=')) {
            final parts = condition.split('!=');
            final left = parts[0].trim().replaceAll("'", '').replaceAll('"', '');
            final right = parts[1].trim().replaceAll("'", '').replaceAll('"', '');
            conditionResult = left != right;
          } else if (condition.contains('==') || condition.contains('=')) {
            final parts = condition.split(RegExp(r'==|='));
            final left = parts[0].trim().replaceAll("'", '').replaceAll('"', '');
            final right = parts[1].trim().replaceAll("'", '').replaceAll('"', '');
            conditionResult = left == right;
          }
          
          return conditionResult ? trueValue : falseValue;
        }
      }
      
      // Si c'est une chaîne littérale (entre guillemets)
      if (expression.startsWith("'") && expression.endsWith("'") ||
          expression.startsWith('"') && expression.endsWith('"')) {
        return expression.substring(1, expression.length - 1);
      }
      
      // Évaluation arithmétique simple
      return _evaluateArithmetic(expression);
    } catch (e) {
      print('Erreur lors de l\'évaluation: $e');
      return null;
    }
  }

  /// Évalue une expression arithmétique simple
  num _evaluateArithmetic(String expression) {
    // Nettoyer l'expression pour ne garder que les nombres et opérateurs
    expression = expression.replaceAll(RegExp(r'[^\d+\-*/().\s]'), '').trim();
    
    if (expression.isEmpty) return 0;
    
    try {
      // Évaluation simple - pour une solution plus robuste, utiliser un parser d'expressions
      // Ici on fait une évaluation basique
      if (RegExp(r'^\d+(\.\d+)?$').hasMatch(expression)) {
        return num.parse(expression);
      }
      
      // Pour des expressions plus complexes, on retourne 0 pour l'instant
      // TODO: Implémenter un vrai parser d'expressions
      return 0;
    } catch (e) {
      // Si l'évaluation échoue, retourner 0
      return 0;
    }
  }

  Future<void> _saveAsDraft() async {
    // Sauvegarder sans validation comme ébauche
    _formKey.currentState?.save();
    final formData = _formKey.currentState?.value ?? {};
    
    // Fusionner avec les valeurs existantes
    formData.forEach((key, value) {
      _formValues[key] = value;
    });

    // Collecter automatiquement les champs métadonnées et calculate
    final schema = _getPublishedSchema();
    if (schema != null) {
      final hiddenData = _collectHiddenFields(schema);
      _formValues.addAll(hiddenData);
    }

      // Exclure le champ _prestataire_id des données à sauvegarder
      final dataToSave = Map<String, dynamic>.from(_formValues);
      dataToSave.remove('_prestataire_id');
      
      // Convertir les DateTime en chaînes pour la sérialisation
      final convertedData = _convertDataForStorage(dataToSave);

      try {
        final provider = Provider.of<SubmissionsProvider>(context, listen: false);
        final syncProvider = Provider.of<SyncProvider>(context, listen: false);
        final databaseService = DatabaseService();
        
        if (widget.existingSubmission != null) {
          // Mettre à jour la soumission existante comme ébauche
          final updatedSubmission = widget.existingSubmission!.copyWith(
            data: convertedData,
            status: SubmissionStatus.draft,
          );
          await databaseService.updateSubmission(updatedSubmission);
        } else {
          // Créer une nouvelle soumission comme ébauche
          await provider.submitForm(
            widget.form,
            convertedData,
            status: SubmissionStatus.draft,
          );
        }

        // Ne pas synchroniser les ébauches

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Formulaire enregistré comme ébauche'),
              backgroundColor: Colors.blue,
            ),
          );
          Navigator.pop(context);
        }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _finalizeForm() async {
    // Empêcher les soumissions multiples
    if (_isSubmitting) {
      print('DEBUG: Soumission déjà en cours, ignore le clic');
      return;
    }
    
    setState(() {
      _isSubmitting = true;
    });
    
    try {
      // Sauvegarder d'abord les valeurs
      _formKey.currentState?.save();
      final formData = _formKey.currentState?.value ?? {};
      formData.forEach((key, value) {
        _formValues[key] = value;
      });
    
      // S'assurer que toutes les valeurs des FormBuilderField sont bien dans formValues
      _formKey.currentState?.fields.forEach((key, field) {
        if (field.value != null && field.value.toString().trim().isNotEmpty) {
          _formValues[key] = field.value;
        }
      });
    
      // Vérifier les champs obligatoires SEULEMENT pour les champs visibles
      final allVisibleFields = _fields.where((field) => _isFieldVisible(field)).toList();
      final missingRequiredFields = <String>[];
    
      for (final field in allVisibleFields) {
        if (field.required) {
          final value = _formValues[field.name];
          bool isEmpty = false;
        
          // Vérifier si la valeur est vide selon son type
          if (value == null) {
            isEmpty = true;
          } else if (value is String) {
            isEmpty = value.trim().isEmpty;
          } else if (value is List) {
            isEmpty = value.isEmpty;
          } else if (value is Map) {
            isEmpty = value.isEmpty;
          } else if (value is num) {
            // Pour les nombres, considérer comme valide même si 0
            isEmpty = false;
          } else if (value is bool) {
            // Pour les booléens, considérer comme valide
            isEmpty = false;
          }
        
          if (isEmpty) {
            missingRequiredFields.add(field.label);
          }
        }
      }
    
      // Si des champs obligatoires visibles sont manquants, afficher un message
      if (missingRequiredFields.isNotEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Veuillez remplir les champs obligatoires:\n${missingRequiredFields.map((label) => '• $label').join('\n')}',
              ),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 4),
              action: SnackBarAction(
                label: 'OK',
                textColor: Colors.white,
                onPressed: () {},
              ),
            ),
          );
        }
        if (mounted) {
          setState(() {
            _isSubmitting = false;
          });
        }
        return;
      }
    
      // Valider uniquement les champs visibles avec FormBuilder
      // Sauvegarder d'abord toutes les valeurs
      _formKey.currentState?.save();
    
      // Valider manuellement uniquement les champs visibles
      bool hasValidationErrors = false;
      for (final field in allVisibleFields) {
        final formField = _formKey.currentState?.fields[field.name];
        if (formField != null) {
          // Valider le champ
          formField.validate();
          if (formField.hasError) {
            hasValidationErrors = true;
          }
        }
      }
    
      if (hasValidationErrors) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                'Veuillez corriger les erreurs dans le formulaire avant de soumettre',
              ),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 3),
              action: SnackBarAction(
                label: 'OK',
                textColor: Colors.white,
                onPressed: () {},
              ),
            ),
          );
        }
        if (mounted) {
          setState(() {
            _isSubmitting = false;
          });
        }
        return;
      }
    
      // Si tout est valide, continuer avec la soumission
      // Les valeurs sont déjà dans formValues et formData
    
      // S'assurer que toutes les valeurs des FormBuilderField sont bien dans formValues
      // Cela inclut les signatures et autres champs complexes
      _formKey.currentState?.fields.forEach((key, field) {
        if (field.value != null && field.value.toString().trim().isNotEmpty) {
          _formValues[key] = field.value;
        }
      });
    
      // Vérifier aussi que les valeurs dans formValues sont bien dans FormBuilder
      // (pour les champs qui ont été mis à jour directement dans formValues)
      _formValues.forEach((key, value) {
        if (value != null && value.toString().trim().isNotEmpty) {
          final formField = _formKey.currentState?.fields[key];
          if (formField != null && formField.value != value) {
            // Synchroniser la valeur
            formField.didChange(value);
          }
        }
      });

      // Collecter automatiquement les champs métadonnées
      final schema = _getPublishedSchema();
      if (schema != null) {
        final metadata = _collectHiddenFields(schema);
        _formValues.addAll(metadata);
      }

      // Exclure le champ _prestataire_id des données à sauvegarder
      final dataToSave = Map<String, dynamic>.from(_formValues);
      dataToSave.remove('_prestataire_id');
    
      // Convertir les DateTime en chaînes pour la sérialisation
      final convertedData = _convertDataForStorage(dataToSave);
      final provider = Provider.of<SubmissionsProvider>(context, listen: false);
      final syncProvider = Provider.of<SyncProvider>(context, listen: false);
      final databaseService = DatabaseService();
      
      if (widget.existingSubmission != null) {
        // Mettre à jour la soumission existante et la marquer comme prête à envoyer
        final updatedSubmission = widget.existingSubmission!.copyWith(
          data: convertedData,
          status: SubmissionStatus.pending,
        );
        await databaseService.updateSubmission(updatedSubmission);
      } else {
        // Créer une nouvelle soumission prête à envoyer
        await provider.submitForm(
          widget.form,
          convertedData,
          status: SubmissionStatus.pending,
        );
      }

      // Tenter de synchroniser immédiatement les soumissions en attente
      try {
        await syncProvider.syncPendingSubmissions();
        final syncResult = syncProvider.lastSyncResult;
        
        if (mounted) {
          // Vérifier le résultat de la synchronisation avant d'afficher le message de succès
          if (syncResult != null && syncResult.success && syncResult.failedSubmissions == 0) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Formulaire envoyé avec succès${syncResult.syncedSubmissions > 0 ? ' et synchronisé' : ''}'),
                backgroundColor: Colors.green,
              ),
            );
            Navigator.pop(context);
          } else if (syncResult != null && syncResult.failedSubmissions > 0) {
            // Afficher un message d'erreur si la synchronisation a échoué
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Formulaire enregistré localement mais erreur lors de l\'envoi: ${syncResult.message}'),
                backgroundColor: Colors.orange,
                duration: const Duration(seconds: 5),
              ),
            );
            // Ne pas fermer l'écran pour que l'utilisateur puisse réessayer
          } else {
            // Sauvegardé localement, sera synchronisé plus tard
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Formulaire enregistré localement. La synchronisation sera effectuée automatiquement.'),
                backgroundColor: Colors.blue,
              ),
            );
            Navigator.pop(context);
          }
        }
      } catch (syncError) {
        // La synchronisation échoue silencieusement si pas de connexion
        // Les données seront synchronisées plus tard automatiquement
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Formulaire enregistré localement. Erreur de synchronisation: $syncError'),
              backgroundColor: Colors.orange,
              duration: const Duration(seconds: 5),
            ),
          );
          Navigator.pop(context);
        }
      }
    } catch (e) {
      if (mounted) {
        final errorMsg = getErrorMessage(e, 'Une erreur est survenue lors de la soumission');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      // Réinitialiser le flag même en cas d'erreur
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _nextPage() async {
    // Sauvegarder les valeurs actuelles
    _formKey.currentState?.save();
    final formData = _formKey.currentState?.value ?? {};
    formData.forEach((key, value) {
      _formValues[key] = value;
    });
    
    // S'assurer que toutes les valeurs des FormBuilderField sont bien dans formValues
    // Cela inclut les signatures et autres champs complexes
    _formKey.currentState?.fields.forEach((key, field) {
      if (field.value != null) {
        _formValues[key] = field.value;
      }
    });

    // Obtenir les champs du groupe actuel
    if (_currentPage >= _orderedGroups.length) return;
    
    final currentGroup = _orderedGroups[_currentPage];
    final currentFields = currentGroup.value;

    // Filtrer les champs visibles (selon les dépendances)
    final visibleFields = currentFields.where((field) {
      if (field.dependsOn == null) return true;
      final dependsValue = _formValues[field.dependsOn];
      return dependsValue?.toString() == field.dependsValue;
    }).toList();

    // Vérifier les champs obligatoires
    final missingRequiredFields = <String>[];
    for (final field in visibleFields) {
      if (field.required) {
        final value = _formValues[field.name];
        bool isEmpty = false;
        
        // Vérifier si la valeur est vide selon son type
        if (value == null) {
          isEmpty = true;
        } else if (value is String) {
          isEmpty = value.trim().isEmpty;
        } else if (value is List) {
          isEmpty = value.isEmpty;
        } else if (value is Map) {
          isEmpty = value.isEmpty;
        } else if (value is num) {
          // Pour les nombres, considérer comme valide même si 0
          isEmpty = false;
        } else if (value is bool) {
          // Pour les booléens, considérer comme valide
          isEmpty = false;
        }
        
        if (isEmpty) {
          missingRequiredFields.add(field.label);
        }
      }
    }

    // Si des champs obligatoires sont manquants, afficher un message
    if (missingRequiredFields.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Veuillez remplir les champs obligatoires:\n${missingRequiredFields.map((label) => '• $label').join('\n')}',
          ),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 4),
          action: SnackBarAction(
            label: 'OK',
            textColor: Colors.white,
            onPressed: () {},
          ),
        ),
      );
      return;
    }

    // Valider le formulaire avec FormBuilder pour les autres validations (format, etc.)
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Veuillez corriger les erreurs dans le formulaire avant de continuer',
          ),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 3),
          action: SnackBarAction(
            label: 'OK',
            textColor: Colors.white,
            onPressed: () {},
          ),
        ),
      );
      return;
    }

    // Si tout est valide, naviguer vers la page suivante
    if (_currentPage < _orderedGroups.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      // Afficher le dialogue de félicitations
      _showCompletionDialog();
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 32),
            SizedBox(width: 8),
            Expanded(
              child: Text('Félicitations !'),
            ),
          ],
        ),
        content: const Text(
          'Vous êtes à la fin du formulaire.\n\nQue souhaitez-vous faire ?',
          textAlign: TextAlign.center,
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _saveAsDraft();
            },
            child: const Text('Enregistrer comme Ébauche'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _finalizeForm();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
            ),
            child: const Text('Finaliser'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_fields.isEmpty || _orderedGroups.isEmpty) {
      final hasPublishedVersion = widget.form.publishedVersion != null;
      final hasSchema = widget.form.publishedVersion?.schema != null;
      final hasProperties = widget.form.publishedVersion?.schema?['properties'] != null;
      
      return Scaffold(
        appBar: AppBar(title: Text(widget.form.name)),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.grey.shade400,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Formulaire non trouvé ou invalide',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Le formulaire n\'a pas de version publiée ou le schéma est vide.',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade600,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (!hasPublishedVersion) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Version publiée: Non',
                    style: TextStyle(fontSize: 12, color: Colors.red),
                  ),
                ],
                if (hasPublishedVersion && !hasSchema) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Schéma: Non trouvé',
                    style: TextStyle(fontSize: 12, color: Colors.red),
                  ),
                ],
                if (hasSchema && !hasProperties) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Propriétés: Non trouvées',
                    style: TextStyle(fontSize: 12, color: Colors.red),
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Retour'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.form.name),
            if (_orderedGroups.isNotEmpty)
              Text(
                '${_currentPage + 1} / ${_orderedGroups.length}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.list),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => SubmissionsListScreen(form: widget.form),
                ),
              );
            },
            tooltip: 'Voir les soumissions',
          ),
        ],
      ),
      body: FormBuilder(
        key: _formKey,
        initialValue: _formValues,
        child: Column(
          children: [
            // Champ pour saisir l'ID du prestataire (pour les formulaires de validation)
            if (widget.form.type == 'validation' && _fieldMappings != null && _fieldMappings!.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                color: Colors.blue.shade50,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ID du prestataire',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FormBuilderTextField(
                            name: '_prestataire_id',
                            initialValue: _prestataireId,
                            decoration: const InputDecoration(
                              hintText: 'Entrez l\'ID du prestataire (ex: ID-241209-1430-01)',
                              border: OutlineInputBorder(),
                              filled: true,
                              fillColor: Colors.white,
                            ),
                            onChanged: (value) {
                              _prestataireId = value;
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (_isLoadingPrestataire)
                          const Padding(
                            padding: EdgeInsets.all(8.0),
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        else
                          ElevatedButton.icon(
                            onPressed: _prestataireId != null && _prestataireId!.isNotEmpty
                                ? () => _loadPrestataireData(_prestataireId!)
                                : null,
                            icon: const Icon(Icons.search, size: 18),
                            label: const Text('Charger'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Saisissez l\'ID du prestataire pour pré-remplir automatiquement les champs liés.',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            // PageView pour les groupes
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(), // Désactiver le glissement manuel
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                itemCount: _orderedGroups.length,
                itemBuilder: (context, index) {
                  final groupEntry = _orderedGroups[index];
                  return SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (index == 0 && widget.form.description != null) ...[
                          Card(
                            color: Colors.blue.shade50,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Text(
                                widget.form.description!,
                                style: const TextStyle(fontSize: 14),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        FormFieldGroup(
                          key: ValueKey(groupEntry.key),
                          groupName: groupEntry.key,
                          fields: groupEntry.value,
                          formValues: _formValues,
                          initialValues: widget.existingSubmission?.data ?? {},
                          onFieldChanged: (fieldName) {
                            // Réévaluer les champs calculate quand un champ change
                            final schema = _getPublishedSchema();
                            if (schema != null) {
                              _evaluateAllCalculateFields(schema);
                            }
                            setState(() {}); // Rebuild pour mettre à jour les dépendances et les champs note
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            // Boutons de navigation
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 4,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton.icon(
                    onPressed: _currentPage > 0 ? _previousPage : null,
                    icon: const Icon(Icons.arrow_back),
                    label: const Text('Précédent'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      backgroundColor: _currentPage > 0 
                          ? Theme.of(context).colorScheme.secondary 
                          : Colors.grey.shade700,
                      foregroundColor: Colors.white,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: _isSubmitting 
                        ? null 
                        : () => _currentPage < _orderedGroups.length - 1 
                            ? _nextPage() 
                            : _finalizeForm(),
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : Icon(_currentPage < _orderedGroups.length - 1 
                            ? Icons.arrow_forward 
                            : Icons.send),
                    label: Text(_isSubmitting 
                        ? 'Envoi en cours...' 
                        : (_currentPage < _orderedGroups.length - 1 ? 'Suivant' : 'Envoyé')),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      backgroundColor: _isSubmitting 
                          ? Colors.grey 
                          : Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

