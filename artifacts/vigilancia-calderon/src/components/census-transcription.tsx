import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyVigilanciaCensus,
  getGetVigilanciaAlertsQueryKey,
  getGetVigilanciaBedRecordsQueryKey,
  getGetVigilanciaDashboardQueryKey,
  useTranscribeVigilanciaCensus,
  type VigilanciaBedRecordInput,
  type VigilanciaCensusRowInput,
  type VigilanciaTranscriptionRow,
} from "@workspace/api-client-react";
import { AlertTriangle, Camera, Check, FileText, ImageUp, LoaderCircle, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const BED_IDS = [
  ...Array.from({ length: 8 }, (_, index) => ({ room: String(201 + index), labels: ["A", "B", "C"] })),
  { room: "209", labels: ["A", "B"] },
  { room: "210", labels: ["A", "B"] },
  { room: "211", labels: ["A"] },
  ...Array.from({ length: 12 }, (_, index) => ({ room: String(212 + index), labels: ["A", "B"] })),
].flatMap(({ room, labels }) => labels.map((label) => `${room}-${label.toLowerCase()}`));

type EditableRow = {
  selected: boolean;
  bedId: string;
  occupied: "unknown" | "occupied" | "available";
  patientCode: string;
  diagnosis: string;
  stayDays: string;
  urinaryCatheterDays: string;
  nasogastricTubeDays: string;
  centralLineDays: string;
  cultureType: "unknown" | "none" | "urine" | "blood" | "respiratory" | "other";
  cultureStatus: "unknown" | "pending" | "negative" | "positive";
  cultureOrganism: string;
  culturePositiveDate: string;
  isolation: "unknown" | "none" | "respiratory" | "contact" | "droplets";
  rectalSwabStatus: "unknown" | "pending" | "negative" | "positive";
  rectalSwabOrganism: string;
  rectalSwabPositiveDate: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

const confidenceLabels = { high: "Alta", medium: "Media", low: "Baja" };
const fieldClass = "h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary";

function numberValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function makeEditableRow(row: VigilanciaTranscriptionRow): EditableRow {
  return {
    selected: Boolean(
      row.bedId
      || row.patientCode
      || row.diagnosis
      || row.stayDays != null
      || row.urinaryCatheterDays != null
      || row.nasogastricTubeDays != null
      || row.centralLineDays != null,
    ),
    bedId: row.bedId ?? "",
    occupied: row.occupied == null ? "unknown" : row.occupied ? "occupied" : "available",
    patientCode: row.patientCode ?? "",
    diagnosis: row.diagnosis ?? "",
    stayDays: numberValue(row.stayDays),
    urinaryCatheterDays: numberValue(row.urinaryCatheterDays),
    nasogastricTubeDays: numberValue(row.nasogastricTubeDays),
    centralLineDays: numberValue(row.centralLineDays),
    cultureType: row.cultureType ?? "unknown",
    cultureStatus: row.cultureStatus ?? "unknown",
    cultureOrganism: row.cultureOrganism ?? "",
    culturePositiveDate: row.culturePositiveDate ?? "",
    isolation: row.isolation ?? "unknown",
    rectalSwabStatus: row.rectalSwabStatus ?? "unknown",
    rectalSwabOrganism: row.rectalSwabOrganism ?? "",
    rectalSwabPositiveDate: row.rectalSwabPositiveDate ?? "",
    confidence: row.confidence,
    warnings: row.warnings,
  };
}

function rowError(row: EditableRow, duplicateBedIds: Set<string>) {
  if (!row.selected) return "";
  if (!BED_IDS.includes(row.bedId)) return "Selecciona una cama válida.";
  if (duplicateBedIds.has(row.bedId)) return "La cama está repetida en la selección.";
  if (row.diagnosis.length > 160) return "El diagnóstico debe tener máximo 160 caracteres.";
  return "";
}

function toInput(row: EditableRow): VigilanciaBedRecordInput {
  const parseNumber = (value: string) => value === "" ? null : Math.max(0, Math.floor(Number(value)));
  return {
    occupied: true,
    patientCode: row.patientCode.trim().toUpperCase(),
    diagnosis: row.diagnosis.trim(),
    stayDays: parseNumber(row.stayDays),
    urinaryCatheterDays: parseNumber(row.urinaryCatheterDays),
    nasogastricTubeDays: parseNumber(row.nasogastricTubeDays),
    centralLineDays: parseNumber(row.centralLineDays),
    cultureType: row.cultureType === "unknown" ? "none" : row.cultureType,
    cultureStatus: row.cultureType === "none" || row.cultureStatus === "unknown" ? "pending" : row.cultureStatus,
    cultureOrganism: row.cultureStatus === "positive" ? row.cultureOrganism.trim() : "",
    culturePositiveDate: row.cultureStatus === "positive" && row.cultureType !== "none" ? row.culturePositiveDate : null,
    isolation: row.isolation === "unknown" ? "none" : row.isolation,
    rectalSwabStatus: row.rectalSwabStatus === "unknown" ? "pending" : row.rectalSwabStatus,
    rectalSwabOrganism: row.rectalSwabStatus === "positive" ? row.rectalSwabOrganism.trim() : "",
    rectalSwabPositiveDate: row.rectalSwabStatus === "positive" ? row.rectalSwabPositiveDate : null,
  };
}

function toBatchInput(row: EditableRow): VigilanciaCensusRowInput {
  const input = toInput(row);
  return {
    bedId: row.bedId,
    ...input,
    occupied: row.occupied !== "available",
    culturePositiveDate: input.culturePositiveDate ?? null,
    rectalSwabPositiveDate: input.rectalSwabPositiveDate ?? null,
  };
}
async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export function CensusTranscription() {
  const queryClient = useQueryClient();
  const transcription = useTranscribeVigilanciaCensus();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [globalWarnings, setGlobalWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectedRows = rows.filter((row) => row.selected);
  const duplicateBedIds = useMemo(() => {
    const counts = new Map<string, number>();
    selectedRows.forEach((row) => counts.set(row.bedId, (counts.get(row.bedId) ?? 0) + 1));
    return new Set([...counts].filter(([, count]) => count > 1).map(([bedId]) => bedId));
  }, [selectedRows]);
  const validationErrors = rows.map((row) => rowError(row, duplicateBedIds));
  const validationIssues = validationErrors.flatMap((message, index) => {
    if (!message) return [];
    const row = rows[index];
    return [{
      index,
      label: row?.bedId ? row.bedId.toUpperCase() : `Fila ${index + 1}`,
      message,
    }];
  });
  const canConfirm = selectedRows.length > 0 && validationErrors.every((message) => !message);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setRows([]);
    setGlobalWarnings([]);
    setError("");
    setConfirming(false);
  };

  const chooseFile = (nextFile: File | undefined) => {
    setError("");
    setAppliedCount(0);
    setRows([]);
    setConfirming(false);
    if (!nextFile) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    if (!ALLOWED_TYPES.includes(nextFile.type as (typeof ALLOWED_TYPES)[number])) {
      setError("Selecciona una imagen JPG, PNG, WEBP o PDF.");
      return;
    }
    const maxBytes = nextFile.type === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (nextFile.size > maxBytes) {
      setError(nextFile.type === "application/pdf"
        ? "El PDF debe pesar como máximo 20 MB."
        : "La imagen debe pesar como máximo 6 MB.");
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const transcribe = async () => {
    if (!file) return;
    setError("");
    setAppliedCount(0);
    try {
      const fileBase64 = await fileToBase64(file);
      const result = await transcription.mutateAsync({
        data: {
          imageBase64: fileBase64,
          mimeType: file.type as (typeof ALLOWED_TYPES)[number],
        },
      });
      setRows(result.rows.map(makeEditableRow));
      setGlobalWarnings(result.warnings);
      if (!result.rows.length) setError("No se identificaron filas legibles. Prueba con una imagen o PDF más nítido.");
    } catch (requestError) {
      const status = typeof requestError === "object" && requestError !== null && "status" in requestError
        ? Number((requestError as { status?: unknown }).status)
        : undefined;
      const responseData = typeof requestError === "object" && requestError !== null && "data" in requestError
        ? (requestError as { data?: unknown }).data
        : undefined;
      const serverError = typeof responseData === "object" && responseData !== null && "error" in responseData
        && typeof (responseData as { error?: unknown }).error === "string"
        ? (responseData as { error: string }).error
        : "";
      setError(serverError || (status === 503
        ? "El servicio de transcripción está temporalmente ocupado. Inténtalo nuevamente en unos minutos."
        : "No se pudo transcribir el archivo. Revisa la nitidez del documento e inténtalo de nuevo."));
    }
  };

  const updateRow = <K extends keyof EditableRow>(index: number, key: K, value: EditableRow[K]) => {
    setRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, [key]: value };
      if (key === "cultureType" && value === "none") next.culturePositiveDate = "";
      if (key === "cultureStatus" && value !== "positive") next.culturePositiveDate = "";
      if (key === "rectalSwabStatus" && value !== "positive") next.rectalSwabPositiveDate = "";
      return next;
    }));
    setConfirming(false);
  };

  const reviewSelection = () => {
    const firstIssue = validationIssues[0];
    if (firstIssue) {
      document.querySelector(`[data-testid="transcription-row-${firstIssue.index}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" });
      return;
    }
    setConfirming(true);
  };

  const applyRows = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setError("");
    try {
      const result = await applyVigilanciaCensus({
        rows: selectedRows.map(toBatchInput),
      });
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaBedRecordsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaAlertsQueryKey() }),
      ]);
      reset();
      setAppliedCount(result.appliedCount);
    } catch {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaBedRecordsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaAlertsQueryKey() }),
      ]);
      setError("No se pudo aplicar la transcripción. No se modificó ninguna fila.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary">Vigilancia Calderón / Captura asistida</p>
          <h1 className="text-3xl font-semibold tracking-[-.04em] text-foreground md:text-[38px]">Transcribir censo escaneado</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Carga una foto o PDF, revisa cada dato extraído y confirma únicamente las filas correctas. El archivo se usa temporalmente y no se guarda en el sistema.</p>
        </div>
        <span className="flex items-center gap-2 self-start rounded-full bg-accent px-3 py-2 text-xs text-accent-foreground md:self-auto"><ShieldCheck size={14} /> Revisión humana obligatoria</span>
      </div>

      <div className="mb-5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
        <strong>Privacidad:</strong> si el documento contiene nombres, cédulas, teléfonos, historias clínicas u otros identificadores personales, el lector los omite y continúa con la transcripción. Esos datos no se muestran ni se guardan. La transcripción es asistida y no sustituye la revisión clínica o epidemiológica.
      </div>

      {appliedCount > 0 && <div data-testid="transcription-success" className="mb-5 flex items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 p-4 text-sm text-foreground"><Check className="text-primary" size={18} /> Se aplicaron {appliedCount} filas y se actualizaron el mapa, las métricas y las alertas.</div>}
      {error && <div data-testid="transcription-error" className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"><AlertTriangle className="mt-0.5 shrink-0" size={18} />{error}</div>}

      {!rows.length && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <label className="group flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center hover:border-primary/60 hover:bg-card/80">
          <input data-testid="input-census-image" type="file" accept={ALLOWED_TYPES.join(",")} capture="environment" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-primary">{file?.type === "application/pdf" ? <FileText size={25} /> : <ImageUp size={25} />}</div>
          <h2 className="mt-5 text-lg font-semibold">{file ? "Cambiar archivo" : "Seleccionar foto o PDF"}</h2>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">JPG, PNG o WEBP · máximo 6 MB · PDF · máximo 20 MB. En teléfono puedes usar la cámara directamente.</p>
        </label>
        <aside className="rounded-xl border border-border bg-card p-5">
          {previewUrl ? file?.type === "application/pdf" ? <iframe data-testid="preview-census-pdf" src={previewUrl} title="Vista previa temporal del censo en PDF" className="h-48 w-full rounded-lg border-0 bg-background" /> : <img src={previewUrl} alt="Vista previa temporal del censo" className="h-48 w-full rounded-lg object-contain bg-background" /> : <div className="grid h-48 place-items-center rounded-lg bg-muted text-muted-foreground"><Camera size={30} /></div>}
          <div className="mt-4">
            <p className="truncate text-sm font-medium">{file?.name ?? "Sin archivo seleccionado"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · el archivo no se almacenará` : "Selecciona una foto o PDF para continuar."}</p>
          </div>
          <button data-testid="button-transcribe-census" type="button" onClick={transcribe} disabled={!file || transcription.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {transcription.isPending ? <LoaderCircle className="animate-spin" size={17} /> : file?.type === "application/pdf" ? <FileText size={17} /> : <ImageUp size={17} />}
            {transcription.isPending ? "Analizando archivo…" : "Transcribir para revisión"}
          </button>
          {transcription.isPending && <p role="status" className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">Los PDF escaneados pueden tardar hasta dos minutos. Mantén esta ventana abierta.</p>}
        </aside>
      </section>}

      {rows.length > 0 && <section className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-semibold">Revisión de filas</h2><p className="mt-1 text-xs text-muted-foreground">Edita valores dudosos, desmarca filas incorrectas y corrige camas no identificadas.</p></div>
          <button data-testid="button-cancel-transcription" type="button" onClick={reset} className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Trash2 size={14} />Cancelar y descartar</button>
        </div>
        {globalWarnings.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="text-xs font-semibold text-amber-100">Advertencias generales</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100/85">{globalWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
           <table className="w-full min-w-[2140px] border-collapse text-left">
            <thead className="bg-muted/60 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                 <tr>
                   <th className="p-3">Aplicar</th><th className="p-3">Cama</th><th className="p-3">Estado</th><th className="p-3">Código</th><th className="p-3">Diagnóstico breve</th><th className="p-3">Estancia</th><th className="p-3">S. vesical</th><th className="p-3">S. NG</th><th className="p-3">Vía central</th><th className="p-3">Cultivo</th><th className="p-3">Resultado</th><th className="p-3">Fecha cultivo positivo</th><th className="p-3">Bacteria</th><th className="p-3">Aislamiento</th><th className="p-3">Hisopado</th><th className="p-3">Bacteria hisopado</th><th className="p-3">Fecha hisopado positivo</th><th className="p-3">Confianza</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const validation = validationErrors[index];
                return <tr data-testid={`transcription-row-${index}`} key={index} className={`border-t border-border align-top ${row.selected ? "" : "opacity-50"}`}>
                  <td className="p-3"><input data-testid={`checkbox-transcription-row-${index}`} type="checkbox" checked={row.selected} onChange={(event) => updateRow(index, "selected", event.target.checked)} className="h-4 w-4 accent-primary" /></td>
                  <td className="p-3"><select data-testid={`select-transcription-bed-${index}`} aria-invalid={Boolean(validation)} value={row.bedId} onChange={(event) => updateRow(index, "bedId", event.target.value)} className={`${fieldClass} w-24`}><option value="">Revisar</option>{BED_IDS.map((bedId) => <option key={bedId} value={bedId}>{bedId.toUpperCase()}</option>)}</select>{validation && <p className="mt-2 w-44 text-[10px] leading-relaxed text-destructive">{validation}</p>}{row.warnings.length > 0 && <ul className="mt-2 w-48 space-y-1 text-[10px] leading-relaxed text-amber-300">{row.warnings.map((warning, warningIndex) => <li key={`${warning}-${warningIndex}`}>• {warning}</li>)}</ul>}</td>
                  <td className="p-3"><select data-testid={`select-transcription-occupancy-${index}`} value={row.occupied} onChange={(event) => updateRow(index, "occupied", event.target.value as EditableRow["occupied"])} className={`${fieldClass} w-28`}><option value="unknown">Revisar</option><option value="occupied">Ocupada</option><option value="available">Disponible</option></select></td>
                   <td className="p-3"><input data-testid={`input-transcription-code-${index}`} value={row.patientCode} maxLength={20} disabled={row.occupied === "available"} onChange={(event) => updateRow(index, "patientCode", event.target.value)} className={`${fieldClass} w-28 uppercase`} /></td>
                   <td className="p-3"><input data-testid={`input-transcription-diagnosis-${index}`} value={row.diagnosis} maxLength={160} disabled={row.occupied === "available"} onChange={(event) => updateRow(index, "diagnosis", event.target.value)} className={`${fieldClass} w-40`} /></td>
                  {(["stayDays", "urinaryCatheterDays", "nasogastricTubeDays", "centralLineDays"] as const).map((key) => <td key={key} className="p-3"><input data-testid={`input-transcription-${key}-${index}`} type="number" min={0} step={1} value={row[key]} disabled={row.occupied === "available"} onChange={(event) => updateRow(index, key, event.target.value)} className={`${fieldClass} w-20 font-mono`} /></td>)}
                   <td className="p-3"><select data-testid={`select-transcription-culture-type-${index}`} value={row.cultureType} disabled={row.occupied === "available"} onChange={(event) => updateRow(index, "cultureType", event.target.value as EditableRow["cultureType"])} className={`${fieldClass} w-28`}><option value="unknown">Revisar</option><option value="none">Sin cultivo</option><option value="urine">Orina</option><option value="blood">Sangre</option><option value="respiratory">Respiratorio</option><option value="other">Otro</option></select></td>
                   <td className="p-3"><select data-testid={`select-transcription-culture-status-${index}`} value={row.cultureStatus} disabled={row.occupied === "available" || row.cultureType === "none"} onChange={(event) => updateRow(index, "cultureStatus", event.target.value as EditableRow["cultureStatus"])} className={`${fieldClass} w-24`}><option value="unknown">Revisar</option><option value="pending">Pendiente</option><option value="negative">Negativo</option><option value="positive">Positivo</option></select></td>
                   <td className="p-3"><input data-testid={`input-transcription-culture-positive-date-${index}`} type="date" value={row.culturePositiveDate} max="9999-12-31" disabled={row.occupied === "available" || row.cultureType === "none" || row.cultureStatus !== "positive"} onChange={(event) => updateRow(index, "culturePositiveDate", event.target.value)} className={`${fieldClass} w-36`} /></td>
                  <td className="p-3"><input value={row.cultureOrganism} maxLength={120} disabled={row.occupied === "available" || row.cultureStatus !== "positive"} onChange={(event) => updateRow(index, "cultureOrganism", event.target.value)} className={`${fieldClass} w-36`} /></td>
                   <td className="p-3"><select data-testid={`select-transcription-isolation-${index}`} value={row.isolation} disabled={row.occupied === "available"} onChange={(event) => updateRow(index, "isolation", event.target.value as EditableRow["isolation"])} className={`${fieldClass} w-28`}><option value="unknown">Revisar</option><option value="none">Ninguno</option><option value="respiratory">Respiratorio</option><option value="contact">Contacto</option><option value="droplets">Gotas</option></select></td>
                   <td className="p-3"><select data-testid={`select-transcription-rectal-status-${index}`} value={row.rectalSwabStatus} disabled={row.occupied === "available"} onChange={(event) => updateRow(index, "rectalSwabStatus", event.target.value as EditableRow["rectalSwabStatus"])} className={`${fieldClass} w-24`}><option value="unknown">Revisar</option><option value="pending">Pendiente</option><option value="negative">Negativo</option><option value="positive">Positivo</option></select></td>
                  <td className="p-3"><input value={row.rectalSwabOrganism} maxLength={120} disabled={row.occupied === "available" || row.rectalSwabStatus !== "positive"} onChange={(event) => updateRow(index, "rectalSwabOrganism", event.target.value)} className={`${fieldClass} w-36`} /></td>
                   <td className="p-3"><input data-testid={`input-transcription-rectal-positive-date-${index}`} type="date" value={row.rectalSwabPositiveDate} max="9999-12-31" disabled={row.occupied === "available" || row.rectalSwabStatus !== "positive"} onChange={(event) => updateRow(index, "rectalSwabPositiveDate", event.target.value)} className={`${fieldClass} w-36`} /></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${row.confidence === "high" ? "bg-primary/15 text-primary" : row.confidence === "medium" ? "bg-amber-500/15 text-amber-300" : "bg-destructive/15 text-destructive"}`}>{confidenceLabels[row.confidence]}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {validationIssues.length > 0 && <div data-testid="transcription-validation-summary" role="alert" className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-amber-100">
          <p className="text-xs font-semibold">Faltan {validationIssues.length} revisiones antes de guardar</p>
          <p className="mt-1 text-xs text-amber-100/80">Corrige los campos indicados o desmarca las filas que no deseas aplicar.</p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {validationIssues.map((issue) => <li key={issue.index}><strong>{issue.label}:</strong> {issue.message}</li>)}
          </ul>
        </div>}
        <div className="sticky bottom-4 rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur">
          {!confirming ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{selectedRows.length} de {rows.length} filas seleccionadas. {validationIssues.length > 0 ? `${validationIssues.length} requieren revisión antes de guardar.` : "Los cambios aún no se han guardado."}</p><button data-testid="button-review-transcription" type="button" disabled={selectedRows.length === 0} onClick={reviewSelection} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Check size={16} />{validationIssues.length > 0 ? "Ver campos pendientes" : "Revisar selección y confirmar"}</button></div> :
          <div data-testid="transcription-confirmation" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">¿Aplicar {selectedRows.length} filas revisadas?</p><p className="mt-1 text-xs text-muted-foreground">Las camas ocupadas se guardarán y las marcadas disponibles se liberarán.</p></div><div className="flex gap-2"><button type="button" onClick={() => setConfirming(false)} disabled={saving} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted"><RotateCcw size={14} />Volver a revisar</button><button data-testid="button-confirm-transcription" type="button" onClick={applyRows} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}{saving ? "Guardando…" : "Confirmar y guardar"}</button></div></div>}
        </div>
      </section>}
    </div>
  );
}
