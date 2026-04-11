// Infraestructura compartida: MongoDB en memoria + supertest
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const supertest = require('supertest');
const { createApp } = require('../src/app');

let mongod = null;
let request = null;

async function setup() {
  // Variables de entorno mínimas para tests
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.VAPID_PUBLIC_KEY = '';
  process.env.VAPID_PRIVATE_KEY = '';
  process.env.VAPID_EMAIL = '';
  process.env.ANTHROPIC_API_KEY = 'test-key';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  request = supertest(createApp());
  return request;
}

async function teardown() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDB() {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
}

// Runner async compatible con el patrón existente
let failed = 0;
async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}: ${err.message}`);
    failed++;
  }
}

function summary(suite) {
  if (failed > 0) {
    console.error(`\n${suite}: ${failed} test(s) fallaron`);
    process.exitCode = 1;
  } else {
    console.log(`\n${suite}: todos los tests pasaron`);
  }
  failed = 0;
}

module.exports = { setup, teardown, clearDB, run, summary };
