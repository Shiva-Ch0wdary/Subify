"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CaptionSession } from "@/lib/types/captions";
import { captionsToSrt, captionsToVtt } from "@/lib/utils/subtitles";

type DownloadShellProps = {
  session: CaptionSession;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const baseFileName = (session: CaptionSession) =>
  session.videoMetadata?.name?.replace(/\.[^.]+$/, "") ??
  `subify-${session.id.slice(0, 6)}`;

export const DownloadShell = ({ session }: DownloadShellProps) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBundling, setIsBundling] = useState(false);
  const baseName = useMemo(() => baseFileName(session), [session]);
  const renderCommand = useMemo(
    () =>
      `npm install\nnpm run render:video -- --session ./${baseName}-session.json --input ./path/to/video.mp4 --out ./${baseName}-captions.mp4`,
    [baseName],
  );

  const captionsJson = useMemo(
    () => JSON.stringify(session.captions, null, 2),
    [session.captions]
  );
  const sessionJson = useMemo(
    () =>
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
        2
      ),
    [session]
  );
  const srtContent = useMemo(
    () => captionsToSrt(session.captions),
    [session.captions]
  );
  const vttContent = useMemo(
    () => captionsToVtt(session.captions),
    [session.captions]
  );

  const downloadTextFile = (
    content: string,
    fileName: string,
    mime = "text/plain"
  ) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    downloadBlob(blob, fileName);
  };

  const handleDownloadRenderKit = async () => {
    setIsBundling(true);
    setStatusMessage("Building render kit…");
    try {
      const response = await fetch(`/api/render-kit/${session.id}`);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to build render kit.");
      }
      const blob = await response.blob();
      downloadBlob(blob, `${baseName}-render-kit.zip`);
      setStatusMessage(
        "Render kit downloaded. Unzip it, drop in your video, run npm install, then npm run render:video."
      );
    } catch (error) {
      console.error("Failed to download render kit", error);
      setStatusMessage("Unable to download render kit. Please try again.");
    } finally {
      setIsBundling(false);
    }
  };

  return (
    <div className="grid gap-7">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-slate-900/70 to-purple-900/40 p-8 text-white shadow-[0_35px_120px_rgba(79,70,229,0.35)]">
        <p className="text-xs uppercase tracking-[0.4em] text-indigo-200/80">
          Subify
        </p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          Download your caption assets
        </h1>
        <p className="mt-4 text-base text-white/80 sm:text-lg">
          Server-side rendering is disabled on Vercel. Grab your caption files
          and render locally with the provided CLI.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="flex flex-col rounded-3xl border border-white/10 bg-black/50 p-6 text-white backdrop-blur">
          <div className="space-y-2">
            <p className="text-lg font-semibold">Caption data (JSON)</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>Download captions as structured JSON.</li>
              <li>Perfect for the local Remotion renderer or other tools.</li>
            </ul>
          </div>
          <div className="mt-auto grid gap-3">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  captionsJson,
                  `${baseName}-captions.json`,
                  "application/json"
                )
              }
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30"
            >
              Download captions.json
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  sessionJson,
                  `${baseName}-session.json`,
                  "application/json"
                )
              }
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30"
            >
              Download session.json
            </button>
          </div>
        </article>

        <article className="flex flex-col rounded-3xl border border-white/10 bg-black/50 p-6 text-white backdrop-blur">
          <div className="space-y-2">
            <p className="text-lg font-semibold">Subtitle files (SRT & VTT)</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>Ready for YouTube, Premiere Pro, or any caption editor.</li>
            </ul>
          </div>
          <div className="mt-auto grid gap-3">
            <button
              type="button"
              onClick={() => downloadTextFile(srtContent, `${baseName}.srt`)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30"
            >
              Download .srt
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(vttContent, `${baseName}.vtt`)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30"
            >
              Download .vtt
            </button>
          </div>
        </article>

        <article className="flex flex-col rounded-3xl border border-white/10 bg-black/50 p-6 text-white backdrop-blur">
          <div className="space-y-2">
            <p className="text-lg font-semibold">Local render kit</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>ZIP containing session + captions + README instructions.</li>
              <li>
                Use with <code className="font-mono">npm run render:video</code>
                .
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={handleDownloadRenderKit}
            disabled={isBundling}
            className="mt-auto inline-flex items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-r from-purple-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_65px_rgba(99,102,241,0.45)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBundling ? "Creating kit…" : "Download render kit"}
          </button>
        </article>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/40 p-6 text-white">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-base font-semibold">Render locally</p>
            <p className="text-sm text-white/70">
              Use the CLI to bake captions into your MP4 without relying on Vercel’s
              serverless runtime.
            </p>
            <div className="relative rounded-2xl border border-white/10 bg-black/60 p-4 text-xs text-white/80">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(renderCommand)}
                className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-white/30"
              >
                Copy
              </button>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words pe-20 text-xs text-white/80">
{renderCommand}
              </pre>
            </div>
            <p className="text-xs text-white/60">
              Run this command from your Subify project root (the folder with package.json). The
              video file should be the same one you uploaded to Subify. Rendering happens 100% on
              your machine via Remotion + FFmpeg.
            </p>
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-white/10 bg-black/40 p-6 text-white">
      <div className="space-y-3">
            <p className="text-base font-semibold">Need to tweak captions?</p>
            <p className="text-sm text-white/70">
              Hop back into the studio to adjust styling or regenerate subtitles. Re-download the
              caption kit afterward.
            </p>
            <Link
              href={`/studio/${session.id}`}
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40"
            >
              Return to studio
            </Link>
          </div>
           {statusMessage && (
          <p className="mt-4 text-sm text-amber-200">{statusMessage}</p>
        )}
        </section>
    </div>
  );
};
