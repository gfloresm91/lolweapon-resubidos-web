"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";

import AdminModal from "@/components/AdminModal";
import ConfirmModal from "@/components/ConfirmModal";
import FiltersBar from "@/components/FiltersBar";
import HomeDashboard from "@/components/HomeDashboard";
import LiveCard from "@/components/LiveCard";
import LoreModal from "@/components/LoreModal";
import StatsBar from "@/components/StatsBar";
import TagPanel from "@/components/TagPanel";
import WatchingPage from "@/components/WatchingPage";

function getAllTags(lives) {
  return Array.from(
    new Set(
      lives.flatMap((live) => (Array.isArray(live.tags) ? live.tags : [])),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function getAllYears(lives) {
  return Array.from(
    new Set(
      lives.map((live) => String(live.year || "").trim()).filter(Boolean),
    ),
  ).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
}

function getAllStatuses(lives) {
  return Array.from(
    new Set(
      lives.map((live) => String(live.status || "").trim()).filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function parseDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month}-${day}`;
}

function buildSearchHaystack(live) {
  return [live.title, ...(live.tags || []), live.additional_info].join(" ").toLowerCase();
}

function buildId() {
  return `new_${Date.now()}`;
}

const INITIAL_VISIBLE_COUNT = 80;
const LOAD_MORE_COUNT = 80;
const VIEW_LABELS = {
  home: "Inicio",
  tracker: "Rastreador de directos",
  watching: "Viendo",
};

const VIEW_PATHS = {
  home: "/inicio",
  tracker: "/rastreador",
  watching: "/viendo",
};

export default function HomePage({
  activeView = "home",
  initialLives = [],
  initialAnimes = [],
  initialYoutubeVideos = [],
  initialTwitchStream = null,
  initialTwitchProfile = null,
  initialTwitchChannelInfo = null,
  initialTwitchGame = null,
  twitchLogin,
  youtubeChannelUrl,
  isAdmin,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lives, setLives] = useState(initialLives);
  const [isSidebarOpen, setIsSidebarOpen] = useState(null);
  const [filters, setFilters] = useState({ search: "", year: "all", status: "all" });
  const [selectedTag, setSelectedTag] = useState("");
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [isLoreOpen, setIsLoreOpen] = useState(false);
  const [editingLive, setEditingLive] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(filters.search);
  const loadMoreRef = useRef(null);

  function redirectToLoginWithMessage(message) {
    setEditingLive(null);
    toast.error(message || "Tu sesion de admin ya no es valida. Vuelve a iniciar sesion.");
    router.push("/login");
    router.refresh();
  }

  const stats = useMemo(() => {
    const years = new Set(lives.map((live) => live.year).filter(Boolean));
    const lost = lives.filter((live) => String(live.status || "").toLowerCase().includes("lost")).length;
    return { total: lives.length, years: years.size, lost };
  }, [lives]);

  const preparedLives = useMemo(() => {
    return lives.map((live) => ({
      ...live,
      _searchHaystack: buildSearchHaystack(live),
      _sortDate: parseDate(live.date),
    }));
  }, [lives]);

  const filteredLives = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return [...preparedLives]
      .filter((live) => {
        const searchMatch = !normalizedSearch || live._searchHaystack.includes(normalizedSearch);
        const yearMatch = filters.year === "all" || live.year === filters.year;
        const statusMatch = filters.status === "all" || live.status === filters.status;
        const tagMatch = !selectedTag || (live.tags || []).includes(selectedTag);
        return searchMatch && yearMatch && statusMatch && tagMatch;
      })
      .sort((left, right) => right._sortDate.localeCompare(left._sortDate));
  }, [deferredSearch, filters.status, filters.year, preparedLives, selectedTag]);

  const visibleLives = useMemo(() => {
    return filteredLives.slice(0, visibleCount);
  }, [filteredLives, visibleCount]);
  const hasMoreLives = visibleLives.length < filteredLives.length;

  const allYears = useMemo(() => getAllYears(lives), [lives]);
  const allStatuses = useMemo(() => getAllStatuses(lives), [lives]);
  const allTags = useMemo(() => getAllTags(lives), [lives]);

  useEffect(() => {
    if (activeView !== "tracker") {
      return;
    }

    const querySearch = searchParams.get("search") || searchParams.get("q");
    const queryYear = searchParams.get("year");
    const queryStatus = searchParams.get("status");
    const queryTag = searchParams.get("tag");

    if (querySearch || queryYear || queryStatus) {
      setFilters((current) => ({
        ...current,
        search: querySearch ?? current.search,
        year: queryYear || current.year,
        status: queryStatus || current.status,
      }));
    }

    if (queryTag !== null) {
      setSelectedTag(queryTag);
    }
  }, [activeView, searchParams]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [deferredSearch, filters.status, filters.year, selectedTag]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 901px)");

    function syncSidebarState(event) {
      setIsSidebarOpen(event.matches);
    }

    setIsSidebarOpen(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  useEffect(() => {
    if (!hasMoreLives || !loadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => Math.min(current + LOAD_MORE_COUNT, filteredLives.length));
      },
      {
        root: null,
        rootMargin: "900px 0px",
        threshold: 0,
      },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [filteredLives.length, hasMoreLives]);

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (response.status === 401) {
      redirectToLoginWithMessage("No autorizado para subir imagenes. Vuelve a iniciar sesion.");
      throw new Error("Sesion expirada");
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || "No se pudo subir la imagen");
    }

    return data.path;
  }

  async function persistLive(nextLive) {
    setIsSaving(true);

    try {
      let imagePath = nextLive.image || "";

      if (nextLive.imageFile) {
        imagePath = await uploadImage(nextLive.imageFile);
      }

      const payload = {
        ...(nextLive || {}),
        image: imagePath,
      };

      delete payload.imageFile;
      payload.id = payload.id || buildId();

      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", live: payload }),
      });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para guardar cambios. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el directo");
      }

      setLives(data.lives);
      setEditingLive(null);
      toast.success("Cambios guardados correctamente.");
    } catch (error) {
      if (error.message !== "Sesion expirada") {
        toast.error(error.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLive(id) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para borrar directos. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo borrar el directo");
      }

      setLives(data.lives);
      setEditingLive(null);
      setPendingDeleteId(null);
      toast.success("Directo eliminado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  function selectView(view) {
    router.push(VIEW_PATHS[view] || "/inicio");
    if (window.matchMedia("(max-width: 900px)").matches) {
      setIsSidebarOpen(false);
    }
  }

  function toggleSidebar() {
    setIsSidebarOpen((current) => {
      if (current === null) {
        return !window.matchMedia("(min-width: 901px)").matches;
      }

      return !current;
    });
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />
      <div className="bg-orb orb-3" aria-hidden="true" />

      <div className={`app-shell ${isSidebarOpen === false ? "is-sidebar-closed" : ""}`}>
        <button
          type="button"
          className={`hamburger-button ${isSidebarOpen ? "is-open" : ""}`}
          aria-label={isSidebarOpen === false ? "Abrir menu" : "Cerrar menu"}
          aria-expanded={isSidebarOpen !== false}
          aria-controls="main-sidebar"
          onClick={toggleSidebar}
        >
          <span />
          <span />
          <span />
        </button>

        {isSidebarOpen ? (
          <button
            type="button"
            className="sidebar-overlay"
            aria-label="Cerrar menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <aside
          id="main-sidebar"
          className={`sidebar ${isSidebarOpen ? "is-open" : ""} ${isSidebarOpen === false ? "is-closed" : ""}`}
          aria-label="Menu principal"
        >
          <button
            type="button"
            className="sidebar-brand sidebar-brand-button"
            aria-label="Ir al inicio"
            onClick={() => selectView("home")}
          >
            <span className="sidebar-brand-mark">LW</span>
            <span className="sidebar-brand-text">Resubidos</span>
          </button>

          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-link sidebar-link-button ${activeView === "home" ? "is-active" : ""}`}
              onClick={() => selectView("home")}
            >
              <span className="sidebar-icon">IN</span>
              <span>Inicio</span>
            </button>
            <button
              type="button"
              className={`sidebar-link sidebar-link-button ${activeView === "tracker" ? "is-active" : ""}`}
              onClick={() => selectView("tracker")}
            >
              <span className="sidebar-icon">RD</span>
              <span>Rastreador de directos</span>
            </button>
            <button
              type="button"
              className={`sidebar-link sidebar-link-button ${activeView === "watching" ? "is-active" : ""}`}
              onClick={() => selectView("watching")}
            >
              <span className="sidebar-icon">VI</span>
              <span>Viendo</span>
            </button>
          </nav>
        </aside>

        <div className="content-shell">
          <header className="topbar" aria-label="Barra superior">
            <div className="topbar-title">
              <span className="topbar-kicker">Archivo VODs</span>
              <span className="topbar-page">{VIEW_LABELS[activeView]}</span>
            </div>

            {isAdmin ? (
              <div className="topbar-actions">
                <button type="button" id="btn-logout" className="admin-icon-button is-logged" onClick={logout}>
                  <span className="admin-icon" aria-hidden="true">A</span>
                  <span>Salir</span>
                </button>
              </div>
            ) : (
              <a href="/login" id="btn-login-top" className="admin-icon-button" aria-label="Iniciar sesion de admin">
                <span className="admin-icon" aria-hidden="true">A</span>
                <span>Admin</span>
              </a>
            )}
          </header>

          <div className="app-wrapper">
            {activeView === "home" ? (
              <HomeDashboard
                lives={lives}
                youtubeVideos={initialYoutubeVideos}
                twitchStream={initialTwitchStream}
                twitchProfile={initialTwitchProfile}
                twitchChannelInfo={initialTwitchChannelInfo}
                twitchGame={initialTwitchGame}
                twitchLogin={twitchLogin}
                youtubeChannelUrl={youtubeChannelUrl}
                onTrackerOpen={() => selectView("tracker")}
              />
            ) : null}

            {activeView === "tracker" ? (
              <>
        <header id="inicio" className="main-header">
          <div className="header-badge" id="btn-show-lore" onClick={() => setIsLoreOpen(true)}>
            🚀 ARCHIVO HISTORICO
          </div>
          <h1 className="title">
            Rastreador de <span className="text-gradient">Directos</span>
          </h1>
          <p className="subtitle">Explora y busca el archivo legendario de VODs y Resubidos.</p>
        </header>

        <div className="site-notice-container">
          <div className="site-notice-card">
            <span className="notice-badge">INFO</span>
            <p className="notice-text">
              Se utiliza el archivo base de la comunidad. Leer la hoja <strong>RTFM</strong>.
              Creditos a Piero y Redbreake.
            </p>
            <a
              href="https://onedrive.live.com/:x:/g/personal/87dad8f5b07a6f01/IQABb3qw9djaIICHlm4AAAAAAYc3We7evL0vIGHpS_nUDf8?rtime=ut4s6g6U3kg&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy84N2RhZDhmNWIwN2E2ZjAxL0lRQUJiM3F3OWRqYUlJQ0hsbTRBQUFBQUFZYzNXZTdldkwwdklHSHBTX25VRGY4"
              target="_blank"
              rel="noreferrer"
              className="notice-link"
            >
              <span className="link-icon">📂</span> OneDrive
            </a>
          </div>
        </div>

        <StatsBar stats={stats} />

        {isAdmin ? (
          <section className="tracker-actions" aria-label="Acciones del rastreador">
            <div>
              <span className="tracker-actions-label">Administración</span>
              <p className="tracker-actions-copy">Gestiona los registros del archivo.</p>
            </div>
            <button type="button" id="btn-add-live" className="tracker-action-primary" onClick={() => setEditingLive({})}>
              <span className="tracker-action-icon">+</span>
              Nuevo directo
            </button>
          </section>
        ) : null}

        <FiltersBar
          filters={filters}
          years={allYears}
          statuses={allStatuses}
          selectedTag={selectedTag}
          onFiltersChange={(partial) =>
            startTransition(() => {
              setFilters((current) => ({ ...current, ...partial }));
            })
          }
          onTagPanelOpen={() => setIsTagPanelOpen(true)}
          onClearTag={() =>
            startTransition(() => {
              setSelectedTag("");
            })
          }
        />

        <main>
          {filteredLives.length ? (
            <>
              <div className="results-meta">
                Mostrando {visibleLives.length} de {filteredLives.length} resultados
              </div>
              <div id="lives-grid" className="lives-grid">
                {visibleLives.map((live) => (
                  <LiveCard
                    key={live.id}
                    live={live}
                    isAdmin={isAdmin}
                    onEdit={() => setEditingLive(live)}
                    onFilterTag={(tag) =>
                      startTransition(() => {
                        setSelectedTag(tag);
                      })
                    }
                  />
                ))}
              </div>
              {hasMoreLives ? (
                <div ref={loadMoreRef} className="infinite-scroll-sentinel" aria-hidden="true">
                  <span className="infinite-scroll-label">Cargando más resultados…</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📼</div>
              <div className="empty-state-text">No hay resultados con esos filtros.</div>
            </div>
          )}
        </main>

        <footer className="site-footer">Archivo VODs · Desarrollado para mantener la historia</footer>
              </>
            ) : null}

            {activeView === "watching" ? (
              <WatchingPage initialAnimes={initialAnimes} isAdmin={isAdmin} />
            ) : null}
          </div>
          <footer className="persistent-footer">Por fans para fans 💜 para Kala</footer>
        </div>
      </div>

      <AdminModal
        live={editingLive && editingLive.id ? editingLive : null}
        isOpen={Boolean(editingLive)}
        onClose={() => setEditingLive(null)}
        onSave={persistLive}
        onDelete={(id) => setPendingDeleteId(id)}
        isSaving={isSaving}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteId)}
        title="Borrar directo"
        description="Esta acción eliminará el registro del archivo histórico. Puedes volver a crearlo después, pero este cambio se guardará inmediatamente."
        confirmLabel="Sí, borrar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => deleteLive(pendingDeleteId)}
      />

      <LoreModal isOpen={isLoreOpen} onClose={() => setIsLoreOpen(false)} />

      <TagPanel
        isOpen={isTagPanelOpen}
        tags={allTags}
        selectedTag={selectedTag}
        onClose={() => setIsTagPanelOpen(false)}
        onSelectTag={setSelectedTag}
        isAdmin={isAdmin}
      />
    </>
  );
}
