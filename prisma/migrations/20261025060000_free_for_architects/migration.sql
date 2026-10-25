ALTER TABLE public."Cabinet"
  ALTER COLUMN "plan" SET DEFAULT 'FREE',
  ALTER COLUMN "subscriptionStatus" SET DEFAULT 'FREE';

UPDATE public."Cabinet"
SET "plan" = 'FREE',
    "subscriptionStatus" = 'FREE',
    "trialEndsAt" = NULL;
