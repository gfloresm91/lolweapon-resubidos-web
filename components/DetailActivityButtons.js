"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, Edit3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import ConfirmModal from "@/components/ConfirmModal";
import TrackerMaintainerModal from "@/components/TrackerMaintainerModal";
import Tooltip from "@/components/Tooltip";

export default function DetailActivityButtons({
  live,
  liveId,
  liveTitle = "",
  initialActivity = null,
  isAuthenticated = false,
  canEdit = false,
  canDelete = false,
  formVariant = null,
  statuses = [],
}) {
  const router = useRouter();
  const [activity, setActivity] = useState(initialActivity || { isSaved: false, isWatched: false });
  const [pendingKey, setPendingKey] = useState(null);
  const [editingLive, setEditingLive] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagCounts, setTagCounts] = useState({});
  const isSaved = Boolean(activity?.isSaved);
  const isWatched = Boolean(activity?.isWatched);

  async function openEditor() {
    setEditingLive(live);

    try {
      const response = await fetch("/api/tags", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setAvailableTags(Array.isArray(data.tags) ? data.tags : []);
        setTagCounts(data.tagCounts || {});
      }
    } catch {
      // The editor remains usable with the tags already assigned to the live.
    }
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "No se pudo subir la imagen.");
    }

    return data.path;
  }

  async function persistLive(nextLive) {
    if (!canEdit || !nextLive?.id) {
      toast.error("No tienes permiso para editar directos.");
      return;
    }

    setIsSaving(true);

    try {
      const imagePath = nextLive.imageFile ? await uploadImage(nextLive.imageFile) : nextLive.image || "";
      const payload = { ...nextLive, image: imagePath };
      delete payload.imageFile;

      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", live: payload }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo guardar el directo.");
      }

      setEditingLive(null);
      toast.success("Directo actualizado.");
      window.dispatchEvent(new CustomEvent("kala:live-detail:refresh", {
        detail: { action: "updated", liveId },
      }));
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el directo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLive() {
    if (!canDelete || !pendingDeleteId) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: pendingDeleteId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo borrar el directo.");
      }

      toast.success("Directo eliminado.");
      router.push("/rastreador");
      router.refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo borrar el directo.");
    } finally {
      setIsSaving(false);
      setPendingDeleteId(null);
    }
  }

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
          className={`platform-btn platform-personal platform-personal-watched ${isWatched ? "is-active" : ""} ${pendingKey === "watched" ? "is-loading" : ""}`}
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
      {canEdit && formVariant ? (
        <Tooltip label="Editar directo">
          <button
            type="button"
            className="platform-btn platform-edit"
            aria-label={`Editar ${liveTitle || "directo"}`}
            onClick={openEditor}
          >
            <Edit3 size={15} />
            <span className="platform-personal-label">Editar</span>
          </button>
        </Tooltip>
      ) : null}

      <TrackerMaintainerModal
        live={editingLive}
        isOpen={Boolean(editingLive)}
        onClose={() => setEditingLive(null)}
        onSave={persistLive}
        isSaving={isSaving}
        statuses={statuses}
        availableTags={availableTags.length ? availableTags : (Array.isArray(live?.tags) ? live.tags : [])}
        tagCounts={tagCounts}
        formVariant={formVariant || "compact"}
        onDelete={canDelete ? (id) => setPendingDeleteId(id) : null}
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
        onConfirm={deleteLive}
      />
    </div>
  );
}
