import { NextRequest } from "next/server";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ICON_DIR = path.join(process.cwd(), "public", "fixture-icons");

export async function GET() {
  await mkdir(ICON_DIR, { recursive: true });
  const files = await readdir(ICON_DIR);
  const icons = files
    .filter((f) => f.toLowerCase().endsWith(".svg"))
    .sort()
    .map((f) => `/fixture-icons/${f}`);
  return Response.json(icons);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
    return Response.json({ error: "Only SVG files are supported" }, { status: 400 });
  }

  const baseName = file.name.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  let filename = `${baseName}.svg`;

  await mkdir(ICON_DIR, { recursive: true });
  const existing = new Set(await readdir(ICON_DIR));
  if (existing.has(filename)) {
    filename = `${baseName}-${Date.now()}.svg`;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(ICON_DIR, filename), bytes);

  return Response.json({ icon: `/fixture-icons/${filename}` }, { status: 201 });
}
