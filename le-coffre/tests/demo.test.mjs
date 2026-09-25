import test from 'node:test';
import assert from 'node:assert/strict';
import { estApercuVercelDuCoffre } from '../src/lib/demo.ts';

test('le mode fictif est ouvert sur les aperçus Vercel actuels du coffre', () => {
  assert.equal(estApercuVercelDuCoffre('mon-tiroir-secret-f2avnvkmr-erwannchevallier-6916s-projects.vercel.app'), true);
  assert.equal(estApercuVercelDuCoffre('mon-tiroir-secret-git-co-8ad792-erwannchevallier-6916s-projects.vercel.app'), true);
});

test('le mode fictif reste fermé sur le domaine stable et la preview main', () => {
  assert.equal(estApercuVercelDuCoffre('coffre-puce.vercel.app'), false);
  assert.equal(estApercuVercelDuCoffre('mon-tiroir-secret-git-main-erwannchevallier-6916s-projects.vercel.app'), false);
});
