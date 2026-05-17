# SDD Explore — Plan de Marketing para Vibe Studio

## Resumen Ejecutivo de Investigación

Investigación exhaustiva del ecosistema de herramientas open-source disponibles en GitHub para ejecutar un plan de marketing completo, profesional y de bajo costo para **Vibe Studio** (Opita Code).

---

## 1. Contexto de Mercado

### Mercado de "Vibe Coding" (2026)
- **Tamaño estimado:** $4.7 mil millones USD (CAGR ~38%)
- **Adopción:** 92% de desarrolladores en EEUU usan herramientas IA diariamente; ~41% del código global es generado por IA
- **Usuarios no técnicos:** Representan el 60%+ de los usuarios de plataformas vibe coding
- **87% de las Fortune 500** ya adoptaron al menos una plataforma de vibe coding

### Competidores Directos
| Herramienta | Categoría | Fortaleza Principal |
|---|---|---|
| **Cursor** | AI IDE (VS Code fork) | Pionero, estándar de la industria, Composer multi-archivo |
| **Windsurf** | AI IDE (VS Code fork) | UI limpia, ediciones agénticas directas, $15/mes |
| **Bolt.new** | Basado en navegador | Prototipado rápido full-stack, de idea a URL desplegada |
| **Lovable** | Basado en navegador | Generación full-stack para usuarios no-técnicos |
| **GitHub Copilot** | Extensión/Integrado | Default seguro para empresas ya en ecosistema GitHub |
| **Claude Code** | Terminal-nativo | Workflows agénticos basados en terminal |
| **Google Antigravity** | AI IDE | Orquestación paralela de agentes, integración Google/Firebase |

### Diferencial de Vibe Studio
- **Único IDE nativo en español** para el mercado LATAM
- **Plan estudiante** a precio accesible ($12K-$15K COP/mes)
- **Subagentes autónomos** con transparencia visual (reasoning, donut progress)
- **Orquestación SDD** (Spec-Driven Development) integrada
- **Tauri desktop** + webapp

---

## 2. Herramientas OSS Investigadas

### 🔄 Automatización de Marketing
| Herramienta | GitHub | Para qué sirve | Relevancia para Vibe Studio |
|---|---|---|---|
| **Mautic** | `mautic/mautic` | Automatización completa (email, lead scoring, campañas) | ⭐⭐⭐ Full pipeline de nurturing |
| **Dittofeed** | `dittofeed/dittofeed` | Customer engagement omnicanal | ⭐⭐ Alternativa moderna a Customer.io |
| **n8n** | `n8n-io/n8n` | Workflow automation (alternativa a Zapier) | ⭐⭐⭐ Conectar CRM, email, redes sociales |

### 📱 Publicación en Redes Sociales
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **Postiz** | `gitroomhq/postiz-app` | Scheduling con IA para X, LinkedIn, Instagram, TikTok, YouTube | ⭐⭐⭐ All-in-one scheduling |
| **Mixpost** | `inovector/mixpost` | Social media management self-hosted | ⭐⭐ Buena alternativa para agencias |
| **OpenPost** | `rodrgds/openpost` | Scheduler ligero, single binary | ⭐⭐ Simple y rápido |

### 📊 Analytics (Privacy-First)
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **Umami** | `umami-software/umami` | Analytics ligero, sin cookies | ⭐⭐⭐ Perfecto para opitacode.com |
| **Plausible** | `plausible/analytics` | Analytics minimalista (<1KB script) | ⭐⭐⭐ Alternativa excelente |
| **PostHog** | `PostHog/posthog` | Product analytics + feature flags + A/B testing | ⭐⭐⭐ Todo-en-uno para producto |

### 🔍 SEO y Análisis de Competidores
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **OpenSEO** | `every-app/open-seo` | Alt. a Semrush/Ahrefs | ⭐⭐ Requiere APIs de pago |
| **SerpBear** | `serpbear/serpbear` | Tracking de posiciones en buscadores | ⭐⭐⭐ Monitorear rankings de keywords |
| **ContentSwift** | `content-swift/content-swift` | Investigación de contenido basada en SERP | ⭐⭐ Optimización de contenido |

### 📧 Email Marketing
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **Listmonk** | `knadh/listmonk` | Newsletter y mailing lists self-hosted (Go + Vue.js) | ⭐⭐⭐ Ya tenemos AWS SES configurado |

### 💼 CRM
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **Twenty** | `twentyhq/twenty` | CRM moderno developer-first (45K+ stars) | ⭐⭐⭐ Perfecto para startup tech |
| **EspoCRM** | `espocrm/espocrm` | CRM no-code para SMBs | ⭐⭐ Alternativa más simple |

### 🎨 Diseño y Mockups
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **Penpot** | `penpot/penpot` | Alternativa a Figma (colaborativo, SVG/CSS nativo) | ⭐⭐⭐ Diseño de assets de marketing |
| **Inkscape** | `inkscape/inkscape` | Editor vectorial profesional (alternativa a Illustrator) | ⭐⭐ Logos e ilustraciones |

### 🚀 Lanzamiento de Producto
| Herramienta/Recurso | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **Open-Launch** | `Drdruide/Open-Launch` | Clon OSS de Product Hunt | ⭐ Referencia |
| **DevHunt** | `devhunt.org` | Plataforma de lanzamiento para dev tools | ⭐⭐⭐ Público objetivo exacto |
| **Awesome Product Hunt** | `fmerian/awesome-product-hunt` | Guía completa de lanzamiento en PH | ⭐⭐⭐ Checklist y estrategia |

### 🧪 A/B Testing y Optimización
| Herramienta | GitHub | Para qué sirve | Relevancia |
|---|---|---|---|
| **PostHog** | `PostHog/posthog` | Feature flags + experiments + analytics | ⭐⭐⭐ Ya mencionado |
| **GrowthBook** | `growthbook/growthbook` | A/B testing warehouse-native | ⭐⭐ Para optimización avanzada |

---

## 3. Stack Recomendado (Máxima Relación Costo/Beneficio)

### Tier 1 — Implementar YA (costo $0)
1. **Umami** o **Plausible** → Analytics en `opitacode.com` y `vibe.opitacode.com`
2. **Listmonk** + **AWS SES** (ya configurado) → Newsletters y campañas de email
3. **SerpBear** → Monitoreo de posicionamiento SEO
4. **DevHunt** → Lanzamiento inmediato para público developer

### Tier 2 — Implementar en 30 días
5. **Postiz** → Scheduling automatizado de contenido en redes sociales
6. **PostHog** → Product analytics y A/B testing en la landing/app
7. **Twenty CRM** → Gestión de leads y pipeline de ventas

### Tier 3 — Implementar en 60 días
8. **n8n** → Automatización de workflows (conectar todo el stack)
9. **Product Hunt** → Lanzamiento público con toda la preparación previa
10. **Mautic** → Automatización avanzada de marketing (lead scoring, nurturing)

---

## 4. Estrategia de Lanzamiento en Product Hunt

### Timeline Óptimo
| Semana | Foco | Acciones |
|---|---|---|
| **-8 semanas** | Presencia comunitaria | Crear perfil Maker, comentar/votar en otros lanzamientos diariamente |
| **-6 semanas** | Red de contactos | Seguir top hunters de dev tools, construir waitlist (+100 personas) |
| **-4 semanas** | Posicionamiento | Tagline: "The first AI IDE built natively for the Spanish-speaking world" |
| **-2 semanas** | Assets | Video demo 45-60s, 5-8 screenshots de alta calidad del producto EN ACCIÓN |
| **-1 semana** | Logística | Programar lanzamiento, redactar "maker comment" (el "por qué" y la historia) |
| **Día D** | Ejecución | Martes/Miércoles/Jueves a 12:01 AM PST, responder TODOS los comentarios |

### Plataformas de Lanzamiento Adicionales
- **DevHunt** (primero, para validar con devs reales)
- **Hacker News** (Show HN)
- **Reddit** (`r/programacion`, `r/SideProject`, `r/webdev`)
- **LaunchDirectories.com** (100+ sitios de listado)

---

## 5. Canales de Distribución Prioritarios

### Comunidades Hispanas (Mayor conversión)
1. **Discord**: Midudev, Fazt, FrontendCafé, Platzi (canales #showcase)
2. **Reddit**: `r/programacion`, `r/devsarg`
3. **Facebook Groups**: "Programadores Colombia", grupos universitarios USCO/Corhuila
4. **LinkedIn**: Build in Public con hashtags `#TechLatam` `#BuildInPublic`
5. **X/Twitter**: Demos visuales + threads técnicos

### Comunidades Globales (Autoridad)
1. **Product Hunt**: Lanzamiento formal
2. **Hacker News**: Show HN
3. **DevHunt**: Developer tools específico
4. **Indie Hackers**: Historia del fundador
5. **GitHub Discussions**: Participar en repos populares de IA/coding

---

*Exploración completada: 2026-05-16T22:08*
