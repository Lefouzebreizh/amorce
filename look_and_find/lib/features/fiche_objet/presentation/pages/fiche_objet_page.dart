/// La fiche de la version un : ce que c'est, et comment s'en servir.
///
/// **L'ordre des blocs est l'ordre des questions.** Qu'est-ce que c'est → de
/// quoi c'est fait et de quelle couleur → à quoi ça sert → qu'est-ce qu'on en
/// fait. Commencer par les conseils d'entretien d'un objet qu'on n'a pas encore
/// nommé perd le lecteur au premier écran.
///
/// La photo prise sert d'en-tête. Elle n'est pas décorative : c'est la seule
/// preuve visible que le modèle a décrit **le bon objet**, et c'est sur elle que
/// se décide la confiance accordée au reste.
///
/// **Ce que cet écran n'affiche pas, et c'est voulu** : aucun prix, aucun
/// marchand, aucune suggestion d'achat. La version un décrit ; la version deux
/// comparera.
library;

import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../scanner/presentation/pages/raw_answer_page.dart';
import '../../domain/entities/fiche_objet.dart';
import '../widgets/bloc_conseils.dart';
import '../widgets/ligne_caracteristique.dart';

class FicheObjetPage extends StatelessWidget {
  const FicheObjetPage({super.key, required this.fiche});

  final FicheObjet fiche;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _EnTetePhoto(fiche: fiche),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
            sliver: SliverList.list(
              children: [
                _Identite(fiche: fiche),
                const SizedBox(height: 24),
                _CeQuOnVoit(fiche: fiche),
                if (fiche.usage != null) ...[
                  const SizedBox(height: 24),
                  _Usage(texte: fiche.usage!),
                ],
                if (fiche.aDesConseils) ...[
                  const SizedBox(height: 24),
                  BlocConseils(conseils: fiche.conseils),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EnTetePhoto extends StatelessWidget {
  const _EnTetePhoto({required this.fiche});

  final FicheObjet fiche;

  @override
  Widget build(BuildContext context) {
    final chemin = fiche.imagePath;

    return SliverAppBar(
      expandedHeight: chemin == null ? 0 : 280,
      pinned: true,
      backgroundColor: AppColors.ink,
      actions: [
        // La réponse brute reste atteignable depuis la fiche v1 : c'est elle
        // qui tranche, quand une description paraît fausse, entre l'erreur du
        // modèle et l'erreur de lecture.
        IconButton(
          tooltip: 'Réponse du modèle',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const RawAnswerPage()),
          ),
          icon: const Icon(Icons.data_object_rounded),
        ),
        const SizedBox(width: 4),
      ],
      flexibleSpace: chemin == null
          ? null
          : FlexibleSpaceBar(
              background: Image.file(
                File(chemin),
                fit: BoxFit.cover,
                // Les photos vont dans le dossier temporaire du système, qu'Android
                // vide quand il manque de place. La fiche reste lisible sans elle.
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: AppColors.slab,
                  child: Center(
                    child: Icon(
                      Icons.image_not_supported_rounded,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}

class _Identite extends StatelessWidget {
  const _Identite({required this.fiche});

  final FicheObjet fiche;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(fiche.nom, style: context.texts.headlineSmall),
        if (fiche.categorie != null) ...[
          const SizedBox(height: 6),
          Text(
            fiche.categorie!,
            style: context.texts.bodyMedium?.copyWith(color: AppColors.muted),
          ),
        ],
      ],
    );
  }
}

/// Matière et couleur : ce qui se lit sur la photo.
///
/// Les deux sont estimées, et l'écran ne les présente jamais comme des
/// certitudes — la couleur dit d'elle-même quand elle hésite, la matière porte
/// la prudence que l'invite a demandée au modèle.
class _CeQuOnVoit extends StatelessWidget {
  const _CeQuOnVoit({required this.fiche});

  final FicheObjet fiche;

  @override
  Widget build(BuildContext context) {
    final couleur = fiche.couleur;
    final lignes = <Widget>[
      if (couleur != null)
        LigneCaracteristique(
          icone: Icons.palette_outlined,
          libelle: 'Couleur',
          valeur: couleur.spoken,
        ),
      if (fiche.matiere != null)
        LigneCaracteristique(
          icone: Icons.texture_rounded,
          libelle: 'Matière',
          valeur: fiche.matiere!,
        ),
      for (final trait in fiche.caracteristiques)
        LigneCaracteristique(
          icone: Icons.check_rounded,
          libelle: null,
          valeur: trait,
        ),
    ];

    if (lignes.isEmpty) return const SizedBox.shrink();

    return _Section(titre: 'Ce qu\'on voit', enfants: lignes);
  }
}

class _Usage extends StatelessWidget {
  const _Usage({required this.texte});

  final String texte;

  @override
  Widget build(BuildContext context) => _Section(
    titre: 'À quoi ça sert',
    enfants: [Text(texte, style: context.texts.bodyLarge)],
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.titre, required this.enfants});

  final String titre;
  final List<Widget> enfants;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          titre,
          style: context.texts.titleSmall?.copyWith(color: AppColors.muted),
        ),
        const SizedBox(height: 12),
        // Une surface empilée plutôt qu'un contour : la bordure est réservée à
        // ce qui sépare vraiment ou à ce qui est désigné.
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.slab,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: enfants,
          ),
        ),
      ],
    );
  }
}
