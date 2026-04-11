/**
 * Migración v2.6 → v2.7: mueve compra, tareas, agenda y notas
 * de los arrays embebidos en Space a las nuevas colecciones propias.
 *
 * Uso: node scripts/migrate-collections.js
 * Requiere: MONGO_URI en .env o en el entorno.
 * Es idempotente: no duplica datos si se ejecuta más de una vez.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Space = require('../src/models/Space');
const SpaceItem = require('../src/models/SpaceItem');
const SpaceEvent = require('../src/models/SpaceEvent');
const SpaceNote = require('../src/models/SpaceNote');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado. Iniciando migración...');

  const spaces = await Space.find({});
  let totals = { compra: 0, tareas: 0, agenda: 0, notas: 0, spaces: 0 };

  for (const space of spaces) {
    const sid = space.id;

    // ── Compra ────────────────────────────────────────────
    for (const item of space.compra || []) {
      const exists = await SpaceItem.exists({ spaceId: sid, id: item.id });
      if (!exists) {
        await SpaceItem.create({ spaceId: sid, type: 'compra', id: item.id, name: item.name, done: item.done, addedBy: item.addedBy || '', ts: item.ts });
        totals.compra++;
      }
    }

    // ── Tareas ────────────────────────────────────────────
    for (const item of space.tareas || []) {
      const exists = await SpaceItem.exists({ spaceId: sid, id: item.id });
      if (!exists) {
        await SpaceItem.create({ spaceId: sid, type: 'tareas', id: item.id, name: item.name, done: item.done, addedBy: item.addedBy || '', ts: item.ts });
        totals.tareas++;
      }
    }

    // ── Agenda ────────────────────────────────────────────
    for (const ev of space.agenda || []) {
      const exists = await SpaceEvent.exists({ spaceId: sid, id: ev.id });
      if (!exists) {
        await SpaceEvent.create({
          spaceId: sid,
          id: ev.id,
          title: ev.title,
          date: ev.date,
          time: ev.time || '',
          timeZone: ev.timeZone || 'Europe/Madrid',
          note: ev.note || '',
          createdBy: ev.createdBy || '',
          reminders: ev.reminders || [],
          notifyUserId: ev.notifyUserId || null,
          notified: ev.notified || false,
          ts: ev.ts
        });
        totals.agenda++;
      }
    }

    // ── Notas ─────────────────────────────────────────────
    for (const nota of space.notas || []) {
      const exists = await SpaceNote.exists({ spaceId: sid, id: nota.id });
      if (!exists) {
        await SpaceNote.create({ spaceId: sid, id: nota.id, title: nota.title || '', body: nota.body || '', createdBy: nota.createdBy || '', date: nota.date || '', ts: nota.ts });
        totals.notas++;
      }
    }

    totals.spaces++;
    console.log(`  Espacio "${space.name}" (${sid}) migrado`);
  }

  console.log(`\nMigración completada:`);
  console.log(`  Espacios procesados : ${totals.spaces}`);
  console.log(`  Compra migrados     : ${totals.compra}`);
  console.log(`  Tareas migradas     : ${totals.tareas}`);
  console.log(`  Eventos migrados    : ${totals.agenda}`);
  console.log(`  Notas migradas      : ${totals.notas}`);
  console.log(`\nLos arrays embebidos en Space siguen ahí pero ya no se usan.`);
  console.log(`Puedes borrarlos manualmente en MongoDB si quieres limpiar el esquema.`);

  await mongoose.disconnect();
}

migrate().catch(err => { console.error('Error en migración:', err.message); process.exit(1); });
