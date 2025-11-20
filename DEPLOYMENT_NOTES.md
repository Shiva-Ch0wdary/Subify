# Video Rendering on Vercel – Local Render Flow

## Current Status

Vercel’s serverless functions cannot execute the native FFmpeg/compositor stack that Remotion requires, so the `/api/sessions/[sessionId]/export` endpoint intentionally returns a `501` with guidance. The in-app “Export Video” CTA now routes users to the Download hub where they can pull captions in JSON/SRT/VTT form or download a ready-to-use **render kit**.

## Render Workflow

1. **Upload & edit on Vercel** – Users upload a (small) demo video, generate captions, tweak styles/placement, and preview inside the browser using `@remotion/player`.  
2. **Download caption artifacts** – The Download page exposes:
   - `captions.json` (segments only)  
   - `session.json` (captions + styling metadata)  
   - `.srt` / `.vtt` subtitle files  
   - A `render-kit.zip` that bundles everything with a README.
3. **Local rendering (developers/evaluators)** – Run the new CLI helper:

   ```bash
   npm install
   npm run render:video -- --session ./downloads/<sessionId>-session.json --input ./path/to/video.mp4 --out ./my-video-captions.mp4
   ```

   This script (`scripts/render-video.ts`) spins up the existing Remotion renderer locally, serves the input video via the temp asset server, and bakes captions into the MP4 without touching Vercel.

## Repository Notes

- The linux compositor package (`@remotion/compositor-linux-x64-gnu`) is vendored under `vendor/remotion/` and referenced via `file:` in `package.json` so Remotion has the required binary even when the repo is installed on non-Linux machines. Vercel still installs it because the `file:` reference resolves during the build.
- The CLI uses `tsx` to execute TypeScript directly. Ensure `npm install` runs before `npm run render:video`.
- `src/app/api/sessions/[sessionId]/export/route.ts` returns a descriptive error that points users to the local workflow. Do **not** re-enable server-side rendering on Vercel unless migrating to an environment with FFmpeg support (Remotion Lambda, Render, Railway, etc.).
- Blob uploads are optional. Set `BLOB_READ_WRITE_TOKEN` **and** `NEXT_PUBLIC_ENABLE_BLOB_UPLOADS=true` when you want users to upload to Vercel Blob storage. Without those env vars, the UI automatically falls back to direct form uploads and local browser storage (no server token required).
- The Download page now calls `/api/render-kit/:sessionId`, which copies the Remotion/CLI files from `render-kit-template` plus session-specific assets into a ZIP. Users can unzip, run `npm install`, drop in their video, then `npm run render:video` without cloning the full repo.

## How To Produce a Render Now

1. Visit `/download/:sessionId` and click **Download render kit**.  
2. Place the downloaded JSON + caption files in the same folder as the original video (the file uploaded to Subify).  
3. Run `npm run render:video -- --session ./session.json --input ./video.mp4 --out ./video-captions.mp4`.  
4. Share the generated MP4 manually (via Drive, S3, etc.).

This workflow keeps the editing UX on Vercel while avoiding unreliable serverless rendering.
