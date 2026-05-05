-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "dmxInterface" TEXT NOT NULL DEFAULT 'artnet',
    "artnetHost" TEXT NOT NULL DEFAULT '192.168.1.255',
    "artnetPort" INTEGER NOT NULL DEFAULT 6454,
    "artnetNet" INTEGER NOT NULL DEFAULT 0,
    "artnetSubnet" INTEGER NOT NULL DEFAULT 0,
    "artnetUniverse" INTEGER NOT NULL DEFAULT 0,
    "grandMaster" INTEGER NOT NULL DEFAULT 255,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FixtureProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "oflKey" TEXT,
    "channels" TEXT NOT NULL,
    "modes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FixtureInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startAddress" INTEGER NOT NULL,
    "modeIndex" INTEGER NOT NULL DEFAULT 0,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "group" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FixtureInstance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FixtureProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "values" TEXT NOT NULL,
    "fadeIn" INTEGER NOT NULL DEFAULT 0,
    "fadeOut" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Look" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "values" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FixtureProfile_oflKey_key" ON "FixtureProfile"("oflKey");
