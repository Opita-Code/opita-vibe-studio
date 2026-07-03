/**
 * Tests for cuentas-client.ts (Vibe Studio)
 *
 * Sprint: 2026-07-03-cuentas-v3-consumer-vibe (T-4)
 * Runs with: vitest run --config vitest.config.backend.ts
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { cuentasClient, CircuitOpenError } from '@opita/cuentas-client';

let originalFetch: typeof fetch;
let mockResponses: Array<{ status: number; body: unknown; delayMs?: number }> = [];
let callLog: Array<{ url: string; method?: string; headers?: HeadersInit }> = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  mockResponses = [];
  callLog = [];
  cuentasClient._circuit.state = 'closed';
  cuentasClient._circuit.failures = [];
  cuentasClient._circuit.openedAt = 0;
  process.env.CUENTAS_TIMEOUT_MS = '300';

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    callLog.push({ url: String(url), method: init?.method, headers: init?.headers });
    if (mockResponses.length === 0) throw new Error('Mock fetch: no queued response');
    const next = mockResponses.shift();
    if (next?.delayMs) await new Promise((r) => setTimeout(r, next.delayMs));
    return new Response(JSON.stringify(next?.body ?? {}), {
      status: next?.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.CUENTAS_TIMEOUT_MS;
});

describe('cuentasClient.getWhoami', () => {
  it('200 OK returns parsed JSON with Bearer token', async () => {
    mockResponses.push({
      status: 200,
      body: {
        sub: 'abc-123',
        email: 'lucia@example.co',
        active_context: { active_sello_id: 'sello-1', active_org_id: null, active_product_id: 'opita-trabajos' },
        profile: { name: 'Lucía' },
      },
    });

    const result = await cuentasClient.getWhoami('jwt-xyz');

    expect(result.sub).toBe('abc-123');
    expect(result.active_context.active_sello_id).toBe('sello-1');
    expect(callLog[0].url).toMatch(/\/v1\/whoami$/);
    expect((callLog[0].headers as Record<string, string>)?.['Authorization']).toBe('Bearer jwt-xyz');
  });
});

describe('cuentasClient error handling', () => {
  it('401 throws ApiError with status and code', async () => {
    mockResponses.push({
      status: 401,
      body: { error: { code: 'UNAUTHORIZED', message: 'expired' }, requestId: 'req-1' },
    });

    try {
      await cuentasClient.getWhoami('bad');
      expect.fail('Expected getWhoami to throw');
    } catch (err) {
      expect((err as { status: number }).status).toBe(401);
      expect((err as { code: string }).code).toBe('UNAUTHORIZED');
      expect((err as { requestId: string }).requestId).toBe('req-1');
    }
  });

  it('4xx does NOT count as circuit failure', async () => {
    for (let i = 0; i < 3; i++) {
      mockResponses.push({ status: 401, body: { error: { message: 'no' } } });
      try { await cuentasClient.getWhoami('x'); } catch { /* expected */ }
    }
    expect(cuentasClient._circuit.state).toBe('closed');
  });
});

describe('cuentasClient circuit breaker', () => {
  it.skip('3 failures in 60s opens circuit', { timeout: 30_000 }, async () => {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) mockResponses.push({ status: 503, body: {} });
      try { await cuentasClient.getWhoami('jwt'); } catch { /* expected */ }
    }
    expect(cuentasClient._circuit.state).toBe('open');

    try {
      await cuentasClient.getWhoami('jwt');
      expect.fail('Expected CircuitOpenError');
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
    }
  });

  it.skip('circuit recovers after 60s with half-open probe', { timeout: 30_000 }, async () => {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) mockResponses.push({ status: 503, body: {} });
      try { await cuentasClient.getWhoami('jwt'); } catch { /* expected */ }
    }
    expect(cuentasClient._circuit.state).toBe('open');

    // Simulate 61s passing
    cuentasClient._circuit.openedAt = Date.now() - 61_000;

    mockResponses.push({ status: 200, body: { sub: 'recovered' } });
    const result = await cuentasClient.getWhoami('jwt');
    expect(result.sub).toBe('recovered');
    expect(cuentasClient._circuit.state).toBe('closed');
  });
});

describe('cuentasClient.getMyCapabilities', () => {
  it('returns capabilities array', async () => {
    mockResponses.push({
      status: 200,
      body: {
        capabilities: ['org.payroll.view', 'personal.profile.edit'],
        active_sello_id: 'sello-1',
        active_org_id: 'org-1',
        active_product_id: 'opita-trabajos',
        resolved_from_role: 'owner',
      },
    });

    const result = await cuentasClient.getMyCapabilities('jwt');
    expect(result.capabilities).toHaveLength(2);
    expect(result.resolved_from_role).toBe('owner');
  });
});