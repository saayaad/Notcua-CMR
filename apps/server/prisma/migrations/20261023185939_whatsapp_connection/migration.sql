-- CreateTable
CREATE TABLE "WhatsappIdentity" (
    "jid" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    CONSTRAINT "WhatsappIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
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
INSERT INTO "new_Asset" ("asViewOnce", "caption", "createdAt", "fileId", "id", "isFavorite", "isPtt", "isPtv", "kind", "metadata", "name", "text", "updatedAt") SELECT "asViewOnce", "caption", "createdAt", "fileId", "id", "isFavorite", "isPtt", "isPtv", "kind", "metadata", "name", "text", "updatedAt" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_kind_isFavorite_idx" ON "Asset"("kind", "isFavorite");
CREATE TABLE "new_ChatMessage" (
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
INSERT INTO "new_ChatMessage" ("asViewOnce", "caption", "conversationId", "direction", "error", "fileId", "id", "isPtt", "isPtv", "rawPayload", "sentAt", "status", "text", "type", "updatedAt", "whatsappMessageId") SELECT "asViewOnce", "caption", "conversationId", "direction", "error", "fileId", "id", "isPtt", "isPtv", "rawPayload", "sentAt", "status", "text", "type", "updatedAt", "whatsappMessageId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_conversationId_sentAt_idx" ON "ChatMessage"("conversationId", "sentAt");
CREATE UNIQUE INDEX "ChatMessage_conversationId_whatsappMessageId_key" ON "ChatMessage"("conversationId", "whatsappMessageId");
CREATE TABLE "new_Contact" (
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
INSERT INTO "new_Contact" ("createdAt", "firstInboundAt", "id", "isGroup", "isSavedContact", "metadata", "name", "phoneNumber", "profilePicture", "updatedAt", "whatsappJid") SELECT "createdAt", "firstInboundAt", "id", "isGroup", "isSavedContact", "metadata", "name", "phoneNumber", "profilePicture", "updatedAt", "whatsappJid" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_phoneNumber_key" ON "Contact"("phoneNumber");
CREATE UNIQUE INDEX "Contact_whatsappJid_key" ON "Contact"("whatsappJid");
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" DATETIME,
    "firstInboundAt" DATETIME,
    "hasHistory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("contactId", "createdAt", "id", "lastMessageAt", "sessionId", "status", "unreadCount", "updatedAt") SELECT "contactId", "createdAt", "id", "lastMessageAt", "sessionId", "status", "unreadCount", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_status_lastMessageAt_idx" ON "Conversation"("status", "lastMessageAt");
CREATE UNIQUE INDEX "Conversation_sessionId_contactId_key" ON "Conversation"("sessionId", "contactId");
CREATE TABLE "new_Flow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Flow" ("createdAt", "enabled", "id", "metadata", "name", "updatedAt") SELECT "createdAt", "enabled", "id", "metadata", "name", "updatedAt" FROM "Flow";
DROP TABLE "Flow";
ALTER TABLE "new_Flow" RENAME TO "Flow";
CREATE TABLE "new_FlowExecution" (
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
INSERT INTO "new_FlowExecution" ("contactId", "context", "createdAt", "currentNodeId", "error", "id", "inputExpiresAt", "lastInputMessageId", "nextRunAt", "status", "updatedAt", "versionId") SELECT "contactId", "context", "createdAt", "currentNodeId", "error", "id", "inputExpiresAt", "lastInputMessageId", "nextRunAt", "status", "updatedAt", "versionId" FROM "FlowExecution";
DROP TABLE "FlowExecution";
ALTER TABLE "new_FlowExecution" RENAME TO "FlowExecution";
CREATE INDEX "FlowExecution_status_nextRunAt_idx" ON "FlowExecution"("status", "nextRunAt");
CREATE INDEX "FlowExecution_status_inputExpiresAt_idx" ON "FlowExecution"("status", "inputExpiresAt");
CREATE INDEX "FlowExecution_contactId_status_idx" ON "FlowExecution"("contactId", "status");
CREATE TABLE "new_FlowNode" (
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
INSERT INTO "new_FlowNode" ("assetId", "config", "delayInMs", "expirationTimeoutMs", "id", "simulationDelayMs", "sourceId", "type", "versionId", "x", "y") SELECT "assetId", "config", "delayInMs", "expirationTimeoutMs", "id", "simulationDelayMs", "sourceId", "type", "versionId", "x", "y" FROM "FlowNode";
DROP TABLE "FlowNode";
ALTER TABLE "new_FlowNode" RENAME TO "FlowNode";
CREATE UNIQUE INDEX "FlowNode_versionId_sourceId_key" ON "FlowNode"("versionId", "sourceId");
CREATE TABLE "new_Funnel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Funnel" ("createdAt", "id", "metadata", "name", "updatedAt") SELECT "createdAt", "id", "metadata", "name", "updatedAt" FROM "Funnel";
DROP TABLE "Funnel";
ALTER TABLE "new_Funnel" RENAME TO "Funnel";
CREATE TABLE "new_Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "description" TEXT NOT NULL DEFAULT '',
    "createReason" TEXT NOT NULL DEFAULT 'Criado no Noctua',
    "whatsappId" TEXT,
    "whatsappColor" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "sessionId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Label_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Label" ("color", "createReason", "createdAt", "description", "id", "name", "position", "sessionId", "updatedAt", "whatsappId") SELECT "color", "createReason", "createdAt", "description", "id", "name", "position", "sessionId", "updatedAt", "whatsappId" FROM "Label";
DROP TABLE "Label";
ALTER TABLE "new_Label" RENAME TO "Label";
CREATE UNIQUE INDEX "Label_sessionId_whatsappId_key" ON "Label"("sessionId", "whatsappId");
CREATE TABLE "new_Macro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "text" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Macro" ("createdAt", "id", "isFavorite", "metadata", "name", "text", "updatedAt") SELECT "createdAt", "id", "isFavorite", "metadata", "name", "text", "updatedAt" FROM "Macro";
DROP TABLE "Macro";
ALTER TABLE "new_Macro" RENAME TO "Macro";
CREATE TABLE "new_MacroAction" (
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
INSERT INTO "new_MacroAction" ("composingMs", "fileId", "id", "labelId", "macroId", "payload", "position", "text", "type", "waitMs") SELECT "composingMs", "fileId", "id", "labelId", "macroId", "payload", "position", "text", "type", "waitMs" FROM "MacroAction";
DROP TABLE "MacroAction";
ALTER TABLE "new_MacroAction" RENAME TO "MacroAction";
CREATE UNIQUE INDEX "MacroAction_macroId_position_key" ON "MacroAction"("macroId", "position");
CREATE TABLE "new_WhatsappSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastConnectedAt" DATETIME,
    "autoConnect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsappSession" ("createdAt", "id", "lastConnectedAt", "name", "phoneNumber", "status", "updatedAt") SELECT "createdAt", "id", "lastConnectedAt", "name", "phoneNumber", "status", "updatedAt" FROM "WhatsappSession";
DROP TABLE "WhatsappSession";
ALTER TABLE "new_WhatsappSession" RENAME TO "WhatsappSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WhatsappIdentity_contactId_idx" ON "WhatsappIdentity"("contactId");
