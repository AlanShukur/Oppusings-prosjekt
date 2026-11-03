/**
 * Indicative, plan-derived TEK17 check. Pure module (no DOM), shared by the studio and tests.
 *
 * The engine compares the drawing and the user's answers with DiBK's preaksepterte ytelser.
 * It never approves anything: missing inputs give 'ukjent', never an assumed value. Every
 * threshold below was checked against dibk.no / lovdata.no on the RULESET date; re-verify
 * when DiBK publishes changes, and keep old reports tied to the ruleset they were made with.
 */
import { deriveWalls, assignOpenings } from './scene-geometry.js';

// version changes whenever the rules change; verified is the date every source was last re-checked.
export const RULESET = {id: 'tek17-veiledende', version: '2026-11-03', verified: '01.11.2026'};

const TEK = 'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/';
export const SOURCES = {
  '1-2': TEK + '1/1-2',
  '1-3': TEK + '1/1-3',
  '11-13': TEK + '11/iv/11-13',
  '12-2': TEK + '12/i/12-2',
  '12-7': TEK + '12/ii/12-7',
  '12-9': TEK + '12/ii/12-9',
  '12-10': TEK + '12/ii/12-10',
  '12-13': TEK + '12/iii/12-13',
  '13-2': TEK + '13/i/13-2',
  '13-7': TEK + '13/v/13-7',
  '13-8': TEK + '13/v/13-8',
  '13-15': TEK + '13/vi/13-15',
  'sak-4-1': 'https://www.dibk.no/regelverk/sak/2/4/4-1',
  'sak-5-4': 'https://www.dibk.no/regelverk/sak/2/5/5-4',
  'pbl-20-1': 'https://lovdata.no/lov/2008-06-27-71/%C2%A720-1',
  'pbl-20-5': 'https://lovdata.no/lov/2008-06-27-71/%C2%A720-5',
  'pbl-31-2': 'https://lovdata.no/lov/2008-06-27-71/%C2%A731-2',
  innvendig: 'https://www.dibk.no/bygge-eller-endre/arbeid-pa-eksisterende-bygg/innvendig-ombygging',
  bruksendring: 'https://www.dibk.no/bygge-eller-endre/hva-er-en-bruksendring',
  fasade: 'https://www.dibk.no/bygge-eller-endre/arbeid-pa-eksisterende-bygg/fasadeendring',
};

export const STATUS_ORDER = ['brudd', 'soknad', 'advarsel', 'ukjent', 'ok', 'info'];
export const STATUS_LABELS = {
  brudd: 'Oppfyller ikke preakseptert ytelse',
  soknad: 'Krever trolig søknad',
  advarsel: 'Bør avklares',
  ukjent: 'Mangler opplysninger',
  ok: 'Ser ut til å oppfylle preakseptert ytelse',
  info: 'Til informasjon',
};

export const DISCLAIMER = 'Veiledende kontroll basert på tegningen og opplysningene du har lagt inn, sammenholdt med preaksepterte ytelser i DiBKs veiledning til TEK17 (kontrollert ' + RULESET.verified + '). Dette er ikke godkjenning, teknisk kontroll eller en bindende vurdering av søknadsplikt. Preaksepterte ytelser er én måte å oppfylle kravene på; andre løsninger kan dokumenteres. For eksisterende bygg gjelder kravene for de delene tiltaket omfatter (pbl § 31-2). Du som tiltakshaver er ansvarlig for å vurdere om tiltaket er søknadspliktig. Er du i tvil, kontakt kommunen. Kommunen kan i noen tilfeller gi unntak fra tekniske krav for eksisterende bygg (pbl § 31-4).';

const fmt = value => Number(value).toLocaleString('nb-NO', {maximumFractionDigits: 2});
const known = value => typeof value === 'number' && Number.isFinite(value);

/** TEK17 § 1-3 l: stue og tilsvarende rom, kjøkken og soverom are rom for varig opphold. */
const STAY = {living: 'stay', dining: 'stay', kitchen: 'stay', bedroom: 'stay', office: 'stay', bath: 'no', hall: 'no', storage: 'no', room: 'ask'};
export const classifyRoom = room => STAY[room?.type] ?? 'ask';
const isKitchen = room => room.type === 'kitchen' || /kjøkken/i.test(room.name || '');

/** Wheelchair turning space in an empty rectangle: Ø 1,5 m circle or 1,3 × 1,8 m rectangle. */
const turningFits = (w, d) => Math.min(w, d) >= 1.5 || (Math.min(w, d) >= 1.3 && Math.max(w, d) >= 1.8);

/**
 * A derived "exterior" wall can really be an interior wall when two traced rooms are drawn
 * with a small gap. Treat it as uncertain if another room has a parallel edge within ~0,3 m
 * overlapping at least half of it.
 */
function exteriorIsUncertain(wall, rooms) {
  const vertical = Math.abs(wall.x2 - wall.x) < 0.01, horizontal = Math.abs(wall.y2 - wall.y) < 0.01;
  if (!vertical && !horizontal) return false;
  const low = vertical ? Math.min(wall.y, wall.y2) : Math.min(wall.x, wall.x2), high = vertical ? Math.max(wall.y, wall.y2) : Math.max(wall.x, wall.x2);
  return rooms.some(room => {
    if (wall.roomIds.includes(room.id)) return false;
    const edges = vertical ? [room.x, room.x + room.w] : [room.y, room.y + room.h];
    const line = vertical ? wall.x : wall.y;
    if (!edges.some(edge => Math.abs(edge - line) > 0.01 && Math.abs(edge - line) <= 15)) return false;
    const overlap = Math.min(high, vertical ? room.y + room.h : room.x + room.w) - Math.max(low, vertical ? room.y : room.x);
    return overlap >= (high - low) * 0.5;
  });
}

export function evaluatePlan(plan = {}, project = {}) {
  const rooms = (plan.rooms || []).filter(room => [room.x, room.y, room.w, room.h].every(Number.isFinite) && room.w > 0 && room.h > 0);
  const building = project.building || {}, measures = project.measures || {};
  const walls = deriveWalls(plan);
  const openings = assignOpenings(plan, walls);
  const results = [];
  const assumptions = new Set(['Mål er hentet fra tegningen. Rommål er målt til tegnet romkant og kan avvike fra bruksareal (BRA) innvendig.']);
  const add = (ruleId, ref, title, status, message, extra = {}) => results.push({ruleId, ref, title, status, message, url: SOURCES[ruleId.replace(/^tek17-/, '').replace(/-[a-z]+$/, '')] || extra.url, ...extra});

  const stayRooms = rooms.filter(room => classifyRoom(room) === 'stay');
  const windowsOf = room => openings.filter(entry => entry.item.type === 'window' && !entry.offWall && entry.exterior && entry.roomIds.includes(room.id));
  const doorsOf = room => openings.filter(entry => entry.item.type === 'door' && !entry.offWall && entry.roomIds.includes(room.id));
  const touchesHoveddel = room => walls.some(wall => wall.roomIds.includes(room.id) && wall.roomIds.some(id => id !== room.id && rooms.find(other => other.id === id)?.previousUse !== 'tilleggsdel'));
  // TEK17 § 1-2 åttende ledd: relief for bruksendring tilleggsdel -> hoveddel in homes applied for before 1.7.2011.
  const exempt128 = room => room.previousUse === 'tilleggsdel' && classifyRoom(room) === 'stay' && building.permitBefore2011 === true && touchesHoveddel(room);
  const bruksendring128 = measures.useChange === 'tilleggsdel-hoveddel' && building.permitBefore2011 === true;

  if (!rooms.length) {
    add('tek17-plan', 'Tegningen', 'Ingen rom er tegnet', 'ukjent', 'Tegn rommene i boligen for å få en kontroll av planen.');
  }
  if (rooms.some(room => room.previousUse === 'tilleggsdel') && building.permitBefore2011 == null) {
    add('tek17-1-2', 'TEK17 § 1-2 åttende ledd', 'Bruksendring i eldre bolig', 'ukjent', 'Ble boligen omsøkt før 1. juli 2011? Da gjelder lempeligere krav når bod, kjeller eller loft tas i bruk som oppholdsrom.');
  }

  // Room classification (§ 1-3 l)
  for (const room of rooms) {
    if (classifyRoom(room) === 'ask') add('tek17-1-3', 'TEK17 § 1-3', 'Romtype mangler', 'ukjent', `Velg romtype for «${room.name}» for å kontrollere kravene som gjelder rommet.`, {roomId: room.id});
    else if (room.type === 'office') add('tek17-1-3', 'TEK17 § 1-3', 'Kontor regnes som oppholdsrom', 'info', `«${room.name}»: Kontor/arbeidsrom kan regnes som et rom tilsvarende stue. Skal rommet brukes som soverom, gjelder kravene til soverom.`, {roomId: room.id});
  }

  // § 13-8 Utsyn and § 13-7 Lys
  const mainLiving = rooms.filter(room => room.type === 'living').sort((a, b) => b.area - a.area)[0];
  for (const room of stayRooms) {
    const windows = windowsOf(room);
    const certain = windows.filter(entry => !exteriorIsUncertain(entry.wall, rooms));
    const exempt = exempt128(room);
    let noWindowReported = false;
    if (!exempt) {
      if (!windows.length) {
        const hasExteriorWall = walls.some(wall => wall.exterior && wall.roomIds.includes(room.id) && !exteriorIsUncertain(wall, rooms));
        add('tek17-13-8', 'TEK17 § 13-8', 'Utsyn', 'brudd', hasExteriorWall
          ? `«${room.name}» har ikke vindu i yttervegg. Rom for varig opphold (stue, kjøkken, soverom) må ha minst ett vindu som gir utsyn.`
          : `«${room.name}» ser ut til å ligge uten yttervegg og kan ikke få vindu. Som oppholdsrom oppfyller det ikke kravet til utsyn.`, {roomId: room.id});
        noWindowReported = true;
      } else if (!certain.length) {
        add('tek17-13-8', 'TEK17 § 13-8', 'Utsyn', 'advarsel', `Vinduet i «${room.name}» står på en vegg som ligger tett inntil et annet tegnet rom. Kontroller at veggen er en yttervegg.`, {roomId: room.id});
      } else {
        add('tek17-13-8', 'TEK17 § 13-8', 'Utsyn', 'ok', `«${room.name}» har ${certain.length === 1 ? 'ett vindu' : certain.length + ' vinduer'} i yttervegg.`, {roomId: room.id});
      }
      if (room === mainLiving && windows.length) {
        if (windows.some(entry => known(entry.item.sillHeight) && entry.item.sillHeight <= 1.0)) add('tek17-13-8', 'TEK17 § 13-8', 'Utsyn fra stuen', 'ok', 'Stuen har minst ett vindu med underkant glass maks 1,0 m over gulv.', {roomId: room.id});
        else if (windows.every(entry => known(entry.item.sillHeight))) add('tek17-13-8', 'TEK17 § 13-8', 'Utsyn fra stuen', 'brudd', 'Stuen må ha minst ett vindu der underkanten av glasset er maks 1,0 m over gulvet.', {roomId: room.id});
        else add('tek17-13-8', 'TEK17 § 13-8', 'Utsyn fra stuen', 'ukjent', 'Oppgi underkant glass over gulv for stuevinduene (maks 1,0 m for minst ett av dem).', {roomId: room.id});
      }
    }

    if (exempt) {
      // Bruksendring item 2: at least one window 0,60 m high, 0,50 m wide, sum ≥ 1,50 m.
      const sized = windows.filter(entry => known(entry.item.width) && known(entry.item.height));
      if (!windows.length) add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys ved bruksendring', 'brudd', `«${room.name}» må ha minst ett vindu mot det fri ved bruksendring etter § 1-2 åttende ledd.`, {roomId: room.id});
      else if (sized.some(entry => entry.item.height >= 0.6 && entry.item.width >= 0.5 && entry.item.height + entry.item.width >= 1.5)) add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys ved bruksendring', 'ok', `«${room.name}» har et vindu på minst 0,60 × 0,50 m med sum minst 1,50 m.`, {roomId: room.id});
      else if (sized.length === windows.length) add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys ved bruksendring', 'brudd', `Ved bruksendring må «${room.name}» ha minst ett vindu med høyde minst 0,60 m, bredde minst 0,50 m og sum minst 1,50 m.`, {roomId: room.id});
      else add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys ved bruksendring', 'ukjent', `Oppgi bredde og høyde på vinduet i «${room.name}».`, {roomId: room.id});
    } else if (!noWindowReported && windows.length) {
      // Simplified method for rooms in a boenhet: Ag ≥ 0,07 · A_BRA / LT, glass ≥ 0,8 m above the floor.
      const area = room.area;
      const dims = windows.filter(entry => known(entry.item.width) && known(entry.item.height));
      if (dims.length < windows.length) {
        add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys', 'ukjent', `Oppgi glassbredde og glasshøyde for vinduene i «${room.name}». Med lystransmisjon 0,6 (DiBKs eksempel) trengs ca. ${fmt(0.07 * area / 0.6)} m² glass minst 0,8 m over gulvet.`, {roomId: room.id});
      } else {
        const totalGlass = dims.reduce((sum, entry) => sum + entry.item.width * entry.item.height, 0);
        const sillsKnown = dims.every(entry => known(entry.item.sillHeight));
        const glassAbove = sillsKnown ? dims.reduce((sum, entry) => {
          const sill = entry.item.sillHeight, top = sill + entry.item.height;
          return sum + entry.item.width * Math.max(0, top - Math.max(0.8, sill));
        }, 0) : null;
        const lt = building.lightTransmission;
        if (totalGlass < 0.07 * 0.9 * area) {
          add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys', 'brudd', `Glassarealet i «${room.name}» (${fmt(totalGlass)} m²) er mindre enn 0,07 × gulvarealet (${fmt(0.07 * area)} m²). Det er for lite selv med 100 % lystransmisjon.`, {roomId: room.id});
        } else if (glassAbove === null) {
          add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys', 'ukjent', `Oppgi underkant glass over gulv for vinduene i «${room.name}». Bare glass minst 0,8 m over gulvet teller.`, {roomId: room.id});
        } else if (!known(lt)) {
          const needed = 0.07 * area / 0.6;
          add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys', 'ukjent', `«${room.name}» har ${fmt(glassAbove)} m² glass over 0,8 m. Oppgi glassets lystransmisjon (LT) under «Om boligen». Med LT 0,6 trengs ${fmt(needed)} m²${glassAbove >= needed ? ', som ser ut til å holde' : ', som ikke holder'}.`, {roomId: room.id});
        } else {
          const required = 0.07 * area / lt;
          const status = glassAbove >= required ? 'ok' : glassAbove >= required * 0.9 ? 'advarsel' : 'brudd';
          add('tek17-13-7', 'TEK17 § 13-7', 'Dagslys', status, status === 'ok'
            ? `«${room.name}»: ${fmt(glassAbove)} m² glass over 0,8 m ≥ ${fmt(required)} m² (forenklet metode).`
            : `«${room.name}» trenger minst ${fmt(required)} m² glass minst 0,8 m over gulvet, og har ${fmt(glassAbove)} m².${status === 'advarsel' ? ' Det er nær grensen; mål bruksarealet innvendig.' : ''}`, {roomId: room.id});
        }
        assumptions.add('Dagslys: skjerming fra naboer og terreng (sikt over 45°), lysgrav og balkong over vinduet er ikke vurdert.');
      }
    }
  }
  if (stayRooms.length) assumptions.add('Yttervegg er antatt der bare ett tegnet rom grenser til veggen.');

  // § 12-7 Room height
  const missingHeight = rooms.filter(room => !known(room.ceilingHeight ?? building.ceilingHeight));
  if (missingHeight.length) {
    add('tek17-12-7', 'TEK17 § 12-7', 'Romhøyde', 'ukjent', `Oppgi takhøyde for boligen (eller for ${missingHeight.length === 1 ? `«${missingHeight[0].name}»` : missingHeight.length + ' rom'}) for å kontrollere kravet på 2,4 m i oppholdsrom.`);
  }
  for (const room of rooms.filter(room => known(room.ceilingHeight ?? building.ceilingHeight))) {
    const height = room.ceilingHeight ?? building.ceilingHeight, stay = classifyRoom(room) !== 'no';
    const conversion = room.previousUse === 'tilleggsdel' && stay;
    const min = building.smallDetached ? 2.2 : conversion ? (building.permitBefore2011 === true ? 2.0 : 2.2) : stay ? 2.4 : 2.2;
    const status = height >= min ? 'ok' : 'brudd';
    add('tek17-12-7', 'TEK17 § 12-7', 'Romhøyde', status, status === 'ok'
      ? `«${room.name}»: ${fmt(height)} m oppfyller minstekravet på ${fmt(min)} m.`
      : `«${room.name}»: takhøyden ${fmt(height)} m er under ${fmt(min)} m som gjelder for ${stay ? 'rom for varig opphold' : 'andre rom'}${conversion ? ' ved bruksendring fra tilleggsdel' : ''}. Deler av et rom med skråtak kan være lavere hvis funksjonen ikke svekkes.`, {roomId: room.id});
  }

  // § 12-7 fjerde ledd / § 12-8 turning space in tilgjengelig boenhet (§ 12-2)
  if (building.accessibleUnit == null) {
    add('tek17-12-2', 'TEK17 § 12-2', 'Tilgjengelig boenhet', 'ukjent', 'Gjelder krav om tilgjengelig boenhet? Det gjelder bygninger med heiskrav, eller boliger der alle hovedfunksjoner ligger på inngangsplanet.');
  } else if (building.accessibleUnit && !bruksendring128) {
    for (const room of rooms.filter(room => ['hall', 'bedroom', 'living', 'kitchen', 'dining'].includes(room.type))) {
      const fits = turningFits(room.width, room.height);
      add('tek17-12-7', 'TEK17 § 12-7 / § 12-8', 'Snuareal for rullestol', fits ? 'advarsel' : 'brudd', fits
        ? `«${room.name}» er stort nok til snuareal i tomt rom. Snuarealet må ligge utenfor dørens slagradius og møbleringssonen, med 0,9 m fri passasje til dør og vindu.`
        : `«${room.name}» (${fmt(room.width)} × ${fmt(room.height)} m) har ikke plass til snusirkel Ø 1,5 m eller snurektangel 1,3 × 1,8 m, selv uten innredning.`, {roomId: room.id});
    }
  }

  // § 12-9 Bad (applies to the main bathroom in all boenheter; not to extra bathrooms)
  const baths = rooms.filter(room => room.type === 'bath');
  if (rooms.length && !baths.length) add('tek17-12-9', 'TEK17 § 12-9', 'Bad', 'advarsel', 'Ingen bad er tegnet. Bad og toalett er en hovedfunksjon i boenheten.');
  else if (baths.length && !bruksendring128) {
    const fitting = baths.find(room => turningFits(room.width, room.height));
    add('tek17-12-9', 'TEK17 § 12-9', 'Bad', fitting ? 'info' : 'advarsel', fitting
      ? `«${fitting.name}» har plass til snuareal i tomt rom. Ved ombygging må det også være 0,9 m fri gulvplass på én side av toalettet, 0,2 m på den andre, og trinnfri dusjsone.`
      : 'Ingen bad er store nok til snuareal for rullestol (Ø 1,5 m eller 1,3 × 1,8 m). Kravet gjelder hovedbadet når tiltaket omfatter det.');
  }

  // § 12-13 Doors
  const doorEntries = openings.filter(entry => entry.item.type === 'door' && !entry.offWall);
  const unsized = doorEntries.filter(entry => !known(entry.item.width));
  for (const entry of doorEntries.filter(entry => known(entry.item.width))) {
    const width = entry.item.width, entrance = entry.item.entrance === true;
    if (entrance && width < 0.86) add('tek17-12-13', 'TEK17 § 12-13', 'Dørbredde', 'brudd', `Inngangsdøren har fri bredde ${fmt(width)} m. Minstekravet er 0,86 m.`, {itemId: entry.item.id});
    else if (width < 0.76) add('tek17-12-13', 'TEK17 § 12-13', 'Dørbredde', 'brudd', `En dør har fri bredde ${fmt(width)} m. Dører internt i boenheten må ha minst 0,76 m.`, {itemId: entry.item.id});
    else if (entry.exterior && !entrance && width < 0.86) add('tek17-12-13', 'TEK17 § 12-13', 'Dørbredde', 'advarsel', `En dør i yttervegg har fri bredde ${fmt(width)} m. Er dette inngangsdøren, må den være minst 0,86 m.`, {itemId: entry.item.id});
  }
  if (unsized.length) add('tek17-12-13', 'TEK17 § 12-13', 'Dørbredde', 'ukjent', `Oppgi fri bredde for ${unsized.length === 1 ? 'én dør' : unsized.length + ' dører'} (minst 0,76 m internt og 0,86 m for inngangsdør).`);
  else if (doorEntries.length && !results.some(result => result.ruleId === 'tek17-12-13')) add('tek17-12-13', 'TEK17 § 12-13', 'Dørbredde', 'ok', 'Alle tegnede dører har minst fri bredde som kreves.');
  if (rooms.length > 1) {
    for (const room of rooms.filter(room => !doorsOf(room).length)) add('tek17-plan', 'Tegningen', 'Dør mangler', 'advarsel', `«${room.name}» har ingen dør tegnet.`, {roomId: room.id});
    if (!doorEntries.some(entry => entry.item.entrance || entry.exterior)) add('tek17-plan', 'Tegningen', 'Inngangsdør mangler', 'advarsel', 'Ingen inngangsdør er tegnet.');
  }

  // § 11-13 Escape via window when a floor of the dwelling is not the entrance floor
  if (building.multiLevelUnit === true && building.planLevel === 'annen') {
    const valid = entry => entry.item.escape === true && known(entry.item.width) && known(entry.item.height) && known(entry.item.sillHeight) && entry.item.height >= 0.6 && entry.item.width >= 0.5 && entry.item.height + entry.item.width >= 1.5 && entry.item.sillHeight <= 1.0;
    const required = Math.ceil(stayRooms.length / 2);
    const withEscape = stayRooms.filter(room => windowsOf(room).some(valid));
    for (const entry of openings.filter(entry => entry.item.type === 'window' && entry.item.escape === true && !valid(entry))) {
      add('tek17-11-13', 'TEK17 § 11-13', 'Rømningsvindu', 'brudd', 'Et vindu merket som rømningsvindu oppfyller ikke målene: fri åpning minst 0,6 m høy og 0,5 m bred med sum minst 1,5 m, og underkant maks 1,0 m over gulv.', {itemId: entry.item.id});
    }
    add('tek17-11-13', 'TEK17 § 11-13', 'Rømning fra planet', withEscape.length >= required ? 'ok' : 'brudd', withEscape.length >= required
      ? `${withEscape.length} av ${stayRooms.length} oppholdsrom har rømningsvindu (minst annethvert kreves).`
      : `Planet rømmer via vindu: minst ${required} av ${stayRooms.length} rom for varig opphold må ha rømningsvindu (har ${withEscape.length}).`);
    if (known(building.sillAboveTerrain) && building.sillAboveTerrain > 5) add('tek17-11-13', 'TEK17 § 11-13', 'Høyde over terreng', 'advarsel', 'Over 5,0 m over planert terreng kreves fast stige med ryggbøyler (til 7,5 m) eller annen sikker rømning.');
    assumptions.add('Rømningsvindu: fri åpning er antatt lik oppgitte glassmål, og underkant glass er brukt som underkant åpning.');
  } else {
    add('tek17-11-13', 'TEK17 § 11-13', 'Rømning', building.multiLevelUnit == null ? 'ukjent' : 'info', building.multiLevelUnit == null
      ? 'Går boligen over flere plan? Plan uten egen utgang må ha rømningsvindu i minst annethvert oppholdsrom.'
      : 'Rømning avhenger av bygningen. I boligblokk med ett trapperom må hver boenhet ha minst ett vindu eller én balkong som brannvesenet kan nå.');
  }

  // § 12-10 Storage
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);
  if (rooms.length && !bruksendring128) {
    const need = totalArea <= 50 ? 2.5 : 5.0;
    const storage = rooms.filter(room => room.type === 'storage').reduce((sum, room) => sum + room.area, 0) + (building.externalStorageM2 ?? 0);
    if (storage >= need) add('tek17-12-10', 'TEK17 § 12-10', 'Bod', 'ok', `Bod/oppbevaring er ${fmt(storage)} m² (krav ${fmt(need)} m²).`);
    else if (!known(building.externalStorageM2)) add('tek17-12-10', 'TEK17 § 12-10', 'Bod', 'ukjent', `Boenheten trenger minst ${fmt(need)} m² bod eller oppbevaringsplass. Tegn bod som romtypen «Bod», eller oppgi bod utenfor leiligheten.`);
    else add('tek17-12-10', 'TEK17 § 12-10', 'Bod', 'brudd', `Bod/oppbevaring er ${fmt(storage)} m²; kravet er ${fmt(need)} m².`);
    if (totalArea > 45 && totalArea <= 55) assumptions.add('Bod: grensen på 50 m² BRA måles innvendig. Kontroller arealet, det tegnede arealet er nær grensen.');
  }

  // § 13-2 Ventilation (design basis, info only)
  if (rooms.length) add('tek17-13-2', 'TEK17 § 13-2', 'Ventilasjon', 'info', `Prosjekteringsgrunnlag: minst ${fmt(1.2 * totalArea)} m³/h friskluft for boenheten, 26 m³/h per sengeplass i soverom, avtrekk fra bad 54 m³/h (forsert 108) og kjøkken 36 m³/h (forsert 108). Vindu erstatter ikke avtrekk.`);

  // § 13-15 Wet rooms and SAK10 § 4-1 e nr. 3
  if (baths.length) {
    add('tek17-13-15', 'TEK17 § 13-15', 'Våtrom', 'info', 'Våtrom må ha sluk, fall til sluk (dusjsone minst 1:50 innen 0,8 m fra sluk eller tilsvarende), tettesjikt, oppkant og synlig lekkasjevann. Arbeidet bør utføres av fagfolk.');
    const newBath = known(building.existingBathrooms) && baths.length > building.existingBathrooms;
    if (newBath || measures.newPipesThroughFireSeparation === true) {
      const risky = building.multiUnitBuilding === true && measures.newPipesThroughFireSeparation !== false;
      add('sak-4-1', 'SAK10 § 4-1 e nr. 3', 'Nytt bad', risky ? 'advarsel' : 'ok', risky
        ? 'Nytt bad i bygning med flere boenheter er søknadspliktig hvis rør eller kanaler bryter brannskille mot en annen boenhet. Avklar føringsveien med fagfolk.'
        : 'Bad innenfor egen bruksenhet og branncelle er normalt unntatt søknad, men TEK17 gjelder fortsatt.');
    }
  }

  // Walls marked in the drawing. DiBK (Innvendig ombygging, checked 03.11.2026): «inngrep i en bærevegg eller en
  // bæresøyle» is a vesentlig endring that needs søknad; ikke-bærende vegger inside one branncelle normally do not.
  // A wall drawn in several pieces shares one key, so it is reported once.
  const marked = [...new Map(walls.filter(wall => wall.status !== 'existing').map(wall => [wall.key, wall])).values()];
  const demolished = marked.filter(wall => wall.status === 'demolish');
  const describe = wall => {
    const names = wall.roomIds.map(id => rooms.find(room => room.id === id)?.name).filter(Boolean);
    if (wall.source === 'item') return 'En tegnet skillevegg';
    return names.length > 1 ? `Veggen mellom «${names[0]}» og «${names[1]}»` : names.length ? `Ytterveggen til «${names[0]}»` : 'En vegg';
  };
  const drawnFacade = demolished.filter(wall => wall.source === 'room' && wall.exterior && !exteriorIsUncertain(wall, rooms));
  for (const wall of demolished) {
    const label = describe(wall), link = {wallKey: wall.key};
    if (wall.loadBearing === 'yes') add('pbl-20-1', 'pbl § 20-1 b', 'Riving av bærende vegg', 'soknad', `${label} er markert som bærende og skal rives. Inngrep i bærevegg er en vesentlig endring og krever søknad med ansvarlige foretak (pbl § 20-3). En fagperson må vurdere hvordan lastene skal tas opp.`, link);
    else if (wall.loadBearing === 'unknown') add('innvendig', 'DiBK · Innvendig ombygging', 'Er veggen bærende?', 'ukjent', `${label} er markert for riving. Avklar om den er bærende, for eksempel med en rådgivende ingeniør bygg, og marker det på veggen. Er den bærende, krever rivingen søknad.`, {...link, url: SOURCES.innvendig});
    if (drawnFacade.includes(wall)) add('pbl-20-5', 'pbl § 20-1 c', 'Riving av yttervegg', 'advarsel', `${label} ser ut til å være en yttervegg. Å fjerne eller endre den er fasadeendring og i utgangspunktet søknadspliktig, og alltid søknadspliktig hvis bærende konstruksjon berøres.`, {...link, url: SOURCES.fasade});
    else if (wall.source === 'room' && wall.roomIds.length === 2) add('tek17-plan', 'Tegningen', 'Rom slås sammen', 'info', `Når ${label.charAt(0).toLowerCase() + label.slice(1)} rives, blir rommene ett rom. Kontrollen vurderer dem fortsatt hver for seg; tegn dem som ett rom for å kontrollere dagslys og utsyn for det sammenslåtte rommet.`, link);
  }
  const newBearing = marked.filter(wall => wall.status === 'new' && wall.loadBearing === 'yes');
  for (const wall of newBearing) add('pbl-20-1', 'pbl § 20-1 b', 'Ny bærende vegg', 'advarsel', `${describe(wall)} er markert som ny og bærende. Det er en endring av bærende konstruksjon; avklar søknadsplikt med kommunen eller en fagperson.`, {wallKey: wall.key});

  // Søknadsplikt triage (pbl § 20-1, SAK10 § 2-1/2-2/4-1, pbl § 20-5 f)
  // The drawing can only make the answer stricter: a demolished wall marked bærende counts even if the questionnaire says no.
  const drawnBearing = demolished.some(wall => wall.loadBearing === 'yes') ? 'ja' : demolished.some(wall => wall.loadBearing === 'unknown') ? 'vet-ikke' : demolished.length ? 'nei' : null;
  const severity = {nei: 0, 'vet-ikke': 1, ja: 2};
  const bearingWall = [measures.bearingWall, drawnBearing].filter(answer => answer != null).sort((a, b) => severity[b] - severity[a])[0] ?? null;
  // Per-wall results above already explain answers that come from the drawing; only the questionnaire's own answer is repeated here.
  if (bearingWall === 'ja' && measures.bearingWall === 'ja') add('pbl-20-1', 'pbl § 20-1 b', 'Bærende konstruksjon', 'soknad', 'Inngrep i bærevegg eller bæresøyle er en vesentlig endring og krever søknad med ansvarlige foretak (pbl § 20-3).');
  else if (bearingWall === 'vet-ikke' && measures.bearingWall === 'vet-ikke') add('innvendig', 'DiBK · Innvendig ombygging', 'Bærende konstruksjon', 'advarsel', 'Få avklart om veggene du vil fjerne eller endre er bærende, for eksempel av en rådgivende ingeniør bygg, før riving.', {url: SOURCES.innvendig});
  else if (bearingWall == null) add('innvendig', 'DiBK · Innvendig ombygging', 'Riving av vegger', 'ukjent', 'Skal du fjerne eller endre vegger? Marker veggene i tegningen, eller svar på om noen av dem er bærende.', {url: SOURCES.innvendig});
  if (measures.facade === true) add('pbl-20-5', 'pbl § 20-1 c / § 20-5 f', 'Fasadeendring', 'advarsel', 'Nye, flyttede eller endrede vinduer og dører i yttervegg er fasadeendring og i utgangspunktet søknadspliktig. Unntak bare hvis bygningens karakter ikke endres, og kommunen avgjør det. Alltid søknadspliktig hvis bærende konstruksjon berøres.', {url: SOURCES.fasade});
  else if (measures.facade == null) add('pbl-20-5', 'pbl § 20-1 c', 'Fasadeendring', 'ukjent', 'Skal du lage nye, flytte eller endre vinduer eller dører i yttervegg?', {url: SOURCES.fasade});
  const derivedUseChange = rooms.some(room => room.previousUse === 'tilleggsdel' && classifyRoom(room) === 'stay');
  if (measures.useChange === 'tilleggsdel-hoveddel' || (measures.useChange == null && derivedUseChange)) add('bruksendring', 'SAK10 § 2-1 c', 'Bruksendring', 'soknad', 'Å ta i bruk bod, kjeller eller loft som soverom eller stue er søknadspliktig bruksendring.', {url: SOURCES.bruksendring});
  else if (measures.useChange === 'innen-hoveddel') add('bruksendring', 'DiBK · Bruksendring', 'Endret bruk av rom', 'advarsel', 'Du må søke hvis den nye bruken utløser nye tekniske krav, for eksempel til dagslys eller rømning.', {url: SOURCES.bruksendring});
  else if (measures.useChange == null) add('bruksendring', 'DiBK · Bruksendring', 'Bruksendring', 'ukjent', 'Skal bod, kjeller eller loft tas i bruk som oppholdsrom?', {url: SOURCES.bruksendring});
  const entranceCount = doorEntries.filter(entry => entry.item.entrance === true).length;
  if (rooms.filter(isKitchen).length >= 2 && baths.length >= 2 && entranceCount >= 2) add('pbl-20-1', 'SAK10 § 2-2', 'Oppdeling', 'advarsel', 'Planen kan bli vurdert som oppdeling i flere boenheter (egne kjøkken, bad og innganger). Oppdeling er søknadspliktig (pbl § 20-1 g).');
  if (bearingWall === 'nei' && !newBearing.length && !drawnFacade.length && measures.facade === false && (measures.useChange === 'nei' || measures.useChange == null && !derivedUseChange)) {
    add('sak-4-1', 'SAK10 § 4-1 e nr. 1', 'Ikke-bærende vegger', 'ok', 'Ikke-bærende vegger innenfor én branncelle er normalt unntatt søknad, forutsatt at lys, ventilasjon og brannsikring opprettholdes. Unntatte tiltak må likevel oppfylle TEK17.');
  }

  // Drawing quality notes that change the reliability of the results
  for (const wall of (plan.items || []).filter(item => item.type === 'wall')) {
    for (const room of rooms) {
      const x2 = wall.x2 ?? wall.x + 90, y2 = wall.y2 ?? wall.y;
      const inside = point => point.x > room.x + 5 && point.x < room.x + room.w - 5 && point.y > room.y + 5 && point.y < room.y + room.h - 5;
      const mid = {x: (wall.x + x2) / 2, y: (wall.y + y2) / 2};
      if (inside(mid) && Math.hypot(x2 - wall.x, y2 - wall.y) > 0.25 * Math.min(room.w, room.h)) {
        add('tek17-plan', 'Tegningen', 'Skillevegg i rom', 'advarsel', `En skillevegg deler «${room.name}», men rommet er ikke delt i tegningen. Kontrollen behandler det som ett rom; tegn hvert rom for seg for å kontrollere dem.`, {roomId: room.id});
        break;
      }
    }
  }
  const detached = openings.filter(entry => entry.offWall);
  if (detached.length) add('tek17-plan', 'Tegningen', 'Vinduer og dører utenfor vegg', 'advarsel', `${detached.length === 1 ? 'Ett element står' : detached.length + ' elementer står'} ikke på en vegg og er ikke med i kontrollen. Dra dem inntil en vegg.`);
  if (Number.isInteger(project.bedrooms) && rooms.length) {
    const bedrooms = rooms.filter(room => room.type === 'bedroom').length;
    if (bedrooms !== project.bedrooms) add('tek17-plan', 'Dine ønsker', 'Antall soverom', 'info', `Du ønsker ${project.bedrooms} soverom, og planen har ${bedrooms}.`);
  }
  add('sak-5-4', 'SAK10 § 5-4', 'Kommunale planer og vedlegg', project.municipality ? 'info' : 'ukjent', project.municipality
    ? `Avklar reguleringsplan, kommuneplan og eventuelle vernehensyn med ${project.municipality} kommune. En søknad trenger tegninger av eksisterende og ny situasjon og en situasjonsplan.`
    : 'Kommune er ikke valgt, så lokale planer og krav kan ikke vurderes.');

  const summary = Object.fromEntries(STATUS_ORDER.map(status => [status, results.filter(result => result.status === status).length]));
  results.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  return {ruleset: RULESET, results, summary, assumptions: [...assumptions]};
}
