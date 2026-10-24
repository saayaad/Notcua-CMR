CREATE TABLE "SequenceRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestKey" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "nextRunAt" DATETIME NOT NULL,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SequenceRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SequenceRun_requestKey_key" ON "SequenceRun"("requestKey");
CREATE INDEX "SequenceRun_status_nextRunAt_idx" ON "SequenceRun"("status", "nextRunAt");
CREATE INDEX "SequenceRun_conversationId_status_idx" ON "SequenceRun"("conversationId", "status");
