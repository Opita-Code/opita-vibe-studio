import { useSessionBoot } from "@/hooks/useSessionBoot";
import { usePaymentRedirect } from "@/hooks/usePaymentRedirect";
import { useWorkspaceReopen } from "@/hooks/useWorkspaceReopen";
import { useAutoSync } from "@/hooks/useAutoSync";

/**
 * AppLifecycle — Composes all app-level side effects.
 *
 * Replaces the legacy LegacyLogicManager with dedicated hooks:
 * - useSessionBoot: Cognito/legacy session detection + BYOK loading
 * - usePaymentRedirect: Wompi payment_success URL param handling
 * - useWorkspaceReopen: Auto-reopen workspaces after persist hydration
 * - useAutoSync: Prudent cloud sync (5min + visibility change)
 */
export function AppLifecycle() {
  useSessionBoot();
  usePaymentRedirect();
  useWorkspaceReopen();
  useAutoSync();

  return null;
}
