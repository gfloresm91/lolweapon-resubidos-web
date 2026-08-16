-- Existing rows contain reusable bearer tokens. New sessions store only SHA-256 hashes.
DELETE FROM "PlatformSession";

-- Apply the default privacy retention window immediately during deployment.
DELETE FROM "LoginAttempt"
WHERE "createdAt" < CURRENT_TIMESTAMP - INTERVAL '90 days';
