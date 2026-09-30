import argon2 from "argon2";

import type { PasswordHashingCost } from "../../../config/env";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

/** argon2id hashing. Cost parameters come from config; only tests lower them. */
export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly cost: PasswordHashingCost) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: this.cost.timeCost,
      memoryCost: this.cost.memoryCost,
      parallelism: this.cost.parallelism,
    });
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }
}
