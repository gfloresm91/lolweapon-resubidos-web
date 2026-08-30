"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_DEBOUNCE_MS = 200;
const BROAD_CATALOG_ACTIONS = new Set(["replaced", "bulk-updated", "invalidated"]);

export default function LiveDetailRealtimeRefresh({ liveId }) {
  const router = useRouter();
  const refreshTimerRef = useRef(null);
  const pendingRefreshRef = useRef(false);
  const realtimeConnectedRef = useRef(false);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    function scheduleRefresh() {
      if (document.visibilityState !== "visible") {
        pendingRefreshRef.current = true;
        return;
      }

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        pendingRefreshRef.current = false;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    function handleLiveUpdate(event) {
      const updatedLiveId = event.detail?.liveId;
      const action = event.detail?.action;
      const targetsCurrentLive = updatedLiveId && String(updatedLiveId) === String(liveId);

      if (targetsCurrentLive || (!updatedLiveId && BROAD_CATALOG_ACTIONS.has(action))) {
        scheduleRefresh();
      }
    }

    function handleRealtimeState(event) {
      const connected = Boolean(event.detail?.connected);
      const wasConnected = realtimeConnectedRef.current;
      realtimeConnectedRef.current = connected;

      if (connected) {
        if (hasConnectedRef.current && !wasConnected) {
          scheduleRefresh();
        }
        hasConnectedRef.current = true;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && pendingRefreshRef.current) {
        scheduleRefresh();
      }
    }

    window.addEventListener("kala:lives:update", handleLiveUpdate);
    window.addEventListener("kala:live-detail:refresh", handleLiveUpdate);
    window.addEventListener("kala:realtime-state", handleRealtimeState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("kala:lives:update", handleLiveUpdate);
      window.removeEventListener("kala:live-detail:refresh", handleLiveUpdate);
      window.removeEventListener("kala:realtime-state", handleRealtimeState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [liveId, router]);

  return null;
}
