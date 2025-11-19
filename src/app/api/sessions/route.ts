import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
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
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const ensureUploadsDir = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
};

const normalizeFileName = (input: string) => {
  const safe = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length ? safe : "upload.mp4";
};

const saveUploadedFile = async (buffer: Buffer, fileName: string) => {
  await ensureUploadsDir();
  const sanitized = normalizeFileName(fileName || "upload.mp4");
  const filePath = path.join(UPLOADS_DIR, sanitized);
  await fs.writeFile(filePath, buffer);
  return `/uploads/${sanitized}`;
};

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
    const originalName = normalizeFileName(file.name || `${sessionId}.mp4`);
    const sessionFileName = `${sessionId}-${originalName}`;
    const arrayBuffer = await file.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer);
    const videoSrc = await saveUploadedFile(nodeBuffer, sessionFileName);

    const readableFile = new File([nodeBuffer], originalName, {
      type: file.type || "video/mp4",
    });
    const transcription = await transcribeToCaptions(readableFile);
    const duration =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : transcription.duration ??
          calculateDurationFromCaptions(transcription.segments);

    const session = createSessionRecord({
      id: sessionId,
      videoSrc,
      captions: transcription.segments,
      stylePreset,
      placement,
      duration,
      language: transcription.language,
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
