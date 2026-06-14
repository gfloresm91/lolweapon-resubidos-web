"use client";

import { useRouter } from "next/navigation";

function canReturnToPreviousPage() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;

    if (referrer && referrer.origin === currentOrigin) {
      const referrerPath = referrer.pathname;
      return (
        referrerPath !== currentPath &&
        !["/login", "/registro"].includes(referrerPath) &&
        !referrerPath.startsWith("/api/")
      );
    }

    return window.history.length > 1;
  } catch {
    return window.history.length > 1;
  }
}

function getSafeLocalPath(path) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/api/")) {
    return null;
  }

  if (["/login", "/registro"].includes(path.split("?")[0].split("#")[0])) {
    return null;
  }

  return path;
}

export default function AuthBackButton({ fallbackHref = "/inicio", label = "Volver a la web", returnHref = null }) {
  const router = useRouter();

  function handleBack() {
    const safeReturnHref = getSafeLocalPath(returnHref);

    if (safeReturnHref) {
      router.push(safeReturnHref);
      return;
    }

    if (canReturnToPreviousPage()) {
      router.back();
      return;
    }

    router.push(getSafeLocalPath(fallbackHref) || "/inicio");
  }

  return (
    <button type="button" className="auth-back-link" onClick={handleBack}>
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
