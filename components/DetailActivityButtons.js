"use client";

import { useState } from "react";
import { Bookmark, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import Tooltip from "@/components/Tooltip";

export default function DetailActivityButtons({ liveId, liveTitle = "", initialActivity = null, isAuthenticated = false }) {
  const [activity, setActivity] = useState(initialActivity || { isSaved: false, isWatched: false });
  const [pendingKey, setPendingKey] = useState(null);
  const isSaved = Boolean(activity?.isSaved);
  const isWatched = Boolean(activity?.isWatched);

  async function toggle(key, patch) {
    if (!isAuthenticated) {
      const loginHref = `/login?next=/rastreador/${encodeURIComponent(liveId)}`;
      toast("Inicia sesión para guardar resubidos.", {
        action: { label: "Iniciar sesión", onClick: () => { window.location.href = loginHref; } },
      });
      return;
    }

    const previous = activity;
    setActivity((current) => ({ ...current, ...patch }));
    setPendingKey(key);

    try {
      const response = await fetch("/api/live-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId, ...patch }),
      });
      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        setActivity(previous);
        window.location.href = `/login?next=/rastreador/${encodeURIComponent(liveId)}`;
        return;
      }

      if (!response.ok || !data?.success) {
        setActivity(previous);
        toast.error(data?.error || "No se pudo guardar.");
        return;
      }

      setActivity(data.activity);
    } catch {
      setActivity(previous);
      toast.error("No se pudo guardar.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="detail-activity-buttons">
      <Tooltip label={isSaved ? "Quitar de guardados" : "Guardar para después"}>
        <button
          type="button"
          className={`platform-btn platform-personal ${isSaved ? "is-active" : ""} ${pendingKey === "saved" ? "is-loading" : ""}`}
          aria-label={isSaved ? `Quitar ${liveTitle} de guardados` : `Guardar ${liveTitle} para después`}
          aria-busy={pendingKey === "saved"}
          disabled={pendingKey !== null}
          onClick={() => toggle("saved", { isSaved: !isSaved })}
        >
          {pendingKey === "saved"
            ? <Loader2 size={15} className="spin" />
            : <Bookmark size={15} />}
          <span className="platform-personal-label">{isSaved ? "Guardado" : "Guardar"}</span>
        </button>
      </Tooltip>
      <Tooltip label={isWatched ? "Marcar como no visto" : "Marcar como visto"}>
        <button
          type="button"
          className={`platform-btn platform-personal ${isWatched ? "is-active" : ""} ${pendingKey === "watched" ? "is-loading" : ""}`}
          aria-label={isWatched ? `Marcar ${liveTitle} como no visto` : `Marcar ${liveTitle} como visto`}
          aria-busy={pendingKey === "watched"}
          disabled={pendingKey !== null}
          onClick={() => toggle("watched", { isWatched: !isWatched })}
        >
          {pendingKey === "watched"
            ? <Loader2 size={15} className="spin" />
            : <CheckCircle2 size={15} />}
          <span className="platform-personal-label">Visto</span>
        </button>
      </Tooltip>
    </div>
  );
}
