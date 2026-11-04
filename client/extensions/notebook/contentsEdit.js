import { LIMITS, parseContents, safeTitle } from './parse.js';

// IDs identify source positions in this exact source, never files or API paths.
export function categoryOptions(nodes, ancestors = []) {
  return nodes.filter(node => node.kind === 'category').flatMap(node => {
    const path = [...ancestors, node.label];
    return [{ id: node.id, label: path.join(' / '), level: node.level },
      ...categoryOptions(node.children, path)];
  });
}

function findCategory(nodes, id) {
  for (const node of nodes) {
    if (node.kind !== 'category') continue;
    if (node.id === id) return node;
    const found = findCategory(node.children, id);
    if (found) return found;
  }
}

export function validCategory(label) {
  return typeof label === 'string' && label.length > 0 && label.length <= 128 &&
    label === label.trim() && !/[<>\[\]`\u0000-\u001f\u007f]/.test(label) && !/\s#+$/.test(label);
}

export function validNoteTitle(title) {
  return safeTitle(title) && new TextEncoder().encode(title).length <= 240;
}

function lineOffset(source, line) {
  if (line === 0) return 0;
  let index = 0;
  for (const match of source.matchAll(/\r\n|\r|\n/g)) {
    if (++index === line) return match.index + match[0].length;
  }
  return source.length;
}

export function insertEntry(source, { kind, label, parentId = null }) {
  if (!['category', 'note'].includes(kind)) throw new Error('Choose a category or note.');
  if (kind === 'category' ? !validCategory(label) : !validNoteTitle(label)) {
    throw new Error(kind === 'category'
      ? 'Use a plain category name of 1–128 characters, on one line, without HTML, link brackets or trailing heading marks.'
      : 'Use a valid note title of at most 240 UTF-8 bytes, without path or link characters.');
  }
  const parsed = parseContents(source);
  if (parsed.unclosedFence) throw new Error('Close the unfinished code block in Contents before adding entries.');
  const parent = parentId === null ? null : findCategory(parsed.nodes, parentId);
  if (parentId !== null && !parent) throw new Error('This category has changed. Refresh contents and try again.');
  const siblings = parent ? parent.children : parsed.nodes;
  if (siblings.some(node => node.kind === kind && node.label.toLowerCase() === label.toLowerCase())) {
    throw new Error('This entry is already in the selected category.');
  }
  const level = parent ? parent.level + 1 : Math.min(2, ...parsed.nodes.filter(n => n.kind === 'category').map(n => n.level));
  if (kind === 'category' && level > 6) throw new Error('Categories can have at most six heading levels.');
  if (kind === 'category' && level === 1 && label === 'Contents') throw new Error('Contents is reserved as the menu heading. Choose another category name.');
  // Notes go before child headings; appending after them would link into a child.
  const firstChild = siblings.find(node => node.kind === 'category');
  const end = parent ? parent.endLine : source.split(/\r\n|\r|\n/).length;
  const line = kind === 'note' && firstChild ? firstChild.line : end;
  const offset = lineOffset(source, line);
  const newline = /\r\n|\r|\n/.exec(source)?.[0] || '\n';
  const before = source.slice(0, offset);
  const separator = before && !/[\r\n]$/.test(before) ? newline : '';
  const entry = kind === 'category' ? `${newline}${'#'.repeat(level)} ${label}${newline}` : `- [[${label}]]${newline}`;
  const result = before + separator + entry + source.slice(offset);
  // Validate resulting UTF-8 bytes/entry count too; never truncate old content.
  parseContents(result);
  if (new TextEncoder().encode(result).length > LIMITS.bytes) throw new Error('Contents is too large.');
  return result;
}
