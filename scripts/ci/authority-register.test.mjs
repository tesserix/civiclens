import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/authorities/refresh_australia.py');
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'civiclens-register-'));
  const abs = join(dir, 'areas.json');
  const government = join(dir, 'government.xml');
  writeFileSync(abs, JSON.stringify({ features: [
    { attributes: { LGA_CODE_2026: '24600', LGA_NAME_2026: 'Melbourne', STATE_CODE_2026: '2', STATE_NAME_2026: 'Victoria' } },
    { attributes: { LGA_CODE_2026: '29399', LGA_NAME_2026: 'Unincorporated Vic', STATE_CODE_2026: '2', STATE_NAME_2026: 'Victoria' } },
  ] }));
  writeFileSync(government, '<response>' + [
    '<item><content_id>1</content_id><type>organisation</type><title>Environment Department</title><website>https://environment.gov.au/</website><email>private@example.invalid</email></item>',
    '<item><content_id>2</content_id><type>portfolio_role</type><title>Minister for the Environment</title><contact>3</contact><role_belongs_to>1</role_belongs_to></item>',
    '<item><content_id>3</content_id><type>person</type><title>Test Minister</title></item>',
    '<item><content_id>4</content_id><type>person</type><title>Unrelated Person</title></item>',
  ].join('') + '</response>');
  const args = [script, '--abs-file', abs, '--government-file', government, '--retrieved-at', '2026-10-24T00:00:00Z', '--output-dir', join(dir, 'out')];
  return { dir, abs, government, args };
}

test('imports source-backed reference records without declaring statistical areas verified councils', () => {
  const f = fixture();
  try {
    const result = spawnSync('python3', f.args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const abs = JSON.parse(readFileSync(join(f.dir, 'out/abs-2026.json'), 'utf8'));
    assert.equal(abs.sourceId, 'au-abs-lga-2026');
    assert.equal(abs.records.length, 2);
    assert.equal(abs.records[0].kind, 'statistical_area');
    assert.equal(abs.records[0].details.statisticalOnly, true);
    assert.equal(abs.records[1].details.specialArea, true);
    assert.equal(abs.records[0].verificationStatus, 'reference');
    assert.match(abs.upstreamSha256, /^[a-f0-9]{64}$/);
    const government = JSON.parse(readFileSync(join(f.dir, 'out/commonwealth.json'), 'utf8'));
    assert.deepEqual(government.records.map(r => r.kind).sort(), ['officeholder', 'organisation', 'role']);
    assert.equal(government.records.find(r => r.kind === 'role').details.personId, '3');
    assert.equal(government.records.find(r => r.kind === 'officeholder').name, 'Test Minister');
    assert.ok(!JSON.stringify(government).includes('private@example.invalid'));
    assert.ok(!JSON.stringify(government).includes('Unrelated Person'));
  } finally { rmSync(f.dir, { recursive: true }); }
});

test('rejects truncated national responses and XML entity declarations before producing snapshots', () => {
  for (const invalid of ['truncated', 'entities', 'entities_utf16', 'duplicate']) {
    const f = fixture();
    try {
      if (invalid === 'truncated') writeFileSync(f.abs, JSON.stringify({ exceededTransferLimit: true, features: [] }));
      if (invalid === 'entities') writeFileSync(f.government, '<!DOCTYPE response [<!ENTITY x "bad">]><response/>');
      if (invalid === 'entities_utf16') writeFileSync(f.government, Buffer.from('<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE response [<!ENTITY x "Injected Entity">]><response><item><content_id>1</content_id><type>organisation</type><title>&x;</title></item></response>', 'utf16le'));
      if (invalid === 'duplicate') writeFileSync(f.government, '<response><item><content_id>1</content_id><type>organisation</type><title>A</title></item><item><content_id>1</content_id><type>organisation</type><title>B</title></item></response>');
      const result = spawnSync('python3', f.args, { encoding: 'utf8' });
      assert.notEqual(result.status, 0, invalid);
      assert.match(result.stderr, /Import preparation rejected:/);
      assert.match(result.stderr, invalid === 'truncated' ? /truncated/ : invalid.startsWith('entities') ? /entity declarations/ : /duplicate/);
    } finally { rmSync(f.dir, { recursive: true }); }
  }
});

test('imports a complete Victorian council list and retains leadership links without copying contacts', () => {
  const f = fixture();
  try {
    const areas = Array.from({ length: 79 }, (_, n) => ({ attributes: {
      LGA_CODE_2026: String(20000 + n), LGA_NAME_2026: n === 0 ? 'Area 0 (Vic)' : `Area ${n}`, STATE_CODE_2026: '2', STATE_NAME_2026: 'Victoria',
    } }));
    writeFileSync(f.abs, JSON.stringify({ features: areas }));
    const html = join(f.dir, 'victoria.html');
    writeFileSync(html, '<table id="table19340"><tr>' + areas.map((_, n) => `<td>Area ${n} Shire Council<div>Ph: 1234567 Email: <a href="mailto:private@example.invalid">private@example.invalid</a>Website: <a href="https://area${n}.vic.gov.au/">Area ${n} Shire Council</a>Councillors: <a href="https://area${n}.vic.gov.au/councillors">Area ${n} councillors</a></div></td>`).join('') + '</tr></table>');
    const result = spawnSync('python3', [...f.args, '--victoria-html', html], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(readFileSync(join(f.dir, 'out/victoria-councils.json'), 'utf8'));
    assert.equal(data.records.length, 79);
    assert.equal(data.records[0].id, '20000');
    assert.equal(data.records[0].kind, 'organisation');
    assert.equal(data.records[0].details.councillorsUrl, 'https://area0.vic.gov.au/councillors');
    assert.equal(data.records[0].details.mayorVerified, false);
    assert.ok(!JSON.stringify(data).includes('private@example.invalid'));
    assert.ok(!JSON.stringify(data).includes('1234567'));
    writeFileSync(html, '<table id="table19340"><tr><td>Partial Council</td></tr></table>');
    const partial = spawnSync('python3', [...f.args, '--victoria-html', html], { encoding: 'utf8' });
    assert.notEqual(partial.status, 0);
    assert.match(partial.stderr, /79/);
  } finally { rmSync(f.dir, { recursive: true }); }
});

test('uses open council data only as candidates linked to an unambiguous current area', () => {
  const f = fixture();
  try {
    const wiki = join(f.dir, 'wikidata.json');
    const value = v => ({ value: v });
    writeFileSync(wiki, JSON.stringify({ results: { bindings: [
      { council: value('http://www.wikidata.org/entity/Q1'), councilLabel: value('City of Melbourne'), regionCode: value('AU-VIC'), website: value('https://melbourne.vic.gov.au/'), leader: value('http://www.wikidata.org/entity/Q2'), leaderLabel: value('Test Mayor') },
      { council: value('http://www.wikidata.org/entity/Q3'), councilLabel: value('Former Example Shire'), regionCode: value('AU-VIC'), website: value('https://former.invalid/') },
    ] } }));
    const result = spawnSync('python3', [...f.args, '--wikidata-file', wiki], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(readFileSync(join(f.dir, 'out/wikidata-councils.json'), 'utf8'));
    assert.equal(data.records.length, 3);
    const council = data.records.find(r => r.kind === 'organisation');
    assert.equal(council.details.absRecordId, '24600');
    assert.equal(council.officialUrl, null);
    assert.equal(council.details.tenureNotVerified, true);
    assert.deepEqual(council.details.candidateWebsiteUrls, ['https://melbourne.vic.gov.au/']);
    assert.ok(!JSON.stringify(data).includes('Former Example Shire'));
    assert.equal(data.records.find(r => r.kind === 'officeholder').verificationStatus, 'reference');
  } finally { rmSync(f.dir, { recursive: true }); }
});

test('matches Aboriginal shire and conjunction naming forms to their current state-specific identities', () => {
  const f = fixture();
  try {
    writeFileSync(f.abs, JSON.stringify({ features: [
      { attributes: { LGA_CODE_2026: '32330', LGA_NAME_2026: 'Cherbourg', STATE_CODE_2026: '3', STATE_NAME_2026: 'Queensland' } },
      { attributes: { LGA_CODE_2026: '40520', LGA_NAME_2026: 'Berri Barmera', STATE_CODE_2026: '4', STATE_NAME_2026: 'South Australia' } },
    ] }));
    const value = v => ({ value: v });
    const wiki = join(f.dir, 'wiki.json');
    writeFileSync(wiki, JSON.stringify({ results: { bindings: [
      { council: value('http://www.wikidata.org/entity/Q1'), councilLabel: value('Aboriginal Shire of Cherbourg'), regionCode: value('AU-QLD') },
      { council: value('http://www.wikidata.org/entity/Q2'), councilLabel: value('Berri and Barmera'), regionCode: value('AU-SA') },
    ] } }));
    const result = spawnSync('python3', [...f.args, '--wikidata-file', wiki], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(readFileSync(join(f.dir, 'out/wikidata-councils.json'), 'utf8'));
    assert.deepEqual(data.records.map(r => r.details.absRecordId).sort(), ['32330', '40520']);
  } finally { rmSync(f.dir, { recursive: true }); }
});
