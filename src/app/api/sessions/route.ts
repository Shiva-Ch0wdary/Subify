import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import {
  CAPTION_PLACEMENT_OPTIONS,
  CAPTION_STYLE_PRESETS,
  DEFAULT_PLACEMENT,
} from "@/lib/constants/captions";
import {
  createSessionRecord,
  saveSession,
} from "@/lib/server/session-store";
import {
  transcribeToCaptions,
  validateUploadFile,
} from "@/lib/server/transcription";
import type {
  CaptionPlacement,
  CaptionStylePreset,
} from "@/lib/types/captions";
import { calculateDurationFromCaptions } from "@/lib/utils/captions";

export const runtime = "nodejs";
const isValidStylePreset = (value: string): value is CaptionStylePreset =>
  CAPTION_STYLE_PRESETS.some((preset) => preset.id === value);

const isValidPlacement = (value: string): value is CaptionPlacement =>
  CAPTION_PLACEMENT_OPTIONS.some((option) => option.id === value);

const downloadBlobAsFile = async (payload: {
  blobUrl: string;
  fileName?: string;
  mimeType?: string;
  lastModified?: number;
}) => {
  const response = await fetch(payload.blobUrl);
  if (!response.ok) {
    throw new Error("Failed to download uploaded video blob.");
  }
  const buffer = await response.arrayBuffer();
  return new File([buffer], payload.fileName ?? "upload.mp4", {
    type: payload.mimeType ?? "video/mp4",
    lastModified: payload.lastModified ?? Date.now(),
  });
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    let fileSource: File | null = null;
    let blobUrl: string | null = null;
    let stylePresetParam: FormDataEntryValue | null = null;
    let placementParam: FormDataEntryValue | null = null;
    let durationParam: FormDataEntryValue | null = null;

    if (isJson) {
      const body = await request.json();
      if (!body?.blobUrl) {
        return NextResponse.json({ error: "Missing uploaded video reference." }, { status: 400 });
      }
      blobUrl = body.blobUrl;
      stylePresetParam = body.stylePreset ?? null;
      placementParam = body.placement ?? null;
      durationParam = body.duration ?? null;
      fileSource = await downloadBlobAsFile({
        blobUrl,
        fileName: body.fileName,
        mimeType: body.mimeType,
        lastModified: body.lastModified,
      });
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      if (file instanceof File) {
        fileSource = file;
      }
      stylePresetParam = formData.get("stylePreset");
      placementParam = formData.get("placement");
      durationParam = formData.get("duration");
    }

    if (!fileSource) {
      return NextResponse.json(
        { error: "Expected `file` in multipart form data." },
        { status: 400 },
      );
    }

    try {
      validateUploadFile(fileSource);
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : "Invalid file." },
        { status: 400 },
      );
    }

    const stylePreset: CaptionStylePreset = isValidStylePreset(
      String(stylePresetParam),
    )
      ? (stylePresetParam as CaptionStylePreset)
      : "standard";

    const placement: CaptionPlacement = isValidPlacement(
      String(placementParam),
    )
      ? (placementParam as CaptionPlacement)
      : DEFAULT_PLACEMENT;

    const parsedDuration = Number(durationParam);

    const sessionId = randomUUID();
    const transcription = await transcribeToCaptions(fileSource);
    const duration =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : transcription.duration ??
          calculateDurationFromCaptions(transcription.segments);

    const session = createSessionRecord({
      id: sessionId,
      captions: transcription.segments,
      stylePreset,
      placement,
      duration,
      language: transcription.language,
      videoMetadata: {
        name: fileSource.name,
        type: fileSource.type,
        size: fileSource.size,
        lastModified: fileSource.lastModified,
      },
    });

    await saveSession(session);
    if (blobUrl) {
      await del(blobUrl).catch((error) =>
        console.warn("[sessions:create] blob cleanup failed", error),
      );
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("[sessions:create]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create session.",
      },
      { status: 500 },
    );
  }
}
