# Diseño Técnico: Edge Cases & UX Avanzada

## 1. Arquitectura de Estado (`src/stores/chat.ts`)

La estructura actual de estado cambiará de:
```typescript
interface ChatState { messages: Message[]; ... }
```
A un modelo basado en sesiones:
```typescript
interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

interface ChatState {
  sessions: Record<string, ChatSession>;
  activeSessionId: string | null;
  isStreaming: boolean;
  // ...
}
```
Se integrará `persist` de zustand, con un `createJSONStorage` usando `idb-keyval` en lugar del localStorage por defecto.

### Nuevos Métodos en `chat.ts`:
- `createNewSession()`: Genera UUID, setea `activeSessionId`.
- `switchSession(id)`: Cambia la sesión activa.
- `editMessage(messageId, newContent)`: Busca el mensaje, trunca los posteriores en la sesión actual y actualiza el contenido.
- `retryLast()`: Toma el último mensaje de usuario si la respuesta de la IA falló, y lanza la petición.

## 2. Capa de Red (`src/services/aiService.ts`)

El generador `streamAwsSse` ahora envolverá el bloque try/catch en una estructura más semántica:
- Si `err.name === 'AbortError'` -> `Yield { type: "abort" }`
- Si `!navigator.onLine` o el fetch falla catastróficamente -> `Yield { type: "error", errorType: "network" }`
- Si HTTP 429 -> `Yield { type: "error", errorType: "rate-limit" }`

## 3. Enrutamiento (`src/App.tsx`)

Se instalará `wouter`.
`App.tsx` envolverá el contenido principal en un router:
```tsx
import { Route, Switch } from "wouter";

export function App() {
  return (
    <Container>
      <Header />
      <Switch>
         <Route path="/" component={Dashboard} />
         <Route path="/chat/:id?" component={Workspace} />
      </Switch>
    </Container>
  )
}
```

## 4. Hook de Teclado (`src/lib/useKeybindings.ts`)

```typescript
export function useKeybindings() {
  const createSession = useChatStore(s => s.createNewSession);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createSession();
        setLocation('/chat');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

## 5. UI de Errores y Contexto
- Modificar `ChatPanel` para identificar si el último mensaje es de error. Si lo es, renderizar un botón "🔄 Reintentar" debajo.
- Modificar el `ChatInput` para escuchar el `ArrowUp` y setear su valor interno con el último `message.role === 'user'`.
