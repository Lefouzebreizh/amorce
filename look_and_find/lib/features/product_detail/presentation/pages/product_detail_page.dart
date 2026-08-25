/// La fiche produit : ce que l'utilisateur est venu chercher.
///
/// **L'ordre des blocs est l'ordre des questions.** Qu'est-ce que c'est → à
/// quel prix, et où → est-ce que ça rentre chez moi → y a-t-il moins cher. Un
/// comparateur qui commence par la description perd son lecteur avant le
/// premier prix.
///
/// La photo prise sert d'en-tête. Elle n'est pas décorative : c'est la seule
/// preuve visible que le modèle a identifié **le bon objet**, et l'utilisateur
/// s'en sert pour décider s'il fait confiance à la fiche.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../ar_view/presentation/pages/ar_view_page.dart';
import '../../../favorites/presentation/providers/favorites_providers.dart';
import '../../../favorites/presentation/widgets/favorite_button.dart';
import '../../domain/entities/product.dart';
import '../../domain/usecases/best_offer.dart';
import '../widgets/alternative_card.dart';
import '../widgets/dimensions_card.dart';
import '../widgets/merchant_tile.dart';
import '../widgets/price_header.dart';

class ProductDetailPage extends ConsumerWidget {
  const ProductDetailPage({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final merchants = BestOffer.ranked(product);
    final best = BestOffer.of(product);
    final alternatives = BestOffer.cheaperThanBest(product);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _PhotoHeader(product: product),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
            sliver: SliverList.list(
              children: [
                _PriceDropBanner(productId: product.id),
                _Identity(product: product),
                const SizedBox(height: 24),
                PriceHeader(product: product),
                const SizedBox(height: 24),
                DimensionsCard(
                  product: product,
                  onViewInAr: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ArViewPage(product: product),
                    ),
                  ),
                ),
                if (merchants.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionTitle(AppStrings.merchants),
                  const SizedBox(height: 12),
                  for (final merchant in merchants) ...[
                    MerchantTile(
                      merchant: merchant,
                      currency: product.currency,
                      isBest: identical(merchant, best),
                      onOpen: merchant.url.isEmpty
                          ? null
                          : () => _open(context, merchant.url),
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
                if (alternatives.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _SectionTitle(AppStrings.alternatives),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 168,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: alternatives.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (context, index) => AlternativeCard(
                        alternative: alternatives[index],
                        currency: product.currency,
                        reference: best?.price ?? product.averagePrice,
                      ),
                    ),
                  ),
                ],
                if (product.description != null) ...[
                  const SizedBox(height: 28),
                  _SectionTitle('Description'),
                  const SizedBox(height: 10),
                  Text(product.description!, style: context.texts.bodyMedium),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Une URL produite par un modèle de langage peut pointer nulle part : on
  /// prévient au lieu de laisser un `launchUrl` échouer en silence.
  Future<void> _open(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    final launched =
        uri != null &&
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      context.snack('Boutique injoignable pour l\'instant.', isError: true);
    }
  }
}

/// Bannière de baisse de prix.
///
/// Elle n'apparaît que si **ce** produit vient d'être rescanné moins cher
/// qu'au moment de sa mise en favori. Le constat est consommé à la fermeture :
/// sans cela, la même bannière réapparaîtrait à chaque reconstruction de la
/// fiche, et finirait par se lire comme un élément de décor.
class _PriceDropBanner extends ConsumerWidget {
  const _PriceDropBanner({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drop = ref.watch(scanJournalProvider);
    if (drop == null || drop.favorite.product.id != productId) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        decoration: BoxDecoration(
          color: AppColors.gain.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            const Icon(Icons.trending_down_rounded, color: AppColors.gain),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '${AppStrings.priceDropped} de '
                '${Formatters.price(drop.amount, drop.favorite.product.currency)} '
                'depuis votre mise en favori.',
                style: context.texts.bodySmall?.copyWith(color: AppColors.gain),
              ),
            ),
            IconButton(
              tooltip: 'Fermer',
              onPressed: ref.read(scanJournalProvider.notifier).consume,
              icon: const Icon(Icons.close_rounded, size: 18),
              color: AppColors.gain,
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoHeader extends StatelessWidget {
  const _PhotoHeader({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 280,
      backgroundColor: AppColors.ink,
      actions: [FavoriteButton(product: product), const SizedBox(width: 4)],
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            _Photo(path: product.imagePath),
            // Dégradé vers le fond : sans lui, le titre du haut se pose sur
            // une photo de luminosité inconnue et devient illisible une fois
            // sur deux.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.center,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, AppColors.ink],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Photo extends StatelessWidget {
  const _Photo({required this.path});

  final String? path;

  @override
  Widget build(BuildContext context) {
    // Le fichier vient d'un dossier temporaire : il peut avoir été effacé par
    // le système entre le scan et la relecture depuis l'historique.
    if (path == null) return const ColoredBox(color: AppColors.slab);
    return Image.file(
      File(path!),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => const ColoredBox(color: AppColors.slab),
    );
  }
}

class _Identity extends StatelessWidget {
  const _Identity({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _Chip(product.category.label),
            if (product.brand != null) ...[
              const SizedBox(width: 8),
              _Chip(product.brand!),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Text(product.title, style: context.texts.titleLarge),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.muted,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) =>
      Text(label, style: context.texts.titleMedium);
}
