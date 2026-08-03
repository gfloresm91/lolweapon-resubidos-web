"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, CalendarDays, ChevronLeft, ChevronRight, Clock3, Info } from "lucide-react";
import { toast } from "sonner";

import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import { AniListChip, PlatformChip } from "@/components/SeasonalAnimePlatformChip";
import SeasonalAnimeDetailModal from "@/components/SeasonalAnimeDetailModal";
import Tooltip from "@/components/Tooltip";

const TIME_ZONE_STORAGE_KEY = "kala_anime_calendar_timezone";
const ADULT_STORAGE_KEY = "kala_anime_calendar_hide_adult";
const DONGHUA_STORAGE_KEY = "kala_anime_calendar_hide_donghua";
const AUTO_TIME_ZONE_VALUE = "__auto__";
const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SEASON_LABELS = { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño" };
const DEFAULT_FILTERS = { hideAdult: true, hideDonghua: false, focusMode: "" };

function toDateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getZonedDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getWeekStart(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
}

function getWeekDays(weekStart) {
  return DAY_NAMES.map((name, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + index);
    return { name, key: toDateKey(date), date };
  });
}

function readStoredBoolean(key, fallback = false) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function seasonLabel(season) {
  return `${SEASON_LABELS[season.season] || season.season} ${season.year}${season.status === "active" ? " · activa" : ""}`;
}

function airingStatusLabel(airing) {
  const status = String(airing.status || "").toLowerCase();
  if (status.includes("delay")) return "Retrasado";
  if (status.includes("cancel")) return "Cancelado";
  if (status === "aired") return "Emitido";
  if (status === "airing") return "En emisión";
  return "Próximo";
}

function getSeasonWeekAnchor(activeSeason, timeZone) {
  const dates = (activeSeason?.animes || [])
    .flatMap((anime) => anime.airings || [])
    .filter((airing) => airing.isVisible)
    .map((airing) => new Date(airing.airingAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left - right);
  if (!dates.length) return new Date();

  const now = new Date();
  if (now < dates[0]) return dates[0];
  if (now > dates[dates.length - 1]) return dates[dates.length - 1];
  return new Date(`${getZonedDateKey(now, timeZone)}T12:00:00Z`);
}

function isAnimeAllowedByPreferences(anime, filters) {
  if (filters.focusMode) {
    const matchesFocus = {
      adult: () => Boolean(anime.isAdult),
      donghua: () => Boolean(anime.isDonghua),
    }[filters.focusMode]?.() ?? true;
    if (!matchesFocus) return false;
  }
  if (filters.focusMode !== "adult" && anime.isAdult && filters.hideAdult) return false;
  if (filters.focusMode !== "donghua" && anime.isDonghua && filters.hideDonghua) return false;
  return true;
}

export default function SeasonalAnimeCalendarPage({ initialResult = null, isLoading = false, isAuthenticated = false }) {
  const [result, setResult] = useState(initialResult || { seasons: [], activeSeason: null });
  const [selectedSeasonId, setSelectedSeasonId] = useState(String(initialResult?.activeSeason?.id || ""));
  const [timeZone, setTimeZone] = useState("UTC");
  const [timeZoneSelection, setTimeZoneSelection] = useState(AUTO_TIME_ZONE_VALUE);
  const [timeZones, setTimeZones] = useState(["UTC"]);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(toDateKey(new Date())));
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [calendarView, setCalendarView] = useState("season");
  const [detailEntry, setDetailEntry] = useState(null);
  const [search, setSearch] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || process.env.NEXT_PUBLIC_ANIME_CALENDAR_DEFAULT_TIME_ZONE || "UTC";
    const stored = window.localStorage.getItem(TIME_ZONE_STORAGE_KEY);
    const nextZone = stored || detected;
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    setTimeZone(nextZone);
    setTimeZoneSelection(stored ? nextZone : AUTO_TIME_ZONE_VALUE);
    setTimeZones(Array.from(new Set([nextZone, ...supported])).filter(Boolean));
    setWeekStart(getWeekStart(getZonedDateKey(new Date(), nextZone)));
    setFilters((current) => ({
      ...current,
      hideAdult: readStoredBoolean(ADULT_STORAGE_KEY, true),
      hideDonghua: readStoredBoolean(DONGHUA_STORAGE_KEY, false),
    }));
  }, []);

  useEffect(() => {
    setResult(initialResult || { seasons: [], activeSeason: null });
    setSelectedSeasonId(String(initialResult?.activeSeason?.id || ""));
  }, [initialResult]);

  async function loadSeason(id) {
    const previousSeasonId = selectedSeasonId;
    setSelectedSeasonId(id);
    setIsFetching(true);
    try {
      const response = await fetch(`/api/anime-calendar?seasonId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo cargar la temporada.");
      setResult(data);
      setWeekStart(getWeekStart(getZonedDateKey(getSeasonWeekAnchor(data.activeSeason, timeZone), timeZone)));
    } catch (error) {
      setSelectedSeasonId(previousSeasonId);
      toast.error(error.message || "No se pudo cargar la temporada.");
    } finally {
      setIsFetching(false);
    }
  }

  function setAnimeFavorite(aniListId, isFavorite) {
    setResult((current) => (
      current.activeSeason ? {
        ...current,
        activeSeason: {
          ...current.activeSeason,
          animes: current.activeSeason.animes.map((item) => (
            item.aniListId === aniListId ? { ...item, isFavorite } : item
          )),
        },
      } : current
    ));
  }

  async function toggleFavorite(anime) {
    if (!isAuthenticated) {
      toast("Inicia sesión para guardar tus animes favoritos.", {
        action: { label: "Iniciar sesión", onClick: () => { window.location.href = "/login"; } },
      });
      return;
    }

    const nextFavorite = !anime.isFavorite;
    setAnimeFavorite(anime.aniListId, nextFavorite);

    try {
      const response = await fetch("/api/anime-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-favorite", aniListId: anime.aniListId, isFavorite: nextFavorite }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "No se pudo guardar el favorito.");
    } catch (error) {
      setAnimeFavorite(anime.aniListId, anime.isFavorite);
      toast.error(error.message || "No se pudo guardar el favorito.");
    }
  }

  function changeTimeZone(value) {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || process.env.NEXT_PUBLIC_ANIME_CALENDAR_DEFAULT_TIME_ZONE || "UTC";
    const next = value === AUTO_TIME_ZONE_VALUE ? detected : value;
    setTimeZone(next);
    setTimeZoneSelection(value);
    if (value === AUTO_TIME_ZONE_VALUE) {
      window.localStorage.removeItem(TIME_ZONE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(TIME_ZONE_STORAGE_KEY, next);
    }
  }

  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const favoriteAnimes = useMemo(
    () => (result.activeSeason?.animes || []).filter((anime) => anime.isFavorite),
    [result.activeSeason],
  );

  const animesInScope = useMemo(
    () => (calendarView === "favorites" ? favoriteAnimes : (result.activeSeason?.animes || [])),
    [calendarView, favoriteAnimes, result.activeSeason],
  );

  const grouped = useMemo(() => {
    const map = Object.fromEntries(days.map((day) => [day.key, []]));
    const query = search.trim().toLocaleLowerCase("es");
    for (const anime of animesInScope) {
      if (!anime.isVisible || !isAnimeAllowedByPreferences(anime, filters)) continue;
      if (query && ![anime.title, anime.titleEnglish, anime.titleNative].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(query)) continue;
      for (const airing of anime.airings || []) {
        if (!airing.isVisible) continue;
        const key = getZonedDateKey(new Date(airing.airingAt), timeZone);
        if (map[key]) map[key].push({ anime, airing });
      }
    }
    Object.values(map).forEach((items) => items.sort((left, right) => new Date(left.airing.airingAt) - new Date(right.airing.airingAt)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animesInScope, days, search, filters, timeZone]);

  // Conteos calculados sobre la semana visible, para que coincidan con "N ocultas por preferencias".
  const weekCategoryTotals = useMemo(() => {
    const dayKeys = new Set(days.map((day) => day.key));
    const totals = { adult: 0, donghua: 0, hidden: 0 };
    for (const anime of animesInScope) {
      if (!anime.isVisible) continue;
      for (const airing of anime.airings || []) {
        if (!airing.isVisible || !dayKeys.has(getZonedDateKey(new Date(airing.airingAt), timeZone))) continue;
        if (anime.isAdult) totals.adult += 1;
        if (anime.isDonghua) totals.donghua += 1;
        if (!isAnimeAllowedByPreferences(anime, filters)) totals.hidden += 1;
      }
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animesInScope, days, filters, timeZone]);

  const weekSummary = useMemo(() => ({
    visible: Object.values(grouped).reduce((total, items) => total + items.length, 0),
    hiddenByPreferences: weekCategoryTotals.hidden,
  }), [grouped, weekCategoryTotals]);

  function moveWeek(amount) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + amount * 7);
      return next;
    });
  }

  function goToRelevantWeek() {
    setWeekStart(getWeekStart(getZonedDateKey(getSeasonWeekAnchor(result.activeSeason, timeZone), timeZone)));
  }

  const todayKey = getZonedDateKey(new Date(), timeZone);
  const rangeLabel = `${new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" }).format(days[0].date)} — ${new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(days[6].date)}`;

  const detailAnime = detailEntry
    ? (result.activeSeason?.animes || []).find((item) => item.aniListId === detailEntry.anime.aniListId) || detailEntry.anime
    : null;

  return (
    <main className="season-calendar-page">
      <header className="watching-header">
        <h1 className="title">Calendario de <span className="text-gradient">temporada</span></h1>
        <p className="subtitle">Emisiones subtituladas organizadas en tu zona horaria. La disponibilidad puede variar según la región.</p>
      </header>

      <section className="season-calendar-toolbar" aria-label="Controles del calendario">
        <div className="tierlist-filter-groups">
          <div className="tierlist-filter-group">
            <span className="tierlist-filter-group-label">Temporada</span>
            <FilterSelect
              label="Temporada"
              value={selectedSeasonId}
              options={(result.seasons || []).length
                ? result.seasons.map((season) => ({ value: String(season.id), label: seasonLabel(season) }))
                : [{ value: "", label: "Sin temporadas" }]}
              onChange={loadSeason}
              disabled={!result.seasons?.length}
            />
          </div>
          <div className="tierlist-filter-group">
            <span className="tierlist-filter-group-label">Zona horaria</span>
            <FilterSelect
              label="Zona horaria"
              value={timeZoneSelection}
              options={[
                { value: AUTO_TIME_ZONE_VALUE, label: `Automática · ${timeZone}` },
                ...timeZones.map((zone) => ({ value: zone, label: zone })),
              ]}
              onChange={changeTimeZone}
              searchable
              searchPlaceholder="Buscar zona IANA…"
            />
          </div>

          <div className="tierlist-filter-group">
            <span className="tierlist-filter-group-label">Ocultar</span>
            <div className="season-calendar-toggles">
              <button
                type="button"
                disabled={filters.focusMode === "adult"}
                className={`season-calendar-toggle ${filters.hideAdult ? "is-active" : ""}`}
                aria-pressed={filters.hideAdult}
                onClick={() => setFilters((current) => {
                  const next = { ...current, hideAdult: !current.hideAdult };
                  window.localStorage.setItem(ADULT_STORAGE_KEY, String(next.hideAdult));
                  return next;
                })}
              >
                Adulto ({weekCategoryTotals.adult})
              </button>
              <button
                type="button"
                disabled={filters.focusMode === "donghua"}
                className={`season-calendar-toggle ${filters.hideDonghua ? "is-active" : ""}`}
                aria-pressed={filters.hideDonghua}
                onClick={() => setFilters((current) => {
                  const next = { ...current, hideDonghua: !current.hideDonghua };
                  window.localStorage.setItem(DONGHUA_STORAGE_KEY, String(next.hideDonghua));
                  return next;
                })}
              >
                Donghua ({weekCategoryTotals.donghua})
              </button>
            </div>
          </div>

          <div className="tierlist-filter-group">
            <span className="tierlist-filter-group-label">Ver</span>
            <FormSelect
              value={filters.focusMode || ""}
              onChange={(value) => setFilters((current) => ({ ...current, focusMode: value }))}
              options={[
                { value: "", label: "Todo" },
                { value: "adult", label: "Solo adulto" },
                { value: "donghua", label: "Solo donghua" },
              ]}
            />
          </div>
        </div>
        <p className="season-calendar-summary" aria-live="polite">
          <strong>{weekSummary.visible}</strong> emisiones visibles
          {weekSummary.hiddenByPreferences ? ` · ${weekSummary.hiddenByPreferences} ocultas por preferencias` : ""}
        </p>
      </section>

      {!isLoading && !isFetching && result.activeSeason ? (
        <div className="season-calendar-view-switch-row">
          <div className="tracker-calendar-view-toggle" role="group" aria-label="Cambiar vista del calendario">
            <button type="button" className={calendarView === "season" ? "is-active" : ""} aria-pressed={calendarView === "season"} onClick={() => setCalendarView("season")}>
              Temporada
            </button>
            <button type="button" className={calendarView === "favorites" ? "is-active" : ""} aria-pressed={calendarView === "favorites"} onClick={() => setCalendarView("favorites")}>
              Favoritos ({favoriteAnimes.length})
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && !isFetching && result.activeSeason ? (
        <div className="season-calendar-week-nav">
          <button type="button" className="tracker-action-secondary" aria-label="Semana anterior" onClick={() => moveWeek(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="tracker-action-secondary" onClick={() => setWeekStart(getWeekStart(todayKey))}>Hoy</button>
          <button type="button" className="tracker-action-secondary" aria-label="Semana siguiente" onClick={() => moveWeek(1)}><ChevronRight size={18} /></button>
          <strong>{rangeLabel}</strong>
          <input
            className="season-calendar-search-input season-calendar-week-nav-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar anime..."
          />
        </div>
      ) : null}

      {isLoading || isFetching ? <div className="empty-state"><Clock3 size={26} /><p>Cargando calendario…</p></div> : null}
      {!isLoading && !isFetching && !result.activeSeason ? (
        <div className="empty-state"><CalendarDays size={30} /><p>Todavía no hay una temporada sincronizada.</p></div>
      ) : null}

      {!isLoading && !isFetching && result.activeSeason && calendarView === "favorites" && favoriteAnimes.length === 0 ? (
        <div className="season-calendar-week-empty">
          <Bookmark size={28} />
          <strong>Todavía no marcaste animes como favoritos.</strong>
          <div>
            <button type="button" className="tracker-action-secondary" onClick={() => setCalendarView("season")}>Ver calendario de la temporada</button>
          </div>
        </div>
      ) : null}

      {!isLoading && !isFetching && result.activeSeason && !(calendarView === "favorites" && favoriteAnimes.length === 0) && weekSummary.visible === 0 ? (
        <div className="season-calendar-week-empty">
          <CalendarDays size={28} />
          <strong>
            {search.trim()
              ? `No encontramos emisiones para “${search.trim()}” esta semana.`
              : weekSummary.hiddenByPreferences
                ? "Las emisiones de esta semana están ocultas por tus preferencias."
                : "No hay emisiones programadas para esta semana."}
          </strong>
          <div>
            {search.trim() ? <button type="button" className="tracker-action-secondary" onClick={() => setSearch("")}>Limpiar búsqueda</button> : null}
            {weekSummary.hiddenByPreferences ? (
              <button type="button" className="tracker-action-secondary" onClick={() => {
                setFilters({ hideAdult: false, hideDonghua: false, focusMode: "" });
                window.localStorage.setItem(ADULT_STORAGE_KEY, "false");
                window.localStorage.setItem(DONGHUA_STORAGE_KEY, "false");
              }}>Mostrar contenido oculto</button>
            ) : null}
            <button type="button" className="tracker-action-secondary" onClick={goToRelevantWeek}>Ir a una semana con emisiones</button>
          </div>
        </div>
      ) : null}

      {!isLoading && !isFetching && result.activeSeason && weekSummary.visible > 0 ? (
        <section className="season-calendar-week">
            {days.map((day) => (
            <article className={`season-calendar-day ${day.key === todayKey ? "is-today" : ""}`} key={day.key}>
              <header>
                <div>
                  <span>{day.name}</span>
                  {day.key === todayKey ? <small>Hoy</small> : null}
                </div>
                <strong>{new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", timeZone: "UTC" }).format(day.date)}</strong>
              </header>
              <div className="season-calendar-day-list">
                {(grouped[day.key] || []).map(({ anime, airing }) => (
                  <article className="season-airing-card" key={`${anime.id}-${airing.id}`}>
                    <button
                      type="button"
                      className="season-airing-poster-button"
                      aria-label={`Ver detalles de ${anime.title}`}
                      onClick={() => setDetailEntry({ anime, airing })}
                    >
                      {anime.imageUrl ? <img src={anime.imageUrl} alt="" loading="lazy" /> : <div className="season-airing-placeholder"><CalendarDays size={20} /></div>}
                      <span className="season-airing-poster-hint" aria-hidden="true">
                        <Info size={14} strokeWidth={2.5} />
                      </span>
                    </button>
                    <Tooltip label={anime.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}>
                      <button
                        type="button"
                        className={`season-airing-favorite ${anime.isFavorite ? "is-active" : ""}`}
                        aria-pressed={anime.isFavorite}
                        aria-label={anime.isFavorite ? `Quitar ${anime.title} de favoritos` : `Agregar ${anime.title} a favoritos`}
                        onClick={() => toggleFavorite(anime)}
                      >
                        <Bookmark size={18} />
                      </button>
                    </Tooltip>
                    <div className="season-airing-card-body">
                      <time>{new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(airing.airingAt))}</time>
                      <strong>{anime.title}</strong>
                      <span>Episodio {airing.episode}{anime.format ? ` · ${anime.format}` : ""}</span>
                      <span className={`season-airing-status is-${airingStatusLabel(airing).toLowerCase().replaceAll(" ", "-")}`}>
                        <span className="season-airing-status-dot" aria-hidden="true" />
                        {airingStatusLabel(airing)}
                      </span>
                      {airing.platforms?.length ? (
                        <div className="season-airing-platforms">
                          {airing.platforms.map((platform, index) => (
                            <PlatformChip key={`${platform.name || platform.url || index}`} name={platform.name} url={platform.url} />
                          ))}
                        </div>
                      ) : null}
                      {anime.aniListUrl ? (
                        <div className="season-airing-links">
                          <AniListChip url={anime.aniListUrl} />
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
                {!grouped[day.key]?.length ? <p className="season-calendar-empty-day">Sin emisiones visibles.</p> : null}
              </div>
            </article>
            ))}
        </section>
      ) : null}

      {detailAnime ? (
        <SeasonalAnimeDetailModal
          anime={detailAnime}
          airing={detailEntry.airing}
          onToggleFavorite={() => toggleFavorite(detailAnime)}
          onClose={() => setDetailEntry(null)}
        />
      ) : null}
    </main>
  );
}
