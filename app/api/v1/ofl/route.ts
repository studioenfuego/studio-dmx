import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GH_API = "https://api.github.com/repos/OpenLightingProject/open-fixture-library/contents/fixtures";
const GH_RAW = "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/fixtures";
const GH_HEADERS = { "User-Agent": "studio-dmx/1.0", "Accept": "application/vnd.github.v3+json" };

type GHFile = { name: string; type: "file" | "dir"; download_url: string | null };

export async function GET(request: NextRequest) {
  const manufacturer = request.nextUrl.searchParams.get("manufacturer");
  const fixture = request.nextUrl.searchParams.get("fixture");

  if (manufacturer && fixture) {
    try {
      const res = await fetch(`${GH_RAW}/${manufacturer}/${fixture}.json`, {
        headers: { "User-Agent": "studio-dmx/1.0" },
      });
      if (!res.ok) return Response.json({ error: "Not found" }, { status: 404 });
      const data = await res.json();
      return Response.json(data);
    } catch {
      return Response.json({ error: "Failed to fetch fixture" }, { status: 502 });
    }
  }

  if (manufacturer) {
    try {
      const res = await fetch(`${GH_API}/${manufacturer}`, {
        headers: GH_HEADERS,
        next: { revalidate: 3600 },
      });
      if (!res.ok) return Response.json({ error: "Manufacturer not found" }, { status: 404 });
      const files: GHFile[] = await res.json();
      const fixtures = files
        .filter((f) => f.type === "file" && f.name.endsWith(".json"))
        .map((f) => f.name.replace(".json", ""));
      return Response.json(fixtures);
    } catch {
      return Response.json({ error: "Failed to list fixtures" }, { status: 502 });
    }
  }

  try {
    const [dirRes, mfgRes] = await Promise.all([
      fetch(GH_API, { headers: GH_HEADERS, next: { revalidate: 3600 } }),
      fetch(`${GH_RAW}/manufacturers.json`, { headers: { "User-Agent": "studio-dmx/1.0" }, next: { revalidate: 3600 } }),
    ]);
    if (!dirRes.ok) return Response.json({ error: "Failed to reach GitHub" }, { status: 502 });

    const dirs: GHFile[] = await dirRes.json();
    const manufacturers: Record<string, { name: string }> = mfgRes.ok
      ? await mfgRes.json()
      : {};

    const result = dirs
      .filter((d) => d.type === "dir" && d.name !== "manufacturers.json")
      .map((d) => ({
        key: d.name,
        name: manufacturers[d.name]?.name ?? d.name,
      }));

    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch manufacturer list" }, { status: 502 });
  }
}
