export const resolveVideoSource = (videoSrc: string) => {
  if (!videoSrc) return videoSrc;
  const normalized = videoSrc.replace(/^\/+/, "");
  if (normalized.startsWith("http") || normalized.startsWith("blob:")) {
    return videoSrc;
  }
  return normalized;
};
