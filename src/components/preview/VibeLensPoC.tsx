import { useEffect, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";

const COMPONENT_CODE = `
import React from 'react';

export default function MiComponente() {
  return (
    <div className="p-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-2xl text-white font-sans text-center max-w-sm mx-auto mt-10 transition-transform hover:scale-105">
      <h1 className="text-2xl font-bold mb-2">✨ VibeLens PoC ✨</h1>
      <p className="text-indigo-100 mb-4">Este componente se está renderizando dinámicamente en aislamiento total.</p>
      <button className="px-4 py-2 bg-white text-purple-600 font-semibold rounded-lg shadow-md hover:bg-purple-50 transition-colors">
        ¡Funciona increíble!
      </button>
    </div>
  );
}
`;

const APP_CODE = `
import React from 'react';
import MiComponente from './MiComponente';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 p-8 flex items-center justify-center">
      <MiComponente />
    </div>
  );
}
`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VibeLens Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

function PerformanceMonitor() {
  const { sandpack } = useSandpack();
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (sandpack.status === "running") {
      setLoadTime(Date.now() - startTime);
    }
  }, [sandpack.status, startTime]);

  return (
    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-1 rounded-md z-50 font-mono flex flex-col gap-1">
      <div className="flex justify-between gap-4">
        <span className="text-slate-400">Status:</span>
        <span className={sandpack.status === "running" ? "text-green-400" : "text-yellow-400"}>{sandpack.status}</span>
      </div>
      {loadTime !== null && (
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Boot Time:</span>
          <span className="text-cyan-400">{loadTime}ms</span>
        </div>
      )}
    </div>
  );
}

export function VibeLensPoC() {
  return (
    <div className="w-full h-full relative flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      <div className="flex items-center px-4 py-2 bg-black/40 border-b border-white/5 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-vibe-purple flex items-center gap-2">
          <span className="animate-pulse">✨</span> VibeLens PoC (Performance Test)
        </span>
      </div>
      
      <div className="flex-1 relative">
        <SandpackProvider
          template="react-ts"
          theme="dark"
          files={{
            "/App.tsx": APP_CODE,
            "/MiComponente.tsx": COMPONENT_CODE,
            "/public/index.html": INDEX_HTML,
          }}
          options={{
            classes: {
              "sp-wrapper": "h-full w-full",
              "sp-layout": "h-full w-full bg-transparent border-0",
              "sp-preview": "h-full w-full",
              "sp-preview-iframe": "h-full w-full",
            },
            initMode: "user-visible"
          }}
        >
          <SandpackLayout>
            <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={true} />
            <PerformanceMonitor />
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
