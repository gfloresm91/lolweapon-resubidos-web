-- Prevent repeated form submissions from creating the same manual theme twice.
ALTER TABLE "AnimeTierListTheme"
ADD COLUMN "createRequestKey" TEXT;

CREATE UNIQUE INDEX "AnimeTierListTheme_createRequestKey_key"
ON "AnimeTierListTheme"("createRequestKey");
