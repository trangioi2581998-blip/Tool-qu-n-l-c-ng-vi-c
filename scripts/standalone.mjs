import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const folder = resolve('demo-dist')
let html = await readFile(resolve(folder, 'index.html'), 'utf8')
const css = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)
const js = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)
if (!css || !js)
  throw new Error('The demo bundle is missing its stylesheet or entry module.')
const [styles, script] = await Promise.all([
  readFile(resolve(folder, css[1]), 'utf8'),
  readFile(resolve(folder, js[1]), 'utf8'),
])
const embeddedPackages = [
  'react',
  'react-dom',
  'scheduler',
  'lucide-react',
  '@fontsource/be-vietnam-pro',
]
const licenses = await Promise.all(
  embeddedPackages.map(async (name) => {
    const license = await readFile(resolve('node_modules', name, 'LICENSE'), 'utf8')
    return name + '\n' + license.trim()
  }),
)
html = html
  .replace(css[0], () => '<style>' + styles + '</style>')
  .replace(
    js[0],
    () =>
      '<script type="module">' +
      script.replace(/<\/script/gi, '<\\/script') +
      '</script>',
  )
html = html.replace(
  '</body>',
  () => '<!-- Third-party notices\n' + licenses.join('\n\n') + '\n-->\n</body>',
)
const output = resolve(process.argv[2] || 'demo-dist/nhip-viec-demo.html')
await writeFile(output, html)
console.log(output)
