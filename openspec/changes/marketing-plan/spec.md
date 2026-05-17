# Spec — Plan de Marketing Vibe Studio

## 1. Definición del Producto para Marketing

### Identidad
- **Nombre:** Vibe Studio by Opita Code
- **Tagline (ES):** "Vibecodea en español — IDE con IA para crear apps"
- **Tagline (EN):** "The first AI IDE built natively for the Spanish-speaking world"
- **URL:** https://vibe.opitacode.com
- **Categoría:** AI-Powered IDE / Vibe Coding Platform

### Propuesta de Valor Única (UVP)
El único IDE con inteligencia artificial diseñado de cero para desarrolladores y estudiantes hispanohablantes, con precios adaptados al mercado latinoamericano.

### Público Objetivo
1. **Primario:** Estudiantes de ingeniería de sistemas en Colombia (18-25 años)
2. **Secundario:** Desarrolladores independientes en LATAM (25-35 años)
3. **Terciario:** Creadores y emprendedores no-técnicos hispanos que quieren construir MVPs

---

## 2. Stack Tecnológico de Marketing

### Capa de Medición
| Herramienta | Propósito | Repositorio | Despliegue |
|---|---|---|---|
| Umami | Web analytics | `umami-software/umami` | Docker en AWS |
| SerpBear | SEO rank tracking | `serpbear/serpbear` | Docker en AWS |
| PostHog | Product analytics + A/B | `PostHog/posthog` | Cloud free tier (1M events/mes) |

### Capa de Comunicación
| Herramienta | Propósito | Repositorio | Despliegue |
|---|---|---|---|
| Listmonk | Email campaigns & newsletters | `knadh/listmonk` | Docker en AWS + SES |
| Postiz | Social media scheduling | `gitroomhq/postiz-app` | Docker en AWS |

### Capa de Gestión
| Herramienta | Propósito | Repositorio | Despliegue |
|---|---|---|---|
| Twenty CRM | Lead & pipeline management | `twentyhq/twenty` | Docker en AWS |
| n8n | Workflow automation | `n8n-io/n8n` | Docker en AWS |

### Capa de Diseño
| Herramienta | Propósito | Repositorio | Uso |
|---|---|---|---|
| Penpot | Diseño de assets de marketing | `penpot/penpot` | Cloud gratuito o self-hosted |
| Inkscape | Vectores y logos | `inkscape/inkscape` | Local desktop |

---

## 3. Calendario de Contenido

### Semana Tipo (una vez en Fase 2)
| Día | Canal | Tipo de Contenido |
|---|---|---|
| Lunes | LinkedIn | Post "Build in Public" (métricas, decisiones, reflexiones) |
| Martes | X/Twitter | Demo visual (GIF/video del IDE funcionando) |
| Miércoles | Blog/Dev.to | Artículo técnico (arquitectura, SDD, subagentes) |
| Jueves | LinkedIn + X | Tip o tutorial rápido (< 60 seg) |
| Viernes | Discord/Reddit | Showcase o respuesta a preguntas de la comunidad |
| Sábado | Instagram/TikTok | "Crea X en 5 minutos con Vibe Studio" |
| Domingo | Newsletter | Resumen semanal + novedades del producto |

### Pilares de Contenido
1. **Educativo:** Tutoriales, tips, "cómo crear X con IA"
2. **Behind the scenes:** Build in Public, decisiones técnicas, fracasos
3. **Social proof:** Testimonios de estudiantes, demos de proyectos creados
4. **Thought leadership:** Opiniones sobre el futuro del vibe coding en LATAM

---

## 4. Estrategia SEO

### Keywords Objetivo (20 principales)
| Keyword | Volumen Est. | Dificultad | Prioridad |
|---|---|---|---|
| "IDE con inteligencia artificial" | Medio | Baja | 🔴 Alta |
| "vibe coding español" | Bajo | Muy baja | 🔴 Alta |
| "crear aplicaciones con IA" | Alto | Media | 🔴 Alta |
| "IDE para programar gratis" | Alto | Alta | 🟡 Media |
| "alternativa a cursor español" | Bajo | Muy baja | 🔴 Alta |
| "programar sin saber código" | Alto | Media | 🟡 Media |
| "herramientas IA para programadores" | Alto | Media | 🟡 Media |
| "bolt.new en español" | Bajo | Muy baja | 🔴 Alta |
| "aprender a programar con IA" | Alto | Media | 🟡 Media |
| "IDE estudiantes Colombia" | Bajo | Muy baja | 🔴 Alta |

### Estrategia On-Page
- Blog en `opitacode.com/blog` con artículos optimizados para keywords long-tail
- Landing pages específicas: `/estudiantes`, `/empresas`, `/comparativa`
- Schema markup (SoftwareApplication, FAQPage)
- Meta descriptions optimizadas en cada página

### Estrategia Off-Page
- Guest posts en blogs de tecnología LATAM
- Backlinks desde Product Hunt, DevHunt, Hacker News
- Participación en foros y Q&A (Stack Overflow en Español)

---

## 5. Estrategia de Email Marketing

### Flujos Automatizados (Listmonk)
1. **Welcome Series** (3 emails en 7 días):
   - Día 0: Bienvenida + primeros pasos
   - Día 3: Tutorial "Tu primer proyecto con Vibe Studio"
   - Día 7: Invitación a plan Pro + testimonios

2. **Trial Expiration** (3 emails):
   - Día 5: Recordatorio "Te quedan 2 días de prueba"
   - Día 7: "Tu prueba terminó — actualiza tu plan"
   - Día 10: Última oportunidad + descuento exclusivo

3. **Newsletter semanal:**
   - Novedades del producto
   - Artículo destacado del blog
   - Proyecto de la comunidad de la semana

---

## 6. Estrategia de Lanzamiento (Product Hunt)

### Assets Requeridos
- [ ] Video demo de 60 segundos (grabación de pantalla profesional)
- [ ] 8 screenshots del IDE en acción (modo claro y oscuro)
- [ ] Logo en formato cuadrado (240x240px)
- [ ] Gallery image (1270x760px)
- [ ] Thumbnail (240x240px)
- [ ] GIF animado del IDE procesando un prompt
- [ ] Maker comment redactado (historia personal + invitación al feedback)

### Copy para Product Hunt
**Tagline:** "The first AI IDE built natively for LATAM & the Spanish-speaking world"

**Description:**
> Vibe Studio is an AI-powered IDE designed from the ground up for Spanish-speaking developers and students. With autonomous sub-agents, visual reasoning transparency, and pricing adapted to Latin American markets, it's the tool that makes AI-driven development accessible to 500M+ Spanish speakers worldwide. Built with Tauri, React, and AWS — available as a desktop app and web IDE.

### Plataformas de Lanzamiento (Orden)
1. DevHunt (Semana 7)
2. Hacker News — Show HN (Semana 8)
3. Product Hunt (Semana 10)
4. 100+ directorios vía LaunchDirectories.com (Semana 12)

---

## 7. Programa Universitario

### Estructura
- **Nombre:** "Vibe Campus" 
- **Oferta:** Licencias Vibe Pro gratuitas para estudiantes verificados
- **Duración:** Semestral (renovable)
- **Universidades objetivo (Fase 1):** USCO, Corhuila, UNAD sede Neiva, CUN, Uniminuto

### Programa de Embajadores
- 1-2 embajadores por universidad
- Beneficios: Pro gratis + merchandising + mención en la web
- Responsabilidades: 2 posts/mes sobre Vibe Studio + organizar 1 workshop/semestre

---

*Spec generada: 2026-05-16T22:10*
