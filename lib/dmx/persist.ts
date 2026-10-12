import { universe } from "./universe";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function initUniversePersistence(): void {
  universe.onChange(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, 1000);
  });
}

async function flush(): Promise<void> {
  try {
    const { prisma } = await import("../db");
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: {
        universeChannels: JSON.stringify(universe.getChannels()),
        grandMaster: universe.getGrandMaster(),
      },
      create: {
        id: "singleton",
        universeChannels: JSON.stringify(universe.getChannels()),
        grandMaster: universe.getGrandMaster(),
      },
    });
  } catch (e) {
    console.error("[DMX] Failed to persist universe state:", e);
  }
}
