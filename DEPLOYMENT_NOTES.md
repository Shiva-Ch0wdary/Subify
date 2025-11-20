# Video Rendering on Vercel - Important Information

## Current Status

**Server-side video rendering is DISABLED on Vercel** because Vercel's serverless functions cannot execute the native binaries required by `@remotion/renderer`.

## Why It Doesn't Work

Remotion's server-side rendering requires:

1. **FFmpeg binary** - Not available in Vercel's Lambda environment
2. **Native compositor binaries** - Platform-specific binaries that can't run in serverless
3. **High memory/CPU** - Video rendering is resource-intensive
4. **Long execution times** - Rendering can take minutes, exceeding serverless limits

## Solutions for Production

### Option 1: Use @remotion/lambda (Recommended)

Deploy rendering to AWS Lambda using Remotion's official Lambda package:

```bash
npm install @remotion/lambda
```

This requires:

- AWS account
- Lambda setup
- S3 bucket for assets
- Refactor rendering code to use Lambda API

**Docs**: https://www.remotion.dev/docs/lambda

### Option 2: Client-Side Rendering

Use `@remotion/player` to render videos in the browser:

```bash
npm install @remotion/player
```

Pros:

- Works on Vercel without changes
- No server costs for rendering

Cons:

- Slower rendering (browser-based)
- Client must stay on page during render
- Uses client's resources

### Option 3: Separate Rendering Service

Deploy a dedicated rendering server:

- Use Docker container with FFmpeg
- Deploy to Railway, Render, or AWS EC2
- Call rendering API from Vercel frontend

### Option 4: Different Hosting

Move entire application to:

- Railway.app
- Render.com
- AWS EC2/ECS
- Digital Ocean Droplets

These platforms support long-running processes and native binaries.

## Current Workaround

The export endpoint now returns a 501 (Not Implemented) error on Vercel with a helpful message. It still works locally for development.

## Recommended Next Steps

1. **Immediate**: Use client-side rendering with `@remotion/player`
2. **Production**: Implement `@remotion/lambda` for scalable cloud rendering
3. **Alternative**: Set up a dedicated rendering service

## Development vs Production

- **Local Development**: Server-side rendering works (FFmpeg available)
- **Vercel Deployment**: Server-side rendering disabled (returns 501 error)

You can test rendering locally with:

```bash
npm run dev
# Then use the export endpoint locally
```
