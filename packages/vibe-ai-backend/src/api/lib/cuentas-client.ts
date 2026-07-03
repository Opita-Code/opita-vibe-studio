/**
 * Cuentas API Client — Vibe Studio consumer
 *
 * HTTP client for the Cuentas v3 identity hub (cuentas.opitacode.com).
 * Includes circuit breaker + retry with exponential backoff to keep the
 * Vibe backend resilient if Cuentas goes down.
 *
 * Sprint: 2026-07-03-cuentas-v3-consumer-vibe (T-1)
 * Spec: openspec/changes/2026-07-03-cuentas-v3-consumer-vibe
 *
 * Usage:
 *   import { cuentasClient } from './cuentas-client';
 *   const whoami = await cuentasClient.getWhoami(jwt);
 *
 * Env vars:
 *   CUENTAS_API_URL  — base URL of the Cuentas API
 */

const DEFAULT_BASE_URL =
  'https://t34gmfzvi3ccwvy7q53mnk6dwm0lpkua.lambda-url.us-east-1.on.aws';

const BASE_URL = process.env.CUENTAS_API_URL || DEFAULT_BASE_URL;
// Read fresh on each call so tests can override via env var
const getTimeout = () => parseInt(process.env.CUENTAS_TIMEOUT_MS || '5000', 10);

// ─── Circuit breaker ────────────────────────────────────────────────────────

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 60_000;

class CircuitOpenError extends Error {
  constructor(msUntilRetry) {
    super(`Cuentas circuit open — refusing call for ${msUntilRetry}ms`);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
    this.msUntilRetry = msUntilRetry;
  }
}

const circuit = {
  state: 'closed', // 'closed' | 'open' | 'half-open'
  failures: [],
  openedAt: 0,
  halfOpenInFlight: false,

  recordFailure() {
    const now = Date.now();
    this.failures = this.failures.filter((t) => now - t < CIRCUIT_OPEN_DURATION_MS);
    this.failures.push(now);
    if (this.failures.length >= CIRCUIT_FAILURE_THRESHOLD && this.state === 'closed') {
      this.state = 'open';
      this.openedAt = now;
      console.warn(`[cuentas-client] Circuit OPENED after ${this.failures.length} failures`);
    }
  },

  recordSuccess() {
    if (this.state !== 'closed') {
      console.info(`[cuentas-client] Circuit CLOSED after successful call`);
    }
    this.state = 'closed';
    this.failures = [];
  },

  canCall() {
    if (this.state === 'closed') return { allowed: true };
    if (this.state === 'open') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= CIRCUIT_OPEN_DURATION_MS) {
        this.state = 'half-open';
        this.halfOpenInFlight = false;
        console.info(`[cuentas-client] Circuit transitioned to HALF-OPEN`);
        return { allowed: true };
      }
      return { allowed: false, msUntilRetry: CIRCUIT_OPEN_DURATION_MS - elapsed };
    }
    if (!this.halfOpenInFlight) {
      this.halfOpenInFlight = true;
      return { allowed: true };
    }
    return { allowed: false, msUntilRetry: 1000 };
  },

  releaseHalfOpenProbe() {
    this.halfOpenInFlight = false;
  },
};

// ─── Retry helper ───────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [100, 500, 2000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callCuentas(path, { jwt = null, method = 'GET', body = null } = {}) {
  const gate = circuit.canCall();
  if (!gate.allowed) {
    throw new CircuitOpenError(gate.msUntilRetry);
  }

  const headers = { Accept: 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  if (body) headers['Content-Type'] = 'application/json';

  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);

  const url = `${BASE_URL}${path}`;
  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, getTimeout());

      if (res.ok) {
        circuit.recordSuccess();
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      }

      if (res.status >= 400 && res.status < 500) {
        circuit.recordSuccess();
        let errBody = {};
        try { errBody = await res.json(); } catch { /* not JSON */ }
        const err = new Error(errBody.error?.message || `HTTP ${res.status}`);
        err.name = 'ApiError';
        err.status = res.status;
        err.code = errBody.error?.code || `HTTP_${res.status}`;
        err.requestId = errBody.requestId;
        throw err;
      }

      lastError = new Error(`HTTP ${res.status}`);
      lastError.status = res.status;
    } catch (err) {
      if (err instanceof CircuitOpenError) throw err;
      if (err.name === 'ApiError') throw err;
      lastError = err;
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  circuit.recordFailure();
  throw lastError || new Error('Cuentas request failed after retries');
}

// ─── Public API ────────────────────────────────────────────────────────────

export const cuentasClient = {
  async getWhoami(jwt) {
    return callCuentas('/v1/whoami', { jwt });
  },

  async getMySellos(jwt) {
    return callCuentas('/v1/me/sellos', { jwt });
  },

  async getMyOrgs(jwt) {
    return callCuentas('/v1/me/orgs', { jwt });
  },

  async getMyCapabilities(jwt) {
    return callCuentas('/v1/capabilities', { jwt });
  },

  async getProducts() {
    return callCuentas('/v1/products', { jwt: null });
  },

  async putActiveContext(jwt, context) {
    return callCuentas('/v1/me/active-context', { jwt, method: 'PUT', body: context });
  },

  // For tests
  _circuit: circuit,
  _CircuitOpenError: CircuitOpenError,
};

export { CircuitOpenError, BASE_URL };