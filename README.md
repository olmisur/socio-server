# 🤝 Socio - Guía de instalación en EasyPanel

## Lo que necesitas
- Tu VPS con EasyPanel instalado
- MongoDB (lo instalamos en EasyPanel)

---

## PASO 1 — Instalar MongoDB en EasyPanel

1. Entra en EasyPanel → **"+ New Service"**
2. Busca **"MongoDB"** y selecciónalo
3. Dale un nombre: `socio-mongo`
4. Pulsa **Deploy**
5. Cuando arranque, ve a su configuración y **copia la URL de conexión** (algo como `mongodb://socio-mongo:27017`)

---

## PASO 2 — Crear la app Socio

1. En EasyPanel → **"+ New Service"** → **"App"**
2. Nombre: `socio`
3. En **"Source"** selecciona **"Upload"** y sube el ZIP de este proyecto

   O si prefieres con Git:
   - Sube este código a un repo de GitHub (privado)
   - En EasyPanel conecta tu GitHub y selecciona el repo

4. EasyPanel detectará el `Dockerfile` automáticamente

---

## PASO 3 — Configurar las variables de entorno

En la configuración de tu app `socio` en EasyPanel, ve a **"Environment"** y añade:

```
MONGO_URI=mongodb://socio-mongo:27017/sociodb
JWT_SECRET=pon_aqui_una_clave_secreta_muy_larga_y_aleatoria_min_32_chars
ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui
PORT=3000
NODE_ENV=production
```

⚠️ **IMPORTANTE**: El `JWT_SECRET` debe ser una cadena larga y aleatoria. Puedes generar una así:
```
openssl rand -base64 32
```

---

## PASO 4 — Configurar el dominio

1. En la config de tu app → **"Domains"**
2. Añade tu dominio: `socio.tudominio.com`
3. EasyPanel configurará HTTPS automáticamente con Let's Encrypt

Si no tienes dominio propio, EasyPanel te da un subdominio gratuito tipo:
`socio.tu-easypanel.com`

---

## PASO 5 — Deploy

1. Pulsa **"Deploy"**
2. Espera 1-2 minutos a que construya el contenedor
3. Abre tu dominio → verás la pantalla de Socio
4. **Regístrate** con tu email y contraseña
5. ¡Listo!

---

## Instalar en el móvil

1. Abre Chrome en Android → ve a tu URL de Socio
2. Menú (⋮) → **"Instalar aplicación"**
3. ¡Aparece como app en tu teléfono!

---

## Espacios disponibles

Al registrarte se crea automáticamente tu espacio **Personal**.
Para crear más espacios:
- Pulsa **"+"** en la barra de espacios
- Elige **Familia** o **Negocio**
- Comparte el **código de invitación** con tu pareja o equipo
- Ellos entran en Socio → **"+"** → introducen el código

---

## Actualizar la app

Si quieres actualizar Socio con nuevas funciones:
1. Sube el nuevo ZIP en EasyPanel
2. Pulsa **"Redeploy"**
3. En 1 minuto está actualizado para todos

---

## Estructura del proyecto

```
socio-server/
├── Dockerfile          ← Para EasyPanel
├── docker-compose.yml  ← Para pruebas locales
├── package.json
├── .env.example        ← Copia como .env para desarrollo local
├── src/
│   ├── server.js       ← Servidor principal
│   ├── models/
│   │   ├── User.js     ← Modelo de usuario
│   │   └── Space.js    ← Modelo de espacio (datos)
│   ├── routes/
│   │   ├── auth.js     ← Login, registro, espacios
│   │   ├── data.js     ← CRUD compra, tareas, agenda, notas
│   │   └── ai.js       ← Proxy para Anthropic API
│   └── middleware/
│       └── auth.js     ← Verificación JWT
└── public/
    ├── index.html      ← Frontend completo
    ├── manifest.json   ← PWA config
    ├── sw.js           ← Service Worker
    └── icons/          ← Iconos de la app
```
