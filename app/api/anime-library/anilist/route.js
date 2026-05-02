import { NextResponse } from "next/server";

import { ensureAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const query = `
  query SearchAnime($search: String!) {
    Media(search: $search, type: ANIME) {
      id
      idMal
      siteUrl
      title {
        romaji
        english
        native
      }
      description(asHtml: false)
      format
      status
      episodes
      startDate {
        year
      }
      coverImage {
        extraLarge
        large
      }
    }
  }
`;

function cleanDescription(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getDisplayTitle(media) {
  return media?.title?.romaji || media?.title?.english || media?.title?.native || "";
}

function toMetadata(media) {
  return {
    title: getDisplayTitle(media),
    image: media?.coverImage?.extraLarge || media?.coverImage?.large || "",
    description: cleanDescription(media?.description),
    provider: "anilist",
    providerId: media?.id || null,
    providerUrl: media?.siteUrl || (media?.id ? `https://anilist.co/anime/${media.id}` : ""),
    year: media?.startDate?.year || "",
    episodes: media?.episodes || "",
    format: media?.format || "",
    status: media?.status || "",
  };
}

export async function POST(request) {
  const unauthorizedResponse = await ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const payload = await request.json();
  const search = String(payload?.search || "").trim();

  if (!search) {
    return NextResponse.json(
      { success: false, error: "Debes indicar un titulo para buscar en AniList." },
      { status: 400 },
    );
  }

  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { search },
    }),
  });
  const data = await response.json();

  if (response.status === 429) {
    return NextResponse.json(
      { success: false, error: "AniList esta limitando las consultas. Intenta nuevamente en unos minutos." },
      { status: 429 },
    );
  }

  if (!response.ok || data.errors?.length) {
    return NextResponse.json(
      { success: false, error: data.errors?.[0]?.message || "No se pudo consultar AniList." },
      { status: 502 },
    );
  }

  const media = data.data?.Media;

  if (!media) {
    return NextResponse.json(
      { success: false, error: "AniList no encontro resultados para esa busqueda." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, metadata: toMetadata(media) });
}
