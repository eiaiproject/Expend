import { copyFile, mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const tesseractDist = resolve(root, 'node_modules/tesseract.js/dist')
const tesseractCore = resolve(root, 'node_modules/tesseract.js-core')
const publicDir = resolve(root, 'public')

const coreFiles = [
  'tesseract-core.wasm.js',
  'tesseract-core.wasm',
  'tesseract-core-simd.wasm.js',
  'tesseract-core-simd.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
]

async function sameSize(source, destination) {
  try {
    const [from, to] = await Promise.all([stat(source), stat(destination)])
    return from.size === to.size
  } catch {
    return false
  }
}

async function copyIfNeeded(source, destination) {
  await mkdir(resolve(destination, '..'), { recursive: true })
  if (await sameSize(source, destination)) return
  await copyFile(source, destination)
}

await mkdir(resolve(publicDir, 'tesseract-core'), { recursive: true })
for (const file of coreFiles) {
  await copyIfNeeded(
    resolve(tesseractCore, file),
    resolve(publicDir, 'tesseract-core', file),
  )
}
await copyIfNeeded(
  resolve(tesseractDist, 'worker.min.js'),
  resolve(publicDir, 'tesseract-worker.min.js'),
)

console.log('Aset OCR lokal siap di public/.')
