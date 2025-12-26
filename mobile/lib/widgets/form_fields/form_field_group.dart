import 'package:flutter/material.dart';
import '../../models/form.dart' as model;
import 'dynamic_form_field.dart';

class FormFieldGroup extends StatefulWidget {
  final String groupName;
  final List<model.FormFieldModel> fields;
  final Map<String, dynamic> formValues;
  final Map<String, dynamic> initialValues;
  final ValueChanged<String> onFieldChanged;

  const FormFieldGroup({
    super.key,
    required this.groupName,
    required this.fields,
    required this.formValues,
    this.initialValues = const {},
    required this.onFieldChanged,
  });

  @override
  State<FormFieldGroup> createState() => _FormFieldGroupState();
}

class _FormFieldGroupState extends State<FormFieldGroup> {
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
  
  @override
  Widget build(BuildContext context) {
    final visibleFields = widget.fields.where((field) {
      if (field.dependsOn == null) return true;
      final dependsValue = widget.formValues[field.dependsOn];
      return dependsValue?.toString() == field.dependsValue;
    }).toList();

    if (visibleFields.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.groupName,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            ...visibleFields.map((field) {
              // Initialiser la valeur si elle existe dans initialValues
              // MAIS ne pas écraser une valeur existante
              if (widget.initialValues.containsKey(field.name) && 
                  (!widget.formValues.containsKey(field.name) || widget.formValues[field.name] == null)) {
                widget.formValues[field.name] = widget.initialValues[field.name];
              }
              // Initialiser avec defaultValue si aucune valeur n'existe
              // MAIS ne pas écraser une valeur existante
              else if ((!widget.formValues.containsKey(field.name) || widget.formValues[field.name] == null) && 
                       field.defaultValue != null) {
                widget.formValues[field.name] = field.defaultValue;
              }
              
              // Créer une clé unique pour forcer la reconstruction quand le champ de référence change
              final filterKey = field.filterField != null 
                  ? widget.formValues[field.filterField]?.toString() ?? 'null'
                  : 'no_filter';
              
              // Pour les champs note, inclure les valeurs des champs référencés dans la clé
              String noteKey = '';
              if (field.type == 'note') {
                final noteText = field.label + (field.noteText ?? '');
                final referencedFields = _extractReferencedFields(noteText);
                noteKey = referencedFields.map((refField) => 
                  widget.formValues[refField]?.toString() ?? ''
                ).join('|');
              }
              
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: DynamicFormField(
                  key: ValueKey('${field.name}_$filterKey${noteKey.isNotEmpty ? '_note_$noteKey' : ''}'),
                  field: field,
                  formValues: widget.formValues,
                  allFields: widget.fields, // Passer tous les champs pour le filtrage
                  onChanged: (value) {
                    // Mettre à jour formValues AVANT setState pour que les champs dépendants y aient accès
                    widget.formValues[field.name] = value;
                    print('DEBUG FormFieldGroup onChanged: field=${field.name}, value=$value');
                    print('  - formValues[${field.name}] = ${widget.formValues[field.name]}');
                    print('  - formValues keys before setState: ${widget.formValues.keys.toList()}');
                    widget.onFieldChanged(field.name);
                    // Forcer la reconstruction pour mettre à jour les champs filtrés
                    setState(() {
                      print('  - formValues keys after setState: ${widget.formValues.keys.toList()}');
                      print('  - formValues[${field.name}] after setState: ${widget.formValues[field.name]}');
                    });
                  },
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

