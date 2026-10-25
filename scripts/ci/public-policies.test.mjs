import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

test('public policy artifact preserves policy wording and has working local links', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'civiclens-policies-'));
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL('./public-policies.mjs', import.meta.url)), output]);
    assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', 'account-deletion.html', 'index.html', 'privacy.html', 'terms.html']);
    const text = html => html.match(/<main>([\s\S]*?)<\/main>/)[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    for (const name of ['privacy', 'terms', 'account-deletion']) {
      const source = await readFile(new URL(`../../api/public/${name}.html`, import.meta.url), 'utf8');
      const html = await readFile(path.join(output, `${name}.html`), 'utf8');
      assert.equal(text(html), text(source), `${name} policy text changed`);
      assert.match(html, /<meta name="viewport"/);
      assert.match(html, /mailto:sales@tesserix\.app/);
      assert.doesNotMatch(html, /href="\/v1\/|<script|<form/i);
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (!/^(https:|mailto:)/.test(href)) {
          assert.ok((await stat(path.join(output, href))).isFile(), `broken ${name} link: ${href}`);
        }
      }
    }
    assert.match(await readFile(path.join(output, 'terms.html'), 'utf8'), /id="child-safety"/);
    assert.match(await readFile(path.join(output, 'account-deletion.html'), 'utf8'), /Without the app/);
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), await readFile(path.join(output, 'privacy.html'), 'utf8'));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
