import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

// WorkingDirectory in the launchd plist is always the project root, so
// process.cwd() is reliable here. __dirname resolves to /ROOT/lib in the
// production bundle (Next.js replaces it with a placeholder), making it unusable.
const dbPath = path.resolve(process.cwd(), "dev.db");

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

globalForPrisma.prisma = prisma;

export default prisma;
