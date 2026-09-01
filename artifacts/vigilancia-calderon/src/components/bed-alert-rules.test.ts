import assert from "node:assert/strict";
import test from "node:test";
import type { VigilanciaBed } from "@workspace/api-client-react";
import type { BedClinicalRecord } from "./bed-clinical-record";
import {
  ALERT_THRESHOLD_LIMITS,
  ALERT_THRESHOLDS,
  deriveAutomaticBedAlerts,
  getAutomaticAlertsForBed,
  normalizeAlertThresholds,
  validateAlertThresholds,
} from "./bed-alert-rules.ts";

const timestamp = "2026-08-29T12:00:00.000Z";

function bed(id = "201-a"): VigilanciaBed {
  const [room, label] = id.split("-");
  return {
    id,
    room,
    bed: label.toUpperCase(),
    patientCode: "Disponible",
    status: "stable",
    days: 0,
    alertCount: 0,
    isolation: "none",
  };
}

function record(overrides: Partial<BedClinicalRecord> = {}): BedClinicalRecord {
  return {
    occupied: true,
    patientCode: "AUTO-TEST",
    diagnosis: "",
    stayDays: 1,
    urinaryCatheterDays: "",
    nasogastricTubeDays: "",
    centralLineDays: "",
    cultureType: "none",
    cultureStatus: "pending",
    cultureOrganism: "",
    culturePositiveDate: "",
    rectalSwabStatus: "pending",
    rectalSwabOrganism: "",
    rectalSwabPositiveDate: "",
    isolation: "none",
    updatedAt: timestamp,
    ...overrides,
  };
}

test("genera cultivo, umbral urinario y combinación sin duplicar ids", () => {
  const thresholds = {
    urinaryCatheterDays: 4,
    centralLineDays: 10,
    nasogastricTubeDays: 12,
  };
  const alerts = getAutomaticAlertsForBed(bed("202-c"), record({
    urinaryCatheterDays: 4,
    centralLineDays: 9,
    nasogastricTubeDays: 11,
    cultureType: "urine",
    cultureStatus: "positive",
    cultureOrganism: "E. coli",
    culturePositiveDate: "2026-08-27",
  }), timestamp, thresholds);

  const derived = deriveAutomaticBedAlerts([bed("202-c")], {
    "202-c": record({
      urinaryCatheterDays: 4,
      centralLineDays: 9,
      nasogastricTubeDays: 11,
      cultureType: "urine",
      cultureStatus: "positive",
      cultureOrganism: "E. coli",
      culturePositiveDate: "2026-08-27",
    }),
  }, timestamp, thresholds);
  assert.deepEqual(alerts.map((alert) => alert.id), [
    "auto-202-c-culture-positive",
    "auto-202-c-urinary-threshold",
    "auto-202-c-device-culture-combination",
  ]);
  assert.deepEqual(derived, alerts);
  assert.equal(new Set(alerts.map((alert) => alert.id)).size, alerts.length);
  assert.match(alerts[0].detail, /E\. coli/);
  assert.equal(alerts[0].resultDate, "2026-08-27");
  assert.equal(alerts[0].createdAt, timestamp);
});

test("genera una señal independiente para hisopado rectal positivo sin dispositivo", () => {
  const clinicalRecord = record({
    rectalSwabStatus: "positive",
    rectalSwabOrganism: "K. pneumoniae",
    rectalSwabPositiveDate: "2026-08-28",
  });
  const alerts = getAutomaticAlertsForBed(bed("201-c"), clinicalRecord, timestamp);

  const derived = deriveAutomaticBedAlerts([bed("201-c")], {
    "201-c": clinicalRecord,
  }, timestamp);
  assert.deepEqual(alerts.map((alert) => alert.id), ["auto-201-c-rectal-swab-positive"]);
  assert.deepEqual(derived, alerts);
  assert.match(alerts[0].detail, /K\. pneumoniae/);
  assert.equal(alerts[0].resultDate, "2026-08-28");
  assert.equal(alerts[0].createdAt, timestamp);
});

test("mantiene legibles las alertas históricas sin fecha de resultado", () => {
  const alerts = getAutomaticAlertsForBed(bed("201-d"), record({
    cultureType: "blood",
    cultureStatus: "positive",
    cultureOrganism: "S. aureus",
    culturePositiveDate: "",
  }), timestamp);

  assert.equal(alerts[0].resultDate, undefined);
  assert.equal(alerts[0].createdAt, timestamp);
});

test("activa los umbrales exactos de vía central y sonda nasogástrica", () => {
  const central = getAutomaticAlertsForBed(bed("202-a"), record({
    centralLineDays: ALERT_THRESHOLDS.centralLineDays,
  }), timestamp);
  const nasogastric = getAutomaticAlertsForBed(bed("202-b"), record({
    nasogastricTubeDays: ALERT_THRESHOLDS.nasogastricTubeDays,
  }), timestamp);

  const thresholds = {
    urinaryCatheterDays: 4,
    centralLineDays: 10,
    nasogastricTubeDays: 12,
  };
  const belowThreshold = getAutomaticAlertsForBed(bed("203-a"), record({
    urinaryCatheterDays: ALERT_THRESHOLDS.urinaryCatheterDays - 1,
    centralLineDays: ALERT_THRESHOLDS.centralLineDays - 1,
    nasogastricTubeDays: ALERT_THRESHOLDS.nasogastricTubeDays - 1,
  }), timestamp);
  const available = getAutomaticAlertsForBed(bed("203-b"), record({
    occupied: false,
    urinaryCatheterDays: 20,
    cultureType: "blood",
    cultureStatus: "positive",
    cultureOrganism: "S. aureus",
    culturePositiveDate: "2026-08-27",
  }), timestamp);
  assert.deepEqual(central.map((alert) => alert.id), ["auto-202-a-central-threshold"]);
  assert.deepEqual(nasogastric.map((alert) => alert.id), ["auto-202-b-nasogastric-threshold"]);
  assert.deepEqual(belowThreshold, []);
  assert.deepEqual(available, []);
});

test("la derivación es determinística y conserva un solo id por regla", () => {
  const beds = [bed("204-a")];
  const records = {
    "204-a": record({
      centralLineDays: 7,
      cultureType: "blood",
      cultureStatus: "positive",
      cultureOrganism: "S. aureus",
      culturePositiveDate: "2026-08-27",
    }),
  };
  const first = deriveAutomaticBedAlerts(beds, records, timestamp);
  const second = deriveAutomaticBedAlerts(beds, records, timestamp);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((alert) => alert.id)).size, first.length);
});

test("valida y normaliza umbrales institucionales", () => {
  const errors = validateAlertThresholds({
    urinaryCatheterDays: ALERT_THRESHOLD_LIMITS.min - 1,
    centralLineDays: 7.5,
    nasogastricTubeDays: ALERT_THRESHOLD_LIMITS.max + 1,
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "centralLineDays",
    "nasogastricTubeDays",
    "urinaryCatheterDays",
  ]);
  assert.deepEqual(normalizeAlertThresholds({
    urinaryCatheterDays: 5,
    centralLineDays: 8,
    nasogastricTubeDays: 9,
  }), {
    urinaryCatheterDays: 5,
    centralLineDays: 8,
    nasogastricTubeDays: 9,
  });
});
