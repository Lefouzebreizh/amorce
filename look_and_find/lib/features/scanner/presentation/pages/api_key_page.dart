/// Saisie de la clé Gemini.
///
/// Cet écran existe pour que l'APK distribué n'ait pas à porter de clé. Il est
/// aussi le seul endroit d'où l'on peut réagir à une clé fuitée sans
/// reconstruire l'application.
///
/// Il dit **où** obtenir une clé plutôt que de supposer que l'utilisateur le
/// sait : sans cette phrase, l'écran est une impasse polie pour qui n'a jamais
/// ouvert Google AI Studio.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_config.dart';
import '../../../../core/utils/extensions.dart';
import '../providers/scanner_providers.dart';

class ApiKeyPage extends ConsumerStatefulWidget {
  const ApiKeyPage({super.key});

  @override
  ConsumerState<ApiKeyPage> createState() => _ApiKeyPageState();
}

class _ApiKeyPageState extends ConsumerState<ApiKeyPage> {
  final _controleur = TextEditingController();

  /// La clé est masquée par défaut, comme un mot de passe : on la saisit
  /// souvent devant quelqu'un, et elle se colle depuis le presse-papier sans
  /// avoir besoin d'être lue.
  bool _masquee = true;
  bool _enCours = false;

  @override
  void dispose() {
    _controleur.dispose();
    super.dispose();
  }

  Future<void> _enregistrer() async {
    final valeur = _controleur.text.trim();
    if (valeur.isEmpty) return;

    setState(() => _enCours = true);
    await ref.read(geminiApiKeyProvider.notifier).save(valeur);
    if (!mounted) return;

    setState(() => _enCours = false);
    context.snack('Clé enregistrée sur cet appareil.');
    Navigator.of(context).pop();
  }

  Future<void> _oublier() async {
    await ref.read(geminiApiKeyProvider.notifier).forget();
    if (!mounted) return;
    _controleur.clear();
    context.snack(
      AppConfig.compiledApiKey.isEmpty
          ? 'Clé effacée. L\'identification est de nouveau indisponible.'
          : 'Clé effacée. Celle fournie au build reprend la main.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final cleActive = ref.watch(geminiApiKeyProvider);
    final saisieRangee = ref.watch(apiKeyStoreProvider).read() != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Clé Gemini')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          _Etat(cleActive: cleActive, saisieRangee: saisieRangee),
          const SizedBox(height: 24),

          TextField(
            controller: _controleur,
            obscureText: _masquee,
            autocorrect: false,
            enableSuggestions: false,
            decoration: InputDecoration(
              labelText: 'Coller votre clé',
              hintText: 'AIza…',
              filled: true,
              fillColor: AppColors.slab,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              suffixIcon: IconButton(
                tooltip: _masquee ? 'Afficher' : 'Masquer',
                onPressed: () => setState(() => _masquee = !_masquee),
                icon: Icon(
                  _masquee
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
            ),
            onSubmitted: (_) => _enregistrer(),
          ),
          const SizedBox(height: 16),

          FilledButton(
            onPressed: _enCours ? null : _enregistrer,
            child: Text(_enCours ? 'Enregistrement…' : 'Enregistrer'),
          ),
          if (saisieRangee) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: _oublier,
              child: const Text('Effacer la clé de cet appareil'),
            ),
          ],

          const SizedBox(height: 28),
          Text('Obtenir une clé', style: context.texts.titleMedium),
          const SizedBox(height: 8),
          Text(
            'Une clé Gemini se crée gratuitement sur Google AI Studio. '
            'L\'identification d\'un objet consomme un appel par photo.',
            style: context.texts.bodySmall,
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => launchUrl(
              Uri.parse('https://aistudio.google.com/apikey'),
              mode: LaunchMode.externalApplication,
            ),
            icon: const Icon(Icons.open_in_new_rounded, size: 18),
            label: const Text('Ouvrir Google AI Studio'),
          ),

          const SizedBox(height: 28),
          Text('Où elle est rangée', style: context.texts.titleMedium),
          const SizedBox(height: 8),
          Text(
            'Dans le stockage privé de l\'application, sur ce téléphone '
            'uniquement. Elle n\'est envoyée qu\'à Google, au moment d\'une '
            'identification, et n\'est pas incluse dans les sauvegardes '
            'automatiques. Un appareil débridé pourrait la lire : en cas de '
            'doute, révoquez-la depuis Google AI Studio.',
            style: context.texts.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _Etat extends StatelessWidget {
  const _Etat({required this.cleActive, required this.saisieRangee});

  final String cleActive;
  final bool saisieRangee;

  @override
  Widget build(BuildContext context) {
    final (icone, couleur, titre, detail) = switch ((
      cleActive.isNotEmpty,
      saisieRangee,
    )) {
      (true, true) => (
        Icons.check_circle_outline_rounded,
        AppColors.gain,
        'Clé enregistrée sur cet appareil',
        'Elle remplace celle fournie au build.',
      ),
      (true, false) => (
        Icons.info_outline_rounded,
        AppColors.muted,
        'Clé fournie au build',
        'Elle fonctionne, mais elle est lisible dans le binaire. En saisir '
            'une ici la remplacera.',
      ),
      _ => (
        Icons.key_off_rounded,
        AppColors.warn,
        'Aucune clé',
        'L\'identification d\'objet est indisponible tant qu\'aucune clé '
            'n\'est fournie.',
      ),
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.slab,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icone, color: couleur),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titre, style: context.texts.titleMedium),
                const SizedBox(height: 4),
                Text(detail, style: context.texts.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
