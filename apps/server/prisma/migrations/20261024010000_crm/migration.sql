CREATE TABLE "CrmOpportunity" (
  "conversationId" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT '',
  "valueInCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "wonAt" DATETIME,
  "lostAt" DATETIME,
  "placements" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrmOpportunity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CrmOpportunity_status_wonAt_idx" ON "CrmOpportunity"("status", "wonAt");
