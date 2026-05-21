// ─── ChatGPT / Codex OAuth Authentication ─────────────────────
//
// Multi-platform OAuth module for obtaining Codex API access tokens.
//
// Tauri desktop → PKCE flow with localhost redirect (seamless)
// Web / Mobile  → Device Code Flow with polling (no redirect needed)
//
// Uses the public Codex CLI client ID — same as OpenCode.

// ─── Constants ──────────────────────────────────────────────────

export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE = "https://auth.openai.com";
const OAUTH_AUTHORIZE = `${AUTH_BASE}/oauth/authorize`;
const OAUTH_TOKEN = `${AUTH_BASE}/oauth/token`;
const DEVICE_AUTHORIZE = `${AUTH_BASE}/oauth/device/code`;
const OAUTH_SCOPES = "openid profile email offline_access";
const REDIRECT_URI = "http://localhost:1455/auth/callback";

// Characters safe for PKCE verifier (RFC 7636 §4.1)
const PKCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

// ─── Types ──────────────────────────────────────────────────────

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
}

export interface DeviceCodePending {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

// ─── PKCE Helpers ───────────────────────────────────────────────

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => PKCE_CHARS[b % PKCE_CHARS.length]).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Platform Detection ─────────────────────────────────────────

function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// ─── Strategy 1: PKCE Flow (Tauri Desktop) ──────────────────────
//
// 1. Generate PKCE verifier + challenge
// 2. Open browser with auth URL
// 3. Tauri backend catches the redirect, emits `oauth_code` event
// 4. Exchange code for tokens
//

export async function startPKCEFlow(): Promise<OAuthTokens> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  const authUrl =
    `${OAUTH_AUTHORIZE}?` +
    new URLSearchParams({
      response_type: "code",
      client_id: CODEX_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: OAUTH_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
    }).toString();

  // Tell Tauri backend the expected state for CSRF validation
  const { emit } = await import("@tauri-apps/api/event");
  await emit("oauth_set_state", state);

  // Open browser
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(authUrl);

  // Wait for Tauri backend to capture the redirect and emit the code
  return new Promise<OAuthTokens>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("OAuth timeout: no se recibió respuesta en 5 minutos."));
      }
    }, 5 * 60 * 1000);

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<string>("oauth_code", async (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        try {
          const tokens = await exchangeCodeForTokens(
            event.payload,
            codeVerifier
          );
          resolve(tokens);
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

// ─── Strategy 2: Device Code Flow (Web + Mobile) ────────────────
//
// 1. Request device code from OpenAI
// 2. Show user_code + verification_uri to user
// 3. Poll token endpoint until user completes auth
//
// Returns a DeviceCodePending first (so UI can show the code),
// then resolves tokens via polling.

export async function requestDeviceCode(): Promise<DeviceCodePending> {
  const response = await fetch(DEVICE_AUTHORIZE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CODEX_CLIENT_ID,
      scope: OAUTH_SCOPES,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Device code request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri || "https://auth.openai.com/codex/device",
    expiresIn: data.expires_in || 600,
    interval: data.interval || 5,
  };
}

export async function pollForDeviceToken(
  pending: DeviceCodePending,
  signal?: AbortSignal
): Promise<OAuthTokens> {
  const deadline = Date.now() + pending.expiresIn * 1000;
  let interval = pending.interval * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("Autenticación cancelada por el usuario.");
    }

    await new Promise((r) => setTimeout(r, interval));

    const response = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CODEX_CLIENT_ID,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: pending.deviceCode,
      }).toString(),
    });

    const data = await response.json();

    if (data.access_token) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? "",
        expiresAt: new Date(
          Date.now() + (data.expires_in ?? 3600) * 1000
        ).toISOString(),
      };
    }

    if (data.error === "slow_down") {
      interval += 5000; // RFC 8628 §3.5
      continue;
    }

    if (data.error === "authorization_pending") {
      continue;
    }

    // Any other error is fatal
    throw new Error(
      data.error_description || data.error || "Error desconocido en autenticación."
    );
  }

  throw new Error("El código de dispositivo expiró. Intenta de nuevo.");
}

// ─── Token Exchange ─────────────────────────────────────────────

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<OAuthTokens> {
  // Use tauriFetch in Tauri to avoid CORS
  const doFetch = isTauriEnv()
    ? (await import("@tauri-apps/plugin-http")).fetch
    : globalThis.fetch;

  const response = await doFetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CODEX_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      data.error_description || "No se recibió access_token de OpenAI."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt: new Date(
      Date.now() + (data.expires_in ?? 3600) * 1000
    ).toISOString(),
  };
}

// ─── Token Refresh ──────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthTokens> {
  const doFetch = isTauriEnv()
    ? (await import("@tauri-apps/plugin-http")).fetch
    : globalThis.fetch;

  const response = await doFetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CODEX_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      data.error_description || "No se pudo renovar el token. Inicia sesión nuevamente."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken, // Some providers rotate
    expiresAt: new Date(
      Date.now() + (data.expires_in ?? 3600) * 1000
    ).toISOString(),
  };
}

// ─── Auto-refresh Helper ────────────────────────────────────────
//
// Reads token from byok-store, checks expiry, auto-refreshes if
// within 5 minutes of expiration.

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 min before expiry

export async function getValidToken(): Promise<string> {
  const { getProviderKey, saveProviderKey } = await import("@/lib/byok-store");

  const entry = await getProviderKey("chatgpt-web");
  if (!entry?.key) {
    throw new Error("No hay token de ChatGPT. Conecta tu cuenta primero.");
  }

  // If no expiresAt stored, assume it's valid (legacy entries)
  if (!entry.expiresAt) {
    return entry.key;
  }

  const expiresAt = new Date(entry.expiresAt).getTime();
  const needsRefresh = Date.now() + TOKEN_REFRESH_MARGIN_MS >= expiresAt;

  if (!needsRefresh) {
    return entry.key;
  }

  // Needs refresh
  if (!entry.refreshToken) {
    throw new Error(
      "Token expirado y sin refresh_token. Vuelve a iniciar sesión."
    );
  }

  const tokens = await refreshAccessToken(entry.refreshToken);

  // Persist updated tokens
  await saveProviderKey("chatgpt-web", tokens.accessToken, undefined, {
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });

  // Also update the live provider in the registry
  const { registerProvider } = await import("@/providers/registry");
  const { createChatGPTWebProvider } = await import("@/providers/chatgpt-web");
  registerProvider(createChatGPTWebProvider(tokens.accessToken));

  return tokens.accessToken;
}

// ─── Unified Entry Point ────────────────────────────────────────
//
// Picks the best auth strategy for the current platform.
// Returns tokens on success.

export type AuthFlowResult =
  | { type: "tokens"; tokens: OAuthTokens }
  | { type: "device_code"; pending: DeviceCodePending };

export async function startAuth(): Promise<AuthFlowResult> {
  if (isTauriEnv()) {
    const tokens = await startPKCEFlow();
    return { type: "tokens", tokens };
  }

  // Web / Mobile → Device Code Flow
  const pending = await requestDeviceCode();
  return { type: "device_code", pending };
}
