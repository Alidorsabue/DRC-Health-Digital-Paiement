import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_form_builder/flutter_form_builder.dart';
import 'package:form_builder_validators/form_builder_validators.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:convert';
import 'dart:math' as math;
import '../../models/form.dart' as model;

class DynamicFormField extends StatelessWidget {
  final model.FormFieldModel field;
  final Map<String, dynamic> formValues;
  final ValueChanged<dynamic> onChanged;
  final bool isVisible;
  final List<model.FormFieldModel>? allFields; // Tous les champs pour accéder aux options complètes

  const DynamicFormField({
    super.key,
    required this.field,
    required this.formValues,
    required this.onChanged,
    this.isVisible = true,
    this.allFields,
  });

  @override
  Widget build(BuildContext context) {
    if (!isVisible) return const SizedBox.shrink();

    Widget fieldWidget;
    switch (field.type) {
      case 'text':
        fieldWidget = _buildTextField(context);
        break;
      case 'integer':
        fieldWidget = _buildIntegerField(context);
        break;
      case 'decimal':
        fieldWidget = _buildDecimalField(context);
        break;
      case 'date':
        fieldWidget = _buildDateField(context);
        break;
      case 'datetime':
        fieldWidget = _buildDateTimeField(context);
        break;
      case 'select_one':
        fieldWidget = _buildSelectOneField(context);
        break;
      case 'select_multiple':
        fieldWidget = _buildSelectMultipleField(context);
        break;
      case 'image':
        fieldWidget = _buildImageField(context);
        break;
      case 'video':
        fieldWidget = _buildVideoField(context);
        break;
      case 'barcode':
        fieldWidget = _buildBarcodeField(context);
        break;
      case 'draw':
        fieldWidget = _buildSignatureField(context);
        break;
      case 'geopoint':
        fieldWidget = _buildGeopointField(context);
        break;
      case 'calculate':
        // Les champs calculate ne doivent pas s'afficher comme des questions
        // Ils sont gérés automatiquement en arrière-plan
        return const SizedBox.shrink(); // Ne rien afficher
      case 'hidden':
        // Les champs cachés ne doivent pas s'afficher
        return const SizedBox.shrink(); // Ne rien afficher
      case 'note':
        fieldWidget = _buildNoteField(context);
        break;
      default:
        fieldWidget = _buildTextField(context);
    }

    // Envelopper le champ avec un bouton paramètres
    return _wrapWithSettingsButton(context, fieldWidget);
  }

  Widget _wrapWithSettingsButton(BuildContext context, Widget fieldWidget) {
    return fieldWidget;
  }

  /// Vérifie si le champ est visible selon ses dépendances
  bool _isFieldVisible() {
    if (field.dependsOn == null) return true;
    final dependsValue = formValues[field.dependsOn];
    return dependsValue?.toString() == field.dependsValue;
  }

  Widget? _buildSettingsSuffixIcon(BuildContext context, {Widget? existingIcon}) {
    // Retourner seulement l'icône existante (calendrier, etc.) ou l'icône required
    if (existingIcon != null) {
      return existingIcon;
    }
    
    if (field.required) {
      return const Icon(Icons.star, color: Colors.red, size: 16);
    }
    
    return null;
  }

  Widget _buildTextField(BuildContext context) {
    // Utiliser defaultValue si disponible, sinon utiliser formValues
    final initialValue = formValues[field.name]?.toString() ?? 
        (field.defaultValue != null ? field.defaultValue.toString() : null);
    
    // Déterminer le type de clavier et les propriétés selon l'apparence
    final appearance = field.appearance?.toLowerCase() ?? '';
    final isNumber = appearance == 'number' || appearance == 'numbers';
    final isMultiline = appearance == 'multiline';
    
    return FormBuilderTextField(
      name: field.name,
      initialValue: initialValue,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      maxLines: isMultiline ? null : 1,
      minLines: isMultiline ? 3 : null,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
        suffixIcon: _buildSettingsSuffixIcon(context),
      ),
      validator: FormBuilderValidators.compose([
        if (field.required)
          FormBuilderValidators.required(errorText: 'Ce champ est obligatoire'),
        if (isNumber)
          FormBuilderValidators.numeric(errorText: 'Ce champ ne doit contenir que des chiffres'),
        if (field.validation?['minLength'] != null)
          FormBuilderValidators.minLength(
            field.validation!['minLength'],
            errorText: 'Ce champ doit contenir au moins ${field.validation!['minLength']} caractère${field.validation!['minLength']! > 1 ? 's' : ''}',
          ),
        if (field.validation?['maxLength'] != null)
          FormBuilderValidators.maxLength(
            field.validation!['maxLength'],
            errorText: 'Ce champ ne doit pas dépasser ${field.validation!['maxLength']} caractère${field.validation!['maxLength']! > 1 ? 's' : ''}',
          ),
      ]),
      onChanged: (value) {
        // Si c'est un champ nombre, s'assurer que la valeur ne contient que des chiffres
        if (isNumber && value != null && value.isNotEmpty) {
          final numericValue = value.replaceAll(RegExp(r'[^0-9]'), '');
          if (numericValue != value) {
            // La valeur contient des caractères non numériques, on la nettoie
            onChanged(numericValue);
            return;
          }
        }
        onChanged(value);
      },
    );
  }

  Widget _buildIntegerField(BuildContext context) {
    final initialValue = formValues[field.name]?.toString() ?? 
        (field.defaultValue != null ? field.defaultValue.toString() : null);
    
    return FormBuilderTextField(
      name: field.name,
      initialValue: initialValue,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
        suffixIcon: _buildSettingsSuffixIcon(context),
      ),
      keyboardType: TextInputType.number,
      validator: FormBuilderValidators.compose([
        if (field.required)
          FormBuilderValidators.required(errorText: 'Ce champ est obligatoire'),
        FormBuilderValidators.integer(errorText: 'Veuillez entrer un nombre entier'),
        if (field.validation?['min'] != null)
          FormBuilderValidators.min(
            field.validation!['min'],
            errorText: 'La valeur minimale est ${field.validation!['min']}',
          ),
        if (field.validation?['max'] != null)
          FormBuilderValidators.max(
            field.validation!['max'],
            errorText: 'La valeur maximale est ${field.validation!['max']}',
          ),
      ]),
      onChanged: (value) => onChanged(value != null && value.isNotEmpty ? int.tryParse(value) : null),
    );
  }

  Widget _buildDecimalField(BuildContext context) {
    final initialValue = formValues[field.name]?.toString() ?? 
        (field.defaultValue != null ? field.defaultValue.toString() : null);
    
    return FormBuilderTextField(
      name: field.name,
      initialValue: initialValue,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
        suffixIcon: _buildSettingsSuffixIcon(context),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      validator: FormBuilderValidators.compose([
        if (field.required)
          FormBuilderValidators.required(errorText: 'Ce champ est obligatoire'),
        FormBuilderValidators.numeric(errorText: 'Veuillez entrer un nombre'),
        if (field.validation?['min'] != null)
          FormBuilderValidators.min(
            field.validation!['min'],
            errorText: 'La valeur minimale est ${field.validation!['min']}',
          ),
        if (field.validation?['max'] != null)
          FormBuilderValidators.max(
            field.validation!['max'],
            errorText: 'La valeur maximale est ${field.validation!['max']}',
          ),
      ]),
      onChanged: (value) => onChanged(value != null && value.isNotEmpty ? double.tryParse(value) : null),
    );
  }

  Widget _buildDateField(BuildContext context) {
    DateTime? initialDate;
    if (formValues[field.name] != null) {
      initialDate = DateTime.tryParse(formValues[field.name].toString());
    } else if (field.defaultValue != null) {
      initialDate = DateTime.tryParse(field.defaultValue.toString());
    }
    
    return FormBuilderDateTimePicker(
      name: field.name,
      initialValue: initialDate,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
        suffixIcon: _buildSettingsSuffixIcon(context, existingIcon: const Icon(Icons.calendar_today)),
      ),
      inputType: InputType.date,
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      onChanged: (value) => onChanged(value?.toIso8601String()),
    );
  }

  Widget _buildDateTimeField(BuildContext context) {
    return FormBuilderDateTimePicker(
      name: field.name,
      initialValue: formValues[field.name] != null
          ? DateTime.tryParse(formValues[field.name].toString())
          : null,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
        suffixIcon: _buildSettingsSuffixIcon(context, existingIcon: const Icon(Icons.access_time)),
      ),
      inputType: InputType.both,
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      onChanged: (value) => onChanged(value?.toIso8601String()),
    );
  }

  /// Filtre les options selon le choice_filter
  List<model.FormFieldOption> _getFilteredOptions(BuildContext? context) {
    if (field.options == null || field.options!.isEmpty) {
      return [];
    }

    // Si pas de filtre (ni choiceFilter ni filterField), retourner toutes les options
    if (field.choiceFilter == null && field.filterField == null) {
      return field.options!;
    }

    // Si filterField est défini, utiliser la logique de filtrage basée sur filterField
    if (field.filterField != null) {
      // Obtenir la valeur du champ de référence
      // IMPORTANT: formValues contient la valeur (value) de l'option sélectionnée, pas le label
      // Essayer d'abord formValues, puis essayer FormBuilder si disponible
      final filterFieldName = field.filterField!;
      dynamic rawFilterValue = formValues[filterFieldName];
      
      // Si la valeur n'est pas dans formValues, essayer de l'obtenir depuis FormBuilder
      if (rawFilterValue == null && context != null) {
        try {
          final formBuilderState = FormBuilder.of(context);
          if (formBuilderState != null) {
            final formBuilderValue = formBuilderState.fields[filterFieldName]?.value;
            if (formBuilderValue != null) {
              rawFilterValue = formBuilderValue;
              // Mettre à jour formValues pour la prochaine fois
              formValues[filterFieldName] = formBuilderValue;
              print('DEBUG: Récupéré valeur depuis FormBuilder: $filterFieldName = $formBuilderValue');
            }
          }
        } catch (e) {
          // Ignorer les erreurs
        }
      }
      
      // Debug détaillé
      print('DEBUG _getFilteredOptions: field=${field.name}, filterField=$filterFieldName');
      print('  - formValues identity: ${formValues.hashCode}');
      print('  - formValues.containsKey($filterFieldName): ${formValues.containsKey(filterFieldName)}');
      print('  - formValues[$filterFieldName]: ${formValues[filterFieldName]}');
      print('  - formValues[$filterFieldName] type: ${formValues[filterFieldName]?.runtimeType}');
      print('  - formValues keys: ${formValues.keys.toList()}');
      print('  - formValues entries: ${formValues.entries.map((e) => '${e.key}=${e.value}').toList()}');
      
      final filterFieldValue = rawFilterValue?.toString().toLowerCase().trim();
      
      // Si le champ de référence n'a pas de valeur, ne rien afficher
      if (filterFieldValue == null || filterFieldValue.isEmpty) {
        print('DEBUG: filterFieldValue est vide, retourne []');
        return [];
      }

      // Vérifier si au moins une option a un filtre
      final hasAnyFilter = field.options!.any((opt) => opt.filter != null && opt.filter!.isNotEmpty);
      
      // Filtrer les options selon leur propriété filter
      return field.options!.where((option) {
        // Si l'option n'a pas de propriété filter
        if (option.filter == null || option.filter!.isEmpty) {
          // Si certaines options ont un filter, celles sans filter sont exclues
          if (hasAnyFilter) {
            return false;
          }
          // Sinon, toutes les options sont valides
          return true;
        }

        // Parser le filter de l'option
        // Format 1 (simple): juste la valeur (ex: "CD53")
        // Format 2 (complet): ${field} = 'value' ou ${field} != 'value'
        final filterExpression = option.filter!.trim();
        String? expectedValue;
        String? operator;
        
        // Vérifier si c'est le format simple (pas de ${})
        if (!filterExpression.contains('\${')) {
          // Format simple: juste la valeur
          // Enlever les guillemets s'il y en a (au début ou à la fin)
          String cleanedValue = filterExpression;
          if (cleanedValue.startsWith('"') || cleanedValue.startsWith("'")) {
            cleanedValue = cleanedValue.substring(1);
          }
          if (cleanedValue.endsWith('"') || cleanedValue.endsWith("'")) {
            cleanedValue = cleanedValue.substring(0, cleanedValue.length - 1);
          }
          expectedValue = cleanedValue.toLowerCase().trim();
          operator = '=';
        } else {
          // Format complet: ${field} = 'value'
          // Extraire le champ de référence
          final fieldMatch = RegExp(r'\$\{([^}]+)\}').firstMatch(filterExpression);
          if (fieldMatch == null) {
            // Si pas de référence de champ dans le filter, ne pas afficher
            return false;
          }

          final referencedField = fieldMatch.group(1)?.trim();
          // Vérifier que la référence correspond au filterField du champ
          if (referencedField != field.filterField) {
            // Si la référence ne correspond pas, ne pas afficher cette option
            return false;
          }

          // Extraire l'opérateur et la valeur
          // Chercher l'opérateur (chercher après la référence de champ)
          final afterField = filterExpression.substring(fieldMatch.end).trim();
          
          if (afterField.startsWith('!=')) {
            operator = '!=';
            // Parser la valeur après !=
            final valueMatch = RegExp('!=\\s*(?:(["\'])([^"\']*)\\1|\\\$\\{([^}]+)\\})').firstMatch(afterField);
            if (valueMatch != null) {
              if (valueMatch.group(3) != null) {
                // Référence à un autre champ
                expectedValue = formValues[valueMatch.group(3)!]?.toString().toLowerCase().trim();
              } else {
                // Valeur littérale
                expectedValue = (valueMatch.group(2) ?? '').toLowerCase().trim();
              }
            }
          } else if (afterField.startsWith('=')) {
            operator = '=';
            // Parser la valeur après =
            final valueMatch = RegExp('=\\s*(?:(["\'])([^"\']*)\\1|\\\$\\{([^}]+)\\})').firstMatch(afterField);
            if (valueMatch != null) {
              if (valueMatch.group(3) != null) {
                // Référence à un autre champ
                expectedValue = formValues[valueMatch.group(3)!]?.toString().toLowerCase().trim();
              } else {
                // Valeur littérale
                expectedValue = (valueMatch.group(2) ?? '').toLowerCase().trim();
              }
            }
          }

          // Format possible: ${field} (sans opérateur, signifie que le champ doit avoir une valeur)
          if (operator == null && filterExpression.trim() == '\${$referencedField}') {
            return filterFieldValue.isNotEmpty;
          }
        }

        // Si on n'a pas pu extraire la valeur attendue
        if (expectedValue == null || expectedValue.isEmpty) {
          // Si on ne peut pas parser, ne pas afficher par sécurité
          return false;
        }

        // Comparer selon l'opérateur
        // IMPORTANT: La comparaison se fait sur les valeurs (value), pas sur les labels
        // Les valeurs sont normalisées en minuscules pour une comparaison insensible à la casse
        final matches = (operator == '=' || operator == null) 
            ? filterFieldValue == expectedValue
            : (operator == '!=') 
                ? filterFieldValue != expectedValue
                : false;
        
        // Debug: afficher les comparaisons pour toutes les options
        print('DEBUG Option: ${option.label} (value=${option.value}), filter=$filterExpression, filterFieldValue="$filterFieldValue", expectedValue="$expectedValue", operator=$operator, matches=$matches');
        
        return matches;
      }).toList();
    }

    // Si pas de filterField mais choiceFilter existe, retourner toutes les options
    // (le filtrage sera géré par d'autres mécanismes)
    return field.options!;
  }

  Widget _buildSelectOneField(BuildContext context) {
    // Obtenir les options filtrées
    final filteredOptions = _getFilteredOptions(context);
    
    print('DEBUG _buildSelectOneField: field=${field.name}, filteredOptions count=${filteredOptions.length}, total options=${field.options?.length ?? 0}');
    
    if (filteredOptions.isEmpty) {
      // Si pas d'options après filtrage, afficher un message ou un champ texte vide
      return FormBuilderTextField(
        name: field.name,
        initialValue: formValues[field.name]?.toString(),
        decoration: InputDecoration(
          labelText: field.label,
          hintText: field.filterField != null 
              ? 'Sélectionnez d\'abord ${_getFieldLabel(field.filterField!)}'
              : field.noteText,
          border: const OutlineInputBorder(),
          enabled: false,
        ),
        readOnly: true,
      );
    }

    final currentValue = formValues[field.name]?.toString();
    final initialValue = currentValue ?? 
        (field.defaultValue != null ? field.defaultValue.toString() : null);

    // Vérifier si la valeur actuelle est toujours dans les options filtrées
    final validInitialValue = initialValue != null && 
        filteredOptions.any((opt) => opt.value == initialValue)
        ? initialValue
        : null;

    // Si la valeur actuelle n'est plus valide, la réinitialiser
    if (currentValue != null && validInitialValue == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // Ne pas réinitialiser si c'est le champ de référence pour un autre champ
        // (cela pourrait causer des problèmes de filtrage)
        final isReferencedByOtherField = allFields?.any((f) => f.filterField == field.name) ?? false;
        if (!isReferencedByOtherField) {
          formValues[field.name] = null;
          onChanged(null);
        }
      });
    }

    // Créer une clé unique basée sur le filtre pour forcer la reconstruction
    final filterKey = field.filterField != null 
        ? formValues[field.filterField]?.toString() ?? 'null'
        : 'no_filter';

    return FormBuilderDropdown<String>(
      key: ValueKey('${field.name}_$filterKey'),
      name: field.name,
      initialValue: validInitialValue,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
        suffixIcon: _buildSettingsSuffixIcon(context),
      ),
      items: filteredOptions
          .map((option) => DropdownMenuItem(
                value: option.value,
                child: Text(option.label),
              ))
          .toList(),
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      onChanged: (value) {
        // Mettre à jour formValues immédiatement AVANT d'appeler onChanged
        // pour que les champs dépendants puissent y accéder lors de leur reconstruction
        formValues[field.name] = value;
        print('DEBUG onChanged: field=${field.name}, value=$value, formValues now contains: ${formValues.keys.toList()}');
        onChanged(value);
        // Réinitialiser les champs dépendants si nécessaire
        if (allFields != null) {
          _resetDependentFields(value);
        }
      },
    );
  }

  /// Réinitialise les champs qui dépendent de ce champ
  void _resetDependentFields(String? value) {
    if (allFields == null) return;
    
    for (final dependentField in allFields!) {
      if (dependentField.filterField == field.name) {
        // Réinitialiser la valeur du champ dépendant
        formValues[dependentField.name] = null;
        onChanged(null);
      }
    }
  }

  /// Obtient le label d'un champ par son nom
  String _getFieldLabel(String fieldName) {
    if (allFields == null) return fieldName;
    final field = allFields!.firstWhere(
      (f) => f.name == fieldName,
      orElse: () => model.FormFieldModel(
        name: fieldName,
        label: fieldName,
        type: 'text',
        required: false,
      ),
    );
    return field.label;
  }

  Widget _buildSelectMultipleField(BuildContext context) {
    if (field.options == null || field.options!.isEmpty) {
      return _buildTextField(context);
    }

    final selectedValues = formValues[field.name] is List
        ? List<String>.from(formValues[field.name])
        : formValues[field.name] != null
            ? [formValues[field.name].toString()]
            : <String>[];

    return FormBuilderCheckboxGroup<String>(
      name: field.name,
      initialValue: selectedValues,
      decoration: InputDecoration(
        labelText: field.label,
        hintText: field.noteText,
        border: const OutlineInputBorder(),
      ),
      options: field.options!
          .map((option) => FormBuilderFieldOption(
                value: option.value,
                child: Text(option.label),
              ))
          .toList(),
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Sélectionnez au moins une option')
          : null,
      onChanged: (value) => onChanged(value),
    );
  }

  Widget _buildImageField(BuildContext context) {
    final imagePicker = ImagePicker();
    final currentImagePath = formValues[field.name]?.toString();
    
    return FormBuilderField<String>(
      name: field.name,
      initialValue: currentImagePath,
      validator: (field.required && _isFieldVisible())
          ? (value) {
              // Vérifier d'abord fieldState.value, puis formValues, puis value
              final actualValue = formValues[field.name] ?? value;
              if (actualValue == null || actualValue.toString().trim().isEmpty) {
                return 'Ce champ est obligatoire';
              }
              return null;
            }
          : null,
      builder: (FormFieldState<String> fieldState) {
        // Synchroniser fieldState avec formValues si nécessaire
        final formValue = formValues[field.name]?.toString();
        if (formValue != null && formValue.isNotEmpty && fieldState.value != formValue) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            fieldState.didChange(formValue);
          });
        }
        final imageValue = fieldState.value ?? formValue ?? currentImagePath;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field.label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (field.noteText != null) ...[
              const SizedBox(height: 4),
              _parseFormattedText(
                field.noteText!,
                fontSize: 12,
                textColor: Colors.grey[600],
              ),
            ],
            const SizedBox(height: 8),
            if (imageValue != null && imageValue.isNotEmpty) ...[
              // Afficher l'image existante
              Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: _buildImageWidget(imageValue),
                ),
              ),
              const SizedBox(height: 8),
            ],
            ElevatedButton.icon(
              onPressed: () async {
                try {
                  // Ouvrir la caméra directement
                  final XFile? image = await imagePicker.pickImage(
                    source: ImageSource.camera,
                    imageQuality: 85,
                  );
                  
                  if (image != null) {
                    // Compresser l'image avant l'encodage pour réduire la taille
                    final compressedBytes = await _compressImage(image.path);
                    final base64Image = base64Encode(compressedBytes);
                    final imageDataUrl = 'data:image/jpeg;base64,$base64Image';
                    
                    // Mettre à jour formValues immédiatement
                    formValues[field.name] = imageDataUrl;
                    // Mettre à jour la valeur du fieldState
                    fieldState.didChange(imageDataUrl);
                    // Notifier le parent
                    onChanged(imageDataUrl);
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Erreur lors de la prise de photo: ${e.toString()}'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                }
              },
              icon: const Icon(Icons.camera_alt),
              label: Text(imageValue != null && imageValue.isNotEmpty 
                  ? 'Reprendre une photo' 
                  : 'Prendre une photo'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  fieldState.errorText!,
                  style: TextStyle(color: Colors.red[700], fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildImageWidget(String imagePath) {
    if (imagePath.startsWith('data:image')) {
      // Image en base64
      try {
        final base64String = imagePath.split(',')[1];
        final bytes = base64Decode(base64String);
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
        );
      } catch (e) {
        return _buildErrorWidget();
      }
    } else if (imagePath.startsWith('/') || imagePath.startsWith('file://')) {
      // Image locale (chemin de fichier)
      try {
        final filePath = imagePath.replaceFirst('file://', '');
        final file = File(filePath);
        if (file.existsSync()) {
          return Image.file(
            file,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
          );
        } else {
          return _buildErrorWidget();
        }
      } catch (e) {
        return _buildErrorWidget();
      }
    } else {
      // Image réseau
      return Image.network(
        imagePath,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
      );
    }
  }

  Widget _buildErrorWidget() {
    return Container(
      color: Colors.grey[200],
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error, color: Colors.red),
            const SizedBox(height: 8),
            Text('Erreur de chargement', style: TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoField(BuildContext context) {
    final imagePicker = ImagePicker();
    final currentVideoPath = formValues[field.name]?.toString();
    
    return FormBuilderField<String>(
      name: field.name,
      initialValue: currentVideoPath,
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      builder: (FormFieldState<String> fieldState) {
        final videoValue = fieldState.value ?? currentVideoPath;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field.label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (field.noteText != null) ...[
              const SizedBox(height: 4),
              _parseFormattedText(
                field.noteText!,
                fontSize: 12,
                textColor: Colors.grey[600],
              ),
            ],
            const SizedBox(height: 8),
            if (videoValue != null && videoValue.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.videocam, color: Colors.blue),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Vidéo enregistrée',
                        style: TextStyle(fontSize: 14),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.delete, color: Colors.red),
                      onPressed: () {
                        fieldState.didChange(null);
                        onChanged(null);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            ElevatedButton.icon(
              onPressed: () async {
                try {
                  final XFile? video = await imagePicker.pickVideo(
                    source: ImageSource.camera,
                  );
                  
                  if (video != null) {
                    // Stocker le chemin de la vidéo
                    fieldState.didChange(video.path);
                    onChanged(video.path);
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Erreur lors de l\'enregistrement vidéo: ${e.toString()}'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                }
              },
              icon: const Icon(Icons.videocam),
              label: Text(videoValue != null && videoValue.isNotEmpty 
                  ? 'Réenregistrer une vidéo' 
                  : 'Enregistrer une vidéo'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  fieldState.errorText!,
                  style: TextStyle(color: Colors.red[700], fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildBarcodeField(BuildContext context) {
    final currentBarcode = formValues[field.name]?.toString();
    
    return FormBuilderField<String>(
      name: field.name,
      initialValue: currentBarcode,
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      builder: (FormFieldState<String> fieldState) {
        final barcodeValue = fieldState.value ?? currentBarcode;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field.label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (field.noteText != null) ...[
              const SizedBox(height: 4),
              _parseFormattedText(
                field.noteText!,
                fontSize: 12,
                textColor: Colors.grey[600],
              ),
            ],
            const SizedBox(height: 8),
            if (barcodeValue != null && barcodeValue.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                  color: Colors.grey.shade50,
                ),
                child: Row(
                  children: [
                    Icon(Icons.qr_code_scanner, color: Colors.blue),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        barcodeValue,
                        style: TextStyle(fontSize: 14, fontFamily: 'monospace'),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.delete, color: Colors.red),
                      onPressed: () {
                        fieldState.didChange(null);
                        onChanged(null);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            ElevatedButton.icon(
              onPressed: () async {
                try {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => _BarcodeScannerScreen(),
                    ),
                  );
                  
                  if (result != null && result is String) {
                    fieldState.didChange(result);
                    onChanged(result);
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Erreur lors du scan: ${e.toString()}'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                }
              },
              icon: const Icon(Icons.qr_code_scanner),
              label: Text(barcodeValue != null && barcodeValue.isNotEmpty 
                  ? 'Scanner à nouveau' 
                  : 'Scanner un code-barres/QR'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  fieldState.errorText!,
                  style: TextStyle(color: Colors.red[700], fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildSignatureField(BuildContext context) {
    // Utiliser formValues comme source de vérité pour l'initialValue
    final currentSignature = formValues[field.name]?.toString();
    
    return FormBuilderField<String>(
      name: field.name,
      initialValue: currentSignature,
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      builder: (FormFieldState<String> fieldState) {
        // Toujours utiliser formValues comme source de vérité pour la persistance
        final signatureValue = formValues[field.name]?.toString() ?? fieldState.value;
        
        // Synchroniser fieldState avec formValues si nécessaire
        if (signatureValue != null && signatureValue.isNotEmpty && fieldState.value != signatureValue) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            fieldState.didChange(signatureValue);
          });
        }
        
        final isDarkMode = Theme.of(context).brightness == Brightness.dark;
        final labelColor = isDarkMode ? Colors.white : Colors.black87;
        final noteColor = isDarkMode ? Colors.grey.shade400 : Colors.grey.shade600;
        final borderColor = isDarkMode ? Colors.grey.shade700 : Colors.grey.shade300;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field.label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: labelColor,
              ),
            ),
            if (field.noteText != null) ...[
              const SizedBox(height: 4),
              Text(
                field.noteText!,
                style: TextStyle(fontSize: 12, color: noteColor),
              ),
            ],
            const SizedBox(height: 8),
            if (signatureValue != null && signatureValue.isNotEmpty) ...[
              Container(
                height: 150,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: borderColor),
                  borderRadius: BorderRadius.circular(8),
                  color: isDarkMode ? Colors.grey.shade900 : Colors.white,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: _buildSignaturePreview(signatureValue),
                ),
              ),
              const SizedBox(height: 8),
            ],
            ElevatedButton.icon(
              onPressed: () async {
                try {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => _SignatureScreen(field: field),
                    ),
                  );
                  
                  if (result != null && result is String && result.isNotEmpty) {
                    // Mettre à jour formValues en premier (source de vérité)
                    formValues[field.name] = result;
                    // Mettre à jour le fieldState
                    fieldState.didChange(result);
                    // Notifier le changement
                    onChanged(result);
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Erreur lors de la capture de signature: ${e.toString()}'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                }
              },
              icon: const Icon(Icons.edit),
              label: Text(signatureValue != null && signatureValue.isNotEmpty 
                  ? 'Modifier la signature' 
                  : 'Signer'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  fieldState.errorText!,
                  style: TextStyle(color: Colors.red[700], fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildSignaturePreview(String signatureValue) {
    try {
      if (signatureValue.startsWith('data:image')) {
        final parts = signatureValue.split(',');
        if (parts.length >= 2) {
          final base64String = parts[1];
          final bytes = base64Decode(base64String);
          return Image.memory(
            bytes,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
          );
        }
      }
      // Si ce n'est pas un data URL, essayer comme URL réseau
      return Image.network(
        signatureValue,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
      );
    } catch (e) {
      // En cas d'erreur de décodage, afficher un widget d'erreur
      return _buildErrorWidget();
    }
  }

  Widget _buildGeopointField(BuildContext context) {
    final currentGeopoint = formValues[field.name];
    
    return FormBuilderField<Map<String, double>>(
      name: field.name,
      initialValue: currentGeopoint is Map ? Map<String, double>.from(currentGeopoint) : null,
      validator: (field.required && _isFieldVisible())
          ? FormBuilderValidators.required(errorText: 'Ce champ est obligatoire')
          : null,
      builder: (FormFieldState<Map<String, double>> fieldState) {
        final geopointValue = fieldState.value ?? 
            (currentGeopoint is Map ? Map<String, double>.from(currentGeopoint) : null);
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field.label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (field.noteText != null) ...[
              const SizedBox(height: 4),
              _parseFormattedText(
                field.noteText!,
                fontSize: 12,
                textColor: Colors.grey[600],
              ),
            ],
            const SizedBox(height: 8),
            if (geopointValue != null && geopointValue.containsKey('latitude') && geopointValue.containsKey('longitude')) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                  color: Colors.grey.shade50,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.location_on, color: Colors.red),
                        const SizedBox(width: 8),
                        Text(
                          'Position GPS',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Spacer(),
                        IconButton(
                          icon: Icon(Icons.delete, color: Colors.red),
                          onPressed: () {
                            fieldState.didChange(null);
                            onChanged(null);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Latitude: ${geopointValue['latitude']!.toStringAsFixed(6)}',
                      style: TextStyle(fontSize: 14),
                    ),
                    Text(
                      'Longitude: ${geopointValue['longitude']!.toStringAsFixed(6)}',
                      style: TextStyle(fontSize: 14),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            ElevatedButton.icon(
              onPressed: () async {
                try {
                  // Demander la permission de localisation
                  var status = await Permission.location.request();
                  if (!status.isGranted) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Permission de localisation refusée'),
                          backgroundColor: Colors.red,
                        ),
                      );
                    }
                    return;
                  }

                  // Obtenir la position actuelle
                  Position position = await Geolocator.getCurrentPosition(
                    desiredAccuracy: LocationAccuracy.high,
                  );

                  final geopoint = {
                    'latitude': position.latitude,
                    'longitude': position.longitude,
                  };

                  fieldState.didChange(geopoint);
                  onChanged(geopoint);
                  
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Position GPS enregistrée avec succès'),
                        backgroundColor: Colors.green,
                      ),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Erreur lors de l\'obtention de la position: ${e.toString()}'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                }
              },
              icon: const Icon(Icons.my_location),
              label: Text(geopointValue != null 
                  ? 'Mettre à jour la position' 
                  : 'Obtenir la position GPS'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  fieldState.errorText!,
                  style: TextStyle(color: Colors.red[700], fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildCalculateField(BuildContext context) {
    // Le champ calculé est en lecture seule et calcule automatiquement sa valeur
    final formula = field.validation?['formula']?.toString() ?? '';
    final calculatedValue = _evaluateFormula(formula);
    
    return FormBuilderField<String>(
      name: field.name,
      initialValue: calculatedValue?.toString(),
      enabled: false, // Champ en lecture seule
      builder: (FormFieldState<String> fieldState) {
        // Recalculer quand les valeurs du formulaire changent
        final newValue = _evaluateFormula(formula);
        if (newValue != null && newValue.toString() != fieldState.value) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            fieldState.didChange(newValue.toString());
            onChanged(newValue);
          });
        }
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field.label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (field.noteText != null) ...[
              const SizedBox(height: 4),
              _parseFormattedText(
                field.noteText!,
                fontSize: 12,
                textColor: Colors.grey[600],
              ),
            ],
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
                color: Colors.grey.shade100,
              ),
              child: Row(
                children: [
                  Icon(Icons.calculate, color: Colors.blue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      fieldState.value ?? calculatedValue?.toString() ?? '0',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (formula.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'Formule: $formula',
                style: TextStyle(fontSize: 12, color: Colors.grey[600], fontStyle: FontStyle.italic),
              ),
            ],
          ],
        );
      },
    );
  }

  dynamic _evaluateFormula(String formula) {
    if (formula.isEmpty) return null;
    
    try {
      // Remplacer les références aux champs par leurs valeurs numériques
      String expression = formula;
      formValues.forEach((key, value) {
        // Convertir la valeur en nombre
        double? numValue;
        if (value is num) {
          numValue = value.toDouble();
        } else if (value != null) {
          numValue = double.tryParse(value.toString());
        }
        
        if (numValue != null) {
          final fieldValue = numValue.toString();
          // Remplacer ${fieldName} ou {fieldName} par la valeur
          expression = expression.replaceAll('\${$key}', fieldValue);
          expression = expression.replaceAll('{$key}', fieldValue);
          // Remplacer seulement les occurrences complètes du nom du champ (pas les sous-chaînes)
          final regex = RegExp(r'\b' + RegExp.escape(key) + r'\b');
          expression = expression.replaceAll(regex, fieldValue);
        }
      });
      
      // Évaluer l'expression mathématique
      return _evaluateMathExpression(expression);
    } catch (e) {
      return null;
    }
  }

  double? _evaluateMathExpression(String expression) {
    try {
      // Nettoyer l'expression
      expression = expression.replaceAll(' ', '').trim();
      
      if (expression.isEmpty) return 0.0;
      
      // Si c'est juste un nombre, le retourner directement
      final numValue = double.tryParse(expression);
      if (numValue != null) return numValue;
      
      // Évaluer les opérations de base avec priorité
      // Gérer les parenthèses d'abord
      while (expression.contains('(')) {
        final start = expression.lastIndexOf('(');
        final end = expression.indexOf(')', start);
        if (end == -1) break;
        
        final subExpr = expression.substring(start + 1, end);
        final result = _evaluateSimpleExpression(subExpr);
        expression = expression.substring(0, start) + result.toString() + expression.substring(end + 1);
      }
      
      return _evaluateSimpleExpression(expression);
    } catch (e) {
      return null;
    }
  }

  double _evaluateSimpleExpression(String expression) {
    // Évaluer les multiplications et divisions d'abord
    expression = _evaluateOperations(expression, ['*', '/']);
    // Puis les additions et soustractions
    expression = _evaluateOperations(expression, ['+', '-']);
    
    return double.tryParse(expression) ?? 0.0;
  }

  String _evaluateOperations(String expression, List<String> operators) {
    for (final op in operators) {
      while (expression.contains(op)) {
        final regex = RegExp(r'(-?\d+\.?\d*)\s*' + RegExp.escape(op) + r'\s*(-?\d+\.?\d*)');
        final match = regex.firstMatch(expression);
        if (match == null) break;
        
        final left = double.parse(match.group(1)!);
        final right = double.parse(match.group(2)!);
        double result;
        
        switch (op) {
          case '*':
            result = left * right;
            break;
          case '/':
            result = right != 0 ? left / right : 0.0;
            break;
          case '+':
            result = left + right;
            break;
          case '-':
            result = left - right;
            break;
          default:
            result = 0.0;
        }
        
        expression = expression.replaceFirst(match.group(0)!, result.toString());
      }
    }
    return expression;
  }

  Widget _buildNoteField(BuildContext context) {
    // Le type note affiche uniquement le texte sans champ de saisie
    // Évaluer les références ${fieldName} dans le label et noteText
    // Parser le markdown et HTML pour la mise en forme
    
    // Créer une clé basée sur les valeurs des champs référencés pour forcer la reconstruction
    final referencedFields = _extractReferencedFields(field.label + (field.noteText ?? ''));
    final keyValues = referencedFields.map((fieldName) => formValues[fieldName]?.toString() ?? '').join('|');
    
    return StatefulBuilder(
      key: ValueKey('note_${field.name}_$keyValues'),
      builder: (context, setState) {
        // Fonction pour remplacer les références ${fieldName} par leurs valeurs
        String evaluateText(String text) {
          String result = text;
          
          // Pattern pour ${fieldName} ou {fieldName}
          final fieldPattern = RegExp(r'\$\{([^}]+)\}|(?<!\$)\{([^}]+)\}');
          
          fieldPattern.allMatches(text).forEach((match) {
            final fieldName = (match.group(1) ?? match.group(2))?.trim() ?? '';
            if (fieldName.isEmpty) return;
            
            dynamic fieldValue = formValues[fieldName];
            String? replacementValue;
            
            // Si la valeur n'est pas directement dans formValues, chercher dans allFields
            if (fieldValue == null && allFields != null) {
              // Chercher le champ dans allFields
              final referencedField = allFields!.firstWhere(
                (f) => f.name == fieldName,
                orElse: () => model.FormFieldModel(
                  name: '',
                  label: '',
                  type: 'text',
                  required: false,
                ),
              );
              
              // Si c'est un champ calculate, évaluer sa formule
              if (referencedField.name == fieldName && 
                  (referencedField.type == 'calculate' || referencedField.validation?['formula'] != null)) {
                final formula = referencedField.validation?['formula']?.toString() ?? '';
                if (formula.isNotEmpty) {
                  fieldValue = _evaluateFormula(formula);
                }
              }
              
              // Si toujours pas de valeur, utiliser le label du champ référencé
              if (fieldValue == null && referencedField.name == fieldName) {
                replacementValue = referencedField.label;
              }
            }
            
            // Remplacer la référence par la valeur ou le label, ou laisser vide si rien
            replacementValue ??= fieldValue?.toString();
            if (replacementValue == null || replacementValue.isEmpty) {
              // Si pas de valeur, essayer d'afficher le label du champ référencé
              if (allFields != null) {
                try {
                  final refField = allFields!.firstWhere((f) => f.name == fieldName);
                  replacementValue = refField.label.isNotEmpty ? refField.label : fieldName;
                } catch (e) {
                  replacementValue = fieldName; // Afficher le nom du champ si pas trouvé
                }
              } else {
                replacementValue = fieldName;
              }
            }
            
            result = result.replaceAll(match.group(0)!, replacementValue);
          });
          
          return result;
        }
        
        // Fonction pour parser et rendre le texte avec markdown et HTML
        Widget _buildFormattedText(String text, {double fontSize = 14, Color? textColor}) {
          // Évaluer d'abord les références ${fieldName}
          final evaluatedText = evaluateText(text);
          
          // Parser le markdown et HTML
          return _parseFormattedText(evaluatedText, fontSize: fontSize, textColor: textColor);
        }
        
        // Évaluer le label et le noteText
        final evaluatedLabel = field.label.isNotEmpty ? evaluateText(field.label) : '';
        final evaluatedNoteText = field.noteText != null ? evaluateText(field.noteText!) : null;
        
        // Détecter le mode sombre
        final isDarkMode = Theme.of(context).brightness == Brightness.dark;
        final noteBackgroundColor = isDarkMode ? Colors.grey.shade800 : Colors.blue.shade50;
        final noteTextColor = isDarkMode ? Colors.white : Colors.blue.shade900;
        final noteBorderColor = isDarkMode ? Colors.grey.shade700 : Colors.blue.shade200;
        final labelTextColor = isDarkMode ? Colors.white : Colors.black87;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (evaluatedLabel.isNotEmpty) ...[
              _buildFormattedText(
                field.label,
                fontSize: 16,
                textColor: labelTextColor,
              ),
              const SizedBox(height: 8),
            ],
            if (evaluatedNoteText != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: noteBackgroundColor,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: noteBorderColor),
                ),
                child: _buildFormattedText(
                  field.noteText!,
                  fontSize: 14,
                  textColor: noteTextColor,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
  
  /// Extrait les noms des champs référencés dans un texte (${fieldName} ou {fieldName})
  List<String> _extractReferencedFields(String text) {
    final fieldPattern = RegExp(r'\$\{([^}]+)\}|(?<!\$)\{([^}]+)\}');
    final fields = <String>[];
    fieldPattern.allMatches(text).forEach((match) {
      final fieldName = (match.group(1) ?? match.group(2))?.trim() ?? '';
      if (fieldName.isNotEmpty && !fields.contains(fieldName)) {
        fields.add(fieldName);
      }
    });
    return fields;
  }
  
  /// Parse le texte avec markdown et HTML et retourne un widget
  Widget _parseFormattedText(String text, {double fontSize = 14, Color? textColor}) {
    if (text.isEmpty) return const SizedBox.shrink();
    
    // Liste des TextSpan à construire
    final List<TextSpan> spans = [];
    
    // Fonction récursive pour parser le texte
    void parseText(String input, {double? currentFontSize, Color? currentColor, FontWeight? currentWeight, FontStyle? currentStyle, TextDecoration? currentDecoration}) {
      currentFontSize ??= fontSize;
      currentColor ??= textColor;
      
      // Pattern pour les balises HTML (supporte les balises imbriquées)
      // Utiliser une approche plus robuste pour gérer les balises imbriquées
      final htmlTagPattern = RegExp(r'<(\w+)([^>]*?)>(.*?)</\1>', dotAll: true, multiLine: true);
      
      if (htmlTagPattern.hasMatch(input)) {
        final match = htmlTagPattern.firstMatch(input);
        if (match != null) {
          // Ajouter le texte avant la balise
          final beforeTag = input.substring(0, match.start);
          if (beforeTag.isNotEmpty) {
            spans.add(TextSpan(
              text: beforeTag,
              style: TextStyle(
                fontSize: currentFontSize,
                color: currentColor,
                fontWeight: currentWeight,
                fontStyle: currentStyle,
                decoration: currentDecoration,
              ),
            ));
          }
          
          final tagName = match.group(1)!.toLowerCase();
          final attributes = match.group(2)!;
          final content = match.group(3)!;
          
          // Parser les attributs de style
          Color? spanColor = currentColor;
          FontWeight? fontWeight = currentWeight;
          FontStyle? fontStyle = currentStyle;
          double? spanFontSize = currentFontSize;
          TextDecoration? decoration = currentDecoration;
          
          // Parser style="color:black" ou style="color:#000000"
          final styleMatch = RegExp('style\\s*=\\s*(["\'])([^"\']+)\\1').firstMatch(attributes);
          if (styleMatch != null) {
            final styleContent = styleMatch.group(2)!;
            // Parser color
            final colorMatch = RegExp(r'color\s*:\s*([^;]+)').firstMatch(styleContent);
            if (colorMatch != null) {
              final colorValue = colorMatch.group(1)!.trim().toLowerCase();
              // Gérer les couleurs nommées communes
              switch (colorValue) {
                case 'black':
                  spanColor = Colors.black;
                  break;
                case 'red':
                  spanColor = Colors.red;
                  break;
                case 'blue':
                  spanColor = Colors.blue;
                  break;
                case 'green':
                  spanColor = Colors.green;
                  break;
                case 'white':
                  spanColor = Colors.white;
                  break;
                case 'gray':
                case 'grey':
                  spanColor = Colors.grey;
                  break;
                default:
                  // Couleur hexadécimale (#000000, #fff, etc.)
                  if (colorValue.startsWith('#')) {
                    try {
                      String hex = colorValue.substring(1);
                      // Gérer les formats courts (#fff) et longs (#ffffff)
                      if (hex.length == 3) {
                        hex = hex.split('').map((c) => c + c).join();
                      }
                      if (hex.length == 6) {
                        spanColor = Color(int.parse(hex, radix: 16) + 0xFF000000);
                      }
                    } catch (e) {
                      // Ignorer les erreurs de parsing
                    }
                  }
                  break;
              }
            }
            // Parser font-weight
            final fontWeightMatch = RegExp(r'font-weight\s*:\s*([^;]+)').firstMatch(styleContent);
            if (fontWeightMatch != null) {
              final weightValue = fontWeightMatch.group(1)!.trim();
              if (weightValue == 'bold' || weightValue == '700') {
                fontWeight = FontWeight.bold;
              }
            }
            // Parser font-style
            final fontStyleMatch = RegExp(r'font-style\s*:\s*([^;]+)').firstMatch(styleContent);
            if (fontStyleMatch != null) {
              final styleValue = fontStyleMatch.group(1)!.trim();
              if (styleValue == 'italic') {
                fontStyle = FontStyle.italic;
              }
            }
            // Parser text-decoration
            final decorationMatch = RegExp(r'text-decoration\s*:\s*([^;]+)').firstMatch(styleContent);
            if (decorationMatch != null) {
              final decorationValue = decorationMatch.group(1)!.trim();
              if (decorationValue == 'underline') {
                decoration = TextDecoration.underline;
              } else if (decorationValue == 'line-through') {
                decoration = TextDecoration.lineThrough;
              }
            }
          }
          
          // Appliquer les styles selon le tag
          if (tagName == 'strong' || tagName == 'b') {
            fontWeight = FontWeight.bold;
          } else if (tagName == 'em' || tagName == 'i') {
            fontStyle = FontStyle.italic;
          } else if (tagName == 'u') {
            decoration = TextDecoration.underline;
          } else if (tagName == 'h1' || tagName == 'h2' || tagName == 'h3' || 
                     tagName == 'h4' || tagName == 'h5' || tagName == 'h6') {
            final level = int.tryParse(tagName.substring(1)) ?? 1;
            spanFontSize = fontSize + (7 - level) * 2.0;
            fontWeight = FontWeight.bold;
          }
          
          // Récursivement parser le contenu de la balise
          parseText(content, currentFontSize: spanFontSize, currentColor: spanColor, currentWeight: fontWeight, currentStyle: fontStyle, currentDecoration: decoration);
          
          // Parser le texte après la balise
          final afterTag = input.substring(match.end);
          if (afterTag.isNotEmpty) {
            parseText(afterTag, currentFontSize: currentFontSize, currentColor: currentColor, currentWeight: currentWeight, currentStyle: currentStyle, currentDecoration: currentDecoration);
          }
          return;
        }
      }
      
      // Si pas de balise HTML, parser le markdown
      final lines = input.split('\n');
      for (int i = 0; i < lines.length; i++) {
        final line = lines[i];
        
        // Parser les titres markdown (### Titre)
        if (line.trim().startsWith('#')) {
          final headingMatch = RegExp(r'^(#{1,6})\s+(.+)$').firstMatch(line.trim());
          if (headingMatch != null) {
            final level = headingMatch.group(1)!.length;
            final title = headingMatch.group(2)!;
            final headingSize = fontSize + (7 - level) * 2.0;
            spans.add(TextSpan(
              text: title,
              style: TextStyle(
                fontSize: headingSize,
                fontWeight: FontWeight.bold,
                color: currentColor,
              ),
            ));
            if (i < lines.length - 1) {
              spans.add(const TextSpan(text: '\n'));
            }
            continue;
          }
        }
        
        // Parser le gras markdown (**texte** ou __texte__)
        String processedLine = line;
        int lastIndex = 0;
        
        // Parser **texte** ou __texte__
        final boldPattern = RegExp(r'(\*\*|__)(.*?)\1');
        for (final match in boldPattern.allMatches(processedLine)) {
          // Ajouter le texte avant
          if (match.start > lastIndex) {
            final beforeText = processedLine.substring(lastIndex, match.start);
            if (beforeText.isNotEmpty) {
              spans.add(TextSpan(
                text: beforeText,
                style: TextStyle(fontSize: currentFontSize, color: currentColor),
              ));
            }
          }
          // Ajouter le texte en gras
          spans.add(TextSpan(
            text: match.group(2)!,
            style: TextStyle(
              fontSize: currentFontSize,
              fontWeight: FontWeight.bold,
              color: currentColor,
            ),
          ));
          lastIndex = match.end;
        }
        
        // Ajouter le texte restant
        if (lastIndex < processedLine.length) {
          final remaining = processedLine.substring(lastIndex);
          if (remaining.isNotEmpty) {
            spans.add(TextSpan(
              text: remaining,
              style: TextStyle(fontSize: currentFontSize, color: currentColor),
            ));
          }
        }
        
        if (i < lines.length - 1) {
          spans.add(const TextSpan(text: '\n'));
        }
      }
    }
    
    // Commencer le parsing
    parseText(text);
    
    // Si aucun span n'a été créé, créer un span par défaut
    if (spans.isEmpty) {
      spans.add(TextSpan(text: text, style: TextStyle(fontSize: fontSize, color: textColor)));
    }
    
    return RichText(
      text: TextSpan(children: spans),
    );
  }

  /// Compresse une image depuis un chemin de fichier
  /// Réduit la taille à max 1920x1920 et compresse avec qualité 75%
  Future<List<int>> _compressImage(String imagePath) async {
    try {
      // Obtenir le répertoire temporaire
      final tempDir = await getTemporaryDirectory();
      final targetPath = '${tempDir.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';
      
      // Compresser l'image : max 1920x1920, qualité 75%
      final compressedFile = await FlutterImageCompress.compressAndGetFile(
        imagePath,
        targetPath,
        minWidth: 1920,
        minHeight: 1920,
        quality: 75,
        format: CompressFormat.jpeg,
      );
      
      if (compressedFile != null) {
        final bytes = await compressedFile.readAsBytes();
        // Nettoyer le fichier temporaire
        try {
          final fileToDelete = File(compressedFile.path);
          if (await fileToDelete.exists()) {
            await fileToDelete.delete();
          }
        } catch (e) {
          // Ignorer les erreurs de suppression
        }
        return bytes;
      } else {
        // Si la compression échoue, lire l'image originale
        final file = File(imagePath);
        return await file.readAsBytes();
      }
    } catch (e) {
      print('Erreur lors de la compression de l\'image: $e');
      // En cas d'erreur, retourner l'image originale
      final file = File(imagePath);
      return await file.readAsBytes();
    }
  }

  /// Compresse des bytes d'image (pour les signatures)
  /// Réduit la taille à max 1920x1920 et compresse avec qualité 75%
  Future<List<int>> _compressImageBytes(List<int> imageBytes) async {
    try {
      // Obtenir le répertoire temporaire
      final tempDir = await getTemporaryDirectory();
      final inputPath = '${tempDir.path}/input_${DateTime.now().millisecondsSinceEpoch}.png';
      final outputPath = '${tempDir.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';
      
      // Écrire les bytes dans un fichier temporaire
      final inputFile = File(inputPath);
      await inputFile.writeAsBytes(imageBytes);
      
      // Compresser l'image : max 1920x1920, qualité 75%
      final compressedFile = await FlutterImageCompress.compressAndGetFile(
        inputPath,
        outputPath,
        minWidth: 1920,
        minHeight: 1920,
        quality: 75,
        format: CompressFormat.jpeg,
      );
      
      // Nettoyer les fichiers temporaires
      try {
        await inputFile.delete();
        if (compressedFile != null) {
          final bytes = await compressedFile.readAsBytes();
          final fileToDelete = File(compressedFile.path);
          if (await fileToDelete.exists()) {
            await fileToDelete.delete();
          }
          return bytes;
        }
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
      
      // Si la compression échoue, retourner les bytes originaux
      return imageBytes;
    } catch (e) {
      print('Erreur lors de la compression des bytes d\'image: $e');
      // En cas d'erreur, retourner les bytes originaux
      return imageBytes;
    }
  }
}

// Écran de scan de code-barres/QR
class _BarcodeScannerScreen extends StatefulWidget {
  @override
  State<_BarcodeScannerScreen> createState() => _BarcodeScannerScreenState();
}

class _BarcodeScannerScreenState extends State<_BarcodeScannerScreen> {
  final MobileScannerController controller = MobileScannerController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Scanner un code'),
        actions: [
          IconButton(
            icon: Icon(Icons.flash_on),
            onPressed: () => controller.toggleTorch(),
          ),
        ],
      ),
      body: MobileScanner(
        controller: controller,
        onDetect: (capture) {
          final List<Barcode> barcodes = capture.barcodes;
          if (barcodes.isNotEmpty) {
            final barcode = barcodes.first;
            if (barcode.rawValue != null) {
              Navigator.pop(context, barcode.rawValue);
            }
          }
        },
      ),
    );
  }
}

// Écran de signature
class _SignatureScreen extends StatefulWidget {
  final model.FormFieldModel field;

  const _SignatureScreen({required this.field});

  @override
  State<_SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends State<_SignatureScreen> {
  final SignatureController _controller = SignatureController(
    penStrokeWidth: 2,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.field.label),
        actions: [
          IconButton(
            icon: Icon(Icons.clear),
            onPressed: () => _controller.clear(),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Signature(
                controller: _controller,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton(
                  onPressed: () => _controller.clear(),
                  child: Text('Effacer'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    if (_controller.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Veuillez signer d\'abord')),
                      );
                      return;
                    }

                    final signature = await _controller.toPngBytes();
                    if (signature != null) {
                      // Compresser la signature avant l'encodage
                      final compressedSignature = await _compressImageBytes(signature);
                      final base64Signature = base64Encode(compressedSignature);
                      final dataUrl = 'data:image/png;base64,$base64Signature';
                      Navigator.pop(context, dataUrl);
                    }
                  },
                  child: Text('Enregistrer'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Compresse des bytes d'image (pour les signatures)
  /// Réduit la taille à max 1920x1920 et compresse avec qualité 75%
  Future<List<int>> _compressImageBytes(List<int> imageBytes) async {
    try {
      // Obtenir le répertoire temporaire
      final tempDir = await getTemporaryDirectory();
      final inputPath = '${tempDir.path}/input_${DateTime.now().millisecondsSinceEpoch}.png';
      final outputPath = '${tempDir.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';
      
      // Écrire les bytes dans un fichier temporaire
      final inputFile = File(inputPath);
      await inputFile.writeAsBytes(imageBytes);
      
      // Compresser l'image : max 1920x1920, qualité 75%
      final compressedFile = await FlutterImageCompress.compressAndGetFile(
        inputPath,
        outputPath,
        minWidth: 1920,
        minHeight: 1920,
        quality: 75,
        format: CompressFormat.jpeg,
      );
      
      // Nettoyer les fichiers temporaires
      try {
        await inputFile.delete();
        if (compressedFile != null) {
          final bytes = await compressedFile.readAsBytes();
          final fileToDelete = File(compressedFile.path);
          if (await fileToDelete.exists()) {
            await fileToDelete.delete();
          }
          return bytes;
        }
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
      
      // Si la compression échoue, retourner les bytes originaux
      return imageBytes;
    } catch (e) {
      print('Erreur lors de la compression des bytes d\'image: $e');
      // En cas d'erreur, retourner les bytes originaux
      return imageBytes;
    }
  }
}

