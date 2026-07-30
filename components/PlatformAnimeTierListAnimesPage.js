"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarSync, Edit3, EyeOff, History, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import AniListSearchModal from "@/components/AniListSearchModal";
import AnimePosterImage from "@/components/AnimePosterImage";
import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";

const SEASONS = [
  { value: "WINTER", label: "Invierno" },
  { value: "SPRING", label: "Primavera" },
  { value: "SUMMER", label: "Verano" },
  { value: "FALL", label: "Otoño" },
];
const COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "anime", label: "Anime", sortable: true },
  { key: "aniListId", label: "AniList", sortable: true },
  { key: "format", label: "Formato", sortable: true },
  { key: "origin", label: "Origen", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];

function currentSeason() {
  const now = new Date();
  const season = ["WINTER", "WINTER", "WINTER", "SPRING", "SPRING", "SPRING", "SUMMER", "SUMMER", "SUMMER", "FALL", "FALL", "FALL"][now.getMonth()];
  return { year: now.getFullYear(), season };
}

function seasonLabel(item) {
  return `${SEASONS.find((season) => season.value === item.season)?.label || item.season} ${item.year}`;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function PlatformAnimeTierListAnimesPage({ initialSeasons = [], canSync = false, canCreate = false, canUpdate = false, canDelete = false }) {
  const initialSelection = currentSeason();
  const [seasons, setSeasons] = useState(initialSeasons);
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    initialSeasons.find((season) => season.status === "active")?.id || initialSeasons[0]?.id || null,
  );
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(String(initialSelection.year));
  const [season, setSeason] = useState(initialSelection.season);
  const [preview, setPreview] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [visibility, setVisibility] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => ({
    seasons: seasons.length,
    entries: entries.length,
    manual: entries.filter((entry) => entry.isManual).length,
    hidden: entries.filter((entry) => entry.isHiddenByAdmin || entry.isDeleted).length,
  }), [seasons, entries]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => (
      String(entry.id).includes(query)
      || String(entry.aniListId).includes(query)
      || (entry.title || "").toLowerCase().includes(query)
    ));
  }, [entries, searchQuery]);

  async function loadSeason(seasonId) {
    if (!seasonId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/anime-tier-list-animes?seasonId=${seasonId}`, { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el Tier List.");
      setSeasons(data.seasons || []);
      setEntries(data.entries || []);
      setSelectedSeasonId(seasonId);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (initialSeasons.length) {
      if (selectedSeasonId) loadSeason(selectedSeasonId);
      return undefined;
    }
    let isMounted = true;
    fetch("/api/admin/anime-tier-list-animes", { cache: "no-store" })
      .then(readJson)
      .then((data) => {
        if (!isMounted) return;
        const list = data.seasons || [];
        setSeasons(list);
        const target = list.find((item) => item.status === "active")?.id || list[0]?.id;
        if (target) loadSeason(target);
      })
      .catch(() => { if (isMounted) toast.error("No se pudo cargar el Tier List de Animes."); });
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload) {
    const response = await fetch("/api/admin/anime-tier-list-animes", {
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
      await loadSeason(data.result.seasonId);
      toast.success("Tier List de Animes sincronizado desde AniList.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function createFromMetadata(metadata) {
    setIsCreateOpen(false);
    if (!selectedSeasonId) {
      toast.error("Selecciona una temporada primero.");
      return;
    }
    try {
      await post({ action: "create-entry", seasonId: selectedSeasonId, aniListId: metadata.providerId });
      await loadSeason(selectedSeasonId);
      toast.success("Anime agregado al Tier List.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveEntry(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await post({
        action: "update-entry",
        id: editingEntry.id,
        manualTitle: form.get("manualTitle"),
        manualVisible: visibility === "true" ? true : visibility === "false" ? false : null,
      });
      setEditingEntry(null);
      await loadSeason(selectedSeasonId);
      toast.success("Anime actualizado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function confirmDelete() {
    try {
      await post({ action: deleteEntry.isDeleted ? "restore-entry" : "delete-entry", id: deleteEntry.id });
      setDeleteEntry(null);
      await loadSeason(selectedSeasonId);
      toast.success(deleteEntry.isDeleted ? "Anime restaurado." : "Anime eliminado.");
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
        <h1 className="title">Tier List de Animes <span className="text-gradient">administración</span></h1>
        <p className="subtitle">Sincroniza el roster de la temporada desde AniList, agrega animes manuales y controla su visibilidad en el tier list.</p>
      </header>

      <MaintainerStats items={[
        { label: "Temporadas", value: stats.seasons, color: "purple" },
        { label: "Animes", value: stats.entries, color: "green" },
        { label: "Manuales", value: stats.manual, color: "blue" },
        { label: "Ocultos", value: stats.hidden, color: "orange" },
      ]}
      />

      <section className="season-sync-panel">
        <div className="season-sync-controls">
          <FilterSelect label="Año" value={year} options={yearOptions} onChange={setYear} />
          <FilterSelect label="Temporada" value={season} options={SEASONS} onChange={setSeason} />
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}><History size={17} /> Historial</button>
          <button type="button" className="tracker-action-primary" disabled={!canSync || isWorking} onClick={previewSync}>
            {isWorking ? <RefreshCw className="spin-icon" size={17} /> : <CalendarSync size={17} />}
            Consultar AniList
          </button>
        </div>
        {preview ? (
          <div className="season-sync-preview">
            <div><span>Animes</span><strong>{preview.summary.entries}</strong></div>
            <div><span>Nuevos</span><strong>{preview.summary.newEntries}</strong></div>
            <div><span>Ausentes</span><strong>{preview.summary.missingEntries}</strong></div>
            <button type="button" className="tracker-action-primary" disabled={!canSync || isWorking} onClick={() => setIsApplyOpen(true)}>Aplicar sincronización</button>
          </div>
        ) : null}
      </section>

      <section className="season-admin-seasons">
        <h2>Temporadas disponibles</h2>
        <div>
          {seasons.map((item) => (
            <button
              type="button"
              className={`season-admin-season ${item.id === selectedSeasonId ? "is-selected" : ""}`}
              key={item.id}
              onClick={() => loadSeason(item.id)}
            >
              <span>{seasonLabel(item)}</span>
              <small>{item.status === "active" ? "Activa" : item.status === "archived" ? "Archivada" : "Borrador"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="tracker-actions" aria-label="Acciones del Tier List de Animes">
        <div>
          <span className="tracker-actions-label">Tier List de Animes</span>
          <p className="tracker-actions-copy">Roster de la temporada seleccionada</p>
        </div>
        <div className="tracker-actions-buttons">
          {canCreate ? (
            <button type="button" className="tracker-action-primary" disabled={!selectedSeasonId} onClick={() => setIsCreateOpen(true)}>
              <Plus size={18} />
              Agregar anime
            </button>
          ) : null}
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-tierlist-animes-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, AniList o título"
        onSearchChange={setSearchQuery}
      />

      <MaintainerTable
        ariaLabel="Tier List de Animes"
        className="admin-anime-table"
        columns={COLUMNS}
        isLoading={isLoading}
        loadingText="Cargando Tier List..."
        isEmpty={!filteredEntries.length}
        emptyText="No hay animes que coincidan con la búsqueda."
      >
        {filteredEntries.map((entry) => (
          <div className="maintainer-table-row admin-anime-row" role="row" key={entry.id}>
            <span className="admin-user-cell admin-record-id">#{entry.id}</span>
            <div className="admin-user-cell admin-anime-profile">
              <AnimePosterImage src={entry.imageUrl} title={entry.title} className="admin-anime-placeholder" decorative />
              <strong title={entry.title}>{entry.title}</strong>
            </div>
            <span className="admin-user-cell admin-anime-code-cell">{entry.aniListId ? `#${entry.aniListId}` : "Manual"}</span>
            <span className="admin-user-cell admin-anime-format-cell">{entry.format || "-"}</span>
            <span className="admin-user-cell admin-anime-format-cell">{entry.isManual ? "Manual" : "AniList"}</span>
            <span className={`admin-user-status ${entry.isDeleted || entry.isHiddenByAdmin ? "is-inactive" : "is-active"}`}>
              {entry.isDeleted ? "Eliminado" : entry.isHiddenByAdmin ? "Oculto" : "Visible"}
            </span>
            <div className="admin-user-actions">
              {canUpdate ? (
                <Tooltip label="Editar anime">
                  <button type="button" className="icon-tool-button" aria-label="Editar anime" onClick={() => { setEditingEntry(entry); setVisibility(entry.manualVisible == null ? "" : String(entry.manualVisible)); }}>
                    <Edit3 size={17} />
                  </button>
                </Tooltip>
              ) : null}
              {canDelete ? (
                <Tooltip label={entry.isDeleted ? "Restaurar anime" : "Eliminar anime"}>
                  <button type="button" className={`icon-tool-button ${entry.isDeleted ? "" : "danger"}`} aria-label={entry.isDeleted ? "Restaurar anime" : "Eliminar anime"} onClick={() => setDeleteEntry(entry)}>
                    {entry.isDeleted ? <Power size={17} /> : <Trash2 size={17} />}
                  </button>
                </Tooltip>
              ) : null}
              {entry.isHiddenByAdmin ? <EyeOff size={14} /> : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

      <AniListSearchModal
        existingAnimes={[]}
        isOpen={isCreateOpen}
        title="Buscar en AniList"
        subtitle="Selecciona el anime que quieres agregar manualmente al Tier List de esta temporada."
        emptyText="Busca en AniList para seleccionar un anime."
        onClose={() => setIsCreateOpen(false)}
        onSelectMetadata={createFromMetadata}
      />

      <ConfirmModal
        isOpen={isApplyOpen}
        title="Aplicar sincronización"
        description="Se actualizarán los datos de fuente y se conservarán todos los overrides manuales. La operación quedará auditada."
        confirmLabel="Sincronizar"
        cancelLabel="Cancelar"
        onCancel={() => setIsApplyOpen(false)}
        onConfirm={applySync}
      />

      <ConfirmModal
        isOpen={Boolean(deleteEntry)}
        title={deleteEntry?.isDeleted ? "Restaurar anime" : "Eliminar anime"}
        description={deleteEntry?.isDeleted
          ? `"${deleteEntry?.title}" volverá a estar disponible en el Tier List.`
          : `"${deleteEntry?.title}" dejará de ofrecerse a usuarios nuevos. Quienes ya lo hayan rankeado lo seguirán viendo marcado como oculto.`}
        confirmLabel={deleteEntry?.isDeleted ? "Restaurar" : "Eliminar"}
        tone={deleteEntry?.isDeleted ? "default" : "danger"}
        cancelLabel="Cancelar"
        onCancel={() => setDeleteEntry(null)}
        onConfirm={confirmDelete}
      />

      {editingEntry ? (
        <MaintainerModal
          as="form"
          title="Editar anime del Tier List"
          subtitle="Los valores manuales tienen prioridad sobre futuras sincronizaciones."
          onClose={() => setEditingEntry(null)}
          onSubmit={saveEntry}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={() => setEditingEntry(null)}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <label className="notification-form-field"><span>Título manual</span><input className="modal-input" name="manualTitle" defaultValue={editingEntry.manualTitle || ""} placeholder={editingEntry.titleRomaji} /></label>
          <FormSelect label="Visibilidad" value={visibility} onChange={setVisibility} options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Visible" }, { value: "false", label: "Oculto" }]} />
        </MaintainerModal>
      ) : null}

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} module="admin.anime.tierlist.animes" title="Historial del Tier List de Animes" subtitle="Sincronizaciones y correcciones manuales." />
    </main>
  );
}
