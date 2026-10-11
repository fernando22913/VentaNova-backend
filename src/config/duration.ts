const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

// Convierte una duración compacta como "1h" o "7d" a segundos (sin dependencias a propósito).
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}" (expected a value like "1h" or "7d")`);
  }

  const [, rawAmount, rawUnit] = match;
  const amount = Number(rawAmount);
  const multiplier = rawUnit ? UNIT_SECONDS[rawUnit as keyof typeof UNIT_SECONDS] : undefined;

  if (!Number.isSafeInteger(amount) || amount <= 0 || multiplier === undefined) {
    throw new Error(`Invalid duration "${value}" (expected a positive value like "1h" or "7d")`);
  }

  return amount * multiplier;
}
