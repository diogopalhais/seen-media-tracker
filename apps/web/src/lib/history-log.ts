/**
 * Minimal record of the paths this session has visited, in order. Lets in-app Back decide whether the
 * previous browser entry belongs to the current tab (then pop) or to another tab (then jump to the parent).
 */
const log: string[] = [];

export function recordVisit(path: string): void {
  if (log[log.length - 1] === path) return;
  log.push(path);
  if (log.length > 200) log.shift();
}

export function previousVisit(): string | undefined {
  return log[log.length - 2];
}

export function tabRootOf(path: string): string {
  const seg = path.split('/')[1];
  return seg ? `/${seg}` : '/';
}
