import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "main.js",
  format: "esm",
  platform: "node",
  target: "node22",
  // @companion-module/base IPC hooks into the process — must be bundled
  external: [],
  minify: false,
  sourcemap: false,
});
