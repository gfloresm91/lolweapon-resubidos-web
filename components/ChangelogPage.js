"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, History, Search, Sparkles } from "lucide-react";

import { FilterSelect } from "@/components/FiltersBar";
import { changelogEntries, changelogModules, changelogTypes } from "@/lib/changelogContent";

function getReleaseSeries(version = "") {
  const major = version.match(/^v(\d+)\./)?.[1];
  return major ? `Serie ${major}.x` : "Otras versiones";
}

function ChangelogReleaseCard({ release }) {
  const isMajor = /^v\d+\.\d+\.0$/.test(release.version);

  return (
    <article className={`news-changelog-card ${release.changes.length <= 2 ? "is-compact" : ""} ${isMajor ? "is-major" : ""}`}>
      <div className="news-changelog-version">
        <strong>{release.version}</strong>
        {release.date ? <span>{release.date}</span> : null}
      </div>
      <div>
        <div className="changelog-card-meta">
          <span>{release.type}</span>
          {release.modules.map((module) => (
            <span key={module}>{module}</span>
          ))}
        </div>
        <h3>{release.title}</h3>
        <ul>
          {release.changes.map((change) => (
            <li key={change}>
              <Check size={14} aria-hidden="true" />
              <span>{change}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function groupReleases(releases) {
  return releases.reduce((groups, release) => {
    const key = getReleaseSeries(release.version);
    const existing = groups.find((group) => group.key === key);

    if (existing) {
      existing.releases.push(release);
      return groups;
    }

    groups.push({ key, releases: [release] });
    return groups;
  }, []);
}

export default function ChangelogPage() {
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  const filteredReleases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return changelogEntries.filter((release) => {
      const matchesSearch = !query || [
        release.version,
        release.date,
        release.title,
        release.type,
        ...release.modules,
        ...release.changes,
      ].join(" ").toLowerCase().includes(query);
      const matchesModule = selectedModule === "all" || release.modules.includes(selectedModule);
      const matchesType = selectedType === "all" || release.type === selectedType;

      return matchesSearch && matchesModule && matchesType;
    });
  }, [search, selectedModule, selectedType]);

  const groupedReleases = useMemo(() => groupReleases(filteredReleases), [filteredReleases]);
  const latestRelease = changelogEntries[0];
  const totalChanges = changelogEntries.reduce((total, release) => total + release.changes.length, 0);
  const moduleOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...changelogModules.map((module) => ({ value: module, label: module })),
    ],
    [],
  );
  const typeOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...changelogTypes.map((type) => ({ value: type, label: type })),
    ],
    [],
  );

  return (
    <main className="news-guide-page changelog-page">
      <section className="news-guide-hero changelog-hero">
        <div className="header-badge news-guide-badge">
          <History size={14} aria-hidden="true" />
          Historial de cambios
        </div>
        <h1>
          Historial de <span className="text-gradient">cambios</span>
        </h1>
        <p>
          Revisa la evolución completa de LOLWEAPON: nuevas funciones, mejoras visuales,
          correcciones y cambios de operación.
        </p>
        <div className="news-guide-actions">
          <Link href="/novedades" className="news-guide-action news-guide-action-primary">
            <Sparkles size={16} aria-hidden="true" />
            <span>Ver novedades y guía</span>
          </Link>
          <Link href="/inicio" className="news-guide-action news-guide-action-secondary">
            <ArrowRight size={16} aria-hidden="true" />
            <span>Volver al inicio</span>
          </Link>
        </div>
        <div className="news-guide-session-note">
          <span>{latestRelease ? `Última versión ${latestRelease.version}` : "Historial activo"}</span>
          <span>{changelogEntries.length} versiones · {totalChanges} cambios registrados</span>
        </div>
      </section>

      <section className="news-guide-section">
        <div className="news-section-heading">
          <span>Filtros</span>
          <h2>Encuentra un cambio</h2>
          <p>Filtra por texto, módulo o tipo de cambio cuando quieras revisar una entrega específica.</p>
        </div>
        <div className="changelog-toolbar">
          <label className="changelog-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              placeholder="Buscar por versión, módulo o descripción"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <FilterSelect
            id="changelog-module-filter"
            label="Módulo"
            value={selectedModule}
            options={moduleOptions}
            onChange={setSelectedModule}
          />
          <FilterSelect
            id="changelog-type-filter"
            label="Tipo"
            value={selectedType}
            options={typeOptions}
            onChange={setSelectedType}
          />
        </div>
      </section>

      <section className="news-guide-section">
        <div className="news-section-heading">
          <span>Versiones</span>
          <h2>Historia completa</h2>
          <p>
            {filteredReleases.length === changelogEntries.length
              ? "Mostrando toda la historia registrada."
              : `Mostrando ${filteredReleases.length} de ${changelogEntries.length} versiones.`}
          </p>
        </div>

        {groupedReleases.length ? (
          <div className="news-changelog-groups">
            {groupedReleases.map((group) => (
              <section key={group.key} className="news-changelog-group" aria-label={group.key}>
                <h3>
                  <span>{group.key}</span>
                  <small>{group.releases.length} versiones</small>
                </h3>
                <div className="news-changelog-list">
                  {group.releases.map((release) => (
                    <ChangelogReleaseCard key={release.version} release={release} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="changelog-empty">
            <History size={18} aria-hidden="true" />
            <strong>No hay cambios para esos filtros.</strong>
            <p>Prueba con otro módulo, tipo o texto de búsqueda.</p>
          </div>
        )}
      </section>
    </main>
  );
}
