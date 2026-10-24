ALTER TABLE "Flow" ADD COLUMN "sessionId" TEXT REFERENCES "WhatsappSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD COLUMN "enabledAt" DATETIME;
ALTER TABLE "Flow" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Flow" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Flow_sessionId_enabled_archived_idx" ON "Flow"("sessionId", "enabled", "archived");
ALTER TABLE "FlowExecution" ADD COLUMN "conversationId" TEXT REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowExecution" ADD COLUMN "triggerMessageId" TEXT;
CREATE UNIQUE INDEX "FlowExecution_conversationId_triggerMessageId_key" ON "FlowExecution"("conversationId", "triggerMessageId");
CREATE INDEX "FlowExecution_conversationId_status_idx" ON "FlowExecution"("conversationId", "status");
CREATE TABLE "FlowInboxEvent" (
  "messageId" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" DATETIME,
  "outcome" TEXT
);
CREATE INDEX "FlowInboxEvent_processedAt_receivedAt_idx" ON "FlowInboxEvent"("processedAt", "receivedAt");
