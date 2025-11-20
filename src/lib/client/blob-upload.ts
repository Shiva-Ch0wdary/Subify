"use client";

import { upload } from "@vercel/blob/client";

const sanitizeFilename = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

export type UploadedBlobInfo = {
  url: string;
  pathname: string;
  downloadUrl: string;
};

export const uploadFileToBlob = async (file: File): Promise<UploadedBlobInfo> => {
  if (process.env.NEXT_PUBLIC_ENABLE_BLOB_UPLOADS !== "true") {
    throw new Error("Blob uploads are disabled in this environment.");
  }
  const safeName = sanitizeFilename(file.name || "video.mp4") || `clip-${Date.now()}.mp4`;
  const pathname = `uploads/${Date.now()}-${safeName}`;
  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/uploads",
    contentType: file.type || "video/mp4",
    multipart: file.size > 50 * 1024 * 1024,
  });
  return result;
};
