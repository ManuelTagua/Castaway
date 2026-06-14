-- CreateTable
CREATE TABLE IF NOT EXISTS "BuiltStructure" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuiltStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BuiltStructure_gameId_type_key" ON "BuiltStructure"("gameId", "type");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BuiltStructure_gameId_fkey'
    ) THEN
        ALTER TABLE "BuiltStructure"
        ADD CONSTRAINT "BuiltStructure_gameId_fkey"
        FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
