import 'package:flutter/foundation.dart';
import '../models/form.dart' as model;
import '../models/form_submission.dart';
import '../services/database_service.dart';
import '../services/api_service.dart';

class SubmissionsProvider with ChangeNotifier {
  final DatabaseService _databaseService;
  final ApiService _apiService;
  
  List<FormSubmission> _submissions = [];
  bool _isLoading = false;

  SubmissionsProvider(this._databaseService, this._apiService);

  List<FormSubmission> get submissions => _submissions;
  bool get isLoading => _isLoading;

  List<FormSubmission> getSubmissionsForForm(String formId) {
    return _submissions.where((s) => s.formId == formId).toList();
  }

  Future<void> loadSubmissions(String formId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _submissions = await _databaseService.getSubmissions(formId: formId);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAllSubmissions() async {
    _isLoading = true;
    notifyListeners();

    try {
      _submissions = await _databaseService.getSubmissions();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> submitForm(
    model.FormModel form,
    Map<String, dynamic> data, {
    String? campaignId,
    SubmissionStatus status = SubmissionStatus.pending,
  }) async {
    if (form.publishedVersion == null) {
      throw Exception('Formulaire non publié');
    }

    // Générer l'ID de soumission au nouveau format
    final submissionId = await _databaseService.generateSubmissionId();

    final submission = FormSubmission(
      id: submissionId,
      formId: form.id,
      formVersion: form.publishedVersion!.version,
      campaignId: campaignId,
      data: data,
      status: status,
    );

    await _databaseService.saveSubmission(submission);
    await loadAllSubmissions();
  }

  Future<void> retrySubmission(String submissionId) async {
    final submission = _submissions.firstWhere((s) => s.id == submissionId);
    
    await _databaseService.updateSubmissionStatus(
      submissionId,
      SubmissionStatus.pending,
    );
    
    await loadAllSubmissions();
  }

  Future<int> getPendingCount() async {
    return await _databaseService.getPendingSubmissionsCount();
  }
}

