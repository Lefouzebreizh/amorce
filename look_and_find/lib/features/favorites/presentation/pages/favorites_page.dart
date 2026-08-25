/// « Ma liste » : les objets suivis, et ceux simplement scannés.
///
/// Deux onglets et non deux écrans : ce sont les deux moitiés d'une même
/// question — « qu'est-ce que j'ai regardé, et qu'est-ce que je surveille ».
/// L'historique se transforme en favori d'un geste, ce qui n'aurait pas de
/// sens si les deux vivaient à des endroits différents de l'application.
///
/// Les deux listes viennent de flux Hive : une modification faite depuis une
/// fiche produit se voit ici sans rechargement, et réciproquement.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../../product_detail/presentation/pages/product_detail_page.dart';
import '../../domain/entities/favorite.dart';
import '../providers/favorites_providers.dart';
import '../widgets/favorite_tile.dart';
import '../widgets/history_tile.dart';
import '../widgets/price_alert_sheet.dart';

class FavoritesPage extends ConsumerWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(AppStrings.favoritesTitle),
          bottom: const TabBar(
            tabs: [
              Tab(text: AppStrings.tabFavorites),
              Tab(text: AppStrings.tabHistory),
            ],
            indicatorColor: AppColors.action,
            labelColor: AppColors.text,
            unselectedLabelColor: AppColors.muted,
          ),
        ),
        body: const TabBarView(children: [_FavoritesTab(), _HistoryTab()]),
      ),
    );
  }
}

class _FavoritesTab extends ConsumerWidget {
  const _FavoritesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesProvider);

    return favorites.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _Empty(
        icon: Icons.error_outline_rounded,
        title: AppStrings.errorGeneric,
        body: error.toString(),
      ),
      data: (list) {
        if (list.isEmpty) {
          return const _Empty(
            icon: Icons.favorite_border_rounded,
            title: AppStrings.noFavorites,
            body: AppStrings.noFavoritesBody,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final favorite = list[index];
            return FavoriteTile(
              favorite: favorite,
              onOpen: () => _open(context, favorite.product),
              onAlert: () => _editAlert(context, ref, favorite),
              onRemove: () => ref
                  .read(favoritesRepositoryProvider)
                  .remove(favorite.product.id),
            );
          },
        );
      },
    );
  }

  Future<void> _editAlert(
    BuildContext context,
    WidgetRef ref,
    Favorite favorite,
  ) async {
    final (changed, threshold) = await PriceAlertSheet.show(context, favorite);
    if (!changed) return;
    await ref
        .read(favoritesRepositoryProvider)
        .save(
          favorite.copyWith(
            alertThreshold: threshold,
            clearThreshold: threshold == null,
          ),
        );
  }
}

class _HistoryTab extends ConsumerWidget {
  const _HistoryTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(historyProvider);

    return history.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _Empty(
        icon: Icons.error_outline_rounded,
        title: AppStrings.errorGeneric,
        body: error.toString(),
      ),
      data: (list) {
        if (list.isEmpty) {
          return const _Empty(
            icon: Icons.history_rounded,
            title: AppStrings.noHistory,
            body: 'Chaque objet identifié se range ici pour être rouvert '
                'sans reprendre de photo.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          itemCount: list.length + 1,
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, index) {
            if (index == list.length) {
              return Padding(
                padding: const EdgeInsets.only(top: 20),
                child: TextButton.icon(
                  onPressed: () =>
                      ref.read(favoritesRepositoryProvider).clearHistory(),
                  icon: const Icon(Icons.delete_sweep_outlined, size: 18),
                  label: const Text('Vider l\'historique'),
                ),
              );
            }
            return HistoryTile(
              product: list[index],
              onOpen: () => _open(context, list[index]),
            );
          },
        );
      },
    );
  }
}

void _open(BuildContext context, Product product) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => ProductDetailPage(product: product)),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 42, color: AppColors.muted),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: context.texts.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              body,
              textAlign: TextAlign.center,
              style: context.texts.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
