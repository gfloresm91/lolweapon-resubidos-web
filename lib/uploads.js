import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), "public", "imagenes");

const CONTENT_TYPES = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function getUploadDir() {
  const configuredDir = process.env.UPLOAD_DIR?.trim();

  if (!configuredDir) {
    return DEFAULT_UPLOAD_DIR;
  }

  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(process.cwd(), configuredDir);
}

function sanitizeFilename(filename) {
  const name = filename || "imagen";
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function resolveUploadPath(filename) {
  const uploadDir = getUploadDir();
  const safeName = path.basename(filename);
  const filePath = path.join(uploadDir, safeName);
  const relativePath = path.relative(uploadDir, filePath);

  if (safeName !== filename || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Nombre de archivo invalido");
  }

  return { filePath, uploadDir };
}

export function getUploadContentType(filename) {
  return CONTENT_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

export async function saveUploadFile(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const { filePath, uploadDir } = resolveUploadPath(filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    filename,
    path: `/imagenes/${encodeURIComponent(filename)}`,
  };
}

export async function readUploadFile(filename) {
  const { filePath } = resolveUploadPath(filename);
  return readFile(filePath);
}
