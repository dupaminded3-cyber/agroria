const bcrypt = require('bcryptjs');
const { readDb, writeDb } = require('./db');

const nieuwWachtwoord = process.argv[2] || 'roelfsema';

const db = readDb();
db.instellingen.wachtwoordHash = bcrypt.hashSync(nieuwWachtwoord, 10);
writeDb(db);

console.log('Wachtwoord teruggezet.');
console.log('Gebruikersnaam: root');
console.log(`Wachtwoord: ${nieuwWachtwoord}`);
