import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContents, safeTitle, parseTasks, validDate, monthCells } from '../client/extensions/notebook/parse.js';
import { categoryOptions, insertEntry, validCategory, validNoteTitle } from '../client/extensions/notebook/contentsEdit.js';

test('nested categories, order, Unicode and repeated note placement', () => {
  const result = parseContents('# Contents\n## Projects\n- [[Überblick & 10%]]\n### Reference\n- [[Guide]]\n## Reading\n- [[Guide]]');
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[0].children[0].label, 'Überblick & 10%');
  assert.equal(result.nodes[0].children[1].children[0].label, 'Guide');
  assert.equal(result.nodes[1].children[0].label, 'Guide');
});
test('headings skip levels and CRLF/editor whitespace are supported', () => {
  const a = parseContents('# Contents\r\n## Projects\r\n\r\n* [[Guide]]\r\n#### Deep ###\r\n+ [[Other]]');
  assert.equal(a.nodes[0].children[1].label, 'Deep');
  assert.equal(a.nodes[0].children[1].children[0].label, 'Other');
});
test('code blocks, HTML and arbitrary links are not navigation instructions', () => {
  const a = parseContents('```md\n## Hidden\n- [[Private]]\n```\n[Go](javascript:alert(1))\n<img src=x>\n## <script>alert(1)</script>\n- [[Safe]]');
  assert.equal(a.nodes.length, 1);
  assert.equal(a.nodes[0].label, '<script>alert(1)</script>');
  assert.equal(a.nodes[0].children[0].label, 'Safe');
  assert.equal(a.ignored, 2);
});
test('path and URL-like targets never become menu links', () => {
  for (const title of ['../x','..','/etc/passwd','C:\\x','https:evil','x\u0000y','x\ny','%2e%2e','a%2fb','a%255cb','[[x]]','']) {
    assert.equal(safeTitle(title), false, title);
    assert.equal(parseContents(`- [[${title}]]`).nodes.length, 0);
  }
  for (const title of ['Reading','日本語','Guide 10%','A & B','100% complete']) assert.equal(safeTitle(title), true);
});
test('parser refuses oversized UTF-8 input and entry counts', () => {
  assert.throws(() => parseContents('x'.repeat(262145)), /large/);
  assert.throws(() => parseContents('€'.repeat(90000)), /large/);
  assert.throws(() => parseContents('- [[A]]\n'.repeat(2001)), /many/);
  assert.equal(parseContents('').nodes.length, 0);
});
test('date sorting is stable, uses only valid dates, preserves source', () => {
  const source = '- [ ] 2026-12-01 — Later\n- [x] 2026-01-03 — Done\n- [ ] 2026-01-03 — Same day\n- [ ] 2026-02-30 — Invalid\n- [ ] undated';
  const a = parseTasks(source);
  assert.deepEqual(a.tasks.map(t => t.title), ['Done','Same day','Later']);
  assert.equal(a.tasks[0].done, true);
  assert.equal(a.ignored, 2);
  assert.ok(source.startsWith('- [ ] 2026-12-01'));
});
test('task text remains literal, fenced tasks are ignored', () => {
  const a = parseTasks('~~~\n- [ ] 2026-01-01 — hidden\n~~~\n* [ ] 2026-01-02 <img src=x onerror=alert(1)>');
  assert.equal(a.tasks.length, 1);
  assert.equal(a.tasks[0].title, '<img src=x onerror=alert(1)>');
});
test('calendar handles leap years and civil dates without UTC shifts', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const date of ['2026-02-29','1900-02-29','2026-13-01','2026-00-01','2026-01-00','0999-01-01']) assert.equal(validDate(date), false);
  assert.equal(validDate('2000-02-29'), true);
  const cells = monthCells(2024, 2);
  assert.equal(cells.filter(Boolean).length, 29);
  assert.equal(cells.find(Boolean).date, '2024-02-01');
  assert.equal(cells.length % 7, 0);
  assert.equal(monthCells(2026, 0).length, 0);
});

test('category controls insert nested headings and preserve unrelated bytes', () => {
  const source = '# Contents\r\nIntroduction stays.\r\n## Projects\r\n<!-- preserve -->\r\n- [[Guide]]\r\n## Other\r\nTail stays.';
  const parentId = parseContents(source).nodes[0].id;
  const updated = insertEntry(source, { kind: 'category', label: 'Reference', parentId });
  assert.equal(updated.replace('\r\n### Reference\r\n', ''), source);
  const nodes = parseContents(updated).nodes;
  assert.equal(nodes[0].children[1].label, 'Reference');
  assert.equal(nodes[1].label, 'Other');
  assert.deepEqual(categoryOptions(nodes).map(n => n.label), ['Projects', 'Projects / Reference', 'Other']);
});
test('note insertion belongs to selected parent, before its subcategories', () => {
  const source = '# Contents\n## A\n### Child\n- [[Child note]]\n## B\n';
  const updated = insertEntry(source, { kind: 'note', label: 'Parent note', parentId: 1 });
  const nodes = parseContents(updated).nodes;
  assert.equal(nodes[0].children[0].label, 'Parent note');
  assert.equal(nodes[0].children[1].children[0].label, 'Child note');
  const rootNote = parseContents(insertEntry(source, { kind: 'note', label: 'Top' })).nodes;
  assert.equal(rootNote[0].label, 'Top');
});
test('duplicate legacy headings are selected by source identity, not their labels', () => {
  const source = '# A\n## Same\n# B\n## Same\n';
  const nodes = parseContents(source).nodes;
  const parentId = nodes[1].children[0].id;
  const updated = parseContents(insertEntry(source, { kind: 'note', label: 'Only here', parentId })).nodes;
  assert.equal(updated[0].children[0].children.length, 0);
  assert.equal(updated[1].children[0].children[0].label, 'Only here');
  const extra = parseContents(insertEntry(source, { kind: 'category', label: 'C' })).nodes;
  assert.equal(extra[2].label, 'C');
});
test('insertion rejects injection, invalid selections, duplicates and excessive depth', () => {
  for (const label of ['', 'x\n## Injected', 'x\u0000y', 'x\u007fy', 'x ###', 'x'.repeat(129), '<img src=x>', '![image](remote)', '[link](remote)']) {
    assert.equal(validCategory(label), false);
    assert.throws(() => insertEntry('', {kind:'category',label}));
  }
  for (const label of ['../outside','a\\b','%2e%2e','x\n- [[Injected]]','日'.repeat(81)]) {
    assert.equal(validNoteTitle(label), false);
    assert.throws(() => insertEntry('', {kind:'note',label}));
  }
  assert.throws(() => insertEntry('', {kind:'category',label:'A',parentId:999}), /changed/);
  assert.throws(() => insertEntry('## A\n', {kind:'category',label:'A'}), /already/);
  assert.throws(() => insertEntry('# A\n', {kind:'category',label:'Contents'}), /reserved/);
  assert.throws(() => insertEntry('###### Deep\n', {kind:'category',label:'Too deep',parentId:1}), /six/);
  assert.equal(parseContents(insertEntry('###### Deep\n', {kind:'note',label:'Allowed',parentId:1})).nodes[0].children[0].label, 'Allowed');
});
test('insertion ignores code samples and refuses unfinished fences without modifying source', () => {
  const source = '```md\n## Fake\n```\n## Real\n';
  assert.equal(categoryOptions(parseContents(source).nodes).length, 1);
  assert.throws(() => insertEntry(source+'~~~\nunfinished', {kind:'category',label:'A'}), /unfinished/);
  const updated = insertEntry(source, {kind:'note',label:'Guide',parentId:1});
  assert.ok(updated.startsWith(source));
});
test('insertion applies byte/entry limits to the completed document', () => {
  assert.throws(() => insertEntry('- [[A]]\n'.repeat(2000), {kind:'category',label:'Overflow'}), /many/);
  assert.throws(() => insertEntry('x'.repeat(262140), {kind:'category',label:'Overflow'}), /large/);
  assert.equal(parseContents(insertEntry('', {kind:'category',label:'日本語 & ideas'})).nodes[0].label, '日本語 & ideas');
});
