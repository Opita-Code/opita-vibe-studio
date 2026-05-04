function App() {
  return (
    <div className="flex h-full w-full bg-[#1e1e1e] text-[#d4d4d4]">
      {/* Sidebar — file tree placeholder */}
      <aside className="flex w-60 flex-col border-r border-[#333] bg-[#252526]">
        <div className="flex items-center justify-between border-b border-[#333] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#969696]">
            Explorador
          </span>
        </div>
        <div className="flex-1 p-4">
          <p className="text-sm text-[#616161]">Abrí un proyecto para empezar</p>
        </div>
      </aside>

      {/* Main area: editor + preview */}
      <main className="flex flex-1 flex-col">
        {/* Editor area placeholder */}
        <section className="flex-1">
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#616161]">Editor de código</p>
          </div>
        </section>

        {/* Preview area placeholder */}
        <section className="h-1/3 border-t border-[#333]">
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#616161]">Vista previa en vivo</p>
          </div>
        </section>
      </main>

      {/* Chat overlay placeholder */}
      <aside className="flex w-80 flex-col border-l border-[#333] bg-[#252526]">
        <div className="flex items-center justify-between border-b border-[#333] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#969696]">
            Chat
          </span>
        </div>
        <div className="flex-1 p-4">
          <p className="text-sm text-[#616161]">Escribí en español lo que querés crear</p>
        </div>
      </aside>
    </div>
  );
}

export default App;
