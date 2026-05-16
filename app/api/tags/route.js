import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http";
import { getPrismaClient } from "@/lib/prisma";
import { readLives } from "@/lib/repositories/liveRepository";
import { ensureAnyPermissionAuthorized, ensurePermissionAuthorized } from "@/lib/serverAuth";
import { readTagSettings, writeTagSettings } from "@/lib/tagSettings";
import { categorizeTag, findTagRuleMatch, normalizeRuleItems, normalizeTag, TAG_CATEGORIES } from "@/lib/tags";

export const dynamic = "force-dynamic";

function usePostgres() {
  return process.env.DATA_SOURCE === "postgres";
}

function buildCategoryCatalog(settings) {
  if (Array.isArray(settings.ruleCategories) && settings.ruleCategories.length) {
    return settings.ruleCategories;
  }

  const baseCategories = TAG_CATEGORIES.filter((category) => category.key !== "other");
  const otherCategory = TAG_CATEGORIES.find((category) => category.key === "other");
  return [...baseCategories, ...(settings.categories || []), otherCategory].filter(Boolean);
}

async function buildTagItems(settings, lives, tagCounts) {
  const categories = buildCategoryCatalog(settings);

  if (usePostgres()) {
    const prisma = getPrismaClient();
    const tags = await prisma.tag.findMany({
      include: {
        category: true,
        _count: {
          select: {
            lives: true,
            animeLibraryEntries: true,
          },
        },
      },
      orderBy: [
        { id: "desc" },
      ],
    });

    return tags.map((tag) => {
      const automaticCategoryCode = categorizeTag(tag.name, {}, categories);
      const ruleMatch = findTagRuleMatch(tag.name, categories);
      const manualCategoryCode = settings.overrides?.[normalizeTag(tag.name)];
      const categoryCode = manualCategoryCode || automaticCategoryCode;
      const category = categories.find((item) => item.key === categoryCode);

      return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        categoryCode,
        categoryLabel: category?.label || categoryCode,
        categoryIcon: category?.icon || "",
        automaticCategoryCode,
        automaticCategoryLabel: categories.find((item) => item.key === automaticCategoryCode)?.label || automaticCategoryCode,
        ruleType: ruleMatch.type,
        ruleValue: ruleMatch.value,
        isManual: Boolean(manualCategoryCode),
        liveCount: tag._count?.lives || 0,
        animeCount: tag._count?.animeLibraryEntries || 0,
      };
    });
  }

  return Object.keys(tagCounts).sort().map((tag, index) => {
    const categoryCode = categorizeTag(tag, settings.overrides, categories);
    const automaticCategoryCode = categorizeTag(tag, {}, categories);
    const ruleMatch = findTagRuleMatch(tag, categories);
    const category = categories.find((item) => item.key === categoryCode);

    return {
      id: index + 1,
      name: tag,
      slug: normalizeTag(tag),
      categoryCode,
      categoryLabel: category?.label || categoryCode,
      categoryIcon: category?.icon || "",
      automaticCategoryCode,
      automaticCategoryLabel: categories.find((item) => item.key === automaticCategoryCode)?.label || automaticCategoryCode,
      ruleType: ruleMatch.type,
      ruleValue: ruleMatch.value,
      isManual: Boolean(settings.overrides?.[normalizeTag(tag)]),
      liveCount: tagCounts[tag] || 0,
      animeCount: 0,
    };
  });
}

export async function GET() {
  const [settings, lives] = await Promise.all([
    readTagSettings(),
    readLives(),
  ]);
  const tagCounts = {};

  for (const live of lives) {
    for (const tag of live.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const tagItems = await buildTagItems(settings, lives, tagCounts);

  return NextResponse.json({
    success: true,
    ...settings,
    ruleCategories: buildCategoryCatalog(settings),
    tags: Object.keys(tagCounts).sort(),
    tagCounts,
    tagItems,
  });
}

export async function POST(request) {
  const payload = await readJsonRequest(request);

  if (!payload) {
    return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const action = payload?.action || "legacy";
  const permission = action === "create-category"
    ? "tags.create"
    : action === "delete-category"
      ? "tags.delete"
      : action === "legacy"
        ? null
        : "tags.update";
  const authorization = permission
    ? await ensurePermissionAuthorized(request, permission)
    : await ensureAnyPermissionAuthorized(request, ["tags.create", "tags.update", "tags.delete"]);

  if (authorization.response) {
    return authorization.response;
  }

  if (action === "create-category" || action === "update-category" || action === "delete-category") {
    const currentSettings = await readTagSettings();
    const categories = currentSettings.categories || [];

    if (action === "delete-category") {
      const categoryKey = String(payload?.categoryKey || "").trim();
      const category = categories.find((item) => item.key === categoryKey);

      if (!category) {
        return NextResponse.json({ success: false, error: "La categoría no existe o no se puede eliminar." }, { status: 404 });
      }

      const [, lives] = await Promise.all([Promise.resolve(currentSettings), readLives()]);
      const tagCounts = {};

      for (const live of lives) {
        for (const tag of live.tags || []) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      const tagItems = await buildTagItems(currentSettings, lives, tagCounts);
      if (tagItems.some((tag) => tag.categoryCode === categoryKey)) {
        return NextResponse.json({ success: false, error: "No se puede eliminar una categoría con tags asociados." }, { status: 409 });
      }

      const settings = await writeTagSettings({
        categories: categories.filter((item) => item.key !== categoryKey),
        overrides: currentSettings.overrides,
        categoryRules: (currentSettings.ruleCategories || []).filter((item) => item.key !== categoryKey),
      });

      return NextResponse.json({ success: true, ...settings });
    }

    const category = payload?.category || {};
    const normalizedCategory = {
      key: String(category.key || "").trim(),
      label: String(category.label || "").trim(),
      icon: String(category.icon || "TG").trim() || "TG",
      exact: normalizeRuleItems(category.exact),
      keywords: normalizeRuleItems(category.keywords),
      custom: Boolean(category.custom),
    };

    if (!normalizedCategory.key || !normalizedCategory.label) {
      return NextResponse.json({ success: false, error: "La categoría es inválida." }, { status: 400 });
    }

    const nextCategories = action === "create-category"
      ? [...categories, normalizedCategory]
      : categories.map((item) => (item.key === normalizedCategory.key ? normalizedCategory : item));
    const ruleCategories = (currentSettings.ruleCategories || buildCategoryCatalog(currentSettings)).map((item) => (
      item.key === normalizedCategory.key ? { ...item, ...normalizedCategory } : item
    ));

    const settings = await writeTagSettings({
      categories: nextCategories,
      overrides: currentSettings.overrides,
      categoryRules: ruleCategories,
    });

    return NextResponse.json({ success: true, ...settings });
  }

  if (action === "update-tag") {
    const currentSettings = await readTagSettings();
    const slug = normalizeTag(payload?.tag);
    const categoryKey = String(payload?.categoryKey || "").trim();
    const validCategoryKeys = new Set(buildCategoryCatalog(currentSettings).map((category) => category.key));
    const overrides = { ...currentSettings.overrides };

    if (!slug) {
      return NextResponse.json({ success: false, error: "Tag inválido." }, { status: 400 });
    }

    if (!categoryKey || categoryKey === "auto") {
      delete overrides[slug];
    } else if (validCategoryKeys.has(categoryKey)) {
      overrides[slug] = categoryKey;
    } else {
      return NextResponse.json({ success: false, error: "Categoría inválida." }, { status: 400 });
    }

    const settings = await writeTagSettings({
      categories: currentSettings.categories,
      overrides,
      categoryRules: currentSettings.ruleCategories,
    });

    return NextResponse.json({ success: true, ...settings });
  }

  const settings = await writeTagSettings({
    categories: payload?.categories,
    overrides: payload?.overrides,
    categoryRules: payload?.categoryRules,
  });

  return NextResponse.json({ success: true, ...settings });
}

export async function DELETE(request) {
  const authorization = await ensurePermissionAuthorized(request, "tags.delete");
  if (authorization.response) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const slug = normalizeTag(searchParams.get("slug"));

  if (!slug) {
    return NextResponse.json({ success: false, error: "Tag inválido." }, { status: 400 });
  }

  if (!usePostgres()) {
    return NextResponse.json({ success: false, error: "Solo se pueden eliminar tags persistidos en base de datos." }, { status: 409 });
  }

  const prisma = getPrismaClient();
  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          lives: true,
          animeLibraryEntries: true,
        },
      },
    },
  });

  if (!tag) {
    return NextResponse.json({ success: false, error: "El tag no existe." }, { status: 404 });
  }

  if ((tag._count?.lives || 0) > 0 || (tag._count?.animeLibraryEntries || 0) > 0) {
    return NextResponse.json({ success: false, error: "No se puede eliminar un tag con registros asociados." }, { status: 409 });
  }

  await prisma.tag.delete({ where: { slug } });

  return NextResponse.json({ success: true });
}
