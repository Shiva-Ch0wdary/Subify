#!/usr/bin/env node
import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { DEFAULT_FPS, DEFAULT_VIDEO_DIMENSIONS } from "@/lib/constants/captions";
import type { CaptionSession } from "@/lib/types/captions";
import type { CaptionCompositionProps } from "@/lib/types/captions";
import { renderCaptionVideo } from "@/lib/server/remotion-renderer";
import { createTempAssetServer } from "@/lib/server/temp-asset-server";

type CliOptions = {
  session: string;
  input: string;
  output: string;
  mime?: string;
};

const helpMessage = `
Usage:
  npm run render:video -- --session ./path/to/session.json --input ./path/to/video.mp4 --out ./output.mp4

Flags:
  --session, -s   Path to the downloaded session JSON (contains captions + styling).
  --input, -i     Path to the source video file (same file you uploaded to Subify).
  --out, -o       Output path for the rendered MP4. Defaults to "<input>-captions.mp4".
  --mime, -m      Optional mime type (defaults to video/mp4). Useful for MOV/WEBM files.
`.trim();

const guessMimeType = (filePath: string, override?: string) => {
  if (override) return override;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mkv") return "video/x-matroska";
  return "video/mp4";
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(helpMessage);
    process.exit(0);
  }

  const options: Partial<CliOptions> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case "--session":
      case "-s":
        options.session = next;
        i++;
        break;
      case "--input":
      case "-i":
        options.input = next;
        i++;
        break;
      case "--out":
      case "-o":
        options.output = next;
        i++;
        break;
      case "--mime":
      case "-m":
        options.mime = next;
        i++;
        break;
      default:
        break;
    }
  }

  if (!options.session || !options.input) {
    console.error("Missing required options.\n");
    console.error(helpMessage);
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), options.input);
  const resolvedSession = path.resolve(process.cwd(), options.session);
  const resolvedOutput =
    options.output && options.output.length > 0
      ? path.resolve(process.cwd(), options.output)
      : `${resolvedInput.replace(/\.[^.]+$/, "")}-captions.mp4`;

  return {
    session: resolvedSession,
    input: resolvedInput,
    output: resolvedOutput,
    mime: options.mime,
  };
};

const ensureFileExists = (filePath: string, label: string) => {
  if (!existsSync(filePath)) {
    console.error(`Cannot find ${label} at: ${filePath}`);
    process.exit(1);
  }
};

const loadSession = async (sessionPath: string): Promise<CaptionSession> => {
  const contents = await fs.readFile(sessionPath, "utf8");
  return JSON.parse(contents) as CaptionSession;
};

const render = async ({ session, input, output, mime }: CliOptions) => {
  ensureFileExists(session, "session JSON");
  ensureFileExists(input, "input video");

  const sessionData = await loadSession(session);
  const mimeType = guessMimeType(input, mime);

  console.log("▶︎ Rendering video with the following settings:");
  console.log(`   Session: ${session}`);
  console.log(`   Input video: ${input}`);
  console.log(`   Output file: ${output}`);
  console.log(`   Mime type: ${mimeType}`);
  console.log("");

  const assetServer = await createTempAssetServer(input, mimeType);
  try {
    const props: CaptionCompositionProps = {
      captions: sessionData.captions,
      videoSrc: assetServer.url,
      stylePreset: sessionData.stylePreset,
      placement: sessionData.placement,
      fps: DEFAULT_FPS,
      duration: sessionData.duration,
      width: DEFAULT_VIDEO_DIMENSIONS.width,
      height: DEFAULT_VIDEO_DIMENSIONS.height,
    };
    await renderCaptionVideo(props, output);
    console.log("");
    console.log("✅ Render complete!");
    console.log(`   Output saved to: ${output}`);
  } finally {
    await assetServer.close();
  }
};

void render(parseArgs()).catch((error) => {
  console.error("Render failed:", error);
  process.exit(1);
});
