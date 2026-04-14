import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { packAll } from '../src/export/pack/packer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const examplesDir = path.join(__dirname, '..', 'examples')

console.log('=== Generating bundle packs for examples/ ===\n')

const result = await packAll({
  output: examplesDir,
  onProgress: (event) => {
    if (event.status === 'packing') {
      console.log(`  ⟳ ${event.type} (${event.count} 个)...`)
    } else if (event.status === 'done') {
      const kb = ((event.size ?? 0) / 1024).toFixed(0)
      console.log(`  ✓ ${event.outputPath}  (${kb} KB)`)
    } else if (event.status === 'error') {
      console.error(`  ✗ ${event.type}: ${event.error}`)
    }
  },
})

console.log('\n=== Done ===')
if (result.errors.length > 0) {
  console.error(`\nErrors: ${result.errors.map((e) => `${e.type}: ${e.error}`).join(', ')}`)
  process.exit(1)
}
