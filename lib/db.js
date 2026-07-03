/*
 * Eenvoudige, draagbare data-opslag voor Agroria.
 * Alles staat in één JSON-bestand (data/db.json) plus de map data/uploads
 * voor de foto's. Wil je later verhuizen? Kopieer simpelweg de hele map "data".
 */
const fs = require('fs');
const path = require('path');

// Waar de gegevens (db.json + foto's) worden bewaard.
// Standaard de map "data" in het project. Zet je op een host (bijv. Render)
// de omgevingsvariabele DATA_DIR naar een persistente schijf, dan blijven je
// foto's en trekkers bewaard, ook na een herstart of nieuwe versie.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { users: [], tractors: [], pages: {}, inquiries: [], settings: {} };

// Zorgt dat de mappen en het lege db-bestand bestaan (geen recursie).
function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) {
    fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2));
  }
}

function read() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Kon db.json niet lezen:', e.message);
    return JSON.parse(JSON.stringify(EMPTY));
  }
}

function write(data) {
  ensure();
  // Atomair schrijven: eerst naar tijdelijk bestand, dan hernoemen.
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = { read, write, id, ensure, DATA_DIR, DB_FILE };
