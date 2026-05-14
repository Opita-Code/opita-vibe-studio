# Diseño: vibe-premium-ux

## Componentes a actualizar

### `src/components/layout/ViewTabs.tsx`
- `bg-[#252526]` -> `bg-slate-900/60 backdrop-blur-md`
- `border-[#333]` -> `border-white/5`
- Active tab text: `text-white border-vibe-cyan shadow-[0_1px_10px_rgba(6,182,212,0.5)]`
- Inactive tab text: `text-slate-400 hover:text-slate-200 hover:bg-white/5`
- Hint text: `text-slate-500`

### `src/components/layout/ChatPanel.tsx`
- Contenedor: Remover `bg-[#252526] border-[#333]`. Usar `bg-slate-900/50 backdrop-blur-md border-white/5`.
- Header: `border-[#333]` -> `border-white/5`, `text-[#969696]` -> `text-slate-400`.
- Login Banner:
  ```html
  <div className="p-6 m-4 bg-slate-800/40 border border-white/5 rounded-xl shadow-2xl backdrop-blur flex flex-col items-center text-center">
    <span className="text-3xl mb-3">✨</span>
    <p className="text-sm text-slate-300 mb-4">Despierta a la IA para potenciar tu código</p>
    <button className="w-full py-2.5 bg-gradient-to-r from-vibe-purple to-vibe-cyan text-white text-sm font-medium rounded-lg shadow-lg shadow-purple-500/20 hover:scale-105 transition-transform">Iniciar Sesión</button>
  </div>
  ```

### `src/components/chat/MessageList.tsx`
- Context count border: `border-white/5`. Text: `text-slate-500`.
- Empty state text: `text-slate-400`, sub-text `text-slate-500`.
- Icon in empty state: Cambiar de 💬 a ✨ o algo estilizado con bg-gradient.

### `src/components/preview/LivePreview.tsx`
- `body { background: #0f172a; color: #cbd5e1; }`
- `.card` background removed (transparent).
- `.shortcuts` y `.tip`: `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);`
- `.logo` y `.tip-question`: `color: #a855f7;`
- `<kbd>`: `background: rgba(255,255,255,0.05); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1);`
- shortcut labels: `color: #94a3b8;`
- border bottom of shortcut rows: `border-bottom: 1px solid rgba(255,255,255,0.03)`
