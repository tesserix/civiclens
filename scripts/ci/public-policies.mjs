import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const output = process.argv[2];
if (!output) throw new Error('A public policy output directory is required');
await mkdir(output, { recursive: true });
for (const name of ['privacy', 'terms', 'account-deletion']) {
  const source = await readFile(new URL(`../../api/public/${name}.html`, import.meta.url), 'utf8');
  const html = source.replace(/href="\/v1\/(privacy|terms|account-deletion)"/g, 'href="./$1.html"');
  await writeFile(path.join(output, `${name}.html`), html);
}
await copyFile(path.join(output, 'privacy.html'), path.join(output, 'index.html'));
await writeFile(path.join(output, '.nojekyll'), '');
