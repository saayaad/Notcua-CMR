ALTER TABLE "Conversation" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "assignedTo" TEXT NOT NULL DEFAULT '';
UPDATE "Conversation" SET "pinned" = COALESCE((SELECT json_extract("metadata", '$.pinned') FROM "Contact" WHERE "Contact"."id" = "Conversation"."contactId"), false), "assignedTo" = COALESCE((SELECT json_extract("metadata", '$.assignedTo') FROM "Contact" WHERE "Contact"."id" = "Conversation"."contactId"), '');
CREATE INDEX "Conversation_pinned_lastMessageAt_idx" ON "Conversation"("pinned", "lastMessageAt");
