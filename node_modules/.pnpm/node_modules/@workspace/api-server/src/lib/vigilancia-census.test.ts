import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { inArray } from "drizzle-orm";
import { db, vigilanciaBedRecordsTable } from "@workspace/db";
import {
  applyVigilanciaBedRecordOperations,
  type VigilanciaBedRecordOperation,
} from "./vigilancia-census";

function recordValues(bedId: string, patientCode: string) {
  return {
    bedId,
    occupied: true,
    patientCode,
    diagnosis: "",
    stayDays: null,
    urinaryCatheterDays: null,
    nasogastricTubeDays: null,
    centralLineDays: null,
    cultureType: "none",
    cultureStatus: "pending",
    cultureOrganism: "",
    culturePositiveDate: null,
    rectalSwabStatus: "pending",
    rectalSwabOrganism: "",
    rectalSwabPositiveDate: null,
    isolation: "none",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("revierte todas las filas si una operación transaccional falla", async () => {
  const suffix = randomUUID();
  const firstBedId = `rollback-first-${suffix}`;
  const secondBedId = `rollback-second-${suffix}`;
  const bedIds = [firstBedId, secondBedId];

  try {
    await db.insert(vigilanciaBedRecordsTable).values(recordValues(firstBedId, "ORIGINAL"));

    const operations: VigilanciaBedRecordOperation[] = [
      { kind: "upsert", values: recordValues(firstBedId, "MODIFICADO") },
      { kind: "upsert", values: recordValues(secondBedId, "NUEVO") },
    ];

    await assert.rejects(
      applyVigilanciaBedRecordOperations(operations, {
        afterOperation(index) {
          if (index === 0) throw new Error("Fallo transaccional simulado");
        },
      }),
      /Fallo transaccional simulado/,
    );

    const stored = await db
      .select()
      .from(vigilanciaBedRecordsTable)
      .where(inArray(vigilanciaBedRecordsTable.bedId, bedIds));

    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.bedId, firstBedId);
    assert.equal(stored[0]?.patientCode, "ORIGINAL");
    assert.equal(stored[0]?.updatedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  } finally {
    await db
      .delete(vigilanciaBedRecordsTable)
      .where(inArray(vigilanciaBedRecordsTable.bedId, bedIds));
  }
});