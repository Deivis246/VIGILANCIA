import assert from "node:assert/strict";
import test from "node:test";
import { readMigratedJson } from "./local-storage-migration.ts";

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("storage full");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

test("migra datos heredados a v2 antes de retirar la clave anterior", () => {
  const storage = new MemoryStorage();
  const legacy = { "201-a": { patientCode: "PRESERVAR" } };
  storage.values.set("legacy", JSON.stringify(legacy));

  const result = readMigratedJson(storage, "v2", "legacy", {}, isRecord);

  assert.deepEqual(result, legacy);
  assert.equal(storage.getItem("v2"), JSON.stringify(legacy));
  assert.equal(storage.getItem("legacy"), null);
});

test("no sobrescribe datos v2 existentes con información heredada", () => {
  const storage = new MemoryStorage();
  storage.values.set("v2", JSON.stringify({ current: true }));
  storage.values.set("legacy", JSON.stringify({ old: true }));

  const result = readMigratedJson(storage, "v2", "legacy", {}, isRecord);

  assert.deepEqual(result, { current: true });
  assert.equal(storage.getItem("legacy"), JSON.stringify({ old: true }));
});

test("conserva y devuelve los datos heredados si no puede escribir v2", () => {
  const storage = new MemoryStorage();
  const legacy = { "201-b": { patientCode: "SIN-PERDER" } };
  storage.values.set("legacy", JSON.stringify(legacy));
  storage.failWrites = true;

  const result = readMigratedJson(storage, "v2", "legacy", {}, isRecord);

  assert.deepEqual(result, legacy);
  assert.equal(storage.getItem("v2"), null);
  assert.equal(storage.getItem("legacy"), JSON.stringify(legacy));
});

test("preserva listas heredadas como las capturas del turno", () => {
  const storage = new MemoryStorage();
  const captures = [{ id: 1, category: "Censo", value: "18 pacientes" }];
  storage.values.set("captures-legacy", JSON.stringify(captures));

  const result = readMigratedJson(
    storage,
    "captures-v2",
    "captures-legacy",
    [] as unknown[],
    (value): value is unknown[] => Array.isArray(value),
  );

  assert.deepEqual(result, captures);
  assert.equal(storage.getItem("captures-v2"), JSON.stringify(captures));
  assert.equal(storage.getItem("captures-legacy"), null);
});