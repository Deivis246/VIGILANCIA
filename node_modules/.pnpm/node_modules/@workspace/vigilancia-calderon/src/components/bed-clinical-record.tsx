import { useState } from "react";
import type { VigilanciaBed, VigilanciaBedRecord, VigilanciaBedRecordInput } from "@workspace/api-client-react";
import { Activity, Check, FlaskConical, ShieldCheck, Stethoscope, X } from "lucide-react";

export type IsolationType = "none" | "respiratory" | "contact" | "droplets";
export type RectalSwabStatus = "pending" | "negative" | "positive";
export type CultureType = "none" | "urine" | "blood" | "respiratory" | "other";
export type CultureStatus = "pending" | "negative" | "positive";

export type BedClinicalRecord = {
  occupied: boolean;
  patientCode: string;
  diagnosis: string;
  stayDays: number | "";
  urinaryCatheterDays: number | "";
  nasogastricTubeDays: number | "";
  centralLineDays: number | "";
  cultureType: CultureType;
  cultureStatus: CultureStatus;
  cultureOrganism: string;
  culturePositiveDate: string;
  rectalSwabStatus: RectalSwabStatus;
  rectalSwabOrganism: string;
  rectalSwabPositiveDate: string;
  isolation: IsolationType;
  updatedAt: string;
};

export type BedClinicalRecords = Record<string, BedClinicalRecord>;

const isolationLabels: Record<IsolationType, string> = {
  none: "Sin aislamiento",
  respiratory: "Aislamiento respiratorio",
  contact: "Aislamiento de contacto",
  droplets: "Aislamiento por gotas",
};

const swabLabels: Record<RectalSwabStatus, string> = {
  pending: "Pendiente / no realizado",
  negative: "Negativo",
  positive: "Positivo",
};

const cultureTypeLabels: Record<CultureType, string> = {
  none: "Sin cultivo registrado",
  urine: "Urocultivo",
  blood: "Hemocultivo",
  respiratory: "Cultivo respiratorio",
  other: "Otro cultivo",
};

const cultureStatusLabels: Record<CultureStatus, string> = {
  pending: "Pendiente / en proceso",
  negative: "Negativo",
  positive: "Positivo",
};

export function mapBedClinicalRecords(records: VigilanciaBedRecord[]): BedClinicalRecords {
  return Object.fromEntries(records.map((record) => [
    record.bedId,
    {
      occupied: record.occupied,
      patientCode: record.patientCode,
      diagnosis: record.diagnosis,
      stayDays: record.stayDays ?? "",
      urinaryCatheterDays: record.urinaryCatheterDays ?? "",
      nasogastricTubeDays: record.nasogastricTubeDays ?? "",
      centralLineDays: record.centralLineDays ?? "",
      cultureType: record.cultureType,
      cultureStatus: record.cultureStatus,
      cultureOrganism: record.cultureOrganism,
      culturePositiveDate: record.culturePositiveDate ?? "",
      rectalSwabStatus: record.rectalSwabStatus,
      rectalSwabOrganism: record.rectalSwabOrganism,
      rectalSwabPositiveDate: record.rectalSwabPositiveDate ?? "",
      isolation: record.isolation,
      updatedAt: record.updatedAt,
    },
  ]));
}

export function toBedRecordInput(record: BedClinicalRecord): VigilanciaBedRecordInput {
  return {
    occupied: record.occupied,
    patientCode: record.patientCode,
    diagnosis: record.diagnosis,
    stayDays: record.stayDays === "" ? null : record.stayDays,
    urinaryCatheterDays: record.urinaryCatheterDays === "" ? null : record.urinaryCatheterDays,
    nasogastricTubeDays: record.nasogastricTubeDays === "" ? null : record.nasogastricTubeDays,
    centralLineDays: record.centralLineDays === "" ? null : record.centralLineDays,
    cultureType: record.cultureType,
    cultureStatus: record.cultureType === "none" ? "pending" : record.cultureStatus,
    cultureOrganism: record.cultureType !== "none" && record.cultureStatus === "positive" ? record.cultureOrganism : "",
    culturePositiveDate: record.cultureType !== "none" && record.cultureStatus === "positive" ? record.culturePositiveDate || null : null,
    rectalSwabStatus: record.rectalSwabStatus,
    rectalSwabOrganism: record.rectalSwabStatus === "positive" ? record.rectalSwabOrganism : "",
    rectalSwabPositiveDate: record.rectalSwabStatus === "positive" ? record.rectalSwabPositiveDate || null : null,
    isolation: record.isolation,
  };
}

export function getBedRecordDefaults(bed: VigilanciaBed): BedClinicalRecord {
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

export function isolationLabel(value: IsolationType) {
  return isolationLabels[value];
}

export function swabLabel(value: RectalSwabStatus) {
  return swabLabels[value];
}

function parseNonNegative(value: string): number | "" {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : "";
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
      {label}
      <input
        id={id}
        data-testid={id}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(parseNonNegative(event.target.value))}
        placeholder="0"
        className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary"
      />
      {hint && <span className="mt-1 block text-[10px] font-normal leading-relaxed text-muted-foreground/75">{hint}</span>}
    </label>
  );
}

export function BedClinicalRecordDialog({
  bed,
  initialRecord,
  onClose,
  onSave,
}: {
  bed: VigilanciaBed;
  initialRecord?: BedClinicalRecord;
  onClose: () => void;
  onSave: (record: BedClinicalRecord) => Promise<void>;
}) {
  const [form, setForm] = useState<BedClinicalRecord>(() => initialRecord ?? getBedRecordDefaults(bed));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof BedClinicalRecord>(key: K, value: BedClinicalRecord[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "cultureType" && value === "none") {
        next.cultureStatus = "pending";
        next.cultureOrganism = "";
        next.culturePositiveDate = "";
      }
      if (key === "cultureStatus" && value !== "positive") {
        next.culturePositiveDate = "";
      }
      if (key === "rectalSwabStatus" && value !== "positive") {
        next.rectalSwabPositiveDate = "";
      }
      return next;
    });
    setError("");
  };

  const submit = async () => {
    if (form.occupied && !form.patientCode.trim()) {
      setError("Escribe un código interno para la cama ocupada.");
      return;
    }
    if (form.occupied && form.cultureType !== "none" && form.cultureStatus === "positive" && !form.cultureOrganism.trim()) {
      setError("Escribe el tipo de bacteria cuando el cultivo sea positivo.");
      return;
    }
    if (form.occupied && form.cultureType !== "none" && form.cultureStatus === "positive" && !form.culturePositiveDate) {
      setError("Selecciona la fecha del resultado positivo del cultivo.");
      return;
    }
    if (form.occupied && form.rectalSwabStatus === "positive" && !form.rectalSwabOrganism.trim()) {
      setError("Escribe el tipo de bacteria cuando el hisopado rectal sea positivo.");
      return;
    }
    if (form.occupied && form.rectalSwabStatus === "positive" && !form.rectalSwabPositiveDate) {
      setError("Selecciona la fecha del resultado positivo del hisopado rectal.");
      return;
    }
    const saved: BedClinicalRecord = form.occupied
      ? {
          ...form,
          patientCode: form.patientCode.trim().toUpperCase(),
          diagnosis: form.diagnosis.trim(),
          culturePositiveDate: form.cultureStatus === "positive" && form.cultureType !== "none" ? form.culturePositiveDate : "",
          rectalSwabOrganism: form.rectalSwabStatus === "positive" ? form.rectalSwabOrganism.trim() : "",
          rectalSwabPositiveDate: form.rectalSwabStatus === "positive" ? form.rectalSwabPositiveDate : "",
          updatedAt: new Date().toISOString(),
        }
      : {
          occupied: false,
          patientCode: "",
          diagnosis: "",
          stayDays: "",
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
          updatedAt: new Date().toISOString(),
        };
    setSaving(true);
    try {
      await onSave(saved);
    } catch {
      setError("No se pudo guardar la ficha en el servidor. Inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bed-dialog-title">
      <button data-testid="button-close-bed-dialog-overlay" type="button" aria-label="Cerrar ficha de cama" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative z-10 max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Registro persistente</p>
            <h2 id="bed-dialog-title" className="mt-1 text-xl font-semibold text-foreground">Sala {bed.room} · Cama {bed.bed}</h2>
            <p className="mt-1 text-xs text-muted-foreground">La información queda guardada en el servidor compartido.</p>
          </div>
          <button data-testid="button-close-bed-dialog" type="button" aria-label="Cerrar ficha de cama" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><X size={17} /></button>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
            Usa únicamente un código interno. No ingreses nombres, cédulas, teléfonos ni otros identificadores personales. Estas señales orientan la revisión y no confirman una infección.
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2"><Stethoscope size={16} className="text-primary" /><h3 className="text-sm font-semibold">Paciente y estancia</h3></div>
            <div className="grid gap-4 sm:grid-cols-4">
              <label htmlFor="select-bed-occupancy" className="text-xs font-medium text-muted-foreground">
                Estado de la cama
                <select
                  id="select-bed-occupancy"
                  data-testid="select-bed-occupancy"
                  value={form.occupied ? "occupied" : "available"}
                  onChange={(event) => update("occupied", event.target.value === "occupied")}
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="available">Disponible</option>
                  <option value="occupied">Ocupada</option>
                </select>
              </label>
              <label htmlFor="input-bed-patient-code" className="text-xs font-medium text-muted-foreground">
                Código interno del paciente
                <input
                  id="input-bed-patient-code"
                  data-testid="input-bed-patient-code"
                  value={form.patientCode}
                  onChange={(event) => update("patientCode", event.target.value)}
                  placeholder="Ej. AC-204"
                  maxLength={20}
                  autoComplete="off"
                  required={form.occupied}
                  disabled={!form.occupied}
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase text-foreground outline-none placeholder:normal-case placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary"
                />
              </label>
              <label htmlFor="input-bed-diagnosis" className="text-xs font-medium text-muted-foreground">
                Diagnóstico breve
                <input
                  id="input-bed-diagnosis"
                  data-testid="input-bed-diagnosis"
                  value={form.diagnosis}
                  onChange={(event) => update("diagnosis", event.target.value)}
                  placeholder="Ej. Neumonía"
                  maxLength={160}
                  disabled={!form.occupied}
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary"
                />
                <span className="mt-1 block text-[10px] font-normal leading-relaxed text-muted-foreground/75">Solo descripción breve; no incluyas historia clínica completa.</span>
              </label>
              <NumberField id="input-bed-stay-days" label="Días de estancia" value={form.stayDays} onChange={(value) => update("stayDays", value)} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2"><Activity size={16} className="text-primary" /><h3 className="text-sm font-semibold">Dispositivos invasivos</h3></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField id="input-bed-urinary-days" label="Sonda vesical" value={form.urinaryCatheterDays} onChange={(value) => update("urinaryCatheterDays", value)} hint="Días acumulados de uso" />
              <NumberField id="input-bed-nasogastric-days" label="Sonda nasogástrica" value={form.nasogastricTubeDays} onChange={(value) => update("nasogastricTubeDays", value)} hint="Días acumulados de uso" />
              <NumberField id="input-bed-central-days" label="Vía central" value={form.centralLineDays} onChange={(value) => update("centralLineDays", value)} hint="Días acumulados de uso" />
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border bg-background/35 p-4">
              <div className="flex items-center gap-2"><FlaskConical size={16} className="text-primary" /><h3 className="text-sm font-semibold">Cultivos</h3></div>
              <label htmlFor="select-bed-culture-type" className="text-xs font-medium text-muted-foreground">
                Tipo de cultivo
                <select id="select-bed-culture-type" data-testid="select-bed-culture-type" value={form.cultureType} onChange={(event) => update("cultureType", event.target.value as CultureType)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                  {Object.entries(cultureTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {form.cultureType !== "none" && <>
                <label htmlFor="select-bed-culture-status" className="text-xs font-medium text-muted-foreground">
                  Resultado del cultivo
                  <select id="select-bed-culture-status" data-testid="select-bed-culture-status" value={form.cultureStatus} onChange={(event) => update("cultureStatus", event.target.value as CultureStatus)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                    {Object.entries(cultureStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {form.cultureStatus === "positive" && <label htmlFor="input-bed-culture-organism" className="text-xs font-medium text-muted-foreground">
                  Tipo de bacteria <span className="text-destructive">(obligatorio)</span>
                  <input id="input-bed-culture-organism" data-testid="input-bed-culture-organism" required aria-required="true" value={form.cultureOrganism} onChange={(event) => update("cultureOrganism", event.target.value)} placeholder="Ej. E. coli BLEE" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary" />
                </label>}
                {form.cultureStatus === "positive" && <label htmlFor="input-bed-culture-positive-date" className="text-xs font-medium text-muted-foreground">
                  Fecha del resultado positivo <span className="text-destructive">(obligatorio)</span>
                  <input id="input-bed-culture-positive-date" data-testid="input-bed-culture-positive-date" type="date" required aria-required="true" value={form.culturePositiveDate} onChange={(event) => update("culturePositiveDate", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </label>}
              </>}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Hisopado rectal</p>
              </div>
              <label htmlFor="select-bed-rectal-swab" className="text-xs font-medium text-muted-foreground">
                Resultado
                <select id="select-bed-rectal-swab" data-testid="select-bed-rectal-swab" value={form.rectalSwabStatus} onChange={(event) => update("rectalSwabStatus", event.target.value as RectalSwabStatus)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                  {Object.entries(swabLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
                {form.rectalSwabStatus === "positive" && (
                <>
                  <label htmlFor="input-bed-rectal-organism" className="text-xs font-medium text-muted-foreground">
                    Tipo de bacteria <span className="text-destructive">(obligatorio)</span>
                    <input id="input-bed-rectal-organism" data-testid="input-bed-rectal-organism" required aria-required="true" value={form.rectalSwabOrganism} onChange={(event) => update("rectalSwabOrganism", event.target.value)} placeholder="Ej. K. pneumoniae KPC" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary" />
                  </label>
                  <label htmlFor="input-bed-rectal-positive-date" className="text-xs font-medium text-muted-foreground">
                    Fecha del resultado positivo <span className="text-destructive">(obligatorio)</span>
                    <input id="input-bed-rectal-positive-date" data-testid="input-bed-rectal-positive-date" type="date" required aria-required="true" value={form.rectalSwabPositiveDate} onChange={(event) => update("rectalSwabPositiveDate", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                  </label>
                </>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-background/35 p-4">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /><h3 className="text-sm font-semibold">Tipo de aislamiento</h3></div>
              <div className="space-y-2">
                {Object.entries(isolationLabels).map(([value, label]) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-xs transition-colors ${form.isolation === value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/60"}`}>
                    <input type="radio" name="isolation" value={value} checked={form.isolation === value} onChange={() => update("isolation", value as IsolationType)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">{error}</p>}
        </div>
        <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
          <span className="hidden text-[11px] text-muted-foreground sm:block">Los valores deben ser números enteros iguales o mayores que cero.</span>
          <div className="ml-auto flex gap-2">
            <button data-testid="button-cancel-bed-record" type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Cancelar</button>
            <button data-testid="button-save-bed-record" type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"><Check size={15} />{saving ? "Guardando…" : "Guardar ficha"}</button>
          </div>
        </footer>
        </form>
      </div>
    </div>
  );
}
