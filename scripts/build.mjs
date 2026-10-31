import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const output = 'dist';
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/assets/licenses`, { recursive: true });

// Explicit publication list: never copy the working tree or research archive.
const files = [
  'README.md', 'openapi.json', 'openapi-media.json', 'openapi-simple.json',
  'docs/api.md', 'docs/coverage.md', 'docs/coverage.json', 'docs/media.md',
  'docs/ui-dictionaries.json', 'docs/external-players.json',
];
for (const path of files) {
  await mkdir(`${output}/${path.split('/').slice(0, -1).join('/')}`, { recursive: true });
  await cp(path, `${output}/${path}`);
}
for (const name of ['index.html', 'app.js', 'style.css', 'config.json']) {
  await cp(`site/${name}`, `${output}/${name}`);
}
for (const [source, target] of [
  ['swagger-ui-dist/swagger-ui.css', 'swagger-ui.css'],
  ['swagger-ui-dist/swagger-ui-bundle.js', 'swagger-ui-bundle.js'],
  ['marked/lib/marked.umd.js', 'marked.js'],
  ['dompurify/dist/purify.min.js', 'purify.js'],
  ['swagger-ui-dist/LICENSE', 'licenses/swagger-ui.txt'],
  ['swagger-ui-dist/NOTICE', 'licenses/swagger-ui-NOTICE.txt'],
  ['swagger-ui-dist/swagger-ui-bundle.js.LICENSE.txt', 'swagger-ui-bundle.js.LICENSE.txt'],
  ['marked/LICENSE', 'licenses/marked.txt'],
  ['dompurify/LICENSE', 'licenses/dompurify.txt'],
]) {
  await cp(`node_modules/${source}`, `${output}/assets/${target}`);
}
await writeFile(`${output}/.nojekyll`, '');
console.log('Static documentation built in dist/ (works at / and /<repository>/).');
