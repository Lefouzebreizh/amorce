// Copie le core ffmpeg.wasm depuis node_modules vers public/ffmpeg/ pour qu'il
// soit servi en local : aucune dépendance à un CDN externe au runtime.
//
// C'est la variante ESM du core qui est copiée : le worker de @ffmpeg/ffmpeg
// est un module ES, il charge donc le core par `import()` et non par
// `importScripts()`.
import { mkdir, copyFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const from = resolve(root, 'node_modules/@ffmpeg/core/dist/esm')
const to = resolve(root, 'public/ffmpeg')

try {
  await access(from)
} catch {
  console.warn('[amorce] @ffmpeg/core introuvable — export vidéo indisponible.')
  process.exit(0)
}

await mkdir(to, { recursive: true })
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(resolve(from, file), resolve(to, file))
}
console.log('[amorce] core ffmpeg copié dans public/ffmpeg/')
