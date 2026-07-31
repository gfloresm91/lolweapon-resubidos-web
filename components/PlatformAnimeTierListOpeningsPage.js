"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CalendarSync, Edit3, EyeOff, History, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import AnimePosterImage from "@/components/AnimePosterImage";
import AniListSearchModal from "@/components/AniListSearchModal";
import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";
import VideoSourcesField from "@/components/VideoSourcesField";

const AnimeImageDropzone = dynamic(() => import("@/components/AnimeImageDropzone"), { ssr: false });

function getPosterStatus(imageFile, imageUrl) {
  if (imageFile) return "Nueva imagen local seleccionada";
  if (imageUrl) return imageUrl.startsWith("/") ? "Imagen local guardada" : "Imagen externa";
  return "Sin imagen";
}

async function uploadThemeImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "No se pudo subir la imagen.");
  }
  return data.path;
}

function stepSequence(value, delta) {
  return String(Math.max(1, (parseInt(value, 10) || 0) + delta));
}

const COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "anime", label: "Anime", sortable: true },
  { key: "type", label: "Tipo", sortable: true },
  { key: "sequence", label: "N°", sortable: true },
  { key: "song", label: "Canción", sortable: true },
  { key: "origin", label: "Origen", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];

function seasonLabelFor(seasons, id) {
  const item = seasons.find((season) => season.id === id);
  if (!item) return "";
  const labels = { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño" };
  return `${labels[item.season] || item.season} ${item.year}`;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function PlatformAnimeTierListOpeningsPage({ initialSeasons = [], canSync = false, canCreate = false, canUpdate = false, canDelete = false }) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    initialSeasons.find((season) => season.status === "active")?.id || initialSeasons[0]?.id || null,
  );
  const [themes, setThemes] = useState([]);
  const [preview, setPreview] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAniListSearchOpen, setIsAniListSearchOpen] = useState(false);
  const [createSelectedAnime, setCreateSelectedAnime] = useState(null);
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImageError, setCreateImageError] = useState("");
  const [createImagePreviewUrl, setCreateImagePreviewUrl] = useState("");
  const [editingTheme, setEditingTheme] = useState(null);
  const [isEditAniListSearchOpen, setIsEditAniListSearchOpen] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageError, setEditImageError] = useState("");
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState("");
  const [deleteTheme, setDeleteTheme] = useState(null);
  const [manualType, setManualType] = useState("");
  const [createType, setCreateType] = useState("OP");
  const [createSequence, setCreateSequence] = useState("1");
  const [createIsAdultOverride, setCreateIsAdultOverride] = useState("");
  const [createIsDonghuaOverride, setCreateIsDonghuaOverride] = useState("");
  const [editSequence, setEditSequence] = useState("1");
  const [editSequenceTouched, setEditSequenceTouched] = useState(false);
  const [editIsAdultOverride, setEditIsAdultOverride] = useState("");
  const [editIsDonghuaOverride, setEditIsDonghuaOverride] = useState("");
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createAlternateSources, setCreateAlternateSources] = useState([]);
  const [editAlternateSources, setEditAlternateSources] = useState([]);
  const [editPrimaryUrlValue, setEditPrimaryUrlValue] = useState("");
  const [editPrimaryUrlTouched, setEditPrimaryUrlTouched] = useState(false);

  useEffect(() => {
    if (!createImageFile) {
      setCreateImagePreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(createImageFile);
    setCreateImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [createImageFile]);

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(editImageFile);
    setEditImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editImageFile]);

  useEffect(() => {
    setEditImageFile(null);
    setEditImageError("");
    setEditAlternateSources(Array.isArray(editingTheme?.alternateVideoUrls) ? editingTheme.alternateVideoUrls : []);
    setEditPrimaryUrlValue(editingTheme?.videoUrl || "");
    setEditPrimaryUrlTouched(false);
  }, [editingTheme]);

  useEffect(() => {
    if (isCreateOpen) {
      setCreateAlternateSources([]);
    }
  }, [isCreateOpen]);

  const stats = useMemo(() => ({
    seasons: seasons.length,
    themes: themes.length,
    manual: themes.filter((theme) => theme.isManual).length,
    hidden: themes.filter((theme) => theme.isHiddenByAdmin || theme.isDeleted).length,
  }), [seasons, themes]);

  const filteredThemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return themes;
    return themes.filter((theme) => (
      String(theme.id).includes(query)
      || (theme.animeTitle || "").toLowerCase().includes(query)
      || (theme.songTitle || "").toLowerCase().includes(query)
    ));
  }, [themes, searchQuery]);

  async function loadSeason(seasonId) {
    if (!seasonId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/anime-tier-list-openings?seasonId=${seasonId}`, { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No se pudo cargar Openings/Endings.");
      setSeasons(data.seasons || []);
      setThemes(data.themes || []);
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
    fetch("/api/admin/anime-tier-list-openings", { cache: "no-store" })
      .then(readJson)
      .then((data) => {
        if (!isMounted) return;
        const list = data.seasons || [];
        setSeasons(list);
        const target = list.find((item) => item.status === "active")?.id || list[0]?.id;
        if (target) loadSeason(target);
      })
      .catch(() => { if (isMounted) toast.error("No se pudo cargar Openings/Endings."); });
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload) {
    const response = await fetch("/api/admin/anime-tier-list-openings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok || !data.success) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }

  async function previewSync() {
    if (!selectedSeasonId) {
      toast.error("Selecciona una temporada primero.");
      return;
    }
    setIsWorking(true);
    try {
      const data = await post({ action: "preview-sync", seasonId: selectedSeasonId });
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
      const data = await post({ action: "apply-sync", seasonId: selectedSeasonId });
      setPreview(null);
      await loadSeason(selectedSeasonId);
      const addedEntries = data?.result?.summary?.addedEntries || 0;
      toast.success(
        addedEntries
          ? `Openings/Endings sincronizados. Se agregaron ${addedEntries} animes nuevos desde AniList.`
          : "Openings/Endings sincronizados desde AnimeThemes.moe.",
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsWorking(false);
    }
  }

  function selectCreateAnime(metadata) {
    setIsAniListSearchOpen(false);
    setCreateSelectedAnime({ aniListId: metadata.providerId, title: metadata.title, image: metadata.image });
    setCreateSequence("1");
    setCreateIsAdultOverride("");
    setCreateIsDonghuaOverride("");
    setIsCreateOpen(true);
  }

  function startManualAnimeEntry() {
    setIsAniListSearchOpen(false);
    setCreateSelectedAnime({ isManual: true });
    setCreateSequence("1");
    setIsCreateOpen(true);
  }

  function closeCreateTheme() {
    setIsCreateOpen(false);
    setCreateSelectedAnime(null);
    setCreateImageFile(null);
    setCreateImageError("");
  }

  async function createTheme(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      action: "create-theme",
      seasonId: selectedSeasonId,
      type: createType,
      sequence: form.get("sequence"),
      songTitle: form.get("songTitle"),
      artist: form.get("artist"),
      videoUrl: form.get("videoUrl"),
      primarySourceLabel: form.get("primarySourceLabel"),
      alternateVideoUrls: createAlternateSources,
    };
    if (createSelectedAnime?.isManual) {
      const animeTitle = String(form.get("animeTitle") || "").trim();
      if (!animeTitle) {
        toast.error("Escribe el título del anime.");
        return;
      }
      payload.animeTitle = animeTitle;
      payload.animeIsAdult = form.get("animeIsAdult") === "on";
      payload.animeIsDonghua = form.get("animeIsDonghua") === "on";
    } else if (createSelectedAnime?.aniListId) {
      payload.aniListId = createSelectedAnime.aniListId;
      payload.animeIsAdultOverride = createIsAdultOverride;
      payload.animeIsDonghuaOverride = createIsDonghuaOverride;
    } else {
      toast.error("Busca y selecciona un anime en AniList.");
      return;
    }
    try {
      if (createImageFile) {
        payload.animeImageUrl = await uploadThemeImage(createImageFile);
      }
      await post(payload);
      setIsCreateOpen(false);
      setCreateSelectedAnime(null);
      setCreateImageFile(null);
      await loadSeason(selectedSeasonId);
      toast.success("Opening/Ending agregado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveTheme(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      action: "update-theme",
      id: editingTheme.id,
      primarySourceLabel: form.get("primarySourceLabel"),
      alternateVideoUrls: editAlternateSources,
    };
    if (!editingTheme.animeAniListId) {
      payload.manualEntryIsAdult = form.get("animeIsAdult") === "on";
      payload.manualEntryIsDonghua = form.get("animeIsDonghua") === "on";
    } else {
      payload.manualEntryIsAdultOverride = editIsAdultOverride;
      payload.manualEntryIsDonghuaOverride = editIsDonghuaOverride;
    }
    if (editingTheme.isManual) {
      payload.type = manualType;
      payload.sequence = form.get("manualSequence");
      payload.videoUrl = form.get("manualVideoUrl");
      payload.songTitle = form.get("songTitle");
      payload.artist = form.get("artist");
      payload.manualEntryTitle = form.get("manualEntryTitle");
    } else {
      payload.manualType = isOverrideOpen ? manualType : "";
      payload.manualSequence = isOverrideOpen
        ? (editSequenceTouched ? form.get("manualSequence") : (editingTheme.manualSequence ?? ""))
        : "";
      payload.manualVideoUrl = isOverrideOpen
        ? (editPrimaryUrlTouched ? editPrimaryUrlValue : editingTheme.manualVideoUrl)
        : "";
      payload.manualSongTitle = isOverrideOpen ? form.get("manualSongTitle") : "";
      payload.manualArtist = isOverrideOpen ? form.get("manualArtist") : "";
    }
    try {
      if (editImageFile) {
        payload.manualEntryImageUrl = await uploadThemeImage(editImageFile);
      }
      await post(payload);
      setEditingTheme(null);
      await loadSeason(selectedSeasonId);
      toast.success("Opening/Ending actualizado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function applyEditAniListMetadata(metadata) {
    setIsEditAniListSearchOpen(false);
    if (!editingTheme) return;
    try {
      const data = await post({ action: "relink-entry", entryId: editingTheme.tierListEntryId, aniListId: metadata.providerId });
      setEditingTheme((current) => (current ? { ...current, animeTitle: data.entry.title, animeImageUrl: data.entry.imageUrl, animeAniListId: data.entry.aniListId } : current));
      setEditIsAdultOverride("");
      setEditIsDonghuaOverride("");
      setEditImageFile(null);
      await loadSeason(selectedSeasonId);
      toast.success("Ficha de AniList actualizada.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function confirmDelete() {
    try {
      await post({ action: deleteTheme.isDeleted ? "restore-theme" : "delete-theme", id: deleteTheme.id });
      setDeleteTheme(null);
      await loadSeason(selectedSeasonId);
      toast.success(deleteTheme.isDeleted ? "Restaurado." : "Eliminado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  const createThemeLabel = `Agregar ${createType === "ED" ? "ending" : "opening"} manual`;

  return (
    <main className="season-calendar-admin">
      <header className="watching-header admin-users-header">
        <h1 className="title">Tier List de Openings/Endings <span className="text-gradient">administración</span></h1>
        <p className="subtitle">Sincroniza openings y endings desde AnimeThemes.moe para los animes ya cargados en el Tier List de esa temporada.</p>
      </header>

      <MaintainerStats items={[
        { label: "Temporadas", value: stats.seasons, color: "purple" },
        { label: "Temas", value: stats.themes, color: "green" },
        { label: "Manuales", value: stats.manual, color: "blue" },
        { label: "Ocultos", value: stats.hidden, color: "orange" },
      ]}
      />

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
              <span>{seasonLabelFor(seasons, item.id)}</span>
              <small>{item.entriesCount} animes</small>
            </button>
          ))}
        </div>
      </section>

      <section className="season-sync-panel">
        <div className="season-sync-controls">
          <button type="button" className="tracker-action-primary" disabled={!canSync || isWorking || !selectedSeasonId} onClick={previewSync}>
            {isWorking ? <RefreshCw className="spin-icon" size={17} /> : <CalendarSync size={17} />}
            Consultar AnimeThemes.moe
          </button>
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}><History size={17} /> Historial</button>
          {canCreate ? (
            <button type="button" className="tracker-action-secondary" onClick={() => { setCreateSelectedAnime(null); setCreateType("OP"); setIsAniListSearchOpen(true); }}>
              <Plus size={17} /> {createThemeLabel}
            </button>
          ) : null}
        </div>
        {preview ? (
          <div className="season-sync-preview">
            <div><span>Animes con temas</span><strong>{preview.summary.animes}</strong></div>
            <div><span>Temas totales</span><strong>{preview.summary.themes}</strong></div>
            <div><span>Nuevos</span><strong>{preview.summary.newThemes}</strong></div>
            <div><span>Animes nuevos desde AniList</span><strong>{preview.summary.newEntriesFromAniList}</strong></div>
            <button type="button" className="tracker-action-primary" disabled={!canSync || isWorking} onClick={() => setIsApplyOpen(true)}>Aplicar sincronización</button>
          </div>
        ) : null}
        {preview?.summary.aniListError ? (
          <p className="field-hint">No se pudo consultar AniList para completar animes faltantes: {preview.summary.aniListError}. La sincronización con AnimeThemes.moe funciona igual.</p>
        ) : null}
        {preview?.newEntryTitles?.length ? (
          <p className="field-hint">Se agregarán desde AniList: {preview.newEntryTitles.join(", ")}.</p>
        ) : null}
      </section>

      <MaintainerToolbar
        searchId="admin-tierlist-openings-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, anime o canción"
        onSearchChange={setSearchQuery}
      />

      <MaintainerTable
        ariaLabel="Tier List de Openings/Endings"
        className="admin-anime-table"
        columns={COLUMNS}
        isLoading={isLoading}
        loadingText="Cargando temas..."
        isEmpty={!filteredThemes.length}
        emptyText="No hay openings/endings que coincidan con la búsqueda."
      >
        {filteredThemes.map((theme) => (
          <div className="maintainer-table-row admin-anime-row" role="row" key={theme.id}>
            <span className="admin-user-cell admin-record-id">#{theme.id}</span>
            <div className="admin-user-cell admin-anime-profile">
              <strong title={theme.animeTitle}>{theme.animeTitle}</strong>
            </div>
            <span className="admin-user-cell admin-anime-format-cell">{theme.type}</span>
            <span className="admin-user-cell admin-anime-format-cell">{theme.sequence}</span>
            <span className="admin-user-cell admin-anime-code-cell">{theme.songTitle || "-"}</span>
            <span className="admin-user-cell admin-anime-format-cell">{theme.isManual ? "Manual" : "AnimeThemes"}</span>
            <span className={`admin-user-status ${theme.isDeleted || theme.isHiddenByAdmin ? "is-inactive" : "is-active"}`}>
              {theme.isDeleted ? "Eliminado" : theme.isHiddenByAdmin ? "Oculto" : "Visible"}
            </span>
            <div className="admin-user-actions">
              {canUpdate ? (
                <Tooltip label="Editar">
                  <button
                    type="button"
                    className="icon-tool-button"
                    aria-label="Editar"
                    onClick={() => {
                      setEditingTheme(theme);
                      setEditIsAdultOverride(theme.animeManualIsAdult == null ? "" : String(theme.animeManualIsAdult));
                      setEditIsDonghuaOverride(theme.animeManualIsDonghua == null ? "" : String(theme.animeManualIsDonghua));
                      if (theme.isManual) {
                        setManualType(theme.type || "OP");
                        setEditSequence(String(theme.sequence || 1));
                      } else {
                        setManualType(theme.manualType || "");
                        setEditSequence(String(theme.manualSequence || theme.sequence || 1));
                        setEditSequenceTouched(false);
                        setIsOverrideOpen(Boolean(
                          theme.manualType || theme.manualSequence || theme.manualVideoUrl || theme.manualSongTitle || theme.manualArtist,
                        ));
                      }
                    }}
                  >
                    <Edit3 size={17} />
                  </button>
                </Tooltip>
              ) : null}
              {canDelete ? (
                <Tooltip label={theme.isDeleted ? "Restaurar" : "Eliminar"}>
                  <button type="button" className={`icon-tool-button ${theme.isDeleted ? "" : "danger"}`} aria-label={theme.isDeleted ? "Restaurar" : "Eliminar"} onClick={() => setDeleteTheme(theme)}>
                    {theme.isDeleted ? <Power size={17} /> : <Trash2 size={17} />}
                  </button>
                </Tooltip>
              ) : null}
              {theme.isHiddenByAdmin ? <EyeOff size={14} /> : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

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
        isOpen={Boolean(deleteTheme)}
        title={deleteTheme?.isDeleted ? "Restaurar tema" : "Eliminar tema"}
        description={deleteTheme?.isDeleted
          ? "Volverá a estar disponible en el Tier List."
          : "Dejará de ofrecerse a usuarios nuevos. Quienes ya lo hayan rankeado lo seguirán viendo marcado como oculto."}
        confirmLabel={deleteTheme?.isDeleted ? "Restaurar" : "Eliminar"}
        tone={deleteTheme?.isDeleted ? "default" : "danger"}
        cancelLabel="Cancelar"
        onCancel={() => setDeleteTheme(null)}
        onConfirm={confirmDelete}
      />

      {isCreateOpen ? (
        <MaintainerModal
          as="form"
          title={createThemeLabel}
          subtitle="Úsalo cuando AnimeThemes.moe todavía no tenga indexado el tema."
          onClose={closeCreateTheme}
          onSubmit={createTheme}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={closeCreateTheme}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <div className="notification-form-field">
            <span>Anime</span>
            {createSelectedAnime?.isManual ? (
              <input className="modal-input" name="animeTitle" placeholder="Título del anime" required />
            ) : (
              <div className="tierlist-anime-picked">
                <AnimePosterImage src={createSelectedAnime?.image} title={createSelectedAnime?.title} className="admin-user-avatar" decorative />
                <strong>{createSelectedAnime?.title}</strong>
              </div>
            )}
            <button type="button" className="tracker-action-secondary" onClick={() => setIsAniListSearchOpen(true)}>
              {createSelectedAnime?.aniListId ? "Cambiar ficha AniList" : "Buscar en AniList"}
            </button>
          </div>
          {createSelectedAnime?.isManual ? (
            <div className="tierlist-content-flags">
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsAdult" /> Contenido adulto</label>
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsDonghua" /> Donghua</label>
            </div>
          ) : (
            <div className="form-row">
              <div className="notification-form-field">
                <span>Contenido adulto</span>
                <FormSelect
                  value={createIsAdultOverride}
                  onChange={setCreateIsAdultOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
              <div className="notification-form-field">
                <span>Donghua</span>
                <FormSelect
                  value={createIsDonghuaOverride}
                  onChange={setCreateIsDonghuaOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
            </div>
          )}
          <div className="notification-form-field">
            <span>Poster (opcional)</span>
            <AnimeImageDropzone
              hasError={Boolean(createImageError)}
              onFile={(file) => { setCreateImageFile(file); setCreateImageError(""); }}
              onError={(error) => { setCreateImageFile(null); setCreateImageError(error); }}
            />
            <div className="anime-image-uploader-footer">
              <span>{getPosterStatus(createImageFile, createImagePreviewUrl || createSelectedAnime?.image)}</span>
              {createImageFile ? (
                <button type="button" className="profile-avatar-clear" onClick={() => { setCreateImageFile(null); setCreateImageError(""); }}>
                  Quitar imagen
                </button>
              ) : null}
            </div>
            {createImageError ? <span className="field-error">{createImageError}</span> : null}
          </div>
          <div className="form-row">
            <div className="notification-form-field">
              <span>Tipo</span>
              <FormSelect value={createType} onChange={setCreateType} options={[{ value: "OP", label: "Opening" }, { value: "ED", label: "Ending" }]} />
            </div>
            <div className="notification-form-field">
              <span>Número</span>
              <div className="anime-stepper">
                <button type="button" className="btn-step" onClick={() => setCreateSequence((value) => stepSequence(value, -1))}>-</button>
                <input type="text" inputMode="numeric" className="modal-input anime-number-input" name="sequence" value={createSequence} onChange={(event) => setCreateSequence(event.target.value)} required />
                <button type="button" className="btn-step" onClick={() => setCreateSequence((value) => stepSequence(value, 1))}>+</button>
              </div>
            </div>
          </div>
          <label className="notification-form-field"><span>Canción</span><input className="modal-input" name="songTitle" placeholder="Título de la canción" /></label>
          <label className="notification-form-field"><span>Artista</span><input className="modal-input" name="artist" placeholder="Artista o banda" /></label>
          <span className="notification-form-field-label">Fuentes</span>
          <div className="form-row tierlist-source-row">
            <input className="modal-input" name="primarySourceLabel" defaultValue="Fuente principal" required />
            <input className="modal-input" name="videoUrl" placeholder="https://..." required />
          </div>
          <VideoSourcesField sources={createAlternateSources} onChange={setCreateAlternateSources} />
        </MaintainerModal>
      ) : null}

      <AniListSearchModal
        isOpen={isAniListSearchOpen}
        title="Buscar anime en AniList"
        subtitle="Busca el anime al que pertenece este opening/ending."
        emptyText="Busca en AniList para seleccionar una ficha o crea el anime manualmente."
        onClose={() => setIsAniListSearchOpen(false)}
        onSelectMetadata={selectCreateAnime}
        actions={<button type="button" className="btn-modal btn-modal-secondary" onClick={startManualAnimeEntry}>Crear manualmente</button>}
      />

      {editingTheme ? (
        <MaintainerModal
          as="form"
          title={`Editar tema · ${editingTheme.animeTitle}`}
          subtitle={editingTheme.isManual ? "Edita los datos del tema." : "Deja un campo vacío para volver a utilizar el valor de la fuente."}
          onClose={() => setEditingTheme(null)}
          onSubmit={saveTheme}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={() => setEditingTheme(null)}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <span className={`tierlist-origin-badge ${editingTheme.isManual ? "is-manual" : "is-synced"}`}>
            {editingTheme.isManual ? "Creado manualmente" : "Sincronizado desde AnimeThemes.moe"}
          </span>
          <div className="notification-form-field">
            <span>Anime</span>
            <div className="tierlist-anime-picked">
              <AnimePosterImage src={editImagePreviewUrl || editingTheme.animeImageUrl} title={editingTheme.animeTitle} className="admin-user-avatar" decorative />
              <strong>{editingTheme.animeTitle}</strong>
            </div>
            <button type="button" className="tracker-action-secondary" onClick={() => setIsEditAniListSearchOpen(true)}>Cambiar ficha AniList</button>
          </div>
          {!editingTheme.animeAniListId ? (
            <div className="tierlist-content-flags">
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsAdult" defaultChecked={editingTheme.animeIsAdult} /> Contenido adulto</label>
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsDonghua" defaultChecked={editingTheme.animeIsDonghua} /> Donghua</label>
            </div>
          ) : (
            <div className="form-row">
              <div className="notification-form-field">
                <span>Contenido adulto</span>
                <FormSelect
                  value={editIsAdultOverride}
                  onChange={setEditIsAdultOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
              <div className="notification-form-field">
                <span>Donghua</span>
                <FormSelect
                  value={editIsDonghuaOverride}
                  onChange={setEditIsDonghuaOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
            </div>
          )}
          <div className="notification-form-field">
            <span>Poster</span>
            <AnimeImageDropzone
              hasError={Boolean(editImageError)}
              onFile={(file) => { setEditImageFile(file); setEditImageError(""); }}
              onError={(error) => { setEditImageFile(null); setEditImageError(error); }}
            />
            <div className="anime-image-uploader-footer">
              <span>{getPosterStatus(editImageFile, editingTheme.animeImageUrl)}</span>
              {editImageFile ? (
                <button type="button" className="profile-avatar-clear" onClick={() => { setEditImageFile(null); setEditImageError(""); }}>
                  Quitar imagen
                </button>
              ) : null}
            </div>
            {editImageError ? <span className="field-error">{editImageError}</span> : null}
          </div>
          {editingTheme.isManual ? (
            <>
              <label className="notification-form-field"><span>Título</span><input className="modal-input" name="manualEntryTitle" defaultValue={editingTheme.animeTitle || ""} placeholder="Título del anime" /></label>
              <div className="form-row">
                <div className="notification-form-field">
                  <span>Tipo</span>
                  <FormSelect value={manualType} onChange={setManualType} options={[{ value: "OP", label: "Opening" }, { value: "ED", label: "Ending" }]} />
                </div>
                <div className="notification-form-field">
                  <span>Número</span>
                  <div className="anime-stepper">
                    <button type="button" className="btn-step" onClick={() => setEditSequence((value) => stepSequence(value, -1))}>-</button>
                    <input type="text" inputMode="numeric" className="modal-input anime-number-input" name="manualSequence" value={editSequence} onChange={(event) => setEditSequence(event.target.value)} required />
                    <button type="button" className="btn-step" onClick={() => setEditSequence((value) => stepSequence(value, 1))}>+</button>
                  </div>
                </div>
              </div>
              <label className="notification-form-field"><span>Canción</span><input className="modal-input" name="songTitle" defaultValue={editingTheme.songTitle || ""} placeholder="Título de la canción" /></label>
              <label className="notification-form-field"><span>Artista</span><input className="modal-input" name="artist" defaultValue={editingTheme.artist || ""} placeholder="Artista o banda" /></label>
              <span className="notification-form-field-label">Fuentes</span>
              <div className="form-row tierlist-source-row">
                <input className="modal-input" name="primarySourceLabel" defaultValue={editingTheme.primarySourceLabel || "Fuente principal"} required />
                <input className="modal-input" name="manualVideoUrl" defaultValue={editingTheme.videoUrl || ""} required />
              </div>
              <VideoSourcesField sources={editAlternateSources} onChange={setEditAlternateSources} />
            </>
          ) : (
            <>
              {isOverrideOpen ? (
                <>
                  <div className="form-row">
                    <div className="notification-form-field">
                      <span>Tipo</span>
                      <FormSelect value={manualType} onChange={setManualType} options={[{ value: "", label: "Usar fuente" }, { value: "OP", label: "Opening" }, { value: "ED", label: "Ending" }]} />
                    </div>
                    <div className="notification-form-field">
                      <span>Número manual</span>
                      <div className="anime-stepper">
                        <button type="button" className="btn-step" onClick={() => { setEditSequenceTouched(true); setEditSequence((value) => stepSequence(value, -1)); }}>-</button>
                        <input type="text" inputMode="numeric" className="modal-input anime-number-input" name="manualSequence" value={editSequence} onChange={(event) => { setEditSequenceTouched(true); setEditSequence(event.target.value); }} />
                        <button type="button" className="btn-step" onClick={() => { setEditSequenceTouched(true); setEditSequence((value) => stepSequence(value, 1)); }}>+</button>
                      </div>
                    </div>
                  </div>
                  <label className="notification-form-field"><span>Canción</span><input key="song-title-editable" className="modal-input" name="manualSongTitle" defaultValue={editingTheme.manualSongTitle || ""} placeholder={editingTheme.songTitle || ""} /></label>
                  <label className="notification-form-field"><span>Artista</span><input key="artist-editable" className="modal-input" name="manualArtist" defaultValue={editingTheme.manualArtist || ""} placeholder={editingTheme.artist || ""} /></label>
                  <span className="notification-form-field-label">Fuentes</span>
                  <div className="form-row tierlist-source-row">
                    <input className="modal-input" name="primarySourceLabel" defaultValue={editingTheme.primarySourceLabel || "Fuente principal"} required />
                    <input
                      key="video-url-editable"
                      className="modal-input"
                      value={editPrimaryUrlValue}
                      onChange={(event) => { setEditPrimaryUrlTouched(true); setEditPrimaryUrlValue(event.target.value); }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="notification-form-field">
                      <span>Tipo</span>
                      <input className="modal-input" readOnly value={editingTheme.type === "ED" ? "Ending" : "Opening"} />
                    </div>
                    <div className="notification-form-field">
                      <span>Número</span>
                      <input className="modal-input" readOnly value={editingTheme.sequence} />
                    </div>
                  </div>
                  <label className="notification-form-field"><span>Canción</span><input key="song-title-readonly" className="modal-input" readOnly value={editingTheme.songTitle || ""} /></label>
                  <label className="notification-form-field"><span>Artista</span><input key="artist-readonly" className="modal-input" readOnly value={editingTheme.artist || ""} /></label>
                  <span className="notification-form-field-label">Fuentes</span>
                  <div className="form-row tierlist-source-row">
                    <input className="modal-input" name="primarySourceLabel" defaultValue={editingTheme.primarySourceLabel || "Fuente principal"} required />
                    <input key="video-url-readonly" className="modal-input" readOnly value={editingTheme.videoUrl || ""} />
                  </div>
                </>
              )}
              <VideoSourcesField sources={editAlternateSources} onChange={setEditAlternateSources} />
              <button
                type="button"
                className="anime-library-advanced-toggle"
                onClick={() => {
                  if (isOverrideOpen) {
                    setManualType("");
                    setEditSequenceTouched(false);
                    setEditPrimaryUrlValue(editingTheme.videoUrl || "");
                    setEditPrimaryUrlTouched(false);
                  }
                  setIsOverrideOpen((current) => !current);
                }}
              >
                {isOverrideOpen ? "Usar valores de la fuente" : "Personalizar estos campos"}
              </button>
            </>
          )}
        </MaintainerModal>
      ) : null}

      <AniListSearchModal
        isOpen={isEditAniListSearchOpen}
        title="Cambiar ficha AniList"
        subtitle="Busca el anime correcto; se actualizará el título y poster para todos los temas de este anime."
        onClose={() => setIsEditAniListSearchOpen(false)}
        onSelectMetadata={applyEditAniListMetadata}
      />

      <AuditLogModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} module="admin.anime.tierlist.openings" title="Historial de Openings/Endings" subtitle="Sincronizaciones y correcciones manuales." />
    </main>
  );
}
