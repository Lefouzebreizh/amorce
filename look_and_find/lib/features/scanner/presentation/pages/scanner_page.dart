/// Le viseur : l'écran d'accueil de l'application.
///
/// **Pourquoi la caméra est libérée à la mise en pause.** Sur Android, le
/// capteur est une ressource exclusive. Une application qui le garde en
/// arrière-plan empêche l'appareil photo du système de s'ouvrir, et se retrouve
/// elle-même en échec au retour. Le cycle est donc explicite ici, et non laissé
/// au ramasse-miettes.
///
/// **Pourquoi la photo reste figée pendant l'analyse.** L'identification prend
/// deux à cinq secondes. Rendre la main au flux vidéo pendant ce temps donnerait
/// l'impression que rien n'a été pris ; garder l'image dit exactement ce qui est
/// en cours d'analyse.
library;

import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/async_view.dart';
import '../../../../core/utils/extensions.dart';
import '../../../favorites/presentation/pages/favorites_page.dart';
import '../../../favorites/presentation/providers/favorites_providers.dart';
import '../../../product_detail/presentation/pages/product_detail_page.dart';
import '../providers/camera_providers.dart';
import 'api_key_page.dart';
import '../providers/scanner_providers.dart';
import '../widgets/blocking_notice.dart';
import '../widgets/capture_bar.dart';
import '../widgets/flash_button.dart';
import '../widgets/focus_ring.dart';
import '../widgets/scan_status_sheet.dart';
import '../widgets/viewfinder_overlay.dart';

class ScannerPage extends ConsumerStatefulWidget {
  const ScannerPage({super.key});

  @override
  ConsumerState<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends ConsumerState<ScannerPage>
    with WidgetsBindingObserver {
  /// Dernière photo prise, gardée à l'écran pendant l'analyse. C'est un état
  /// d'affichage pur : le mettre dans un provider obligerait à le nettoyer
  /// depuis trois endroits.
  Uint8List? _frozen;

  Offset? _focusPoint;

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
        // Invalider libère le contrôleur (voir `ref.onDispose` côté provider)
        // et le reconstruira à la première lecture suivante.
        ref.invalidate(cameraSessionProvider);
      case AppLifecycleState.resumed:
        // Un simple `read` suffit à relancer le provider invalidé : c'est sa
        // reconstruction qui rouvre le capteur.
        ref.read(cameraSessionProvider);
    }
  }

  /// Identifier une photo déjà prise. Le chemin d'identification est
  /// rigoureusement le même que celui du déclencheur : deux chemins
  /// divergeraient au premier changement d'invite ou de compression.
  Future<void> _choisirPhoto() async {
    final photo = await ref.read(photoPickerProvider).pick();
    if (photo == null || !mounted) return;

    setState(() => _frozen = photo.bytes);
    await _identifier(photo.bytes, photo.path);
  }

  Future<void> _capture() async {
    final shot = await ref.read(cameraSessionProvider.notifier).capture();
    if (shot == null) return;

    final bytes = await shot.readAsBytes();
    if (!mounted) return;
    setState(() => _frozen = bytes);

    await _identifier(bytes, shot.path);
  }

  Future<void> _identifier(Uint8List bytes, String chemin) async {
    final product = await ref
        .read(scanControllerProvider.notifier)
        .identify(bytes, imagePath: chemin);

    if (!mounted || product == null) return;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductDetailPage(product: product),
      ),
    );

    // Au retour de la fiche, le viseur repart propre : garder la photo
    // précédente donnerait l'impression d'un écran resté bloqué.
    if (!mounted) return;
    _backToViewfinder();
  }

  void _ouvrirReglageCle(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ApiKeyPage()),
    );
  }

  void _backToViewfinder() {
    setState(() => _frozen = null);
    ref.read(scanControllerProvider.notifier).reset();
  }

  Future<void> _retry() async {
    final photo = _frozen;
    if (photo == null) return;
    await ref.read(scanControllerProvider.notifier).identify(photo);
  }

  void _focusAt(Offset local, Size size) {
    setState(() => _focusPoint = local);
    ref
        .read(cameraSessionProvider.notifier)
        .focusAt(Offset(local.dx / size.width, local.dy / size.height));
  }

  @override
  Widget build(BuildContext context) {
    if (ref.watch(geminiApiKeyProvider).isEmpty) {
      return Scaffold(
        body: SafeArea(
          child: BlockingNotice(
            icon: Icons.key_off_rounded,
            title: AppStrings.missingKeyTitle,
            body: AppStrings.missingKeyBody,
            actionLabel: AppStrings.enterKey,
            onAction: () => _ouvrirReglageCle(context),
          ),
        ),
      );
    }

    final session = ref.watch(cameraSessionProvider);
    final scan = ref.watch(scanControllerProvider);
    final flash = ref.watch(flashSettingProvider);
    final alerts = ref.watch(pendingAlertsProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // `render` et non `when` : voir `core/utils/async_view.dart`. Avec
          // `when`, une caméra refusée reste sur l'indicateur de chargement et
          // l'utilisateur n'apprend jamais ce qui bloque.
          session.render(
            loading: () => const ColoredBox(
              color: Colors.black,
              child: ChargementCentre(),
            ),
            error: (error, _) => _CameraError(
              error: error,
              onRetry: ref.read(cameraSessionProvider.notifier).restart,
              onPickPhoto: _choisirPhoto,
            ),
            data: (controller) => _Preview(
              controller: controller,
              frozen: _frozen,
              onFocus: _focusAt,
            ),
          ),

          if (_frozen == null && session.hasValue)
            const ViewfinderOverlay(hint: AppStrings.scannerHint),

          if (_frozen == null && session.hasValue)
            Positioned(
              top: MediaQuery.viewPaddingOf(context).top + 12,
              right: 16,
              child: FlashButton(
                mode: flash,
                onTap: ref.read(flashSettingProvider.notifier).cycle,
              ),
            ),

          if (_focusPoint != null && _frozen == null)
            FocusRing(position: _focusPoint!),

          if (scan.isLoading) const ScanStatusSheet.analysing(),

          if (scan.hasError)
            ScanStatusSheet.failed(
              error: scan.appError ?? const UnknownException('Échec du scan'),
              onRetry: _retry,
              onBack: _backToViewfinder,
            ),

          if (_frozen == null && session.hasValue)
            Positioned(
              left: 0,
              right: 0,
              bottom: 20 + context.bottomInset,
              child: CaptureBar(
                alertCount: alerts.length,
                busy: scan.isLoading,
                onPickPhoto: _choisirPhoto,
                onCapture: _capture,
                onOpenList: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const FavoritesPage(),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// L'aperçu caméra en plein cadre.
///
/// `previewSize` est donné en orientation paysage par le pilote, quelle que
/// soit l'orientation de l'écran : la largeur et la hauteur sont donc échangées
/// avant de laisser `BoxFit.cover` recadrer. Sans cette inversion, l'aperçu est
/// étiré et l'objet visé n'a plus les bonnes proportions.
class _Preview extends StatelessWidget {
  const _Preview({
    required this.controller,
    required this.frozen,
    required this.onFocus,
  });

  final CameraController controller;
  final Uint8List? frozen;
  final void Function(Offset local, Size size) onFocus;

  @override
  Widget build(BuildContext context) {
    if (frozen != null) {
      return Image.memory(frozen!, fit: BoxFit.cover, gaplessPlayback: true);
    }

    final preview = controller.value.previewSize;
    if (!controller.value.isInitialized || preview == null) {
      return const ColoredBox(color: Colors.black);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (details) => onFocus(details.localPosition, size),
          child: ClipRect(
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: preview.height,
                height: preview.width,
                child: CameraPreview(controller),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({
    required this.error,
    required this.onRetry,
    required this.onPickPhoto,
  });

  final Object error;
  final VoidCallback onRetry;
  final VoidCallback onPickPhoto;

  @override
  Widget build(BuildContext context) {
    final message = error is AppException
        ? (error as AppException).message
        : AppStrings.scannerNoCamera;

    return ColoredBox(
      color: AppColors.ink,
      child: SafeArea(
        child: BlockingNotice(
          icon: Icons.no_photography_outlined,
          title: AppStrings.scannerTitle,
          body: message,
          actionLabel: AppStrings.retry,
          onAction: onRetry,
          // Un accès caméra refusé ne doit pas rendre l'application inutile :
          // la photo de l'objet est peut-être déjà dans la galerie.
          secondaryLabel: AppStrings.pickPhoto,
          onSecondary: onPickPhoto,
        ),
      ),
    );
  }
}
