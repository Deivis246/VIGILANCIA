import type { VigilanciaAlert, VigilanciaBed } from "@workspace/api-client-react";
import type { BedClinicalRecord, BedClinicalRecords } from "./bed-clinical-record";

export type AutomaticVigilanciaAlert = VigilanciaAlert & {
  resultDate?: string;
};

export const ALERT_THRESHOLDS = {
  urinaryCatheterDays: 6,
  centralLineDays: 7,
  nasogastricTubeDays: 7,
} as const;

export type AlertThresholdKey = keyof typeof ALERT_THRESHOLDS;
function cultureName(type: BedClinicalRecord["cultureType"]) {
  return {
    urine: "Urocultivo",
    blood: "Hemocultivo",
    respiratory: "Cultivo respiratorio",
    other: "Otro cultivo",
    none: "Cultivo",
  }[type];
}

function bedContext(bed: VigilanciaBed, record: BedClinicalRecord) {
  return {
    patientCode: record.patientCode || bed.patientCode || `Cama ${bed.room}-${bed.bed}`,
    location: `Áreas clínicas · ${bed.room}-${bed.bed}`,
  };
}

function bedRecordDefaults(bed: VigilanciaBed): BedClinicalRecord {
  return {
    occupied: bed.patientCode !== "Disponible",
    patientCode: bed.patientCode === "Disponible" ? "" : bed.patientCode,
    diagnosis: "",
    stayDays: bed.days || "",
    urinaryCatheterDays: bed.urinaryCatheterDays || "",
    nasogastricTubeDays: bed.nasogastricTubeDays || "",
    centralLineDays: bed.centralLineDays || "",
    cultureType: bed.cultureType ?? "none",
    cultureStatus: bed.cultureStatus ?? "pending",
    cultureOrganism: bed.cultureOrganism ?? "",
    culturePositiveDate: "",
    rectalSwabStatus: bed.rectalSwabStatus ?? "pending",
    rectalSwabOrganism: bed.rectalSwabOrganism ?? "",
    rectalSwabPositiveDate: "",
    isolation: bed.isolation ?? "none",
    updatedAt: "",
  };
}

export function getAutomaticAlertsForBed(
  bed: VigilanciaBed,
  localRecord?: BedClinicalRecord,
  timestamp = "",
  thresholds: AlertThresholds = ALERT_THRESHOLDS,
): AutomaticVigilanciaAlert[] {
  const record = { ...bedRecordDefaults(bed), ...localRecord };
  if (!record.occupied) return [];

  const context = bedContext(bed, record);
  const alerts: AutomaticVigilanciaAlert[] = [];
  const createdAt = record.updatedAt || timestamp;
  const deviceDays = [
    record.urinaryCatheterDays,
    record.centralLineDays,
    record.nasogastricTubeDays,
  ].map((days) => Number(days) || 0);
  const hasActiveDevice = deviceDays.some((days) => days > 0);
  const hasPositiveCulture = record.cultureType !== "none" && record.cultureStatus === "positive";
  const hasPositiveSwab = record.rectalSwabStatus === "positive";
  const organism = record.cultureOrganism || "bacteria pendiente de tipificación";

  if (hasPositiveCulture) {
    alerts.push({
      id: `auto-${bed.id}-culture-positive`,
      level: "critical",
      title: `${cultureName(record.cultureType)} positivo`,
      ...context,
      detail: `${organism}. Señal automática para revisión microbiológica; no confirma una infección.`,
      ...(record.culturePositiveDate ? { resultDate: record.culturePositiveDate } : {}),
      createdAt,
      status: "active",
    });
  }

  if (hasPositiveSwab) {
    alerts.push({
      id: `auto-${bed.id}-rectal-swab-positive`,
      level: "critical",
      title: "Hisopado rectal positivo",
      ...context,
      detail: `${record.rectalSwabOrganism || "Bacteria pendiente de tipificación"}. Confirmar precauciones y revisión epidemiológica.`,
      ...(record.rectalSwabPositiveDate ? { resultDate: record.rectalSwabPositiveDate } : {}),
      createdAt,
      status: "active",
    });
  }

  if (Number(record.urinaryCatheterDays) >= thresholds.urinaryCatheterDays) {
    alerts.push({
      id: `auto-${bed.id}-urinary-threshold`,
      level: "warning",
      title: "Revisión de sonda vesical",
      ...context,
      detail: `${record.urinaryCatheterDays} días de uso. Confirmar indicación y necesidad de continuidad.`,
      createdAt,
      status: "active",
    });
  }

  if (Number(record.centralLineDays) >= thresholds.centralLineDays) {
    alerts.push({
      id: `auto-${bed.id}-central-threshold`,
      level: "warning",
      title: "Revisión de vía central",
      ...context,
      detail: `${record.centralLineDays} días de uso. Confirmar indicación, sitio y necesidad de continuidad.`,
      createdAt,
      status: "active",
    });
  }

  if (Number(record.nasogastricTubeDays) >= thresholds.nasogastricTubeDays) {
    alerts.push({
      id: `auto-${bed.id}-nasogastric-threshold`,
      level: "warning",
      title: "Revisión de sonda nasogástrica",
      ...context,
      detail: `${record.nasogastricTubeDays} días de uso. Confirmar indicación y cuidados asociados.`,
      createdAt,
      status: "active",
    });
  }

  if (hasActiveDevice && (hasPositiveCulture || hasPositiveSwab)) {
    alerts.push({
      id: `auto-${bed.id}-device-culture-combination`,
      level: "critical",
      title: "Dispositivo y resultado microbiológico positivo",
      ...context,
      detail: "Señal combinada de prioridad alta reforzada. Revisar foco, dispositivo y medidas de prevención.",
      createdAt,
      status: "active",
    });
  }

  return alerts;
}

export function deriveAutomaticBedAlerts(
  beds: VigilanciaBed[],
  records: BedClinicalRecords,
  timestamp = "",
  thresholds: AlertThresholds = ALERT_THRESHOLDS,
) {
  return beds.flatMap((bed) => getAutomaticAlertsForBed(bed, records[bed.id], timestamp, thresholds));
}

export const ALERT_THRESHOLD_LABELS: Record<AlertThresholdKey, string> = {
  urinaryCatheterDays: "Sonda vesical",
  centralLineDays: "Vía central",
  nasogastricTubeDays: "Sonda nasogástrica",
};

export function validateAlertThresholds(values: AlertThresholds) {
  const errors: Partial<Record<AlertThresholdKey, string>> = {};
  for (const key of Object.keys(ALERT_THRESHOLDS) as AlertThresholdKey[]) {
    const value = values[key];
    if (!Number.isInteger(value)) {
      errors[key] = "Usa un número entero.";
    } else if (value < ALERT_THRESHOLD_LIMITS.min || value > ALERT_THRESHOLD_LIMITS.max) {
      errors[key] = `Debe estar entre ${ALERT_THRESHOLD_LIMITS.min} y ${ALERT_THRESHOLD_LIMITS.max} días.`;
    }
  }
  return errors;
}

export function readAlertThresholds(): AlertThresholds {
  if (typeof localStorage === "undefined") return { ...ALERT_THRESHOLDS };
  try {
    return normalizeAlertThresholds(JSON.parse(localStorage.getItem(ALERT_THRESHOLDS_STORAGE_KEY) || "null"));
  } catch {
    return { ...ALERT_THRESHOLDS };
  }
}

export const ALERT_THRESHOLD_LIMITS = {
  min: 1,
  max: 30,
} as const;

function isValidThresholdValue(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= ALERT_THRESHOLD_LIMITS.min
    && value <= ALERT_THRESHOLD_LIMITS.max;
}

export type AlertThresholds = Record<AlertThresholdKey, number>;

export function normalizeAlertThresholds(value: unknown): AlertThresholds {
  if (!value || typeof value !== "object") return { ...ALERT_THRESHOLDS };
  const candidate = value as Partial<Record<AlertThresholdKey, unknown>>;
  return {
    urinaryCatheterDays: isValidThresholdValue(candidate.urinaryCatheterDays) ? candidate.urinaryCatheterDays : ALERT_THRESHOLDS.urinaryCatheterDays,
    centralLineDays: isValidThresholdValue(candidate.centralLineDays) ? candidate.centralLineDays : ALERT_THRESHOLDS.centralLineDays,
    nasogastricTubeDays: isValidThresholdValue(candidate.nasogastricTubeDays) ? candidate.nasogastricTubeDays : ALERT_THRESHOLDS.nasogastricTubeDays,
  };
}

export const ALERT_THRESHOLDS_STORAGE_KEY = "vigilancia-umbrales-alerta";

export function writeAlertThresholds(values: AlertThresholds) {
  const errors = validateAlertThresholds(values);
  if (Object.keys(errors).length) throw new Error("Los umbrales institucionales no son válidos.");
  localStorage.setItem(ALERT_THRESHOLDS_STORAGE_KEY, JSON.stringify(values));
}
