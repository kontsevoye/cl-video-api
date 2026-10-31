import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { marked } from 'marked';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const config = await json('site/config.json');
const coverage = await json('docs/coverage.json');
const operationIds = new Set();
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

for (const { path, title } of config.specs) {
  // Validation stays offline; the service URLs are documentation, not test targets.
  const spec = await SwaggerParser.validate(path, { resolve: { http: false } });
  assert.equal(spec.openapi, '3.0.3', path);
  let count = 0;
  for (const item of Object.values(spec.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!methods.has(method)) continue;
      assert(operation.operationId && !operationIds.has(operation.operationId), `Duplicate/missing operationId: ${path}`);
      operationIds.add(operation.operationId);
      count++;
    }
  }
  assert(title.includes(`${count} операций`), `Update the menu count for ${path}`);
  console.log(`${path}: valid OpenAPI, ${count} operations`);
}

const covered = new Set();
const status = await readFile('docs/coverage.md', 'utf8');
assert(status.includes(coverage.updated_at), 'Coverage date differs');
const features = new Set();
for (const feature of coverage.features) {
  assert(!features.has(feature.id), `Duplicate feature: ${feature.id}`);
  features.add(feature.id);
  assert(feature.status in coverage.status_definitions, feature.id);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(feature.checked_at), feature.id);
  assert(status.includes(feature.title) && status.includes(feature.notes), `Update coverage.md: ${feature.id}`);
  for (const id of feature.operations) {
    assert(operationIds.has(id), `Unknown operation in coverage: ${id}`);
    covered.add(id);
  }
}
assert.deepEqual([...operationIds].filter(id => !covered.has(id)), [], 'Operations missing coverage');

let links = 0;
for (const { path } of config.documents) {
  const markdown = await readFile(path, 'utf8');
  const targets = [];
  marked.walkTokens(marked.lexer(markdown), token => {
    if (token.type === 'link' || token.type === 'image') targets.push(token.href);
  });
  for (const target of targets) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    assert(!target.startsWith('/'), `Use relative links for Pages: ${path}: ${target}`);
    const local = resolve(dirname(path), decodeURIComponent(target.split(/[?#]/)[0]));
    assert(local.startsWith(root), `Link escapes repository: ${path}: ${target}`);
    await access(local);
    links++;
  }
}
console.log(`Coverage: ${operationIds.size} operations, ${features.size} areas; ${links} local links valid.`);
