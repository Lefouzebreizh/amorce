/** Autorise le jeu fictif sur les aperçus Vercel du seul projet du coffre. */
export function estApercuVercelDuCoffre(hostname: string): boolean {
  return /^(?:mon-tiroir-secret-git-(?!main(?:-|$))[a-z0-9-]+|mon-tiroir-secret-[a-z0-9]{9})-erwannchevallier-6916s-projects\.vercel\.app$/.test(hostname);
}
