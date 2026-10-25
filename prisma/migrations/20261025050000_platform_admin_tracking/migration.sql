ALTER TABLE public."Cabinet"
  ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionRenewsAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3);

ALTER TABLE public."User"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE public."PlatformAdminAction" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "cabinetId" TEXT,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdminAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAdminAction_cabinetId_createdAt_idx"
  ON public."PlatformAdminAction"("cabinetId", "createdAt");
CREATE INDEX "PlatformAdminAction_adminId_createdAt_idx"
  ON public."PlatformAdminAction"("adminId", "createdAt");

ALTER TABLE public."PlatformAdminAction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PlatformAdminAction" FROM anon, authenticated;
GRANT ALL ON public."PlatformAdminAction" TO prisma;
