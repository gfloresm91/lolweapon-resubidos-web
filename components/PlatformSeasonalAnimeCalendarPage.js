"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarSync, Edit3, Eye, EyeOff, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";

const SEASONS = [
  { value: "WINTER", label: "Invierno" },
  { value: "SPRING", label: "Primavera" },
  { value: "SUMMER", label: "Verano" },
  { value: "FALL", label: "Otoño" },
];

function currentSeason() {
  const now = new Date();
  const season = ["WINTER", "WINTER", "WINTER", "SPRING", "SPRING", "SPRING", "SUMMER", "SUMMER", "SUMMER", "FALL", "FALL", "FALL"][now.getMonth()];
  return { year: now.getFullYear(), season };
}

function seasonLabel(item) {
  return `${SEASONS.find((season) => season.value === item.season)?.label || item.season} ${item.year}`;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function PlatformSeasonalAnimeCalendarPage({
  initialResult = null,
  canSync = false,
  canUpdate = false,
}) {
  const initialSelection = currentSeason();
  const [result, setResult] = useState(initialResult || { seasons: [], activeSeason: null, recentSyncs: [] });
  const [year, setYear] = useState(String(initialSelection.year));
  const [season, setSeason] = useState(initialSelection.season);
  const [preview, setPreview] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [editingAnime, setEditingAnime] = useState(null);
  const [editingAiring, setEditingAiring] = useState(null);
  const [animeVisibility, setAnimeVisibility] = useState("");
  const [airingVisibility, setAiringVisibility] = useState("");

  const stats = useMemo(() => {
    const animes = result.activeSeason?.animes || [];
    return {
      seasons: result.seasons?.length || 0,
      animes: animes.length,
      airings: animes.reduce((total, anime) => total + (anime.airings?.length || 0), 0),
      overrides: animes.reduce((total, anime) => total + (anime.hasOverrides ? 1 : 0) + (anime.airings || []).filter((airing) => airing.hasOverrides).length, 0),
    };
  }, [result]);

  async function refresh(seasonId = result.activeSeason?.id) {
    const response = await fetch(`/api/admin/anime-calendar${seasonId ? `?seasonId=${seasonId}` : ""}`, { cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "No se pudo cargar el calendario.");
    setResult(data);
  }

  async function post(payload) {
    const response = await fetch("/api/admin/anime-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok || !data.success) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }

  async function previewSync() {
    setIsWorking(true);
    try {
      const data = await post({ action: "preview-sync", year: Number(year), season });
      setPreview(data.preview);
      toast.success("Previsualización preparada.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function applySync() {
    setIsApplyOpen(false);
    setIsWorking(true);
    try {
      const data = await post({ action: "apply-sync", year: Number(year), season });
      setPreview(null);
      await refresh(data.result.seasonId);
      toast.success("Calendario sincronizado desde AnimeSchedule y AniList.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function activateSeason(id) {
    setIsWorking(true);
    try {
      await post({ action: "activate-season", id });
      await refresh(id);
      toast.success("Temporada activa actualizada.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function saveAnime(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await post({
        action: "update-anime",
        anime: {
          id: editingAnime.id,
          manualTitle: form.get("manualTitle"),
          manualVisible: form.get("manualVisible") === "true" ? true : form.get("manualVisible") === "false" ? false : null,
        },
      });
      setEditingAnime(null);
      await refresh();
      toast.success("Override del anime guardado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveAiring(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await post({
        action: "update-airing",
        airing: {
          id: editingAiring.id,
          manualAiringAt: form.get("manualAiringAt") ? new Date(form.get("manualAiringAt")).toISOString() : null,
          manualEpisode: form.get("manualEpisode"),
          manualStatus: form.get("manualStatus"),
          manualPlatform: form.get("manualPlatform"),
          manualStreamingUrl: form.get("manualStreamingUrl"),
          manualVisible: form.get("manualVisible") === "true" ? true : form.get("manualVisible") === "false" ? false : null,
        },
      });
      setEditingAiring(null);
      await refresh();
      toast.success("Override de la emisión guardado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  const yearOptions = Array.from({ length: 7 }, (_, index) => {
    const value = String(new Date().getFullYear() - 2 + index);
    return { value, label: value };
  });

  return (
    <main className="season-calendar-admin">
      <header className="watching-header admin-users-header">
        <h1 className="title">Calendario de temporada <span className="text-gradient">administración</span></h1>
        <p className="subtitle">Previsualiza y sincroniza emisiones subtituladas desde AnimeSchedule y metadata desde AniList.</p>
      </header>

      <MaintainerStats items={[
        { label: "Temporadas", value: stats.seasons, color: "purple" },
        { label: "Animes", value: stats.animes, color: "green" },
        { label: "Emisiones", value: stats.airings, color: "blue" },
        { label: "Overrides", value: stats.overrides, color: "orange" },
      ]} />

      <section className="season-sync-panel">
        <div className="season-sync-controls">
          <FilterSelect label="Año" value={year} options={yearOptions} onChange={setYear} />
          <FilterSelect label="Temporada" value={season} options={SEASONS} onChange={setSeason} />
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}><History size={17} /> Historial</button>
          <button type="button" className="tracker-action-primary" disabled={!canSync || isWorking} onClick={previewSync}>
            {isWorking ? <RefreshCw className="spin-icon" size={17} /> : <CalendarSync size={17} />}
            Consultar fuentes
          </button>
        </div>
        {preview ? (
          <div className="season-sync-preview">
            <div><span>Animes</span><strong>{preview.summary.animes}</strong></div>
            <div><span>Emisiones</span><strong>{preview.summary.airings}</strong></div>
            <div><span>Nuevos animes</span><strong>{preview.summary.newAnimes}</strong></div>
            <div><span>Nuevas emisiones</span><strong>{preview.summary.newAirings}</strong></div>
            <div><span>Ausentes</span><strong>{preview.summary.missingAirings}</strong></div>
            <div><span>Conflictos</span><strong>{preview.summary.conflicts}</strong></div>
            <button type="button" className="tracker-action-primary" disabled={!canSync || isWorking} onClick={() => setIsApplyOpen(true)}>Aplicar sincronización</button>
          </div>
        ) : null}
      </section>

      <section className="season-admin-seasons">
        <h2>Temporadas disponibles</h2>
        <div>
          {(result.seasons || []).map((item) => (
            <button
              type="button"
              className={`season-admin-season ${item.id === result.activeSeason?.id ? "is-selected" : ""}`}
              key={item.id}
              onClick={() => refresh(item.id)}
            >
              <span>{seasonLabel(item)}</span>
              <small>{item.status === "active" ? "Activa" : item.status === "archived" ? "Archivada" : "Borrador"}</small>
            </button>
          ))}
        </div>
      </section>

      {result.activeSeason ? (
        <section className="season-admin-content">
          <div className="season-admin-heading">
            <div>
              <h2>{seasonLabel(result.activeSeason)}</h2>
              <p>Última sincronización: {result.activeSeason.lastSyncedAt ? new Date(result.activeSeason.lastSyncedAt).toLocaleString("es-CL") : "sin sincronizar"}</p>
            </div>
            {result.activeSeason.status !== "active" ? (
              <button type="button" className="tracker-action-secondary" disabled={!canUpdate || isWorking} onClick={() => activateSeason(result.activeSeason.id)}>
                <CalendarCheck2 size={17} /> Activar temporada
              </button>
            ) : null}
          </div>

          <div className="season-admin-anime-list">
            {(result.activeSeason.animes || []).map((anime) => (
              <article className="season-admin-anime" key={anime.id}>
                {anime.imageUrl ? <img src={anime.imageUrl} alt="" /> : null}
                <div className="season-admin-anime-info">
                  <strong>{anime.title}</strong>
                  <span>AniList #{anime.aniListId} · {anime.format || "Sin formato"} · {anime.airings.length} emisiones</span>
                  <div>{anime.isAdult ? <small>Adulto</small> : null}{anime.isDonghua ? <small>Donghua</small> : null}{anime.hasOverrides ? <small>Override</small> : null}</div>
                </div>
                <button type="button" className="maintainer-action-button" aria-label={`Editar ${anime.title}`} disabled={!canUpdate} onClick={() => { setEditingAnime(anime); setAnimeVisibility(anime.manualVisible == null ? "" : String(anime.manualVisible)); }}><Edit3 size={16} /></button>
                <div className="season-admin-airings">
                  {anime.airings.map((airing) => (
                    <button type="button" key={airing.id} disabled={!canUpdate} onClick={() => { setEditingAiring({ ...airing, animeTitle: anime.title }); setAiringVisibility(airing.manualVisible == null ? "" : String(airing.manualVisible)); }}>
                      <span>Ep. {airing.episode}</span>
                      <time>{new Date(airing.airingAt).toLocaleString("es-CL")}</time>
                      {airing.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <ConfirmModal
        isOpen={isApplyOpen}
        title="Aplicar sincronización"
        description="Se actualizarán los datos de fuente y se conservarán todos los overrides manuales. La operación quedará auditada."
        confirmLabel="Sincronizar"
        cancelLabel="Cancelar"
        onCancel={() => setIsApplyOpen(false)}
        onConfirm={applySync}
      />

      {editingAnime ? (
        <MaintainerModal
          as="form"
          title="Editar anime del calendario"
          subtitle="Los valores manuales tienen prioridad sobre futuras sincronizaciones."
          onClose={() => setEditingAnime(null)}
          onSubmit={saveAnime}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={() => setEditingAnime(null)}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <label className="notification-form-field"><span>Título manual</span><input className="modal-input" name="manualTitle" defaultValue={editingAnime.manualTitle || ""} placeholder={editingAnime.titleRomaji} /></label>
          <input type="hidden" name="manualVisible" value={animeVisibility} />
          <FormSelect label="Visibilidad" value={animeVisibility} onChange={setAnimeVisibility} options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Visible" }, { value: "false", label: "Oculto" }]} />
        </MaintainerModal>
      ) : null}

      {editingAiring ? (
        <MaintainerModal
          as="form"
          title={`Editar emisión · ${editingAiring.animeTitle}`}
          subtitle="Deja un campo vacío para volver a utilizar el valor de la fuente."
          onClose={() => setEditingAiring(null)}
          onSubmit={saveAiring}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={() => setEditingAiring(null)}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <div className="notification-form-grid">
            <label className="notification-form-field"><span>Fecha y hora manual</span><input className="modal-input" type="datetime-local" name="manualAiringAt" defaultValue={toDateTimeLocal(editingAiring.manualAiringAt)} /></label>
            <label className="notification-form-field"><span>Episodio manual</span><input className="modal-input" type="number" min="1" name="manualEpisode" defaultValue={editingAiring.manualEpisode || ""} placeholder={String(editingAiring.episode)} /></label>
            <label className="notification-form-field"><span>Estado manual</span><input className="modal-input" name="manualStatus" defaultValue={editingAiring.manualStatus || ""} placeholder={editingAiring.status} /></label>
            <label className="notification-form-field"><span>Plataforma manual</span><input className="modal-input" name="manualPlatform" defaultValue={editingAiring.manualPlatform || ""} placeholder={editingAiring.platforms?.[0]?.name || "Sin plataforma"} /></label>
          </div>
          <label className="notification-form-field"><span>URL de streaming manual</span><input className="modal-input" name="manualStreamingUrl" defaultValue={editingAiring.manualStreamingUrl || ""} placeholder={editingAiring.platforms?.[0]?.url || "https://..."} /></label>
          {editingAiring.platforms?.length ? (
            <p className="field-hint">Fuentes detectadas: {editingAiring.platforms.map((platform) => platform.name || "Sin nombre").join(", ")}. La plataforma manual reemplaza todas las fuentes detectadas.</p>
          ) : null}
          <input type="hidden" name="manualVisible" value={airingVisibility} />
          <FormSelect label="Visibilidad" value={airingVisibility} onChange={setAiringVisibility} options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Visible" }, { value: "false", label: "Oculta" }]} />
        </MaintainerModal>
      ) : null}

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} module="admin.anime.calendar" title="Historial del calendario" subtitle="Sincronizaciones y correcciones manuales." />
    </main>
  );
}
