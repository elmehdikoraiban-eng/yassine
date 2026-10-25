// Référentiels métier issus du cahier des charges.

/** §5 — Les 20 étapes du processus d'un projet d'architecture. */
export const STEPS: { n: number; label: string; phase: string }[] = [
  { n: 1, label: "Réception et écoute du client", phase: "Avant-projet" },
  { n: 2, label: "Collecte et vérification des documents", phase: "Avant-projet" },
  { n: 3, label: "Analyse de faisabilité", phase: "Avant-projet" },
  { n: 4, label: "Proposition de mission et contrat", phase: "Avant-projet" },
  { n: 5, label: "Ouverture du dossier projet", phase: "Avant-projet" },
  { n: 6, label: "Visite, relevé et état des lieux", phase: "Conception" },
  { n: 7, label: "Conception architecturale", phase: "Conception" },
  { n: 8, label: "Préparation du dossier d'autorisation", phase: "Autorisation" },
  { n: 9, label: "Dépôt et suivi de l'instruction", phase: "Autorisation" },
  { n: 10, label: "Observations, corrections et redépôt", phase: "Autorisation" },
  { n: 11, label: "Autorisation obtenue, passage à l'exécution", phase: "Autorisation" },
  { n: 12, label: "Production et contrôle des plans d'exécution", phase: "Exécution" },
  { n: 13, label: "Coordination BET", phase: "Exécution" },
  { n: 14, label: "Coordination avec l'entreprise", phase: "Chantier" },
  { n: 15, label: "Suivi du chantier", phase: "Chantier" },
  { n: 16, label: "Gestion des modifications", phase: "Chantier" },
  { n: 17, label: "Fin de travaux et réserves", phase: "Réception" },
  { n: 18, label: "Documents de récolement", phase: "Réception" },
  { n: 19, label: "Permis d'habiter / certificat de conformité", phase: "Réception" },
  { n: 20, label: "Remise, clôture et archivage", phase: "Clôture" },
];

export const PHASES = ["Avant-projet", "Conception", "Autorisation", "Exécution", "Chantier", "Réception", "Clôture"];

export const stepLabel = (n: number) => STEPS.find((s) => s.n === n)?.label ?? `Étape ${n}`;
export const stepPhase = (n: number) => STEPS.find((s) => s.n === n)?.phase ?? "";

/** §11 — Arborescence type du dossier projet. */
export const FOLDERS: { code: string; label: string; finance?: boolean }[] = [
  { code: "01_CLIENT", label: "Client" },
  { code: "02_CONTRAT", label: "Contrat", finance: true },
  { code: "03_FONCIER", label: "Foncier" },
  { code: "04_RELEVE_EXISTANT", label: "Relevé de l'existant" },
  { code: "05_CONCEPTION", label: "Conception" },
  { code: "06_AUTORISATION", label: "Autorisation" },
  { code: "07_PLANS_EXECUTION", label: "Plans d'exécution" },
  { code: "08_BET", label: "BET" },
  { code: "09_ENTREPRISE", label: "Entreprise" },
  { code: "10_CHANTIER", label: "Chantier" },
  { code: "11_RECOLEMENT", label: "Récolement" },
  { code: "12_PERMIS_HABITER", label: "Permis d'habiter" },
  { code: "13_FACTURATION", label: "Facturation", finance: true },
  { code: "14_COMPTABILITE", label: "Comptabilité", finance: true },
  { code: "15_ARCHIVES", label: "Archives" },
];

/** §18 — Échéancier type, entièrement modifiable par contrat. */
export const DEFAULT_SCHEDULE = [
  { label: "Signature du contrat", percent: 20, step: 4 },
  { label: "Conception", percent: 20, step: 7 },
  { label: "Autorisation", percent: 20, step: 11 },
  { label: "Plans d'exécution", percent: 20, step: 12 },
  { label: "Fin des travaux", percent: 10, step: 17 },
  { label: "Permis d'habiter", percent: 10, step: 19 },
];

export const ROLE_LABELS: Record<string, string> = {
  GERANT: "Architecte gérant",
  ASSISTANTE: "Assistante",
  TECHNICIEN: "Technicien / dessinateur",
  COLLABORATEUR: "Collaborateur / sous-traitant",
};

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  PHYSIQUE: "Personne physique",
  MORALE: "Personne morale",
};

export const NOTE_KIND_LABELS: Record<string, string> = {
  APPEL: "Appel",
  REUNION: "Réunion",
  EMAIL: "E-mail",
  DEMANDE: "Demande",
  OBSERVATION: "Observation",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  EN_COURS: "En cours",
  SUSPENDU: "Suspendu",
  CLOTURE: "Clôturé",
  ARCHIVE: "Archivé",
};

export const STAKEHOLDER_KIND_LABELS: Record<string, string> = {
  BET: "BET",
  ENTREPRISE: "Entreprise",
  BUREAU_CONTROLE: "Bureau de contrôle",
  LABORATOIRE: "Laboratoire",
  TOPOGRAPHE: "Topographe",
  AUTRE: "Autre",
};

export const DOC_STATE_LABELS: Record<string, string> = {
  TRAVAIL: "Document de travail",
  VALIDE: "Validé",
  OBSOLETE: "Obsolète",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  A_PREPARER: "À préparer",
  EN_COURS: "En cours",
  A_VERIFIER: "À vérifier",
  VALIDE: "Validé",
  DIFFUSE: "Diffusé",
  REVISE: "Révisé",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
  ESPECES: "Espèces",
  EFFET: "Effet",
  AUTRE: "Autre",
};

export const PLAN_TONE: Record<string, string> = {
  A_PREPARER: "neutral",
  EN_COURS: "info",
  A_VERIFIER: "warn",
  VALIDE: "ok",
  DIFFUSE: "ok",
  REVISE: "warn",
};
