# Tasks — Plan de Marketing Vibe Studio

## Fase 1: Infraestructura de Marketing (Días 1-15)

### 1.1 Analytics
- [ ] Desplegar Umami Analytics vía Docker en AWS
- [ ] Configurar tracking script en `opitacode.com` (landing)
- [ ] Configurar tracking script en `vibe.opitacode.com` (IDE web)
- [ ] Configurar tracking script en `cuenta.opitacode.com` (portal de cuenta)
- [ ] Crear dashboard de métricas principales (visitas, bounce rate, conversión)

### 1.2 SEO Tracking
- [ ] Desplegar SerpBear vía Docker en AWS
- [ ] Configurar 20 keywords objetivo (ver lista en spec.md)
- [ ] Establecer monitoreo semanal de posiciones

### 1.3 Email Marketing
- [ ] Desplegar Listmonk vía Docker en AWS
- [ ] Conectar Listmonk a AWS SES (credenciales existentes, dominio `auth@opitacode.com`)
- [ ] Crear lista "General" y lista "Estudiantes"
- [ ] Diseñar template de email con branding Opita Code
- [ ] Implementar Welcome Series (3 emails)
- [ ] Implementar flujo de Trial Expiration (3 emails)
- [ ] Configurar newsletter semanal

### 1.4 Formulario de Captura de Leads
- [ ] Crear formulario de registro/waitlist en la landing page
- [ ] Conectar formulario a Listmonk vía API
- [ ] A/B test del copy del CTA ("Empieza gratis" vs "Crea tu primera app")

### 1.5 Landing Page SEO
- [ ] Crear página `/estudiantes` con SEO optimizado
- [ ] Crear página `/comparativa` (Vibe Studio vs Cursor vs Bolt)
- [ ] Agregar Schema markup (SoftwareApplication, FAQPage)
- [ ] Optimizar meta descriptions en todas las páginas existentes
- [ ] Iniciar blog en `opitacode.com/blog`

---

## Fase 2: Contenido y Comunidad (Días 15-45)

### 2.1 Social Media Infrastructure
- [ ] Desplegar Postiz vía Docker en AWS
- [ ] Conectar cuentas: X, LinkedIn, Instagram, TikTok, YouTube
- [ ] Configurar calendario de publicación semanal (ver spec.md)

### 2.2 Product Analytics
- [ ] Registrar cuenta gratuita en PostHog Cloud (1M events/mes gratis)
- [ ] Integrar PostHog SDK en `vibe.opitacode.com`
- [ ] Configurar funnels: Landing → Registro → Login → Primer proyecto → Plan pago
- [ ] Crear primer A/B test en landing page (hero copy)

### 2.3 Contenido Inicial (Semanas 3-4)
- [ ] Escribir 4 artículos para el blog:
  - [ ] "Qué es Vibe Coding y por qué importa para LATAM"
  - [ ] "Vibe Studio vs Cursor vs Bolt: Comparativa honesta"
  - [ ] "Cómo creamos subagentes autónomos con React y AWS"
  - [ ] "5 proyectos que puedes crear en 10 minutos con Vibe Studio"
- [ ] Grabar 4 videos cortos (< 60 seg) para TikTok/Instagram Reels
- [ ] Crear 8 posts para LinkedIn (Build in Public)
- [ ] Crear 12 tweets/posts para X

### 2.4 Comunidades (Semanas 3-6)
- [ ] Unirse a Discord de Midudev, Fazt, FrontendCafé, Platzi
- [ ] Publicar showcase en los canales de #proyectos
- [ ] Publicar en Reddit: r/programacion, r/webdev, r/SideProject
- [ ] Participar en 5 threads de Stack Overflow en Español relacionados con IA/IDEs
- [ ] Unirse a grupos de Facebook: "Programadores Colombia", grupos universitarios

### 2.5 Programa Universitario "Vibe Campus"
- [ ] Redactar propuesta formal para universidades
- [ ] Contactar Departamento de Sistemas USCO (correo + visita)
- [ ] Contactar Corhuila, UNAD sede Neiva, CUN, Uniminuto
- [ ] Preparar material de presentación (deck de 10 slides)
- [ ] Diseñar landing page `/campus` con formulario de verificación estudiantil
- [ ] Reclutar 2 embajadores de prueba (beta del programa)

---

## Fase 3: Lanzamiento y Escalamiento (Días 45-90)

### 3.1 CRM & Automatización
- [ ] Desplegar Twenty CRM vía Docker en AWS
- [ ] Importar leads existentes desde Listmonk
- [ ] Desplegar n8n vía Docker en AWS
- [ ] Crear workflow: Nuevo registro → Agregar a CRM → Welcome email → Notificación Slack/Discord

### 3.2 Preparación de Lanzamiento
- [ ] Grabar video demo profesional (60 segundos)
- [ ] Crear 8 screenshots de alta calidad del IDE en acción
- [ ] Preparar assets de Product Hunt (logo 240x240, gallery 1270x760, GIF)
- [ ] Redactar maker comment para Product Hunt
- [ ] Redactar post para Hacker News (Show HN)
- [ ] Construir waitlist de 100+ personas pre-lanzamiento

### 3.3 Ejecución de Lanzamientos
- [ ] **Semana 7:** Lanzar en DevHunt
- [ ] **Semana 8:** Publicar en Hacker News (Show HN)
- [ ] **Semana 9:** Analizar feedback y ajustar messaging
- [ ] **Semana 10:** Lanzar en Product Hunt (Martes o Miércoles, 12:01 AM PST)
- [ ] **Semana 10 (día D):** Activar notificación a toda la waitlist
- [ ] **Semana 10 (día D):** Compartir en todas las comunidades simultáneamente
- [ ] **Semana 10 (día D):** Responder TODOS los comentarios en las primeras 4 horas
- [ ] **Semana 12:** Publicar en 100+ directorios vía LaunchDirectories.com

### 3.4 Post-Lanzamiento
- [ ] Agregar badge de Product Hunt a la landing page
- [ ] Publicar retrospectiva "Cómo lanzamos en Product Hunt desde Neiva, Colombia"
- [ ] Evaluar métricas vs KPIs (ver spec.md)
- [ ] Definir roadmap de marketing para los siguientes 90 días

---

## Review Workload Forecast
- **Estimated effort:** ~90 días de ejecución, ~20 horas/semana dedicadas
- **Chained PRs recommended:** No (este es un plan de ejecución, no un PR de código)
- **400-line budget risk:** N/A
- **Decision needed before apply:** No — este es un artefacto de planificación

---

*Tasks generadas: 2026-05-16T22:11*
