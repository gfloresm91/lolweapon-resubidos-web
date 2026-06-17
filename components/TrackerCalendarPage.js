"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

import { FilterSelect } from "@/components/FiltersBar";

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

          return (
            <button
              key={cell.key}
              type="button"
              className={`tracker-calendar-day has-${intensity} ${selectedDate === cell.dateKey ? "is-selected" : ""}`}
              aria-label={`${cell.day} ${monthLabel}, ${liveCount} directos`}
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

function DayLiveList({ dateKey, lives = [], onOpenDetail }) {
  if (!dateKey || !lives.length) {
    return (
      <section className="tracker-calendar-day-panel is-empty" aria-label="Directos del día">
        <span className="tracker-actions-label">Directos del día</span>
        <p className="tracker-actions-copy">Sin día seleccionado.</p>
      </section>
    );
  }

  return (
    <section className="tracker-calendar-day-panel" aria-label="Directos del día">
      <div className="tracker-calendar-day-panel-heading">
        <div>
          <span className="tracker-actions-label">{formatSelectedDate(dateKey)}</span>
          <p className="tracker-actions-copy">{lives.length === 1 ? "1 directo archivado" : `${lives.length} directos archivados`}</p>
        </div>
      </div>
      <div className="tracker-calendar-live-list">
        {lives.map((live) => (
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
              <em>{live.status}</em>
              <small>{getLiveLinksCount(live) ? "Con enlaces" : "Sin enlaces"}</small>
            </span>
          </Link>
        ))}
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

  const yearOptions = useMemo(() => getYearOptions(livesByDate), [livesByDate]);
  const [selectedYear, setSelectedYear] = useState(() => getInitialYear(yearOptions));
  const [selectedMonth, setSelectedMonth] = useState(() => getInitialMonth(livesByDate, getInitialYear(yearOptions)));
  const [calendarView, setCalendarView] = useState("month");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (!yearOptions.length) {
      return;
    }

    setSelectedYear((current) => (
      yearOptions.some((option) => option.value === current) ? current : getInitialYear(yearOptions)
    ));
  }, [yearOptions]);

  useEffect(() => {
    setSelectedMonth((current) => {
      const availableMonths = new Set(
        Object.values(livesByDate)
          .filter((item) => item.date.year === selectedYear)
          .map((item) => item.date.month),
      );

      if (availableMonths.has(current)) {
        return current;
      }

      return getInitialMonth(livesByDate, selectedYear);
    });
    setSelectedDate("");
  }, [livesByDate, selectedYear]);

  const monthOptions = useMemo(() => MONTHS.map((month) => ({
    ...month,
    label: `${month.label}${
      Object.values(livesByDate).some((item) => item.date.year === selectedYear && item.date.month === month.value)
        ? ""
        : " · sin directos"
    }`,
  })), [livesByDate, selectedYear]);

  const selectedDayLives = selectedDate ? livesByDate[selectedDate]?.lives || [] : [];
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

  if (!yearOptions.length) {
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

      <section className="tracker-calendar-toolbar" aria-label="Filtros de calendario">
        <FilterSelect
          id="tracker-calendar-view"
          label="Vista"
          value={calendarView}
          options={VIEW_OPTIONS}
          onChange={setCalendarView}
        />
        <FilterSelect
          id="tracker-calendar-year"
          label="Año"
          value={selectedYear}
          options={yearOptions}
          onChange={setSelectedYear}
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
                  onSelectDate={setSelectedDate}
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
              onSelectDate={setSelectedDate}
            />
          )}
        </div>

        <DayLiveList dateKey={selectedDate} lives={selectedDayLives} onOpenDetail={onOpenDetail} />
      </div>
    </section>
  );
}
