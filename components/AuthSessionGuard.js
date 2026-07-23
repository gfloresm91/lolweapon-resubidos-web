"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthSessionGuard() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json();
        if (isMounted && response.ok && data.authenticated) {
          router.replace("/inicio");
          router.refresh();
        }
      } catch {
        // El formulario sigue disponible si la validación temporal no responde.
      }
    }

    validateSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return null;
}

