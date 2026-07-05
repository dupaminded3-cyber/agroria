const bcrypt = require('bcryptjs');
const { readDb, writeDb, ensureDirs } = require('./db');

const STANDAARD_WACHTWOORD = process.env.ADMIN_PASSWORD || 'roelfsema';

function seed() {
  ensureDirs();
  const db = readDb();
  let gewijzigd = false;

  if (!db.instellingen.wachtwoordHash) {
    db.instellingen.wachtwoordHash = bcrypt.hashSync(STANDAARD_WACHTWOORD, 10);
    gewijzigd = true;
    console.log('Standaard beheerder aangemaakt: gebruikersnaam "root".');
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`Wachtwoord: "${STANDAARD_WACHTWOORD}" — wijzig dit direct na de eerste keer inloggen!`);
    }
  }

  if (gewijzigd) writeDb(db);
}

seed();
