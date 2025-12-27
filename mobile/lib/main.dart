import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'config/app_config.dart';
import 'services/api_service.dart';
import 'services/database_service.dart';
import 'services/sync_service.dart';
import 'services/auth_service.dart';
import 'providers/auth_provider.dart';
import 'providers/forms_provider.dart';
import 'providers/submissions_provider.dart';
import 'providers/sync_provider.dart';
import 'utils/network_utils.dart';
import 'screens/login_screen.dart';
import 'screens/forms_list_screen.dart';
import 'widgets/auto_sync_widget.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialiser les services
  final prefs = await SharedPreferences.getInstance();
  final apiService = ApiService(); // Singleton
  
  // En production, utiliser directement l'URL de production
  // En développement, détecter automatiquement l'IP
  String apiUrl;
  
  if (AppConfig.isProduction) {
    // Mode production : utiliser uniquement l'URL de production
    apiUrl = AppConfig.productionApiUrl;
    // Nettoyer l'URL sauvegardée si elle contient /api (ancienne configuration)
    final savedUrl = prefs.getString('api_url');
    if (savedUrl != null && savedUrl.contains('/api')) {
      // Supprimer /api de l'URL si présent
      final cleanedUrl = savedUrl.replaceAll('/api', '').replaceAll(RegExp(r'/+$'), '');
      if (cleanedUrl != savedUrl) {
        await prefs.setString('api_url', cleanedUrl);
      }
    }
    await prefs.setString('api_url', apiUrl);
  } else {
    // Mode développement : détecter automatiquement l'IP
    final savedUrl = prefs.getString('api_url');
    
    if (savedUrl != null && savedUrl.isNotEmpty) {
      // Vérifier que l'URL sauvegardée fonctionne encore
      try {
        final isWorking = await NetworkUtils.testConnection(savedUrl).timeout(
          const Duration(seconds: 5),
          onTimeout: () => false,
        );
        if (isWorking) {
          apiUrl = savedUrl;
        } else {
          // L'URL sauvegardée ne fonctionne plus, détecter automatiquement (mode rapide)
          final detectedUrl = await NetworkUtils.detectWorkingIP(quickMode: true).timeout(
            const Duration(seconds: 15),
            onTimeout: () => null,
          );
          apiUrl = detectedUrl ?? NetworkUtils.getApiUrl();
          if (detectedUrl != null) {
            await prefs.setString('api_url', detectedUrl);
          }
        }
      } catch (e) {
        // En cas d'erreur, utiliser l'URL par défaut
        apiUrl = NetworkUtils.getApiUrl();
      }
    } else {
      // Détecter automatiquement l'IP qui fonctionne (mode rapide pour éviter blocage)
      try {
        final detectedUrl = await NetworkUtils.detectWorkingIP(quickMode: true).timeout(
          const Duration(seconds: 15),
          onTimeout: () => null,
        );
        apiUrl = detectedUrl ?? NetworkUtils.getApiUrl();
        if (detectedUrl != null) {
          await prefs.setString('api_url', detectedUrl);
        }
      } catch (e) {
        // En cas d'erreur, utiliser l'URL par défaut
        apiUrl = NetworkUtils.getApiUrl();
      }
    }
  }
  
  apiService.setBaseUrl(apiUrl);
  
  final databaseService = DatabaseService();
  final authService = AuthService(apiService);
  final syncService = SyncService(apiService, databaseService);
  
  // Exécuter la migration des IDs de soumission une seule fois
  // Pour forcer la réexécution, supprimer la clé 'submission_ids_migrated' dans SharedPreferences
  final migrationDone = prefs.getBool('submission_ids_migrated');
  final forceMigration = prefs.getBool('force_migration_ids') ?? false;
  
  if (migrationDone != true || forceMigration) {
    try {
      print('=== DÉMARRAGE DE LA MIGRATION DES IDs DE SOUMISSION ===');
      if (forceMigration) {
        print('=== MIGRATION FORCÉE ===');
        await prefs.remove('force_migration_ids');
      }
      final migratedCount = await databaseService.migrateSubmissionIds();
      await prefs.setBool('submission_ids_migrated', true);
      print('=== MIGRATION TERMINÉE: $migratedCount soumissions migrées ===');
    } catch (e, stackTrace) {
      print('=== ERREUR LORS DE LA MIGRATION DES IDs ===');
      print('Erreur: $e');
      print('Stack trace: $stackTrace');
      // Continuer même si la migration échoue
    }
  } else {
    print('Migration des IDs déjà effectuée (ignorée). Pour forcer: prefs.setBool("force_migration_ids", true)');
  }
  
  // Vérifier si l'utilisateur est déjà connecté
  final isAuthenticated = await authService.isAuthenticated();
  
  runApp(MyApp(
    apiService: apiService,
    databaseService: databaseService,
    authService: authService,
    syncService: syncService,
    initialRoute: isAuthenticated ? '/forms' : '/login',
  ));
}

class MyApp extends StatelessWidget {
  final ApiService apiService;
  final DatabaseService databaseService;
  final AuthService authService;
  final SyncService syncService;
  final String initialRoute;

  const MyApp({
    super.key,
    required this.apiService,
    required this.databaseService,
    required this.authService,
    required this.syncService,
    required this.initialRoute,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(authService),
        ),
        ChangeNotifierProvider(
          create: (_) => FormsProvider(databaseService, apiService, syncService),
        ),
        ChangeNotifierProvider(
          create: (_) => SubmissionsProvider(databaseService, apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => SyncProvider(syncService),
        ),
      ],
      child: AutoSyncWidget(
        child: MaterialApp(
          title: 'DRC Digit Payment',
          debugShowCheckedModeBanner: false,
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('fr', 'FR'),
            Locale('en', 'US'),
          ],
          locale: const Locale('fr', 'FR'),
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: Colors.blue,
              brightness: Brightness.dark,
            ),
            useMaterial3: true,
            scaffoldBackgroundColor: const Color(0xFF121212),
            cardTheme: CardThemeData(
              elevation: 4,
              color: const Color(0xFF1E1E1E),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            appBarTheme: const AppBarTheme(
              backgroundColor: Color(0xFF1E1E1E),
              foregroundColor: Colors.white,
              elevation: 0,
              centerTitle: true,
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFF2C2C2C),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.blue, width: 2),
              ),
            ),
            textTheme: const TextTheme(
              bodyLarge: TextStyle(color: Colors.white),
              bodyMedium: TextStyle(color: Colors.white70),
              bodySmall: TextStyle(color: Colors.white60),
            ),
          ),
          initialRoute: initialRoute,
          routes: {
            '/login': (_) => const LoginScreen(),
            '/forms': (_) => const FormsListScreen(),
          },
        ),
      ),
    );
  }
}
