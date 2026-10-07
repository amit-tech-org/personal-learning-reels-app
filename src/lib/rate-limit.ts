const unlocks = new Map<string, { start: number; count: number }>();

export function consumeUnlockAttempt(ip: string, now = Date.now()): boolean {
  const current = unlocks.get(ip);
  if (!current || now - current.start >= 60_000) {
    unlocks.set(ip, { start: now, count: 1 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}
