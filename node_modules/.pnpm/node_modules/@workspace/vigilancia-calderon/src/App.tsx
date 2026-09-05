import { useEffect, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  getGetVigilanciaAlertsQueryKey,
  getGetVigilanciaBedRecordsQueryKey,
  getGetVigilanciaDashboardQueryKey,
  useDeleteVigilanciaBedRecord,
  useGetVigilanciaAlerts,
  useGetVigilanciaBedRecords,
  useGetVigilanciaDashboard,
  useUpsertVigilanciaBedRecord,
} from "@workspace/api-client-react";
import type { VigilanciaAlert, VigilanciaBed, VigilanciaMetric, VigilanciaTrendPoint } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CensusTranscription } from "@/components/census-transcription";
import { OutbreakPredictionPage } from "@/components/outbreak-prediction-page";
import {
  BedClinicalRecordDialog,
  getBedRecordDefaults,
  mapBedClinicalRecords,
  swabLabel,
  toBedRecordInput,
  type BedClinicalRecord,
  type BedClinicalRecords,
} from "@/components/bed-clinical-record";
import {
  ALERT_THRESHOLD_LABELS,
  ALERT_THRESHOLD_LIMITS,
  ALERT_THRESHOLDS,
  deriveAutomaticBedAlerts,
  getAutomaticAlertsForBed,
  readAlertThresholds,
  validateAlertThresholds,
  writeAlertThresholds,
  type AlertThresholdKey,
  type AlertThresholds,
} from "@/components/bed-alert-rules";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { readMigratedJson } from "@/components/local-storage-migration";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, AlertCircle, Bell, BookOpen, BrainCircuit, Camera, Check, ChevronDown, ClipboardPenLine, Download, Droplets, FileText, HeartPulse, LayoutDashboard, Menu, Moon, Printer, RefreshCw, Search, ShieldCheck, Siren, Sun, Thermometer, Wind, X } from "lucide-react";
import { RotateCcw, Settings } from "lucide-react";
import { Link, Route, Switch, Router as WouterRouter, useLocation } from "wouter";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
});

const COLORS = { teal: "#318d86", cyan: "#328bb1", amber: "#d99b42", red: "#c6544b", indigo: "#6f78aa", ink: "#203640" };

const ALERT_THRESHOLD_KEYS = Object.keys(ALERT_THRESHOLDS) as AlertThresholdKey[];
const INTERVAL_OPTIONS = [
  { label: "Cada 5 min", ms: 5 * 60 * 1000 },
  { label: "Cada 15 min", ms: 15 * 60 * 1000 },
  { label: "Cada 1 hora", ms: 60 * 60 * 1000 },
  { label: "Cada 24 horas", ms: 24 * 60 * 60 * 1000 },
];

function exportCSV(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function formatDate(date: string | number) {
  return new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function formatResultDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) return date;
  return new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function usePersistentBedRecords() {
  const queryClient = useQueryClient();
  const query = useGetVigilanciaBedRecords({
    query: {
      queryKey: getGetVigilanciaBedRecordsQueryKey(),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const upsertMutation = useUpsertVigilanciaBedRecord();
  const deleteMutation = useDeleteVigilanciaBedRecord();
  const records = mapBedClinicalRecords(query.data ?? []);

  const saveRecord = async (bedId: string, record: BedClinicalRecord) => {
    if (record.occupied) {
      await upsertMutation.mutateAsync({ bedId, data: toBedRecordInput(record) });
    } else {
      await deleteMutation.mutateAsync({ bedId });
    }
    await queryClient.invalidateQueries({ queryKey: getGetVigilanciaBedRecordsQueryKey() });
  };

  return {
    query,
    records,
    saveRecord,
    saving: upsertMutation.isPending || deleteMutation.isPending,
  };
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RoutedErrorBoundary><Shell /></RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Shell() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem("vigilancia-theme") !== "light");
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>(readAlertThresholds);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("vigilancia-theme", isDark ? "dark" : "light");
  }, [isDark]);
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col px-5 py-6">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck size={22} /></div>
            <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-sidebar-foreground/55">Hospital General Docente</p><p className="text-[17px] font-semibold tracking-tight">Vigilancia</p></div>
          </div>
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Operación clínica</p>
          <nav className="space-y-1">
            <NavItem href="/" icon={<LayoutDashboard size={17} />} label="Resumen del piso" onNavigate={() => setMobileOpen(false)} />
            <NavItem href="/registro" icon={<ClipboardPenLine size={17} />} label="Registro clínico" onNavigate={() => setMobileOpen(false)} />
            <NavItem href="/transcripcion" icon={<Camera size={17} />} label="Transcribir censo" onNavigate={() => setMobileOpen(false)} />
            <NavItem href="/alertas" icon={<Siren size={17} />} label="Alertas" onNavigate={() => setMobileOpen(false)} />
            <NavItem href="/analitica" icon={<Activity size={17} />} label="Analítica" onNavigate={() => setMobileOpen(false)} />
            <NavItem href="/prediccion-brotes" icon={<BrainCircuit size={17} />} label="Predicción de brotes" onNavigate={() => setMobileOpen(false)} />
            <NavItem href="/configuracion" icon={<Settings size={17} />} label="Configuración institucional" onNavigate={() => setMobileOpen(false)} />
          </nav>
          <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sidebar-primary"><span className="h-2 w-2 rounded-full bg-sidebar-primary" /><span className="font-mono text-[10px] uppercase tracking-wider">Sistema operativo</span></div>
            <p className="text-xs leading-relaxed text-sidebar-foreground/65">Los indicadores orientan la revisión. No sustituyen el criterio clínico.</p>
          </div>
        </div>
      </aside>
      {mobileOpen && <button data-testid="button-close-mobile-nav" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-foreground/30 lg:hidden"><X className="absolute right-5 top-5 text-card" /></button>}
      <div className="lg:pl-[260px] clinical-grid">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><button data-testid="button-open-mobile-nav" aria-label="Abrir navegación" className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="hidden h-7 w-px bg-border sm:block" /><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Centro de control</p><p className="text-sm font-medium text-foreground">Áreas clínicas · Turno actual</p></div></div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex"><span className="h-2 w-2 rounded-full bg-primary" /> Datos en modo supervisión</div>
            <button data-testid="button-toggle-theme" aria-label="Cambiar modo de color" onClick={() => setIsDark((d) => !d)} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">MC</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1540px] px-4 py-6 md:px-8 md:py-8">
          <Switch>
            <Route path="/" component={() => <Dashboard isDark={isDark} thresholds={alertThresholds} />} />
            <Route path="/registro" component={() => <Registro thresholds={alertThresholds} />} />
            <Route path="/transcripcion" component={CensusTranscription} />
            <Route path="/alertas" component={() => <AlertsPage isDark={isDark} thresholds={alertThresholds} />} />
            <Route path="/analitica" component={() => <AnalyticsPage isDark={isDark} />} />
            <Route path="/prediccion-brotes" component={OutbreakPredictionPage} />
            <Route path="/configuracion">
              <InstitutionalConfigPage thresholds={alertThresholds} onSave={setAlertThresholds} />
            </Route>
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}
function NavItem({ href, icon, label, onNavigate }: { href: string; icon: ReactNode; label: string; onNavigate: () => void }) {
  const [location] = useLocation();
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return <Link data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`} href={href} onClick={onNavigate} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>{icon}<span>{label}</span></Link>;
}

function PageHeading({ eyebrow, title, copy, actions }: { eyebrow: string; title: ReactNode; copy: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-[-.04em] text-foreground md:text-[38px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy}</p></div>{actions}</div>;
}

function Dashboard({ isDark, thresholds }: { isDark: boolean; thresholds: AlertThresholds }) {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(7);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5 * 60 * 1000);
  const [spinning, setSpinning] = useState(false);
  const [selectedBed, setSelectedBed] = useState<VigilanciaBed | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const query = useGetVigilanciaDashboard({ days }, { query: { queryKey: getGetVigilanciaDashboardQueryKey({ days }) } });
  const bedRecordStore = usePersistentBedRecords();
  const bedRecords = bedRecordStore.records;
  const data = query.data;
  const loading = query.isLoading || query.isFetching || bedRecordStore.query.isLoading || bedRecordStore.query.isFetching;
  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [dropdownOpen]);
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaDashboardQueryKey({ days }) }),
        queryClient.invalidateQueries({ queryKey: getGetVigilanciaBedRecordsQueryKey() }),
      ]);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoRefresh, days, intervalMs, queryClient]);
  useEffect(() => {
    if (loading) {
      setSpinning(true);
      return undefined;
    }
    const t = window.setTimeout(() => setSpinning(false), 600);
    return () => window.clearTimeout(t);
  }, [loading]);
  const lastRefreshAt = Math.max(query.dataUpdatedAt, bedRecordStore.query.dataUpdatedAt);
  const lastRefresh = lastRefreshAt ? formatDate(lastRefreshAt) : "Aún no sincronizado";
  const beds = data?.beds ?? [];
  const automaticAlerts = data ? deriveAutomaticBedAlerts(beds, bedRecords, data.generatedAt, thresholds) : [];
  const alerts = [...automaticAlerts, ...(data?.alerts ?? [])];
  const activeAlerts = alerts.filter((alert) => alert.status === "active");
  const visibleAutomaticCount = activeAlerts.filter((alert) => alert.id.startsWith("auto-")).length;
  const visibleInstitutionalCount = activeAlerts.length - visibleAutomaticCount;
  const occupiedRecords = Object.values(bedRecords).filter((record) => record.occupied);
  const localMetricValues: Record<string, number> = {
    pacientes: occupiedRecords.length,
    alertas: activeAlerts.length,
    aislamientos: occupiedRecords.filter((record) => record.isolation !== "none").length,
    cvc: occupiedRecords.filter((record) => Number(record.centralLineDays) > 0).length,
    sondas: occupiedRecords.filter((record) => Number(record.urinaryCatheterDays) > 0 || Number(record.nasogastricTubeDays) > 0).length,
    culturas: occupiedRecords.filter((record) => record.cultureType !== "none" && record.cultureStatus === "positive").length,
  };
  const metrics = (data?.metrics ?? []).map((metric) => {
    if (!(metric.key in localMetricValues)) return metric;
    const value = localMetricValues[metric.key];
    return {
      ...metric,
      value,
      displayValue: String(value),
      helper: metric.key === "alertas"
        ? `${visibleInstitutionalCount} institucionales · ${visibleAutomaticCount} automáticas`
        : value > 0 ? "Calculado con registros locales" : "Sin registros ingresados",
    };
  });
  const trends = data?.trends ?? [];
  const breakdown = [
    { name: "Automáticas", value: alerts.filter((alert) => alert.id.startsWith("auto-")).length, color: COLORS.cyan },
    { name: "Institucionales", value: alerts.filter((alert) => !alert.id.startsWith("auto-")).length, color: COLORS.indigo },
  ].filter((item) => item.value > 0);
  const trendRows = trends.map((point) => ({ fecha: point.label, alertas_activas: point.activeAlerts, cultivos_positivos: point.positiveCultures, higiene_manos: point.handHygiene }));
  const saveBedRecord = async (record: BedClinicalRecord) => {
    if (!selectedBed) return;
    await bedRecordStore.saveRecord(selectedBed.id, record);
    setSelectedBed(null);
  };
  if (query.isError || bedRecordStore.query.isError) {
    return <ErrorState onRetry={() => { void Promise.all([query.refetch(), bedRecordStore.query.refetch()]); }} />;
  }
  return <div className="fade-in">
    <PageHeading eyebrow="Vigilancia Calderón / Resumen del piso" title={<span className="text-amber-300">Vigilancia y alerta temprana de infecciones · Hospital General Docente de Calderón</span>} copy="Una lectura rápida del estado de las áreas clínicas. Prioriza la revisión; no confundas una señal con un diagnóstico." actions={<DashboardControls days={days} setDays={setDays} dropdownOpen={dropdownOpen} setDropdownOpen={setDropdownOpen} dropdownRef={dropdownRef} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} intervalMs={intervalMs} setIntervalMs={setIntervalMs} spinning={spinning} onRefresh={() => { void Promise.all([query.refetch(), bedRecordStore.query.refetch()]); }} isDark={isDark} />} />
    <div className="mb-6 flex items-center justify-between border-y border-border py-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> Última actualización: <span className="font-mono text-foreground">{lastRefresh}</span></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Periodo</span>{[7, 14, 30, 90].map((value) => <button data-testid={`button-period-${value}`} key={value} onClick={() => setDays(value as 7 | 14 | 30 | 90)} className={`rounded-md px-2.5 py-1 font-mono transition-colors ${days === value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{value}d</button>)}</div></div>
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{loading ? [1, 2, 3, 4].map((i) => <MetricSkeleton key={i} />) : metrics.length ? metrics.slice(0, 4).map((metric) => <MetricCard key={metric.key} metric={metric} />) : <EmptyState title="Sin indicadores disponibles" copy="No hay métricas para este periodo." />}</section>
    <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
      <ChartCard title="Señales de vigilancia" subtitle="Evolución diaria del periodo" onExport={() => exportCSV("senales-vigilancia.csv", trendRows)} isDark={isDark}>{loading ? <ChartSkeleton /> : trends.length ? <ResponsiveContainer width="100%" height={280}><LineChart data={trends} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke={isDark ? "rgba(255,255,255,.08)" : "#dfe8e9"} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: isDark ? "#9bb0b5" : "#668089" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: isDark ? "#9bb0b5" : "#668089" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Line dataKey="activeAlerts" name="Alertas activas" stroke={COLORS.red} strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line dataKey="positiveCultures" name="Cultivos positivos" stroke={COLORS.amber} strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line dataKey="handHygiene" name="Higiene de manos" stroke={COLORS.teal} strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <EmptyState title="Aún no hay una serie temporal" copy="Registra observaciones para comenzar a ver la tendencia." />}</ChartCard>
      <ChartCard title="Distribución de alertas" subtitle="Por tipo de señal · periodo seleccionado" onExport={() => exportCSV("distribucion-alertas.csv", breakdown)} isDark={isDark}>{loading ? <ChartSkeleton /> : breakdown.length ? <div className="flex min-h-[280px] flex-col items-center justify-center gap-5 sm:flex-row"><div className="h-[190px] w-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={3} cornerRadius={3} stroke="none" isAnimationActive={false}>{breakdown.map((entry, index) => <Cell key={entry.name} fill={entry.color || [COLORS.red, COLORS.amber, COLORS.cyan, COLORS.indigo][index % 4]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer></div><div className="w-full max-w-[180px] space-y-3">{breakdown.map((item) => <div key={item.name} className="flex items-center justify-between gap-5 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />{item.name}</span><span className="font-mono font-bold text-foreground">{item.value}</span></div>)}</div></div> : <EmptyState title="Sin distribución" copy="La bandeja no contiene alertas en este periodo." />}</ChartCard>
    </section>
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
      <BedMap beds={beds} loading={loading} records={bedRecords} timestamp={data?.generatedAt} thresholds={thresholds} onSelectBed={setSelectedBed} />
      <AlertQueue alerts={alerts} loading={loading} />
    </section>
    {selectedBed && <BedClinicalRecordDialog key={selectedBed.id} bed={selectedBed} initialRecord={bedRecords[selectedBed.id]} onClose={() => setSelectedBed(null)} onSave={saveBedRecord} />}
  </div>;
}

function DashboardControls({ days, setDays, dropdownOpen, setDropdownOpen, dropdownRef, autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, spinning, onRefresh, isDark }: { days: number; setDays: (d: 7 | 14 | 30 | 90) => void; dropdownOpen: boolean; setDropdownOpen: (v: boolean) => void; dropdownRef: React.RefObject<HTMLDivElement | null>; autoRefresh: boolean; setAutoRefresh: (v: boolean) => void; intervalMs: number; setIntervalMs: (v: number) => void; spinning: boolean; onRefresh: () => void; isDark: boolean }) {
  return <div className="flex flex-wrap items-center gap-2">
    <div ref={dropdownRef} className="relative flex h-9 items-center overflow-visible rounded-lg border border-border bg-card">
      <button data-testid="button-refresh-dashboard" onClick={onRefresh} className="flex h-full items-center gap-2 px-3 text-xs font-medium hover:bg-muted"><RefreshCw size={14} className={spinning ? "animate-spin" : ""} />Actualizar</button>
      <span className="h-5 w-px bg-border" /><button data-testid="button-refresh-menu" aria-label="Opciones de actualización" onClick={() => setDropdownOpen(!dropdownOpen)} className="grid h-full w-8 place-items-center hover:bg-muted"><ChevronDown size={14} /></button>
      {dropdownOpen && <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-border bg-popover p-2 text-sm shadow-xl"><label className="flex items-center justify-between border-b border-border px-2 py-2.5 text-xs"><span>Auto-actualizar</span><input data-testid="input-auto-refresh" type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /></label>{INTERVAL_OPTIONS.map((option) => <button data-testid={`button-interval-${option.ms}`} key={option.ms} onClick={() => { setIntervalMs(option.ms); setAutoRefresh(true); setDropdownOpen(false); }} className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-muted"><span>{option.label}</span>{intervalMs === option.ms && <Check size={14} className="text-primary" />}</button>)}</div>}
    </div>
    <button data-testid="button-print-dashboard" aria-label="Exportar a PDF" onClick={() => window.print()} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"><Printer size={15} /></button>
  </div>;
}

function MetricCard({ metric }: { metric: VigilanciaMetric }) {
  const tone = { blue: "text-cyan", green: "text-primary", amber: "text-amber-600", red: "text-destructive" }[metric.tone] || "text-primary";
  const icon = metric.tone === "red" ? <Siren size={17} /> : metric.key.toLowerCase().includes("higiene") ? <Droplets size={17} /> : metric.key.toLowerCase().includes("cultura") ? <Thermometer size={17} /> : <HeartPulse size={17} />;
  return <div data-testid={`card-metric-${metric.key}`} className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5"><div className={`absolute left-0 top-0 h-full w-1 ${metric.tone === "red" ? "bg-destructive" : metric.tone === "amber" ? "bg-amber-500" : "bg-primary"}`} /><div className="mb-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">{metric.label}</span><span className={`grid h-8 w-8 place-items-center rounded-lg bg-muted ${tone}`}>{icon}</span></div><div className={`font-mono text-3xl font-bold tracking-[-.07em] ${tone}`}>{metric.displayValue}</div><p className="mt-2 text-xs text-muted-foreground">{metric.helper}</p></div>;
}

function MetricSkeleton() { return <div className="h-[155px] animate-pulse rounded-xl border border-border bg-card p-5"><div className="h-4 w-28 rounded bg-muted" /><div className="mt-8 h-9 w-20 rounded bg-muted" /><div className="mt-3 h-3 w-40 rounded bg-muted" /></div>; }
function ChartSkeleton() { return <div className="h-[280px] animate-pulse rounded-lg bg-muted/50" />; }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) { if (!active || !payload?.length) return null; return <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"><p className="mb-1 font-mono text-muted-foreground">{label}</p>{payload.map((item) => <div key={item.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} /><span>{item.name}</span><b className="ml-3 font-mono">{item.value}</b></div>)}</div>; }
function ChartCard({ title, subtitle, children, onExport }: { title: string; subtitle: string; children: ReactNode; onExport: () => void; isDark: boolean }) { return <div className="card-print rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div><button data-testid={`button-export-${title.toLowerCase().replaceAll(" ", "-")}`} aria-label={`Exportar ${title} a CSV`} onClick={onExport} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground print-hide"><Download size={14} /></button></div>{children}</div>; }

function BedMap({ beds, loading, records, timestamp, thresholds, onSelectBed }: { beds: VigilanciaBed[]; loading: boolean; records: BedClinicalRecords; timestamp?: string; thresholds: AlertThresholds; onSelectBed: (bed: VigilanciaBed) => void }) {
  const rooms = Object.entries(beds.reduce<Record<string, VigilanciaBed[]>>((groups, bed) => {
    (groups[bed.room] ??= []).push(bed);
    return groups;
  }, {}));
  const automaticAlerts = deriveAutomaticBedAlerts(beds, records, timestamp, thresholds);
  const savedRecords = Object.values(records);
  const effectiveRecords = beds.map((bed) => records[bed.id] ?? getBedRecordDefaults(bed));
  const localSummary = {
    updated: savedRecords.length,
    automatic: automaticAlerts.length,
    devices: effectiveRecords.filter((record) => Number(record.urinaryCatheterDays) > 0 || Number(record.nasogastricTubeDays) > 0 || Number(record.centralLineDays) > 0).length,
    isolation: effectiveRecords.filter((record) => !!record.isolation).length,
    positiveCultures: effectiveRecords.filter((record) => record.cultureStatus === "positive" || record.rectalSwabStatus === "positive").length,
  };
  return <div className="card-print rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-sm font-semibold">Mapa de camas</h2><p className="mt-1 text-xs text-muted-foreground">53 camas · Áreas Clínicas · selecciona una cama para ingresar o actualizar datos</p></div><Link data-testid="link-bed-map-alerts" href="/alertas" className="text-xs font-medium text-primary hover:underline">Ver alertas</Link></div><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">{[["Fichas guardadas", localSummary.updated], ["Alertas automáticas", localSummary.automatic], ["Con dispositivos", localSummary.devices], ["Aislamientos", localSummary.isolation], ["Cultivos positivos", localSummary.positiveCultures]].map(([label, value]) => <div key={label} className="rounded-lg border border-border/60 bg-background/35 px-3 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg font-bold text-primary">{value}</p></div>)}</div>{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div> : beds.length ? <div className="grid max-h-[680px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{rooms.map(([room, roomBeds]) => <div key={room} className="rounded-lg border border-border/70 bg-background/40 p-2.5"><div className="mb-2 flex items-center justify-between px-1"><span className="font-mono text-[11px] font-bold text-foreground">Sala {room}</span><span className="text-[10px] text-muted-foreground">{roomBeds.length} camas</span></div><div className="grid grid-cols-2 gap-2">{roomBeds.map((bed) => <BedCell key={bed.id} bed={bed} record={records[bed.id]} automaticAlerts={getAutomaticAlertsForBed(bed, records[bed.id], timestamp, thresholds)} onSelect={() => onSelectBed(bed)} />)}</div></div>)}</div> : <EmptyState title="Mapa sin registros" copy="No hay camas reportadas para esta vista." />}</div>;
}
function BedCell({ bed, record, automaticAlerts, onSelect }: { bed: VigilanciaBed; record?: BedClinicalRecord; automaticAlerts: VigilanciaAlert[]; onSelect: () => void }) {
  const patientCode = record ? (record.occupied ? record.patientCode || "Sin código" : "Disponible") : bed.patientCode;
  const available = patientCode === "Disponible";
  const stayDays = record?.stayDays ?? bed.days;
  const isolation = record?.isolation ?? bed.isolation;
  const swabStatus = record?.rectalSwabStatus ?? bed.rectalSwabStatus ?? "pending";
  const cultureType = record?.cultureType ?? bed.cultureType ?? "none";
  const cultureStatus = record?.cultureStatus ?? bed.cultureStatus ?? "pending";
  const urinaryDays = record?.urinaryCatheterDays ?? bed.urinaryCatheterDays;
  const nasogastricDays = record?.nasogastricTubeDays ?? bed.nasogastricTubeDays;
  const centralDays = record?.centralLineDays ?? bed.centralLineDays;
  const hasDevice = Number(urinaryDays) > 0 || Number(nasogastricDays) > 0 || Number(centralDays) > 0;
  const hasCriticalAutomatic = automaticAlerts.some((alert) => alert.level === "critical");
  const hasWarningAutomatic = automaticAlerts.some((alert) => alert.level === "warning");
  const color = hasCriticalAutomatic || bed.status === "critical" ? "border-destructive/50 bg-destructive/10" : hasWarningAutomatic || bed.status === "warning" ? "border-amber-500/50 bg-amber-500/10" : !!isolation ? "border-cyan/50 bg-cyan/10" : "border-primary/30 bg-primary/5";
  return <button type="button" data-testid={`card-bed-${bed.id}`} onClick={onSelect} className={`rounded-lg border p-2.5 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/70 ${color}`}><div className="flex items-start justify-between"><span className="font-mono text-[10px] text-muted-foreground">Cama {bed.bed}</span><span className={`h-2 w-2 rounded-full ${hasCriticalAutomatic || bed.status === "critical" ? "bg-destructive" : hasWarningAutomatic || bed.status === "warning" ? "bg-amber-500" : !!isolation ? "bg-cyan-500" : "bg-primary"}`} /></div><p className={`mt-2 truncate text-xs font-semibold ${available ? "text-muted-foreground" : "text-foreground"}`}>{available ? "Disponible" : patientCode}</p><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{available ? "Libre" : `${stayDays || 0} días`}</span><span>{automaticAlerts.length ? `${automaticAlerts.length} señal${automaticAlerts.length > 1 ? "es" : ""}` : record ? "Ficha guardada" : bed.alertCount ? `${bed.alertCount} señal${bed.alertCount > 1 ? "es" : ""}` : "Abrir ficha"}</span></div>{(record || hasDevice || cultureType !== "none" || !!isolation || swabStatus !== "pending") && <div className="mt-2 flex flex-wrap gap-1">{hasDevice && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary">Dispositivo</span>}{cultureType !== "none" && cultureStatus !== "pending" && <span className={`rounded px-1.5 py-0.5 text-[9px] ${cultureStatus === "positive" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{cultureStatus === "positive" ? "Cultivo +" : "Cultivo sin desarrollo"}</span>}{!!isolation && <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] text-cyan-300">{isolation}</span>}{swabStatus !== "pending" && <span className={`rounded px-1.5 py-0.5 text-[9px] ${swabStatus === "positive" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{swabLabel(swabStatus)}</span>}</div>}</button>;
}

function AlertQueue({ alerts, loading }: { alerts: VigilanciaAlert[]; loading: boolean }) {
  return <div className="card-print rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-sm font-semibold">Cola de revisión</h2><p className="mt-1 text-xs text-muted-foreground">Señales que requieren una mirada clínica</p></div><Link data-testid="link-all-alerts" href="/alertas" className="text-xs font-medium text-primary hover:underline">Abrir bandeja</Link></div>{loading ? <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div> : alerts.length ? <div className="space-y-1">{alerts.slice(0, 5).map((alert) => <AlertRow key={alert.id} alert={alert} />)}</div> : <EmptyState title="Bandeja tranquila" copy="No hay señales pendientes de revisión." />}</div>;
}
function AlertRow({ alert, compact = false, onAction }: { alert: VigilanciaAlert & { resultDate?: string }; compact?: boolean; onAction?: () => void }) {
  const level = alert.level === "critical"
    ? { label: "Prioridad alta", color: "text-destructive", bg: "bg-destructive" }
    : alert.level === "warning"
      ? { label: "Revisar", color: "text-amber-600", bg: "bg-amber-500" }
      : { label: "Informativa", color: "text-cyan-700", bg: "bg-cyan-600" };
  const automatic = alert.id.startsWith("auto-");
  return <div data-testid={`row-alert-${alert.id}`} className="signal-line rounded-lg px-4 py-3 pl-5 transition-colors hover:bg-muted/60"><div className="flex gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${level.bg}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-sm font-medium">{alert.title}</p><span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${automatic ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{automatic ? "Automática" : "Institucional"}</span><span className={`font-mono text-[10px] uppercase tracking-wide ${level.color}`}>{level.label}</span></div><p className={`mt-1 text-xs text-muted-foreground ${compact ? "line-clamp-1" : "line-clamp-2"}`}>{alert.patientCode} · {alert.location} · {alert.detail}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">{alert.resultDate && <span data-testid={`alert-result-date-${alert.id}`}>Resultado: {formatResultDate(alert.resultDate)}</span>}<span data-testid={`alert-updated-date-${alert.id}`}>Ficha actualizada: {formatDate(alert.createdAt)}</span></div></div>{onAction && <button data-testid={`button-acknowledge-${alert.id}`} onClick={onAction} className="self-center rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"> {alert.status === "active" ? "Reconocer" : "Restaurar"} </button>}</div></div>;
}
function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="flex min-h-[150px] flex-col items-center justify-center text-center"><div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Search size={17} /></div><p className="text-sm font-medium">{title}</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">{copy}</p></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center"><AlertCircle className="mx-auto mb-3 text-destructive" size={24} /><p className="text-sm font-medium">No pudimos cargar la información</p><p className="mt-1 text-xs text-muted-foreground">Comprueba la conexión con el servicio de vigilancia e inténtalo de nuevo.</p><button data-testid="button-retry-query" onClick={onRetry} className="mt-4 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Reintentar</button></div>; }

function AlertsPage({ isDark, thresholds }: { isDark: boolean; thresholds: AlertThresholds }) {
  const query = useGetVigilanciaAlerts({ query: { queryKey: getGetVigilanciaAlertsQueryKey() } });
  const dashboardQuery = useGetVigilanciaDashboard({ days: 7 }, { query: { queryKey: getGetVigilanciaDashboardQueryKey({ days: 7 }) } });
  const bedRecordStore = usePersistentBedRecords();
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged">("active");
  const [levels, setLevels] = useState<"all" | "critical" | "warning" | "info">("all");
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const bedRecords = bedRecordStore.records;
  const automaticAlerts = dashboardQuery.data ? deriveAutomaticBedAlerts(dashboardQuery.data.beds, bedRecords, dashboardQuery.data.generatedAt, thresholds) : [];
  const alerts = [...automaticAlerts, ...(query.data ?? [])].map((a) => ({ ...a, status: (localStatus[a.id] as VigilanciaAlert["status"]) || a.status }));
  const filtered = alerts.filter((a) => (filter === "all" || a.status === filter) && (levels === "all" || a.level === levels));
  const loading = query.isLoading || query.isFetching || dashboardQuery.isLoading || dashboardQuery.isFetching || bedRecordStore.query.isLoading || bedRecordStore.query.isFetching;
  if (query.isError || dashboardQuery.isError || bedRecordStore.query.isError) {
    return <ErrorState onRetry={() => { void Promise.all([query.refetch(), dashboardQuery.refetch(), bedRecordStore.query.refetch()]); }} />;
  }
  return <div className="fade-in"><PageHeading eyebrow="Vigilancia Calderón / Gestión de señales" title="Alertas" copy="Revisa, reconoce y devuelve señales a la bandeja activa. La acción documentada aquí es operativa, no diagnóstica." actions={<button data-testid="button-refresh-alerts" onClick={() => query.refetch()} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Actualizar</button>} /><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"><div className="flex flex-wrap gap-1">{(["active", "acknowledged", "all"] as const).map((value) => <button data-testid={`button-alert-status-${value}`} key={value} onClick={() => setFilter(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{value === "active" ? "Activas" : value === "acknowledged" ? "Reconocidas" : "Todas"} <span className="ml-1 font-mono">{value === "all" ? alerts.length : alerts.filter((a) => a.status === value).length}</span></button>)}</div><select data-testid="select-alert-level" value={levels} onChange={(e) => setLevels(e.target.value as typeof levels)} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="all">Todas las prioridades</option><option value="critical">Prioridad alta</option><option value="warning">Revisar</option><option value="info">Informativas</option></select></div><div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]"><div className="rounded-xl border border-border bg-card p-3">{loading ? <div className="space-y-3 p-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div> : filtered.length ? filtered.map((alert) => <AlertRow key={alert.id} alert={alert} onAction={() => setLocalStatus((prev) => ({ ...prev, [alert.id]: alert.status === "active" ? "acknowledged" : "active" }))} />) : <EmptyState title="No hay señales con estos filtros" copy="Prueba otra combinación o continúa con el registro del turno." />}</div><aside className="h-fit rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-center gap-2"><Bell size={16} className="text-primary" /><h2 className="text-sm font-semibold">Lectura de prioridad</h2></div><div className="space-y-4">{[["critical", "Prioridad alta", "Requiere revisión inmediata"], ["warning", "Revisar", "Confirmar en ronda clínica"], ["info", "Informativa", "Mantener en contexto"]].map(([key, label, copy]) => <div key={key} className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${key === "critical" ? "bg-destructive" : key === "warning" ? "bg-amber-500" : "bg-cyan-600"}`} /><div><p className="text-xs font-medium">{label}</p><p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{copy}</p></div></div>)}</div><div className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">Los umbrales son señales de vigilancia. Valida siempre la situación en la fuente clínica correspondiente.</div></aside></div></div>;
}
function AnalyticsPage({ isDark }: { isDark: boolean }) {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30);
  const query = useGetVigilanciaDashboard({ days }, { query: { queryKey: getGetVigilanciaDashboardQueryKey({ days }) } });
  const data = query.data;
  const loading = query.isLoading || query.isFetching;
  const trends = data?.trends ?? [];
  const rows = trends.map((point) => ({ fecha: point.label, alertas_activas: point.activeAlerts, cultivos_positivos: point.positiveCultures, higiene_manos: point.handHygiene }));
  return <div className="fade-in"><PageHeading eyebrow="Vigilancia Calderón / Lectura de periodo" title="Analítica" copy="Observa cambios y distribución para decidir dónde profundizar la próxima ronda." actions={<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">{[7, 14, 30, 90].map((value) => <button data-testid={`button-analytics-period-${value}`} key={value} onClick={() => setDays(value as 7 | 14 | 30 | 90)} className={`rounded-md px-3 py-1.5 font-mono text-xs ${days === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{value} días</button>)}</div>} /><div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><ChartCard title="Tendencia comparada" subtitle={`Últimos ${days} días · señales de vigilancia`} onExport={() => exportCSV("tendencia-comparada.csv", rows)} isDark={isDark}>{loading ? <ChartSkeleton /> : trends.length ? <ResponsiveContainer width="100%" height={330}><AreaChart data={trends} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="tealArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.teal} stopOpacity={.28} /><stop offset="100%" stopColor={COLORS.teal} stopOpacity={.02} /></linearGradient></defs><CartesianGrid stroke={isDark ? "rgba(255,255,255,.08)" : "#dfe8e9"} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: isDark ? "#9bb0b5" : "#668089" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: isDark ? "#9bb0b5" : "#668089" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area dataKey="handHygiene" name="Higiene de manos" stroke={COLORS.teal} fill="url(#tealArea)" strokeWidth={2.5} isAnimationActive={false} /><Line dataKey="activeAlerts" name="Alertas activas" stroke={COLORS.red} strokeWidth={2} dot={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer> : <EmptyState title="Sin datos de tendencia" copy="La serie aparecerá cuando exista captura para el periodo." />}</ChartCard><ChartCard title="Volumen de señales" subtitle="Conteo diario por categoría" onExport={() => exportCSV("volumen-senales.csv", rows)} isDark={isDark}>{loading ? <ChartSkeleton /> : trends.length ? <ResponsiveContainer width="100%" height={330}><BarChart data={trends} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke={isDark ? "rgba(255,255,255,.08)" : "#dfe8e9"} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: isDark ? "#9bb0b5" : "#668089" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: isDark ? "#9bb0b5" : "#668089" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="activeAlerts" name="Alertas activas" fill={COLORS.red} fillOpacity={.8} radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="positiveCultures" name="Cultivos positivos" fill={COLORS.amber} fillOpacity={.8} radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyState title="Sin volumen registrado" copy="No hay conteos para este periodo." />}</ChartCard></div><div className="mt-5 rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Lectura del periodo</h2><p className="mt-1 text-xs text-muted-foreground">Resumen operativo de los puntos disponibles</p></div><button data-testid="button-export-analytics-summary" onClick={() => exportCSV("resumen-analitica.csv", rows)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><Download size={14} />CSV</button></div><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[["Días observados", trends.length || "—"], ["Pico de alertas", trends.length ? Math.max(...trends.map((t) => t.activeAlerts)) : "—"], ["Cultivos positivos", trends.length ? trends.reduce((sum, t) => sum + t.positiveCultures, 0) : "—"], ["Higiene promedio", trends.length ? `${Math.round(trends.reduce((sum, t) => sum + t.handHygiene, 0) / trends.length)}%` : "—"]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-bold text-primary">{value}</p></div>)}</div></div></div>;
}

type Capture = { id: number; area: string; category: string; value: string; note: string; createdAt: string };
const CAPTURE_STORAGE_KEY = "vigilancia-capturas-v2";

const LEGACY_CAPTURE_STORAGE_KEY = "vigilancia-capturas";
function readCaptures(): Capture[] {
  return readMigratedJson(
    localStorage,
    CAPTURE_STORAGE_KEY,
    LEGACY_CAPTURE_STORAGE_KEY,
    [] as Capture[],
    (value): value is Capture[] => Array.isArray(value),
  );
}
function RegistroLegacy() {
  const [captures, setCaptures] = useState<Capture[]>(() => { try { return JSON.parse(localStorage.getItem("vigilancia-capturas") || "[]") as Capture[]; } catch { return []; } });
  const [area, setArea] = useState("Áreas Clínicas · Piso");
  const [category, setCategory] = useState("Censo");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const categories = [{ label: "Censo", icon: <HeartPulse size={16} /> }, { label: "Dispositivos", icon: <Activity size={16} /> }, { label: "Cultivos", icon: <Thermometer size={16} /> }, { label: "Aislamiento", icon: <ShieldCheck size={16} /> }, { label: "Higiene de manos", icon: <Droplets size={16} /> }, { label: "Antibióticos", icon: <BookOpen size={16} /> }, { label: "Limpieza ambiental", icon: <Wind size={16} /> }];
  const save = () => { if (!value.trim()) return; const next = [{ id: Date.now(), area, category, value, note, createdAt: new Date().toISOString() }, ...captures]; setCaptures(next); localStorage.setItem("vigilancia-capturas", JSON.stringify(next)); setValue(""); setNote(""); setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  const remove = (id: number) => { const next = captures.filter((item) => item.id !== id); setCaptures(next); localStorage.setItem("vigilancia-capturas", JSON.stringify(next)); };
   return <div className="fade-in"><PageHeading eyebrow="Vigilancia Calderón / Captura local" title="Registro del turno" copy="Captura primero, sincroniza después. Estos registros se guardan en este navegador y se identifican como datos locales de demostración." actions={<span className="flex items-center gap-2 rounded-full bg-accent px-3 py-2 text-xs text-accent-foreground"><span className="h-2 w-2 rounded-full bg-amber-500" /> Modo local activo</span>} /><div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]"><aside className="rounded-xl border border-border bg-card p-3"><p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Tipo de observación</p><div className="space-y-1">{categories.map((item) => <button data-testid={`button-category-${item.label.toLowerCase().replaceAll(" ", "-")}`} key={item.label} onClick={() => setCategory(item.label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${category === item.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.icon}<span>{item.label}</span>{category === item.label && <Check className="ml-auto" size={15} />}</button>)}</div></aside><section className="space-y-5"><div className="rounded-xl border border-border bg-card p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Nueva observación</p><h2 className="mt-1 text-xl font-semibold">{category}</h2></div><ClipboardPenLine className="text-muted-foreground" size={22} /></div><div className="grid gap-5 md:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Área clínica<select data-testid="select-capture-area" value={area} onChange={(e) => setArea(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"><option>Áreas Clínicas · Piso</option></select></label><label className="text-xs font-medium text-muted-foreground">Valor observado<input data-testid="input-capture-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={category === "Censo" ? "Ej. 18 pacientes" : "Ej. Sin hallazgos"} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-primary placeholder:text-muted-foreground/60 focus:ring-2" /></label><label className="text-xs font-medium text-muted-foreground md:col-span-2">Nota de contexto <textarea data-testid="input-capture-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Añade el contexto que ayude a la próxima revisión, sin incluir identificadores personales." rows={3} className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" /></label></div><div className="mt-6 flex items-center justify-end gap-3">{saved && <span className="text-xs text-primary">Guardado en este navegador</span>}<button data-testid="button-save-capture" onClick={save} disabled={!value.trim()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Check size={16} />Guardar observación</button></div></div><div className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Capturas recientes</h2><p className="mt-1 text-xs text-muted-foreground">Demo/local · solo visibles en este navegador</p></div><span className="font-mono text-xs text-muted-foreground">{captures.length} registros</span></div>{captures.length ? <div className="space-y-2">{captures.slice(0, 8).map((item) => <div data-testid={`row-capture-${item.id}`} key={item.id} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><FileText size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{item.category}</span><span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">LOCAL</span></div><p className="mt-1 text-xs text-muted-foreground">{item.area} · {item.value}{item.note ? ` · ${item.note}` : ""}</p></div><span className="font-mono text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</span><button data-testid={`button-delete-capture-${item.id}`} aria-label="Eliminar captura" onClick={() => remove(item.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X size={14} /></button></div>)}</div> : <EmptyState title="Empieza el registro del turno" copy="Selecciona una categoría y guarda la primera observación local." />}</div></section></div></div>;
}

function Registro({ thresholds }: { thresholds: AlertThresholds }) {
  const [category, setCategory] = useState("Dispositivos");
  const [captures, setCaptures] = useState<Capture[]>(readCaptures);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [selectedBed, setSelectedBed] = useState<VigilanciaBed | null>(null);
  const bedQuery = useGetVigilanciaDashboard({ days: 7 }, { query: { queryKey: getGetVigilanciaDashboardQueryKey({ days: 7 }) } });
  const bedRecordStore = usePersistentBedRecords();
  const bedRecords = bedRecordStore.records;
  const beds = bedQuery.data?.beds ?? [];
  const bedMode = category === "Dispositivos" || category === "Cultivos";
  const categories = [
    { label: "Dispositivos", icon: <Activity size={16} /> },
    { label: "Cultivos", icon: <Thermometer size={16} /> },
    { label: "Censo", icon: <HeartPulse size={16} /> },
    { label: "Aislamiento", icon: <ShieldCheck size={16} /> },
    { label: "Higiene de manos", icon: <Droplets size={16} /> },
    { label: "Antibióticos", icon: <BookOpen size={16} /> },
    { label: "Limpieza ambiental", icon: <Wind size={16} /> },
  ];
  const saveBedRecord = async (record: BedClinicalRecord) => {
    if (!selectedBed) return;
    await bedRecordStore.saveRecord(selectedBed.id, record);
    setSelectedBed(null);
  };
  const save = () => {
    if (!value.trim()) return;
    const next = [{ id: Date.now(), area: "Áreas Clínicas · Piso", category, value, note, createdAt: new Date().toISOString() }, ...captures];
    setCaptures(next);
    localStorage.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(next));
    setValue("");
    setNote("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const remove = (id: number) => {
    const next = captures.filter((item) => item.id !== id);
    setCaptures(next);
    localStorage.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(next));
  };

  if (bedQuery.isError || bedRecordStore.query.isError) {
    return <ErrorState onRetry={() => { void Promise.all([bedQuery.refetch(), bedRecordStore.query.refetch()]); }} />;
  }
  return <div className="fade-in">
    <PageHeading eyebrow="Vigilancia Calderón / Captura clínica" title="Registro del turno" copy="Para cultivos y dispositivos, selecciona primero la sala y la cama. Las fichas por cama se guardan en el servidor compartido y no deben incluir identificadores personales." actions={<span className="flex items-center gap-2 rounded-full bg-accent px-3 py-2 text-xs text-accent-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> Fichas persistentes</span>} />
    <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
      {categories.map((item) => <button data-testid={`button-category-${item.label.toLowerCase().replaceAll(" ", "-")}`} key={item.label} onClick={() => { setCategory(item.label); setSelectedBed(null); }} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium ${category === item.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.icon}{item.label}</button>)}
    </div>
    {bedMode ? <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Captura estructurada</p><h2 className="mt-1 text-xl font-semibold">{category} por sala y cama</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Selecciona una cama de la lista para abrir su ficha. Así cada cultivo o dispositivo queda asociado a una ubicación concreta del piso.</p></div>
        <span className="font-mono text-xs text-muted-foreground">{beds.length} camas disponibles</span>
      </div>
      <BedMap beds={beds} loading={bedQuery.isLoading || bedQuery.isFetching || bedRecordStore.query.isLoading || bedRecordStore.query.isFetching} records={bedRecords} thresholds={thresholds} onSelectBed={setSelectedBed} />
    </section> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-center gap-2"><ClipboardPenLine size={17} className="text-primary" /><h2 className="text-sm font-semibold">Observación general</h2></div><p className="text-xs leading-relaxed text-muted-foreground">Esta categoría se registra para el piso completo. No la uses para datos que correspondan a una cama específica.</p><div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-100">No ingreses nombres, cédulas ni otros identificadores personales.</div></aside>
      <section className="space-y-5"><div className="rounded-xl border border-border bg-card p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Nueva observación</p><h2 className="mt-1 text-xl font-semibold">{category}</h2></div><ClipboardPenLine className="text-muted-foreground" size={22} /></div><div className="grid gap-5 md:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Área clínica<input value="Áreas Clínicas · Piso" disabled className="mt-2 h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground" /></label><label className="text-xs font-medium text-muted-foreground">Valor observado<input data-testid="input-capture-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={category === "Censo" ? "Ej. 18 pacientes" : "Ej. Sin hallazgos"} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-primary placeholder:text-muted-foreground/60 focus:ring-2" /></label><label className="text-xs font-medium text-muted-foreground md:col-span-2">Nota de contexto<textarea data-testid="input-capture-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Añade contexto para la próxima revisión, sin incluir identificadores personales." rows={3} className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" /></label></div><div className="mt-6 flex items-center justify-end gap-3">{saved && <span className="text-xs text-primary">Guardado en este navegador</span>}<button data-testid="button-save-capture" onClick={save} disabled={!value.trim()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Check size={16} />Guardar observación</button></div></div><div className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Capturas recientes</h2><p className="mt-1 text-xs text-muted-foreground">Registros locales · solo visibles en este navegador</p></div><span className="font-mono text-xs text-muted-foreground">{captures.length} registros</span></div>{captures.length ? <div className="space-y-2">{captures.slice(0, 8).map((item) => <div data-testid={`row-capture-${item.id}`} key={item.id} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><FileText size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{item.category}</span><span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">LOCAL</span></div><p className="mt-1 text-xs text-muted-foreground">{item.area} · {item.value}{item.note ? ` · ${item.note}` : ""}</p></div><span className="font-mono text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</span><button data-testid={`button-delete-capture-${item.id}`} aria-label="Eliminar captura" onClick={() => remove(item.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X size={14} /></button></div>)}</div> : <EmptyState title="Empieza el registro del turno" copy="Selecciona una categoría y guarda la primera observación local." />}</div></section>
    </div>}
    {selectedBed && <BedClinicalRecordDialog key={selectedBed.id} bed={selectedBed} initialRecord={bedRecords[selectedBed.id]} onClose={() => setSelectedBed(null)} onSave={saveBedRecord} />}
  </div>;
}
function ThresholdsCurrentList({ thresholds }: { thresholds: AlertThresholds }) {
  return (
    <div data-testid="panel-current-thresholds" className="grid gap-2 sm:grid-cols-3">
      {ALERT_THRESHOLD_KEYS.map((key) => (
        <div key={key} className="rounded-lg border border-border/70 bg-background/45 px-3 py-3">
          <p className="text-[11px] leading-snug text-muted-foreground">{ALERT_THRESHOLD_LABELS[key]}</p>
          <p data-testid={`current-threshold-${key}`} className="mt-1 font-mono text-xl font-bold text-primary">
            {thresholds[key]} <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">días</span>
          </p>
        </div>
      ))}
    </div>
  );
}
function NotFound() { return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted text-primary"><AlertCircle /></div><h1 className="text-2xl font-semibold">Ruta no encontrada</h1><p className="mt-2 text-sm text-muted-foreground">Esta vista todavía no forma parte del espacio operativo.</p><Link href="/" className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Volver al resumen</Link></div>; }

export default App;

function InstitutionalConfigPage({ thresholds, onSave }: { thresholds: AlertThresholds; onSave: (values: AlertThresholds) => void }) {
  const [draft, setDraft] = useState<Record<AlertThresholdKey, string>>(() => ({
    urinaryCatheterDays: String(thresholds.urinaryCatheterDays),
    centralLineDays: String(thresholds.centralLineDays),
    nasogastricTubeDays: String(thresholds.nasogastricTubeDays),
  }));
  const [errors, setErrors] = useState<Partial<Record<AlertThresholdKey, string>>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft({
      urinaryCatheterDays: String(thresholds.urinaryCatheterDays),
      centralLineDays: String(thresholds.centralLineDays),
      nasogastricTubeDays: String(thresholds.nasogastricTubeDays),
    });
  }, [thresholds]);

  const update = (key: AlertThresholdKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaved(false);
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      urinaryCatheterDays: Number(draft.urinaryCatheterDays),
      centralLineDays: Number(draft.centralLineDays),
      nasogastricTubeDays: Number(draft.nasogastricTubeDays),
    };
    const nextErrors = validateAlertThresholds(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    writeAlertThresholds(values);
    onSave(values);
    setSaved(true);
  };

  const restoreDefaults = () => {
    setDraft({
      urinaryCatheterDays: String(ALERT_THRESHOLDS.urinaryCatheterDays),
      centralLineDays: String(ALERT_THRESHOLDS.centralLineDays),
      nasogastricTubeDays: String(ALERT_THRESHOLDS.nasogastricTubeDays),
    });
    setErrors({});
    setSaved(false);
  };

  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="Vigilancia Calderón / Protocolo institucional"
        title="Configuración institucional"
        copy="Epidemiología puede adaptar los días de uso que activan la revisión de dispositivos. Los cambios se aplican a todas las alertas automáticas guardadas en este navegador."
        actions={<span className="flex items-center gap-2 rounded-full bg-accent px-3 py-2 text-xs text-accent-foreground"><ShieldCheck size={14} /> Configuración supervisada</span>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form noValidate onSubmit={save} className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Umbrales de revisión</p>
            <h2 className="mt-1 text-xl font-semibold">Días de uso por dispositivo</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Usa números enteros entre {ALERT_THRESHOLD_LIMITS.min} y {ALERT_THRESHOLD_LIMITS.max}. La señal se activa al alcanzar o superar el valor guardado.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {ALERT_THRESHOLD_KEYS.map((key) => (
              <label key={key} htmlFor={`input-threshold-${key}`} className="text-xs font-medium text-muted-foreground">
                {ALERT_THRESHOLD_LABELS[key]}
                <div className="relative mt-2">
                  <input
                    id={`input-threshold-${key}`}
                    data-testid={`input-threshold-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={ALERT_THRESHOLD_LIMITS.min}
                    max={ALERT_THRESHOLD_LIMITS.max}
                    step={1}
                    value={draft[key]}
                    aria-invalid={Boolean(errors[key])}
                    aria-describedby={errors[key] ? `error-threshold-${key}` : undefined}
                    onChange={(event) => update(key, event.target.value)}
                    className={`h-12 w-full rounded-lg border bg-background px-3 pr-14 font-mono text-lg font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary ${errors[key] ? "border-destructive" : "border-input"}`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-muted-foreground">días</span>
                </div>
                {errors[key] && <span id={`error-threshold-${key}`} role="alert" className="mt-2 block text-[11px] font-normal text-destructive">{errors[key]}</span>}
              </label>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button data-testid="button-restore-threshold-defaults" type="button" onClick={restoreDefaults} className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <RotateCcw size={14} />Restaurar valores iniciales
            </button>
            <div className="flex items-center justify-end gap-3">
              {saved && <span data-testid="threshold-save-success" role="status" className="text-xs font-medium text-primary">Guardado y recalculado</span>}
              <button data-testid="button-save-thresholds" type="submit" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5">
                <Check size={15} />Guardar umbrales
              </button>
            </div>
          </div>
        </form>
        <aside className="h-fit space-y-5 rounded-xl border border-border bg-card p-5">
          <div>
            <div className="mb-3 flex items-center gap-2"><Settings size={16} className="text-primary" /><h2 className="text-sm font-semibold">Umbrales vigentes</h2></div>
            <ThresholdsCurrentList thresholds={thresholds} />
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold text-foreground">Alcance clínico</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Estas señales orientan una revisión del dispositivo y sus cuidados. No confirman una infección ni sustituyen el criterio clínico.
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            La configuración queda en este navegador. Al guardar, el resumen, el mapa de camas y la bandeja de alertas se recalculan con los valores vigentes.
          </p>
        </aside>
      </div>
    </div>
  );
}
