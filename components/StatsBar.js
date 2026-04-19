export default function StatsBar({ stats }) {
  return (
    <section id="stats-bar" className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">Total VODs</span>
        <span className="stat-value" id="stat-total">
          {stats.total}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Años Archivados</span>
        <span className="stat-value" id="stat-years">
          {stats.years}
        </span>
      </div>
      <div className="stat-item highlight">
        <span className="stat-label">Lost Media</span>
        <span className="stat-value text-red" id="stat-lost">
          {stats.lost}
        </span>
      </div>
    </section>
  );
}

