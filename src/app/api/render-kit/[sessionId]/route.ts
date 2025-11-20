import { NextResponse } from "next/server";
import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";
import { readSession } from "@/lib/server/session-store";
import { captionsToSrt, captionsToVtt } from "@/lib/utils/subtitles";

const TEMPLATE_DIR = path.join(process.cwd(), "render-kit-template");

const TEMPLATE_FILES = [
  "package.json",
  "tsconfig.json",
  "remotion.config.ts",
  "scripts/render-video.ts",
];

const COPY_DIRECTORIES = [
  { source: "remotion", target: "remotion" },
  { source: path.join("src", "remotion"), target: "src/remotion" },
  { source: path.join("src", "lib", "constants"), target: "src/lib/constants" },
  { source: path.join("src", "lib", "types"), target: "src/lib/types" },
  { source: path.join("src", "lib", "utils"), target: "src/lib/utils" },
];

const COPY_FILES = [
  {
    source: path.join("src", "lib", "server", "remotion-renderer.ts"),
    target: "src/lib/server/remotion-renderer.ts",
  },
  {
    source: path.join("src", "lib", "server", "temp-asset-server.ts"),
    target: "src/lib/server/temp-asset-server.ts",
  },
];

const normalizePath = (value: string) => value.split(path.sep).join("/");

const baseFileName = (name: string | undefined, fallbackId: string) => {
  if (name) {
    const base = name.replace(/\.[^.]+$/, "");
    if (base.trim().length > 0) {
      return base;
    }
  }
  return `subify-${fallbackId.slice(0, 6)}`;
};

const writeReadme = (sessionFile: string) =>
  [
    "# Subify Render Kit",
    "",
    "This folder contains everything you need to bake captions locally. Steps:",
    "",
    "1. Place your original video file inside this folder (same file you uploaded to Subify).",
    "2. Run `npm install` once to install the Remotion renderer dependencies.",
    `3. Run the CLI: \`npm run render:video -- --session ./${sessionFile} --input ./your-video.mp4 --out ./your-video-captions.mp4\`.`,
    "",
    "Rendering happens entirely on your machine using Remotion + FFmpeg. No Vercel server is involved.",
  ].join("\n");

const addFileToZip = async (zip: JSZip, absolute: string, relative: string) => {
  const data = await fs.readFile(absolute);
  zip.file(normalizePath(relative), data);
};

const addDirectoryToZip = async (zip: JSZip, absoluteDir: string, relativeDir: string) => {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const absolute = path.join(absoluteDir, entry.name);
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, absolute, relative);
    } else if (entry.isFile()) {
      await addFileToZip(zip, absolute, relative);
    }
  }
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const session = await readSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const kitZip = new JSZip();

  // Template scaffolding
  for (const templateFile of TEMPLATE_FILES) {
    await addFileToZip(
      kitZip,
      path.join(TEMPLATE_DIR, templateFile),
      templateFile,
    );
  }

  // Copy shared directories from the repo
  for (const mapping of COPY_DIRECTORIES) {
    const absolute = path.join(process.cwd(), mapping.source);
    await addDirectoryToZip(kitZip, absolute, mapping.target);
  }

  // Copy specific files
  for (const mapping of COPY_FILES) {
    await addFileToZip(
      kitZip,
      path.join(process.cwd(), mapping.source),
      mapping.target,
    );
  }

  const baseName = baseFileName(session.videoMetadata?.name, session.id);
  const sessionFileName = `${baseName}-session.json`;
  const captionsFileName = `${baseName}-captions.json`;

  kitZip.file(
    sessionFileName,
    JSON.stringify(
      {
        id: session.id,
        captions: session.captions,
        stylePreset: session.stylePreset,
        placement: session.placement,
        duration: session.duration,
        language: session.language,
      },
      null,
      2,
    ),
  );
  kitZip.file(
    captionsFileName,
    JSON.stringify(session.captions, null, 2),
  );
  kitZip.file(`${baseName}.srt`, captionsToSrt(session.captions));
  kitZip.file(`${baseName}.vtt`, captionsToVtt(session.captions));
  kitZip.file("README.txt", writeReadme(sessionFileName));

  const archive = await kitZip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(archive as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${baseName}-render-kit.zip"`,
    },
  });
}
