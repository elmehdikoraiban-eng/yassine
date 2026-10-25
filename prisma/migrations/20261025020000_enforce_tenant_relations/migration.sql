-- Prevent relations from crossing cabinet boundaries, even if an action receives a forged foreign ID.
CREATE OR REPLACE FUNCTION public.enforce_same_cabinet_relations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  i integer;
  referenced_id text;
  referenced_cabinet text;
  current_cabinet text;
BEGIN
  current_cabinet := to_jsonb(NEW)->>'cabinetId';
  IF current_cabinet IS NULL THEN
    RAISE EXCEPTION 'cabinetId is required for %', TG_TABLE_NAME USING ERRCODE = '23502';
  END IF;

  IF TG_NARGS % 2 <> 0 THEN
    RAISE EXCEPTION 'Invalid tenant relation trigger configuration on %', TG_TABLE_NAME;
  END IF;

  FOR i IN 0..TG_NARGS - 1 BY 2 LOOP
    referenced_id := to_jsonb(NEW)->>TG_ARGV[i];
    IF referenced_id IS NOT NULL THEN
      EXECUTE format('SELECT "cabinetId"::text FROM public.%I WHERE "id"::text = $1', TG_ARGV[i + 1])
        INTO referenced_cabinet USING referenced_id;
      IF referenced_cabinet IS DISTINCT FROM current_cabinet THEN
        RAISE EXCEPTION 'Cross-cabinet relation denied on %.%', TG_TABLE_NAME, TG_ARGV[i]
          USING ERRCODE = '23503';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "Notification_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Notification"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('userId', 'User');

CREATE TRIGGER "ClientNote_same_cabinet"
BEFORE INSERT OR UPDATE ON public."ClientNote"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('clientId', 'Client', 'authorId', 'User');

CREATE TRIGGER "Project_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Project"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('clientId', 'Client');

CREATE TRIGGER "ProjectMember_same_cabinet"
BEFORE INSERT OR UPDATE ON public."ProjectMember"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('projectId', 'Project', 'userId', 'User');

CREATE TRIGGER "StepChange_same_cabinet"
BEFORE INSERT OR UPDATE ON public."StepChange"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('projectId', 'Project');

CREATE TRIGGER "ProjectStakeholder_same_cabinet"
BEFORE INSERT OR UPDATE ON public."ProjectStakeholder"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('projectId', 'Project', 'stakeholderId', 'Stakeholder');

CREATE TRIGGER "Document_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Document"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('projectId', 'Project');

CREATE TRIGGER "DocumentVersion_same_cabinet"
BEFORE INSERT OR UPDATE ON public."DocumentVersion"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('documentId', 'Document', 'authorId', 'User');

CREATE TRIGGER "Distribution_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Distribution"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('documentId', 'Document', 'versionId', 'DocumentVersion', 'stakeholderId', 'Stakeholder');

CREATE TRIGGER "Contract_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Contract"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('projectId', 'Project');

CREATE TRIGGER "Milestone_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Milestone"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('contractId', 'Contract');

CREATE TRIGGER "Invoice_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Invoice"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('projectId', 'Project', 'milestoneId', 'Milestone');

CREATE TRIGGER "Payment_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Payment"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('invoiceId', 'Invoice');

CREATE TRIGGER "Reminder_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Reminder"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('invoiceId', 'Invoice');

CREATE TRIGGER "Quote_same_cabinet"
BEFORE INSERT OR UPDATE ON public."Quote"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('clientId', 'Client', 'projectId', 'Project');

CREATE TRIGGER "QuoteLine_same_cabinet"
BEFORE INSERT OR UPDATE ON public."QuoteLine"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('quoteId', 'Quote');

CREATE TRIGGER "AuditLog_same_cabinet"
BEFORE INSERT OR UPDATE ON public."AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.enforce_same_cabinet_relations('userId', 'User', 'projectId', 'Project');

REVOKE ALL ON FUNCTION public.enforce_same_cabinet_relations() FROM PUBLIC, anon, authenticated;
