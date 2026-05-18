"use client";

import { useDropzone } from "react-dropzone";

const MAX_BYTES = 5 * 1024 * 1024;

export default function AnimeImageDropzone({ hasError = false, onFile, onError }) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: MAX_BYTES,
    noClick: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) {
        onFile(acceptedFiles[0]);
      }
    },
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors?.[0]?.code;
      if (code === "file-too-large") {
        onError("La imagen no puede superar 5 MB.");
        return;
      }
      onError("La imagen debe ser PNG, JPG o WebP.");
    },
  });

  return (
    <div
      {...getRootProps({
        className: `anime-image-dropzone ${isDragActive ? "is-active" : ""} ${hasError ? "is-error" : ""}`,
      })}
    >
      <input {...getInputProps()} />
      <strong>{isDragActive ? "Suelta la imagen aquí" : "Arrastra una imagen aquí"}</strong>
      <span>PNG, JPG o WebP. Máximo 5 MB.</span>
      <button type="button" className="btn-modal btn-modal-secondary" onClick={open}>
        Seleccionar imagen
      </button>
    </div>
  );
}
