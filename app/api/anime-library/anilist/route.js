import { NextResponse } from "next/server";

import { ensureAnyPermissionAuthorized } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const mediaFields = `
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
`;

const mediaByIdQuery = `
  query SearchAnimeById($id: Int) {
    Media(id: $id, type: ANIME) {
      ${mediaFields}
    }
  }
`;

const mediaSearchQuery = `
  query SearchAnime($search: String) {
    Page(page: 1, perPage: 6) {
      media(search: $search, type: ANIME) {
        ${mediaFields}
      }
    }
  }
`;

function getAniListIdFromUrl(value) {
  const match = String(value || "").match(/anilist\.co\/anime\/(\d+)(?:[/?#]|$)/i);
  return match ? Number(match[1]) : null;
}

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
  try {
    const authorization = await ensureAnyPermissionAuthorized(request, [
      "anime.tracking.create",
      "anime.tracking.update",
      "anime.completed.create",
      "anime.completed.update",
    ]);

    if (authorization.response) {
      return authorization.response;
    }

    const payload = await request.json();
    const search = String(payload?.search || "").trim();
    const providerUrl = String(payload?.providerUrl || "").trim();
    const providerId = payload?.providerId ? Number(payload.providerId) : null;
    const urlAniListId = getAniListIdFromUrl(providerUrl);
    const aniListId = urlAniListId || (Number.isFinite(providerId) && providerId > 0 ? providerId : null);

    if (providerUrl && !urlAniListId) {
      return NextResponse.json(
        { success: false, error: "La URL de AniList debe tener formato https://anilist.co/anime/ID/." },
        { status: 400 },
      );
    }

    if (!search && !aniListId) {
      return NextResponse.json(
        { success: false, error: "Debes indicar un titulo, tag o URL de AniList." },
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
        query: aniListId ? mediaByIdQuery : mediaSearchQuery,
        variables: aniListId ? { id: aniListId } : { search },
      }),
    });
    const data = await response.json().catch(() => null);

    if (response.status === 429) {
      return NextResponse.json(
        { success: false, error: "AniList esta limitando las consultas. Intenta nuevamente en unos minutos." },
        { status: 429 },
      );
    }

    if (!response.ok || data?.errors?.length || !data) {
      return NextResponse.json(
        { success: false, error: data?.errors?.[0]?.message || "No se pudo consultar AniList." },
        { status: 502 },
      );
    }

    const results = aniListId
      ? [data.data?.Media].filter(Boolean).map(toMetadata)
      : (data.data?.Page?.media || []).map(toMetadata);
    const media = results[0];

    if (!media) {
      return NextResponse.json(
        { success: false, error: "AniList no encontro resultados para esa busqueda." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, metadata: media, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "No se pudo consultar AniList. Intenta nuevamente en unos minutos." },
      { status: 502 },
    );
  }
}
