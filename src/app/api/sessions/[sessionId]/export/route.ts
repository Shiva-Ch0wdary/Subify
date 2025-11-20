import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return NextResponse.json(
    {
      error:
        "Server-side rendering is disabled on Vercel. Please render locally using the Remotion CLI helper.",
      instructions: [
        "Download the caption JSON/SRT/VTT bundle from the Download page.",
        `Run: npm run render:video -- --session ./downloads/${sessionId}.json --input ./path/to/video.mp4 --out ./output-with-captions.mp4`,
      ],
    },
    { status: 501 },
  );
}
