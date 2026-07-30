import { headers } from "next/headers";
import { notFound } from "next/navigation";

import PublicAnimeTierListPage from "@/components/PublicAnimeTierListPage";
import { KIND_LABELS, SEASON_LABELS } from "@/lib/animeTierListLabels";
import { getPublicAnimeTierListByShareToken } from "@/lib/repositories/animeTierListRepository";

export const dynamic = "force-dynamic";

function pickHighlightImage(tierList) {
  const itemsById = new Map(tierList.roster.map((item) => [item.id, item]));
  for (const tier of tierList.tiers) {
    for (const placement of tierList.placements) {
      if (placement.tierKey !== tier.key) continue;
      const item = itemsById.get(placement.itemId);
      if (item?.imageUrl) return item.imageUrl;
    }
  }
  return null;
}

export async function generateMetadata({ params }) {
  const { shareToken } = await params;
  const tierList = await getPublicAnimeTierListByShareToken(shareToken);
  if (!tierList) return { title: "Tier list no encontrado" };

  const kindLabel = KIND_LABELS[tierList.kind] || tierList.kind;
  const ownerName = tierList.owner?.alias || tierList.owner?.login || "un usuario";
  const seasonLabel = tierList.season
    ? `${SEASON_LABELS[tierList.season.season] || tierList.season.season} ${tierList.season.year}`
    : "";
  const title = `Tier List de ${kindLabel} de ${ownerName}`;
  const description = `Tier list de ${kindLabel.toLowerCase()} de ${seasonLabel} hecho por ${ownerName} en Lolweapon.`;
  const imageUrl = pickHighlightImage(tierList);

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") || "https";
  const url = host ? `${protocol}://${host}/biblioteca-anime/tier-list/compartido/${shareToken}` : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(url ? { url } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function SharedAnimeTierListRoutePage({ params }) {
  const { shareToken } = await params;
  const tierList = await getPublicAnimeTierListByShareToken(shareToken);
  if (!tierList) notFound();

  return <PublicAnimeTierListPage tierList={tierList} />;
}
