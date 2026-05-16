import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), "public", "imagenes");
const AVATAR_UPLOAD_DIRNAME = "avatars";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function getImageTypeFromBuffer(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return "";
}

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

function resolveAvatarUploadPath(filename) {
  const uploadDir = path.join(getUploadDir(), AVATAR_UPLOAD_DIRNAME);
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
  if (!IMAGE_CONTENT_TYPES.has(file.type)) {
    throw new Error("La imagen debe ser PNG, JPG o WebP.");
  }

  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("La imagen no puede superar 5 MB.");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const detectedType = getImageTypeFromBuffer(buffer);

  if (!IMAGE_CONTENT_TYPES.has(detectedType)) {
    throw new Error("El archivo no parece ser una imagen PNG, JPG o WebP válida.");
  }

  const extension = IMAGE_EXTENSIONS[detectedType];
  const baseName = sanitizeFilename(path.basename(file.name, path.extname(file.name))) || "imagen";
  const filename = `${Date.now()}-${crypto.randomUUID()}-${baseName}${extension}`;
  const { filePath, uploadDir } = resolveUploadPath(filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    filename,
    path: `/imagenes/${encodeURIComponent(filename)}`,
  };
}

export async function saveAvatarUploadFile(file, userId) {
  if (!IMAGE_CONTENT_TYPES.has(file.type)) {
    throw new Error("El avatar debe ser PNG, JPG o WebP.");
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("El avatar no puede superar 2 MB.");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const detectedType = getImageTypeFromBuffer(buffer);

  if (!IMAGE_CONTENT_TYPES.has(detectedType)) {
    throw new Error("El archivo no parece ser una imagen PNG, JPG o WebP válida.");
  }

  const extension = IMAGE_EXTENSIONS[detectedType];
  const filename = `${Date.now()}-${userId || "user"}-${crypto.randomUUID()}${extension}`;
  const { filePath, uploadDir } = resolveAvatarUploadPath(filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    filename,
    path: `/imagenes/${AVATAR_UPLOAD_DIRNAME}/${encodeURIComponent(filename)}`,
  };
}

export async function readUploadFile(filename) {
  const { filePath } = resolveUploadPath(filename);
  return readFile(filePath);
}

export async function readAvatarUploadFile(filename) {
  const { filePath } = resolveAvatarUploadPath(filename);
  return readFile(filePath);
}
