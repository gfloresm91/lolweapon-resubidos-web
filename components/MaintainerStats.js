"use client";

export default function MaintainerStats({ items = [] }) {
  return (
    <section className="watching-stats maintainer-stats" aria-label="Indicadores">
      {items.map((item) => (
        <div className="watching-stat" key={item.label}>
          <span className={`watching-stat-value ${item.color || ""}`}>{item.value}</span>
          <span className="watching-stat-label">{item.label}</span>
          {item.detail ? <span className="watching-stat-detail">{item.detail}</span> : null}
        </div>
      ))}
    </section>
  );
}
