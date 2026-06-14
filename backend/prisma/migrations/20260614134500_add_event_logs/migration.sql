CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventLog_gameId_day_createdAt_idx" ON "EventLog"("gameId", "day", "createdAt");

ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
