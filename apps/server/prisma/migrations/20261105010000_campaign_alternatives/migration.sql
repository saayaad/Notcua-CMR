-- New normalized alternative snapshots are additive. Legacy JSON remains untouched.
CREATE TABLE "CampaignAlternative" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CampaignAlternative_campaignId_position_key"
  ON "CampaignAlternative"("campaignId", "position");
CREATE INDEX "CampaignAlternative_campaignId_idx"
  ON "CampaignAlternative"("campaignId");

CREATE TABLE "CampaignAlternativeStep" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "alternativeId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "waitSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CampaignAlternativeStep_alternativeId_fkey"
    FOREIGN KEY ("alternativeId") REFERENCES "CampaignAlternative"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CampaignAlternativeStep_alternativeId_position_key"
  ON "CampaignAlternativeStep"("alternativeId", "position");
CREATE INDEX "CampaignAlternativeStep_alternativeId_idx"
  ON "CampaignAlternativeStep"("alternativeId");

ALTER TABLE "DeliveryTask" ADD COLUMN "alternativeId" TEXT;
ALTER TABLE "DeliveryTask" ADD COLUMN "alternativeIndex" INTEGER;
ALTER TABLE "DeliveryTask" ADD COLUMN "frozenContent" JSONB;
ALTER TABLE "DeliveryTask" ADD COLUMN "stepIndex" INTEGER;

-- Backfill each legacy campaign with a single snapshot of its existing configuration.
-- No original JSON or task payload is updated or deleted.
INSERT INTO "CampaignAlternative" ("id", "campaignId", "position", "name", "content")
SELECT 'legacy-alt:' || "id", "id", 0, 'Mensagem original',
  COALESCE(
    (SELECT "payload" FROM "DeliveryTask" WHERE "batchId" = "OperationRecord"."id" ORDER BY "createdAt", "id" LIMIT 1),
    "data"
  )
FROM "OperationRecord"
WHERE "kind" = 'BATCH'
  AND json_valid("data")
  AND NOT EXISTS (
    SELECT 1 FROM "CampaignAlternative" WHERE "campaignId" = "OperationRecord"."id"
  );

-- Preserve the currently frozen sequence steps when a legacy campaign has them.
INSERT INTO "CampaignAlternativeStep" ("id", "alternativeId", "position", "kind", "content", "waitSeconds")
SELECT
  'legacy-step:' || alternatives."id" || ':' || json_each.key,
  alternatives."id",
  CAST(json_each.key AS INTEGER),
  COALESCE(json_extract(json_each.value, '$.snapshot.kind'), 'text'),
  COALESCE(json_extract(json_each.value, '$.snapshot'), json_each.value),
  COALESCE(json_extract(json_each.value, '$.waitSeconds'), 0)
FROM "CampaignAlternative" AS alternatives,
  json_each(alternatives."content", '$.steps')
WHERE json_type(alternatives."content", '$.steps') = 'array';

-- A legacy single-message task becomes one ordered step, retaining the frozen payload.
INSERT INTO "CampaignAlternativeStep" ("id", "alternativeId", "position", "kind", "content", "waitSeconds")
SELECT
  'legacy-step:' || alternatives."id" || ':0',
  alternatives."id",
  0,
  COALESCE(json_extract(alternatives."content", '$.snapshot.kind'), 'text'),
  COALESCE(json_extract(alternatives."content", '$.snapshot'), alternatives."content"),
  0
FROM "CampaignAlternative" AS alternatives
WHERE json_type(alternatives."content", '$.steps') IS NULL;
