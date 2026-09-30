import type { PublicUser } from "@workflow-demo/contracts";

import type { UserRecord } from "./user-repository";

/** The only user shape that leaves the server: id, name and email (contract §2.1). */
export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}
