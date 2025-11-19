import "server-only";

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { head as blobHead, put as blobPut } from "@vercel/blob";
import type {
  CaptionSession,
  CaptionPlacement,
  CaptionStylePreset,
  CaptionSegment,
  SessionVideoMetadata,
} from "@/lib/types/captions";

const USE_BLOB_STORAGE = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const STORAGE_ROOT = (() => {
  if (USE_BLOB_STORAGE) {
    return "";
  }
  if (process.env.SUBIFY_STORAGE_ROOT) {
    return process.env.SUBIFY_STORAGE_ROOT;
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "subify-storage");
  }
  return path.join(process.cwd(), "storage");
})();
const SESSIONS_DIR = USE_BLOB_STORAGE ? "" : path.join(STORAGE_ROOT, "sessions");

const sessionBlobPath = (id: string) => `sessions/${id}.json`;

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const sessionPath = (id: string) => path.join(SESSIONS_DIR, `${id}.json`);

export const ensureStorage = async () => {
  if (USE_BLOB_STORAGE) return;
  await ensureDir(SESSIONS_DIR);
};

export const readSession = async (id: string): Promise<CaptionSession | null> => {
  if (USE_BLOB_STORAGE) {
    try {
      const head = await blobHead(sessionBlobPath(id), {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const response = await fetch(head.downloadUrl ?? head.url);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as CaptionSession;
    } catch (error) {
      if ((error as Error).message?.includes("not found")) {
        return null;
      }
      throw error;
    }
  }
  try {
    const file = await fs.readFile(sessionPath(id), "utf8");
    return JSON.parse(file) as CaptionSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const saveSession = async (session: CaptionSession) => {
  if (USE_BLOB_STORAGE) {
    await blobPut(sessionBlobPath(session.id), JSON.stringify(session, null, 2), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await ensureStorage();
  await fs.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
};

type SessionUpdate = Partial<
  Pick<
    CaptionSession,
    "captions" | "stylePreset" | "placement" | "duration" | "language" | "videoMetadata"
  >
>;

export const updateSession = async (id: string, patch: SessionUpdate) => {
  const existing = await readSession(id);
  if (!existing) {
    throw new Error("Session not found.");
  }
  const updated: CaptionSession = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveSession(updated);
  return updated;
};

export const createSessionRecord = ({
  id,
  captions,
  stylePreset,
  placement,
  duration,
  language,
  videoMetadata,
}: {
  id: string;
  captions: CaptionSegment[];
  stylePreset: CaptionStylePreset;
  placement: CaptionPlacement;
  duration: number;
  language?: string;
  videoMetadata?: SessionVideoMetadata;
}): CaptionSession => {
  const now = new Date().toISOString();
  return {
    id,
    captions,
    stylePreset,
    placement,
    duration,
    language,
    videoMetadata,
    createdAt: now,
    updatedAt: now,
  };
};
