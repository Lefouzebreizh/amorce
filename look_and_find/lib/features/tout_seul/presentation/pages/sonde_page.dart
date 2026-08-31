/// La sonde : un instrument de mesure, pas un écran de produit.
///
/// **Ce qu'elle sert à savoir.** Personne ne sait ce que ML Kit répond quand un
/// enfant pointe ses lacets. Le corpus parle français et précis — `lacet`,
/// `brosse à dents` — le moteur parle anglais et générique. Écrire la table de
/// correspondance entre les deux **d'imagination** serait une faute ; cet écran
/// existe pour la remplacer par des relevés.
///
/// D'où trois partis pris qu'on ne prendrait dans aucun écran destiné à
/// quelqu'un :
///
/// 1. **Rien n'est traduit, rien n'est filtré, rien n'est embelli.** Le mot
///    affiché est celui du moteur, avec sa confiance, même absurde. Un
///    instrument qui corrige ce qu'il mesure ne mesure plus.
/// 2. **Aucune photo à valider, aucun menu.** On vise, on lit, on vise autre
///    chose. La lecture s'enchaîne toute seule : le geste utile est de bouger
///    le téléphone, pas d'appuyer.
/// 3. **Un bouton qui copie tout.** Le relevé ne sert que s'il arrive dans un
///    message. C'est la seule action de l'écran.
///
/// **Elle n'est pas dans l'application de l'enfant**, et c'est le rôle du
/// troisième point d'entrée `lib/main_sonde.dart` : un écran de diagnostic
/// atteignable depuis `main_tout_seul.dart` entrerait dans le binaire enfant
/// par l'élagage, avec l'appareil photo derrière.
///
/// ## Ce qui se vérifie ici, et ce qui ne se vérifie pas
///
/// La boucle, l'affichage, le tri et la copie s'éprouvent : la prise de vue est
/// injectable, et `sonde_page_test.dart` la remplace. L'appareil photo lui-même
/// ne se monte sur aucune machine de vérification — ce chemin-là ne se constate
/// que sur un téléphone, et l'écran le dit à l'écran plutôt que de tourner
/// indéfiniment, comme le viseur de Look & Find a appris à le faire.
library;

import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../domain/reconnaissance.dart';
import '../widgets/tableau_etiquettes.dart';

/// D'où vient l'image à observer. Rendue injectable pour une seule raison :
/// sans elle, rien de cet écran ne serait éprouvable ailleurs que sur un
/// téléphone — ni la boucle, ni le tri, ni la copie.
typedef PriseDeVue = Future<String?> Function();

class SondePage extends StatefulWidget {
  const SondePage({
    super.key,
    required this.reconnaissance,
    this.priseDeVue,
  });

  final Reconnaissance reconnaissance;

  /// Laissée nulle en production : c'est alors l'appareil photo.
  final PriseDeVue? priseDeVue;

  /// Le temps de repos entre deux lectures.
  ///
  /// Il n'est pas là pour ménager le processeur — une prise de vue coûte déjà
  /// quelques centaines de millisecondes — mais pour l'œil : des étiquettes qui
  /// se remplacent trop vite ne se lisent pas, et l'on ne sait plus si l'on
  /// regarde l'objet visé ou le précédent.
  ///
  /// Ces cinq constantes sont publiques parce que les tests les lisent : une
  /// durée ou un libellé recopié à la main dans un banc d'essai s'en écarte au
  /// premier réglage, et le test continue de passer en mesurant autre chose.
  static const Duration repos = Duration(milliseconds: 700);

  static const String titre = 'Sonde — étiquettes brutes';
  static const String attente = 'Vise un objet…';
  static const String prefixeLecture = 'Lecture n°';
  static const String prefixePanne = 'La sonde est arrêtée :';

  @override
  State<SondePage> createState() => _SondePageState();
}

class _SondePageState extends State<SondePage> {
  CameraController? _camera;
  Timer? _prochaine;
  bool _occupe = false;

  List<EtiquetteVue> _etiquettes = const [];
  int _lectures = 0;
  String? _panne;

  @override
  void initState() {
    super.initState();
    if (widget.priseDeVue != null) {
      unawaited(_lireUneFois());
    } else {
      unawaited(_ouvrirLAppareil());
    }
  }

  @override
  void dispose() {
    _prochaine?.cancel();
    unawaited(_camera?.dispose());
    // La sonde est le seul écran de son application : c'est donc elle qui rend
    // le moteur. Un détecteur ML Kit laissé ouvert retient de la mémoire native
    // que le ramasse-miettes de Dart ne voit pas.
    unawaited(widget.reconnaissance.liberer());
    super.dispose();
  }

  Future<void> _ouvrirLAppareil() async {
    try {
      final appareils = await availableCameras();
      if (appareils.isEmpty) {
        throw StateError('Aucun appareil photo sur ce téléphone.');
      }
      final arriere = appareils.firstWhere(
        (a) => a.lensDirection == CameraLensDirection.back,
        orElse: () => appareils.first,
      );

      // `high` et non le maximum du capteur : l'étiquetage ramène l'image à
      // quelques centaines de pixels de toute façon, et une pleine résolution
      // ne ferait qu'allonger chaque tour de boucle.
      final camera = CameraController(
        arriere,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await camera.initialize();
      if (!mounted) {
        await camera.dispose();
        return;
      }
      setState(() => _camera = camera);
      unawaited(_lireUneFois());
    } catch (erreur) {
      _signaler(erreur);
    }
  }

  Future<String?> _prendre() async {
    final injectee = widget.priseDeVue;
    if (injectee != null) return injectee();

    final camera = _camera;
    if (camera == null || !camera.value.isInitialized) return null;
    return (await camera.takePicture()).path;
  }

  Future<void> _lireUneFois() async {
    if (_occupe) return;
    _occupe = true;
    try {
      final chemin = await _prendre();
      if (chemin != null) {
        final vues = await widget.reconnaissance.observer(chemin);
        if (!mounted) return;
        setState(() {
          _etiquettes = vues;
          _lectures++;
        });
        // Les prises de vue s'entassent dans le dossier temporaire — une par
        // tour, plusieurs par seconde. Celle qu'on a injectée ne nous
        // appartient pas : on n'efface que ce qu'on a produit.
        if (widget.priseDeVue == null) await _effacer(chemin);
      }
    } catch (erreur) {
      _signaler(erreur);
      return;
    } finally {
      _occupe = false;
    }
    if (mounted && _panne == null) {
      _prochaine = Timer(SondePage.repos, () => unawaited(_lireUneFois()));
    }
  }

  Future<void> _effacer(String chemin) async {
    try {
      await File(chemin).delete();
    } catch (_) {
      // Un fichier temporaire qu'on n'arrive pas à effacer n'est pas une raison
      // d'arrêter la mesure : le système le reprendra.
    }
  }

  /// La panne s'affiche **en toutes lettres**, y compris le message technique.
  /// C'est un instrument : celui qui le tient doit pouvoir recopier l'erreur
  /// dans un message, pas la deviner.
  void _signaler(Object erreur) {
    _prochaine?.cancel();
    if (!mounted) return;
    setState(() => _panne = '$erreur');
  }

  @override
  Widget build(BuildContext context) {
    final camera = _camera;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (camera != null && camera.value.isInitialized)
            CameraPreview(camera),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _panne == null
                        ? (_lectures == 0
                            ? SondePage.attente
                            : '${SondePage.prefixeLecture} $_lectures')
                        : SondePage.titre,
                    style: const TextStyle(
                      fontSize: 18,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                Container(
                  width: double.infinity,
                  color: Colors.black.withValues(alpha: 0.72),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  child: SingleChildScrollView(
                    child: _panne == null
                        ? TableauEtiquettes(etiquettes: _etiquettes)
                        : Text(
                            '${SondePage.prefixePanne}\n$_panne',
                            style: const TextStyle(
                              fontSize: 18,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
