/**
 * Project Templates — Pre-built starter projects for Vibe Studio.
 *
 * Each template defines a complete set of files that get scaffolded
 * into the user's filesystem when selected from the WelcomeScreen.
 *
 * Templates are designed to:
 * 1. Work immediately in VibeLens (auto-detected by usePreviewFiles)
 * 2. Be small enough to feel instant (~5-10 files)
 * 3. Show off Vibe Studio's capabilities (preview, agent, mobile)
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ProjectTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** One-line description */
  description: string;
  /** Category for grouping */
  category: "web" | "mobile" | "landing" | "fullstack";
  /** Lucide icon name */
  icon: string;
  /** Gradient colors for the card */
  gradient: [string, string];
  /** File map: relative path → content */
  files: Record<string, string>;
}

// ─── Template Files ─────────────────────────────────────────────

const REACT_LANDING_FILES: Record<string, string> = {
  "src/App.tsx": `import { useState } from "react";
import "./styles.css";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-glow" />
        <h1>Mi Proyecto</h1>
        <p className="subtitle">Creado con Vibe Studio ✨</p>
        <div className="counter">
          <button onClick={() => setCount(c => c - 1)}>−</button>
          <span className="count">{count}</span>
          <button onClick={() => setCount(c => c + 1)}>+</button>
        </div>
      </header>
      <section className="features">
        <div className="card">
          <span className="emoji">⚡</span>
          <h3>Rápido</h3>
          <p>Preview en tiempo real con VibeLens</p>
        </div>
        <div className="card">
          <span className="emoji">🤖</span>
          <h3>Inteligente</h3>
          <p>Pídele a Aura que modifique tu código</p>
        </div>
        <div className="card">
          <span className="emoji">📱</span>
          <h3>Responsive</h3>
          <p>Prueba en iPhone, Android y tablet</p>
        </div>
      </section>
    </div>
  );
}
`,

  "src/styles.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #0a0a0f;
  color: #e2e8f0;
  min-height: 100vh;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.hero {
  text-align: center;
  padding: 4rem 1rem;
  position: relative;
}

.hero-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.15), transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

h1 {
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #94a3b8;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.counter button {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.counter button:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
}

.count {
  font-size: 2rem;
  font-weight: 700;
  min-width: 3rem;
  text-align: center;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 3rem;
}

.card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s;
}

.card:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-2px);
}

.emoji {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.75rem;
}

.card h3 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.card p {
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.4;
}
`,

  "src/index.tsx": `import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`,
};

const PORTFOLIO_FILES: Record<string, string> = {
  "index.html": `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi Portfolio</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav>
    <span class="logo">@tunombre</span>
    <div class="nav-links">
      <a href="#proyectos">Proyectos</a>
      <a href="#contacto">Contacto</a>
    </div>
  </nav>

  <header class="hero">
    <div class="glow"></div>
    <p class="greeting">Hola, soy</p>
    <h1>Desarrollador<br><span class="accent">Creativo</span></h1>
    <p class="bio">Construyo experiencias web con pasión y propósito.</p>
  </header>

  <section id="proyectos" class="projects">
    <h2>Proyectos</h2>
    <div class="grid">
      <article class="project-card">
        <div class="card-accent"></div>
        <h3>App de Productividad</h3>
        <p>React · TypeScript · Zustand</p>
      </article>
      <article class="project-card">
        <div class="card-accent purple"></div>
        <h3>Landing Empresarial</h3>
        <p>Astro · Tailwind · Motion</p>
      </article>
      <article class="project-card">
        <div class="card-accent green"></div>
        <h3>API REST</h3>
        <p>Node.js · Express · PostgreSQL</p>
      </article>
    </div>
  </section>

  <section id="contacto" class="contact">
    <h2>Contacto</h2>
    <p>¿Tienes un proyecto en mente?</p>
    <a href="mailto:hola@tunombre.com" class="cta">Escríbeme →</a>
  </section>

  <script src="script.js"></script>
</body>
</html>`,

  "styles.css": `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #050508;
  color: #e2e8f0;
  line-height: 1.6;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  position: fixed;
  width: 100%;
  top: 0;
  z-index: 50;
  background: rgba(5, 5, 8, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.logo { font-weight: 700; font-size: 1.1rem; }
.nav-links { display: flex; gap: 2rem; }
.nav-links a { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
.nav-links a:hover { color: white; }

.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  position: relative;
}

.glow {
  position: absolute;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.1), transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.greeting { color: #06b6d4; font-size: 1rem; font-weight: 500; margin-bottom: 0.5rem; }
h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; }
.accent { background: linear-gradient(135deg, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.bio { color: #64748b; font-size: 1.1rem; max-width: 400px; }

.projects, .contact {
  max-width: 800px;
  margin: 0 auto;
  padding: 6rem 2rem;
}

h2 { font-size: 1.8rem; margin-bottom: 2rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.project-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
}

.project-card:hover { transform: translateY(-4px); border-color: rgba(6,182,212,0.3); }

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #06b6d4, transparent);
}
.card-accent.purple { background: linear-gradient(90deg, #8b5cf6, transparent); }
.card-accent.green { background: linear-gradient(90deg, #10b981, transparent); }

.project-card h3 { font-size: 1rem; margin-bottom: 0.5rem; }
.project-card p { color: #64748b; font-size: 0.8rem; }

.contact { text-align: center; }
.contact p { color: #64748b; margin-bottom: 1.5rem; }
.cta {
  display: inline-block;
  padding: 0.8rem 2rem;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  color: white;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.3s;
}
.cta:hover { transform: scale(1.05); box-shadow: 0 0 30px rgba(139,92,246,0.3); }

@media (max-width: 600px) {
  nav { padding: 1rem; }
  .hero { padding: 1rem; }
  h1 { font-size: 2rem; }
}
`,

  "script.js": `// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// Fade-in on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.project-card, .contact').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'all 0.6s ease';
  observer.observe(el);
});
`,
};

const TODO_APP_FILES: Record<string, string> = {
  "src/App.tsx": `import { useState } from "react";
import "./styles.css";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: "Explorar Vibe Studio", done: true },
    { id: 2, text: "Pedir cambios a Aura", done: false },
    { id: 3, text: "Probar vista móvil", done: false },
  ]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: input.trim(), done: false }]);
    setInput("");
  };

  const toggle = (id: number) =>
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const remove = (id: number) =>
    setTodos(prev => prev.filter(t => t.id !== id));

  const pending = todos.filter(t => !t.done).length;

  return (
    <div className="app">
      <header>
        <h1>📋 Mis Tareas</h1>
        <span className="badge">{pending} pendiente{pending !== 1 ? "s" : ""}</span>
      </header>

      <div className="input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          placeholder="¿Qué necesitas hacer?"
          autoFocus
        />
        <button onClick={addTodo} className="add-btn">Agregar</button>
      </div>

      <ul className="todo-list">
        {todos.map(todo => (
          <li key={todo.id} className={todo.done ? "done" : ""}>
            <button className="check" onClick={() => toggle(todo.id)}>
              {todo.done ? "✅" : "⬜"}
            </button>
            <span className="text">{todo.text}</span>
            <button className="delete" onClick={() => remove(todo.id)}>✕</button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p className="empty">¡Todo listo! 🎉</p>
      )}
    </div>
  );
}
`,

  "src/styles.css": `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #0a0a0f;
  color: #e2e8f0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}

.app {
  width: 100%;
  max-width: 500px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

h1 { font-size: 1.5rem; font-weight: 700; }

.badge {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: white;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus { border-color: rgba(6, 182, 212, 0.5); }
input::placeholder { color: #475569; }

.add-btn {
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: transform 0.2s;
  white-space: nowrap;
}

.add-btn:hover { transform: scale(1.05); }

.todo-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }

.todo-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  transition: all 0.2s;
}

.todo-list li:hover { background: rgba(255,255,255,0.06); }
.todo-list li.done .text { text-decoration: line-through; color: #475569; }

.check { background: none; border: none; font-size: 1.1rem; cursor: pointer; }
.text { flex: 1; font-size: 0.9rem; }
.delete {
  background: none;
  border: none;
  color: #475569;
  font-size: 0.9rem;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
}

.todo-list li:hover .delete { opacity: 1; }
.delete:hover { color: #ef4444; }

.empty { text-align: center; color: #475569; padding: 3rem; font-size: 1.1rem; }
`,

  "src/index.tsx": `import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`,
};

// ─── Template Registry ──────────────────────────────────────────

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "react-landing",
    name: "Landing React",
    description: "Página de aterrizaje moderna con contador interactivo",
    category: "web",
    icon: "Rocket",
    gradient: ["#06b6d4", "#8b5cf6"],
    files: REACT_LANDING_FILES,
  },
  {
    id: "portfolio",
    name: "Portfolio Personal",
    description: "Sitio web de portfolio con scroll suave y animaciones",
    category: "landing",
    icon: "User",
    gradient: ["#8b5cf6", "#ec4899"],
    files: PORTFOLIO_FILES,
  },
  {
    id: "todo-app",
    name: "App de Tareas",
    description: "Lista de tareas completa con React y TypeScript",
    category: "web",
    icon: "CheckSquare",
    gradient: ["#10b981", "#06b6d4"],
    files: TODO_APP_FILES,
  },
];
