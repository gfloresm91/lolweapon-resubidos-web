"use client";

import { useDropzone } from "react-dropzone";

import UserAvatar from "@/components/UserAvatar";
import { AVATAR_MAX_BYTES } from "@/lib/platformUserValidation";

export function getAvatarStatus(avatarUrl, previewUrl) {
  if (previewUrl) return "Nuevo avatar seleccionado";
  if (!avatarUrl) return "Sin avatar personalizado";
  if (avatarUrl.startsWith("/imagenes/avatars/")) return "Avatar personalizado";
  if (/static-cdn\.jtvnw\.net|twitch/i.test(avatarUrl)) return "Avatar de Twitch";
  if (/ytimg\.com|googleusercontent\.com|youtube/i.test(avatarUrl)) return "Avatar de YouTube";
  return "Avatar externo";
}

export async function uploadAvatarFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "No se pudo subir el avatar.");
  }

  return data.path;
}

export default function AvatarUploader({
  avatarUrl,
  alias,
  login,
  previewUrl,
  onFileChange,
  onAvatarClear,
  error,
}) {
  const displayAvatar = previewUrl || avatarUrl;
  const avatarStatus = getAvatarStatus(avatarUrl, previewUrl);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: AVATAR_MAX_BYTES,
    noClick: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) {
        onFileChange(acceptedFiles[0]);
      }
    },
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors?.[0]?.code;
      if (code === "file-too-large") {
        onFileChange(null, "El avatar no puede superar 2 MB.");
        return;
      }
      onFileChange(null, "El avatar debe ser PNG, JPG o WebP.");
    },
  });

  return (
    <div className="profile-avatar-uploader">
      <div className="profile-avatar-preview">
        <UserAvatar user={{ alias, login }} src={displayAvatar} className="account-avatar-large" />
        <div>
          <strong>{login}</strong>
          <span>{avatarStatus}</span>
        </div>
      </div>

      <div
        {...getRootProps({
          className: `profile-avatar-dropzone ${isDragActive ? "is-active" : ""} ${error ? "is-error" : ""}`,
        })}
      >
        <input {...getInputProps()} />
        <strong>{isDragActive ? "Suelta la imagen aquí" : "Arrastra una imagen aquí"}</strong>
        <span>PNG, JPG o WebP. Máximo 2 MB.</span>
        <button type="button" className="btn-modal btn-modal-secondary" onClick={open}>
          Seleccionar imagen
        </button>
      </div>

      {error || avatarUrl || previewUrl ? (
        <div className="profile-avatar-footer">
          {error ? <span className="field-error">{error}</span> : null}
          {avatarUrl || previewUrl ? (
            <button type="button" className="profile-avatar-clear" onClick={onAvatarClear}>
              Quitar avatar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
