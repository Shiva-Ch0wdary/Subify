# Video Rendering on Vercel - Operations Notes

## Current Status

Server-side rendering is **enabled** again for the `/api/sessions/[sessionId]/export` route. The function now bundles the Remotion compositor binaries that ship with `@remotion/renderer`, so Vercel’s Node.js runtime can execute the renders directly.

> **Note:** The linux compositor (`@remotion/compositor-linux-x64-gnu`) is vendored under `vendor/remotion/` and referenced from `package.json`. This guarantees that builds performed on Windows (or any non-linux machine) still include the linux binary Vercel needs.

## Deployment Requirements

1. **Linux-native compositor packages**

   - Vercel installs the `@remotion/compositor-*-linux-*` packages during `npm install`.
   - `next.config.ts` enumerates every Remotion native package in `serverExternalPackages` and `outputFileTracingIncludes` so the binaries are copied into the serverless bundle.

2. **Node.js runtime**

   - `export` route uses `runtime = "nodejs"` with 1024 MB / 300 s limits (see `vercel.json`). Increase the memory if exports regularly exceed the current limit.

3. **Temp storage**

   - Renders stream to `/tmp`. The handler deletes temp files via `deleteWithRetries` to stay within the Lambda 512 MB writeable storage cap.
   - `REMOTION_DATA_DIR` and `REMOTION_CACHE_LOCATION` are set to `/tmp` directories to prevent Remotion from attempting to write to read-only `/var/task/node_modules/.remotion`.

4. **Fonts and assets**
   - `remotion/fonts.ts` is executed before bundling to ensure caption fonts exist.
   - Public assets and bundler favicon are force-traced to avoid ENOENT errors.

## Redeploy Checklist

1. `npm ci && npm run lint && npm run build`
2. `vercel deploy` (or trigger via Git) so Next.js re-traces dependencies in the Linux build environment.
3. After deploy, run a test export from `/studio/:sessionId` and watch the Vercel function logs for `[remotion]` output.

## Troubleshooting

| Symptom                                                                       | Likely Cause                                     | Fix                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `ENOENT: no such file or directory, mkdir '/var/task/node_modules/.remotion'` | Remotion trying to write to read-only filesystem | Ensure `REMOTION_DATA_DIR=/tmp/remotion-data` is set in environment variables              |
| `ENOENT @remotion/compositor-*`                                               | Missing native package in bundle                 | Confirm the package exists on Vercel build host and that `serverExternalPackages` lists it |
| `favicon.ico` ENOENT                                                          | Bundler asset not traced                         | Already mitigated via fallback copy in `remotion-renderer.ts`; re-run deploy               |
| `Socket hang up` / timeout                                                    | Render exceeded 300 s                            | Raise `maxDuration` or reduce export resolution/FPS                                        |

## Alternatives

If renders still hit platform limits, consider:

1. **Remotion Lambda** for horizontal scaling (https://www.remotion.dev/docs/lambda).
2. **Dedicated container/VM** with FFmpeg (Render, Railway, Fly.io, etc.).
3. **Client-side rendering** via `@remotion/player` for lightweight workloads.

For now, exports should complete on Vercel as long as the above requirements are met.
