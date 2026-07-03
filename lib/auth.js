export const SESSION_COOKIE = "kala_admin_session";

function getConfiguredSessionCookieDomain(request) {
  const configuredDomain = String(process.env.SESSION_COOKIE_DOMAIN || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");

  if (!configuredDomain || !/^[a-z0-9.-]+$/.test(configuredDomain)) {
    return undefined;
  }

  const requestHostname = request ? new URL(request.url).hostname.toLowerCase() : "";
  if (requestHostname && requestHostname !== configuredDomain && !requestHostname.endsWith(`.${configuredDomain}`)) {
    return undefined;
  }

  return `.${configuredDomain}`;
}

function getBaseSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function appendHostSessionCookieRemoval(response) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  response.headers.append("Set-Cookie", parts.join("; "));
}

export function setSessionCookie(response, request, token, expires) {
  const domain = getConfiguredSessionCookieDomain(request);

  response.cookies.set(SESSION_COOKIE, token, {
    ...getBaseSessionCookieOptions(),
    ...(domain ? { domain } : {}),
    expires,
  });

  if (domain) {
    appendHostSessionCookieRemoval(response);
  }
}

export function clearSessionCookie(response, request) {
  const options = {
    ...getBaseSessionCookieOptions(),
    maxAge: 0,
  };

  const domain = getConfiguredSessionCookieDomain(request);
  if (domain) {
    response.cookies.set(SESSION_COOKIE, "", { ...options, domain });
    appendHostSessionCookieRemoval(response);
    return;
  }

  response.cookies.set(SESSION_COOKIE, "", options);
}
