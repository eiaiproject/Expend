import { readFile, writeFile } from 'node:fs/promises'

const file = new URL('../dist/sw.js', import.meta.url)
const source = await readFile(file, 'utf8')
if (!source.includes('__BUILD_VERSION__')) {
  console.log('Cache service worker sudah memiliki versi.')
  process.exit(0)
}

const version = Date.now().toString(36)
await writeFile(file, source.replaceAll('__BUILD_VERSION__', version))
console.log(`Cache service worker: expend-${version}`)
