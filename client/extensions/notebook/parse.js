// Deliberately small data grammar. Never interpret these strings as HTML or paths.
export const LIMITS = Object.freeze({ bytes: 262144, entries: 2000, label: 256 });

function checkedText(content) {
  if (typeof content !== 'string' || content.length > LIMITS.bytes ||
      new TextEncoder().encode(content).length > LIMITS.bytes) {
    throw new Error('Note is too large for this view (maximum 256 KiB).');
  }
  return content.replace(/\r\n?/g, '\n');
}

export function safeTitle(title) {
  return typeof title === 'string' && title.length > 0 && title.length <= LIMITS.label &&
    title === title.trim() && !/^[. ]+$/.test(title) &&
    !/[<>:"/\\|?*\[\]\u0000-\u001f\u007f]/.test(title) &&
    !/%(?:2e|2f|5c|00|25)/i.test(title);
}

function scannedLines(content) {
  let fence = null;
  const result = [];
  const lines = checkedText(content).split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length &&
               /^ {0,3}(?:`+|~+)\s*$/.test(line)) fence = null;
      continue;
    }
    if (!fence) result.push({ line, index });
  }
  return { lines: result, length: lines.length, unclosedFence: Boolean(fence) };
}

function dataLines(content) {
  return scannedLines(content).lines.map(entry => entry.line);
}

export function parseContents(content) {
  const root = [];
  const stack = [{ level: 0, children: root }];
  let count = 0;
  let ignored = 0;
  const scanned = scannedLines(content);
  for (const { line, index } of scanned.lines) {
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    const link = /^\s*[-*+]\s+\[\[([^\[\]]+)\]\]\s*$/.exec(line);
    if (!heading && !link) { if (line.trim()) ignored++; continue; }
    const label = (heading ? heading[2].replace(/\s+#+$/, '') : link[1]).trim();
    if (heading && heading[1].length === 1 && label === 'Contents') continue;
    if (!label || label.length > LIMITS.label || (!heading && !safeTitle(label))) {
      ignored++;
      continue;
    }
    if (++count > LIMITS.entries) throw new Error('Too many menu entries (maximum 2000).');
    const node = { id: count, label, kind: heading ? 'category' : 'note', line: index };
    if (heading) {
      const level = heading[1].length;
      while (stack.length > 1 && stack.at(-1).level >= level) stack.pop().node.endLine = index;
      node.level = level;
      node.endLine = scanned.length;
      node.children = [];
      stack.at(-1).children.push(node);
      stack.push({ level, children: node.children, node });
    } else stack.at(-1).children.push(node);
  }
  return { nodes: root, ignored, unclosedFence: scanned.unclosedFence };
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[m - 1];
}

export function parseTasks(content) {
  const tasks = [];
  let ignored = 0;
  for (const line of dataLines(content)) {
    const task = /^\s*[-*+]\s+\[([ xX])\]\s+(\d{4}-\d{2}-\d{2})(?:\s+[—–-]\s+|\s+)(.+?)\s*$/.exec(line);
    if (!task) { if (/^\s*[-*+]\s+\[[ xX]\]/.test(line)) ignored++; continue; }
    if (!validDate(task[2]) || task[3].length > 2000) { ignored++; continue; }
    if (tasks.length >= LIMITS.entries) throw new Error('Too many tasks (maximum 2000).');
    tasks.push({ id: tasks.length, done: task[1] !== ' ', date: task[2], title: task[3] });
  }
  tasks.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return { tasks, ignored };
}

export function monthCells(year, month) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12) return [];
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const key = `${year}-${String(month).padStart(2, '0')}-`;
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= 31; d++) {
    const date = key + String(d).padStart(2, '0');
    if (validDate(date)) cells.push({ date, day: d });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
