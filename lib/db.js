/*
 * Eenvoudige, draagbare data-opslag voor Agroria.
 * Alles staat in één JSON-bestand (db.json) plus de map "uploads" voor de foto's.
 *
 * Waar wordt dit bewaard?
 *  - Standaard: de map "data" in het project.
 *  - Zet je de omgevingsvariabele DATA_DIR (bijv. naar een persistente schijf op
 *    Render), dan wordt daar bewaard, zodat foto's en trekkers blijven staan.
 *
 * Kan er niet naar DATA_DIR geschreven worden (bijv. verkeerde rechten of een
 * typefout in het pad), dan valt de app veilig terug op de lokale "data"-map en
 * geeft een duidelijke waarschuwing — zo crasht de site nooit bij het opstarten.
 */
const fs = require('fs');
const path = require('path');

const EMPTY = { users: [], tractors: [], pages: {}, inquiries: [], settings: {} };
const LOCAL_DIR = path.join(__dirname, '..', 'data');

// Onthoudt of we blijvende opslag gebruiken (een ingestelde, beschrijfbare DATA_DIR).
let persistent = false;

// Bepaal (eenmalig, bij het opstarten) een bruikbare, beschrijfbare data-map.
function resolveDataDir() {
  const raw = (process.env.DATA_DIR || '').trim();
  const gewenst = raw ? path.resolve(raw) : LOCAL_DIR;
  try {
    fs.mkdirSync(path.join(gewenst, 'uploads'), { recursive: true });
    fs.accessSync(gewenst, fs.constants.W_OK); // controleer schrijfrechten
    persistent = !!raw; // alleen blijvend als er expliciet een DATA_DIR is ingesteld
    return gewenst;
  } catch (e) {
    if (gewenst !== LOCAL_DIR) {
      console.error(
        'WAARSCHUWING: kan niet schrijven naar DATA_DIR "' + gewenst + '" (' + e.message + ').\n' +
        '  De site valt terug op "' + LOCAL_DIR + '". LET OP: gegevens blijven dan\n' +
        '  NIET bewaard na een herstart. Controleer op Render de schijf (mount path\n' +
        '  /var/data) en de variabele DATA_DIR (exact /var/data, zonder spaties).'
      );
    }
    persistent = false;
    try { fs.mkdirSync(path.join(LOCAL_DIR, 'uploads'), { recursive: true }); } catch (e2) {}
    return LOCAL_DIR;
  }
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'db.json');
console.log('[Agroria] Data-map: ' + DATA_DIR + ' | blijvende opslag: ' + (persistent ? 'JA' : 'NEE (tijdelijk!)'));

function ensure() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) {
      fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2));
    }
  } catch (e) {
    console.error('Kon de data-map niet voorbereiden:', e.message);
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
  try {
    // Atomair schrijven: eerst naar tijdelijk bestand, dan hernoemen.
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('Kon db.json niet opslaan:', e.message);
  }
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = { read, write, id, ensure, DATA_DIR, DB_FILE, persistent };
