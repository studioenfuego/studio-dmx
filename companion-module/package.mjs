import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stage = "/tmp/companion-module-stage";
const out = resolve(__dirname, "companion-module-studio-dmx-1.0.0.tgz");

rmSync(stage, { recursive: true, force: true });
mkdirSync(`${stage}/package/companion`, { recursive: true });

copyFileSync(resolve(__dirname, "main.js"), `${stage}/package/main.js`);
copyFileSync(resolve(__dirname, "package.json"), `${stage}/package/package.json`);
copyFileSync(resolve(__dirname, "companion/manifest.json"), `${stage}/package/companion/manifest.json`);

execSync(`tar -czf "${out}" --no-xattrs package`, { cwd: stage });
rmSync(`${process.env.HOME}/Library/Application Support/companion/modules/studio-dmx-1.0.0`, {
  recursive: true,
  force: true,
});

console.log(`✓ Built: ${out}`);
console.log("✓ Cleared old install — ready to Import module package in Companion");
