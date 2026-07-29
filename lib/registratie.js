/**
 * Teksten voor artikel "Import, uitvoer en registratie" in de koopovereenkomst.
 * Herkomst: '' | 'Duitsland' | 'België'  (leeg = al in Nederland)
 * Bestemming: 'Nederland' | 'België' | 'Duitsland'
 *
 * Agroria (verkoper) verzorgt het traject inclusief inschrijving in het
 * bestemmingsland. Geen vaste bedragen — die wijzigen bij de instanties.
 */

const HERKOMST = ['', 'Duitsland', 'België'];
const BESTEMMING = ['Nederland', 'België', 'Duitsland'];

function normaliseerHerkomst(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === 'Duitsland' || s === 'België') return s;
  return '';
}

function normaliseerBestemming(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === 'België' || s === 'Duitsland') return s;
  return 'Nederland';
}

function labelHerkomst(herkomst) {
  return herkomst || 'Nederland';
}

/**
 * @param {{ importLand?: string, bestemmingLand?: string }} o
 * @param {{ meervoud?: boolean }} opts
 * @returns {{ titel: string, paragrafen: string[] }}
 */
function registratieArtikel(o, opts) {
  const meervoud = !!(opts && opts.meervoud);
  const herkomst = normaliseerHerkomst(o && o.importLand);
  const bestemming = normaliseerBestemming(o && o.bestemmingLand);
  const M = meervoud ? 'De machines worden' : 'De machine wordt';
  const m = meervoud ? 'de machines' : 'de machine';
  const kunnen = meervoud ? 'kunnen' : 'kan';
  const kentekens = meervoud ? 'de kentekens' : 'het kenteken';

  const verzekering =
    `Verkoper adviseert koper om vóór de leverdatum een (minimaal WA-)verzekering ` +
    `af te sluiten op ${kentekens} van het bestemmingsland, zodat ${m} direct na ` +
    `aflevering verzekerd de openbare weg op ${kunnen}.`;

  const doorlooptijd =
    `Door de doorlooptijd bij de bevoegde instanties geldt de afgesproken leverdatum als indicatief.`;

  const titel = 'Import, uitvoer en registratie';
  const van = labelHerkomst(herkomst);
  const naar = bestemming;
  const key = `${van}->${naar}`;

  /** @type {Record<string, string[]>} */
  const routes = {
    // ---- Bestemming Nederland ----
    'Nederland->Nederland': [
      `${M} reeds beschikbaar in Nederland. Er is geen grensoverschrijdend ` +
        `invoertraject van toepassing. Verkoper zorgt ervoor dat ${m} bij aflevering ` +
        `is voorzien van een geldige Nederlandse kentekenregistratie (RDW) en de ` +
        `bijbehorende documenten, voor zover voor het betreffende voertuig een ` +
        `kentekenplicht geldt.`,
      doorlooptijd,
      verzekering
    ],

    'Duitsland->Nederland': [
      `${M} door verkoper geïmporteerd uit Duitsland naar Nederland. Verkoper ` +
        `verzorgt het volledige invoer- en registratietraject en draagt de kosten ` +
        `daarvan, waaronder: het transport naar Nederland, het verzamelen van de ` +
        `originele Duitse voertuigdocumenten (waaronder Zulassungsbescheinigung ` +
        `voor zover aanwezig), de RDW-beoordeling/identificatie, de inschrijving ` +
        `in het Nederlandse kentekenregister en de afgifte van het Nederlandse ` +
        `kenteken. Indien een Certificaat van Overeenstemming (CvO/CoC) beschikbaar ` +
        `is, wordt dit meegeleverd; ontbreekt dit, dan volgt waar nodig een ` +
        `technische beoordeling door de RDW.`,
      `${M} geleverd voorzien van Nederlandse kentekenregistratie. ${doorlooptijd}`,
      verzekering
    ],

    'België->Nederland': [
      `${M} door verkoper geïmporteerd uit België naar Nederland. Verkoper ` +
        `verzorgt het volledige invoer- en registratietraject en draagt de kosten ` +
        `daarvan, waaronder: het transport naar Nederland, het verzamelen van de ` +
        `originele Belgische inschrijvingsdocumenten, de RDW-beoordeling/identificatie, ` +
        `de inschrijving in het Nederlandse kentekenregister en de afgifte van het ` +
        `Nederlandse kenteken. Indien een Certificaat van Overeenstemming (CvO/CoC) ` +
        `beschikbaar is, wordt dit meegeleverd; ontbreekt dit, dan volgt waar nodig ` +
        `een technische beoordeling door de RDW.`,
      `${M} geleverd voorzien van Nederlandse kentekenregistratie. ${doorlooptijd}`,
      verzekering
    ],

    // ---- Bestemming België ----
    'Nederland->België': [
      `${M} vanuit Nederland geleverd aan koper in België. Verkoper verzorgt het ` +
        `volledige uitvoer- en Belgische registratietraject en draagt de kosten ` +
        `daarvan, waaronder: het afmelden bij de RDW (vrijwaringsbewijs), het ` +
        `transport naar België, de benodigde douane-/invoermelding (E705) voor ` +
        `inschrijving, de administratieve of technische keuring voor invoer ` +
        `(afhankelijk van Europese typegoedkeuring en documentatie), en de ` +
        `inschrijving bij de Dienst voor Inschrijvingen van Voertuigen (DIV) ` +
        `met afgifte van de Belgische nummerplaat/inschrijving.`,
      `${M} geleverd voorzien van Belgische DIV-registratie. ${doorlooptijd}`,
      verzekering
    ],

    'Duitsland->België': [
      `${M} door verkoper overgebracht van Duitsland naar België. Verkoper ` +
        `verzorgt het volledige traject en draagt de kosten daarvan, waaronder: ` +
        `het verkrijgen/afhandelen van de Duitse voertuigdocumenten en afmelding ` +
        `waar nodig, het transport naar België, de benodigde douane-/invoermelding ` +
        `(E705), de administratieve of technische keuring voor invoer in België ` +
        `(afhankelijk van Europese typegoedkeuring en documentatie), en de ` +
        `inschrijving bij de Dienst voor Inschrijvingen van Voertuigen (DIV) ` +
        `met afgifte van de Belgische nummerplaat/inschrijving.`,
      `${M} geleverd voorzien van Belgische DIV-registratie. ${doorlooptijd}`,
      verzekering
    ],

    'België->België': [
      `${M} reeds beschikbaar in België. Er is geen Nederlands RDW-invoertraject ` +
        `van toepassing. Verkoper verzorgt de Belgische administratieve afhandeling ` +
        `en draagt de kosten daarvan, waaronder de inschrijving of overschrijving ` +
        `bij de Dienst voor Inschrijvingen van Voertuigen (DIV) en de bijbehorende ` +
        `keuring/documenten voor zover vereist, zodat ${m} bij aflevering is ` +
        `voorzien van een geldige Belgische inschrijving.`,
      doorlooptijd,
      verzekering
    ],

    // ---- Bestemming Duitsland ----
    'Nederland->Duitsland': [
      `${M} vanuit Nederland geleverd aan koper in Duitsland. Verkoper verzorgt ` +
        `het volledige uitvoer- en Duitse registratietraject en draagt de kosten ` +
        `daarvan, waaronder: het afmelden bij de RDW (vrijwaringsbewijs), het ` +
        `transport naar Duitsland, het aanleveren van de vereiste voertuig- en ` +
        `eigendomsdocumenten, en de Zulassung (inschrijving) bij de bevoegde ` +
        `Duitse Zulassungsstelle, inclusief de afgifte van het Duitse kenteken.`,
      `${M} geleverd voorzien van Duitse kentekenregistratie. ${doorlooptijd}`,
      verzekering
    ],

    'België->Duitsland': [
      `${M} door verkoper overgebracht van België naar Duitsland. Verkoper ` +
        `verzorgt het volledige traject en draagt de kosten daarvan, waaronder: ` +
        `het verkrijgen/afhandelen van de Belgische inschrijvingsdocumenten, ` +
        `het transport naar Duitsland, en de Zulassung (inschrijving) bij de ` +
        `bevoegde Duitse Zulassungsstelle, inclusief de afgifte van het Duitse kenteken.`,
      `${M} geleverd voorzien van Duitse kentekenregistratie. ${doorlooptijd}`,
      verzekering
    ],

    'Duitsland->Duitsland': [
      `${M} reeds beschikbaar in Duitsland. Er is geen Nederlands RDW-invoertraject ` +
        `van toepassing. Verkoper verzorgt de Duitse administratieve afhandeling ` +
        `en draagt de kosten daarvan, waaronder de Zulassung of Umschreibung bij ` +
        `de bevoegde Zulassungsstelle en de bijbehorende documenten, zodat ${m} ` +
        `bij aflevering is voorzien van een geldige Duitse kentekenregistratie.`,
      doorlooptijd,
      verzekering
    ]
  };

  const paragrafen = routes[key] || routes['Nederland->Nederland'];

  // Korte routevermelding als eerste zin-context (alleen bij grensoverschrijdend of niet-NL)
  const intro =
    herkomst || bestemming !== 'Nederland'
      ? `Registratieroute: <b>${van}</b> → <b>${naar}</b>. Verkoper (Agroria) is verantwoordelijk voor de volledige afhandeling van dit traject tot en met inschrijving in het bestemmingsland.`
      : `Registratieroute: <b>Nederland</b> (geen grensoverschrijdende import). Verkoper (Agroria) zorgt voor correcte Nederlandse documentatie en kentekenregistratie waar verplicht.`;

  return {
    titel,
    route: key,
    herkomst: van,
    bestemming: naar,
    paragrafen: [intro, ...paragrafen]
  };
}

module.exports = {
  HERKOMST,
  BESTEMMING,
  normaliseerHerkomst,
  normaliseerBestemming,
  registratieArtikel
};
