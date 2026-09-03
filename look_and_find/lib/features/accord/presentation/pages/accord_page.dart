/// Le viseur d'Accord : on remplit le cadre avec une surface, on obtient sa
/// palette — ou un refus qui dit quoi faire.
///
/// **La session caméra est celle du scanner, pas une seconde.** Le cycle de vie
/// du capteur — libéré à la mise en pause, reconstruit à la reprise — a déjà été
/// écrit et payé une fois : sur Android le capteur est une ressource exclusive,
/// et deux gestions concurrentes du même appareil se marcheraient dessus. Ce
/// fichier réutilise `cameraSessionProvider` tel quel.
///
/// **Ce qui diffère du scanner, en revanche, c'est le cadre**, et la différence
/// est de fond. Le repère du scanner est décoratif : il invite à viser le
/// centre, et le modèle se débrouille avec le reste. Ici le cadre **est** la
/// mesure — la porte ne juge que ce carré. `CadreVisee` le dessine depuis
/// `ZoneVisee.cadre()`, la même source que le découpage.
///
/// **La photo reste figée pendant l'analyse.** Rendre la main au flux vidéo
/// donnerait l'impression que rien n'a été pris.
library;

import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/async_view.dart';
import '../../../scanner/presentation/providers/camera_providers.dart';
import '../../domain/entities/resultat_accord.dart';
import '../../domain/usecases/analyser_photo.dart';
import '../widgets/cadre_visee.dart';
import '../widgets/panneau_accord.dart';

class AccordPage extends ConsumerStatefulWidget {
  const AccordPage({super.key});

  @override
  ConsumerState<AccordPage> createState() => _AccordPageState();
}

class _AccordPageState extends ConsumerState<AccordPage>
    with WidgetsBindingObserver {
  /// Dernière photo prise, gardée à l'écran pendant l'analyse. État d'affichage
  /// pur : le mettre dans un provider obligerait à le nettoyer de trois
  /// endroits.
  Uint8List? _figee;

  ResultatAccord? _resultat;
  bool _enCours = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        ref.invalidate(cameraSessionProvider);
      case AppLifecycleState.resumed:
        ref.read(cameraSessionProvider);
    }
  }

  Future<void> _capturer() async {
    if (_enCours) return;
    final cliche = await ref.read(cameraSessionProvider.notifier).capture();
    if (cliche == null) return;

    final octets = await cliche.readAsBytes();
    if (!mounted) return;
    setState(() {
      _figee = octets;
      _enCours = true;
    });

    final resultat = await AnalyserPhoto.depuisOctets(octets);
    if (!mounted) return;
    setState(() {
      _resultat = resultat;
      _enCours = false;
    });
  }

  void _revenirAuViseur() {
    setState(() {
      _figee = null;
      _resultat = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final resultat = _resultat;
    return Scaffold(
      backgroundColor: AppColors.ink,
      appBar: AppBar(
        backgroundColor: AppColors.ink,
        title: const Text('Accord'),
        leading: resultat == null
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _revenirAuViseur,
                tooltip: 'Reprendre une photo',
              ),
      ),
      body: resultat == null ? _viseur() : _resultatVisible(resultat),
    );
  }

  Widget _viseur() {
    final figee = _figee;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (figee != null)
          Image.memory(figee, fit: BoxFit.cover)
        else
          ref.watch(cameraSessionProvider).render(
                data: _apercu,
                loading: () => const ChargementCentre(),
                error: (erreur, _) => _panne(
                  erreur is AppException ? erreur.message : '$erreur',
                  () => ref.read(cameraSessionProvider.notifier).restart(),
                ),
              ),
        const CadreVisee(
          aide: 'Remplissez le cadre avec une seule surface — un mur, un '
              'canapé, un sol — vue de face.',
        ),
        if (_enCours)
          const ColoredBox(
            color: Color(0x88000000),
            child: Center(child: CircularProgressIndicator()),
          ),
        if (figee == null)
          Align(
            alignment: const Alignment(0, 0.95),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: FloatingActionButton.large(
                onPressed: _capturer,
                backgroundColor: AppColors.action,
                tooltip: 'Prendre la photo',
                child: const Icon(Icons.camera_alt, size: 34),
              ),
            ),
          ),
      ],
    );
  }

  Widget _apercu(CameraController controleur) => FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: controleur.value.previewSize?.height ?? 1,
          height: controleur.value.previewSize?.width ?? 1,
          child: CameraPreview(controleur),
        ),
      );

  Widget _panne(String message, VoidCallback reessayer) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.text, fontSize: 16),
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: reessayer, child: const Text('Réessayer')),
            ],
          ),
        ),
      );

  Widget _resultatVisible(ResultatAccord resultat) {
    // Une photo illisible est une panne, pas un refus d'Accord : afficher
    // « surface trop sombre » sur un fichier corrompu enverrait la personne
    // rallumer la lumière pour rien.
    if (resultat.illisible) {
      return _panne(
        "Cette photo n'a pas pu être lue. Reprenez-en une.",
        _revenirAuViseur,
      );
    }
    return PanneauAccord(
      verdict: resultat.verdict,
      harmonies: resultat.harmonies,
    );
  }
}
