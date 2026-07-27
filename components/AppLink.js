"use client";

import Link from "next/link";

export default function AppLink({ href, onClick, ...props }) {
  function handleClick(event) {
    onClick?.(event);

    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || typeof href !== "string"
      || !href.startsWith("/")
    ) {
      return;
    }

    const request = new CustomEvent("kala:navigation-request", {
      cancelable: true,
      detail: { path: href },
    });

    if (!window.dispatchEvent(request)) {
      event.preventDefault();
    }
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
