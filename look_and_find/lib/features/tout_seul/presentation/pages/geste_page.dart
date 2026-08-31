/// L'écran d'un geste : **une étape à l'écran, et une seule**.
///
/// C'est la décision qui commande tout ce fichier, et elle mérite d'être
/// justifiée parce qu'elle paraît coûteuse — dix-sept gestes, cinq à sept
/// étapes, et jamais de vue d'ensemble.
///
/// Un enfant de cinq ans qui voit six phrases en voit une seule : la première,
/// ou celle du milieu, au hasard. Il ne sait pas qu'une liste se lit dans un
/// ordre, et surtout il ne peut pas retenir sa place puisqu'il ne peut pas
/// relire. Afficher les six étapes revient donc à n'en afficher aucune, tout en
/// donnant à l'adulte l'impression rassurante d'une notice complète.
///
/// Trois conséquences, toutes vérifiées par `geste_page_test.dart` :
///
/// 1. **Une seule phrase est montée à la fois.** Pas masquée, pas repliée :
///    absente de l'arbre. Une étape hors écran mais construite finirait par
///    réapparaître à la première erreur de mise en page.
/// 2. **La phrase est dite à l'arrivée**, sans que l'enfant demande. Il n'y a
///    pas de bouton « écouter » : un bouton qu'il faut savoir trouver pour
///    accéder au seul canal qu'on sait lire est un bouton qui exclut.
/// 3. **Revenir en arrière redit la phrase.** Le retour n'existe que pour
///    réentendre : sans la voix, il ramène à un écran muet, c'est-à-dire à rien.
///
/// **Le grand bouton est en bas**, dans la zone du pouce, et il fait 96 dp de
/// haut — le double de la règle du dépôt, qui vise un adulte. Le retour et la
/// sortie sont volontairement plus petits et plus loin : ce sont les gestes
/// qu'on ne veut pas déclencher par accident en visant « suivant ».
///
/// **La dernière étape n'a pas de suivante.** Le bouton change alors de mot et
/// ramène à la grille. Un bouton qui reste et ne fait rien apprend à l'enfant
/// que l'écran est cassé ; un bouton qui disparaît le laisse sans issue.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../domain/entities/geste.dart';
import '../../domain/voix.dart';
import '../emojis.dart';
import '../mots_enfant.dart';
import '../theme_enfant.dart';

class GestePage extends StatefulWidget {
  const GestePage({super.key, required this.geste, required this.voix});

  final Geste geste;

  /// Le port du domaine, jamais l'adaptateur : `VoixSysteme` n'est construite
  /// que dans `main_tout_seul.dart`.
  final Voix voix;

  @override
  State<GestePage> createState() => _GestePageState();
}

class _GestePageState extends State<GestePage> {
  int _rang = 0;

  @override
  void initState() {
    super.initState();
    // Dite dès l'arrivée, avant tout geste de l'enfant. C'est le seul canal
    // qu'il sait lire ; le laisser silencieux jusqu'à un appui reviendrait à
    // afficher un écran vide.
    _dire();
  }

  @override
  void dispose() {
    // Couper en partant. Sans cela, la dernière étape continue d'être dite
    // par-dessus la grille d'accueil, et l'enfant croit que le geste continue.
    unawaited(widget.voix.taire());
    super.dispose();
  }

  void _dire() => unawaited(widget.voix.dire(widget.geste.etapes[_rang].phrase));

  bool get _derniere => _rang == widget.geste.etapes.length - 1;

  void _suivant() {
    if (_derniere) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() => _rang++);
    _dire();
  }

  void _precedent() {
    if (_rang == 0) return;
    setState(() => _rang--);
    _dire();
  }

  @override
  Widget build(BuildContext context) {
    final etape = widget.geste.etapes[_rang];

    return Scaffold(
      // Comme sur la grille : `SafeArea` tient lieu de `100dvh`. Le grand
      // bouton du bas serait sinon à cheval sur la barre de gestes Android,
      // c'est-à-dire inatteignable exactement là où on l'a mis pour le pouce.
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 16, 4),
              child: Row(
                children: [
                  _BoutonRond(
                    contenu: const Text('🏠', style: TextStyle(fontSize: 32)),
                    intitule: MotsEnfant.sortir,
                    onTouche: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      widget.geste.nom,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 18,
                        color: CouleursEnfant.encreDouce,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              child: _Frise(total: widget.geste.etapes.length, rang: _rang),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Center(
                  // Le défilement n'est pas là pour être utilisé : il évite
                  // qu'une phrase longue sur un petit écran, ou une taille de
                  // police système poussée au maximum, déborde et emporte
                  // l'écran entier.
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          EmojisGestes.pour(widget.geste.identifiant),
                          style: const TextStyle(fontSize: 72),
                        ),
                        const SizedBox(height: 28),
                        // **Aucune transition entre deux étapes, et c'est
                        // délibéré.** Le fondu naturel ici — un
                        // `AnimatedSwitcher` — empile l'ancienne phrase et la
                        // nouvelle pendant sa durée : deux consignes
                        // superposées en gros caractères, c'est-à-dire
                        // exactement ce que cet écran promet de ne jamais
                        // faire. Le remplacement sec est aussi ce qui rend la
                        // promesse vraie à chaque instant, et pas seulement
                        // une fois l'animation finie.
                        Text(
                          etape.phrase,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 34,
                            height: 1.25,
                            fontWeight: FontWeight.w700,
                            color: CouleursEnfant.encre,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  _BoutonRond(
                    contenu: Icon(
                      Icons.arrow_back_rounded,
                      size: 38,
                      color: _rang == 0
                          ? CouleursEnfant.eteint
                          : CouleursEnfant.encre,
                    ),
                    intitule: MotsEnfant.retour,
                    onTouche: _rang == 0 ? null : _precedent,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _suivant,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(96),
                        backgroundColor: CouleursEnfant.soleil,
                        foregroundColor: CouleursEnfant.encre,
                        // Le contour n'est pas un ornement : sur fond clair,
                        // un aplat orange ne tient que 2,20:1 contre la crème.
                        // C'est ce trait à 6,79:1 qui dit « ceci est un
                        // bouton », quand le libellé, lui, dit ce qu'il fait.
                        side: const BorderSide(
                          color: CouleursEnfant.braise,
                          width: 3,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              _derniere ? MotsEnfant.fini : MotsEnfant.suivant,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(
                            _derniere
                                ? Icons.check_rounded
                                : Icons.arrow_forward_rounded,
                            size: 34,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Où l'on en est, en barres et jamais en cercle ni en chiffres.
///
/// Le chiffre « 3 / 6 » ne dit rien à qui ne lit pas, et un anneau de
/// progression est proscrit par le dépôt. Une barre par étape, remplie ou non,
/// se comprend d'un coup d'œil et montre aussi ce qui reste — la seule
/// information qu'un enfant réclame vraiment : est-ce bientôt fini.
class _Frise extends StatelessWidget {
  const _Frise({required this.total, required this.rang});

  final int total;
  final int rang;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < total; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: Container(
              height: 10,
              decoration: BoxDecoration(
                color: i <= rang
                    ? CouleursEnfant.braise
                    : CouleursEnfant.bordure,
                borderRadius: BorderRadius.circular(5),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Un bouton secondaire : rond, 72 dp, et intitulé pour les lecteurs d'écran.
///
/// `ThemeEnfant.cible` — 72 dp — plutôt que les 48 du dépôt, parce que la main
/// qui vise est celle d'un enfant ; plus petit que le bouton principal parce
/// qu'on ne veut pas le toucher par erreur en visant « suivant ».
class _BoutonRond extends StatelessWidget {
  const _BoutonRond({
    required this.contenu,
    required this.intitule,
    required this.onTouche,
  });

  final Widget contenu;
  final String intitule;
  final VoidCallback? onTouche;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: intitule,
      child: Material(
        color: CouleursEnfant.surfaceDouce,
        borderRadius: BorderRadius.circular(36),
        child: InkWell(
          onTap: onTouche,
          borderRadius: BorderRadius.circular(36),
          child: SizedBox(
            width: ThemeEnfant.cible,
            height: ThemeEnfant.cible,
            child: Center(child: contenu),
          ),
        ),
      ),
    );
  }
}
