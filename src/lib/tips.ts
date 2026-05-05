import type { LearningTip } from "@/lib/types";

/**
 * Diccionario de tips en español colombiano, organizados por concepto.
 *
 * Cada tip tiene:
 * - `id`: identificador único
 * - `concept`: concepto agrupador (variables, funciones, flexbox, etc.)
 * - `question`: texto corto con tono cálido ("¿Sabías que...?")
 * - `explanation`: explicación larga y detallada
 * - `tags`: etiquetas para búsqueda y matching
 * - `triggerEvent`: patrón de código que dispara el tip
 *
 * Los tips se muestran una sola vez (deduplicación vía learningStore.shownTips).
 * Son 20+ tips que cubren HTML, CSS, JavaScript, Git y npm.
 */

export const TIP_DICTIONARY: LearningTip[] = [
  // ── Variables ────────────────────────────────────────────────
  {
    id: "let-const",
    concept: "variables",
    question:
      "¿Sabías que...? let y const son formas modernas de declarar variables. Usa const cuando el valor no cambia, y let cuando sí.",
    explanation:
      "Desde ES6, JavaScript tiene `let` y `const` que reemplazan a `var`. La diferencia clave: `let` y `const` tienen alcance de bloque ({}), no de función. Usa `const` por defecto — solo usa `let` cuando necesites reasignar. Olvídate de `var`, puede causar bugs raros por hoisting y alcance de función.",
    tags: ["javascript", "variables", "basicos"],
    triggerEvent: "js-var",
  },
  {
    id: "const-preference",
    concept: "variables",
    question:
      "¿Sabías que...? en JS moderno se recomienda `const` siempre que puedas. Es más predecible y evitás reasignaciones accidentales.",
    explanation:
      "La regla es simple: empieza con `const`. Si después necesitas reasignar, cambia a `let`. Esto hace tu código más legible porque quien lee sabe que ese valor no va a cambiar. Bonus: el motor de JS optimiza mejor las variables declaradas con `const`.",
    tags: ["javascript", "variables", "buenas-practicas"],
    triggerEvent: "js-let",
  },

  // ── Funciones ────────────────────────────────────────────────
  {
    id: "functions-dry",
    concept: "funciones",
    question:
      "¿Sabías que...? si estás escribiendo el mismo código más de dos veces, es hora de crear una función.",
    explanation:
      "El principio DRY (Don't Repeat Yourself) es fundamental. Cada vez que copies y pegues código, preguntate: '¿Esto podría ser una función?' Una función bien nombrada hace tu código más legible, fácil de mantener y menos propenso a bugs. Bonus: las funciones también facilitan hacer tests.",
    tags: ["javascript", "funciones", "buenas-practicas"],
    triggerEvent: "code-repeat",
  },
  {
    id: "arrow-functions",
    concept: "funciones",
    question:
      "¿Sabías que...? las funciones flecha `() => {}` son más cortas y no tienen su propio `this`.",
    explanation:
      "Las arrow functions se introdujeron en ES6 y son ideales para callbacks y métodos cortos. La gran diferencia con `function` es que no crean su propio `this`, sino que heredan el del contexto donde se definen. Perfectas para `.map()`, `.filter()`, event listeners, y promesas.",
    tags: ["javascript", "funciones", "es6"],
    triggerEvent: "js-function",
  },

  // ── Objetos ──────────────────────────────────────────────────
  {
    id: "object-shorthand",
    concept: "objetos",
    question:
      "¿Sabías que...? en JS moderno puedes crear objetos sin repetir las propiedades: `{ nombre }` en vez de `{ nombre: nombre }`.",
    explanation:
      "ES6 introdujo el shorthand de propiedades: cuando el nombre de la variable coincide con el nombre de la propiedad, puedes escribirla una sola vez. También puedes usar `{ ...obj }` para copiar objetos con el spread operator, y `{ ...obj, clave: valor }` para sobrescribir propiedades.",
    tags: ["javascript", "objetos", "es6"],
    triggerEvent: "js-object",
  },
  {
    id: "destructuring",
    concept: "objetos",
    question:
      "¿Sabías que...? con destructuring puedes extraer valores de objetos en una sola línea: `const { nombre, edad } = usuario`.",
    explanation:
      "El destructuring es una de las características más útiles de ES6. Te permite 'desarmar' objetos y arrays en variables individuales. Sirve para parámetros de funciones (`function saludar({ nombre })`), imports, y hasta para intercambiar valores sin variable temporal.",
    tags: ["javascript", "objetos", "es6", "destructuring"],
    triggerEvent: "js-destructure",
  },

  // ── Arrays ───────────────────────────────────────────────────
  {
    id: "array-map",
    concept: "arrays",
    question:
      "¿Sabías que...? preferí `.map()` en vez de `for` para transformar arrays. Es más declarativo y evitás errores de índice.",
    explanation:
      "Los métodos de array como `.map()`, `.filter()`, `.reduce()` y `.forEach()` hacen tu código más legible y menos propenso a bugs. `.map()` crea un NUEVO array con los resultados de aplicar una función a cada elemento. No modifica el original — eso es inmutabilidad, y es buena práctica.",
    tags: ["javascript", "arrays", "es6", "buenas-practicas"],
    triggerEvent: "js-for-loop",
  },
  {
    id: "array-spread",
    concept: "arrays",
    question:
      "¿Sabías que...? el operador `...` (spread) te permite copiar y combinar arrays fácilmente: `[...arr1, ...arr2]`.",
    explanation:
      "El spread operator `...` es una forma elegante de trabajar con arrays inmutables. En vez de usar `.concat()` o push mutando el original, creas un nuevo array. También sirve para convertir strings a arrays (`[...'hola']`), y para pasar elementos de un array como argumentos de función.",
    tags: ["javascript", "arrays", "es6"],
    triggerEvent: "js-array",
  },

  // ─── Template Strings ────────────────────────────────────────
  {
    id: "template-strings",
    concept: "strings",
    question:
      "¿Sabías que...? con template literals (``) puedes interpolar variables sin concatenar: ``Hola, ${nombre}``.",
    explanation:
      "Las template strings (usando backticks ``) reemplazan la concatenación con `+`. Además de interpolar variables con `${}`, respetan saltos de línea, y puedes usar expresiones adentro: `${precio * 1.19}`. También existen las tagged templates para cosas más avanzadas como styled-components.",
    tags: ["javascript", "strings", "es6"],
    triggerEvent: "js-concat",
  },

  // ─── Promesas / Async ────────────────────────────────────────
  {
    id: "async-await",
    concept: "async",
    question:
      "¿Sabías que...? `async/await` hace el código asíncrono tan legible como si fuera síncrono. Olvidate del callback hell.",
    explanation:
      "`async/await` es azúcar sintáctica sobre Promises. Una función `async` siempre devuelve una Promise. `await` pausa la ejecución hasta que la Promise se resuelva. Usá `try/catch` para manejar errores. Es mucho más legible que `.then().catch()` encadenados.",
    tags: ["javascript", "async", "promesas"],
    triggerEvent: "js-then",
  },
  {
    id: "console-table",
    concept: "debugging",
    question:
      "¿Sabías que...? `console.table()` muestra arrays y objetos en formato de tabla en la consola. Mucho más legible que `console.log()`.",
    explanation:
      "`console` tiene métodos muy útiles más allá de `log()`: `console.table()` para tablas, `console.group()` para agrupar logs, `console.time()` para medir rendimiento, `console.trace()` para ver el stack de llamadas, y `console.dir()` para ver propiedades de un objeto. Probálos, te van a salvar horas de debugging.",
    tags: ["javascript", "debugging", "consola"],
    triggerEvent: "js-console-log",
  },

  // ─── CSS: Flexbox ────────────────────────────────────────────
  {
    id: "flexbox-intro",
    concept: "flexbox",
    question:
      "¿Sabías que...? Flexbox te permite alinear elementos en filas o columnas sin usar floats ni tablas.",
    explanation:
      "Flexbox es un modelo de layout unidimensional. Con `display: flex` en el contenedor y propiedades como `justify-content` (eje principal), `align-items` (eje cruzado) y `flex-wrap`, resolvés el 90% de los problemas de alineación. Es ideal para componentes, barras de navegación, y centrar elementos.",
    tags: ["css", "flexbox", "layout"],
    triggerEvent: "css-flexbox",
  },
  {
    id: "flexbox-vs-grid",
    concept: "flexbox",
    question:
      "¿Sabías que...? Flexbox es para una dimensión (fila O columna). Grid es para dos dimensiones (filas Y columnas). Elige según lo que necesites.",
    explanation:
      "Regla práctica: si estás maquetando en una sola dirección (como una barra de navegación o una lista de cards horizontal), usa Flexbox. Si necesitas una cuadrícula con filas y columnas que se alinean en ambas direcciones, usa Grid. Con los dos puedes hacer layouts completos sin frameworks.",
    tags: ["css", "flexbox", "grid", "layout"],
    triggerEvent: "css-layout",
  },

  // ─── CSS: Grid ────────────────────────────────────────────────
  {
    id: "css-grid",
    concept: "grid",
    question:
      "¿Sabías que...? CSS Grid te permite crear layouts de dos dimensiones con `grid-template-columns` y `grid-template-rows`.",
    explanation:
      "Grid es el sistema de layout más poderoso de CSS. Definis filas y columnas con `grid-template-columns: 1fr 1fr 1fr` y los hijos se colocan automáticamente. Podés usar `grid-template-areas` para nombrar zonas del layout. Es ideal para la estructura general de la página.",
    tags: ["css", "grid", "layout"],
    triggerEvent: "css-grid",
  },
  {
    id: "grid-vs-frameworks",
    concept: "grid",
    question:
      "¿Sabías que...? con CSS Grid y Flexbox rara vez necesitas un framework como Bootstrap solo por el grid.",
    explanation:
      "Mucha gente usa Bootstrap o Tailwind solo por el sistema de grillas. Con CSS Grid nativo (`grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`) tenés un layout responsivo en una línea, sin depender de clases externas ni generar HTML verboso.",
    tags: ["css", "grid", "frameworks", "buenas-practicas"],
    triggerEvent: "css-class-framework",
  },

  // ─── CSS: Selectores ──────────────────────────────────────────
  {
    id: "css-selectors",
    concept: "selectores",
    question:
      "¿Sabías que...? los selectores CSS como `:hover`, `:nth-child()` y `:not()` te ahorran tener que agregar clases innecesarias en el HTML.",
    explanation:
      "Los selectores avanzados de CSS te permiten estilizar sin ensuciar el HTML. `:nth-child(odd)` para filas alternadas, `:not(.clase)` para excluir elementos, `[data-atributo]` para selectores por atributo, y las pseudoclases de formulario como `:valid`, `:invalid`, `:focus`. Menos clases = HTML más limpio.",
    tags: ["css", "selectores", "buenas-practicas"],
    triggerEvent: "css-inline-style",
  },
  {
    id: "css-classes-vs-inline",
    concept: "selectores",
    question:
      "¿Sabías que...? es mejor usar clases CSS que estilos inline. Las clases son reutilizables, más fáciles de mantener y rinden mejor.",
    explanation:
      'Los estilos inline (`style="color: red"`) tienen varias desventajas: no se pueden reutilizar, tienen mayor especificidad (difícil sobrescribirlos), no soportan media queries ni pseudoclases, y mezclan contenido con presentación. En cambio, una clase `.rojo { color: red }` se aplica donde la necesites y se mantiene desde un solo lugar.',
    tags: ["css", "buenas-practicas", "selectores"],
    triggerEvent: "css-inline-style",
  },

  // ─── HTML ─────────────────────────────────────────────────────
  {
    id: "html-semantico",
    concept: "html",
    question:
      "¿Sabías que...? usar etiquetas semánticas (`<header>`, `<main>`, `<section>`, `<article>`) mejora tu SEO y accesibilidad.",
    explanation:
      "Las etiquetas semánticas de HTML5 le dicen al navegador y a los lectores de pantalla qué significa cada parte de tu página. `<nav>` es navegación, `<article>` es contenido independiente, `<aside>` es contenido complementario. Esto mejora el posicionamiento en buscadores y hace tu sitio más accesible para personas con discapacidades visuales.",
    tags: ["html", "semantica", "accesibilidad", "seo"],
    triggerEvent: "html-div",
  },
  {
    id: "html-form-label",
    concept: "html",
    question:
      "¿Sabías que...? todo `<input>` debería tener un `<label>` asociado. Mejora la accesibilidad y la usabilidad.",
    explanation:
      "El atributo `for` del `<label>` debe coincidir con el `id` del `<input>`. Esto hace que al hacer clic en el label, el input reciba el foco. Además, los lectores de pantalla pueden anunciar correctamente el propósito de cada campo. Es una práctica simple que hace una gran diferencia.",
    tags: ["html", "formularios", "accesibilidad"],
    triggerEvent: "html-input",
  },

  // ─── Eventos ──────────────────────────────────────────────────
  {
    id: "event-delegation",
    concept: "eventos",
    question:
      "¿Sabías que...? puedes usar delegación de eventos en vez de asignar un listener a cada elemento hijo.",
    explanation:
      "En vez de hacer `elemento.forEach(el => el.addEventListener(...))`, pon un solo listener en el padre y usa `event.target` para detectar qué hijo disparó el evento. Esto funciona porque los eventos 'burbujean' desde el elemento hijo hasta el documento. Mejor rendimiento y código más limpio.",
    tags: ["javascript", "eventos", "dom", "buenas-practicas"],
    triggerEvent: "js-event-listener",
  },
  {
    id: "event-prevent-default",
    concept: "eventos",
    question:
      "¿Sabías que...? `event.preventDefault()` evita comportamientos por defecto como recargar la página al enviar un formulario.",
    explanation:
      "Cuando envías un formulario, el navegador recarga la página por defecto. Con `event.preventDefault()` en el evento `submit`, puedes manejar el envío con JavaScript (fetch API, validación, etc.). También sirve para evitar que un clic en un link navegue, o que el menú contextual aparezca.",
    tags: ["javascript", "eventos", "formularios"],
    triggerEvent: "js-form-submit",
  },

  // ─── DOM ──────────────────────────────────────────────────────
  {
    id: "dom-fragment",
    concept: "dom",
    question:
      "¿Sabías que...? `document.createDocumentFragment()` es más eficiente que agregar elementos uno por uno al DOM.",
    explanation:
      "Cada vez que agregás un elemento al DOM, el navegador tiene que recalcular el layout. Con un DocumentFragment, construís toda la estructura en memoria y la agregás de una sola vez. Es como armar un mueble antes de llevarlo a la pieza en vez de llevar tabla por tabla.",
    tags: ["javascript", "dom", "rendimiento"],
    triggerEvent: "js-dom-append",
  },
  {
    id: "innerhtml-vs-create",
    concept: "dom",
    question:
      "¿Sabías que...? usar `innerHTML` puede ser un riesgo de seguridad. Preferí `textContent` o `createElement` cuando trabajes con contenido de usuario.",
    explanation:
      "`innerHTML` interpreta el string como HTML, lo que significa que si el contenido viene del usuario (un comentario, un nombre), podría incluir `<script>` malicioso (XSS). `textContent` solo interpreta texto plano, es más seguro y además rinde mejor porque no parsea HTML.",
    tags: ["javascript", "dom", "seguridad"],
    triggerEvent: "js-innerhtml",
  },

  // ─── Git ──────────────────────────────────────────────────────
  {
    id: "git-commit-message",
    concept: "git",
    question:
      "¿Sabías que...? un buen mensaje de commit explica el POR QUÉ, no el QUÉ. El qué ya lo muestra el diff.",
    explanation:
      "Un mensaje de commit como 'arreglé bug' no sirve. Uno bueno sería: 'fix(auth): sesión expiraba antes de tiempo por mal cálculo del timestamp'. El formato conventional commits (`tipo(scope): descripción`) ayuda a generar changelogs automáticos y a entender el historial. En este proyecto usamos español.",
    tags: ["git", "buenas-practicas"],
    triggerEvent: "git-commit",
  },
  {
    id: "git-branch",
    concept: "git",
    question:
      "¿Sabías que...? trabajar con ramas (branches) te permite experimentar sin miedo a romper el código principal.",
    explanation:
      "Las ramas en Git son livianas y baratas. Crea una rama por feature o fix: `git checkout -b feat/mi-cambio`. Trabaja tranquilo, y cuando esté listo, haz un PR para fusionarlo. Si algo sale mal, simplemente borras la rama y el main queda intacto.",
    tags: ["git", "flujo-de-trabajo"],
    triggerEvent: "git-branch",
  },

  // ─── npm ──────────────────────────────────────────────────────
  {
    id: "npm-scripts",
    concept: "npm",
    question:
      "¿Sabías que...? puedes crear scripts personalizados en package.json para automatizar tareas repetitivas.",
    explanation:
      'En `package.json`, la sección `scripts` te permite definir comandos cortos: `"dev": "vite"`, `"test": "vitest run"`. Después los ejecutás con `npm run dev` o `npm test`. También existen pre/post hooks: `prebuild` se ejecuta automáticamente antes de `build`. Muy útil para automatizar lint, tests y builds.',
    tags: ["npm", "herramientas", "automatizacion"],
    triggerEvent: "npm-run",
  },
  {
    id: "npm-install-save",
    concept: "npm",
    question:
      "¿Sabías que...? con `npm install paquete` se agrega a `dependencies`. Usá `--save-dev` para herramientas de desarrollo.",
    explanation:
      "La diferencia es importante: `dependencies` son necesarias para que la app funcione en producción (React, Zustand). `devDependencies` son solo para desarrollo (Vitest, ESLint, Prettier). Esto hace que `npm install --production` instale solo lo necesario y tus builds de producción sean más rápidos.",
    tags: ["npm", "buenas-practicas"],
    triggerEvent: "npm-install",
  },
];

/**
 * Busca tips por etiqueta.
 * @param tag - Etiqueta a buscar (ej: "css", "javascript", "flexbox")
 * @returns Array de tips que coinciden con la etiqueta
 */
export function getTipsByTag(tag: string): LearningTip[] {
  const lower = tag.toLowerCase();
  return TIP_DICTIONARY.filter(
    (tip) =>
      tip.tags.some((t) => t.toLowerCase() === lower) ||
      tip.concept.toLowerCase() === lower,
  );
}

/**
 * Busca un tip por triggerEvent.
 * @param triggerEvent - Código del evento disparador (ej: "css-flexbox", "js-var")
 * @returns El primer tip que coincida, o undefined si no hay
 */
export function getTipByTrigger(triggerEvent: string): LearningTip | undefined {
  const lower = triggerEvent.toLowerCase();
  return TIP_DICTIONARY.find((tip) => tip.triggerEvent?.toLowerCase() === lower);
}

/**
 * Devuelve tips no mostrados anteriormente para un conjunto de tags.
 * @param tags - Lista de tags a buscar
 * @param shownTipIds - Set de IDs de tips ya mostrados
 * @returns Tips que coinciden y no han sido mostrados
 */
export function getUnseenTipsByTags(
  tags: string[],
  shownTipIds: Set<string>,
): LearningTip[] {
  const results: LearningTip[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const tips = getTipsByTag(tag);
    for (const tip of tips) {
      if (!shownTipIds.has(tip.id) && !seen.has(tip.id)) {
        seen.add(tip.id);
        results.push(tip);
      }
    }
  }

  return results;
}
