// Runner principal: ejecuta unit tests y luego integration tests en secuencia
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suites = [
  'test/run.js',         // unit tests (validación + agendaNotifications)
  'test/auth.test.js',   // integración: auth
  'test/data.test.js',   // integración: datos y permisos
  'test/notif.test.js',  // integración: notificaciones
];

let allPassed = true;

for (const suite of suites) {
  console.log(`\n--- ${suite} ---`);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '..', suite)], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  if (result.status !== 0) allPassed = false;
}

if (!allPassed) {
  console.error('\n❌ Algún test ha fallado');
  process.exit(1);
} else {
  console.log('\n✅ Todos los tests pasaron');
}
