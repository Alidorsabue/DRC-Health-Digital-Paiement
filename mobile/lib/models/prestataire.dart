class Prestataire {
  final String id;
  final String? prestataireId; // ID réel du prestataire (peut être différent de id si id est l'ID de soumission)
  final String nom;
  final String prenom;
  final String? postnom;
  final String? telephone;
  final String? categorie;
  final String? provinceId;
  final String? zoneId;
  final String? aireId;
  final String? campaignId;
  final String status;
  final String? kycStatus; // Statut KYC: 'CORRECT', 'INCORRECT', 'SANS_COMPTE', null (non vérifié)
  final int? presenceDays;
  final Map<String, dynamic>? enregistrementData;
  final DateTime createdAt;
  final DateTime updatedAt;

  Prestataire({
    required this.id,
    this.prestataireId,
    required this.nom,
    required this.prenom,
    this.postnom,
    this.telephone,
    this.categorie,
    this.provinceId,
    this.zoneId,
    this.aireId,
    this.campaignId,
    required this.status,
    this.kycStatus,
    this.presenceDays,
    this.enregistrementData,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Retourne l'ID réel du prestataire (prestataireId si disponible, sinon id)
  String get realId => id;

  /// Extrait la catégorie/rôle depuis les données du formulaire
  static String? _extractCategorie(Map<String, dynamic> json) {
    // Chercher directement dans les colonnes de la table
    String? categorie = json['categorie']?.toString();
    if (categorie != null && categorie.isNotEmpty && categorie != 'null') {
      return categorie;
    }
    
    // Chercher dans les champs du formulaire
    categorie = json['campaign_role_i_f']?.toString() ?? 
                json['campaign_role']?.toString() ??
                json['role']?.toString() ??
                json['role_prestataire']?.toString();
    
    if (categorie != null && categorie.isNotEmpty && categorie != 'null') {
      return categorie;
    }
    
    // Chercher dans raw_data ou enregistrementData
    Map<String, dynamic>? formData;
    if (json['raw_data'] != null && json['raw_data'] is Map) {
      formData = json['raw_data'] as Map<String, dynamic>;
    } else if (json['enregistrementData'] != null && json['enregistrementData'] is Map) {
      formData = json['enregistrementData'] as Map<String, dynamic>;
    }
    
    if (formData != null) {
      categorie = formData['campaign_role_i_f']?.toString() ?? 
                  formData['campaign_role']?.toString() ??
                  formData['categorie']?.toString() ??
                  formData['role']?.toString() ??
                  formData['role_prestataire']?.toString();
      
      if (categorie != null && categorie.isNotEmpty && categorie != 'null') {
        return categorie;
      }
    }
    
    return null;
  }

  factory Prestataire.fromJson(Map<String, dynamic> json) {
    // Extraire postnom depuis enregistrementData, raw_data ou directement depuis json
    String? postnom;
    if (json['postnom'] != null) {
      postnom = json['postnom']?.toString();
    } else if (json['enregistrementData'] != null && json['enregistrementData'] is Map) {
      final data = json['enregistrementData'] as Map<String, dynamic>;
      postnom = data['postnom']?.toString() ?? data['post_nom']?.toString() ?? data['Postnom']?.toString();
    } else if (json['raw_data'] != null && json['raw_data'] is Map) {
      final data = json['raw_data'] as Map<String, dynamic>;
      postnom = data['postnom']?.toString() ?? data['post_nom']?.toString() ?? data['Postnom']?.toString();
    }

    // Extraire kycStatus depuis kyc_status (table formulaire), kycStatus, enregistrementData ou raw_data
    String? kycStatus;
    if (json['kyc_status'] != null) {
      kycStatus = json['kyc_status']?.toString();
    } else if (json['kycStatus'] != null) {
      kycStatus = json['kycStatus']?.toString();
    } else if (json['enregistrementData'] != null && json['enregistrementData'] is Map) {
      final data = json['enregistrementData'] as Map<String, dynamic>;
      kycStatus = data['kycStatus']?.toString();
    } else if (json['raw_data'] != null && json['raw_data'] is Map) {
      final data = json['raw_data'] as Map<String, dynamic>;
      kycStatus = data['kycStatus']?.toString();
    }

    // Extraire nom et prenom depuis les données du formulaire si pas directement disponibles
    String nom = json['nom']?.toString() ?? '';
    String prenom = json['prenom']?.toString() ?? '';
    
    // Si nom/prenom vides, chercher dans les colonnes directes du formulaire ou dans raw_data/enregistrementData
    if (nom.isEmpty || prenom.isEmpty) {
      // D'abord, chercher dans les colonnes directes (depuis la table du formulaire)
      if (nom.isEmpty) {
        nom = json['family_name_i_c']?.toString() ?? 
              json['family_name']?.toString() ?? 
              json['nom']?.toString() ?? '';
      }
      if (prenom.isEmpty) {
        prenom = json['given_name_i_c']?.toString() ?? 
                 json['given_name']?.toString() ?? 
                 json['prenom']?.toString() ?? '';
      }
      
      // Si toujours vide, chercher dans raw_data ou enregistrementData
      if (nom.isEmpty || prenom.isEmpty) {
        Map<String, dynamic>? formData;
        if (json['raw_data'] != null && json['raw_data'] is Map) {
          formData = json['raw_data'] as Map<String, dynamic>;
        } else if (json['enregistrementData'] != null && json['enregistrementData'] is Map) {
          formData = json['enregistrementData'] as Map<String, dynamic>;
        }
        
        if (formData != null) {
          if (nom.isEmpty) {
            nom = formData['family_name_i_c']?.toString() ?? 
                  formData['family_name']?.toString() ?? 
                  formData['nom']?.toString() ?? 
                  formData['Nom']?.toString() ?? '';
          }
          if (prenom.isEmpty) {
            prenom = formData['given_name_i_c']?.toString() ?? 
                     formData['given_name']?.toString() ?? 
                     formData['prenom']?.toString() ?? 
                     formData['Prenom']?.toString() ?? '';
          }
        }
      }
    }

    // Extraire postnom depuis middle_name_i_c si pas déjà trouvé
    if (postnom == null || postnom.isEmpty) {
      postnom = json['middle_name_i_c']?.toString() ?? 
                json['middle_name']?.toString();
      if ((postnom == null || postnom.isEmpty) && json['raw_data'] != null && json['raw_data'] is Map) {
        final data = json['raw_data'] as Map<String, dynamic>;
        postnom = data['middle_name_i_c']?.toString() ?? 
                  data['middle_name']?.toString() ?? 
                  data['postnom']?.toString() ?? 
                  data['post_nom']?.toString() ?? 
                  data['Postnom']?.toString();
      }
    }

    // Extraire telephone depuis les données du formulaire (num_phone, confirm_phone)
    String? telephone = json['telephone']?.toString();
    if (telephone == null || telephone.isEmpty || telephone == 'N/A' || telephone == 'null') {
      // Chercher dans les colonnes directes du formulaire
      telephone = json['num_phone']?.toString() ?? 
                  json['confirm_phone']?.toString() ??
                  json['phone']?.toString() ??
                  json['Phone']?.toString();
      
      // Si toujours vide, chercher dans enregistrementData
      if ((telephone == null || telephone.isEmpty || telephone == 'N/A' || telephone == 'null') && 
          json['enregistrementData'] != null && json['enregistrementData'] is Map) {
        final data = json['enregistrementData'] as Map<String, dynamic>;
        telephone = data['num_phone']?.toString() ?? 
                    data['confirm_phone']?.toString() ?? 
                    data['telephone']?.toString() ?? 
                    data['Telephone']?.toString() ?? 
                    data['phone']?.toString() ?? 
                    data['Phone']?.toString();
      }
      
      // Si toujours vide, chercher dans raw_data
      if ((telephone == null || telephone.isEmpty || telephone == 'N/A' || telephone == 'null') && 
          json['raw_data'] != null && json['raw_data'] is Map) {
        final data = json['raw_data'] as Map<String, dynamic>;
        telephone = data['num_phone']?.toString() ?? 
                    data['confirm_phone']?.toString() ?? 
                    data['telephone']?.toString() ?? 
                    data['Telephone']?.toString() ?? 
                    data['phone']?.toString() ?? 
                    data['Phone']?.toString();
      }
    }
    
    // Nettoyer le téléphone (enlever les espaces, etc.)
    if (telephone != null && telephone.isNotEmpty && telephone != 'N/A' && telephone != 'null') {
      telephone = telephone.trim();
      if (telephone.isEmpty) {
        telephone = null;
      }
    } else {
      telephone = null;
    }

    // Construire enregistrementData avec toutes les données du formulaire
    Map<String, dynamic>? enregistrementData = json['enregistrementData'] as Map<String, dynamic>?;
    if (enregistrementData == null && json['raw_data'] != null) {
      enregistrementData = Map<String, dynamic>.from(json['raw_data'] as Map);
    }

    // Extraire l'ID et prestataireId séparément
    // id peut être l'ID de la soumission, prestataireId est l'ID réel du prestataire
    String id = '';
    String? prestataireIdValue;
    
    if (json['id'] != null) {
      id = json['id'].toString();
    }
    
    // Extraire prestataireId si disponible (c'est l'ID réel du prestataire)
    if (json['prestataireId'] != null) {
      prestataireIdValue = json['prestataireId'].toString();
      // Si id n'est pas défini, utiliser prestataireId comme id
      if (id.isEmpty) {
        id = prestataireIdValue!;
      }
    } else if (id.isEmpty) {
      // Si ni id ni prestataireId ne sont disponibles, essayer d'autres champs
      if (json['prestataire_id'] != null) {
        prestataireIdValue = json['prestataire_id'].toString();
        id = prestataireIdValue!;
      }
    }

    return Prestataire(
      id: id,
      prestataireId: prestataireIdValue,
      nom: nom,
      prenom: prenom,
      postnom: postnom,
      telephone: telephone,
      categorie: _extractCategorie(json),
      provinceId: json['provinceId']?.toString() ?? json['province_id']?.toString(),
      zoneId: json['zoneId']?.toString() ?? json['zone_id']?.toString(),
      aireId: json['aireId']?.toString() ?? json['aire_id']?.toString(),
      campaignId: json['campaignId']?.toString() ?? json['campaign_id']?.toString(),
      status: json['status']?.toString() ?? 'ENREGISTRE',
      kycStatus: kycStatus,
      presenceDays: json['presenceDays'] is int 
          ? json['presenceDays'] as int? 
          : json['presenceDays'] is String 
              ? int.tryParse(json['presenceDays'] as String)
              : json['presence_days'] is int
                  ? json['presence_days'] as int?
                  : json['presence_days'] is String
                      ? int.tryParse(json['presence_days'] as String)
                      : null,
      enregistrementData: enregistrementData,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'].toString())
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'].toString())
              : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'].toString())
          : json['updated_at'] != null
              ? DateTime.parse(json['updated_at'].toString())
              : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'prestataireId': prestataireId,
      'nom': nom,
      'prenom': prenom,
      'postnom': postnom,
      'telephone': telephone,
      'categorie': categorie,
      'provinceId': provinceId,
      'zoneId': zoneId,
      'aireId': aireId,
      'campaignId': campaignId,
      'status': status,
      'kycStatus': kycStatus,
      'presenceDays': presenceDays,
      'enregistrementData': enregistrementData,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

