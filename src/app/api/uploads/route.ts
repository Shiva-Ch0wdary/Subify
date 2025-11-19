import { NextResponse } from "next/server";
import { createUploadUrl, del } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { url, id } = await createUploadUrl({ access: "public" });
    return NextResponse.json({ uploadUrl: url, blobId: id });
  } catch (error) {
    console.error("[uploads:create-url]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create upload URL." },
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
