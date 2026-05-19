/**
 * Interactive IDE Mockup — Landing Page
 * Picks a random scenario, animates code + chat, functional input redirects to /app/
 */
const SCENARIOS = [
  {
    prompt: "Hazme un reproductor de música con fondo de cristal",
    project: "mi-reproductor",
    files: ["App.tsx", "GlassPlayer.tsx", "index.css"],
    activeFile: "App.tsx",
    createdFile: "GlassPlayer.tsx",
    code: `import { useState } from 'react';
import GlassPlayer from './GlassPlayer';

export default function App() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950">
      <h1 className="text-4xl font-bold p-8">
        Mi Reproductor
      </h1>
      <GlassPlayer isPlaying={playing} />
    </div>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo App.tsx" },
      { done: true, text: "Creando GlassPlayer.tsx" },
      { done: false, text: "Editando App.tsx:12" }
    ],
    response: "Listo. Creé GlassPlayer.tsx con backdrop-blur y lo importé en App.",
    filesChanged: 2
  },
  {
    prompt: "Crea un dashboard de ventas con gráficas en tiempo real",
    project: "sales-dashboard",
    files: ["Dashboard.tsx", "SalesChart.tsx", "api.ts"],
    activeFile: "Dashboard.tsx",
    createdFile: "SalesChart.tsx",
    code: `import { useEffect, useState } from 'react';
import SalesChart from './SalesChart';
import { fetchSales } from './api';

export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchSales().then(setData);
  }, []);

  return (
    <main className="p-6 bg-zinc-900">
      <h1 className="text-2xl mb-4">Ventas</h1>
      <SalesChart data={data} />
    </main>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo Dashboard.tsx" },
      { done: true, text: "Creando SalesChart.tsx" },
      { done: false, text: "Conectando api.ts" }
    ],
    response: "Creé el componente SalesChart con Recharts y lo conecté al endpoint de ventas.",
    filesChanged: 3
  },
  {
    prompt: "Hazme un chat en tiempo real con WebSockets",
    project: "chat-app",
    files: ["ChatRoom.tsx", "MessageList.tsx", "socket.ts"],
    activeFile: "ChatRoom.tsx",
    createdFile: "MessageList.tsx",
    code: `import { useState, useRef } from 'react';
import MessageList from './MessageList';
import { useSocket } from './socket';

export default function ChatRoom() {
  const [msg, setMsg] = useState('');
  const { messages, send } = useSocket();

  const handleSend = () => {
    if (msg.trim()) {
      send(msg);
      setMsg('');
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={messages} />
      <input value={msg} onChange={e =>
        setMsg(e.target.value)} />
    </div>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo ChatRoom.tsx" },
      { done: true, text: "Creando socket.ts" },
      { done: false, text: "Editando ChatRoom.tsx:9" }
    ],
    response: "Configuré WebSocket con reconexión automática y creé MessageList con scroll infinito.",
    filesChanged: 3
  },
  {
    prompt: "Necesito un formulario de registro con validación",
    project: "auth-forms",
    files: ["RegisterForm.tsx", "validators.ts", "styles.css"],
    activeFile: "RegisterForm.tsx",
    createdFile: "validators.ts",
    code: `import { useState } from 'react';
import { validate } from './validators';

export default function RegisterForm() {
  const [form, setForm] = useState({
    email: '', password: '', name: ''
  });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length === 0) {
      // submit
    }
    setErrors(errs);
  };

  return (
    <form onSubmit={handleSubmit}
      className="max-w-md mx-auto p-8">
      {/* fields */}
    </form>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo RegisterForm.tsx" },
      { done: true, text: "Creando validators.ts" },
      { done: false, text: "Agregando estilos" }
    ],
    response: "Creé validators.ts con Zod y agregué feedback visual de errores inline.",
    filesChanged: 2
  },
  {
    prompt: "Crea una galería de imágenes con lightbox y lazy loading",
    project: "photo-gallery",
    files: ["Gallery.tsx", "Lightbox.tsx", "useImages.ts"],
    activeFile: "Gallery.tsx",
    createdFile: "Lightbox.tsx",
    code: `import { useState } from 'react';
import Lightbox from './Lightbox';
import { useImages } from './useImages';

export default function Gallery() {
  const images = useImages();
  const [selected, setSelected] = useState(null);

  return (
    <div className="columns-3 gap-4 p-6">
      {images.map((img, i) => (
        <img key={i} src={img.thumb}
          loading="lazy"
          onClick={() => setSelected(i)}
          className="rounded-xl mb-4 cursor-pointer
            hover:scale-105 transition" />
      ))}
      {selected !== null && (
        <Lightbox images={images} index={selected}
          onClose={() => setSelected(null)} />
      )}
    </div>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo Gallery.tsx" },
      { done: true, text: "Creando Lightbox.tsx" },
      { done: false, text: "Optimizando lazy load" }
    ],
    response: "Creé Lightbox con gestos swipe y agregué lazy loading con IntersectionObserver.",
    filesChanged: 2
  },
  {
    prompt: "Hazme un kanban board tipo Trello",
    project: "task-board",
    files: ["Board.tsx", "Column.tsx", "Card.tsx"],
    activeFile: "Board.tsx",
    createdFile: "Column.tsx",
    code: `import { useState } from 'react';
import Column from './Column';

const INITIAL = {
  todo: ['Diseñar UI', 'Setup DB'],
  doing: ['Auth flow'],
  done: ['Landing page']
};

export default function Board() {
  const [cols, setCols] = useState(INITIAL);

  const moveCard = (from, to, idx) => {
    const card = cols[from][idx];
    setCols(prev => ({
      ...prev,
      [from]: prev[from].filter((_, i) =>
        i !== idx),
      [to]: [...prev[to], card]
    }));
  };

  return (
    <div className="flex gap-4 p-6 h-screen">
      {Object.entries(cols).map(([k, v]) =>
        <Column key={k} title={k} cards={v}
          onMove={moveCard} />
      )}
    </div>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo Board.tsx" },
      { done: true, text: "Creando Column.tsx" },
      { done: false, text: "Agregando drag & drop" }
    ],
    response: "Creé Column y Card con drag & drop nativo usando HTML5 DnD API.",
    filesChanged: 3
  },
  {
    prompt: "Un timer pomodoro con sonido y notificaciones",
    project: "pomodoro-app",
    files: ["Timer.tsx", "Controls.tsx", "sounds.ts"],
    activeFile: "Timer.tsx",
    createdFile: "Controls.tsx",
    code: `import { useState, useEffect } from 'react';
import Controls from './Controls';
import { playBell } from './sounds';

export default function Timer() {
  const [seconds, setSeconds] = useState(1500);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          playBell();
          setActive(false);
          return 1500;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex flex-col items-center
      justify-center h-screen bg-zinc-950">
      <span className="text-8xl font-mono">
        {mins}:{String(secs).padStart(2,'0')}
      </span>
      <Controls active={active}
        onToggle={() => setActive(!active)} />
    </div>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo Timer.tsx" },
      { done: true, text: "Creando sounds.ts" },
      { done: false, text: "Editando Timer.tsx:14" }
    ],
    response: "Timer listo con Web Audio API para el sonido y Notification API para alertas.",
    filesChanged: 3
  },
  {
    prompt: "Crea un landing page para mi startup de delivery",
    project: "delivery-landing",
    files: ["Hero.tsx", "Features.tsx", "Pricing.tsx"],
    activeFile: "Hero.tsx",
    createdFile: "Features.tsx",
    code: `export default function Hero() {
  return (
    <section className="min-h-screen flex
      items-center justify-center bg-gradient-to-br
      from-orange-500 to-red-600">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">
          RapidEats
        </h1>
        <p className="text-xl opacity-80 mb-8">
          Tu comida favorita en 30 minutos
        </p>
        <button className="px-8 py-4 bg-white
          text-orange-600 rounded-full font-bold
          hover:scale-105 transition">
          Pedir ahora
        </button>
      </div>
    </section>
  );
}`,
    roadmap: [
      { done: true, text: "Leyendo Hero.tsx" },
      { done: true, text: "Creando Features.tsx" },
      { done: false, text: "Creando Pricing.tsx" }
    ],
    response: "Hero con gradiente y CTA. Creé Features con iconos SVG y Pricing con 3 planes.",
    filesChanged: 3
  }
];

// ─── Syntax highlighting (simple) ────────────────────────────
function highlight(code) {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(import|export|default|function|const|let|return|from|if|else|new|typeof|void)\b/g, '<span class="text-aura-purple">$1</span>')
    .replace(/\b(useState|useEffect|useRef|useCallback|useMemo)\b/g, '<span class="text-aura-cyan">$1</span>')
    .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-orange-400/80">$1</span>')
    .replace(/(className|key|src|loading|onClick|onChange|onSubmit|onClose|onMove|onToggle|value|href|target|rel)(?==)/g, '<span class="text-aura-cyan">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '<span class="text-green-400/80">$1</span>')
    .replace(/\/\/.*/g, '<span class="text-white/25">$&</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-orange-400/80">$1</span>');
}

// ─── Render ──────────────────────────────────────────────────
function initMockup() {
  const s = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

  // Project name
  const projEl = document.getElementById('mock-project');
  if (projEl) projEl.textContent = s.project;

  // File tree
  const treeEl = document.getElementById('mock-filetree');
  if (treeEl) {
    treeEl.innerHTML = s.files.map((f, i) => {
      const isActive = f === s.activeFile;
      const cls = isActive ? 'text-aura-cyan bg-white/5 rounded px-1 py-0.5 -mx-1' : 'text-white/40';
      return `<div class="flex items-center gap-1.5 ${cls}">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <span>${f}</span>
      </div>`;
    }).join('');
  }

  // Tabs
  const tabsEl = document.getElementById('mock-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = s.files.slice(0, 2).map((f, i) =>
      `<div class="px-4 py-2 text-xs ${i === 0 ? 'border-b-2 border-aura-cyan text-white/90 bg-white/5' : 'text-white/30'}">${f}</div>`
    ).join('');
  }

  // Line numbers + code
  const lines = s.code.split('\n');
  const numsEl = document.getElementById('mock-linenums');
  if (numsEl) numsEl.textContent = lines.map((_, i) => String(i + 1).padStart(2, ' ')).join('\n');

  const codeEl = document.getElementById('mock-code');
  if (codeEl) codeEl.innerHTML = highlight(s.code);

  // Glow line
  const glowEl = document.getElementById('mock-glow');
  if (glowEl) {
    const glowLine = Math.min(lines.length - 2, 11);
    glowEl.style.top = `calc(1rem + ${glowLine} * 1.65rem)`;
  }

  // User message
  const msgEl = document.getElementById('mock-user-msg');
  if (msgEl) msgEl.textContent = s.prompt;

  // Roadmap
  const roadEl = document.getElementById('mock-roadmap');
  if (roadEl) {
    roadEl.innerHTML = s.roadmap.map(r => {
      if (r.done) {
        return `<div class="flex items-center gap-2 text-xs">
          <svg class="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          <span class="text-white/50">${r.text}</span>
        </div>`;
      }
      return `<div class="flex items-center gap-2 text-xs">
        <div class="w-3.5 h-3.5 shrink-0 flex items-center justify-center"><div class="w-2 h-2 rounded-full bg-aura-cyan animate-pulse"></div></div>
        <span class="text-white/70">${r.text}</span>
      </div>`;
    }).join('');
  }

  // AI response
  const respEl = document.getElementById('mock-ai-response');
  if (respEl) respEl.innerHTML = `<p class="mb-1.5">${s.response}</p>
    <div class="flex items-center gap-1.5 pt-2 border-t border-white/5 text-xs text-white/40">
      <svg class="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      ${s.filesChanged} archivos modificados
    </div>`;

  // Chat input
  const inputEl = document.getElementById('mock-input');
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inputEl.value.trim()) {
        window.location.href = '/app/?prompt=' + encodeURIComponent(inputEl.value.trim());
      }
    });
  }
  const sendBtn = document.getElementById('mock-send');
  if (sendBtn && inputEl) {
    sendBtn.addEventListener('click', () => {
      if (inputEl.value.trim()) {
        window.location.href = '/app/?prompt=' + encodeURIComponent(inputEl.value.trim());
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initMockup);
