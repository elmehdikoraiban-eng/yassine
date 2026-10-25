import type { Prisma, Role } from "@prisma/client";
import type { SessionUser } from "./auth";

/**
 * Matrice des droits par défaut (annexe du cahier des charges).
 * Hypothèses à valider avec le cabinet lors du cadrage :
 * - les finances (honoraires, factures, règlements) sont réservées au gérant et à l'assistante ;
 * - le technicien et le collaborateur ne voient que les projets auxquels ils sont affectés ;
 * - seul le gérant valide un document ou un plan, annule une facture et gère les comptes.
 */
const MATRIX = {
  seeAllProjects: ["GERANT", "ASSISTANTE"],
  manageProjects: ["GERANT", "ASSISTANTE"],
  manageClients: ["GERANT", "ASSISTANTE"],
  seeClients: ["GERANT", "ASSISTANTE"],
  manageStakeholders: ["GERANT", "ASSISTANTE", "TECHNICIEN"],
  uploadDocuments: ["GERANT", "ASSISTANTE", "TECHNICIEN", "COLLABORATEUR"],
  changePlanStatus: ["GERANT", "ASSISTANTE", "TECHNICIEN"],
  validateDocuments: ["GERANT"],
  distributeDocuments: ["GERANT", "ASSISTANTE", "TECHNICIEN"],
  seeFinance: ["GERANT", "ASSISTANTE"],
  manageFinance: ["GERANT", "ASSISTANTE"],
  cancelInvoice: ["GERANT"],
  manageUsers: ["GERANT"],
  seeAudit: ["GERANT"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof MATRIX;

export const can = (user: Pick<SessionUser, "role">, perm: Permission) =>
  (MATRIX[perm] as Role[]).includes(user.role);

export class ForbiddenError extends Error {
  constructor() {
    super("Action non autorisée pour votre profil.");
  }
}

export function assertCan(user: SessionUser, perm: Permission) {
  if (!can(user, perm)) throw new ForbiddenError();
}

/** Filtre Prisma limitant les projets visibles par l'utilisateur. */
export const projectScope = (user: SessionUser): Prisma.ProjectWhereInput =>
  can(user, "seeAllProjects") ? {} : { members: { some: { userId: user.id } } };

export const MATRIX_TABLE = MATRIX;
