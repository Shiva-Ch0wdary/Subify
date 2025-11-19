import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Expected `file` in multipart form data." },
        { status: 400 },
      );
    }

    try {
      validateUploadFile(file);
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : "Invalid file." },
        { status: 400 },
      );
    }

    const stylePresetParam = formData.get("stylePreset");
    const placementParam = formData.get("placement");
    const durationParam = formData.get("duration");

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
    const transcription = await transcribeToCaptions(file);
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
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
      },
    });

    await saveSession(session);

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
