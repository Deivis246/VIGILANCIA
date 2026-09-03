import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileWarning,
  Info,
  Map,
  RefreshCw,
  Shield,
  Siren
} from "lucide-react";
import { usePredictVigilanciaOutbreak } from "@workspace/api-client-react";
import type { VigilanciaOutbreakPrediction } from "@workspace/api-client-react";

export function OutbreakPredictionPage() {
  const { mutate, data, isPending, isError } = usePredictVigilanciaOutbreak();

  return (
    <div className="fade-in max-w-[1400px]" aria-busy={isPending}>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary">
            Vigilancia Calderón / Analítica
          </p>
          <h1 className="text-3xl font-semibold tracking-[-.04em] text-foreground md:text-[38px]">
            Predicción y Análisis de Brotes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Evaluación orientativa generada con IA, basada en registros actuales y parámetros clínicos.
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm">
        <Siren className="mt-0.5 shrink-0 text-muted-foreground" size={16} />
        <div>
          <span className="font-semibold text-foreground">Importante: </span>
          <span className="text-muted-foreground">
            Este análisis genera una señal orientativa. No sustituye el criterio clínico ni constituye un diagnóstico o confirmación de brote.
          </span>
        </div>
      </div>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorView onRetry={() => mutate()} />
      ) : data ? (
        data.status === "insufficient_data" ? (
          <InsufficientDataView data={data} onRetry={() => mutate()} />
        ) : (
          <ResultView data={data} onReanalyze={() => mutate()} />
        )
      ) : (
        <InitialState onAnalyze={() => mutate()} />
      )}
    </div>
  );
}

function InitialState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 px-6 text-center shadow-sm">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <BrainCircuit size={32} strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Análisis de Señales de Brote</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Evalúa los registros actuales de vigilancia, aislamientos y cultivos positivos para detectar patrones que sugieran posibles brotes intrahospitalarios.
      </p>
      <button
        data-testid="analysis-button"
        onClick={onAnalyze}
        className="mt-8 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20"
      >
        <Activity size={16} />
        Ejecutar análisis
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Analizando las señales agregadas de vigilancia.</span>
      <div className="h-[120px] rounded-xl bg-card/60 border border-border/50" />
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6">
          <div className="h-[280px] rounded-xl bg-card/60 border border-border/50" />
          <div className="h-[200px] rounded-xl bg-card/60 border border-border/50" />
        </div>
        <div className="space-y-6">
          <div className="h-[180px] rounded-xl bg-card/60 border border-border/50" />
          <div className="h-[320px] rounded-xl bg-card/60 border border-border/50" />
        </div>
      </div>
    </div>
  );
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="error" role="alert" className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 py-20 px-6 text-center">
      <AlertTriangle className="mb-4 text-destructive" size={32} />
      <h3 className="text-lg font-medium text-destructive">Error al procesar el análisis</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        No se pudo completar la predicción en este momento. Por favor, intenta de nuevo.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
      >
        <RefreshCw size={14} /> Reintentar
      </button>
    </div>
  );
}

function InsufficientDataView({ data, onRetry }: { data: VigilanciaOutbreakPrediction; onRetry: () => void }) {
  return (
    <div data-testid="insufficient-state" role="status" aria-live="polite" className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 py-20 px-6 text-center">
      <Database className="mb-4 text-amber-500" size={32} />
      <h3 className="text-lg font-medium text-amber-600 dark:text-amber-500">Datos insuficientes</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {data.summary || "No hay suficientes registros clínicos actualizados para generar una señal orientativa confiable."}
      </p>
      <div className="mt-6 flex gap-6 text-xs text-muted-foreground">
        <div className="flex flex-col items-center">
          <span className="text-xl font-mono font-semibold text-foreground">{data.coverage.savedRecords}</span>
          <span>Registros</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xl font-mono font-semibold text-foreground">{data.coverage.occupiedBeds}</span>
          <span>Camas</span>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="mt-8 flex items-center gap-2 rounded-md bg-background border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        <RefreshCw size={14} /> Volver a evaluar
      </button>
    </div>
  );
}

function ResultView({ data, onReanalyze }: { data: VigilanciaOutbreakPrediction; onReanalyze: () => void }) {
  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "low":
        return "text-primary bg-primary/10 border-primary/20";
      case "moderate":
        return "text-amber-600 dark:text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "high":
        return "text-destructive bg-destructive/10 border-destructive/20";
      default:
        return "text-muted-foreground bg-muted/50 border-border";
    }
  };

  const getSignalLabel = (signal: string) => {
    switch (signal) {
      case "low":
        return "Señal Baja";
      case "moderate":
        return "Señal Moderada";
      case "high":
        return "Señal Alta";
      default:
        return "Indeterminado";
    }
  };

  return (
    <div data-testid="result-container" role="status" aria-live="polite" className="space-y-6 fade-in delay-1">
      {/* Top Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-6">
          <div
            className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-[3px] bg-background/50 ${
              data.signal === "high"
                ? "border-destructive text-destructive"
                : data.signal === "moderate"
                ? "border-amber-500 text-amber-500"
                : "border-primary text-primary"
            }`}
          >
            <span className="font-mono text-2xl font-bold">{data.score}</span>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">Nivel de Orientación</h2>
              <span
                data-testid="signal"
                className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold tracking-wide uppercase ${getSignalColor(
                  data.signal
                )}`}
              >
                {getSignalLabel(data.signal)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-2xl">{data.summary}</p>
          </div>
        </div>
        <button
          data-testid="analysis-button"
          onClick={onReanalyze}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted self-start md:self-auto transition-colors shadow-sm"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6">
          {/* Areas Detailed Breakdown */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <Map size={16} className="text-primary" /> Zonas de Atención
            </h3>
            {data.areas.length > 0 ? (
              <div className="grid gap-3">
                {data.areas.map((area) => (
                  <div
                    key={area.room}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-4 transition-colors hover:bg-background/80"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold">Sala {area.room}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${getSignalColor(
                            area.signal
                          )}`}
                        >
                          {getSignalLabel(area.signal)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{area.detail}</p>
                    </div>
                    <div className="flex shrink-0 gap-5 text-xs font-mono text-muted-foreground sm:text-right">
                      <div className="flex flex-col items-start sm:items-end">
                        <div className="text-foreground font-semibold text-sm">{area.occupiedBeds}</div>
                        <div className="text-[10px] uppercase tracking-wider">Camas</div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end">
                        <div className="text-foreground font-semibold text-sm">{area.positiveResults}</div>
                        <div className="text-[10px] uppercase tracking-wider">Positivos</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-6 text-center bg-muted/20 rounded-lg border border-border/50">
                No hay áreas específicas detectadas con patrones relevantes.
              </div>
            )}
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 size={16} className="text-primary" /> Recomendaciones
              </h3>
              <ul className="space-y-3">
                {data.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Coverage Box */}
          <div data-testid="coverage" className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <Database size={16} className="text-primary" /> Cobertura de Datos
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <CoverageItem label="Registros guardados" value={data.coverage.savedRecords} />
              <CoverageItem label="Camas ocupadas" value={data.coverage.occupiedBeds} />
              <CoverageItem label="Cultivos (+)" value={data.coverage.positiveCultures} />
              <CoverageItem label="Hisopados (+)" value={data.coverage.positiveSwabs} />
            </div>
            {data.coverage.periodStart && data.coverage.periodEnd && (
              <div className="mt-5 border-t border-border pt-4 flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                <span>{data.coverage.periodStart}</span>
                <span className="text-border mx-2">—</span>
                <span>{data.coverage.periodEnd}</span>
              </div>
            )}
          </div>

          {/* Factors */}
          {data.factors.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold">
                <BrainCircuit size={16} className="text-primary" /> Factores Clave
              </h3>
              <div className="space-y-5">
                {data.factors.map((factor, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-background border border-border/50">
                        {factor.kind === "elevates" ? (
                          <AlertTriangle size={12} className="text-amber-500" />
                        ) : factor.kind === "protects" ? (
                          <Shield size={12} className="text-primary" />
                        ) : (
                          <Info size={12} className="text-indigo-400" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground">{factor.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-[34px] leading-relaxed">{factor.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Limitations & Missing Data */}
          {(data.limitations.length > 0 || data.missingData.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold">
                <FileWarning size={16} className="text-primary" /> Limitaciones
              </h3>

              {data.missingData.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold text-foreground mb-3 uppercase tracking-widest text-muted-foreground/70">
                    Datos Faltantes
                  </p>
                  <ul className="space-y-2">
                    {data.missingData.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-border" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.limitations.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-foreground mb-3 uppercase tracking-widest text-muted-foreground/70">
                    Consideraciones
                  </p>
                  <ul className="space-y-2">
                    {data.limitations.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-border" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 transition-colors hover:bg-background/60">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 leading-tight mb-1">{label}</p>
      <p className="font-mono text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
