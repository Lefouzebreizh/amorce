/** Identifiants courts et uniques pour les entités du projet. */
export function uid(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${random}` : random;
}
