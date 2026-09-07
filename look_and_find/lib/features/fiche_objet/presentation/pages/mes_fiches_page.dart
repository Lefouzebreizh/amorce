/// « Mes fiches » : ce que l'application a identifié et retenu.
///
/// **Pourquoi cet écran existe.** Sans lui, une fiche vivait le temps qu'on la
/// regardait et disparaissait à la fermeture. L'identification coûte une
/// requête, une attente et une photo bien cadrée ; la jeter à la sortie oblige
/// à tout repayer pour retrouver ce qu'on savait déjà.
///
/// **Un seul onglet, et c'est une différence assumée avec « Ma liste ».**
/// L'écran des favoris en porte deux parce qu'il répond à deux questions — ce
/// que je surveille, ce que j'ai regardé. La version un n'en a qu'une : ce que
/// j'ai identifié. Un second onglet vide promettrait une fonction qui n'existe
/// pas encore.
///
/// **Le réglage de la clé vit ici**, comme il vivait dans « Ma liste » : une
/// barre de capture à quatre commandes se touche par erreur, et une clé se
/// règle une fois, pas à chaque photo. En redirigeant le viseur vers cet
/// écran-ci, il fallait l'y amener aussi — sans quoi le seul chemin vers la
/// saisie de la clé aurait disparu du parcours.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/async_view.dart';
import '../../../scanner/presentation/pages/api_key_page.dart';
import '../../domain/entities/fiche_objet.dart';
import '../providers/fiches_providers.dart';
import '../widgets/tuile_fiche.dart';
import 'fiche_objet_page.dart';

class MesFichesPage extends ConsumerWidget {
  const MesFichesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fiches = ref.watch(fichesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.fichesTitle),
        actions: [
          IconButton(
            tooltip: AppStrings.settingsKey,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const ApiKeyPage()),
            ),
            icon: const Icon(Icons.key_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      // `render` et non `when` : voir `core/utils/async_view.dart`. Un flux Hive
      // en échec resterait sinon sur l'indicateur de chargement, et la liste
      // tournerait indéfiniment sans jamais dire ce qui bloque.
      body: fiches.render(
        loading: () => const ChargementCentre(),
        error: (error, _) => _Vide(
          icon: Icons.error_outline_rounded,
          titre: AppStrings.errorGeneric,
          corps: error.toString(),
        ),
        data: (liste) => liste.isEmpty
            ? const _Vide(
                icon: Icons.photo_camera_outlined,
                titre: AppStrings.noFiches,
                corps: AppStrings.noFichesBody,
              )
            : _Liste(fiches: liste),
      ),
    );
  }
}

class _Liste extends ConsumerWidget {
  const _Liste({required this.fiches});

  final List<FicheObjet> fiches;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      itemCount: fiches.length,
      separatorBuilder: (_, _) => const Divider(
        height: 1,
        color: AppColors.edge,
      ),
      itemBuilder: (context, index) {
        final fiche = fiches[index];
        return Dismissible(
          // La clé porte l'instant de la prise, comme en base : deux fiches du
          // même objet ne doivent pas partager de clé, sinon en effacer une
          // fait disparaître l'autre de l'écran.
          key: ValueKey(fiche.capturedAt?.toIso8601String() ?? fiche.nom),
          direction: DismissDirection.endToStart,
          background: const _FondSuppression(),
          confirmDismiss: (_) => _confirmer(context),
          onDismissed: (_) =>
              ref.read(fichesRepositoryProvider).supprimer(fiche),
          child: TuileFiche(
            fiche: fiche,
            onOuvrir: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => FicheObjetPage(fiche: fiche),
              ),
            ),
          ),
        );
      },
    );
  }

  /// Le balayage seul ne suffit pas à effacer. Il se déclenche par accident en
  /// faisant défiler d'un pouce, et ce qu'il détruit ici demande une nouvelle
  /// photo et un nouvel appel au modèle pour être retrouvé.
  Future<bool> _confirmer(BuildContext context) async {
    final reponse = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(AppStrings.supprimerFiche),
        content: const Text(AppStrings.supprimerFicheBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(AppStrings.annuler),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(AppStrings.supprimer),
          ),
        ],
      ),
    );
    return reponse ?? false;
  }
}

class _FondSuppression extends StatelessWidget {
  const _FondSuppression();

  @override
  Widget build(BuildContext context) => Container(
    alignment: Alignment.centerRight,
    padding: const EdgeInsets.only(right: 24),
    color: AppColors.alert,
    child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
  );
}

class _Vide extends StatelessWidget {
  const _Vide({required this.icon, required this.titre, required this.corps});

  final IconData icon;
  final String titre;
  final String corps;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: AppColors.muted),
            const SizedBox(height: 18),
            Text(
              titre,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              corps,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
