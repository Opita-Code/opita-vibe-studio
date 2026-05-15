// ─── DEPRECATED ─────────────────────────────────────────────────
//
// cloudAuth module was removed during the Cognito SSO migration.
// Authentication is now handled by:
//   - src/auth/sso.ts (initiateSSO, restoreSession, logout)
//   - Cognito cookies (opita_id_token, opita_access_token)
//
// These tests are no longer applicable.
// ─────────────────────────────────────────────────────────────────
import { describe, it } from "vitest";

describe("cloudAuth (DEPRECATED)", () => {
  it.skip("module removed — auth migrated to Cognito SSO", () => {});
});
