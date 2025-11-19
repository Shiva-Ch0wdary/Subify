# Subify - AI Captioning Studio

Subify lets creators upload short-form video, generate Hinglish captions with OpenAI Whisper, style them in Remotion, and export both the rendered MP4 and clean subtitle files (SRT/VTT). Everything runs on a local-first storage model so raw videos never touch the deployment filesystem.

## Highlights

- **Next.js 16 + App Router** with server actions for uploads, session storage, and Remotion rendering.
- **OpenAI Whisper (gpt-4o-mini-transcribe)** for super accurate Hinglish transcripts with segment + word timing.
- **Remotion studio** exposes three caption presets, three placements, and a real-time preview powered by `@remotion/player`.
- **Download hub** offers MP4, `.srt`, `.vtt`, or a zipped bundle, no re-rendering required.
- **Local-first privacy**: uploads stay inside the browser’s IndexedDB and are streamed to the server only during transcription/export.

## Architecture Snapshot

| Concern | Implementation |
| --- | --- |
| UI / Routing | Next.js App Router, React Server Components, Tailwind CSS v4 |
| Rendering | Remotion (`@remotion/player`, `@remotion/renderer`) |
| Speech-to-Text | OpenAI Whisper via `openai` SDK |
| Persistence | JSON session store under `storage/` + browser IndexedDB for raw media |
| Deployment Target | Vercel / Node.js 20 serverless functions |

## Prerequisites

- Node.js 20+
- npm 10+
- OpenAI account + Whisper API key (`OPENAI_API_KEY`)

## Setup

```bash
git clone <repo>
cd Subify
npm install
cp .env.local   # provide OPENAI_API_KEY
npm run dev
```

Visit `http://localhost:3000` and drop an `.mp4` (≤300 MB) to get started.

## Workflow

1. **Upload** - the landing page validates the file, stores it in IndexedDB, uploads the file to Vercel Blob via `/api/uploads`, and POSTs the blob reference to `/api/sessions` for Whisper transcription.
2. **Studio** - `/studio/[sessionId]` loads captions, lets you switch styles/placements, and previews everything in Remotion.
3. **Export** - clicking *Export MP4* triggers the same blob upload flow and sends the reference to `/api/sessions/[id]/export`. Remotion renders the composition on the server and returns the MP4 stream; the resulting blob is cached locally.
4. **Download hub** - after export the app redirects to `/download/[sessionId]` where you can grab:
   - MP4 with burned-in captions
   - `.srt` and `.vtt` sidecar files (generated client-side)
   - A `.zip` bundle containing MP4 + both subtitle formats

You can always hop back into the studio to change styles and export again.

## Subtitle generation

Sanitized `CaptionSegment`s feed two helpers (`captionsToSrt`, `captionsToVtt`) in `src/lib/utils/subtitles.ts`. They normalize timestamps, handle multiline content, and ensure WebVTT + SRT specs are met. The helpers power both individual downloads and the bundle workflow.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js locally with hot reload.
| `npm run build` / `npm start` | Production build + serve.
| `npm run lint` | ESLint across the entire project.
| `npm run render:sample` | CLI Remotion render using `assets/sample-captions.json` → `out/sample-output.mp4`.

## Deployment notes

- **Environment** - set `OPENAI_API_KEY` and `BLOB_READ_WRITE_TOKEN` in your hosting provider. The Blob token is required for signing upload URLs and purging temporary files.
- **Storage** - the repo ships with empty `storage/sessions/.gitkeep` and `storage/renders/.gitkeep`. At runtime these directories persist caption metadata only; raw uploads never land here.
- **Blob uploads** - enable [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) for the project; the `/api/uploads` route mints signed URLs so large videos never hit the serverless body-size limit.
- **Static assets** - sample media lives in `assets/` + `public/samples/` strictly for demos/testing.
- **Cleaning** - no generated exports or session JSONs are committed, keeping the repo production-ready.

Once deployed, the workflow remains identical: uploads stay local to the browser, Whisper runs inside your serverless region, and rendered MP4/subtitle downloads are delivered through the download hub.


## Contribution

We welcome contributions to enhance our Subify. Please submit pull requests with detailed descriptions of proposed changes.

## Contact Us

For any questions, feedback, or collaboration opportunities, feel free to reach out to us:

- Mandapudi. Shiva Rama Krishna  
- **Email**: shivachowdary753@gmail.com

We’d love to hear your thoughts and suggestions on the project!

Happy captioning! 🎬
