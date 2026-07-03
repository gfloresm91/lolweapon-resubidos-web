"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  CirclePlay,
  Radio,
  ShieldAlert,
  Sparkles,
  Tv,
  Video,
  X,
} from "lucide-react";

const TABS = [
  { key: "alert", label: "Alertas" },
  { key: "activity", label: "Actividad" },
  { key: "system", label: "Sistema" },
];
const REFRESH_INTERVAL_MS = 30000;
const GUEST_NOTIFICATION_STATE_KEY = "lolweapon_guest_notification_state";

const ICONS = {
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  CirclePlay,
  Radio,
  ShieldAlert,
  Sparkles,
  Tv,
  Video,
};

function formatRelativeTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const units = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs) {
      return formatter.format(Math.round(diffMs / unitMs), unit);
    }
  }

  return "ahora";
}

function NotificationIcon({ notification }) {
  const Icon = ICONS[notification.icon] || (
    notification.type === "alert"
      ? ShieldAlert
      : notification.type === "system"
        ? Sparkles
        : Bell
  );

  return (
    <span className={`notification-item-icon is-${notification.severity || "info"}`} aria-hidden="true">
      <Icon size={17} />
    </span>
  );
}

function readGuestNotificationState() {
  if (typeof window === "undefined") {
    return { readIds: [], dismissedIds: [] };
  }

  try {
    const state = JSON.parse(window.localStorage.getItem(GUEST_NOTIFICATION_STATE_KEY) || "{}");

    return {
      readIds: Array.isArray(state.readIds) ? state.readIds.map(String) : [],
      dismissedIds: Array.isArray(state.dismissedIds) ? state.dismissedIds.map(String) : [],
    };
  } catch {
    return { readIds: [], dismissedIds: [] };
  }
}

function writeGuestNotificationState(state) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GUEST_NOTIFICATION_STATE_KEY, JSON.stringify({
    readIds: Array.from(new Set(state.readIds || [])).slice(-200),
    dismissedIds: Array.from(new Set(state.dismissedIds || [])).slice(-200),
  }));
}

function applyGuestNotificationState(notifications, state = readGuestNotificationState()) {
  const readIds = new Set(state.readIds || []);
  const dismissedIds = new Set(state.dismissedIds || []);

  return notifications
    .filter((notification) => !dismissedIds.has(String(notification.id)))
    .map((notification) => ({
      ...notification,
      isRead: notification.isRead || readIds.has(String(notification.id)),
      isDismissed: notification.isDismissed || dismissedIds.has(String(notification.id)),
    }));
}

function countUnreadNotifications(notifications) {
  return notifications.filter((notification) => !notification.isRead).length;
}

export default function NotificationCenter({ user = null, canViewAll = false, onViewAll }) {
  const router = useRouter();
  const rootRef = useRef(null);
  const isLoadingRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const socketRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("alert");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAuthenticated = Boolean(user?.id);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => notification.type === activeTab),
    [activeTab, notifications],
  );
  const tabCounts = useMemo(() => notifications.reduce((counts, notification) => ({
    ...counts,
    [notification.type]: (counts[notification.type] || 0) + 1,
  }), {}), [notifications]);
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  async function loadNotifications({ showLoading = false } = {}) {
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/notifications?limit=40", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        const nextNotifications = isAuthenticated
          ? data.notifications || []
          : applyGuestNotificationState(data.notifications || []);
        setNotifications(nextNotifications);
        setUnreadCount(isAuthenticated ? data.unreadCount || 0 : countUnreadNotifications(nextNotifications));
      }
    } finally {
      isLoadingRef.current = false;

      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  function runGuestAction(action, id = null) {
    const state = readGuestNotificationState();
    const nextState = {
      readIds: [...state.readIds],
      dismissedIds: [...state.dismissedIds],
    };

    if (action === "mark-read" && id != null) {
      nextState.readIds.push(String(id));
    }

    if (action === "dismiss" && id != null) {
      nextState.readIds.push(String(id));
      nextState.dismissedIds.push(String(id));
    }

    if (action === "mark-all-read") {
      nextState.readIds.push(...notifications.map((notification) => String(notification.id)));
    }

    writeGuestNotificationState(nextState);

    const nextNotifications = applyGuestNotificationState(notifications, nextState);
    setNotifications(nextNotifications);
    setUnreadCount(countUnreadNotifications(nextNotifications));
  }

  async function runAction(action, id = null) {
    if (!isAuthenticated) {
      runGuestAction(action, id);
      return;
    }

    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    const data = await response.json().catch(() => null);

    if (response.ok && data?.success) {
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    }
  }

  useEffect(() => {
    loadNotifications({ showLoading: true });
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (!isMounted || reconnectTimerRef.current) {
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 5000);
    }

    function connect() {
      if (!isMounted || socketRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      clearReconnectTimer();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`);
      socketRef.current = socket;

      socket.addEventListener("message", (event) => {
        let payload = null;

        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (payload?.type === "notifications:update") {
          loadNotifications();
        }
      });

      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => {
        socket.close();
      });
    }

    connect();

    return () => {
      isMounted = false;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    }

    const intervalId = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    document.body.classList.toggle("is-notification-center-open", isOpen);

    return () => {
      document.body.classList.remove("is-notification-center-open");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    loadNotifications({ showLoading: true });

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {unreadCount ? <BellRing size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
        {unreadCount ? <span className="notification-badge">{badgeLabel}</span> : null}
      </button>

      {isOpen ? (
        <div className="notification-popover" role="dialog" aria-label="Centro de notificaciones">
          <div className="notification-header">
            <div>
              <span>Centro</span>
              <strong>Notificaciones</strong>
            </div>
            {unreadCount ? <span className="notification-count">{badgeLabel} nuevas</span> : null}
          </div>

          <div className="notification-tabs" role="tablist" aria-label="Tipos de notificación">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "is-active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                {tabCounts[tab.key] ? <em>{tabCounts[tab.key]}</em> : null}
              </button>
            ))}
          </div>

          <div className="notification-list">
            {isLoading && !notifications.length ? (
              <div className="notification-empty">
                <Bell size={18} aria-hidden="true" />
                <strong>Cargando notificaciones...</strong>
              </div>
            ) : null}

            {!isLoading && !visibleNotifications.length ? (
              <div className="notification-empty">
                <CheckCheck size={18} aria-hidden="true" />
                <strong>No hay notificaciones aquí.</strong>
                <p>{user ? "Cuando haya actividad relevante aparecerá en este panel." : "Inicia sesión para ver avisos personalizados."}</p>
              </div>
            ) : null}

            {visibleNotifications.map((notification) => {
              const shouldOpenInNewTab = notification.type === "alert";
              const content = (
                <>
                  <NotificationIcon notification={notification} />
                  <span className="notification-item-copy">
                    <strong>{notification.title}</strong>
                    {notification.body ? <span>{notification.body}</span> : null}
                    <em>{formatRelativeTime(notification.createdAt)}</em>
                  </span>
                </>
              );

              return (
                <article
                  key={notification.id}
                  className={`notification-item ${notification.isRead ? "" : "is-unread"}`}
                >
                  {notification.href && shouldOpenInNewTab ? (
                    <a
                      href={notification.href}
                      className="notification-item-main"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        void runAction("mark-read", notification.id);
                        setIsOpen(false);
                      }}
                    >
                      {content}
                    </a>
                  ) : notification.href ? (
                    <Link
                      href={notification.href}
                      className="notification-item-main"
                      onClick={() => {
                        void runAction("mark-read", notification.id);
                        setIsOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="notification-item-main"
                      onClick={() => runAction("mark-read", notification.id)}
                    >
                      {content}
                    </button>
                  )}
                  <button
                    type="button"
                    className="notification-dismiss"
                    aria-label={`Descartar ${notification.title}`}
                    onClick={() => runAction("dismiss", notification.id)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>

          <div className="notification-footer">
            <button
              type="button"
              disabled={!unreadCount}
              onClick={() => runAction("mark-all-read")}
            >
              <CheckCheck size={15} aria-hidden="true" />
              <span>Marcar todo como leído</span>
            </button>
            {canViewAll ? (
              <button type="button" onClick={() => { setIsOpen(false); onViewAll ? onViewAll() : router.push("/notificaciones"); }}>
                <Bell size={15} aria-hidden="true" />
                <span>Ver todas</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
