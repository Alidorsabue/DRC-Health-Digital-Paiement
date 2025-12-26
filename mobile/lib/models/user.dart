class User {
  final String id;
  final String username;
  final String? email;
  final String? fullName;
  final String role;
  final String scope;
  final String? provinceId;
  final String? zoneId;
  final String? aireId;

  User({
    required this.id,
    required this.username,
    this.email,
    this.fullName,
    required this.role,
    required this.scope,
    this.provinceId,
    this.zoneId,
    this.aireId,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      fullName: json['fullName'],
      role: json['role'],
      scope: json['scope'],
      provinceId: json['provinceId'],
      zoneId: json['zoneId'],
      aireId: json['aireId'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'fullName': fullName,
      'role': role,
      'scope': scope,
      'provinceId': provinceId,
      'zoneId': zoneId,
      'aireId': aireId,
    };
  }

  bool get isIT => role == 'IT';
  bool get isSuperAdmin => role == 'SUPERADMIN';
}

