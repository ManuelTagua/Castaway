CREATE TABLE "NarrativeEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" INTEGER NOT NULL,

    CONSTRAINT "NarrativeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NarrativeEvent_gameId_eventKey_key" ON "NarrativeEvent"("gameId", "eventKey");
CREATE INDEX "NarrativeEvent_gameId_day_idx" ON "NarrativeEvent"("gameId", "day");

ALTER TABLE "NarrativeEvent" ADD CONSTRAINT "NarrativeEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
