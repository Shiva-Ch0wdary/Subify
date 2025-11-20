"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSessionVideoFile } from "@/lib/client/video-store";

type UseSessionVideoOptions = {
  sessionId: string;
};

export const useSessionMedia = ({ sessionId }: UseSessionVideoOptions) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const revokeRef = useRef<(() => void) | null>(null);

  const loadVideo = useCallback(async () => {
    setIsVideoLoading(true);
    setVideoError(null);
    try {
      const stored = await getSessionVideoFile(sessionId);
      if (!stored) {
        throw new Error("Original video missing. Please re-upload from the home screen.");
      }
      setVideoFile(stored);
      const nextUrl = URL.createObjectURL(stored);
      if (revokeRef.current) {
        revokeRef.current();
      }
      revokeRef.current = () => URL.revokeObjectURL(nextUrl);
      setVideoUrl(nextUrl);
    } catch (error) {
      console.error("Failed to load stored video", error);
      setVideoFile(null);
      setVideoUrl(null);
      setVideoError(
        error instanceof Error ? error.message : "Failed to read stored video."
      );
    } finally {
      setIsVideoLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadVideo();
    return () => {
      if (revokeRef.current) {
        revokeRef.current();
      }
    };
  }, [loadVideo]);

  const hasVideo = useMemo(() => Boolean(videoFile && videoUrl), [videoFile, videoUrl]);

  return {
    videoFile,
    videoUrl,
    isVideoLoading,
    videoError,
    reloadVideo: loadVideo,
    hasVideo,
  };
};
