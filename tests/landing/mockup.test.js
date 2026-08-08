import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Side-effect import: registers the DOMContentLoaded boot listener in jsdom.
// The script is a classic (non-module) browser script — no exports — so we
// drive it through the DOM exactly like the browser does.
import "../../landing/mockup.js";

const MOCK_IDS = [
  "mock-project",
  "mock-filetree",
  "mock-tabs",
  "mock-code",
  "mock-linenums",
  "mock-glow",
  "mock-user-msg",
  "mock-roadmap",
  "mock-roadmap-container",
  "mock-ai-response",
];

function mountMockupDom(withGlassSurface = true) {
  document.body.innerHTML = "";
  for (const id of MOCK_IDS) {
    const el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  if (withGlassSurface) {
    const gs = document.createElement("div");
    gs.className = "glass-surface";
    document.body.appendChild(gs);
  }
  return Object.fromEntries(
    MOCK_IDS.map((id) => [id, document.getElementById(id)]),
  );
}

function installObserver() {
  globalThis.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb;
    }
    observe() {
      this.cb([{ isIntersecting: true }], this);
    }
    disconnect() {}
  };
}

async function bootMockup() {
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await vi.runAllTimersAsync();
}

describe("landing/mockup.js animation engine", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    installObserver();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders a deterministic scenario end-to-end", async () => {
    const els = mountMockupDom(true);
    // Math.random() = 0.4 → SCENARIOS[3] (auth-forms), which also exercises
    // the `// submit` comment branch of the syntax highlighter.
    vi.spyOn(Math, "random").mockReturnValue(0.4);

    await bootMockup();

    // Phase: static setup
    expect(els["mock-project"].textContent).toBe("auth-forms");

    // File tree: active file highlighted, all files listed
    expect(els["mock-filetree"].innerHTML).toContain("RegisterForm.tsx");
    expect(els["mock-filetree"].innerHTML).toContain("validators.ts");
    expect(els["mock-filetree"].innerHTML).toContain("styles.css");
    // Only the active row carries the highlighted class combo
    const activeRows =
      els["mock-filetree"].innerHTML.match(/text-aura-cyan bg-white\/5/g) || [];
    expect(activeRows).toHaveLength(1);

    // Tabs: only the first two files
    expect(els["mock-tabs"].innerHTML).toContain("RegisterForm.tsx");
    expect(els["mock-tabs"].innerHTML).toContain("validators.ts");
    expect(els["mock-tabs"].innerHTML).not.toContain("styles.css");
    expect(els["mock-tabs"].innerHTML).toContain("border-b-2 border-aura-cyan");

    // Phase 1: user message typed in
    expect(els["mock-user-msg"].classList.contains("mock-visible")).toBe(true);
    expect(els["mock-user-msg"].classList.contains("mock-hidden")).toBe(false);
    expect(els["mock-user-msg"].textContent).toBe(
      "Necesito un formulario de registro con validación",
    );

    // Phase 2: roadmap steps
    expect(els["mock-roadmap-container"].classList.contains("mock-visible")).toBe(true);
    expect(els["mock-roadmap"].childElementCount).toBe(3);
    const steps = Array.from(els["mock-roadmap"].children);
    expect(steps[0].classList.contains("mock-visible")).toBe(true);
    expect(steps[0].innerHTML).toContain("text-green-400"); // CHECK_ICON
    expect(steps[0].textContent).toContain("Leyendo RegisterForm.tsx");
    expect(steps[2].innerHTML).toContain("animate-pulse"); // PULSE_DOT
    expect(steps[2].textContent).toContain("Agregando estilos");

    // Phase 3: code typed with syntax highlighting
    const code = els["mock-code"].innerHTML;
    expect(code).toContain("&lt;form"); // HTML escaped
    expect(code).toContain('<span class="text-white/25">// submit</span>'); // comment
    expect(code).toContain('<span class="text-green-400/80">\'react\'</span>'); // string
    expect(code).toContain('<span class="text-green-400/80">\'\'</span>'); // empty string
    expect(code).toContain('<span class="text-aura-purple">import</span>'); // keyword
    expect(code).toContain('<span class="text-aura-purple">export</span>'); // keyword
    expect(code).toContain('<span class="text-aura-purple">function</span>'); // keyword
    expect(code).toContain('<span class="text-aura-cyan">useState</span>'); // hook
    expect(code).toContain('<span class="text-aura-cyan">onSubmit</span>'); // prop

    // Line numbers 1..25
    expect(els["mock-linenums"].textContent).toMatch(/^ 1\n 2\n/);
    expect(els["mock-linenums"].textContent).toMatch(/\n25$/);

    // Phase 4: glow line (jsdom normalizes the calc() value)
    expect(els["mock-glow"].style.top).toContain("calc(");
    expect(els["mock-glow"].style.top).toContain("19.15rem");
    expect(els["mock-glow"].style.opacity).toBe("1");

    // Phase 5: AI response
    expect(els["mock-ai-response"].classList.contains("mock-visible")).toBe(true);
    expect(els["mock-ai-response"].innerHTML).toContain(
      "Creé validators.ts con Zod y agregué feedback visual de errores inline.",
    );
    expect(els["mock-ai-response"].innerHTML).toContain("2 archivos modificados");
  });

  it("boots via the direct path when .glass-surface is missing", async () => {
    const els = mountMockupDom(false);
    vi.spyOn(Math, "random").mockReturnValue(0.5); // SCENARIOS[4]

    await bootMockup();

    expect(els["mock-project"].textContent).toBe("photo-gallery");
    expect(els["mock-code"].innerHTML).toContain("&lt;div");
    expect(els["mock-user-msg"].textContent).toBe(
      "Crea una galería de imágenes con lightbox",
    );
  });

  it("tolerates missing DOM elements (null guards)", async () => {
    // Only mock-project present — every other phase must be skipped safely.
    const el = document.createElement("div");
    el.id = "mock-project";
    document.body.appendChild(el);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    await bootMockup();

    expect(el.textContent).toBe("photo-gallery");
  });
});

describe("landing/mockup.js functional chat input", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    installObserver();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("redirects to /app/?prompt= on Enter and on send click", () => {
    const input = document.createElement("input");
    input.id = "mock-input";
    const send = document.createElement("button");
    send.id = "mock-send";
    document.body.appendChild(input);
    document.body.appendChild(send);

    const location = { href: "" };
    Object.defineProperty(window, "location", {
      value: location,
      writable: true,
      configurable: true,
    });

    document.dispatchEvent(new Event("DOMContentLoaded"));

    input.value = "hola mundo";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(location.href).toBe("/app/?prompt=hola%20mundo");

    input.value = "otra cosa";
    send.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(location.href).toBe("/app/?prompt=otra%20cosa");

    // Empty/whitespace input must not navigate
    input.value = "   ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(location.href).toBe("/app/?prompt=otra%20cosa");

    // Non-Enter keys must not navigate
    input.value = "ignorada";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(location.href).toBe("/app/?prompt=otra%20cosa");
  });
});
