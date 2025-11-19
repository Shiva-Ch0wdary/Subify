import { Buffer } from "buffer";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FPS, DEFAULT_VIDEO_DIMENSIONS } from "@/lib/constants/captions";
import { readSession } from "@/lib/server/session-store";
import type { CaptionCompositionProps } from "@/lib/types/captions";
import { renderCaptionVideo } from "@/lib/server/remotion-renderer";
import { sanitizeSegments } from "@/lib/utils/captions";
import { validateUploadFile } from "@/lib/server/transcription";
import { createTempAssetServer } from "@/lib/server/temp-asset-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const streamFile = (filePath: string, cleanup?: () => Promise<void> | void) => {
  let stream: ReturnType<typeof createReadStream> | null = null;
  const runCleanup = () => {
    if (!cleanup) return;
    return Promise.resolve()
      .then(() => cleanup())
      .catch((error) => {
        console.error("[sessions:export] cleanup failed", error);
      });
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream = createReadStream(filePath);
      stream.on("data", (chunk) => {
        const payload = chunk instanceof Buffer ? chunk : Buffer.from(chunk);
        controller.enqueue(new Uint8Array(payload));
      });
      stream.on("end", () => {
        controller.close();
        stream?.close();
        void runCleanup();
      });
      stream.on("error", (error) => {
        controller.error(error);
        void runCleanup();
      });
    },
    cancel() {
      stream?.destroy();
      return runCleanup();
    },
  });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const deleteWithRetries = async (targetPath: string, attempts = 5) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error;
      }
      await delay(100 * (attempt + 1));
    }
  }
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await readSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Expected original video in form data." },
        { status: 400 },
      );
    }

    validateUploadFile(file);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "subify-export-"));
    let tmpDirActive = true;
    const removeTmpDir = async () => {
      if (!tmpDirActive) return;
      tmpDirActive = false;
      await deleteWithRetries(tmpDir);
    };
    const sourcePath = path.join(tmpDir, "source");
    const outputFile = path.join(tmpDir, `${sessionId}-export.mp4`);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(sourcePath, buffer);
      const assetServer = await createTempAssetServer(
        sourcePath,
        file.type || "video/mp4",
      );

      const props: CaptionCompositionProps = {
        captions: sanitizeSegments(session.captions, {
          targetDuration: session.duration,
        }),
        videoSrc: assetServer.url,
        stylePreset: session.stylePreset,
        placement: session.placement,
        fps: DEFAULT_FPS,
        duration: session.duration,
        width: DEFAULT_VIDEO_DIMENSIONS.width,
        height: DEFAULT_VIDEO_DIMENSIONS.height,
      };

      try {
        await renderCaptionVideo(props, outputFile);
      } finally {
        await assetServer.close();
      }

      const headers = new Headers({
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${path.basename(outputFile)}"`,
        "Cache-Control": "no-store",
      });

      const body = streamFile(outputFile, removeTmpDir);

      return new NextResponse(body, {
        headers,
      });
    } catch (error) {
      await removeTmpDir();
      throw error;
    }
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
