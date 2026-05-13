import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  banner: { js: "#!/usr/bin/env node" },
});
