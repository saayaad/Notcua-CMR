-- CreateTable
CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastConnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WhatsappAuthEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" BLOB NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsappAuthEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "firstMessageLabelId" TEXT,
    "autoLabelFirstMessage" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    CONSTRAINT "SessionSettings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionSettings_firstMessageLabelId_fkey" FOREIGN KEY ("firstMessageLabelId") REFERENCES "Label" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "whatsappJid" TEXT,
    "name" TEXT NOT NULL,
    "profilePicture" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "isSavedContact" BOOLEAN NOT NULL DEFAULT false,
    "firstInboundAt" DATETIME,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "whatsappMessageId" TEXT,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "caption" TEXT,
    "fileId" TEXT,
    "isPtt" BOOLEAN NOT NULL DEFAULT false,
    "isPtv" BOOLEAN NOT NULL DEFAULT false,
    "asViewOnce" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "rawPayload" JSONB NOT NULL DEFAULT '{}',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sha256" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT,
    "caption" TEXT,
    "fileId" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isPtt" BOOLEAN NOT NULL DEFAULT false,
    "isPtv" BOOLEAN NOT NULL DEFAULT false,
    "asViewOnce" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "description" TEXT NOT NULL DEFAULT '',
    "createReason" TEXT NOT NULL DEFAULT 'Criado no Noctua',
    "whatsappId" TEXT,
    "sessionId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Label_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactLabel" (
    "contactId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("contactId", "labelId"),
    CONSTRAINT "ContactLabel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "valueInCents" INTEGER NOT NULL DEFAULT 0,
    "position" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "wonAt" DATETIME,
    "lostAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Macro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "text" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MacroAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "macroId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT,
    "waitMs" INTEGER NOT NULL DEFAULT 0,
    "composingMs" INTEGER NOT NULL DEFAULT 0,
    "fileId" TEXT,
    "labelId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "MacroAction_macroId_fkey" FOREIGN KEY ("macroId") REFERENCES "Macro" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MacroAction_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MacroAction_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MacroExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "macroId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "currentPosition" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MacroExecution_macroId_fkey" FOREIGN KEY ("macroId") REFERENCES "Macro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MacroExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FunnelItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funnelId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayBeforeSendMs" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FunnelItem_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunnelItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunnelExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funnelId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentPosition" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "nextRunAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FunnelExecution_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FunnelExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FlowVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "graph" JSONB NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowVersion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlowNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL DEFAULT 0,
    "y" REAL NOT NULL DEFAULT 0,
    "assetId" TEXT,
    "simulationDelayMs" INTEGER NOT NULL DEFAULT 0,
    "delayInMs" INTEGER NOT NULL DEFAULT 0,
    "expirationTimeoutMs" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "FlowNode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FlowVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlowNode_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlowExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "context" JSONB NOT NULL DEFAULT '{}',
    "nextRunAt" DATETIME,
    "inputExpiresAt" DATETIME,
    "lastInputMessageId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FlowExecution_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FlowVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FlowExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT,
    "type" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "runAt" DATETIME NOT NULL,
    "lockedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledJob_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FlowExecution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PixKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "merchantCity" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sha256" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappAuthEntry_sessionId_category_key_key" ON "WhatsappAuthEntry"("sessionId", "category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSettings_sessionId_key" ON "SessionSettings"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phoneNumber_key" ON "Contact"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_whatsappJid_key" ON "Contact"("whatsappJid");

-- CreateIndex
CREATE INDEX "Conversation_status_lastMessageAt_idx" ON "Conversation"("status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_sessionId_contactId_key" ON "Conversation"("sessionId", "contactId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_sentAt_idx" ON "ChatMessage"("conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_conversationId_whatsappMessageId_key" ON "ChatMessage"("conversationId", "whatsappMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_sha256_key" ON "StoredFile"("sha256");

-- CreateIndex
CREATE INDEX "Asset_kind_isFavorite_idx" ON "Asset"("kind", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "Label_sessionId_whatsappId_key" ON "Label"("sessionId", "whatsappId");

-- CreateIndex
CREATE INDEX "ContactLabel_labelId_idx" ON "ContactLabel"("labelId");

-- CreateIndex
CREATE INDEX "Deal_labelId_position_idx" ON "Deal"("labelId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MacroAction_macroId_position_key" ON "MacroAction"("macroId", "position");

-- CreateIndex
CREATE INDEX "MacroExecution_status_nextRunAt_idx" ON "MacroExecution"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelItem_funnelId_position_key" ON "FunnelItem"("funnelId", "position");

-- CreateIndex
CREATE INDEX "FunnelExecution_status_nextRunAt_idx" ON "FunnelExecution"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlowVersion_flowId_version_key" ON "FlowVersion"("flowId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FlowNode_versionId_sourceId_key" ON "FlowNode"("versionId", "sourceId");

-- CreateIndex
CREATE INDEX "FlowExecution_status_nextRunAt_idx" ON "FlowExecution"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "FlowExecution_status_inputExpiresAt_idx" ON "FlowExecution"("status", "inputExpiresAt");

-- CreateIndex
CREATE INDEX "FlowExecution_contactId_status_idx" ON "FlowExecution"("contactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_deduplicationKey_key" ON "ScheduledJob"("deduplicationKey");

-- CreateIndex
CREATE INDEX "ScheduledJob_status_runAt_idx" ON "ScheduledJob"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_sha256_key" ON "ImportBatch"("sha256");
