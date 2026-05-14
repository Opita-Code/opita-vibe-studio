# Proposal: Cloud Context Memory (Fase 1 — Vibe Studio Pilot)

## Intent

Opita no tiene memoria de usuario cross-platform: auth es mock (`user-${Date.now()}` local), preferencias y metadata se pierden al cerrar la app. Esta fase construye la base: identidad unificada real + persistencia cloud + captura de metadata con consentimiento, con Vibe Studio como piloto.

## Scope

### In Scope
- Supabase BaaS: Auth (Google OAuth + email OTP), PostgreSQL, Row-Level Security
- `packages/opita-cloud-context/` — SDK TypeScript compartido (tipos, cliente, sync)
- Auth real reemplazando mock (migración automática por email)
- Persistencia cloud de preferencias UI y eventos de aprendizaje
- Captura de eventos de uso anonimizados (metadata implícita, opt-in)
- UI de consentimiento GDPR en Settings > Privacidad
- Política de privacidad y términos vinculados desde la app

### Out of Scope
- opita-os y otros productos (SDK preparado para futuro, no integrado)
- Chat history cloud, BYOK keys cloud, offline-first sync, analytics dashboard (Fase 2)
- Cloudflare Workers migration (Supabase first)

## Capabilities

### New Capabilities
- `cloud-context-memory`: Persistencia cloud de contexto cross-device, sync bidireccional, metadata de uso
- `unified-identity`: Identidad Opita global vía Supabase Auth (OAuth/OIDC), JWT firmados, refresh tokens
- `privacy-consent`: UI de consentimiento GDPR, toggle opt-in/opt-out, política de privacidad vinculada

### Modified Capabilities
- `auth`: Mock localStorage → Supabase Auth real (OAuth, ID global, sesiones SQLite)
- `settings-panel`: Nueva pestaña "Privacidad" con controles de consentimiento

## Approach

**Supabase BaaS** como backend único. SDK `@opita/cloud-context` como paquete npm privado. Tres pilares:

1. **Identidad**: Supabase Auth (Google + email OTP). JWT firmados. ID global (`auth.uid()`). Migración automática de sesiones locales por email.
2. **Persistencia**: Tabla `cloud_context` con RLS por `user_id`. Stores Zustand (`ui`, `learning`) syncean vía SDK en segundo plano.
3. **Metadata + consentimiento**: Eventos anonimizados con toggle opt-in. Panel Privacidad con control granular.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/opita-cloud-context/` | New | SDK compartido (tipos, cliente, sync) |
| `src/stores/auth.ts` | Modified | Mock → Supabase Auth client |
| `src/auth/sso.ts` | Modified | Flujo OAuth real |
| `src/stores/ui.ts`, `learning.ts` | Modified | Sync cloud de preferencias y eventos |
| `src/components/settings/` | Modified | Pestaña Privacidad + consentimiento |
| `src-tauri/tauri.conf.json` | Modified | `connect-src` para Supabase |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking change: usuarios pierden sesiones locales | High | Migración automática por email; aviso previo |
| Scope creep: extender a todos los productos | High | Scope acotado; Fase 2 como change separado |
| Riesgo legal GDPR | Medium | Opt-in ANTES de recolectar; política publicada |
| Vendor lock-in Supabase | Low | SDK abstrae backend; migrable en Fase 2 |
| Costo escala con uso | Low | Tier gratuito (50K MAU, 500MB DB) suficiente |

## Rollback Plan

1. SDK con flag `CLOUD_ENABLED` — desactivar revierte a localStorage
2. Store auth mantiene fallback localStorage si Supabase no responde
3. Consentimiento por defecto opt-out (cero recolección sin acción explícita)
4. App funciona en modo offline completo si Supabase es inaccesible

## Dependencies

- Proyecto Supabase creado (org: opitacode)
- Dominio `api.opita.co` → Supabase
- Documento legal: política de privacidad + términos (requiere abogado)
- `@supabase/supabase-js`, `@supabase/ssr`

## Success Criteria

- [ ] Registro/login con Google OAuth real (no mock)
- [ ] Preferencias UI persisten entre dispositivos con misma cuenta
- [ ] Eventos de aprendizaje enviados a Supabase (solo si opt-in)
- [ ] Panel Privacidad con toggles funcionales de consentimiento
- [ ] Política de privacidad accesible desde la app
- [ ] SDK `@opita/cloud-context` publicado como paquete npm privado
- [ ] Quality gates pasan: `npm test && npm run typecheck && npm run lint`
