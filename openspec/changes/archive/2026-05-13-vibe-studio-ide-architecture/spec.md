# Specs: Vibe Studio IDE Architecture

## Domain: Core Host API

### 1. The Extension Context Contract
Every extension will receive an `ExtensionContext` upon activation. This is the only way extensions can interact with the engine.

```typescript
export interface ExtensionContext {
  id: string;
  subscriptions: { dispose: () => void }[];
  
  // Contributions
  commands: CommandRegistry;
  views: ViewRegistry;
  
  // System Services
  storage: StorageService;
  auth: AuthService;
  events: EventBus;
}
```

### 2. View Registration (Slot System)
Extensions provide React components to the core, which the Renderer will mount.

```typescript
context.views.registerView('sidebar.ai', {
  id: 'vibe.ai.chat',
  title: 'VibeLens',
  component: lazy(() => import('./views/AIChatView')),
  icon: 'SparklesIcon'
});
```

### 3. Core Services
The Host will initialize these singletons before any extension loads.
- `AuthService`: Connects to `accounts.opitacode.com`, exposes `getToken()`, `onAuthStateChanged()`.
- `StorageService`: Abstraction over IndexedDB (local) and S3 (remote).
- `CommandRegistry`: Stores executable actions (`vibe.file.new`, `vibe.ai.explain`).

## Domain: The Renderer (React)
React must not hold business logic. It reads from the `ViewRegistry` and renders layout slots.

```tsx
// Example Renderer Slot
export function SidebarSlot() {
  const views = useCoreStore(state => state.views.filter(v => v.target === 'sidebar'));
  
  return (
    <div className="flex flex-col bg-glass">
      {views.map(View => <View.component key={View.id} />)}
    </div>
  );
}
```
