-- CreateTable
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_gameId_type_key" ON "InventoryItem"("gameId", "type");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InventoryItem_gameId_fkey'
    ) THEN
        ALTER TABLE "InventoryItem"
        ADD CONSTRAINT "InventoryItem_gameId_fkey"
        FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Seed initial resources for games created before inventory existed.
INSERT INTO "InventoryItem" ("id", "gameId", "type", "quantity", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "Game"."id", resource."type", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Game"
CROSS JOIN (
    VALUES ('FOOD'), ('WATER'), ('WOOD'), ('STONE'), ('FIBER')
) AS resource("type")
ON CONFLICT ("gameId", "type") DO NOTHING;
