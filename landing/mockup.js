/**
 * Interactive IDE Mockup — Landing Page
 * Animated demo: picks a random scenario, types code + chat progressively.
 * Functional input redirects to /app/?prompt=
 */

// ─── Scenarios ──────────────────────────────────────────────
const SCENARIOS = [
  {
    prompt: "Hazme un reproductor de música con fondo de cristal",
    project: "mi-reproductor",
    files: ["App.tsx", "GlassPlayer.tsx", "index.css"],
    activeFile: "App.tsx",
    code: [
      "import { useState } from 'react';",
      "import GlassPlayer from './GlassPlayer';",
      "",
      "export default function App() {",
      "  const [playing, setPlaying] = useState(false);",
      "",
      "  return (",
      '    <div className="min-h-screen bg-zinc-950">',
      '      <h1 className="text-4xl font-bold p-8">',
      "        Mi Reproductor",
      "      </h1>",
      "      <GlassPlayer isPlaying={playing} />",
      "    </div>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo App.tsx", "Creando GlassPlayer.tsx", "Editando App.tsx:12"],
    response: "Listo. Creé GlassPlayer.tsx con backdrop-blur y lo importé en App.",
    filesChanged: 2
  },
  {
    prompt: "Crea un dashboard de ventas con gráficas en tiempo real",
    project: "sales-dashboard",
    files: ["Dashboard.tsx", "SalesChart.tsx", "api.ts"],
    activeFile: "Dashboard.tsx",
    code: [
      "import { useEffect, useState } from 'react';",
      "import SalesChart from './SalesChart';",
      "import { fetchSales } from './api';",
      "",
      "export default function Dashboard() {",
      "  const [data, setData] = useState([]);",
      "",
      "  useEffect(() => {",
      "    fetchSales().then(setData);",
      "  }, []);",
      "",
      "  return (",
      '    <main className="p-6 bg-zinc-900">',
      '      <h1 className="text-2xl mb-4">Ventas</h1>',
      "      <SalesChart data={data} />",
      "    </main>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo Dashboard.tsx", "Creando SalesChart.tsx", "Conectando api.ts"],
    response: "Creé SalesChart con Recharts y lo conecté al endpoint de ventas.",
    filesChanged: 3
  },
  {
    prompt: "Hazme un chat en tiempo real con WebSockets",
    project: "chat-app",
    files: ["ChatRoom.tsx", "MessageList.tsx", "socket.ts"],
    activeFile: "ChatRoom.tsx",
    code: [
      "import { useState, useRef } from 'react';",
      "import MessageList from './MessageList';",
      "import { useSocket } from './socket';",
      "",
      "export default function ChatRoom() {",
      "  const [msg, setMsg] = useState('');",
      "  const { messages, send } = useSocket();",
      "",
      "  const handleSend = () => {",
      "    if (msg.trim()) {",
      "      send(msg);",
      "      setMsg('');",
      "    }",
      "  };",
      "",
      "  return (",
      '    <div className="flex flex-col h-screen">',
      "      <MessageList messages={messages} />",
      "      <input value={msg} onChange={e =>",
      "        setMsg(e.target.value)} />",
      "    </div>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo ChatRoom.tsx", "Creando socket.ts", "Editando ChatRoom.tsx:9"],
    response: "Configuré WebSocket con reconexión automática y creé MessageList con scroll infinito.",
    filesChanged: 3
  },
  {
    prompt: "Necesito un formulario de registro con validación",
    project: "auth-forms",
    files: ["RegisterForm.tsx", "validators.ts", "styles.css"],
    activeFile: "RegisterForm.tsx",
    code: [
      "import { useState } from 'react';",
      "import { validate } from './validators';",
      "",
      "export default function RegisterForm() {",
      "  const [form, setForm] = useState({",
      "    email: '', password: '', name: ''",
      "  });",
      "  const [errors, setErrors] = useState({});",
      "",
      "  const handleSubmit = (e) => {",
      "    e.preventDefault();",
      "    const errs = validate(form);",
      "    if (Object.keys(errs).length === 0) {",
      "      // submit",
      "    }",
      "    setErrors(errs);",
      "  };",
      "",
      "  return (",
      "    <form onSubmit={handleSubmit}",
      '      className="max-w-md mx-auto p-8">',
      "      {/* fields */}",
      "    </form>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo RegisterForm.tsx", "Creando validators.ts", "Agregando estilos"],
    response: "Creé validators.ts con Zod y agregué feedback visual de errores inline.",
    filesChanged: 2
  },
  {
    prompt: "Crea una galería de imágenes con lightbox",
    project: "photo-gallery",
    files: ["Gallery.tsx", "Lightbox.tsx", "useImages.ts"],
    activeFile: "Gallery.tsx",
    code: [
      "import { useState } from 'react';",
      "import Lightbox from './Lightbox';",
      "import { useImages } from './useImages';",
      "",
      "export default function Gallery() {",
      "  const images = useImages();",
      "  const [selected, setSelected] = useState(null);",
      "",
      "  return (",
      '    <div className="columns-3 gap-4 p-6">',
      "      {images.map((img, i) => (",
      "        <img key={i} src={img.thumb}",
      '          loading="lazy"',
      "          onClick={() => setSelected(i)}",
      '          className="rounded-xl mb-4" />',
      "      ))}",
      "      {selected !== null && (",
      "        <Lightbox images={images}",
      "          index={selected}",
      "          onClose={() => setSelected(null)} />",
      "      )}",
      "    </div>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo Gallery.tsx", "Creando Lightbox.tsx", "Optimizando lazy load"],
    response: "Creé Lightbox con gestos swipe y lazy loading con IntersectionObserver.",
    filesChanged: 2
  },
  {
    prompt: "Hazme un kanban board tipo Trello",
    project: "task-board",
    files: ["Board.tsx", "Column.tsx", "Card.tsx"],
    activeFile: "Board.tsx",
    code: [
      "import { useState } from 'react';",
      "import Column from './Column';",
      "",
      "const INITIAL = {",
      "  todo: ['Diseñar UI', 'Setup DB'],",
      "  doing: ['Auth flow'],",
      "  done: ['Landing page']",
      "};",
      "",
      "export default function Board() {",
      "  const [cols, setCols] = useState(INITIAL);",
      "",
      "  const moveCard = (from, to, idx) => {",
      "    const card = cols[from][idx];",
      "    setCols(prev => ({",
      "      ...prev,",
      "      [from]: prev[from].filter((_, i) =>",
      "        i !== idx),",
      "      [to]: [...prev[to], card]",
      "    }));",
      "  };",
      "",
      "  return (",
      '    <div className="flex gap-4 p-6 h-screen">',
      "      {Object.entries(cols).map(([k, v]) =>",
      "        <Column key={k} title={k} cards={v}",
      "          onMove={moveCard} />",
      "      )}",
      "    </div>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo Board.tsx", "Creando Column.tsx", "Agregando drag & drop"],
    response: "Creé Column y Card con drag & drop nativo usando HTML5 DnD API.",
    filesChanged: 3
  },
  {
    prompt: "Un timer pomodoro con sonido y notificaciones",
    project: "pomodoro-app",
    files: ["Timer.tsx", "Controls.tsx", "sounds.ts"],
    activeFile: "Timer.tsx",
    code: [
      "import { useState, useEffect } from 'react';",
      "import Controls from './Controls';",
      "import { playBell } from './sounds';",
      "",
      "export default function Timer() {",
      "  const [secs, setSecs] = useState(1500);",
      "  const [active, setActive] = useState(false);",
      "",
      "  useEffect(() => {",
      "    if (!active) return;",
      "    const id = setInterval(() => {",
      "      setSecs(s => s <= 1",
      "        ? (playBell(), setActive(false), 1500)",
      "        : s - 1);",
      "    }, 1000);",
      "    return () => clearInterval(id);",
      "  }, [active]);",
      "",
      "  const m = Math.floor(secs / 60);",
      "  const s = secs % 60;",
      "",
      "  return (",
      '    <div className="flex flex-col items-center',
      '      justify-center h-screen bg-zinc-950">',
      '      <span className="text-8xl font-mono">',
      "        {m}:{String(s).padStart(2,'0')}",
      "      </span>",
      "      <Controls active={active}",
      "        onToggle={() => setActive(!active)} />",
      "    </div>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo Timer.tsx", "Creando sounds.ts", "Editando Timer.tsx:14"],
    response: "Timer listo con Web Audio API para el sonido y Notification API para alertas.",
    filesChanged: 3
  },
  {
    prompt: "Crea un landing page para mi startup de delivery",
    project: "delivery-landing",
    files: ["Hero.tsx", "Features.tsx", "Pricing.tsx"],
    activeFile: "Hero.tsx",
    code: [
      "export default function Hero() {",
      "  return (",
      '    <section className="min-h-screen flex',
      "      items-center justify-center",
      '      bg-gradient-to-br from-orange-500',
      '      to-red-600">',
      '      <div className="text-center text-white">',
      '        <h1 className="text-6xl font-bold',
      '          mb-4">',
      "          RapidEats",
      "        </h1>",
      '        <p className="text-xl opacity-80',
      '          mb-8">',
      "          Tu comida favorita en 30 min",
      "        </p>",
      '        <button className="px-8 py-4',
      "          bg-white text-orange-600",
      '          rounded-full font-bold">',
      "          Pedir ahora",
      "        </button>",
      "      </div>",
      "    </section>",
      "  );",
      "}"
    ],
    roadmap: ["Leyendo Hero.tsx", "Creando Features.tsx", "Creando Pricing.tsx"],
    response: "Hero con gradiente y CTA. Creé Features con iconos SVG y Pricing con 3 planes.",
    filesChanged: 3
  }
];

// ─── Syntax Highlighting ─────────────────────────────────────
function hl(line) {
  return line
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\b(import|export|default|function|const|let|return|from|if|else|new|typeof|void)\b/g, '<span class="text-aura-purple">$1</span>')
    .replace(/\b(useState|useEffect|useRef|useCallback|useMemo|useSocket|useImages)\b/g, '<span class="text-aura-cyan">$1</span>')
    .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-orange-400/80">$1</span>')
    .replace(/(className|key|src|loading|onClick|onChange|onSubmit|onClose|onMove|onToggle|value|href|target|rel|index|active)(?==)/g, '<span class="text-aura-cyan">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '<span class="text-green-400/80">$1</span>')
    .replace(/\/\/.*/g, '<span class="text-white/25">$&</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-orange-400/80">$1</span>');
}

// ─── Helpers ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const show = (el) => { if (el) { el.classList.remove('mock-hidden'); el.classList.add('mock-visible'); } };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ─── File icon SVG ───────────────────────────────────────────
const FILE_ICON = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';
const CHECK_ICON = '<svg class="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
const PULSE_DOT = '<div class="w-3.5 h-3.5 shrink-0 flex items-center justify-center"><div class="w-2 h-2 rounded-full bg-aura-cyan animate-pulse"></div></div>';

// ─── Animation Engine ────────────────────────────────────────
async function initMockup() {
  const s = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

  // Static setup (instant)
  const projEl = $('mock-project');
  if (projEl) projEl.textContent = s.project;

  const treeEl = $('mock-filetree');
  if (treeEl) {
    treeEl.innerHTML = s.files.map(f => {
      const active = f === s.activeFile;
      const cls = active ? 'text-aura-cyan bg-white/5 rounded px-1 py-0.5 -mx-1' : 'text-white/40';
      return `<div class="flex items-center gap-1.5 ${cls}">${FILE_ICON}<span>${f}</span></div>`;
    }).join('');
  }

  const tabsEl = $('mock-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = s.files.slice(0, 2).map((f, i) =>
      `<div class="px-4 py-2 text-xs ${i === 0 ? 'border-b-2 border-aura-cyan text-white/90 bg-white/5' : 'text-white/30'}">${f}</div>`
    ).join('');
  }

  // Start empty
  const codeEl = $('mock-code');
  const numsEl = $('mock-linenums');
  const glowEl = $('mock-glow');
  const msgEl = $('mock-user-msg');
  const roadmapEl = $('mock-roadmap');
  const roadmapContainer = $('mock-roadmap-container');
  const respEl = $('mock-ai-response');

  if (codeEl) codeEl.innerHTML = '';
  if (numsEl) numsEl.textContent = '';

  // ── Phase 1: User message types in ──
  await wait(800);
  if (msgEl) {
    msgEl.textContent = '';
    show(msgEl);
    for (let i = 0; i < s.prompt.length; i++) {
      msgEl.textContent += s.prompt[i];
      await wait(25 + Math.random() * 15);
    }
  }

  // ── Phase 2: Roadmap steps appear one by one ──
  await wait(400);
  show(roadmapContainer);
  if (roadmapEl) {
    roadmapEl.innerHTML = '';
    for (let i = 0; i < s.roadmap.length; i++) {
      const isLast = i === s.roadmap.length - 1;
      const icon = isLast ? PULSE_DOT : CHECK_ICON;
      const textCls = isLast ? 'text-white/70' : 'text-white/50';
      const step = document.createElement('div');
      step.className = 'flex items-center gap-2 text-xs mock-hidden';
      step.innerHTML = `${icon}<span class="${textCls}">${s.roadmap[i]}</span>`;
      roadmapEl.appendChild(step);
      await wait(100);
      show(step);
      await wait(350);
    }
  }

  // ── Phase 3: Code types in line by line ──
  await wait(300);
  if (codeEl && numsEl) {
    for (let i = 0; i < s.code.length; i++) {
      // Update line numbers
      numsEl.textContent = s.code.slice(0, i + 1).map((_, j) => String(j + 1).padStart(2, ' ')).join('\n');
      // Update code (highlight complete lines only)
      codeEl.innerHTML = s.code.slice(0, i + 1).map(l => hl(l)).join('\n');
      await wait(40 + Math.random() * 30);
    }
  }

  // ── Phase 4: Glow line appears ──
  await wait(200);
  if (glowEl) {
    const glowLine = Math.min(s.code.length - 2, 11);
    glowEl.style.top = `calc(1rem + ${glowLine} * 1.65rem)`;
    glowEl.style.opacity = '1';
  }

  // ── Phase 5: AI response fades in ──
  await wait(600);
  if (respEl) {
    respEl.innerHTML = `<p class="mb-1.5">${s.response}</p>
      <div class="flex items-center gap-1.5 pt-2 border-t border-white/5 text-xs text-white/40">
        ${CHECK_ICON} ${s.filesChanged} archivos modificados
      </div>`;
    show(respEl);
  }
}

// ─── Functional Chat Input ───────────────────────────────────
function initInput() {
  const inputEl = $('mock-input');
  const sendBtn = $('mock-send');
  const go = () => {
    if (inputEl && inputEl.value.trim()) {
      window.location.href = '/app/?prompt=' + encodeURIComponent(inputEl.value.trim());
    }
  };
  if (inputEl) inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  if (sendBtn) sendBtn.addEventListener('click', go);
}

// ─── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initInput();
  // Start animation when mockup scrolls into view (or immediately if visible)
  const mockup = document.querySelector('.glass-surface');
  if (!mockup) { initMockup(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      initMockup();
    }
  }, { threshold: 0.3 });
  observer.observe(mockup);
});
