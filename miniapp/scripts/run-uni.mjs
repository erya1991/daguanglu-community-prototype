import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const [platform, command] = process.argv.slice(2)
if (!platform) throw new Error('缺少 uni 平台参数')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = process.platform === 'win32'
  ? resolve(root, 'node_modules/.bin/uni.cmd')
  : resolve(root, 'node_modules/.bin/uni')
const result = spawnSync(cli, command ? [command, '-p', platform] : ['-p', platform], {
  cwd: process.cwd(),
  env: { ...process.env, UNI_PLATFORM: platform },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
