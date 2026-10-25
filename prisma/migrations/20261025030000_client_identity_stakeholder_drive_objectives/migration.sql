ALTER TABLE public."Client"
  ADD COLUMN "cinExpiryDate" TIMESTAMP(3),
  ADD COLUMN "fatherName" TEXT,
  ADD COLUMN "motherName" TEXT;

ALTER TABLE public."Project"
  ADD COLUMN "technicianObjective" TEXT;

CREATE TABLE public."StakeholderFile" (
  "cabinetId" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "stakeholderId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "mime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StakeholderFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StakeholderFile_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES public."Cabinet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StakeholderFile_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES public."Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StakeholderFile_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StakeholderFile_cabinetId_idx" ON public."StakeholderFile"("cabinetId");
CREATE INDEX "StakeholderFile_stakeholderId_createdAt_idx" ON public."StakeholderFile"("stakeholderId", "createdAt");

CREATE TRIGGER "StakeholderFile_same_cabinet"
BEFORE INSERT OR UPDATE ON public."StakeholderFile"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('stakeholderId', 'Stakeholder', 'authorId', 'User');

ALTER TABLE public."StakeholderFile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."StakeholderFile" FROM anon, authenticated;
GRANT ALL ON TABLE public."StakeholderFile" TO prisma;

