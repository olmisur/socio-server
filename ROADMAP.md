# Socio Roadmap

Resumen de lo que ya se ha hecho y de las siguientes mejoras prioritarias.

## Completado recientemente

### Base y fiabilidad
- Backend propio con Node.js, Express y MongoDB
- Autenticacion con JWT y espacios compartidos por codigo
- Notificaciones push web con claves VAPID
- Recordatorios de agenda por usuario
- Scheduler con `node-cron`
- Control de acceso reforzado en rutas sensibles
- Soporte correcto de zona horaria en agenda
- Logs estructurados y endpoint `/health`

### Arquitectura
- Frontend separado en modulos bajo `public/js`
- CSS extraido a `public/css/app.css`
- Colecciones propias para items, eventos, notas, gastos y recurrentes
- Script de migracion para pasar de arrays embebidos a colecciones
- Capa reutilizable de validacion en backend

### Producto y UX
- Agenda con creacion, edicion y avisos push
- Chat con IA, voz, manos libres y escaneo de tickets
- Gastos compartidos con resumen semanal
- Tareas recurrentes
- Onboarding inicial
- Undo en acciones rapidas
- Tono del asistente mas formal

### Calidad
- Tests unitarios e integracion ejecutables con `npm test`
- Cobertura especifica para auth, data y notificaciones

## Siguiente prioridad

### Producto
- Resumen matutino de eventos del dia
- Recetas a lista de compra
- Filtros en gastos por periodo y por miembro
- Edicion de recurrentes existentes
- Estados vacios y ayudas contextuales mas pulidos

### Fiabilidad
- Worker o proceso separado para tareas programadas
- Reintentos y trazabilidad de notificaciones push fallidas
- Metricas basicas de uso y errores
- Limpieza final de compatibilidad con arrays embebidos antiguos

### DX y mantenimiento
- Versionado del paquete y release process alineados con el changelog
- Mas tests de frontend o flujos end-to-end
- Documentar mejor scripts operativos y migraciones

## Referencias

- Historial detallado: [src/CHANGELOG.md](/C:/Users/huert/OneDrive/Documentos/GitHub/socio-server/src/CHANGELOG.md)
- Documentacion general: [README.md](/C:/Users/huert/OneDrive/Documentos/GitHub/socio-server/README.md)
