import { randomBytes } from "node:crypto";
import { chmod, readFile, unlink, writeFile } from "node:fs/promises";

import { getPrismaClient } from "../lib/prisma.js";
import { generateToken, hashToken } from "../lib/tokenHash.js";

const action = process.argv[2];

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function assertQaDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL || "");
  const databaseName = databaseUrl.pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_qa")) {
    throw new Error("Operación rechazada: DATABASE_URL no apunta a una base terminada en _qa");
  }
}

async function createFixture() {
  const users = Number(arg("users", 50));
  if (!Number.isInteger(users) || users < 1 || users > 500) throw new Error("--users debe estar entre 1 y 500");

  const prisma = getPrismaClient();
  const runId = `${Date.now()}_${randomBytes(4).toString("hex")}`;
  const loginPrefix = `loadtest_${runId}_`;
  const output = arg("output", `/tmp/lolweapon-playback-load-${runId}.json`);
  const requestedLiveId = Number(arg("live-id"));
  const [role, live] = await Promise.all([
    prisma.platformRole.findUnique({ where: { code: "publico" }, select: { id: true } }),
    Number.isInteger(requestedLiveId) && requestedLiveId > 0
      ? prisma.live.findUnique({ where: { id: requestedLiveId }, select: { id: true } })
      : prisma.live.findFirst({ orderBy: { id: "desc" }, select: { id: true } }),
  ]);
  if (!role) throw new Error("No existe el rol publico en QA");
  if (!live) throw new Error("No existe un directo válido para la prueba");

  const rawTokens = Array.from({ length: users }, () => generateToken());
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const createdUsers = await prisma.$transaction(async (tx) => {
    await tx.platformUser.createMany({
      data: Array.from({ length: users }, (_, index) => ({
        login: `${loginPrefix}${index + 1}`,
        alias: `Carga QA ${index + 1}`,
        email: `${loginPrefix}${index + 1}@loadtest.invalid`,
        roleId: role.id,
        roleSource: "manual",
        isActive: true,
      })),
    });
    const rows = await tx.platformUser.findMany({
      where: { login: { startsWith: loginPrefix } },
      orderBy: { login: "asc" },
      select: { id: true, login: true },
    });
    if (rows.length !== users) throw new Error("No se crearon todos los usuarios temporales");
    await tx.platformSession.createMany({
      data: rows.map((user, index) => ({ userId: user.id, token: hashToken(rawTokens[index]), expiresAt })),
    });
    return rows;
  });

  const fixture = {
    type: "playback_load_fixture",
    runId,
    loginPrefix,
    baseUrl: "https://resubidos-qa.lolweapon.com",
    liveId: live.id,
    cookieName: process.env.SESSION_COOKIE_NAME || "kala_admin_session",
    expiresAt: expiresAt.toISOString(),
    sessions: createdUsers.map((user, index) => ({ userId: user.id, token: rawTokens[index] })),
  };
  await writeFile(output, `${JSON.stringify(fixture)}\n`, { mode: 0o600, flag: "wx" });
  await chmod(output, 0o600);
  console.log(JSON.stringify({ createdUsers: users, liveId: live.id, fixtureFile: output, expiresAt }, null, 2));
}

async function cleanupFixture() {
  const file = arg("file");
  if (!file) throw new Error("cleanup requiere --file");
  const fixture = JSON.parse(await readFile(file, "utf8"));
  if (fixture?.type !== "playback_load_fixture" || !/^loadtest_[a-zA-Z0-9_]+_$/.test(fixture.loginPrefix || "")) {
    throw new Error("Fixture inválido; limpieza rechazada");
  }
  const ids = fixture.sessions?.map(({ userId }) => Number(userId)).filter(Number.isInteger) || [];
  if (!ids.length || ids.length > 500) throw new Error("Lista de usuarios inválida; limpieza rechazada");

  const prisma = getPrismaClient();
  const result = await prisma.platformUser.deleteMany({
    where: { id: { in: ids }, login: { startsWith: fixture.loginPrefix } },
  });
  if (result.count !== ids.length) {
    throw new Error(`Se eliminaron ${result.count}/${ids.length}; el fixture se conserva para revisión`);
  }
  await unlink(file);
  console.log(JSON.stringify({ deletedUsers: result.count, fixtureFileRemoved: file }, null, 2));
}

assertQaDatabase();
const prisma = getPrismaClient();
try {
  if (action === "create") await createFixture();
  else if (action === "cleanup") await cleanupFixture();
  else throw new Error("Uso: create [--users N] [--live-id ID] o cleanup --file RUTA");
} finally {
  await prisma.$disconnect();
}
