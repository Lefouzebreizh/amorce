/// Ce qu'Accord rend à l'écran : un refus qui dit quoi faire, ou une palette.
///
/// **Un refus sans geste est une impasse** — la personne réessaie la même photo
/// et obtient le même refus. Chaque `PhotoRefus` porte donc sa raison et son
/// conseil, et ce panneau montre les deux, le conseil aussi visible que la
/// cause. C'est la règle qui a présidé à l'écriture de la porte, et l'écran
/// n'a pas le droit de la perdre en route.
///
/// **Le mur est le 60 %.** La dominante n'est jamais présentée comme une
/// harmonie : elle est la base, et chaque harmonie porte son propre 30 % et son
/// propre 10 %. C'est ce qui rend les objets concrets — on propose un coussin
/// complémentaire, jamais un mur complémentaire.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../color_reader/domain/usecases/name_color.dart';
import '../../domain/entities/harmonie.dart';
import '../../domain/entities/photo_verdict.dart';

class PanneauAccord extends StatelessWidget {
  const PanneauAccord({super.key, required this.verdict, this.harmonies});

  final PhotoVerdict verdict;

  /// Les trois harmonies, quand la photo est acceptée. Ignorées sur un refus.
  final List<Harmonie>? harmonies;

  @override
  Widget build(BuildContext context) {
    if (!verdict.estAcceptee) return _Refus(refus: verdict.refus!);
    return _Palette(verdict: verdict, harmonies: harmonies ?? const []);
  }
}

class _Refus extends StatelessWidget {
  const _Refus({required this.refus});

  final PhotoRefus refus;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Icon(Icons.info_outline, color: AppColors.warn, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  refus.raison,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    height: 1.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Le geste ne se met pas en petit sous la cause : c'est lui qu'on
          // vient chercher, et c'est lui qui fait repartir la personne.
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.raised,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                refus.conseil,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Palette extends StatelessWidget {
  const _Palette({required this.verdict, required this.harmonies});

  final PhotoVerdict verdict;
  final List<Harmonie> harmonies;

  @override
  Widget build(BuildContext context) {
    final lu = NameColor.of(verdict.rouge, verdict.vert, verdict.bleu);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _Pastille(
            couleur: Color.fromARGB(
              255,
              verdict.rouge,
              verdict.vert,
              verdict.bleu,
            ),
            titre: lu.spoken,
            // L'espace insécable s'écrit en échappement : brute, elle est
            // invisible dans un diff et quelqu'un la remplace un jour par une
            // espace ordinaire sans le voir.
            detail: '${verdict.hexadecimal} · votre surface, 60\u00A0%',
            grande: true,
          ),
          for (final harmonie in harmonies) ...[
            const SizedBox(height: 22),
            Text(
              harmonie.type.nom,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              harmonie.type.explication,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 10),
            for (final p in harmonie.propositions)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _Pastille(
                  couleur: Color.fromARGB(255, p.rouge, p.vert, p.bleu),
                  titre: '${p.part}\u00A0% · ${p.objets.join(', ')}',
                  detail: p.hexadecimal,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Pastille extends StatelessWidget {
  const _Pastille({
    required this.couleur,
    required this.titre,
    required this.detail,
    this.grande = false,
  });

  final Color couleur;
  final String titre;
  final String detail;
  final bool grande;

  @override
  Widget build(BuildContext context) {
    final cote = grande ? 64.0 : 44.0;
    return Row(
      children: [
        Container(
          width: cote,
          height: cote,
          decoration: BoxDecoration(
            color: couleur,
            borderRadius: BorderRadius.circular(12),
            // Un liseré : sans lui, une couleur très sombre ou très claire se
            // confond avec le fond et la pastille disparaît.
            border: Border.all(color: AppColors.edge),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                titre,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: grande ? 18 : 15,
                  fontWeight: grande ? FontWeight.w600 : FontWeight.w500,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                detail,
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
