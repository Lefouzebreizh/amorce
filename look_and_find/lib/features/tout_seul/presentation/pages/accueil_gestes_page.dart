/// L'écran d'accueil de *Tout seul* : les dix-sept gestes, en images.
///
/// **Une grille et pas une liste.** Une liste de dix-sept lignes de texte est
/// illisible pour quelqu'un qui ne lit pas : elle se parcourt de haut en bas,
/// un mot à la fois, et c'est exactement le geste qu'on ne peut pas demander
/// ici. Une grille d'images se balaie du regard, et l'enfant reconnaît sa
/// basket sans avoir à traverser les seize autres.
///
/// **Deux colonnes, jamais trois.** Sur le terrain de référence (393 dp de
/// large), trois colonnes donnent des tuiles de 110 dp : l'émoji descend sous
/// 44 dp et la vignette cesse d'être reconnaissable à bout de bras. La grille
/// se règle donc sur une largeur maximale de tuile, ce qui donne deux colonnes
/// sur un téléphone et davantage sur une tablette, sans jamais rétrécir la
/// vignette.
///
/// **Aucun ordre alphabétique.** Le corpus suit à peu près la journée d'un
/// enfant, et c'est le seul ordre qu'il puisse anticiper — trier par nom
/// supposerait de savoir lire les noms.
///
/// **La voix entre par le constructeur.** Cet écran ne la fait pas parler, mais
/// il la transmet à l'écran du geste : c'est ce qui garde `VoixSysteme` dans le
/// seul point d'entrée et rend toute la présentation vérifiable avec une
/// fausse voix. Voir `voix.dart` pour la raison complète.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../domain/corpus/corpus_gestes.dart';
import '../../domain/entities/geste.dart';
import '../../domain/voix.dart';
import '../mots_enfant.dart';
import '../widgets/tuile_geste.dart';
import 'geste_page.dart';

class AccueilGestesPage extends StatelessWidget {
  const AccueilGestesPage({super.key, required this.voix});

  final Voix voix;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // `SafeArea` est ici l'équivalent du `100dvh` du dépôt : c'est lui qui
      // retire l'encoche en haut et la barre de gestes en bas, dont la hauteur
      // change d'un téléphone à l'autre. Une hauteur d'écran prise brute
      // laisserait la dernière rangée de tuiles sous la barre système.
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    MotsEnfant.titre,
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    MotsEnfant.choisir,
                    style: TextStyle(fontSize: 18, color: AppColors.muted),
                  ),
                ],
              ),
            ),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                gridDelegate:
                    const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 240,
                  mainAxisExtent: hauteurTuile,
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 14,
                ),
                itemCount: CorpusGestes.gestes.length,
                itemBuilder: (context, rang) {
                  final geste = CorpusGestes.gestes[rang];
                  return TuileGeste(
                    geste: geste,
                    onTouche: () => Navigator.of(context).push(
                      _routeVers(context, geste),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Un fondu, et rien quand l'appareil demande moins d'animations.
  ///
  /// Le glissement latéral par défaut de Material déplace tout l'écran : à cet
  /// âge, un enfant suit le mouvement du doigt et perd la cible. Le fondu ne
  /// déplace rien. Et `disableAnimations` — le `prefers-reduced-motion` du
  /// dépôt, réglé dans l'accessibilité du système — le supprime tout à fait :
  /// une transition n'est jamais une information ici, elle ne coûte donc rien
  /// à retirer.
  Route<void> _routeVers(BuildContext context, Geste geste) {
    final sansAnimation = MediaQuery.disableAnimationsOf(context);
    final duree =
        sansAnimation ? Duration.zero : const Duration(milliseconds: 200);

    return PageRouteBuilder<void>(
      transitionDuration: duree,
      reverseTransitionDuration: duree,
      pageBuilder: (context, animation, animationSecondaire) =>
          GestePage(geste: geste, voix: voix),
      transitionsBuilder:
          (context, animation, animationSecondaire, enfant) => sansAnimation
              ? enfant
              : FadeTransition(opacity: animation, child: enfant),
    );
  }
}
