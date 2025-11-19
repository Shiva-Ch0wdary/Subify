export type UploadedBlobInfo = {
  url: string;
  pathname: string;
  downloadUrl?: string;
};

export const uploadFileToBlob = async (file: File): Promise<UploadedBlobInfo> => {
  const urlResponse = await fetch("/api/uploads", { method: "POST" });
  if (!urlResponse.ok) {
    throw new Error((await urlResponse.text()) || "Failed to reserve upload slot.");
  }
  const { uploadUrl } = (await urlResponse.json()) as { uploadUrl: string };
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-vercel-blob-metadata": JSON.stringify({ filename: file.name }),
    },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error((await uploadResponse.text()) || "Upload failed.");
  }
  const result = (await uploadResponse.json()) as UploadedBlobInfo;
  if (!result?.url) {
    throw new Error("Upload did not return a blob URL.");
  }
  return result;
};
