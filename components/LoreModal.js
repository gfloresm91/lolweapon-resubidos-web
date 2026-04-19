export default function LoreModal({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div id="lore-modal" className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content admin-modal"
        style={{
          maxWidth: 540,
          textAlign: "center",
          borderColor: "rgba(244,114,182,0.3)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          className="modal-title"
          style={{
            marginBottom: "1.5rem",
            fontSize: "1.8rem",
            background: "var(--grad-card-glow)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "var(--pink)",
          }}
        >
          📜 El Origen de los VODs
        </h2>
        <div className="lore-copy">
          <p>
            Los resubidos actuales nacieron por el miedo a que el drive del buen Piero desapareciera
            algun dia y con ello todos los resubidos, que al final termino pasando. Pieroooooo, tengo
            la esperanza que algun dia vuelva la web de piero.
          </p>
          <p>
            Todo el material publicado es de libre uso, hagan lo que quieran, a menos que Kala diga
            lo contrario.
          </p>
          <p className="lore-note">
            Link caido pero se deja en honor al gran Piero:
            <br />
            <a href="https://drive.pieront.com/" target="_blank" rel="noreferrer">
              https://drive.pieront.com/
            </a>
          </p>
        </div>
        <button type="button" id="btn-close-lore" className="btn-modal btn-modal-primary lore-close" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );
}

