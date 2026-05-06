"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";

import AdminModal from "@/components/AdminModal";
import AnimeLibraryPage from "@/components/AnimeLibraryPage";
import AppSidebar from "@/components/AppSidebar";
import ConfirmModal from "@/components/ConfirmModal";
import FiltersBar from "@/components/FiltersBar";
import HomeDashboard from "@/components/HomeDashboard";
import LiveCard from "@/components/LiveCard";
import LoreModal from "@/components/LoreModal";
import StatsBar from "@/components/StatsBar";
import TagPanel from "@/components/TagPanel";
import SpaceDrumPage from "@/components/SpaceDrumPage";
import { LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";

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

function getLiveMonth(live) {
  const [, month = ""] = String(live.date || "").split("/");
  return month.padStart(2, "0");
}

function getAvailableMonths(lives, year) {
  return Array.from(
    new Set(
      lives
        .filter((live) => year === "all" || live.year === year)
        .map(getLiveMonth)
        .filter(Boolean),
    ),
  ).sort((left, right) => Number(left) - Number(right));
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
const EMPTY_LIST = [];
const VIEW_LABELS = {
  home: "Inicio",
  tracker: "Rastreador de directos",
  animeLibraryTracking: "Viendo",
  animeLibraryCompleted: "Anime terminados",
  spacedrum: "SpaceDrum",
};

const VIEW_PATHS = {
  home: "/inicio",
  tracker: "/rastreador",
  animeLibraryTracking: "/biblioteca-anime/viendo",
  animeLibraryCompleted: "/biblioteca-anime/terminados",
  spacedrum: "/spacedrum",
};
const TRACKER_RETURN_STATE_KEY = "kala_tracker_return_state";
const DEFAULT_TRACKER_FILTERS = { search: "", year: "all", month: "all", status: "all" };

function getViewFromPath(pathname) {
  return Object.entries(VIEW_PATHS).find(([, path]) => path === pathname)?.[0] || "home";
}

function getTrackerStateFromSearchParams(searchParams) {
  return {
    filters: {
      search: searchParams.get("search") || searchParams.get("q") || "",
      year: searchParams.get("year") || "all",
      month: searchParams.get("month") || "all",
      status: searchParams.get("status") || "all",
    },
    selectedTag: searchParams.get("tag") || "",
  };
}

function areTrackerFiltersEqual(left, right) {
  return (
    left.search === right.search &&
    left.year === right.year &&
    left.month === right.month &&
    left.status === right.status
  );
}

export default function HomePage({
  activeView = "home",
  initialLives = EMPTY_LIST,
  initialLiveStatuses = LIVE_STATUS_OPTIONS,
  initialAnimeLibrary = EMPTY_LIST,
  initialSpaceDrum = null,
  initialYoutubeVideos = EMPTY_LIST,
  initialTwitchStream = null,
  initialTwitchProfile = null,
  initialTwitchChannelInfo = null,
  initialTwitchGame = null,
  twitchLogin,
  youtubeChannelUrl,
  isAdmin,
}) {
  const isSpaceDrumEnabled = process.env.NEXT_PUBLIC_ENABLE_SPACEDRUM === "true";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lives, setLives] = useState(initialLives);
  const [liveStatuses, setLiveStatuses] = useState(initialLiveStatuses.length ? initialLiveStatuses : LIVE_STATUS_OPTIONS);
  const [animeLibrary, setAnimeLibrary] = useState(initialAnimeLibrary);
  const [isAnimeLibraryLoading, setIsAnimeLibraryLoading] = useState(false);
  const [currentView, setCurrentView] = useState(activeView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(null);
  const [filters, setFilters] = useState(() =>
    activeView === "tracker" ? getTrackerStateFromSearchParams(searchParams).filters : DEFAULT_TRACKER_FILTERS,
  );
  const [selectedTag, setSelectedTag] = useState(() =>
    activeView === "tracker" ? getTrackerStateFromSearchParams(searchParams).selectedTag : "",
  );
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [isLoreOpen, setIsLoreOpen] = useState(false);
  const [editingLive, setEditingLive] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTwitchActionLoading, setIsTwitchActionLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [pendingTrackerRestore, setPendingTrackerRestore] = useState(null);
  const [cardDensity, setCardDensity] = useState("comfortable");
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(filters.search);
  const loadMoreRef = useRef(null);
  const didRestoreTrackerRef = useRef(false);
  const skipVisibleResetRef = useRef(false);

  useEffect(() => {
    setLives(initialLives);
  }, [initialLives]);

  useEffect(() => {
    setLiveStatuses(initialLiveStatuses.length ? initialLiveStatuses : LIVE_STATUS_OPTIONS);
  }, [initialLiveStatuses]);

  useEffect(() => {
    setAnimeLibrary(initialAnimeLibrary);
  }, [initialAnimeLibrary]);

  useEffect(() => {
    setCurrentView(activeView);
  }, [activeView]);

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
      _month: getLiveMonth(live),
    }));
  }, [lives]);

  const filteredLives = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return [...preparedLives]
      .filter((live) => {
        const searchMatch = !normalizedSearch || live._searchHaystack.includes(normalizedSearch);
        const yearMatch = filters.year === "all" || live.year === filters.year;
        const monthMatch = filters.month === "all" || live._month === filters.month;
        const statusMatch = filters.status === "all" || live.status === filters.status;
        const tagMatch = !selectedTag || (live.tags || []).includes(selectedTag);
        return searchMatch && yearMatch && monthMatch && statusMatch && tagMatch;
      })
      .sort((left, right) => right._sortDate.localeCompare(left._sortDate));
  }, [deferredSearch, filters.month, filters.status, filters.year, preparedLives, selectedTag]);

  const visibleLives = useMemo(() => {
    return filteredLives.slice(0, visibleCount);
  }, [filteredLives, visibleCount]);
  const hasMoreLives = visibleLives.length < filteredLives.length;

  const allYears = useMemo(() => getAllYears(lives), [lives]);
  const availableMonths = useMemo(() => getAvailableMonths(lives, filters.year), [filters.year, lives]);
  const allStatuses = useMemo(() => getAllStatuses(lives), [lives]);
  const allTags = useMemo(() => getAllTags(lives), [lives]);
  const tagCounts = useMemo(() => {
    return lives.reduce((counts, live) => {
      (Array.isArray(live.tags) ? live.tags : []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return counts;
    }, {});
  }, [lives]);

  useEffect(() => {
    function handlePathChange(event) {
      const nextPath = event.detail?.path || window.location.pathname;
      setCurrentView(getViewFromPath(nextPath));
    }

    window.addEventListener("popstate", handlePathChange);
    window.addEventListener("kala:navigation", handlePathChange);

    return () => {
      window.removeEventListener("popstate", handlePathChange);
      window.removeEventListener("kala:navigation", handlePathChange);
    };
  }, []);

  useEffect(() => {
    if (currentView !== "tracker") {
      return;
    }

    const queryState = getTrackerStateFromSearchParams(searchParams);

    setFilters((current) => (areTrackerFiltersEqual(current, queryState.filters) ? current : queryState.filters));
    setSelectedTag((current) => (current === queryState.selectedTag ? current : queryState.selectedTag));
  }, [currentView, searchParams]);

  useEffect(() => {
    if (currentView !== "tracker" || didRestoreTrackerRef.current) {
      return;
    }

    didRestoreTrackerRef.current = true;

    try {
      const rawState = window.sessionStorage.getItem(TRACKER_RETURN_STATE_KEY);

      if (!rawState) {
        return;
      }

      const savedState = JSON.parse(rawState);
      window.sessionStorage.removeItem(TRACKER_RETURN_STATE_KEY);

      if (savedState?.filters) {
        skipVisibleResetRef.current = true;
        setFilters({
          search: savedState.filters.search || "",
          year: savedState.filters.year || "all",
          month: savedState.filters.month || "all",
          status: savedState.filters.status || "all",
        });
      }

      setSelectedTag(savedState?.selectedTag || "");
      setVisibleCount(Math.max(Number(savedState?.visibleCount) || INITIAL_VISIBLE_COUNT, INITIAL_VISIBLE_COUNT));
      setPendingTrackerRestore({
        liveId: savedState?.liveId || "",
        scrollY: Number(savedState?.scrollY) || 0,
      });
    } catch {
      window.sessionStorage.removeItem(TRACKER_RETURN_STATE_KEY);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "tracker" || lives.length) {
      return undefined;
    }

    let isMounted = true;

    async function loadLives() {
      const response = await fetch("/api/lives", { cache: "no-store" });
      const data = await response.json();

      if (isMounted && response.ok) {
        setLives(data.lives || []);
        setLiveStatuses(data.statuses || LIVE_STATUS_OPTIONS);
      }
    }

    loadLives();

    return () => {
      isMounted = false;
    };
  }, [currentView, lives.length]);

  useEffect(() => {
    if (!["animeLibraryTracking", "animeLibraryCompleted"].includes(currentView) || animeLibrary.length) {
      return undefined;
    }

    let isMounted = true;

    async function loadAnimeLibrary() {
      setIsAnimeLibraryLoading(true);

      try {
        const response = await fetch("/api/anime-library", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok) {
          setAnimeLibrary(data.animes || []);
        }
      } finally {
        if (isMounted) {
          setIsAnimeLibraryLoading(false);
        }
      }
    }

    loadAnimeLibrary();

    return () => {
      isMounted = false;
    };
  }, [animeLibrary.length, currentView]);

  useEffect(() => {
    if (skipVisibleResetRef.current) {
      skipVisibleResetRef.current = false;
      return;
    }

    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [deferredSearch, filters.month, filters.status, filters.year, selectedTag]);

  useEffect(() => {
    if (filters.month === "all" || availableMonths.includes(filters.month)) {
      return;
    }

    setFilters((current) => ({ ...current, month: "all" }));
  }, [availableMonths, filters.month]);

  useEffect(() => {
    if (currentView !== "tracker" || !pendingTrackerRestore || !visibleLives.length) {
      return;
    }

    const target = pendingTrackerRestore.liveId
      ? document.querySelector(`[data-live-id="${CSS.escape(pendingTrackerRestore.liveId)}"]`)
      : null;

    requestAnimationFrame(() => {
      if (target) {
        target.scrollIntoView({ block: "center" });
      } else {
        window.scrollTo({ top: pendingTrackerRestore.scrollY, behavior: "instant" });
      }

      setPendingTrackerRestore(null);
    });
  }, [currentView, pendingTrackerRestore, visibleLives.length]);

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
    const mediaQuery = window.matchMedia("(max-width: 899px)");

    function syncCardDensity(event) {
      if (event.matches) {
        setCardDensity("comfortable");
      }
    }

    syncCardDensity(mediaQuery);
    mediaQuery.addEventListener("change", syncCardDensity);

    return () => mediaQuery.removeEventListener("change", syncCardDensity);
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
      setLiveStatuses(data.statuses || liveStatuses);
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
      setLiveStatuses(data.statuses || liveStatuses);
      setEditingLive(null);
      setPendingDeleteId(null);
      toast.success("Directo eliminado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshLivesFromServer() {
    const response = await fetch("/api/lives", { cache: "no-store" });
    const data = await response.json();

    if (response.ok) {
      setLives(data.lives || []);
      setLiveStatuses(data.statuses || LIVE_STATUS_OPTIONS);
    }
  }

  async function archiveCurrentTwitchLive() {
    setIsTwitchActionLoading(true);

    try {
      const response = await fetch("/api/twitch/archive", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para crear el card desde Twitch. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo crear el card desde Twitch");
      }

      await refreshLivesFromServer();
      toast.success("Card de Twitch creado o actualizado.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsTwitchActionLoading(false);
    }
  }

  async function registerTwitchEventSub() {
    setIsTwitchActionLoading(true);

    try {
      const response = await fetch("/api/twitch/eventsub/subscribe", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para registrar EventSub. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo registrar EventSub");
      }

      toast.success("EventSub registrado. Twitch notificará el próximo directo.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsTwitchActionLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  function selectView(view) {
    const nextPath = VIEW_PATHS[view] || "/inicio";
    window.history.pushState(null, "", nextPath);
    window.dispatchEvent(new CustomEvent("kala:navigation", { detail: { path: nextPath } }));
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "instant" });

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

  function saveTrackerReturnState(liveId) {
    try {
      window.sessionStorage.setItem(
        TRACKER_RETURN_STATE_KEY,
        JSON.stringify({
          filters,
          selectedTag,
          visibleCount,
          liveId,
          scrollY: window.scrollY,
        }),
      );
    } catch {
      // Session storage can be unavailable in strict browser modes.
    }
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

        <AppSidebar
          id="main-sidebar"
          activeView={currentView}
          className={`${isSidebarOpen ? "is-open" : ""} ${isSidebarOpen === false ? "is-closed" : ""}`}
          isSpaceDrumEnabled={isSpaceDrumEnabled}
          onSelect={selectView}
        />

        <div className="content-shell">
          <header className="topbar" aria-label="Barra superior">
            <div className="topbar-title">
              <span className="topbar-kicker">Archivo VODs</span>
              <span className="topbar-page">{VIEW_LABELS[currentView]}</span>
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
            {currentView === "home" ? (
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

            {currentView === "tracker" ? (
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
            <button
              type="button"
              className="tracker-action-secondary"
              onClick={archiveCurrentTwitchLive}
              disabled={isTwitchActionLoading}
            >
              Crear card desde Twitch
            </button>
            <button
              type="button"
              className="tracker-action-secondary"
              onClick={registerTwitchEventSub}
              disabled={isTwitchActionLoading}
            >
              Registrar EventSub
            </button>
          </section>
        ) : null}

        <FiltersBar
          filters={filters}
          years={allYears}
          months={availableMonths}
          statuses={allStatuses}
          selectedTag={selectedTag}
          onSearchChange={(search) => {
            setFilters((current) => ({ ...current, search }));
          }}
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
                <span>Mostrando {visibleLives.length} de {filteredLives.length} resultados</span>
                {isPending ? <span className="tracker-loading-strip">Actualizando resultados...</span> : null}
                <div className="density-toggle" aria-label="Densidad de tarjetas">
                  <button
                    type="button"
                    className={cardDensity === "comfortable" ? "is-active" : ""}
                    onClick={() => setCardDensity("comfortable")}
                  >
                    Comodo
                  </button>
                  <button
                    type="button"
                    className={cardDensity === "compact" ? "is-active" : ""}
                    onClick={() => setCardDensity("compact")}
                  >
                    Compacto
                  </button>
                </div>
              </div>
              <div id="lives-grid" className={`lives-grid lives-grid-${cardDensity}`}>
                {cardDensity === "compact" ? (
                  <div className="lives-table-header" role="row" aria-hidden="true">
                    <span>Fecha</span>
                    <span>Título</span>
                    <span>Estado</span>
                    <span>Tags</span>
                    <span>Disponibilidad</span>
                    <span>Acción</span>
                  </div>
                ) : null}
                {visibleLives.map((live) => (
                  <LiveCard
                    key={live.id}
                    live={live}
                    isAdmin={isAdmin}
                    searchTerm={deferredSearch}
                    onEdit={() => setEditingLive(live)}
                    onFilterTag={(tag) =>
                      startTransition(() => {
                        setSelectedTag(tag);
                      })
                    }
                    onFilterYear={(year) =>
                      startTransition(() => {
                        setFilters((current) => ({ ...current, year: year || "all", month: "all" }));
                      })
                    }
                    onFilterStatus={(status) =>
                      startTransition(() => {
                        setFilters((current) => ({ ...current, status: status || "all" }));
                      })
                    }
                    onOpenDetail={saveTrackerReturnState}
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
              <button
                type="button"
                className="empty-state-action"
                onClick={() => {
                  setFilters({ search: "", year: "all", month: "all", status: "all" });
                  setSelectedTag("");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </main>

        <footer className="site-footer">Archivo VODs · Desarrollado para mantener la historia</footer>
              </>
            ) : null}

            {currentView === "animeLibraryTracking" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                isAdmin={isAdmin}
                isLoading={isAnimeLibraryLoading}
                mode="active"
                onAnimesChange={setAnimeLibrary}
              />
            ) : null}

            {currentView === "animeLibraryCompleted" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                isAdmin={isAdmin}
                isLoading={isAnimeLibraryLoading}
                mode="completed"
                onAnimesChange={setAnimeLibrary}
              />
            ) : null}

            {isSpaceDrumEnabled && currentView === "spacedrum" ? (
              <SpaceDrumPage data={initialSpaceDrum} />
            ) : null}
          </div>
          <footer className="persistent-footer">
            <span>Por fans para fans 💜 para Kala</span>
          </footer>
        </div>
      </div>

      <AdminModal
        live={editingLive && editingLive.id ? editingLive : null}
        isOpen={Boolean(editingLive)}
        onClose={() => setEditingLive(null)}
        onSave={persistLive}
        onDelete={(id) => setPendingDeleteId(id)}
        isSaving={isSaving}
        statuses={liveStatuses}
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
        tagCounts={tagCounts}
        selectedTag={selectedTag}
        onClose={() => setIsTagPanelOpen(false)}
        onSelectTag={setSelectedTag}
        isAdmin={isAdmin}
      />
    </>
  );
}
