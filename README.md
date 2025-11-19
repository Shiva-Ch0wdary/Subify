# Remotion Captioning Platform

Upload `.mp4` files, auto-generate Hinglish captions with OpenAI Whisper, preview three caption styles in Remotion, adjust placement, and export the final video as a downloadable MP4.

## Overview

- **Upload → Generate → Studio → Export** workflow powered by Next.js App Router.
- **`POST /api/sessions`** uploads the video, runs Whisper (gpt-4o-mini-transcribe), stores captions, and returns a shareable session id.
- **Caption Studio (`/studio/[sessionId]`)** replays the video in Remotion Player, exposes style + placement controls, and persists the selection.
- **`POST /api/sessions/[id]/export`** renders the Remotion composition on the server and returns an MP4 download URL inside `public/exports`.
- **Three presets + three placement anchors** (bottom, middle, top) guarantee readable Hinglish subtitles with bundled Noto fonts.
- **Sample assets** plus CLI command `npm run render:sample` still ship for quick offline testing.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Caption Rendering | Remotion + `@remotion/player` / `@remotion/renderer` |
| Speech-to-Text | OpenAI Whisper API (`gpt-4o-mini-transcribe`) |
| State & Utils | React Hooks, light-weight session store, Zod-ready schema utils |
| Deployment | Vercel (Node.js 20 runtime) |

## Getting Started

```bash
git clone <repo>
cd remotion-captioning-platform
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the UI.

## Environment Variables

| Key | Description |
| --- | --- |
| `OPENAI_API_KEY` | Server-side key for Whisper (gpt-4o-mini-transcribe). Required for `/api/sessions` and `/api/generate-captions`. |

> Never expose this key to the browser. Both API routes stream uploads directly to OpenAI from the Node runtime.

## Caption Generation Method

1. Client uploads `.mp4`, validating size (< 300 MB) and type before hitting the server.
2. `POST /api/sessions` (or `/api/generate-captions` for raw transcripts) parses multipart form data, persists the upload to `public/uploads`, and rehydrates a Node-friendly `File`.
3. OpenAI SDK call:

   ```ts
   const transcription = await openai.audio.transcriptions.create({
     file,
     model: "gpt-4o-mini-transcribe",
     response_format: "verbose_json",
     timestamp_granularities: ["segment", "word"],
     temperature: 0.2,
   });
   ```

4. The response normalizes to:

   ```ts
   type CaptionSegment = {
     id: number;
     start: number; // seconds
     end: number;
     text: string; // Hinglish-safe
     words?: { id: number; text: string; start: number; end: number }[];
   };
   ```

5. Karaoke timing is auto-generated when word timestamps are missing by distributing the segment duration across tokens.

## Using the App

1. **Upload** an `.mp4` on the landing page. Optional: pre-select a style + placement.
2. Click **Generate & open studio**. This calls `POST /api/sessions`, uploads the file, runs Whisper, and returns a session id.
3. The app redirects to `/studio/[sessionId]`, where the Remotion Player previews your uploaded video with live captions.
4. **Adjust** the caption style (Standard, Top Bar, Karaoke) and placement (bottom, middle, top). Changes persist via `PATCH /api/sessions/[id]`.
5. Hit **Export MP4** to invoke `POST /api/sessions/[id]/export`. Once rendering completes, a download button appears.

### Caption Style & Placement Presets

| Preset | Description |
| --- | --- |
| `standard` | Bottom-center translucent pill. Ideal for social subtitles. |
| `topBar` | Full-width news ticker with uppercase text, suited for reels or highlight text. |
| `karaoke` | Word-by-word highlight using per-word timestamps or synthetic interpolation. |

| Placement | Description |
| --- | --- |
| `bottom` | Sticks to lower safe area for traditional subtitles. |
| `middle` | Floats captions mid-frame to avoid lower-third graphics. |
| `top` | Anchors near the top safe area, ideal for reels. |

Fonts (`Noto Sans`, `Noto Sans Devanagari`, `Space Grotesk`) are registered on both the web client and Remotion CLI to preserve Hinglish glyph fidelity.

## Export Options

### In-app MP4 export

- Use the **Export MP4** button on `/studio/[sessionId]`.
- The server bundles `remotion/Root.tsx`, renders `CaptionComposition` with your session props, and saves the video to `public/exports/<session>.mp4`.
- The API responds with `downloadUrl`, which the UI exposes via a download button.

### CLI render (sample props)

1. Ensure `assets/sample-captions.json` references the desired captions/video (default: `public/samples/sample-input.mp4`).
2. Run:

   ```bash
   npm run render:sample
   # Outputs out/sample-output.mp4
   ```

This command is useful for CI or bulk renders from a saved props JSON.

## Deployment (Vercel)

1. Push the repo to GitHub.
2. In Vercel, **Create Project** → import the repo.
3. Set **Environment Variables** → `OPENAI_API_KEY`.
4. Use Node.js 20 runtime (default).  
5. Deploy. Serverless functions `/api/sessions` and `/api/generate-captions` handle Whisper requests; ensure the region you pick is close to OpenAI for lower latency.

## Sample Inputs & Outputs

- `assets/sample-input.mp4` — bundled demo clip (duplicated to `public/samples/sample-input.mp4` for browser preview).
- `assets/sample-output.mp4` — placeholder render; running `npm run render:sample` refreshes it with the latest caption props.
- `assets/sample-captions.json` — ready-to-use CLI props referencing the sample video and default Standard preset.

## Optional Offline Whisper

If you need completely offline transcription, Whisper.cpp or `faster-whisper` can replace the API route. You would upload the video, transcode to 16 kHz mono, run a local model, and feed the response through the same normalization helper used in this repo. This is not implemented here but is compatible with the existing API contract.

## Testing & Sign-off Checklist

- [ ] Upload `.mp4` (sample or custom) works and previews instantly.
- [ ] Whisper API returns accurate Hinglish captions.
- [ ] All three caption presets + placements visibly update the Remotion Player overlay.
- [ ] CLI command `npm run render:sample` outputs `out/sample-output.mp4`.
- [ ] README + `/docs` route explain the architecture and export flow.
- [ ] Deployment on Vercel completes with environment variables configured.
- [ ] Sample input/output assets exist in `/assets` and are referenced in docs.

Happy captioning!
