import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../services/api_service.dart';
import '../models/prestataire.dart';
import '../models/campaign.dart';

class PaymentReportScreen extends StatefulWidget {
  const PaymentReportScreen({super.key});

  @override
  State<PaymentReportScreen> createState() => _PaymentReportScreenState();
}

class _PaymentReportScreenState extends State<PaymentReportScreen> {
  List<Prestataire> _prestataires = [];
  // Stocker les données JSON brutes pour accéder au paymentAmount
  Map<String, Map<String, dynamic>> _prestatairesRawData = {};
  bool _isLoading = true;
  final ApiService _apiService = ApiService();
  String _selectedPaymentStatus = 'Tous';
  String? _formId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Récupérer le formId depuis la campagne active
      String? formId = _formId;
      if (formId == null) {
        try {
          final campaigns = await _apiService.getCampaigns();
          Campaign? activeCampaign;
          try {
            activeCampaign = campaigns.firstWhere((c) => c.isActive);
          } catch (e) {
            if (campaigns.isNotEmpty) {
              activeCampaign = campaigns.first;
            }
          }
          if (activeCampaign != null && activeCampaign.enregistrementFormId != null) {
            formId = activeCampaign.enregistrementFormId;
            _formId = formId;
          }
        } catch (e) {
          print('Erreur lors de la récupération de la campagne: $e');
        }
      }

      // Récupérer les prestataires depuis la table du formulaire
      List<Map<String, dynamic>> data;
      if (formId != null) {
        final result = await _apiService.getPrestatairesByForm(formId, limit: 1000);
        data = List<Map<String, dynamic>>.from(result['data'] ?? []);
        print('DEBUG PAYMENT: formId=$formId, result keys=${result.keys.toList()}, data count=${data.length}');
      } else {
        data = await _apiService.getPrestataires();
        print('DEBUG PAYMENT: Pas de formId, data count=${data.length}');
      }

      print('DEBUG PAYMENT: data count=${data.length}');
      if (data.isNotEmpty) {
        print('DEBUG PAYMENT: first item keys=${data.first.keys.toList()}');
      } else {
        print('DEBUG PAYMENT: ATTENTION - Aucune donnée retournée par l\'API');
      }

      // Parser les données et filtrer les objets invalides
      final parsedPrestataires = <Prestataire>[];
      final rawDataMap = <String, Map<String, dynamic>>{};
      
      for (final json in data) {
        try {
          final prestataire = Prestataire.fromJson(json);
          // Vérifier que les champs essentiels ne sont pas vides
          if (prestataire.id.isNotEmpty && 
              prestataire.nom.isNotEmpty && 
              prestataire.prenom.isNotEmpty) {
            parsedPrestataires.add(prestataire);
            // Stocker les données JSON brutes pour accéder au paymentAmount
            // Utiliser plusieurs clés pour être sûr de retrouver les données
            rawDataMap[prestataire.id] = json;
            if (prestataire.prestataireId != null && prestataire.prestataireId != prestataire.id) {
              rawDataMap[prestataire.prestataireId!] = json;
            }
            // Aussi stocker avec submissionId si disponible
            if (json['submissionId'] != null) {
              rawDataMap[json['submissionId'].toString()] = json;
            }
            print('DEBUG PAYMENT: Stocké données pour id=${prestataire.id}, prestataireId=${prestataire.prestataireId}, submissionId=${json['submissionId']}');
          } else {
            print('DEBUG PAYMENT: Prestataire ignoré - id=${prestataire.id}, nom=${prestataire.nom}, prenom=${prestataire.prenom}');
          }
        } catch (e) {
          print('DEBUG PAYMENT: Erreur lors du parsing d\'un prestataire: $e');
          print('DEBUG PAYMENT: JSON problématique: $json');
        }
      }

      print('DEBUG PAYMENT: ${parsedPrestataires.length} prestataires parsés avec succès sur ${data.length}');

      setState(() {
        _prestataires = parsedPrestataires;
        _prestatairesRawData = rawDataMap;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors du chargement: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  List<Prestataire> get _filteredPrestataires {
    if (_selectedPaymentStatus == 'Tous') {
      return _prestataires;
    }
    // Filtrer par statut de paiement réel depuis les données brutes
    return _prestataires.where((p) {
      final rawData = _prestatairesRawData[p.id];
      if (rawData == null) return false;
      
      // Chercher payment_status dans plusieurs emplacements
      final paymentStatus = rawData['payment_status']?.toString() ?? 
                          rawData['paymentStatus']?.toString() ??
                          rawData['enregistrementData']?['payment_status']?.toString() ??
                          rawData['enregistrementData']?['paymentStatus']?.toString() ??
                          '';
      
      final statusUpper = paymentStatus.toUpperCase().trim();
      final selectedUpper = _selectedPaymentStatus.toUpperCase().trim();
      
      // Mapping des statuts
      if (selectedUpper == 'PAYE' || selectedUpper == 'PAID') {
        return statusUpper == 'PAYE' || statusUpper == 'PAID' || statusUpper == 'SENT';
      } else if (selectedUpper == 'APPROUVE' || selectedUpper == 'APPROVED') {
        return statusUpper == 'APPROUVE' || statusUpper == 'APPROVED' || statusUpper == 'APPROUVE_PAR_MCZ';
      } else if (selectedUpper == 'EN_ATTENTE' || selectedUpper == 'PENDING') {
        return statusUpper == 'EN_ATTENTE' || statusUpper == 'PENDING' || statusUpper == 'EN_ATTENTE_PAR_MCZ';
      }
      
      return statusUpper == selectedUpper;
    }).toList();
  }

  double get _totalAmount {
    return _filteredPrestataires.fold(0.0, (sum, p) {
      // Récupérer le montant réellement payé depuis les données brutes
      // IMPORTANT: Ne compter que les prestataires avec payment_status = 'PAID' ou 'PAYE'
      final rawData = _prestatairesRawData[p.id];
      if (rawData == null) return sum;
      
      // Vérifier le statut de paiement réel
      final paymentStatus = rawData['payment_status']?.toString() ?? 
                          rawData['paymentStatus']?.toString() ??
                          rawData['enregistrementData']?['payment_status']?.toString() ??
                          rawData['enregistrementData']?['paymentStatus']?.toString() ??
                          '';
      
      final statusUpper = paymentStatus.toUpperCase().trim();
      
      // Ne compter que les prestataires réellement payés
      if (statusUpper != 'PAYE' && statusUpper != 'PAID' && statusUpper != 'SENT') {
        print('DEBUG PAYMENT: Prestataire ${p.id} ignoré - statut: $statusUpper');
        return sum; // Ignorer les prestataires non payés
      }
      
      print('DEBUG PAYMENT: Prestataire ${p.id} est payé (statut: $statusUpper)');
      
      // Chercher paymentAmount dans plusieurs emplacements possibles
      double? paymentAmount;
      final amountValue = rawData['paymentAmount'] ?? 
                         rawData['payment_amount'] ?? 
                         rawData['amount_to_pay'] ??
                         rawData['amountToPay'];
      
      if (amountValue != null) {
        try {
          paymentAmount = (amountValue is num) 
              ? amountValue.toDouble()
              : double.tryParse(amountValue.toString());
        } catch (e) {
          print('DEBUG PAYMENT: Erreur parsing paymentAmount pour ${p.id}: $e');
        }
      }
      
      // Si pas trouvé, chercher dans enregistrementData
      if (paymentAmount == null && rawData['enregistrementData'] != null) {
        final enregistrementData = rawData['enregistrementData'] as Map<String, dynamic>?;
        if (enregistrementData != null) {
          final amountValue2 = enregistrementData['paymentAmount'] ?? 
                              enregistrementData['payment_amount'];
          if (amountValue2 != null) {
            try {
              paymentAmount = (amountValue2 is num) 
                  ? amountValue2.toDouble()
                  : double.tryParse(amountValue2.toString());
            } catch (e) {
              // Ignorer
            }
          }
        }
      }
      
      // Si toujours pas de montant, chercher dans enregistrementData du modèle Prestataire
      if (paymentAmount == null && p.enregistrementData != null) {
        final data = p.enregistrementData!;
        final amountValue3 = data['paymentAmount'] ?? data['payment_amount'];
        if (amountValue3 != null) {
          try {
            paymentAmount = (amountValue3 is num) 
                ? amountValue3.toDouble()
                : double.tryParse(amountValue3.toString());
          } catch (e) {
            // Ignorer
          }
        }
      }
      
      // Ajouter le montant trouvé (ou 0 si pas trouvé)
      final amountToAdd = paymentAmount ?? 0.0;
      print('DEBUG PAYMENT: Ajout montant ${p.id}: $amountToAdd CDF (total: ${sum + amountToAdd})');
      return sum + amountToAdd;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Rapport de Paiement',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Actualiser',
          ),
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: _exportReport,
            tooltip: 'Exporter',
          ),
        ],
      ),
      body: Column(
        children: [
          // Résumé financier
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.green.shade800,
                  Colors.green.shade900,
                ],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Résumé financier',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Nombre de prestataires',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          '${_filteredPrestataires.length}',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Montant total',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          '${_totalAmount.toStringAsFixed(0)} CDF',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Filtre par statut de paiement
          Padding(
            padding: const EdgeInsets.all(16),
            child: DropdownButtonFormField<String>(
              value: _selectedPaymentStatus,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Filtrer par statut de paiement',
                labelStyle: const TextStyle(color: Colors.white70),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              dropdownColor: const Color(0xFF2C2C2C),
              items: const [
                DropdownMenuItem(value: 'Tous', child: Text('Tous')),
                DropdownMenuItem(value: 'PAYE', child: Text('Payé')),
                DropdownMenuItem(value: 'EN_ATTENTE', child: Text('En attente')),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedPaymentStatus = value ?? 'Tous';
                });
              },
            ),
          ),
          // Liste des prestataires
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredPrestataires.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.payment_outlined,
                              size: 64,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Aucun prestataire trouvé',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    color: Colors.grey.shade600,
                                  ),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadData,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(8),
                          itemCount: _filteredPrestataires.length,
                          itemBuilder: (context, index) {
                            final prestataire = _filteredPrestataires[index];

                            // Construire le nom complet
                            final fullName = '${prestataire.prenom} ${prestataire.nom}${prestataire.postnom != null ? " ${prestataire.postnom}" : ""}';

                            return Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: Colors.green.shade100,
                                  child: Icon(
                                    Icons.payment,
                                    color: Colors.green.shade700,
                                  ),
                                ),
                                title: Text(
                                  prestataire.id,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: Text(
                                  fullName,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                                trailing: _getPaymentStatusBadge(prestataire),
                                onTap: () => _showPrestataireDetails(prestataire),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  String? _formatDateNullable(DateTime? date) {
    if (date == null) return null;
    return _formatDate(date);
  }

  Widget _getPaymentStatusBadge(Prestataire prestataire) {
    // Extraire le statut de paiement réel depuis les données brutes stockées
    String? paymentStatus;
    
    // Essayer plusieurs clés pour trouver les données
    var rawData = _prestatairesRawData[prestataire.id];
    if (rawData == null && prestataire.prestataireId != null) {
      rawData = _prestatairesRawData[prestataire.prestataireId];
    }
    
    // Log pour déboguer
    if (rawData == null) {
      print('DEBUG PAYMENT BADGE: ⚠️ Aucune donnée brute trouvée pour ${prestataire.id}');
      print('DEBUG PAYMENT BADGE: Clés disponibles dans _prestatairesRawData: ${_prestatairesRawData.keys.take(5).toList()}');
    } else {
      print('DEBUG PAYMENT BADGE: Données trouvées pour ${prestataire.id}');
      print('DEBUG PAYMENT BADGE: paymentStatus=${rawData['paymentStatus']}, payment_status=${rawData['payment_status']}');
    }
    
    if (rawData != null) {
      // Chercher dans les colonnes directes de la table (priorité)
      // D'après les logs précédents, le champ s'appelle 'paymentStatus' (avec majuscule S)
      paymentStatus = rawData['paymentStatus']?.toString() ?? 
                     rawData['payment_status']?.toString();
      
      print('DEBUG PAYMENT BADGE: paymentStatus depuis colonnes directes: $paymentStatus');
      
      // Si pas trouvé, chercher dans enregistrementData
      if (paymentStatus == null || paymentStatus.isEmpty) {
        paymentStatus = rawData['enregistrementData']?['paymentStatus']?.toString() ??
                       rawData['enregistrementData']?['payment_status']?.toString();
        print('DEBUG PAYMENT BADGE: paymentStatus depuis enregistrementData: $paymentStatus');
      }
    }
    
    // Si toujours pas trouvé, chercher dans enregistrementData du modèle Prestataire
    if (paymentStatus == null || paymentStatus.isEmpty) {
      paymentStatus = prestataire.enregistrementData?['paymentStatus']?.toString() ??
                     prestataire.enregistrementData?['payment_status']?.toString();
      print('DEBUG PAYMENT BADGE: paymentStatus depuis prestataire.enregistrementData: $paymentStatus');
    }
    
    // Si pas de statut de paiement explicite, déduire du statut général
    if (paymentStatus == null || paymentStatus.isEmpty) {
      // Utiliser le statut général comme fallback
      final generalStatus = prestataire.status.toUpperCase().trim();
      print('DEBUG PAYMENT BADGE: Utilisation du statut général: $generalStatus');
      if (generalStatus == 'PAYE' || generalStatus == 'SENT' || generalStatus == 'PAID') {
        paymentStatus = 'PAID';
      } else if (generalStatus == 'APPROUVE_PAR_MCZ' || generalStatus == 'APPROUVE' || generalStatus == 'APPROVED') {
        paymentStatus = 'APPROVED';
      } else {
        paymentStatus = 'PENDING';
      }
    }

    Color statusColor;
    String statusText;
    
    final statusUpper = paymentStatus.toUpperCase().trim();
    
    // Gérer tous les cas possibles de statut de paiement
    if (statusUpper == 'PAYE' || statusUpper == 'PAID' || statusUpper == 'SENT') {
      statusColor = Colors.green;
      statusText = 'Payé';
    } else if (statusUpper == 'APPROUVE' || statusUpper == 'APPROUVE_PAR_MCZ' || statusUpper == 'APPROVED') {
      statusColor = Colors.blue;
      statusText = 'Approuvé';
    } else if (statusUpper == 'EN_ATTENTE' || statusUpper == 'EN_ATTENTE_PAR_MCZ' || statusUpper == 'PENDING') {
      statusColor = Colors.orange;
      statusText = 'En attente';
    } else {
      statusColor = Colors.grey;
      statusText = 'Non payé';
    }
    
    // Log pour déboguer
    print('DEBUG PAYMENT BADGE: Prestataire ${prestataire.id} - paymentStatus=$statusUpper -> $statusText');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor, width: 1),
      ),
      child: Text(
        statusText,
        style: TextStyle(
          color: statusColor,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }

  void _showPrestataireDetails(Prestataire prestataire) {
    // Extraire toutes les dates et statuts depuis les données JSON brutes stockées
    // Le backend retourne validationDate, approvalDate, paymentDate, paymentStatus, paymentAmount, approvalStatus
    DateTime? validationDate;
    DateTime? approvalDate;
    DateTime? paymentDate;
    String? paymentStatus;
    double? paymentAmount;
    String? approvalStatus;
    String? validationStatus;

    // Utiliser les données brutes stockées pour accéder aux vraies valeurs
    final rawData = _prestatairesRawData[prestataire.id];
    
    if (rawData != null) {
      // Extraire depuis les colonnes directes de la table (priorité)
      final data = rawData;
      
      // Statut de validation (depuis status ou validation_status)
      validationStatus = data['status']?.toString() ?? 
                        data['validation_status']?.toString();
      
      // Statut d'approbation (depuis approval_status)
      approvalStatus = data['approval_status']?.toString() ?? 
                      data['approvalStatus']?.toString();
      
      // Statut de paiement (depuis payment_status)
      paymentStatus = data['payment_status']?.toString() ?? 
                     data['paymentStatus']?.toString();
      
      // Date de validation (depuis validation_date)
      if (data['validation_date'] != null || data['validationDate'] != null) {
        try {
          final dateStr = data['validation_date']?.toString() ?? data['validationDate']?.toString();
          if (dateStr != null && dateStr.isNotEmpty) {
            validationDate = DateTime.parse(dateStr);
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Date d'approbation (depuis approval_date)
      if (data['approval_date'] != null || data['approvalDate'] != null) {
        try {
          final dateStr = data['approval_date']?.toString() ?? data['approvalDate']?.toString();
          if (dateStr != null && dateStr.isNotEmpty) {
            approvalDate = DateTime.parse(dateStr);
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Date de paiement (depuis payment_date ou paid_at)
      if (data['payment_date'] != null || data['paymentDate'] != null || data['paid_at'] != null) {
        try {
          final dateStr = data['payment_date']?.toString() ?? 
                         data['paymentDate']?.toString() ?? 
                         data['paid_at']?.toString();
          if (dateStr != null && dateStr.isNotEmpty) {
            paymentDate = DateTime.parse(dateStr);
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Montant payé (depuis payment_amount ou amount_to_pay)
      final amountValue = data['payment_amount'] ?? 
                         data['paymentAmount'] ?? 
                         data['amount_to_pay'] ??
                         data['amountToPay'];
      if (amountValue != null) {
        try {
          paymentAmount = (amountValue is num) 
              ? amountValue.toDouble()
              : double.tryParse(amountValue.toString());
        } catch (e) {
          // Ignorer
        }
      }
      
      // Si pas trouvé dans les colonnes directes, chercher dans enregistrementData comme fallback
      if (prestataire.enregistrementData != null) {
        final enregistrementData = prestataire.enregistrementData!;
        
        if (validationStatus == null) {
          validationStatus = enregistrementData['status']?.toString();
        }
        if (approvalStatus == null) {
          approvalStatus = enregistrementData['approvalStatus']?.toString() ?? 
                          enregistrementData['approval_status']?.toString();
        }
        if (paymentStatus == null) {
          paymentStatus = enregistrementData['paymentStatus']?.toString() ?? 
                         enregistrementData['payment_status']?.toString();
        }
        if (validationDate == null) {
          if (enregistrementData['validationDate'] != null || enregistrementData['validation_date'] != null) {
            try {
              final dateStr = enregistrementData['validationDate']?.toString() ?? 
                             enregistrementData['validation_date']?.toString();
              if (dateStr != null && dateStr.isNotEmpty) {
                validationDate = DateTime.parse(dateStr);
              }
            } catch (e) {
              // Ignorer
            }
          }
        }
        if (approvalDate == null) {
          if (enregistrementData['approvalDate'] != null || enregistrementData['approval_date'] != null) {
            try {
              final dateStr = enregistrementData['approvalDate']?.toString() ?? 
                             enregistrementData['approval_date']?.toString();
              if (dateStr != null && dateStr.isNotEmpty) {
                approvalDate = DateTime.parse(dateStr);
              }
            } catch (e) {
              // Ignorer
            }
          }
        }
        if (paymentDate == null) {
          if (enregistrementData['paymentDate'] != null || 
              enregistrementData['payment_date'] != null || 
              enregistrementData['paid_at'] != null) {
            try {
              final dateStr = enregistrementData['paymentDate']?.toString() ?? 
                             enregistrementData['payment_date']?.toString() ?? 
                             enregistrementData['paid_at']?.toString();
              if (dateStr != null && dateStr.isNotEmpty) {
                paymentDate = DateTime.parse(dateStr);
              }
            } catch (e) {
              // Ignorer
            }
          }
        }
        if (paymentAmount == null) {
          final amountValue2 = enregistrementData['paymentAmount'] ?? 
                             enregistrementData['payment_amount'];
          if (amountValue2 != null) {
            try {
              paymentAmount = (amountValue2 is num) 
                  ? amountValue2.toDouble()
                  : double.tryParse(amountValue2.toString());
            } catch (e) {
              // Ignorer
            }
          }
        }
      }
    }

    // Utiliser les statuts réels depuis les données brutes, avec fallback sur le modèle Prestataire
    final finalValidationStatus = validationStatus ?? prestataire.status;
    final finalApprovalStatus = approvalStatus;
    final finalPaymentStatus = paymentStatus;
    
    // Déterminer les textes d'affichage pour les statuts
    String validationStatusText;
    final validationUpper = finalValidationStatus.toUpperCase().trim();
    
    // Si une date de validation existe, le prestataire est validé
    if (validationDate != null) {
      validationStatusText = 'Validé';
    } else if (validationUpper == 'VALIDE_PAR_IT' || 
               validationUpper == 'VALIDE' || 
               validationUpper == 'VALIDATED' ||
               validationUpper == 'VALIDATED_BY_IT') {
      validationStatusText = 'Validé';
    } else if (validationUpper == 'ENREGISTRE' || validationUpper == 'REGISTERED') {
      validationStatusText = 'Enregistré';
    } else {
      validationStatusText = 'Non validé';
    }
    
    print('DEBUG VALIDATION: finalValidationStatus=$finalValidationStatus, validationDate=$validationDate, validationStatusText=$validationStatusText');

    String approvalStatusText;
    if (finalApprovalStatus != null) {
      final approvalUpper = finalApprovalStatus.toUpperCase();
      if (approvalUpper == 'APPROUVE_PAR_MCZ' || approvalUpper == 'APPROUVE' || approvalUpper == 'APPROVED') {
        approvalStatusText = 'Approuvé';
      } else if (approvalUpper == 'EN_ATTENTE_PAR_MCZ' || approvalUpper == 'EN_ATTENTE' || approvalUpper == 'PENDING') {
        approvalStatusText = 'En attente';
      } else if (approvalUpper == 'REJETE' || approvalUpper == 'REJETE_PAR_MCZ' || approvalUpper == 'REJECTED') {
        approvalStatusText = 'Rejeté';
      } else {
        approvalStatusText = 'Non approuvé';
      }
    } else {
      approvalStatusText = 'Non approuvé';
    }

    String paymentStatusText;
    if (finalPaymentStatus != null) {
      final paymentUpper = finalPaymentStatus.toUpperCase().trim();
      if (paymentUpper == 'PAYE' || paymentUpper == 'PAID' || paymentUpper == 'SENT') {
        paymentStatusText = 'Payé';
      } else if (paymentUpper == 'APPROUVE' || paymentUpper == 'APPROUVE_PAR_MCZ' || paymentUpper == 'APPROVED') {
        paymentStatusText = 'Approuvé';
      } else if (paymentUpper == 'EN_ATTENTE' || paymentUpper == 'EN_ATTENTE_PAR_MCZ' || paymentUpper == 'PENDING') {
        paymentStatusText = 'En attente';
      } else {
        paymentStatusText = 'Non payé';
      }
    } else {
      paymentStatusText = 'Non payé';
    }
    
    // Ne pas calculer le montant depuis les jours - utiliser uniquement le montant réellement payé
    // Si pas de montant trouvé, afficher 0

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Détails du prestataire',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ID
              _buildDetailRow('ID', prestataire.id),
              const Divider(),
              
              // Nom complet
              _buildDetailRow(
                'Nom complet',
                '${prestataire.prenom} ${prestataire.nom}${prestataire.postnom != null ? " ${prestataire.postnom}" : ""}',
              ),
              const Divider(),
              
              // Statut de validation
              _buildDetailRow('Statut de validation', validationStatusText),
              if (validationDate != null)
                _buildDetailRow('Date de validation', _formatDate(validationDate)),
              const Divider(),
              
              // Statut d'approbation
              _buildDetailRow('Statut d\'approbation', approvalStatusText),
              if (approvalDate != null)
                _buildDetailRow('Date d\'approbation', _formatDate(approvalDate)),
              const Divider(),
              
              // Statut de paiement
              _buildDetailRow('Statut de paiement', paymentStatusText),
              if (paymentDate != null)
                _buildDetailRow('Date de paiement', _formatDate(paymentDate)),
              // Montant payé (toujours afficher, même si 0)
              _buildDetailRow(
                'Montant payé',
                (paymentAmount != null && paymentAmount! > 0)
                    ? '${paymentAmount!.toStringAsFixed(0)} CDF'
                    : '0 CDF',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Fermer'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _exportReport() async {
    try {
      // Créer le contenu CSV
      final csvContent = StringBuffer();
      
      // En-têtes CSV
      csvContent.writeln('ID;Nom complet;Numéro téléphone;Statut paiement;Montant (CDF);Date paiement');
      
      // Ajouter les données de chaque prestataire
      for (var prestataire in _filteredPrestataires) {
        final fullName = '${prestataire.prenom} ${prestataire.nom}${prestataire.postnom != null ? " ${prestataire.postnom}" : ""}';
        final days = prestataire.presenceDays ?? 0;
        final rate = 10000.0;
        final amount = days * rate;
        
        // Récupérer la date de paiement
        DateTime? paymentDate;
        String paymentDateStr = '';
        if (prestataire.enregistrementData != null) {
          // Essayer payment_date en premier (depuis la table dynamique)
          final paymentDateStrValue = prestataire.enregistrementData!['payment_date'] ?? 
                                      prestataire.enregistrementData!['paymentDate'] ??
                                      prestataire.enregistrementData!['paidAt'];
          if (paymentDateStrValue != null) {
            try {
              paymentDate = DateTime.parse(paymentDateStrValue as String);
              paymentDateStr = _formatDate(paymentDate);
            } catch (e) {
              // Ignorer les erreurs de parsing
            }
          }
        }
        if (paymentDate == null && 
            (prestataire.status == 'APPROUVE_PAR_MCZ' || 
             prestataire.status == 'PAYE' ||
             prestataire.status == 'SENT')) {
          paymentDate = prestataire.updatedAt;
          paymentDateStr = _formatDate(paymentDate);
        }
        
        // Déterminer le statut de paiement
        String paymentStatus = prestataire.status;
        if (paymentStatus == 'APPROUVE_PAR_MCZ') {
          paymentStatus = 'Approuvé';
        } else if (paymentStatus == 'PAYE' || paymentStatus == 'SENT') {
          paymentStatus = 'Payé';
        } else if (paymentStatus == 'EN_ATTENTE_PAR_MCZ') {
          paymentStatus = 'En attente';
        } else if (paymentStatus == 'VALIDE_PAR_IT') {
          paymentStatus = 'Validé';
        } else {
          paymentStatus = 'Enregistré';
        }
        
        // Montant (seulement si payé)
        final amountStr = (paymentStatus == 'Payé' || paymentStatus == 'Approuvé') 
            ? amount.toStringAsFixed(0) 
            : '';
        
        // Échapper les valeurs pour CSV (remplacer les points-virgules et les retours à la ligne)
        String escapeCsv(String value) {
          if (value.contains(';') || value.contains('\n') || value.contains('"')) {
            return '"${value.replaceAll('"', '""')}"';
          }
          return value;
        }
        
        csvContent.writeln(
          '${escapeCsv(prestataire.id)};'
          '${escapeCsv(fullName)};'
          '${escapeCsv(prestataire.telephone ?? 'N/A')};'
          '${escapeCsv(paymentStatus)};'
          '${escapeCsv(amountStr)};'
          '${escapeCsv(paymentDateStr)}'
        );
      }
      
      // Créer un fichier temporaire
      final directory = await getTemporaryDirectory();
      final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-').split('.')[0];
      final file = File('${directory.path}/rapport_paiement_$timestamp.csv');
      await file.writeAsString(csvContent.toString());
      
      // Partager le fichier
      if (mounted) {
        final xFile = XFile(file.path);
        await Share.shareXFiles(
          [xFile],
          text: 'Rapport de paiement - ${DateTime.now().toString().split(' ')[0]}',
          subject: 'Rapport de paiement',
        );
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Rapport exporté avec succès'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de l\'export: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}

