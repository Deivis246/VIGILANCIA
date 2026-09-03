type JsonStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readMigratedJson<T>(
  storage: JsonStorage,
  currentKey: string,
  legacyKey: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  const currentRaw = storage.getItem(currentKey);
  if (currentRaw !== null) {
    try {
      const currentValue: unknown = JSON.parse(currentRaw);
      return isValid(currentValue) ? currentValue : fallback;
    } catch {
      return fallback;
    }
  }

  const legacyRaw = storage.getItem(legacyKey);
  if (legacyRaw === null) return fallback;

  try {
    const legacyValue: unknown = JSON.parse(legacyRaw);
    if (!isValid(legacyValue)) return fallback;

    try {
      storage.setItem(currentKey, JSON.stringify(legacyValue));
    } catch {
      return legacyValue;
    }

    try {
      storage.removeItem(legacyKey);
    } catch {
      // The v2 copy is already durable; a leftover legacy key is harmless.
    }
    return legacyValue;
  } catch {
    return fallback;
  }
}