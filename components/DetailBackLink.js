"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TRACKER_RETURN_STATE_KEY = "kala_tracker_return_state";

const FALLBACK_RETURN = {
  href: "/rastreador",
  label: "Volver al archivo",
};

function getReturnTarget() {
  try {
    const rawState = window.sessionStorage.getItem(TRACKER_RETURN_STATE_KEY);
    const state = rawState ? JSON.parse(rawState) : null;

    if (state?.sourceView === "myList") {
      return {
        href: "/mi-lista",
        label: "Volver a mi lista",
      };
    }

    if (state?.sourceView === "tracker") {
      return {
        href: "/rastreador",
        label: "Volver al rastreador",
      };
    }
  } catch {
    // Ignore malformed session state and use the fallback.
  }

  return FALLBACK_RETURN;
}

export default function DetailBackLink() {
  const [target, setTarget] = useState(FALLBACK_RETURN);

  useEffect(() => {
    setTarget(getReturnTarget());
  }, []);

  return (
    <Link href={target.href} className="detail-back-link">
      {target.label}
    </Link>
  );
}
