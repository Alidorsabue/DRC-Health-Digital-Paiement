class FormModel {
  final String id;
  final String name;
  final String? description;
  final String type;
  final FormVersion? publishedVersion;
  final List<FormVersion> versions;
  final DateTime createdAt;
  final DateTime updatedAt;

  FormModel({
    required this.id,
    required this.name,
    this.description,
    required this.type,
    this.publishedVersion,
    required this.versions,
    required this.createdAt,
    required this.updatedAt,
  });

  factory FormModel.fromJson(Map<String, dynamic> json) {
    return FormModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      type: json['type'],
      publishedVersion: json['publishedVersion'] != null
          ? FormVersion.fromJson(json['publishedVersion'])
          : null,
      versions: (json['versions'] as List<dynamic>?)
              ?.map((v) => FormVersion.fromJson(v))
              .toList() ??
          [],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'type': type,
      'publishedVersion': publishedVersion?.toJson(),
      'versions': versions.map((v) => v.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

class FormVersion {
  final String id;
  final String formId;
  final int version;
  final Map<String, dynamic> schema;
  final bool isPublished;
  final DateTime createdAt;

  FormVersion({
    required this.id,
    required this.formId,
    required this.version,
    required this.schema,
    required this.isPublished,
    required this.createdAt,
  });

  factory FormVersion.fromJson(Map<String, dynamic> json) {
    return FormVersion(
      id: json['id'],
      formId: json['formId'],
      version: json['version'],
      schema: json['schema'] as Map<String, dynamic>,
      isPublished: json['isPublished'] ?? false,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'formId': formId,
      'version': version,
      'schema': schema,
      'isPublished': isPublished,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

class FormFieldModel {
  final String name;
  final String label;
  final String type;
  final bool required;
  final String? group;
  final List<FormFieldOption>? options;
  final String? dependsOn;
  final String? dependsValue;
  final String? noteText;
  final dynamic defaultValue;
  final Map<String, dynamic>? validation;
  final int order;
  final String? choiceFilter; // Filtre de choix (choice_filter)
  final String? filterField; // Champ de référence pour le filtre
  final String? filterValue; // Valeur de référence pour le filtre
  final String? filterOperator; // Opérateur du filtre (=, !=, etc.)
  final String? appearance; // Apparence du champ (ex: number, multiline, etc.)

  FormFieldModel({
    required this.name,
    required this.label,
    required this.type,
    required this.required,
    this.group,
    this.options,
    this.dependsOn,
    this.dependsValue,
    this.noteText,
    this.defaultValue,
    this.validation,
    this.order = 0,
    this.choiceFilter,
    this.filterField,
    this.filterValue,
    this.filterOperator,
    this.appearance,
  });

  static Map<String, dynamic>? _buildValidation(Map<String, dynamic> prop) {
    Map<String, dynamic>? validation = {};
    bool hasValidation = false;
    
    if (prop['minimum'] != null || prop['maximum'] != null) {
      validation['min'] = prop['minimum'];
      validation['max'] = prop['maximum'];
      hasValidation = true;
    }
    
    // Pour les contraintes de longueur (minLength, maxLength)
    if (prop['minLength'] != null || prop['maxLength'] != null || 
        prop['x-minLength'] != null || prop['x-maxLength'] != null) {
      validation['minLength'] = prop['minLength'] ?? prop['x-minLength'];
      validation['maxLength'] = prop['maxLength'] ?? prop['x-maxLength'];
      hasValidation = true;
    }
    
    // Pour les champs de calcul, stocker la formule
    if (prop['x-calculate'] != null) {
      validation['formula'] = prop['x-calculate'];
      hasValidation = true;
    } else if (prop['calculate'] != null) {
      validation['formula'] = prop['calculate'];
      hasValidation = true;
    }
    
    return hasValidation ? validation : null;
  }

  factory FormFieldModel.fromSchema(String name, Map<String, dynamic> prop, List<String> requiredFields) {
    String fieldType = prop['x-type'] ?? prop['type'] ?? 'text';
    
    // Détecter le type selon le schéma
    if (prop['type'] == 'array' && prop['items']?['enum'] != null) {
      fieldType = 'select_multiple';
    } else if (prop['type'] == 'string' && prop['enum'] != null) {
      fieldType = 'select_one';
    }

    List<FormFieldOption>? options;
    if (prop['x-options'] != null && prop['x-options'] is List) {
      options = (prop['x-options'] as List)
          .map((opt) => FormFieldOption.fromJson(opt))
          .toList();
    } else if (prop['enum'] != null) {
      options = (prop['enum'] as List)
          .map((val) => FormFieldOption(label: val.toString(), value: val.toString()))
          .toList();
    } else if (prop['items']?['enum'] != null) {
      options = (prop['items']['enum'] as List)
          .map((val) => FormFieldOption(label: val.toString(), value: val.toString()))
          .toList();
    }

    return FormFieldModel(
      name: name,
      label: prop['title'] ?? name,
      type: fieldType,
      required: requiredFields.contains(name),
      group: prop['x-group'],
      options: options,
      dependsOn: prop['x-dependsOn'],
      dependsValue: prop['x-dependsValue'],
      noteText: prop['x-noteText'],
      defaultValue: prop['default'] != null && prop['default'] != '' ? prop['default'] : null,
      validation: _buildValidation(prop),
      order: prop['x-order'] ?? 0,
      choiceFilter: prop['x-choiceFilter'],
      filterField: prop['x-filterField'],
      filterValue: prop['x-filterValue'],
      filterOperator: prop['x-filterOperator'],
      // Gérer appearance : priorité à x-appearance, sinon x-numeric pour compatibilité
      appearance: prop['x-appearance'] ?? (prop['x-numeric'] == true ? 'number' : null),
    );
  }

  FormFieldModel copyWith({
    String? name,
    String? label,
    String? type,
    bool? required,
    String? group,
    List<FormFieldOption>? options,
    String? dependsOn,
    String? dependsValue,
    String? choiceFilter,
    String? filterField,
    String? filterValue,
    String? filterOperator,
    String? appearance,
    String? noteText,
    dynamic defaultValue,
    Map<String, dynamic>? validation,
    int? order,
  }) {
    return FormFieldModel(
      name: name ?? this.name,
      label: label ?? this.label,
      type: type ?? this.type,
      required: required ?? this.required,
      group: group ?? this.group,
      options: options ?? this.options,
      dependsOn: dependsOn ?? this.dependsOn,
      dependsValue: dependsValue ?? this.dependsValue,
      noteText: noteText ?? this.noteText,
      defaultValue: defaultValue ?? this.defaultValue,
      validation: validation ?? this.validation,
      order: order ?? this.order,
      choiceFilter: choiceFilter ?? this.choiceFilter,
      filterField: filterField ?? this.filterField,
      filterValue: filterValue ?? this.filterValue,
      filterOperator: filterOperator ?? this.filterOperator,
      appearance: appearance ?? this.appearance,
    );
  }
}

class FormFieldOption {
  final String label;
  final String value;
  final String? filter; // Propriété filter pour le filtrage dynamique

  FormFieldOption({
    required this.label,
    required this.value,
    this.filter,
  });

  factory FormFieldOption.fromJson(Map<String, dynamic> json) {
    return FormFieldOption(
      label: json['label'] ?? json['value'] ?? '',
      value: json['value'] ?? json['label'] ?? '',
      filter: json['filter'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'value': value,
      if (filter != null) 'filter': filter,
    };
  }
}

