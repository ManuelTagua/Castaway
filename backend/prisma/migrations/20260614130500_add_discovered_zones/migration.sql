CREATE TABLE "DiscoveredZone" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoveredZone_gameId_zone_key" ON "DiscoveredZone"("gameId", "zone");

ALTER TABLE "DiscoveredZone" ADD CONSTRAINT "DiscoveredZone_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DiscoveredZone" ("id", "gameId", "zone", "discoveredAt")
SELECT gen_random_uuid(), "id", 'BEACH', NOW()
FROM "Game"
ON CONFLICT ("gameId", "zone") DO NOTHING;
