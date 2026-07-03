UPDATE "PlatformUser" AS user_account
SET "lastLoginAt" = session_history."lastLoginAt"
FROM (
  SELECT "userId", MAX("createdAt") AS "lastLoginAt"
  FROM "PlatformSession"
  GROUP BY "userId"
) AS session_history
WHERE user_account."id" = session_history."userId"
  AND user_account."lastLoginAt" IS NULL;
