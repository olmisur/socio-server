# Socio

Asistente personal y colaborativo para compra, tareas, agenda, notas, chat con IA y notificaciones push.

## Estado actual

La app ya incluye:
- Autenticacion con JWT y espacios `Personal`, `Familia` y `Negocio`
- Listas compartidas de compra y tareas
- Agenda con creacion, edicion y recordatorios push por usuario
- Notas rapidas
- Chat con IA, voz, modo manos libres y escaneo de tickets
- Gastos compartidos con resumen semanal
- Tareas recurrentes
- Onboarding y acciones con deshacer

## Documentacion

- Roadmap vivo: [ROADMAP.md](/C:/Users/huert/OneDrive/Documentos/GitHub/socio-server/ROADMAP.md)
- Historial de cambios: [src/CHANGELOG.md](/C:/Users/huert/OneDrive/Documentos/GitHub/socio-server/src/CHANGELOG.md)

## Despliegue en EasyPanel

### Requisitos
- VPS con EasyPanel
- MongoDB desplegado en EasyPanel

### Variables de entorno

```env
MONGO_URI=mongodb://socio-mongo:27017/sociodb
JWT_SECRET=pon_aqui_una_clave_secreta_muy_larga_y_aleatoria
ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui
VAPID_PUBLIC_KEY=tu_clave_publica_vapid
VAPID_PRIVATE_KEY=tu_clave_privada_vapid
VAPID_EMAIL=mailto:tu@email.com
PORT=3000
NODE_ENV=production
```

### Pasos
1. Crea un servicio MongoDB en EasyPanel.
2. Crea la app `socio` desde ZIP o Git.
3. Configura las variables de entorno.
4. Despliega la app y asigna dominio.
5. Si vienes de una version antigua con datos embebidos, ejecuta `node scripts/migrate-collections.js`.

## Uso rapido

1. Registrate con email y contrasena.
2. Crea o unete a un espacio con codigo de invitacion.
3. Abre la app desde el movil y acepta notificaciones.
4. Instalala como PWA desde Chrome.

## Desarrollo local

```bash
npm install
npm run dev
```

Tests:

```bash
npm test
```

## Estructura actual

```text
socio-server/
|-- public/
|   |-- css/
|   |-- js/
|   |   |-- agenda.js
|   |   |-- app.js
|   |   |-- auth.js
|   |   |-- chat.js
|   |   |-- gastos.js
|   |   |-- lists.js
|   |   |-- notas.js
|   |   |-- onboarding.js
|   |   |-- push.js
|   |   |-- state.js
|   |   |-- utils.js
|   |   `-- voice.js
|   |-- index.html
|   |-- manifest.json
|   `-- sw.js
|-- scripts/
|   `-- migrate-collections.js
|-- src/
|   |-- middleware/
|   |-- models/
|   |   |-- Space.js
|   |   |-- SpaceEvent.js
|   |   |-- SpaceExpense.js
|   |   |-- SpaceItem.js
|   |   |-- SpaceNote.js
|   |   |-- SpaceRecurring.js
|   |   `-- User.js
|   |-- routes/
|   |-- utils/
|   |-- app.js
|   `-- server.js
|-- test/
|-- ROADMAP.md
`-- package.json
```
