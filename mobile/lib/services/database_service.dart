import 'dart:convert';
import 'dart:math';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/form.dart' as form_models;
import '../models/form_submission.dart';
import '../models/campaign.dart';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'drc_payment.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Table des formulaires
    await db.execute('''
      CREATE TABLE forms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        schema TEXT NOT NULL,
        version INTEGER NOT NULL,
        isPublished INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    ''');

    // Table des campagnes
    await db.execute('''
      CREATE TABLE campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        enregistrementFormId TEXT,
        validationFormId TEXT,
        isActive INTEGER NOT NULL,
        startDate TEXT,
        endDate TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    ''');

    // Table des soumissions
    await db.execute('''
      CREATE TABLE submissions (
        id TEXT PRIMARY KEY,
        formId TEXT NOT NULL,
        formVersion INTEGER NOT NULL,
        campaignId TEXT,
        data TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        syncedAt TEXT,
        errorMessage TEXT,
        FOREIGN KEY (formId) REFERENCES forms(id)
      )
    ''');

    // Index pour améliorer les performances
    await db.execute('CREATE INDEX idx_submissions_formId ON submissions(formId)');
    await db.execute('CREATE INDEX idx_submissions_status ON submissions(status)');
    await db.execute('CREATE INDEX idx_submissions_createdAt ON submissions(createdAt)');
  }

  // Forms
  Future<void> saveForm(form_models.FormModel form, form_models.FormVersion version) async {
    final db = await database;
    await db.insert(
      'forms',
      {
        'id': form.id,
        'name': form.name,
        'description': form.description,
        'type': form.type,
        'schema': json.encode(version.schema),
        'version': version.version,
        'isPublished': version.isPublished ? 1 : 0,
        'createdAt': form.createdAt.toIso8601String(),
        'updatedAt': form.updatedAt.toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> saveForms(List<form_models.FormModel> forms, List<form_models.FormVersion> versions) async {
    final db = await database;
    final batch = db.batch();
    
    // Obtenir les IDs des formulaires à sauvegarder
    final serverFormIds = forms.map((f) => f.id).toSet();
    
    // Obtenir tous les formulaires existants dans la base de données locale
    final existingForms = await getForms();
    final existingFormIds = existingForms.map((f) => f.id).toSet();
    
    // Identifier les formulaires à supprimer (présents localement mais pas sur le serveur)
    final formsToDelete = existingFormIds.difference(serverFormIds);
    
    // Supprimer les formulaires qui ne sont plus sur le serveur
    for (var formId in formsToDelete) {
      batch.delete('forms', where: 'id = ?', whereArgs: [formId]);
    }
    
    // Sauvegarder ou mettre à jour les formulaires du serveur
    for (var form in forms) {
      final version = versions.firstWhere(
        (v) => v.formId == form.id,
        orElse: () => form.publishedVersion!,
      );
      
      batch.insert(
        'forms',
        {
          'id': form.id,
          'name': form.name,
          'description': form.description,
          'type': form.type,
          'schema': json.encode(version.schema),
          'version': version.version,
          'isPublished': version.isPublished ? 1 : 0,
          'createdAt': form.createdAt.toIso8601String(),
          'updatedAt': form.updatedAt.toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    
    await batch.commit(noResult: true);
  }

  Future<void> deleteForm(String id) async {
    final db = await database;
    await db.delete('forms', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<form_models.FormModel>> getForms() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('forms');
    return maps.map((map) {
      try {
        final schemaJson = map['schema'] as String;
        final schema = json.decode(schemaJson) as Map<String, dynamic>;
        
        final isPublished = map['isPublished'] == 1;
        print('DEBUG DatabaseService.getForms: Form ${map['id']} - isPublished=$isPublished, version=${map['version']}, schema properties=${schema['properties']?.length ?? 0}');
        
        // Vérifier que le schéma a des propriétés
        if (schema['properties'] == null || (schema['properties'] as Map).isEmpty) {
          print('DEBUG DatabaseService: Form ${map['id']} has empty or invalid schema');
        }
        
        final version = form_models.FormVersion(
          id: '',
          formId: map['id'],
          version: map['version'],
          schema: schema,
          isPublished: isPublished,
          createdAt: DateTime.parse(map['createdAt']),
        );
        return form_models.FormModel(
          id: map['id'],
          name: map['name'],
          description: map['description'],
          type: map['type'],
          publishedVersion: version.isPublished ? version : null,
          versions: [version],
          createdAt: DateTime.parse(map['createdAt']),
          updatedAt: DateTime.parse(map['updatedAt']),
        );
      } catch (e) {
        print('DEBUG DatabaseService: Error parsing form ${map['id']}: $e');
        // Retourner un formulaire avec un schéma vide pour éviter de casser l'application
        final emptySchema = {'properties': {}, 'required': []};
        final version = form_models.FormVersion(
          id: '',
          formId: map['id'],
          version: map['version'],
          schema: emptySchema,
          isPublished: false,
          createdAt: DateTime.parse(map['createdAt']),
        );
        return form_models.FormModel(
          id: map['id'],
          name: map['name'] ?? 'Formulaire invalide',
          description: map['description'],
          type: map['type'],
          publishedVersion: null,
          versions: [version],
          createdAt: DateTime.parse(map['createdAt']),
          updatedAt: DateTime.parse(map['updatedAt']),
        );
      }
    }).toList();
  }

  Future<form_models.FormModel?> getForm(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'forms',
      where: 'id = ?',
      whereArgs: [id],
    );
    if (maps.isEmpty) {
      print('DEBUG DatabaseService.getForm: Form $id not found in database');
      return null;
    }
    
    final map = maps.first;
    final isPublished = map['isPublished'] == 1;
    final schema = jsonDecode(map['schema']) as Map<String, dynamic>;
    
    print('DEBUG DatabaseService.getForm: Form $id - isPublished=$isPublished, version=${map['version']}, schema properties=${schema['properties']?.length ?? 0}');
    
    final version = form_models.FormVersion(
      id: '',
      formId: map['id'],
      version: map['version'],
      schema: schema,
      isPublished: isPublished,
      createdAt: DateTime.parse(map['createdAt']),
    );
    return form_models.FormModel(
      id: map['id'],
      name: map['name'],
      description: map['description'],
      type: map['type'],
      publishedVersion: version.isPublished ? version : null,
      versions: [version],
      createdAt: DateTime.parse(map['createdAt']),
      updatedAt: DateTime.parse(map['updatedAt']),
    );
  }

  // Campaigns
  Future<void> saveCampaign(Campaign campaign) async {
    final db = await database;
    final json = campaign.toJson();
    json['isActive'] = campaign.isActive ? 1 : 0;
    await db.insert(
      'campaigns',
      json,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> saveCampaigns(List<Campaign> campaigns) async {
    final db = await database;
    final batch = db.batch();
    
    // Obtenir les IDs des campagnes à sauvegarder
    final serverCampaignIds = campaigns.map((c) => c.id).toSet();
    
    // Obtenir toutes les campagnes existantes dans la base de données locale
    final existingCampaigns = await getCampaigns();
    final existingCampaignIds = existingCampaigns.map((c) => c.id).toSet();
    
    // Identifier les campagnes à supprimer (présentes localement mais pas sur le serveur)
    final campaignsToDelete = existingCampaignIds.difference(serverCampaignIds);
    
    // Supprimer les campagnes qui ne sont plus sur le serveur
    for (var campaignId in campaignsToDelete) {
      batch.delete('campaigns', where: 'id = ?', whereArgs: [campaignId]);
    }
    
    // Sauvegarder ou mettre à jour les campagnes du serveur
    for (var campaign in campaigns) {
      final json = campaign.toJson();
      json['isActive'] = campaign.isActive ? 1 : 0;
      batch.insert(
        'campaigns',
        json,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> deleteCampaign(String id) async {
    final db = await database;
    await db.delete('campaigns', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<Campaign>> getCampaigns() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('campaigns');
    return maps.map((map) {
      final json = Map<String, dynamic>.from(map);
      json['isActive'] = map['isActive'] == 1;
      return Campaign.fromJson(json);
    }).toList();
  }

  Future<Campaign?> getCampaign(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'campaigns',
      where: 'id = ?',
      whereArgs: [id],
    );
    if (maps.isEmpty) return null;
    final json = Map<String, dynamic>.from(maps.first);
    json['isActive'] = maps.first['isActive'] == 1;
    return Campaign.fromJson(json);
  }

  /// Génère un ID unique au format ID-2512-1137-102
  /// Format: ID-YYMM-HHmm-XXX
  ///   - YYMM: Année et mois (ex: 2512 = décembre 2025)
  ///   - HHmm: Heure et minute d'enregistrement (ex: 1137 = 11:37)
  ///   - XXX: Chiffre aléatoire unique (3 chiffres)
  /// L'ID est unique pour chaque prestataire enregistré
  /// 
  /// [createdAt] : Date optionnelle pour générer l'ID basé sur une date spécifique (pour migration)
  Future<String> generateSubmissionId({DateTime? createdAt}) async {
    final now = createdAt ?? DateTime.now();
    final yearMonth = '${now.year.toString().substring(2)}${now.month.toString().padLeft(2, '0')}';
    final hourMinute = '${now.hour.toString().padLeft(2, '0')}${now.minute.toString().padLeft(2, '0')}';
    
    // Générer un nombre aléatoire de 3 chiffres (100-999)
    final random = Random();
    int randomNumber;
    String generatedId;
    final db = await database;
    
    // Vérifier l'unicité en boucle jusqu'à trouver un ID unique
    int attempts = 0;
    do {
      randomNumber = 100 + random.nextInt(900); // 100 à 999
      generatedId = 'ID-$yearMonth-$hourMinute-$randomNumber';
      
      // Vérifier si l'ID existe déjà
      final existing = await db.query(
        'submissions',
        columns: ['id'],
        where: 'id = ?',
        whereArgs: [generatedId],
        limit: 1,
      );
      
      if (existing.isEmpty) {
        // ID unique trouvé
        return generatedId;
      }
      
      attempts++;
      // Sécurité: si trop de tentatives, utiliser les millisecondes pour garantir l'unicité
      if (attempts > 10) {
        final milliseconds = now.millisecond;
        // Utiliser les 3 derniers chiffres des millisecondes
        final msSuffix = (milliseconds % 1000).toString().padLeft(3, '0');
        generatedId = 'ID-$yearMonth-$hourMinute-$msSuffix';
        // Vérifier une dernière fois
        final finalCheck = await db.query(
          'submissions',
          columns: ['id'],
          where: 'id = ?',
          whereArgs: [generatedId],
          limit: 1,
        );
        if (finalCheck.isEmpty) {
          return generatedId;
        }
        // Si toujours en conflit, utiliser timestamp complet en millisecondes (derniers 3 chiffres)
        final timestamp = now.millisecondsSinceEpoch;
        final timestampSuffix = (timestamp % 1000).toString().padLeft(3, '0');
        return 'ID-$yearMonth-$hourMinute-$timestampSuffix';
      }
    } while (true);
  }

  /// Vérifie si un ID est au nouveau format (ID-YYMM-HHmm-XXX)
  bool _isNewFormatId(String id) {
    final pattern = RegExp(r'^ID-\d{4}-\d{4}-\d{3}$');
    return pattern.hasMatch(id);
  }

  /// Migre les IDs des soumissions existantes vers le nouveau format
  /// Cette fonction doit être appelée une seule fois pour migrer les données existantes
  Future<int> migrateSubmissionIds() async {
    final db = await database;
    int migratedCount = 0;
    int skippedCount = 0;
    
    try {
      print('DEBUG migrateSubmissionIds: Début de la migration...');
      
      // Démarrer une transaction pour garantir la cohérence
      await db.transaction((txn) async {
        // Récupérer toutes les soumissions avec leurs données pour mettre à jour l'ID dans les données aussi
        final submissions = await txn.query('submissions', columns: ['id', 'createdAt', 'data']);
        print('DEBUG migrateSubmissionIds: ${submissions.length} soumissions trouvées dans la base de données locale');
        
        if (submissions.isEmpty) {
          print('DEBUG migrateSubmissionIds: Aucune soumission à migrer');
          return;
        }
        
        for (var submission in submissions) {
          final oldId = submission['id'] as String;
          final createdAtStr = submission['createdAt'] as String;
          final dataStr = submission['data'] as String?;
          
          print('DEBUG migrateSubmissionIds: Traitement de l\'ID: $oldId');
          
          // Vérifier si l'ID est déjà au nouveau format
          if (_isNewFormatId(oldId)) {
            print('DEBUG migrateSubmissionIds: ID $oldId déjà au nouveau format, ignoré');
            skippedCount++;
            continue; // Déjà au bon format, passer à la suivante
          }
          
          // Générer un nouvel ID basé sur la date de création de la soumission
          final createdAt = DateTime.parse(createdAtStr);
          String newId;
          int attempts = 0;
          
          do {
            // Générer l'ID avec la date de création originale
            final yearMonth = '${createdAt.year.toString().substring(2)}${createdAt.month.toString().padLeft(2, '0')}';
            final hourMinute = '${createdAt.hour.toString().padLeft(2, '0')}${createdAt.minute.toString().padLeft(2, '0')}';
            
            final random = Random();
            int randomNumber;
            
            if (attempts < 10) {
              randomNumber = 100 + random.nextInt(900); // 100 à 999
            } else {
              // Utiliser les millisecondes de la date de création pour garantir l'unicité
              final milliseconds = createdAt.millisecond;
              randomNumber = 100 + (milliseconds % 900);
            }
            
            newId = 'ID-$yearMonth-$hourMinute-${randomNumber.toString().padLeft(3, '0')}';
            
            // Vérifier si le nouvel ID existe déjà
            final existing = await txn.query(
              'submissions',
              columns: ['id'],
              where: 'id = ?',
              whereArgs: [newId],
              limit: 1,
            );
            
            if (existing.isEmpty) {
              // ID unique trouvé, mettre à jour la soumission
              print('DEBUG migrateSubmissionIds: Migration de $oldId vers $newId');
              
              // Mettre à jour l'ID dans les données JSON si présent
              Map<String, dynamic> updatedData = {};
              if (dataStr != null && dataStr.isNotEmpty) {
                try {
                  updatedData = json.decode(dataStr) as Map<String, dynamic>;
                  // Mettre à jour l'ID dans les données si présent
                  if (updatedData.containsKey('id') && updatedData['id'] == oldId) {
                    updatedData['id'] = newId;
                    print('DEBUG migrateSubmissionIds: ID mis à jour dans les données JSON');
                  }
                  // Mettre à jour submissionId si présent
                  if (updatedData.containsKey('submissionId') && updatedData['submissionId'] == oldId) {
                    updatedData['submissionId'] = newId;
                    print('DEBUG migrateSubmissionIds: submissionId mis à jour dans les données JSON');
                  }
                } catch (e) {
                  print('DEBUG migrateSubmissionIds: Erreur lors du parsing des données JSON: $e');
                  // Continuer avec les données originales si le parsing échoue
                }
              }
              
              // Mettre à jour la soumission avec le nouvel ID et les données mises à jour
              await txn.update(
                'submissions',
                {
                  'id': newId,
                  if (updatedData.isNotEmpty) 'data': json.encode(updatedData),
                },
                where: 'id = ?',
                whereArgs: [oldId],
              );
              migratedCount++;
              print('DEBUG migrateSubmissionIds: Migration réussie ($migratedCount soumissions migrées)');
              break;
            }
            
            attempts++;
            
            // Si trop de tentatives, utiliser un suffixe basé sur les millisecondes
            if (attempts > 20) {
              final timestamp = createdAt.millisecondsSinceEpoch;
              final timestampSuffix = (timestamp % 1000).toString().padLeft(3, '0');
              newId = 'ID-$yearMonth-$hourMinute-$timestampSuffix';
              
              // Vérifier une dernière fois
              final finalCheck = await txn.query(
                'submissions',
                columns: ['id'],
                where: 'id = ?',
                whereArgs: [newId],
                limit: 1,
              );
              
              if (finalCheck.isEmpty) {
                await txn.update(
                  'submissions',
                  {'id': newId},
                  where: 'id = ?',
                  whereArgs: [oldId],
                );
                migratedCount++;
                break;
              }
              
              // Dernier recours : utiliser l'ancien ID avec un préfixe
              // Si l'ancien ID est un nombre, utiliser les 3 derniers chiffres
              String suffix;
              if (RegExp(r'^\d+$').hasMatch(oldId)) {
                // ID numérique, prendre les 3 derniers chiffres
                final numId = int.parse(oldId);
                suffix = (numId % 1000).toString().padLeft(3, '0');
              } else {
                // ID textuel, prendre les 3 derniers caractères
                suffix = oldId.length >= 3 
                    ? oldId.substring(oldId.length - 3).padLeft(3, '0')
                    : oldId.padLeft(3, '0');
              }
              newId = 'ID-$yearMonth-$hourMinute-$suffix';
              
              // Vérifier une dernière fois avant de mettre à jour
              final lastCheck = await txn.query(
                'submissions',
                columns: ['id'],
                where: 'id = ?',
                whereArgs: [newId],
                limit: 1,
              );
              
              if (lastCheck.isEmpty) {
                await txn.update(
                  'submissions',
                  {'id': newId},
                  where: 'id = ?',
                  whereArgs: [oldId],
                );
                migratedCount++;
                print('DEBUG migrateSubmissionIds: Migration réussie avec suffixe personnalisé: $oldId -> $newId');
                break;
              } else {
                // Si même avec le suffixe personnalisé il y a conflit, utiliser timestamp
                final timestamp = DateTime.now().millisecondsSinceEpoch;
                final tsSuffix = (timestamp % 1000).toString().padLeft(3, '0');
                newId = 'ID-$yearMonth-$hourMinute-$tsSuffix';
                await txn.update(
                  'submissions',
                  {'id': newId},
                  where: 'id = ?',
                  whereArgs: [oldId],
                );
                migratedCount++;
                print('DEBUG migrateSubmissionIds: Migration réussie avec timestamp: $oldId -> $newId');
                break;
              }
            }
          } while (true);
        }
      });
      
      print('DEBUG migrateSubmissionIds: Migration terminée');
      print('DEBUG migrateSubmissionIds: $migratedCount soumissions migrées');
      print('DEBUG migrateSubmissionIds: $skippedCount soumissions déjà au bon format');
      print('Migration terminée: $migratedCount soumissions migrées vers le nouveau format d\'ID');
      return migratedCount;
    } catch (e) {
      print('Erreur lors de la migration des IDs: $e');
      rethrow;
    }
  }

  // Submissions
  Future<String> saveSubmission(FormSubmission submission) async {
    final db = await database;
    // Générer un ID au nouveau format si non fourni
    final id = submission.id ?? await generateSubmissionId();
    await db.insert(
      'submissions',
      {
        'id': id,
        'formId': submission.formId,
        'formVersion': submission.formVersion,
        'campaignId': submission.campaignId,
        'data': json.encode(submission.data),
        'status': submission.status.toString().split('.').last,
        'createdAt': submission.createdAt.toIso8601String(),
        'syncedAt': submission.syncedAt?.toIso8601String(),
        'errorMessage': submission.errorMessage,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return id;
  }

  Future<List<FormSubmission>> getSubmissions({
    String? formId,
    SubmissionStatus? status,
    bool includeData = false, // Par défaut, ne pas charger les données (trop volumineuses)
  }) async {
    final db = await database;
    String? where;
    List<dynamic>? whereArgs;

    if (formId != null && status != null) {
      where = 'formId = ? AND status = ?';
      whereArgs = [formId, status.toString().split('.').last];
    } else if (formId != null) {
      where = 'formId = ?';
      whereArgs = [formId];
    } else if (status != null) {
      where = 'status = ?';
      whereArgs = [status.toString().split('.').last];
    }

    // Ne charger que les colonnes nécessaires pour éviter "Row too big to fit into CursorWindow"
    final columns = includeData
        ? null // Charger toutes les colonnes si includeData est true
        : ['id', 'formId', 'formVersion', 'campaignId', 'status', 'createdAt', 'syncedAt', 'errorMessage'];

    final List<Map<String, dynamic>> maps = await db.query(
      'submissions',
      columns: columns,
      where: where,
      whereArgs: whereArgs,
      orderBy: 'createdAt DESC',
    );

    return maps.map((map) {
      return FormSubmission(
        id: map['id'],
        formId: map['formId'],
        formVersion: map['formVersion'],
        campaignId: map['campaignId'],
        data: includeData && map['data'] != null
            ? json.decode(map['data'])
            : {}, // Données vides pour les listes
        status: SubmissionStatus.values.firstWhere(
          (e) => e.toString().split('.').last == map['status'],
          orElse: () => SubmissionStatus.pending,
        ),
        createdAt: DateTime.parse(map['createdAt']),
        syncedAt: map['syncedAt'] != null ? DateTime.parse(map['syncedAt']) : null,
        errorMessage: map['errorMessage'],
      );
    }).toList();
  }

  /// Charge une soumission avec ses données complètes (pour l'édition)
  /// Utilise une approche en deux étapes pour éviter "Row too big to fit into CursorWindow"
  Future<FormSubmission?> getSubmissionWithData(String id) async {
    final db = await database;
    
    // Étape 1: Charger toutes les colonnes SAUF 'data' pour éviter l'erreur CursorWindow
    final List<Map<String, dynamic>> maps = await db.query(
      'submissions',
      columns: ['id', 'formId', 'formVersion', 'campaignId', 'status', 'createdAt', 'syncedAt', 'errorMessage'],
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (maps.isEmpty) {
      return null;
    }

    final map = maps.first;
    
    // Étape 2: Charger la colonne 'data' séparément avec rawQuery pour éviter la limite CursorWindow
    Map<String, dynamic>? dataMap;
    try {
      final dataResult = await db.rawQuery(
        'SELECT data FROM submissions WHERE id = ? LIMIT 1',
        [id],
      );
      if (dataResult.isNotEmpty && dataResult.first['data'] != null) {
        final dataString = dataResult.first['data'] as String;
        dataMap = json.decode(dataString) as Map<String, dynamic>;
      }
    } catch (e) {
      print('Erreur lors du chargement des données de la soumission $id: $e');
      // Si le chargement des données échoue, retourner quand même la soumission avec des données vides
      dataMap = {};
    }
    
    return FormSubmission(
      id: map['id'],
      formId: map['formId'],
      formVersion: map['formVersion'],
      campaignId: map['campaignId'],
      data: dataMap ?? {},
      status: SubmissionStatus.values.firstWhere(
        (e) => e.toString().split('.').last == map['status'],
        orElse: () => SubmissionStatus.pending,
      ),
      createdAt: DateTime.parse(map['createdAt']),
      syncedAt: map['syncedAt'] != null ? DateTime.parse(map['syncedAt']) : null,
      errorMessage: map['errorMessage'],
    );
  }

  Future<void> updateSubmission(FormSubmission submission) async {
    final db = await database;
    await db.update(
      'submissions',
      {
        'formId': submission.formId,
        'formVersion': submission.formVersion,
        'campaignId': submission.campaignId,
        'data': json.encode(submission.data),
        'status': submission.status.toString().split('.').last,
        'createdAt': submission.createdAt.toIso8601String(),
        'syncedAt': submission.syncedAt?.toIso8601String(),
        'errorMessage': submission.errorMessage,
      },
      where: 'id = ?',
      whereArgs: [submission.id],
    );
  }

  /// Met à jour l'ID d'une soumission (utile lors de la synchronisation avec le backend)
  Future<void> updateSubmissionId(String oldId, String newId) async {
    final db = await database;
    await db.transaction((txn) async {
      // Mettre à jour l'ID dans la table submissions
      await txn.update(
        'submissions',
        {'id': newId},
        where: 'id = ?',
        whereArgs: [oldId],
      );
      
      // Mettre à jour l'ID dans les données JSON si présent
      final submission = await txn.query(
        'submissions',
        columns: ['data'],
        where: 'id = ?',
        whereArgs: [newId],
        limit: 1,
      );
      
      if (submission.isNotEmpty && submission.first['data'] != null) {
        try {
          final dataStr = submission.first['data'] as String;
          final dataMap = json.decode(dataStr) as Map<String, dynamic>;
          
          // Mettre à jour l'ID dans les données JSON si présent
          if (dataMap.containsKey('id') && dataMap['id'] == oldId) {
            dataMap['id'] = newId;
          }
          if (dataMap.containsKey('submissionId') && dataMap['submissionId'] == oldId) {
            dataMap['submissionId'] = newId;
          }
          
          await txn.update(
            'submissions',
            {'data': json.encode(dataMap)},
            where: 'id = ?',
            whereArgs: [newId],
          );
        } catch (e) {
          print('Erreur lors de la mise à jour de l\'ID dans les données JSON: $e');
          // Continuer même si la mise à jour des données JSON échoue
        }
      }
    });
  }

  Future<void> updateSubmissionStatus(
    String id,
    SubmissionStatus status, {
    String? errorMessage,
  }) async {
    final db = await database;
    await db.update(
      'submissions',
      {
        'status': status.toString().split('.').last,
        'syncedAt': status == SubmissionStatus.synced
            ? DateTime.now().toIso8601String()
            : null,
        'errorMessage': errorMessage,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> deleteSubmission(String id) async {
    final db = await database;
    await db.delete('submissions', where: 'id = ?', whereArgs: [id]);
  }

  Future<int> getPendingSubmissionsCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM submissions WHERE status = ?',
      [SubmissionStatus.pending.toString().split('.').last],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }
}

