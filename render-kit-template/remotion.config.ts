import { Config } from "@remotion/cli/config";
import path from "path";

const ROOT_DIR = process.cwd();
const REMOTION_DIR = path.join(ROOT_DIR, "remotion");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

Config.setEntryPoint(path.join(REMOTION_DIR, "Root.tsx"));
Config.setOutputLocation("out");
Config.overrideWebpackConfig((currentConfiguration) => {
  currentConfiguration.resolve = currentConfiguration.resolve ?? {};
  currentConfiguration.resolve.alias = {
    ...(currentConfiguration.resolve.alias ?? {}),
    "@": path.join(ROOT_DIR, "src"),
  };
  currentConfiguration.resolve.extensions = Array.from(
    new Set([...(currentConfiguration.resolve.extensions ?? []), ".ts", ".tsx", ".js", ".jsx"]),
  );
  return currentConfiguration;
});

if (!process.env.REMOTION_PUBLIC_DIR) {
  Config.setDefaultPublicDir(PUBLIC_DIR);
}
