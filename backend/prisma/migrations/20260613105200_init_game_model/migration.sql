-- CreateTable
CREATE TABLE IF NOT EXISTS "Game" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 100,
    "hunger" INTEGER NOT NULL DEFAULT 80,
    "thirst" INTEGER NOT NULL DEFAULT 80,
    "energy" INTEGER NOT NULL DEFAULT 100,
    "sanity" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- Keep existing development databases aligned with the phase 2 initial state.
ALTER TABLE "Game" ALTER COLUMN "hunger" SET DEFAULT 80;
ALTER TABLE "Game" ALTER COLUMN "thirst" SET DEFAULT 80;
