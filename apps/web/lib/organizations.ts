import { sql } from "@zenow/db";
import { db } from "./db";

export type Membership = { id: string; name: string; slug: string; role: string };

/**
 * Reads Neon Auth's own tables. They live in this database, and membership is
 * the authority on which workspaces a user may act in -- the session's active
 * organization is only a preference on top of it.
 */
export async function organizationsFor(userId: string): Promise<Membership[]> {
  return db().execute<Membership>(sql`
    select o.id, o.name, o.slug, m.role
      from neon_auth.member m
      join neon_auth.organization o on o.id = m."organizationId"
     where m."userId" = ${userId}
     order by o."createdAt"
  `);
}
