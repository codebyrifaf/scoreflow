/**
 * Operator data access — the one place that reads operator (platform admin) rows.
 *
 * An "operator" is a ScoreFlow platform admin (see the `Operator` model in
 * prisma/schema.prisma). Unlike an owner, an operator isn't tied to a restaurant;
 * they manage the whole list of restaurants at /admin. Auth uses this to verify
 * an operator login.
 */

import { prisma } from "./prisma";

/**
 * Look up an operator by email. Returns the operator or `null` if none matches.
 * `email` is unique in the schema, so this matches at most one row. Callers
 * should normalise the address (trim + lowercase) before calling.
 */
export async function getOperatorByEmail(email: string) {
  return prisma.operator.findUnique({ where: { email } });
}
