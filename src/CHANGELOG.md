# 📋 CHANGELOG — Socio App

Registro de todos los cambios, mejoras y correcciones de la app.
**Regla:** cada actualización debe añadir una entrada aquí antes de hacer commit.

---

## [2.7.0] — 2026-04-11
### 🔧 Fiabilidad
**Scheduler robusto**
- Reemplazado `setInterval` por `node-cron` (`*/5 * * * *`) en `notifications.js`
- Protección ante ejecuciones solapadas con flag `checkRunning`
- El scheduler se alinea al reloj (sin deriva) y respeta DST

**Modelo de datos mejorado**
- Creadas colecciones propias: `SpaceItem`, `SpaceEvent`, `SpaceNote`
- Índices compuestos `{ spaceId, id }` (único), `{ spaceId, type }`, `{ spaceId, date }`
- `data.js` actualizado: todas las lecturas/escrituras usan las nuevas colecciones
- El scheduler de notificaciones consulta `SpaceEvent` directamente (sin cargar todos los `Space`)
- `scripts/migrate-collections.js` — migración idempotente de datos embebidos existentes
- Los arrays embebidos en `Space` se mantienen por compatibilidad hasta limpiarlos manualmente

**Observabilidad**
- `src/utils/logger.js` — salida JSON estructurada `{ ts, level, msg, ...meta }` (silenciado en tests)
- `GET /health` — devuelve `{ status, uptime, db, ts }`, HTTP 503 si MongoDB no está conectado
- Error handler global en Express para errores no capturados por rutas
- `uncaughtException` y `unhandledRejection` capturados en `server.js` con log antes de salir

---

## [2.6.0] — 2026-04-11
### ✅ Tests automatizados de integración
- `src/app.js` extraído de `server.js` para instanciar la app sin conectar a MongoDB de producción
- `test/helpers.js` — infraestructura compartida: MongoDB en memoria (`mongodb-memory-server`) + cliente HTTP (`supertest`)
- `test/auth.test.js` — 16 tests: registro, login, normalización de email, espacios, códigos de invitación
- `test/data.test.js` — 23 tests: control de acceso entre usuarios, CRUD compra/tareas/agenda/notas, zona horaria en eventos, espacio compartido
- `test/notif.test.js` — 9 tests: rutas push sin VAPID, autenticación y validación de body
- `test/index.js` — runner que ejecuta unit tests + integración en secuencia
- `npm test` ahora cubre 60 tests (12 unit + 48 integración)
- **Validación robusta** marcada como completada: `requestValidation.js` ya cubre lo equivalente a `zod`/`joi` sin dependencia extra

---

## [2.5.0] — 2026-04-11
### 🏗️ Refactor — separación en módulos
- `public/index.html` reducido de 850 líneas a 202 (solo HTML estructural)
- CSS extraído a `public/css/app.css`
- JS dividido en 10 módulos bajo `public/js/`:
  - `state.js` — variables globales compartidas
  - `utils.js` — `esc`, `toast`, `api`
  - `auth.js` — login, registro y logout
  - `app.js` — arranque, espacios, tabs, FAB, polling, boot
  - `lists.js` — compra y tareas
  - `agenda.js` — agenda y modal de evento (crear/editar)
  - `notas.js` — notas y editor
  - `chat.js` — chat IA y escáner de ticket
  - `voice.js` — TTS, micrófono y modo manos libres
  - `push.js` — notificaciones push VAPID (sin monkey-patch)
- El segundo `<script>` de push fuera del `</body>` eliminado; integrado limpiamente en `agenda.js` y `push.js`
- Sintaxis verificada con `node --check` en todos los módulos

---

## [2.4.0] — 2026-04-10
### ✅ Correcciones críticas (revisión de seguridad y fiabilidad)
- **[P1] Notificaciones por usuario** — los recordatorios de agenda ahora son individuales por miembro, no globales al evento. Corregido en `Space.js` y `notifications.js`
- **[P1] Control de acceso en `/api/notif/event-notif`** — añadida validación de pertenencia al espacio, igual que en `data.js`
- **[P2] Zona horaria del servidor** — el scheduler ahora usa `Europe/Madrid` en lugar de UTC. Corregido en `notifications.js` y `agendaNotifications.js`
- **[P2] Email case-sensitive** — normalización a minúsculas en login y registro en `auth.js`
- **Notificaciones móvil** — corregido el flujo push para que se suscriba correctamente desde el móvil. Actualizado `sw.js` y `index.html`

### ✨ Mejoras
- Agenda devuelve `notifyEnabled` solo para el usuario actual
- Se guarda `timeZone` del dispositivo al crear eventos en `data.js`
- Tono del asistente más formal y conciso en `index.html`
- Validación de entradas en `auth.js`, `data.js` y `notifications.js`
- Capa reutilizable de validación en `src/utils/requestValidation.js`
- Base de tests en `test/run.js` ejecutable con `npm test`
- **Edición de eventos** — PUT `/api/data/:spaceId/agenda/:evId` en `data.js`. El modal de agenda ahora sirve tanto para crear como para editar

---

## [2.3.0] — 2026-04-10
### ✨ Notificaciones push
- Integración de `web-push` con claves VAPID
- Scheduler cada 5 minutos que comprueba eventos próximos
- Notificación 30 minutos antes del evento al creador
- Botón 🔔/🔕 por evento en la agenda
- Service Worker actualizado para recibir y mostrar notificaciones push
- Variables de entorno: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- Nuevos campos en `Space.js` → `eventSchema`: `notifyUserId`, `notified`
- Nuevo campo en `User.js`: `pushSubscription`
- Nueva ruta: `POST /api/notif/subscribe`
- Nueva ruta: `GET /api/notif/vapid-key`
- Nueva ruta: `POST /api/notif/event-notif`

---

## [2.2.0] — 2026-04-10
### ✨ Modo manos libres
- Botón **"🎙️ libre"** en el header para activar escucha continua
- Al activarse, Socio escucha, responde en voz alta y vuelve a escuchar solo
- Pausa automática mientras habla para no captarse a sí mismo
- Se reanuda automáticamente tras cada respuesta
- Estado persistido en `localStorage`

### 🔧 Correcciones
- Fondo sólido en el chat — eliminada transparencia que solapaba vistas
- Mensajes del bot ahora tienen fondo opaco
- Sugerencias con fondo sólido

---

## [2.1.0] — 2026-04-10
### ✨ Migración a servidor propio (EasyPanel + VPS)
- Backend Node.js + Express en contenedor Docker
- Base de datos MongoDB en VPS propio
- Sistema de autenticación con JWT (registro y login por email/contraseña)
- **Espacios múltiples**: Personal 🏠, Familia 👨‍👩‍👧, Negocio 💼
- Invitación a espacios por código de 6 letras
- API REST completa: `/api/auth`, `/api/data`, `/api/ai`
- La API key de Anthropic se guarda en el servidor (no expuesta en el cliente)
- Sincronización en tiempo real entre miembros del mismo espacio (polling cada 5s)
- Datos guardados en MongoDB — no se pierden al cambiar de dispositivo
- Dockerfile para despliegue en EasyPanel
- Variables de entorno: `MONGO_URI`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `PORT`

---

## [2.0.0] — 2026-04-10
### ✨ Versión completa con todas las funciones
- **Voz de respuesta (TTS)** — Socio contesta en voz alta. Botón 🔊 para activar/desactivar
- **Foto a ticket** — foto a ticket de compra → detección automática de productos → añadidos a la lista
- **Lista compartida en tiempo real** — código de sala para compartir con pareja/familia via Firebase
- **Notificaciones básicas** (versión Netlify) — botón 🔔 por evento con `Notification API`
- Diseño oscuro mejorado con fondo sólido en todas las vistas

---

## [1.1.0] — 2026-04-09
### 🔧 Correcciones
- Corregidas rutas en `manifest.json` y `sw.js` para GitHub Pages subfolder (`/socio/`)
- Añadido `.nojekyll` para evitar procesado Jekyll en GitHub Pages
- Service Worker simplificado para evitar problemas de caché
- Migración de GitHub Pages a **Netlify** para evitar problemas de 404

---

## [1.0.0] — 2026-04-09
### 🎉 Versión inicial — PWA básica (Netlify)
- Chat con IA (Socio) — responde en español informal
- **Lista de la compra** — añadir, tachar, limpiar comprados
- **Tareas y recados** — gestión completa
- **Agenda** — eventos por fecha y hora
- **Notas rápidas** — editor integrado
- **Voz de entrada** — micrófono para hablar con Socio
- Guardado local con `localStorage`
- PWA instalable en Android desde Chrome
- Service Worker para funcionamiento offline básico
- Icono y manifest para instalación como app

---

## 🗺️ ROADMAP — Próximas mejoras

### 🔴 Prioridad Alta
- [ ] **Refactor de `index.html`** — separar en módulos por dominio (auth, agenda, chat, push)
- [ ] **Validación robusta** — usar `zod` o `joi` en todas las rutas del backend
- [ ] **Tests automatizados** — auth, permisos entre espacios, agenda con zonas horarias, notificaciones

### 🟡 Fiabilidad
- [ ] **Scheduler robusto** — mover el `setInterval` a un worker o cron persistente fuera del proceso web
- [ ] **Modelo de datos mejorado** — separar `compra`, `tareas`, `agenda` y `notas` en colecciones propias
- [ ] **Observabilidad** — logs estructurados, endpoint `/health`, métricas básicas y trazas de errores

### 🟢 Producto y UX
- [ ] **Deshacer acciones** — botón "deshacer" al borrar o marcar tareas/productos
- [ ] **Onboarding mejorado** — guía para espacios, invitaciones, permisos de notificaciones y voz
- [ ] **Consistencia del asistente** — tono formal y respuestas de una línea
- [ ] **Notificación de eventos del día** — resumen matutino de la agenda del día
- [ ] **Recetas a lista de compra** — decir una receta y añadir ingredientes automáticamente
- [ ] **Control de gastos** — apuntar gastos y ver resumen semanal
- [ ] **Tareas repetitivas** — "todos los lunes recuérdame sacar la basura"

---

*Última actualización: 2026-04-10*
