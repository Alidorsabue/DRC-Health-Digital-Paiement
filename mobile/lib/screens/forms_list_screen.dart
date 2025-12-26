import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/form.dart' as model;
import '../models/form_submission.dart';
import '../providers/forms_provider.dart';
import '../providers/submissions_provider.dart';
import '../screens/form_fill_screen.dart';
import '../screens/settings_screen.dart';
import 'drafts_screen.dart';
import 'ready_to_send_screen.dart';
import 'sent_submissions_screen.dart';
import 'sent_submissions_list_screen.dart';
import 'form_selection_screen.dart';
import 'kyc_screen.dart';
import 'modify_prestataire_screen.dart';
import 'validation_report_screen.dart' show ApprovalReportScreen;
import 'payment_report_screen.dart';

class FormsListScreen extends StatefulWidget {
  const FormsListScreen({super.key});

  @override
  State<FormsListScreen> createState() => _FormsListScreenState();
}

class _FormsListScreenState extends State<FormsListScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
      // Synchroniser automatiquement en arrière-plan
      _performAutoSync();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // Synchroniser quand l'application revient au premier plan
    if (state == AppLifecycleState.resumed) {
      _performAutoSync();
    }
  }

  Future<void> _loadData() async {
    final formsProvider = Provider.of<FormsProvider>(context, listen: false);
    final submissionsProvider = Provider.of<SubmissionsProvider>(context, listen: false);
    
    await formsProvider.loadForms();
    await submissionsProvider.loadAllSubmissions();
  }

  Future<void> _performAutoSync() async {
    try {
      final formsProvider = Provider.of<FormsProvider>(context, listen: false);
      // Synchroniser silencieusement en arrière-plan
      await formsProvider.refreshForms();
      // Recharger les données après synchronisation
      if (mounted) {
        await _loadData();
      }
    } catch (e) {
      // Ignorer les erreurs silencieusement pour la synchronisation automatique
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'DRC Digit Payment',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person, size: 28),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
            tooltip: 'Paramètres',
          ),
        ],
      ),
      body: Consumer2<FormsProvider, SubmissionsProvider>(
        builder: (context, formsProvider, submissionsProvider, child) {
          // Compter les ébauches (draft)
          final draftsCount = submissionsProvider.submissions
              .where((s) => s.status == SubmissionStatus.draft)
              .length;
          // Compter les prêts à envoyer (pending)
          final readyToSendCount = submissionsProvider.submissions
              .where((s) => s.status == SubmissionStatus.pending)
              .length;
          // Compter les envoyés (synced)
          final sentCount = submissionsProvider.submissions
              .where((s) => s.status == SubmissionStatus.synced)
              .length;

          return Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFF121212),
                  Color(0xFF1A1A1A),
                ],
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 20,
                mainAxisSpacing: 20,
                childAspectRatio: 0.85,
                children: [
                // 1. Enregistrer Prestataire
                _buildGridButton(
                  context: context,
                  icon: Icons.person_add,
                  iconColor: Colors.white,
                  backgroundColor: Colors.brown.shade700,
                  title: 'Enregistrer\nPrestataire',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const FormSelectionScreen(),
                      ),
                    );
                  },
                ),
                
                // 2. KYC
                _buildGridButton(
                  context: context,
                  icon: Icons.verified_user,
                  iconColor: Colors.white,
                  backgroundColor: Colors.grey.shade600,
                  title: 'KYC',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const KYCScreen(),
                      ),
                    );
                  },
                ),
                
                // 3. Modifier un prestataire
                _buildGridButton(
                  context: context,
                  icon: Icons.edit,
                  iconColor: Colors.white,
                  backgroundColor: Colors.brown.shade700,
                  title: 'Modifier un\nprestataire',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ModifyPrestataireScreen(),
                      ),
                    );
                  },
                ),
                
                // 4. Valider présence
                _buildGridButton(
                  context: context,
                  icon: Icons.people,
                  iconColor: Colors.white,
                  backgroundColor: Colors.brown.shade700,
                  title: 'Valider\nprésence',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SentSubmissionsScreen(),
                      ),
                    );
                  },
                ),
                
                // 5. Rapport de Validation
                _buildGridButton(
                  context: context,
                  icon: Icons.assignment,
                  iconColor: Colors.white,
                  backgroundColor: Colors.grey.shade600,
                  title: 'Rapport de\nValidation',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ApprovalReportScreen(),
                      ),
                    );
                  },
                ),
                
                // 6. Rapport de Paiement
                _buildGridButton(
                  context: context,
                  icon: Icons.payment,
                  iconColor: Colors.white,
                  backgroundColor: Colors.green.shade700,
                  title: 'Rapport de\nPaiement',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const PaymentReportScreen(),
                      ),
                    );
                  },
                ),
                ],
              ),
            ),
          );
              
        },
      ),
    );
  }

  Widget _buildGridButton({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required Color backgroundColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                backgroundColor,
                backgroundColor.withOpacity(0.8),
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: backgroundColor.withOpacity(0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  color: iconColor,
                  size: 40,
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: iconColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
