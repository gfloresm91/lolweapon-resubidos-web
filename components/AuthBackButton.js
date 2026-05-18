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

export default function AuthBackButton({ fallbackHref = "/inicio", label = "Volver a la web" }) {
  const router = useRouter();

  function handleBack() {
    if (canReturnToPreviousPage()) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button type="button" className="auth-back-link" onClick={handleBack}>
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
