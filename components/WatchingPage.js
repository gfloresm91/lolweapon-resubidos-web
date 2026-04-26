"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import ConfirmModal from "@/components/ConfirmModal";

const emptyAnime = {
  name: "",
  current_episode: "0",
  purchased: "0",
  image: "",
  tracker_url: "",
};

function isFullSeason(anime) {
  return String(anime?.purchased || "").trim().toUpperCase() === "ENTERA";
}

function buildId() {
  return `anime_${Date.now()}`;
}

function stepValue(value, step) {
  if (String(value || "").toUpperCase() === "ENTERA") {
    return step > 0 ? "ENTERA" : "0";
  }

  return String(Math.max((parseInt(value, 10) || 0) + step, 0));
}

function buildTrackerUrl(anime) {
  const configuredUrl = String(anime?.tracker_url || "").trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  return `/rastreador?search=${encodeURIComponent(anime?.name || "")}`;
}

function AnimeModal({ anime, isOpen, isSaving, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(emptyAnime);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...emptyAnime, ...(anime || {}) });
      setImageFile(null);
    }
  }, [isOpen, anime]);

  if (!isOpen) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error("El nombre del anime es obligatorio.");
      return;
    }

    onSave({
      ...anime,
      ...form,
      id: anime?.id || buildId(),
      imageFile,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content anime-admin-modal" onClick={(event) => event.stopPropagation()}>
        <h2 className="modal-title">{anime?.id ? "Editar Anime" : "Añadir Anime"}</h2>

        <form className="modal-body" onSubmit={submit}>
          <div className="form-group-modal">
            <label>Nombre</label>
            <input
              type="text"
              className="modal-input"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </div>

          <div className="form-group-modal">
            <label>Poster / Imagen local</label>
            <input
              type="file"
              accept="image/*"
              className="modal-input"
              onChange={(event) => setImageFile(event.target.files?.[0] || null)}
            />
            {form.image ? <p className="current-image-note">{form.image}</p> : null}
          </div>

          <div className="form-group-modal">
            <label>URL del rastreador</label>
            <input
              type="text"
              className="modal-input"
              placeholder="/rastreador?tag=WorldTrigger"
              value={form.tracker_url}
              onChange={(event) => updateField("tracker_url", event.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group-modal">
              <label>Capítulo actual visto</label>
              <div className="anime-stepper">
                <button type="button" className="btn-step" onClick={() => updateField("current_episode", stepValue(form.current_episode, -1))}>
                  -
                </button>
                <input
                  type="text"
                  className="modal-input anime-number-input"
                  value={form.current_episode}
                  onChange={(event) => updateField("current_episode", event.target.value)}
                />
                <button type="button" className="btn-step" onClick={() => updateField("current_episode", stepValue(form.current_episode, 1))}>
                  +
                </button>
              </div>
            </div>

            <div className="form-group-modal">
              <label>Capítulos comprados</label>
              <div className="anime-stepper">
                <button type="button" className="btn-step" onClick={() => updateField("purchased", stepValue(form.purchased, -1))}>
                  -
                </button>
                <input
                  type="text"
                  className="modal-input anime-number-input"
                  value={form.purchased}
                  onChange={(event) => updateField("purchased", event.target.value)}
                />
                <button type="button" className="btn-step" onClick={() => updateField("purchased", stepValue(form.purchased, 1))}>
                  +
                </button>
              </div>
              <button type="button" className="btn-entera" onClick={() => updateField("purchased", "ENTERA")}>
                ENTERA
              </button>
            </div>
          </div>

          <div className="modal-actions">
            {anime?.id ? (
              <button type="button" className="btn-modal btn-modal-danger" onClick={() => onDelete(anime.id)} disabled={isSaving}>
                Eliminar
              </button>
            ) : null}
            <button type="button" className="btn-modal btn-modal-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WatchingPage({ initialAnimes, isAdmin }) {
  const [animes, setAnimes] = useState(initialAnimes);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingAnime, setEditingAnime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    setAnimes(initialAnimes);
  }, [initialAnimes]);

  const stats = useMemo(() => {
    const fullSeasons = animes.filter((anime) => isFullSeason(anime)).length;
    const purchasedEpisodes = animes
      .filter((anime) => !isFullSeason(anime))
      .reduce((sum, anime) => sum + (parseInt(anime.purchased, 10) || 0), 0);
    const pending = animes.filter((anime) => !isFullSeason(anime) && (parseInt(anime.purchased, 10) || 0) === 0).length;

    return {
      total: animes.length,
      fullSeasons,
      purchasedEpisodes,
      pending,
    };
  }, [animes]);

  const filteredAnimes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return animes.filter((anime) => {
      const filterMatch =
        filter === "all" ||
        (filter === "entera" && isFullSeason(anime)) ||
        (filter === "purchased" && !isFullSeason(anime) && (parseInt(anime.purchased, 10) || 0) > 0);
      const searchMatch = !query || anime.name.toLowerCase().includes(query);

      return filterMatch && searchMatch;
    });
  }, [animes, filter, search]);

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "No se pudo subir la imagen");
    }

    return data.path;
  }

  async function saveAnime(nextAnime) {
    setIsSaving(true);

    try {
      let imagePath = nextAnime.image || "";

      if (nextAnime.imageFile) {
        imagePath = await uploadImage(nextAnime.imageFile);
      }

      const payload = { ...nextAnime, image: imagePath };
      delete payload.imageFile;

      const response = await fetch("/api/animes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", anime: payload }),
      });
      const data = await response.json();

      if (response.status === 401) {
        toast.error("Tu sesion de admin expiro. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el anime");
      }

      setAnimes(data.animes);
      setEditingAnime(null);
      toast.success("Anime guardado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAnime(id) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/animes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el anime");
      }

      setAnimes(data.animes);
      setEditingAnime(null);
      setPendingDeleteId(null);
      toast.success("Anime eliminado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="watching-header">
        <div className="header-badge">
          <span className="dot" />
          En progreso ahora mismo
        </div>
        <h1 className="title">
          Animes <span className="text-gradient">Kala</span>
        </h1>
        <p className="subtitle">Seguimiento de visualizaciones y capítulos comprados por el chat.</p>
      </header>

      <section className="watching-stats">
        <div className="watching-stat">
          <span className="watching-stat-value purple">{stats.total}</span>
          <span className="watching-stat-label">Total Animes</span>
        </div>
        <div className="watching-stat">
          <span className="watching-stat-value green">{stats.fullSeasons}</span>
          <span className="watching-stat-label">Temporada Entera</span>
        </div>
        <div className="watching-stat">
          <span className="watching-stat-value blue">{stats.purchasedEpisodes}</span>
          <span className="watching-stat-label">Caps Comprados</span>
        </div>
        <div className="watching-stat">
          <span className="watching-stat-value orange">{stats.pending}</span>
          <span className="watching-stat-label">Sin Comprar</span>
        </div>
      </section>

      {isAdmin ? (
        <section className="tracker-actions" aria-label="Acciones de viendo">
          <div>
            <span className="tracker-actions-label">Administración</span>
            <p className="tracker-actions-copy">Gestiona la lista de animes que se están viendo.</p>
          </div>
          <button type="button" className="tracker-action-primary" onClick={() => setEditingAnime({})}>
            <span className="tracker-action-icon">+</span>
            Añadir anime
          </button>
        </section>
      ) : null}

      <div className="watching-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar anime..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className={`watching-filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          Todos
        </button>
        <button type="button" className={`watching-filter-btn ${filter === "entera" ? "active" : ""}`} onClick={() => setFilter("entera")}>
          Entera
        </button>
        <button type="button" className={`watching-filter-btn ${filter === "purchased" ? "active" : ""}`} onClick={() => setFilter("purchased")}>
          Comprados
        </button>
      </div>

      <main>
        {filteredAnimes.length ? (
          <div className="anime-grid">
            {filteredAnimes.map((anime) => {
              const purchased = isFullSeason(anime);
              const purchasedCount = parseInt(anime.purchased, 10) || 0;

              return (
                <article
                  key={anime.id}
                  className={`anime-card ${isAdmin ? "is-admin" : ""}`}
                  onClick={isAdmin ? () => setEditingAnime(anime) : undefined}
                >
                  {isAdmin ? <span className="anime-edit-indicator">Editar</span> : null}
                  <div className="poster-container">
                    {anime.image ? (
                      <img src={anime.image} alt={anime.name} className="poster-img" loading="lazy" />
                    ) : (
                      <div className="poster-placeholder">AN</div>
                    )}
                    <div className="poster-overlay" />
                    <div className="title-overlay">
                      <h2 className="anime-title">{anime.name}</h2>
                    </div>
                  </div>
                  <div className="anime-card-body">
                    <div className="anime-stat-row">
                      <span className="anime-stat-label">Capítulo actual</span>
                      <span className="ep-badge">{anime.current_episode || "0"}</span>
                    </div>
                    <div className="card-divider" />
                    <div className="anime-stat-row">
                      <span className="anime-stat-label">Chat compró</span>
                      {purchased ? (
                        <span className="badge-entera">Entera</span>
                      ) : (
                        <span className={`badge-count ${purchasedCount === 0 ? "zero" : ""}`}>
                          {purchasedCount > 0 ? `${purchasedCount} cap${purchasedCount > 1 ? "s" : ""}` : "Sin comprar"}
                        </span>
                      )}
                    </div>
                    <a
                      href={buildTrackerUrl(anime)}
                      target="_blank"
                      rel="noreferrer"
                      className="anime-tracker-button"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Ver resubidos
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">AN</div>
            <div className="empty-state-text">No se encontraron animes con ese filtro.</div>
          </div>
        )}
      </main>

      <footer className="site-footer">Hecho para el chat de Kala · Actualiza desde el panel admin</footer>

      <AnimeModal
        anime={editingAnime?.id ? editingAnime : null}
        isOpen={Boolean(editingAnime)}
        isSaving={isSaving}
        onClose={() => setEditingAnime(null)}
        onSave={saveAnime}
        onDelete={(id) => setPendingDeleteId(id)}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteId)}
        title="Eliminar anime"
        description="Esta acción eliminará el anime de la lista de seguimiento."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => deleteAnime(pendingDeleteId)}
      />
    </>
  );
}
