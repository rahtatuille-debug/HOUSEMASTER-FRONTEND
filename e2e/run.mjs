// Runs the smoke tests. Usage (see README.md):
//   node run.mjs [--frontend URL] [--api URL] [--allow-mutations] [-- extra playwright args]
// Against anything other than localhost, steps that change data (a password
// reset, sending a message) are skipped unless --allow-mutations is given.
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const env = { ...process.env }
const passThrough = []
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--frontend') env.E2E_FRONTEND = args[++i]
  else if (args[i] === '--api') env.E2E_API = args[++i]
  else if (args[i] === '--allow-mutations') env.E2E_ALLOW_MUTATIONS = '1'
  else if (args[i] === '--') {
    passThrough.push(...args.slice(i + 1))
    break
  } else passThrough.push(args[i])
}
const result = spawnSync('npx', ['playwright', 'test', ...passThrough], { stdio: 'inherit', env })
process.exit(result.status ?? 1)
