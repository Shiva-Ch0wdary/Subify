import "server-only";

import path from "path";
import type { CaptionCompositionProps } from "@/lib/types/captions";

const REMOTION_ENTRY = path.join(process.cwd(), "remotion", "Root.tsx");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const SRC_DIR = path.join(process.cwd(), "src");

type RendererModule = typeof import("@remotion/renderer");
type BundlerModule = typeof import("@remotion/bundler");

type MutableWebpackConfig = {
  resolve?: {
    alias?: Record<string, string>;
    extensions?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type RemotionModules = {
  bundle: BundlerModule["bundle"];
  renderMedia: RendererModule["renderMedia"];
  selectComposition: RendererModule["selectComposition"];
};

let remotionModulesPromise: Promise<RemotionModules> | null = null;
let serveUrlPromise: Promise<string> | null = null;

const loadRemotionModules = () => {
  if (!remotionModulesPromise) {
    remotionModulesPromise = (async () => {
      const [{ bundle }, renderer] = await Promise.all([
        import("@remotion/bundler"),
        import("@remotion/renderer"),
      ]);
      const { renderMedia, selectComposition } = renderer;
      return { bundle, renderMedia, selectComposition };
    })().catch((error) => {
      remotionModulesPromise = null;
      throw error;
    });
  }
  return remotionModulesPromise;
};

const applyWebpackAlias = (config: MutableWebpackConfig) => {
  config.resolve ??= {};
  config.resolve.alias = {
    ...(config.resolve.alias ?? {}),
    "@": SRC_DIR,
  };
  config.resolve.extensions = Array.from(
    new Set([...(config.resolve.extensions ?? []), ".ts", ".tsx", ".js", ".jsx", ".mjs"]),
  );
  return config;
};

const bundleRemotionProject = async () => {
  if (!serveUrlPromise) {
    serveUrlPromise = loadRemotionModules()
      .then(({ bundle }) =>
        // The bundler typings still expect the legacy positional arguments signature.
        // Cast to `any` so we can use the modern options object without type noise.
        (bundle as unknown as (options: Record<string, unknown>) => Promise<string>)({
          entryPoint: REMOTION_ENTRY,
          publicDir: PUBLIC_DIR,
          webpackOverride: applyWebpackAlias,
        }),
      )
      .catch((error) => {
        serveUrlPromise = null;
        throw error;
      });
  }

  return serveUrlPromise;
};

export const renderCaptionVideo = async (
  props: CaptionCompositionProps,
  outputLocation: string,
) => {
  const [modules, serveUrl] = await Promise.all([
    loadRemotionModules(),
    bundleRemotionProject(),
  ]);

  const composition = await modules.selectComposition({
    serveUrl,
    id: "CaptionComposition",
    inputProps: props,
  });

  await modules.renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    audioCodec: "aac",
    outputLocation,
    inputProps: props,
    overwrite: true,
    onProgress: (progress) => {
      if (process.env.NODE_ENV !== "production") {
        const percentage = (progress.progress * 100).toFixed(1);
        console.log(`[remotion][render] ${percentage}% complete`);
      }
    },
  });
};
