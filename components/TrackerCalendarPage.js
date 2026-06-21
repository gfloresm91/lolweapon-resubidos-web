"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { FilterSelect } from "@/components/FiltersBar";
import { LIVE_STATUS_LEGEND_ITEMS, getLiveStatusMeta } from "@/lib/liveStatusStyles";

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];
const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const VIEW_OPTIONS = [
  { value: "month", label: "Mensual" },
  { value: "year", label: "Anual" },
];

function getTodayParts() {
  const today = new Date();

  return {
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1).padStart(2, "0"),
    monthKey: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  };
}

function parseLiveDate(value) {
  const [day, month, year] = String(value || "").split("/");
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (
    !Number.isInteger(dayNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 1901 ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() !== monthNumber - 1 ||
    date.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return {
    day: String(dayNumber).padStart(2, "0"),
    month: String(monthNumber).padStart(2, "0"),
    year: String(yearNumber),
    key: `${yearNumber}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`,
  };
}

function getLiveLinksCount(live) {
  return Object.values(live?.links || {}).reduce((total, links) => total + (Array.isArray(links) ? links.length : 0), 0);
}

function getYearOptions(livesByDate) {
  return Array.from(new Set(Object.values(livesByDate).map((item) => item.date.year)))
    .sort((left, right) => Number(right) - Number(left))
    .map((year) => ({ value: year, label: year }));
}

function getBoundedYearOptions(options, selectedYear, bounds) {
  return Array.from(new Set([
    ...options
      .map((option) => option.value)
      .filter((year) => Number(year) >= bounds.minYear && Number(year) <= bounds.maxYear),
    selectedYear,
  ].filter(Boolean)))
    .filter((year) => Number(year) >= bounds.minYear && Number(year) <= bounds.maxYear)
    .sort((left, right) => Number(right) - Number(left))
    .map((year) => {
      const option = options.find((item) => item.value === year);
      return option || { value: year, label: `${year} · sin directos` };
    });
}

function getCalendarBounds(livesByDate, todayParts) {
  const dateItems = Object.values(livesByDate);
  const monthKeys = dateItems.map((item) => `${item.date.year}-${item.date.month}`).sort();
  const minYear = dateItems.reduce((min, item) => Math.min(min, Number(item.date.year)), Infinity);

  return {
    minYear: Number.isFinite(minYear) ? minYear : Number(todayParts.year),
    minMonthKey: monthKeys[0] || todayParts.monthKey,
    maxYear: Number(todayParts.year),
    maxMonthKey: todayParts.monthKey,
  };
}

function compareMonthKey(leftYear, leftMonth, rightMonthKey) {
  return `${leftYear}-${leftMonth}`.localeCompare(rightMonthKey);
}

function isMonthInBounds(year, month, bounds) {
  const monthKey = `${year}-${month}`;
  return monthKey.localeCompare(bounds.minMonthKey) >= 0 && monthKey.localeCompare(bounds.maxMonthKey) <= 0;
}

function splitMonthKey(monthKey) {
  const [year, month] = String(monthKey || "").split("-");
  return { year, month };
}

function getInitialYear(yearOptions) {
  const currentYear = String(new Date().getFullYear());
  return yearOptions.some((option) => option.value === currentYear)
    ? currentYear
    : yearOptions[0]?.value || currentYear;
}

function getInitialMonth(livesByDate, year) {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const yearMonths = Array.from(
    new Set(
      Object.values(livesByDate)
        .filter((item) => item.date.year === year)
        .map((item) => item.date.month),
    ),
  ).sort((left, right) => Number(right) - Number(left));

  return yearMonths.includes(currentMonth) ? currentMonth : yearMonths[0] || currentMonth;
}

function buildMonthDays(year, month) {
  const yearNumber = Number(year);
  const monthIndex = Number(month) - 1;
  const firstDay = new Date(Date.UTC(yearNumber, monthIndex, 1));
  const firstWeekOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(yearNumber, monthIndex + 1, 0)).getUTCDate();
  const cells = [];

  for (let i = 0; i < firstWeekOffset; i += 1) {
    cells.push({ key: `empty-start-${month}-${i}`, empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayValue = String(day).padStart(2, "0");
    cells.push({
      key: `${year}-${month}-${dayValue}`,
      day,
      dateKey: `${year}-${month}-${dayValue}`,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${month}-${cells.length}`, empty: true });
  }

  return cells;
}

function formatSelectedDate(dateKey) {
  const [, month, day] = String(dateKey || "").split("-");
  const monthLabel = MONTHS.find((item) => item.value === month)?.label || "";
  return `${Number(day)} de ${monthLabel.toLowerCase()}`;
}

function formatCalendarTitle(view, year, month) {
  if (view === "year") {
    return year;
  }

  const monthLabel = MONTHS.find((item) => item.value === month)?.label || month;
  return `${monthLabel} ${year}`;
}

function getCalendarDayStatusMeta(lives = []) {
  if (!lives.length) {
    return null;
  }

  const tones = lives.map((live) => getLiveStatusMeta(live.status));
  const uniqueTones = new Set(tones.map((meta) => meta.tone));

  if (uniqueTones.size > 1) {
    return {
      calendarClassName: "is-mixed",
      label: "Estados mixtos",
    };
  }

  return tones[0];
}

function CalendarMonth({ year, month, livesByDate, selectedDate, onSelectDate, onOpenMonth, compact = false }) {
  const monthLabel = MONTHS.find((item) => item.value === month)?.label || month;
  const cells = useMemo(() => buildMonthDays(year, month), [month, year]);

  return (
    <article className={`tracker-calendar-month ${compact ? "is-compact" : ""}`}>
      <div className="tracker-calendar-month-heading">
        <button type="button" onClick={() => onOpenMonth?.(month)}>
          <span>{monthLabel}</span>
          {compact ? <ChevronRight size={14} aria-hidden="true" /> : null}
        </button>
      </div>
      <div className="tracker-calendar-weekdays" aria-hidden="true">
        {WEEK_DAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="tracker-calendar-grid">
        {cells.map((cell) => {
          if (cell.empty) {
            return <span key={cell.key} className="tracker-calendar-day is-empty" />;
          }

          const dayLives = livesByDate[cell.dateKey]?.lives || [];
          const liveCount = dayLives.length;
          const intensity = liveCount >= 3 ? "high" : liveCount === 2 ? "medium" : liveCount === 1 ? "low" : "none";
          const statusMeta = getCalendarDayStatusMeta(dayLives);

          return (
            <button
              key={cell.key}
              type="button"
              className={`tracker-calendar-day has-${intensity} ${statusMeta?.calendarClassName || ""} ${selectedDate === cell.dateKey ? "is-selected" : ""}`}
              aria-label={`${cell.day} ${monthLabel}, ${liveCount} directos${statusMeta ? `, ${statusMeta.label}` : ""}`}
              aria-pressed={selectedDate === cell.dateKey}
              disabled={!liveCount}
              onClick={() => onSelectDate(cell.dateKey)}
            >
              <span>{cell.day}</span>
              {liveCount > 1 ? <strong>{liveCount}</strong> : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function DayLiveList({ dateKey, lives = [], onOpenDetail, panelRef }) {
  if (!dateKey || !lives.length) {
    return (
      <section ref={panelRef} className="tracker-calendar-day-panel is-empty" aria-label="Directos del día">
        <span className="tracker-actions-label">Directos del día</span>
        <p className="tracker-actions-copy">Sin día seleccionado.</p>
      </section>
    );
  }

  return (
    <section ref={panelRef} className="tracker-calendar-day-panel" aria-label="Directos del día">
      <div className="tracker-calendar-day-panel-heading">
        <div>
          <span className="tracker-actions-label">{formatSelectedDate(dateKey)}</span>
          <p className="tracker-actions-copy">{lives.length === 1 ? "1 directo archivado" : `${lives.length} directos archivados`}</p>
        </div>
      </div>
      <div className="tracker-calendar-live-list">
        {lives.map((live) => {
          const statusMeta = getLiveStatusMeta(live.status);

          return (
            <Link
              key={live.id}
              href={`/rastreador/${encodeURIComponent(live.id)}`}
              className="tracker-calendar-live-row"
              onClick={() => onOpenDetail?.(live.id)}
            >
              <span className="tracker-calendar-live-main">
                <strong>{live.title}</strong>
                <small>{live.tags?.slice(0, 3).join(" · ") || "Sin tags"}</small>
              </span>
              <span className="tracker-calendar-live-meta">
                <em className={`tracker-calendar-live-status ${statusMeta.calendarClassName}`}>{live.status || statusMeta.label}</em>
                <small>{getLiveLinksCount(live) ? "Con enlaces" : "Sin enlaces"}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function TrackerCalendarPage({ lives = [], onOpenDetail }) {
  const livesByDate = useMemo(() => {
    return lives.reduce((groups, live) => {
      const date = parseLiveDate(live.date);
      if (!date) {
        return groups;
      }

      if (!groups[date.key]) {
        groups[date.key] = { date, lives: [] };
      }

      groups[date.key].lives.push(live);
      return groups;
    }, {});
  }, [lives]);

  const dataYearOptions = useMemo(() => getYearOptions(livesByDate), [livesByDate]);
  const todayParts = useMemo(() => getTodayParts(), []);
  const calendarBounds = useMemo(() => getCalendarBounds(livesByDate, todayParts), [livesByDate, todayParts]);
  const initialYearOptions = useMemo(() => getBoundedYearOptions(dataYearOptions, todayParts.year, calendarBounds), [calendarBounds, dataYearOptions, todayParts.year]);
  const [selectedYear, setSelectedYear] = useState(() => getInitialYear(initialYearOptions));
  const [selectedMonth, setSelectedMonth] = useState(() => getInitialMonth(livesByDate, getInitialYear(initialYearOptions)));
  const [calendarView, setCalendarView] = useState("month");
  const [selectedDate, setSelectedDate] = useState("");
  const dayPanelRef = useRef(null);
  const shouldScrollToDayPanelRef = useRef(false);
  const yearOptions = useMemo(() => getBoundedYearOptions(dataYearOptions, selectedYear, calendarBounds), [calendarBounds, dataYearOptions, selectedYear]);
  const calendarTitle = formatCalendarTitle(calendarView, selectedYear, selectedMonth);
  const isAtFirstYear = Number(selectedYear) <= calendarBounds.minYear;
  const isAtCurrentYear = Number(selectedYear) >= calendarBounds.maxYear;
  const isAtFirstMonth = compareMonthKey(selectedYear, selectedMonth, calendarBounds.minMonthKey) <= 0;
  const isAtCurrentMonth = compareMonthKey(selectedYear, selectedMonth, calendarBounds.maxMonthKey) >= 0;
  const canGoPrevious = calendarView === "year" ? !isAtFirstYear : !isAtFirstMonth;
  const canGoNext = calendarView === "year" ? !isAtCurrentYear : !isAtCurrentMonth;
  const canGoToday = compareMonthKey(todayParts.year, todayParts.month, calendarBounds.minMonthKey) >= 0;

  useEffect(() => {
    if (!dataYearOptions.length) {
      return;
    }

    setSelectedYear((current) => {
      const currentNumber = Number(current);
      if (!current || currentNumber < calendarBounds.minYear) {
        return String(calendarBounds.minYear);
      }
      if (currentNumber > calendarBounds.maxYear) {
        return String(calendarBounds.maxYear);
      }
      return current;
    });
  }, [calendarBounds.maxYear, calendarBounds.minYear, dataYearOptions]);

  useEffect(() => {
    const monthComparisonToStart = compareMonthKey(selectedYear, selectedMonth, calendarBounds.minMonthKey);
    const monthComparisonToToday = compareMonthKey(selectedYear, selectedMonth, calendarBounds.maxMonthKey);

    if (monthComparisonToStart < 0) {
      const { year, month } = splitMonthKey(calendarBounds.minMonthKey);
      setSelectedYear(year);
      setSelectedMonth(month);
      return;
    }

    if (monthComparisonToToday > 0) {
      const { year, month } = splitMonthKey(calendarBounds.maxMonthKey);
      setSelectedYear(year);
      setSelectedMonth(month);
    }
  }, [calendarBounds.maxMonthKey, calendarBounds.minMonthKey, selectedMonth, selectedYear]);

  useEffect(() => {
    setSelectedDate("");
  }, [selectedMonth, selectedYear, calendarView]);

  const monthOptions = useMemo(() => MONTHS
    .filter((month) => isMonthInBounds(selectedYear, month.value, calendarBounds))
    .map((month) => ({
      ...month,
      label: `${month.label}${
        Object.values(livesByDate).some((item) => item.date.year === selectedYear && item.date.month === month.value)
          ? ""
          : " · sin directos"
      }`,
    })), [calendarBounds, livesByDate, selectedYear]);

  const selectedDayLives = selectedDate ? livesByDate[selectedDate]?.lives || [] : [];

  useEffect(() => {
    if (!selectedDate || !selectedDayLives.length || !shouldScrollToDayPanelRef.current) {
      return;
    }

    shouldScrollToDayPanelRef.current = false;

    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1180px)").matches) {
      return;
    }

    window.requestAnimationFrame(() => {
      dayPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [selectedDate, selectedDayLives.length]);

  const yearDateItems = useMemo(() => Object.values(livesByDate).filter((item) => item.date.year === selectedYear), [livesByDate, selectedYear]);
  const monthDateItems = useMemo(() => yearDateItems.filter((item) => item.date.month === selectedMonth), [selectedMonth, yearDateItems]);
  const yearLiveCount = yearDateItems.reduce((total, item) => total + item.lives.length, 0);
  const monthLiveCount = monthDateItems.reduce((total, item) => total + item.lives.length, 0);
  const busiestMonth = useMemo(() => {
    const counts = MONTHS.map((month) => ({
      ...month,
      count: yearDateItems
        .filter((item) => item.date.month === month.value)
        .reduce((total, item) => total + item.lives.length, 0),
    }));

    return counts.sort((left, right) => right.count - left.count)[0];
  }, [yearDateItems]);

  function openMonth(month) {
    setSelectedMonth(month);
    setCalendarView("month");
    setSelectedDate("");
  }

  function selectDate(dateKey) {
    shouldScrollToDayPanelRef.current = true;
    setSelectedDate(dateKey);
  }

  function changeView(view) {
    setCalendarView(view);
    setSelectedDate("");
  }

  function goToToday() {
    if (!canGoToday) {
      return;
    }

    setSelectedYear(todayParts.year);
    setSelectedMonth(todayParts.month);
    setSelectedDate("");
  }

  function goToPreviousPeriod() {
    if (!canGoPrevious) {
      return;
    }

    setSelectedDate("");

    if (calendarView === "year") {
      setSelectedYear((year) => String(Number(year) - 1));
      return;
    }

    const monthNumber = Number(selectedMonth);
    if (monthNumber <= 1) {
      setSelectedYear((year) => String(Number(year) - 1));
      setSelectedMonth("12");
      return;
    }

    setSelectedMonth(String(monthNumber - 1).padStart(2, "0"));
  }

  function goToNextPeriod() {
    if (!canGoNext) {
      return;
    }

    setSelectedDate("");

    if (calendarView === "year") {
      setSelectedYear((year) => String(Number(year) + 1));
      return;
    }

    const monthNumber = Number(selectedMonth);
    if (monthNumber >= 12) {
      setSelectedYear((year) => String(Number(year) + 1));
      setSelectedMonth("01");
      return;
    }

    setSelectedMonth(String(monthNumber + 1).padStart(2, "0"));
  }

  if (!dataYearOptions.length) {
    return (
      <div className="empty-state tracker-calendar-empty">
        <div className="empty-state-icon">CAL</div>
        <div className="empty-state-text">No hay directos con fecha válida.</div>
      </div>
    );
  }

  return (
    <section className="tracker-calendar-page" aria-label="Calendario de directos">
      <header className="main-header tracker-calendar-header">
        <div className="header-badge">
          <CalendarDays size={16} aria-hidden="true" /> ARCHIVO HISTORICO
        </div>
        <h1 className="title">
          Calendario de <span className="text-gradient">directos</span>
        </h1>
        <p className="subtitle">Explora el archivo por día, mes y año de transmisión.</p>
      </header>

      <section className="tracker-calendar-stats" aria-label="Resumen del calendario">
        <div>
          <span>{calendarView === "year" ? "Directos del año" : "Directos del mes"}</span>
          <strong>{calendarView === "year" ? yearLiveCount : monthLiveCount}</strong>
        </div>
        <div>
          <span>Días con directo</span>
          <strong>{calendarView === "year" ? yearDateItems.length : monthDateItems.length}</strong>
        </div>
        <div>
          <span>Mes destacado</span>
          <strong>{busiestMonth?.count ? busiestMonth.label : "Sin datos"}</strong>
        </div>
      </section>

      <section className="tracker-calendar-toolbar" aria-label="Filtros de calendario">
        <FilterSelect
          id="tracker-calendar-year"
          label="Año"
          value={selectedYear}
          options={yearOptions}
          onChange={(year) => {
            setSelectedYear(year);
            setSelectedDate("");
          }}
        />
        <FilterSelect
          id="tracker-calendar-month"
          label="Mes"
          value={selectedMonth}
          options={monthOptions}
          onChange={(month) => {
            setSelectedMonth(month);
            setSelectedDate("");
          }}
          disabled={calendarView === "year"}
          disabledHint="Disponible en vista mensual"
        />
      </section>

      <section className="tracker-calendar-navigation" aria-label="Navegación del calendario">
        <div className="tracker-calendar-period">
          <button
            type="button"
            className="tracker-calendar-nav-button"
            onClick={goToPreviousPeriod}
            aria-label={calendarView === "year" ? "Año anterior" : "Mes anterior"}
            disabled={!canGoPrevious}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <strong>{calendarTitle}</strong>
          <button
            type="button"
            className="tracker-calendar-nav-button"
            onClick={goToNextPeriod}
            aria-label={calendarView === "year" ? "Año siguiente" : "Mes siguiente"}
            disabled={!canGoNext}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="tracker-calendar-navigation-actions">
          <button type="button" className="tracker-calendar-today-button" onClick={goToToday} disabled={!canGoToday}>
            Hoy
          </button>
          <div className="tracker-calendar-view-toggle" role="group" aria-label="Cambiar vista del calendario">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={calendarView === option.value ? "is-active" : ""}
                aria-pressed={calendarView === option.value}
                onClick={() => changeView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="tracker-calendar-legend" aria-label="Leyenda de estados del calendario">
        <span className="tracker-calendar-legend-title">Leyenda</span>
        <div className="tracker-calendar-legend-list">
          {LIVE_STATUS_LEGEND_ITEMS.map((item) => (
            <span key={item.calendarClassName} className={`tracker-calendar-legend-chip ${item.calendarClassName}`}>
              <i aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <div className={`tracker-calendar-layout ${calendarView === "year" ? "is-year-view" : "is-month-view"}`}>
        <div className="tracker-calendar-main">
          {calendarView === "year" ? (
            <div className="tracker-calendar-year-grid">
              {MONTHS.map((month) => (
                <CalendarMonth
                  key={month.value}
                  year={selectedYear}
                  month={month.value}
                  livesByDate={livesByDate}
                  selectedDate={selectedDate}
                  onSelectDate={selectDate}
                  onOpenMonth={openMonth}
                  compact
                />
              ))}
            </div>
          ) : (
            <CalendarMonth
              year={selectedYear}
              month={selectedMonth}
              livesByDate={livesByDate}
              selectedDate={selectedDate}
              onSelectDate={selectDate}
            />
          )}
        </div>

        <DayLiveList panelRef={dayPanelRef} dateKey={selectedDate} lives={selectedDayLives} onOpenDetail={onOpenDetail} />
      </div>
    </section>
  );
}
