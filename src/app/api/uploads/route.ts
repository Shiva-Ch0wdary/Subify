import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Blob uploads are disabled in this environment. Set BLOB_READ_WRITE_TOKEN to enable server uploads.",
        },
        { status: 501 },
      );
    }
    const body = await request.json();
    const result = await handleUpload({
      request,
      body,
      token,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "video/mp4",
          "video/quicktime",
          "video/mpeg",
          "audio/mp4",
          "audio/mpeg",
        ],
        maximumSizeInBytes: 400 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[uploads:handle]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process upload." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const blobUrl = searchParams.get("url");
    if (!blobUrl) {
      return NextResponse.json({ error: "Missing blob URL." }, { status: 400 });
    }
    await del(blobUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[uploads:delete]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete blob." },
      { status: 500 },
    );
  }
}
