# Subify · AI Captioning Studio

An end-to-end captioning workflow for short-form video. Subify lets creators upload an MP4, generate Hinglish subtitles with OpenAI Whisper, customize styles in a Remotion-powered studio, and export an MP4 alongside clean `.srt`/`.vtt` files—all while keeping source media local to the browser.

---

## Feature Highlights

- **Hinglish-first transcription** using `gpt-4o-mini-transcribe` with segment + word timestamps and automatic duration normalization.
- **Remotion studio** with real-time preview, three style presets, placement controls, and export parity between preview and server renders.
- **Download hub** that returns the rendered MP4, individual subtitle files, or a bundled ZIP with no extra render time.
- **Local-first privacy**: raw uploads and exports live in browser IndexedDB (`video-store`) and are streamed to the server only during transcription/export.
- **Robust upload pipeline** with temp storage in `/tmp`, resumable session metadata under `storage/`, and fallbacks when the temp endpoint is unavailable.

---

## Architecture at a Glance

| Layer | Details |
| --- | --- |
| UI & Routing | Next.js 16 App Router, React Server Components, Suspense-ready client shells |
| Styling | Tailwind CSS v4 with utility-first gradients + glassmorphism components |
| Transcription | OpenAI Whisper via the `openai` SDK (`transcribeToCaptions` in `src/lib/server/transcription.ts`) |
| Rendering | Remotion (`@remotion/player`, `@remotion/renderer`) compositions defined in `remotion/` |
| Persistence | Browser IndexedDB for media blobs + JSON session store under `storage/sessions` |
| Downloads | Subtitle helpers (`captionsToSrt`, `captionsToVtt`) and ZIP packaging via `JSZip` |
| Deployment | Dockerized Node.js 20 image with FFmpeg, designed for Railway or any container host |

See `src/app/docs` for an in-app walkthrough of the same flow.

---

## Getting Started

### Prerequisites

- Node.js 20+ and npm 10+
- OpenAI account with Whisper transcription access (`OPENAI_API_KEY`)
- macOS/Linux/WSL when rendering locally (FFmpeg + headless Chrome requirements)

### Local Development

```bash
git clone <repo-url>
cd Subify
npm install
cp .env.local   # add OPENAI_API_KEY
npm run dev
```

Visit `http://localhost:3000`, drop an MP4 (≤300 MB), and follow the upload → studio → download flow.

### Production Build

```bash
npm run build    # bundles Remotion via scripts/bundle-remotion.mjs
npm start        # serves the Next.js production build
```

`npm run build` validates that `.remotion-bundle/` exists so the server can render without a dev server. The startup script re-checks this before running `npm start`.

---

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | ✅ | Used by the Whisper transcription client. Without it, uploads fail fast. |
| `OPENAI_TRANSCRIBE_MODEL` | Optional | Override the default `gpt-4o-mini-transcribe` model string. |
| `SUBIFY_STORAGE_ROOT` | Optional | Custom path for session JSON. Defaults to `./storage` locally and `/tmp/subify-storage` on Vercel/Railway. |
| `SUBIFY_UPLOAD_TTL_MS` | Optional | Milliseconds before temp uploads in `/tmp/subify-upload-cache` expire. Defaults to 30 minutes. |
| `PORT` | Optional | Honored by the `npm start` script and Docker entrypoint (Railway sets this automatically). |

Copy `.env.local.example` to `.env.local` and keep secrets outside version control.

---

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js with hot reload. |
| `npm run lint` | Run ESLint (configured via `eslint.config.mjs`). |
| `npm run bundle:remotion` | Manually pre-bundle Remotion to `.remotion-bundle/`. Included inside `npm run build`. |
| `npm run build` | Run the Remotion bundle step and compile the Next.js production output. |
| `npm run start` | Serve the production build on `${PORT:-3000}`. |
| `npm run render:sample` | CLI render of `CaptionComposition` using `assets/sample-captions.json` → `out/sample-output.mp4`. |
| `npm run render` | Raw `remotion render` passthrough for custom jobs. |

The `scripts/startup.sh` guard ensures Remotion assets exist before serving traffic.

---

## Data Flow

1. **Upload (`/` + `HomeShell`)**  
   Client-side validation enforces MP4 + 300 MB limits. Files are saved to IndexedDB, streamed to `/api/uploads`, and posted to `/api/sessions` alongside style/placement metadata. If the temp endpoint fails, the UI falls back to direct multipart form uploads.

2. **Transcription (`/api/sessions`, `/api/generate-captions`)**  
   Server routes validate type/size, call `transcribeToCaptions`, and persist a `CaptionSession` JSON record with normalized segments, duration, language, and video metadata.

3. **Studio (`/studio/[sessionId]`)**  
   `StudioShell` hydrates the saved session, exposes Remotion-powered previews, allows restyling, and triggers exports. Rendered MP4 blobs are cached locally via `saveSessionExport` so re-downloads never hit the server.

4. **Download (`/download/[sessionId]`)**  
   Users can download the MP4 (with baked captions), `.srt`, `.vtt`, or a ZIP bundle built with `JSZip`. Subtitle files rely on `captionsToSrt`/`captionsToVtt` to keep timing accurate.

---

## Storage & Privacy

- **Browser IndexedDB**: `video-store` (original uploads) and `exports` (rendered MP4) ensure raw footage never touches persistent server storage.
- **Server session store**: JSON metadata lives under `storage/sessions/` (configurable via `SUBIFY_STORAGE_ROOT`). Git keeps this directory empty by default.
- **Temp uploads**: `/tmp/subify-upload-cache` (or OS temp dir) holds short-lived binaries referenced by `uploadId`.
- **Rendering artifacts**: Remotion writes intermediate files inside `/tmp` and deletes them after the export completes.

---

## Docker & Railway Deployment

1. **Build the container**

   ```bash
   docker build -t subify .
   ```

   The image installs FFmpeg plus the headless Chrome dependencies Remotion needs. `npm ci` + `npm run build` run during the image build, so deployments boot instantly.

2. **Run locally**

   ```bash
   docker run --rm -p 3000:3000 \
     -e OPENAI_API_KEY=sk-... \
     subify
   ```

3. **Railway**
   - Connect the repo and let Railway auto-detect the `Dockerfile`.
   - Set `OPENAI_API_KEY` (and optional overrides such as `SUBIFY_STORAGE_ROOT` or `SUBIFY_UPLOAD_TTL_MS`).
   - No start command configuration is required—the container executes `scripts/startup.sh`, which finally launches `npm run start` on `$PORT`.

Because everything rides on Docker, the same image can be deployed to Fly.io, Render, AWS ECS, etc., with zero changes.

---

## Contribution

We welcome contributions to enhance our Subify. Please submit pull requests with detailed descriptions of proposed changes.

## Contact Us

For any questions, feedback, or collaboration opportunities, feel free to reach out to us:

- Mandapudi. Shiva Rama Krishna  
- **Email**: shivachowdary753@gmail.com

We’d love to hear your thoughts and suggestions on the project!

Happy captioning! 🎬
