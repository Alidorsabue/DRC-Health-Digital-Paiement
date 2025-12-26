class FormSubmission {
  final String? id;
  final String formId;
  final int formVersion;
  final String? campaignId;
  final Map<String, dynamic> data; // Peut être vide pour les listes (données chargées à la demande)
  final SubmissionStatus status;
  final DateTime createdAt;
  final DateTime? syncedAt;
  final String? errorMessage;

  FormSubmission({
    this.id,
    required this.formId,
    required this.formVersion,
    this.campaignId,
    Map<String, dynamic>? data,
    this.status = SubmissionStatus.pending,
    DateTime? createdAt,
    this.syncedAt,
    this.errorMessage,
  }) : data = data ?? {},
       createdAt = createdAt ?? DateTime.now();

  factory FormSubmission.fromJson(Map<String, dynamic> json) {
    return FormSubmission(
      id: json['id'],
      formId: json['formId'],
      formVersion: json['formVersion'],
      campaignId: json['campaignId'],
      data: json['data'] as Map<String, dynamic>,
      status: SubmissionStatus.values.firstWhere(
        (e) => e.toString().split('.').last == json['status'],
        orElse: () => SubmissionStatus.pending,
      ),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      syncedAt: json['syncedAt'] != null ? DateTime.parse(json['syncedAt']) : null,
      errorMessage: json['errorMessage'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'formId': formId,
      'formVersion': formVersion,
      'campaignId': campaignId,
      'data': data,
      'status': status.toString().split('.').last,
      'createdAt': createdAt.toIso8601String(),
      'syncedAt': syncedAt?.toIso8601String(),
      'errorMessage': errorMessage,
    };
  }

  FormSubmission copyWith({
    String? id,
    String? formId,
    int? formVersion,
    String? campaignId,
    Map<String, dynamic>? data,
    SubmissionStatus? status,
    DateTime? createdAt,
    DateTime? syncedAt,
    String? errorMessage,
  }) {
    return FormSubmission(
      id: id ?? this.id,
      formId: formId ?? this.formId,
      formVersion: formVersion ?? this.formVersion,
      campaignId: campaignId ?? this.campaignId,
      data: data ?? this.data,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

enum SubmissionStatus {
  draft,
  pending,
  syncing,
  synced,
  error,
}

