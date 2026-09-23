// Node module hook for worker.test.mjs: import maintenance.html as a string,
// the way Wrangler's Text module rule does when it bundles the Worker.
import { readFile } from 'node:fs/promises';

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.html')) return nextLoad(url, context);
  const html = await readFile(new URL(url), 'utf8');
  return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(html)};` };
}
