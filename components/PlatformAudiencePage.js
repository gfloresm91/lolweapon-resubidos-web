"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock3, Eye, Radio, RefreshCw, Timer, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const EMPTY_RESULT = { currentSession: null, selectedSession: null, history: [], currentCount: 0 };
const CHART_MODES = [
  { value: "web", label: "Audiencia web" },
  { value: "twitch", label: "Twitch" },
  { value: "compare", label: "Comparar" },
];

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits }).format(Number(value) || 0);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)).replace(/\s/g, " ");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" })
    .format(new Date(value))
    .replace(/\s/g, " ");
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt) return "—";
  const milliseconds = Math.max(0, new Date(endedAt || Date.now()).getTime() - new Date(startedAt).getTime());
  const minutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function AudienceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="audience-chart-tooltip">
      <strong>{formatTime(label)}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </span>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, accent = "neutral" }) {
  return (
    <article className={`audience-metric is-${accent}`}>
      <span className="audience-metric-icon"><Icon size={17} aria-hidden="true" /></span>
      <div><span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</div>
    </article>
  );
}

export default function PlatformAudiencePage({ initialResult = EMPTY_RESULT }) {
  const normalizedInitialResult = initialResult || EMPTY_RESULT;
  const [result, setResult] = useState({ ...EMPTY_RESULT, ...normalizedInitialResult });
  const [selectedSessionId, setSelectedSessionId] = useState(normalizedInitialResult.selectedSession?.id || null);
  const [chartMode, setChartMode] = useState("web");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const loadDashboard = useCallback(async ({ sessionId = selectedSessionId, silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (sessionId) params.set("sessionId", String(sessionId));
      const response = await fetch(`/api/admin/audience?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "No se pudo cargar la audiencia.");
      setResult(payload);
      if (!sessionId && payload.selectedSession?.id) setSelectedSessionId(payload.selectedSession.id);
    } catch (error) {
      if (!silent) toast.error(error.message || "No se pudo cargar la audiencia.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => loadDashboard({ silent: true }), 30_000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    if (!initialResult) void loadDashboard({ silent: true });
  }, [initialResult, loadDashboard]);

  const selected = result.selectedSession;
  const samples = useMemo(() => (selected?.samples || []).map((sample) => ({
    ...sample,
    timestamp: new Date(sample.capturedAt).getTime(),
  })), [selected?.samples]);
  const peakSample = useMemo(() => samples.reduce((peak, sample) => (
    !peak || sample.concurrentCount > peak.concurrentCount ? sample : peak
  ), null), [samples]);
  const historyData = useMemo(() => result.history.slice(0, isCompact ? 5 : 10).map((session) => ({
    ...session,
    shortDate: new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(new Date(session.startedAt)),
  })).reverse(), [isCompact, result.history]);
  const isLive = Boolean(result.currentSession && !result.currentSession.endedAt);
  const hasSelectedSession = Boolean(selected);

  async function selectSession(sessionId) {
    setSelectedSessionId(sessionId);
    await loadDashboard({ sessionId });
  }

  return (
    <section className={`platform-audience-page ${hasSelectedSession ? "" : "is-empty"}`}>
      <header className="audience-page-header">
        <div>
          <h1>Audiencia web</h1>
          <p>Presencia concurrente en Inicio y evolución agregada por minuto. No representa views oficiales ni visitantes históricos.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={() => loadDashboard({ sessionId: selectedSessionId })} disabled={isLoading}>
          <RefreshCw size={15} className={isLoading ? "is-spinning" : ""} aria-hidden="true" /> Actualizar
        </button>
      </header>

      <div className="audience-live-strip">
        <span className={`audience-live-dot ${isLive ? "is-live" : ""}`} />
        <div><strong>{isLive ? "Directo en medición" : "Sin directo en medición"}</strong><small>{isLive ? result.currentSession.title : "Esperando el próximo directo."}</small></div>
        <span>Actualización automática cada 30 s</span>
      </div>

      <div className="audience-metrics-grid">
        <MetricCard icon={Radio} label="Ahora" value={formatNumber(result.currentCount)} helper="en esta página" accent="green" />
        <MetricCard icon={TrendingUp} label="Pico" value={selected ? formatNumber(selected.peakConcurrent) : "—"} helper={selected ? "máximo concurrente" : "Sin mediciones"} accent="purple" />
        <MetricCard icon={Activity} label="Promedio" value={selected ? formatNumber(selected.averageConcurrent, 1) : "—"} helper={selected ? "por muestra" : "Sin mediciones"} accent="cyan" />
        <MetricCard icon={Timer} label="Minutos-persona" value={selected ? formatNumber(selected.audienceMinutes) : "—"} helper={selected ? "audiencia acumulada" : "Sin mediciones"} accent="blue" />
        <MetricCard icon={Clock3} label="Duración medida" value={formatDuration(selected?.startedAt, selected?.endedAt)} helper={selected ? `${formatNumber(selected.sampleCount)} muestras` : "Sin mediciones"} />
        <MetricCard icon={Eye} label="Última muestra" value={selected?.lastSampleAt ? formatTime(selected.lastSampleAt) : "—"} helper={selected?.lastSampleAt ? formatDateTime(selected.lastSampleAt) : "Sin datos"} />
      </div>

      <div className="audience-dashboard-grid">
        <article className="audience-panel audience-timeline-panel">
          <header>
            <div><h2>Evolución del directo</h2><p>{selected ? `${selected.title} · ${formatDateTime(selected.startedAt)}` : "Selecciona un directo con muestras."}</p></div>
            {hasSelectedSession ? <div className="audience-chart-tabs" role="tablist" aria-label="Fuente del gráfico">
              {CHART_MODES.map((mode) => (
                <button key={mode.value} type="button" role="tab" aria-selected={chartMode === mode.value} className={chartMode === mode.value ? "is-active" : ""} onClick={() => setChartMode(mode.value)}>{mode.label}</button>
              ))}
            </div> : null}
          </header>
          {samples.length ? (
            <div className="audience-chart audience-timeline-chart" aria-label="Evolución temporal de audiencia">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={samples} margin={{ top: 18, right: 18, bottom: 4, left: 0 }} accessibilityLayer>
                  <defs>
                    <linearGradient id="audienceWebFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.38} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                  <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={formatTime} stroke="#8491a7" tickLine={false} axisLine={false} minTickGap={38} />
                  <YAxis allowDecimals={false} stroke="#8491a7" tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<AudienceTooltip />} />
                  {(chartMode === "web" || chartMode === "compare") ? <Area type="monotone" dataKey="concurrentCount" name="En esta página" stroke="#34d399" strokeWidth={2.5} fill="url(#audienceWebFill)" activeDot={{ r: 5 }} isAnimationActive={false} /> : null}
                  {(chartMode === "twitch" || chartMode === "compare") ? <Line type="monotone" dataKey="twitchConcurrentCount" name="Twitch" stroke="#a970ff" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} /> : null}
                  {chartMode === "web" && selected?.averageConcurrent != null ? <ReferenceLine y={selected.averageConcurrent} stroke="#6ee7f9" strokeDasharray="5 5" label={{ value: "Promedio", fill: "#9caac0", fontSize: 11 }} /> : null}
                  {chartMode === "web" && peakSample ? <ReferenceDot x={peakSample.timestamp} y={peakSample.concurrentCount} r={5} fill="#a970ff" stroke="#0b1018" /> : null}
                  {chartMode === "compare" ? <Legend /> : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="audience-empty"><Activity size={26} /><strong>Sin muestras todavía</strong><span>Comenzarán a registrarse cuando Twitch esté en directo.</span></div>}
          {chartMode === "compare" ? <p className="audience-chart-note">Twitch y la audiencia web son fuentes distintas y pueden superponerse. No se suman como un total.</p> : null}
        </article>

        <aside className="audience-panel audience-session-panel">
          <header><div><h2>Directos medidos</h2><p>Selecciona uno para revisar su detalle.</p></div></header>
          <div className="audience-session-list">
            {result.history.length ? result.history.map((session) => (
              <button type="button" key={session.id} className={selected?.id === session.id ? "is-active" : ""} onClick={() => selectSession(session.id)}>
                <span><strong>{session.title}</strong><small>{formatDateTime(session.startedAt)} · {formatDuration(session.startedAt, session.endedAt)}</small></span>
                <span><b>{formatNumber(session.peakConcurrent)}</b><small>pico</small></span>
              </button>
            )) : <div className="audience-empty is-compact"><span>Los directos medidos aparecerán aquí.</span></div>}
          </div>
        </aside>
      </div>

      {historyData.length ? <article className="audience-panel audience-history-panel">
        <header><div><h2>Promedio y pico por directo</h2><p>Comparación de las últimas {historyData.length || 0} sesiones medidas.</p></div></header>
        <div className="audience-chart audience-history-chart" aria-label="Comparación histórica de audiencia">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} layout={isCompact ? "vertical" : "horizontal"} margin={{ top: 12, right: 16, bottom: 8, left: 0 }} accessibilityLayer>
                <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                {isCompact
                  ? <><XAxis type="number" allowDecimals={false} stroke="#8491a7" tickLine={false} axisLine={false} /><YAxis type="category" dataKey="shortDate" stroke="#8491a7" tickLine={false} axisLine={false} width={58} /></>
                  : <><XAxis dataKey="shortDate" stroke="#8491a7" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#8491a7" tickLine={false} axisLine={false} width={36} /></>}
                <Tooltip cursor={{ fill: "rgba(148,163,184,.07)" }} contentStyle={{ background: "#111722", border: "1px solid #2a3445", borderRadius: 10 }} labelStyle={{ color: "#eef2f8" }} />
                <Legend />
                <Bar dataKey="averageConcurrent" name="Promedio" fill="#34d399" radius={isCompact ? [0, 5, 5, 0] : [5, 5, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="peakConcurrent" name="Pico" fill="#a970ff" radius={isCompact ? [0, 5, 5, 0] : [5, 5, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
        </div>
      </article> : null}
    </section>
  );
}
