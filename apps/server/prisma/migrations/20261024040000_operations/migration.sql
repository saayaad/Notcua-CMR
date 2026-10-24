CREATE TABLE "OperationRecord" ("id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL, "data" JSONB NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL);
CREATE INDEX "OperationRecord_kind_idx" ON "OperationRecord"("kind");
CREATE TABLE "DeliveryTask" ("id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED', "payload" JSONB NOT NULL, "runAt" DATETIME NOT NULL, "error" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL);
CREATE INDEX "DeliveryTask_status_runAt_idx" ON "DeliveryTask"("status", "runAt");
CREATE INDEX "DeliveryTask_batchId_idx" ON "DeliveryTask"("batchId");
