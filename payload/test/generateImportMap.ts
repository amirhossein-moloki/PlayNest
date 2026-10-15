import path from 'path'
import fs from 'fs'
import { generateImportMap } from 'payload'
import type { SanitizedConfig } from 'payload'
import { fileURLToPath } from 'url'

const [targetArg] = process.argv.slice(2)

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

async function run() {
  if (targetArg) {
    const targetDir = path.resolve(dirname, targetArg)
    // Check if config exists at targetDir/payload.config.ts or targetDir/config.ts
    let pathWithConfig = path.resolve(targetDir, 'payload.config.ts')
    if (!fs.existsSync(pathWithConfig)) {
      pathWithConfig = path.resolve(targetDir, 'config.ts')
    }

    console.log('Generating ad-hoc import map for config:', pathWithConfig)

    const imported = await import(pathWithConfig)
    let config: SanitizedConfig = imported.default || imported
    if (config && typeof (config as any).then === 'function') {
      config = await config
    }

    let rootDir = path.resolve(dirname, '..')

    if (
      targetArg === 'live-preview' ||
      targetArg === 'admin-root' ||
      targetArg === 'admin-bar'
    ) {
      rootDir = targetDir

      if (process.env.PAYLOAD_TEST_PROD === 'true') {
        const prodDir = path.resolve(targetDir, 'prod')
        try {
          fs.accessSync(prodDir, fs.constants.F_OK)
          rootDir = prodDir
        } catch (err) {
          // Swallow err
        }
      }
    }

    process.env.ROOT_DIR = rootDir
    await generateImportMap(config, { log: true, force: true })
  }
}

await run()
