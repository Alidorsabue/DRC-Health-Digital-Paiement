import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../models/form.dart' as form_models;
import '../models/form_submission.dart';
import '../models/campaign.dart';
import 'api_service.dart';
import 'database_service.dart';

class SyncService {
  final ApiService _apiService;
  final DatabaseService _databaseService;
  final Connectivity _connectivity = Connectivity();

  SyncService(this._apiService, this._databaseService);

  Future<bool> isConnected() async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  Future<SyncResult> syncAll({bool force = false}) async {
    if (!force && !await isConnected()) {
      return SyncResult(
        success: false,
        message: 'Pas de connexion internet',
        downloadedForms: 0,
        downloadedCampaigns: 0,
        syncedSubmissions: 0,
        failedSubmissions: 0,
      );
    }

    try {
      // 1. Télécharger les formulaires et campagnes
      final syncResponse = await _apiService.sync(
        downloadForms: true,
        downloadCampaigns: true,
        downloadPrestataires: false,
      );

      int downloadedForms = 0;
      int downloadedCampaigns = 0;

      // Sauvegarder les formulaires (même si la liste est vide, cela supprimera les formulaires locaux)
      final formsData = syncResponse['downloaded']?['forms'] as List? ?? [];
      final forms = <form_models.FormModel>[];
      final versions = <form_models.FormVersion>[];
      
      for (var formData in formsData) {
        // Convertir latestVersion en publishedVersion pour FormModel.fromJson
        final formJson = Map<String, dynamic>.from(formData);
        if (formData['latestVersion'] != null) {
          formJson['publishedVersion'] = formData['latestVersion'];
          formJson['versions'] = [formData['latestVersion']];
          final version = form_models.FormVersion.fromJson(formData['latestVersion']);
          versions.add(version);
        } else {
          formJson['versions'] = [];
        }
        
        // Ajouter createdAt et updatedAt si manquants
        if (!formJson.containsKey('createdAt')) {
          formJson['createdAt'] = DateTime.now().toIso8601String();
        }
        if (!formJson.containsKey('updatedAt')) {
          formJson['updatedAt'] = DateTime.now().toIso8601String();
        }
        
        forms.add(form_models.FormModel.fromJson(formJson));
      }
      
      // Obtenir les formulaires existants avant la synchronisation pour détecter les suppressions
      final existingFormsBeforeSync = await _databaseService.getForms();
      final existingFormIdsBeforeSync = existingFormsBeforeSync.map((f) => f.id).toSet();
      
      // Sauvegarder les formulaires (cela supprimera automatiquement ceux qui ne sont plus sur le serveur)
      await _databaseService.saveForms(forms, versions);
      downloadedForms = forms.length;

      // Sauvegarder les campagnes (même si la liste est vide, cela supprimera les campagnes locales)
      final campaignsData = syncResponse['downloaded']?['campaigns'] as List? ?? [];
      final campaigns = campaignsData
          .map((c) => Campaign.fromJson(c))
          .toList();
      // Sauvegarder les campagnes (cela supprimera automatiquement celles qui ne sont plus sur le serveur)
      await _databaseService.saveCampaigns(campaigns);
      downloadedCampaigns = campaigns.length;

      // 2. Synchroniser les soumissions en attente
      // Charger seulement les métadonnées pour éviter "Row too big"
      final pendingSubmissions = await _databaseService.getSubmissions(
        status: SubmissionStatus.pending,
        includeData: false,
      );

      int syncedCount = 0;
      int failedCount = 0;

      for (var submission in pendingSubmissions) {
        try {
          // Charger les données complètes pour cette soumission
          final submissionWithData = await _databaseService.getSubmissionWithData(submission.id!);
          if (submissionWithData == null) {
            continue;
          }

          // Mettre à jour le statut à "syncing"
          await _databaseService.updateSubmissionStatus(
            submission.id!,
            SubmissionStatus.syncing,
          );

          // Soumettre au serveur
          final response = await _apiService.submitForm(
            submissionWithData.formId,
            submissionWithData.data,
            campaignId: submissionWithData.campaignId,
          );

          // Le backend retourne un submissionId au nouveau format
          // Mettre à jour l'ID local avec celui retourné par le backend si différent
          final backendSubmissionId = response['submissionId'] as String?;
          String submissionIdToUse = submission.id!;
          
          if (backendSubmissionId != null && backendSubmissionId != submission.id) {
            // Mettre à jour l'ID de la soumission avec celui du backend
            await _databaseService.updateSubmissionId(
              submission.id!,
              backendSubmissionId,
            );
            submissionIdToUse = backendSubmissionId;
          }

          // Marquer comme synchronisé (utiliser le nouvel ID si mis à jour)
          await _databaseService.updateSubmissionStatus(
            submissionIdToUse,
            SubmissionStatus.synced,
          );
          syncedCount++;
        } catch (e) {
          // Marquer comme erreur
          await _databaseService.updateSubmissionStatus(
            submission.id!,
            SubmissionStatus.error,
            errorMessage: e.toString(),
          );
          failedCount++;
        }
      }

      // Calculer le nombre de formulaires supprimés
      final existingFormsAfterSync = await _databaseService.getForms();
      final existingFormIdsAfterSync = existingFormsAfterSync.map((f) => f.id).toSet();
      final deletedFormsCount = existingFormIdsBeforeSync.difference(existingFormIdsAfterSync).length;
      
      String syncMessage = 'Synchronisation terminée';
      if (deletedFormsCount > 0) {
        syncMessage += '. $deletedFormsCount formulaire(s) retiré(s)';
      }
      
      return SyncResult(
        success: true,
        message: syncMessage,
        downloadedForms: downloadedForms,
        downloadedCampaigns: downloadedCampaigns,
        syncedSubmissions: syncedCount,
        failedSubmissions: failedCount,
        deletedForms: deletedFormsCount,
      );
    } catch (e) {
      return SyncResult(
        success: false,
        message: 'Erreur lors de la synchronisation: ${e.toString()}',
        downloadedForms: 0,
        downloadedCampaigns: 0,
        syncedSubmissions: 0,
        failedSubmissions: 0,
        deletedForms: 0,
      );
    }
  }

  Future<SyncResult> syncPendingSubmissions() async {
    if (!await isConnected()) {
      return SyncResult(
        success: false,
        message: 'Pas de connexion internet',
        downloadedForms: 0,
        downloadedCampaigns: 0,
        syncedSubmissions: 0,
        failedSubmissions: 0,
        deletedForms: 0,
      );
    }

    try {
      // Synchroniser uniquement les soumissions en attente
      // Charger seulement les métadonnées pour éviter "Row too big"
      final pendingSubmissions = await _databaseService.getSubmissions(
        status: SubmissionStatus.pending,
        includeData: false,
      );

      int syncedCount = 0;
      int failedCount = 0;

      for (var submission in pendingSubmissions) {
        try {
          // Charger les données complètes pour cette soumission
          final submissionWithData = await _databaseService.getSubmissionWithData(submission.id!);
          if (submissionWithData == null) {
            continue;
          }

          // Mettre à jour le statut à "syncing"
          await _databaseService.updateSubmissionStatus(
            submission.id!,
            SubmissionStatus.syncing,
          );

          // Soumettre au serveur
          final response = await _apiService.submitForm(
            submissionWithData.formId,
            submissionWithData.data,
            campaignId: submissionWithData.campaignId,
          );

          // Le backend retourne un submissionId au nouveau format
          // Mettre à jour l'ID local avec celui retourné par le backend si différent
          final backendSubmissionId = response['submissionId'] as String?;
          String submissionIdToUse = submission.id!;
          
          if (backendSubmissionId != null && backendSubmissionId != submission.id) {
            // Mettre à jour l'ID de la soumission avec celui du backend
            await _databaseService.updateSubmissionId(
              submission.id!,
              backendSubmissionId,
            );
            submissionIdToUse = backendSubmissionId;
          }

          // Marquer comme synchronisé (utiliser le nouvel ID si mis à jour)
          await _databaseService.updateSubmissionStatus(
            submissionIdToUse,
            SubmissionStatus.synced,
          );
          syncedCount++;
        } catch (e) {
          // Marquer comme erreur
          await _databaseService.updateSubmissionStatus(
            submission.id!,
            SubmissionStatus.error,
            errorMessage: e.toString(),
          );
          failedCount++;
        }
      }

      return SyncResult(
        success: true,
        message: 'Synchronisation terminée',
        downloadedForms: 0,
        downloadedCampaigns: 0,
        syncedSubmissions: syncedCount,
        failedSubmissions: failedCount,
        deletedForms: 0,
      );
    } catch (e) {
      return SyncResult(
        success: false,
        message: 'Erreur lors de la synchronisation: ${e.toString()}',
        downloadedForms: 0,
        downloadedCampaigns: 0,
        syncedSubmissions: 0,
        failedSubmissions: 0,
        deletedForms: 0,
      );
    }
  }

  Future<void> syncForm(String formId) async {
    if (!await isConnected()) {
      throw Exception('Pas de connexion internet');
    }

    try {
      final form = await _apiService.getForm(formId);
      if (form.publishedVersion != null) {
        await _databaseService.saveForm(form, form.publishedVersion!);
      }
    } catch (e) {
      throw Exception('Erreur lors de la synchronisation du formulaire: $e');
    }
  }
}

class SyncResult {
  final bool success;
  final String message;
  final int downloadedForms;
  final int downloadedCampaigns;
  final int syncedSubmissions;
  final int failedSubmissions;
  final int deletedForms;

  SyncResult({
    required this.success,
    required this.message,
    required this.downloadedForms,
    required this.downloadedCampaigns,
    required this.syncedSubmissions,
    required this.failedSubmissions,
    this.deletedForms = 0,
  });
}

