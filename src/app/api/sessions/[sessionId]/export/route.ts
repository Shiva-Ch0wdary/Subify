import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FPS, DEFAULT_VIDEO_DIMENSIONS } from "@/lib/constants/captions";
import { readSession, updateSession } from "@/lib/server/session-store";
import type { CaptionCompositionProps } from "@/lib/types/captions";
import { renderCaptionVideo } from "@/lib/server/remotion-renderer";
import { sanitizeSegments } from "@/lib/utils/captions";

export const runtime = "nodejs";

const EXPORTS_DIR = path.join(process.cwd(), "public", "exports");

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await readSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const props: CaptionCompositionProps = {
      captions: sanitizeSegments(session.captions, {
        targetDuration: session.duration,
      }),
      videoSrc: session.videoSrc.replace(/^\/+/, ""),
      stylePreset: session.stylePreset,
      placement: session.placement,
      fps: DEFAULT_FPS,
      duration: session.duration,
      width: DEFAULT_VIDEO_DIMENSIONS.width,
      height: DEFAULT_VIDEO_DIMENSIONS.height,
    };

    await ensureDir(EXPORTS_DIR);
    const outputFile = path.join(EXPORTS_DIR, `${sessionId}-${Date.now()}.mp4`);

    await renderCaptionVideo(props, outputFile);

    const downloadUrl = `/exports/${path.basename(outputFile)}`;
    await updateSession(sessionId, { exportDownloadUrl: downloadUrl });

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("[sessions:export]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to render captioned video.",
      },
      { status: 500 },
    );
  }
}
