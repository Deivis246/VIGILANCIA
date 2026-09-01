import assert from "node:assert/strict";
import test from "node:test";

type TestPredictionRecord = {
  bedId: string;
  occupied: boolean;
  urinaryCatheterDays: number | null;
  nasogastricTubeDays: number | null;
  centralLineDays: number | null;
  cultureStatus: string;
  cultureOrganism: string;
  culturePositiveDate: string | null;
  rectalSwabStatus: string;
  rectalSwabOrganism: string;
  rectalSwabPositiveDate: string | null;
  isolation: string;
};

const moduleUrl = new URL("./vigilancia-prediction.ts", import.meta.url).href;
const predictionModule = await import(moduleUrl);
const buildOutbreakPredictionInput = predictionModule.buildOutbreakPredictionInput as (
  records: TestPredictionRecord[],
  bedRooms: ReadonlyMap<string, string>,
  currentDate?: Date,
) => {
  coverage: Record<string, unknown>;
  areas: Array<{ positiveResults: number }>;
  evidence: {
    evidenceWindowDays: number;
    recentDatedPositiveResults: number;
    minimumRecentDatedPositiveResults: number;
  };
};
const getMissingPredictionEvidence = predictionModule.getMissingPredictionEvidence as (
  input: ReturnType<typeof buildOutbreakPredictionInput>,
) => string[];

function record(overrides: Partial<TestPredictionRecord> = {}): TestPredictionRecord & {
  patientCode: string;
  diagnosis: string;
} {
  return {
    bedId: "201-a",
    occupied: true,
    patientCode: "PACIENTE-SECRETO-001",
    diagnosis: "DIAGNOSTICO-PRIVADO",
    urinaryCatheterDays: 6,
    nasogastricTubeDays: null,
    centralLineDays: null,
    cultureStatus: "positive",
    cultureOrganism: "E. coli",
    culturePositiveDate: "2026-08-29",
    rectalSwabStatus: "pending",
    rectalSwabOrganism: "",
    rectalSwabPositiveDate: null,
    isolation: "contact",
    ...overrides,
  };
}

test("agrega señales por sala sin incluir códigos ni diagnósticos", () => {
  const input = buildOutbreakPredictionInput(
    [
      record(),
      record({
        bedId: "201-b",
        cultureStatus: "negative",
        cultureOrganism: "",
        culturePositiveDate: null,
        rectalSwabStatus: "positive",
        rectalSwabOrganism: "K. pneumoniae",
        rectalSwabPositiveDate: "2026-08-30",
      }),
    ],
    new Map([["201-a", "201"], ["201-b", "201"]]),
  );

  assert.deepEqual(input.coverage, {
    savedRecords: 2,
    occupiedBeds: 2,
    positiveCultures: 1,
    positiveSwabs: 1,
    datedPositiveResults: 2,
    periodStart: "2026-08-29",
    periodEnd: "2026-08-30",
  });
  assert.equal(input.areas.length, 1);
  assert.equal(input.areas[0]?.positiveResults, 2);
  const serialized = JSON.stringify(input);
  assert.doesNotMatch(serialized, /PACIENTE-SECRETO-001/);
  assert.doesNotMatch(serialized, /DIAGNOSTICO-PRIVADO/);
  assert.doesNotMatch(serialized, /E\. coli|K\. pneumoniae/);
  assert.doesNotMatch(serialized, /patientCode|diagnosis/);
});

test("no cuenta resultados de registros no ocupados como señales activas", () => {
  const input = buildOutbreakPredictionInput(
    [record({ occupied: false })],
    new Map([["201-a", "201"]]),
  );

  assert.equal(input.coverage.occupiedBeds, 0);
  assert.equal(input.coverage.positiveCultures, 0);
  assert.equal(input.areas.length, 0);
  assert.equal(input.coverage.datedPositiveResults, 0);
});

test("exige dos resultados positivos fechados y recientes antes de invocar Gemini", () => {
  const rooms = new Map([["201-a", "201"], ["201-b", "201"]]);
  const insufficient = buildOutbreakPredictionInput(
    [
      record({ culturePositiveDate: "2026-01-01" }),
      record({ bedId: "201-b", culturePositiveDate: null }),
    ],
    rooms,
    new Date("2026-08-30T12:00:00.000Z"),
  );
  assert.equal(insufficient.evidence.recentDatedPositiveResults, 0);
  assert.ok(getMissingPredictionEvidence(insufficient).some((item) => item.includes("últimos 30 días")));

  const sufficient = buildOutbreakPredictionInput(
    [
      record({ culturePositiveDate: "2026-08-29" }),
      record({ bedId: "201-b", culturePositiveDate: "2026-08-30" }),
    ],
    rooms,
    new Date("2026-08-30T12:00:00.000Z"),
  );
  assert.deepEqual(getMissingPredictionEvidence(sufficient), []);
});