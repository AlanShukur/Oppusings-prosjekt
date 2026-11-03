// The downloadable project brief, as plain text. No DOM, so tests can check it in Node.
import { deriveWalls } from './scene-geometry.js';
import { compareToBaseline } from './plan-diff.js';
import { evaluatePlan, STATUS_LABELS, DISCLAIMER, RULESET } from './tek17-check.js';
import { fmt, savedDate } from './format.js';
import { FACT_QUESTIONS, factText } from './facts.js';

const ROOM_TYPE_NAMES={living:'Stue',bedroom:'Soverom',bath:'Bad',hall:'Entré / gang',office:'Kontor',kitchen:'Kjøkken',dining:'Spisestue',storage:'Bod',room:'Rom'};
const WALL_STATUS_TEXT={existing:'står',new:'ny',demolish:'rives'},WALL_BEARING_TEXT={yes:'ja',no:'nei',unknown:'vet ikke'};
/** One line per marked wall for the project brief, e.g. "- Vegg mellom Soverom 1 og Stue (3,2 m): rives, bærende: ja". */
function wallChanges(state){
  const pieces=deriveWalls(state);
  return (state.walls||[]).map(note=>{
    const own=pieces.filter(wall=>wall.key===note.key);if(!own.length)return null;
    const names=[...new Set(own.flatMap(wall=>wall.roomIds))].map(id=>state.rooms.find(room=>room.id===id)?.name).filter(Boolean);
    const what=note.key.startsWith('item:')?'Tegnet skillevegg':names.length>1?`Vegg mellom ${names.join(' og ')}`:`Yttervegg til ${names[0]||'ukjent rom'}`;
    return `- ${what} (${fmt(own.reduce((sum,wall)=>sum+wall.length,0)/50)} m): ${WALL_STATUS_TEXT[note.status]}, bærende: ${WALL_BEARING_TEXT[note.loadBearing]}`;
  }).filter(Boolean);
}
/** The brief's comparison with "Dagens planløsning": removed walls with their load-bearing answer, new walls, facade openings. */
function baselineBrief(state){
  const diff=compareToBaseline(state);
  if(!diff)return 'Ikke lagret. Kontrollen sammenligner ikke med dagens planløsning.';
  const name=(wall,rooms)=>{const names=wall.roomIds.map(id=>rooms.find(room=>room.id===id)?.name).filter(Boolean);return wall.source==='item'?'Tegnet skillevegg':names.length>1?`Vegg mellom ${names.join(' og ')}`:`Yttervegg til ${names[0]||'ukjent rom'}`;};
  const lines=[...diff.removedWalls.map(wall=>`- Fjernet: ${name(wall,diff.rooms)} (${fmt(wall.length/50)} m), bærende: ${WALL_BEARING_TEXT[wall.loadBearing]}`),...diff.newWalls.map(wall=>`- Ny: ${name(wall,state.rooms)} (${fmt(wall.length/50)} m)`)];
  const facade=[...diff.newOpenings,...diff.removedOpenings].filter(entry=>entry.exterior).length;
  if(facade)lines.push(`- ${facade} ${facade===1?'endring':'endringer'} av vinduer eller dører i yttervegg`);
  return `Lagret ${savedDate(diff.savedAt)}.\n${lines.join('\n')||'Ingen endringer i vegger, vinduer eller dører.'}`;
}
/** The project brief ("Last ned prosjektbrief"): wishes, rooms, openings, walls, today's layout, the answers and the check. */
export function projectBrief(state,project,{example=false,date=new Date()}={}){
  const report=evaluatePlan(state,project),openings=state.items.filter(item=>item.type==='window'||item.type==='door');
  const counts=Object.entries(report.summary).filter(([,count])=>count).map(([status,count])=>`${count} ${STATUS_LABELS[status].toLowerCase()}`).join(', ');
  const room=r=>`${r.name} (${ROOM_TYPE_NAMES[r.type]||'Rom'}): ${fmt(r.width)} × ${fmt(r.height)} m, ${fmt(r.area??r.width*r.height)} m²${Number.isFinite(r.ceilingHeight)?`, takhøyde ${fmt(r.ceilingHeight)} m`:''}${r.previousUse==='tilleggsdel'?', i dag bod/kjeller/loft':''}`;
  const opening=item=>`${item.type==='window'?'Vindu':'Dør'}${item.entrance?' (inngang)':''}${item.escape?' (rømningsvindu)':''}: ${Number.isFinite(item.width)?`bredde ${fmt(item.width)} m`:'bredde ikke oppgitt'}${item.type==='window'?`, ${Number.isFinite(item.height)?`høyde ${fmt(item.height)} m`:'høyde ikke oppgitt'}, ${Number.isFinite(item.sillHeight)?`underkant ${fmt(item.sillHeight)} m`:'underkant ikke oppgitt'}`:''}`;
  return `ROMLY – PROSJEKTBRIEF\n${project.name}\nKommune: ${project.municipality||'Ikke oppgitt'}\nDato: ${date.toLocaleDateString('nb-NO')}\nKontrollgrunnlag: ${RULESET.id} ${RULESET.version} (regelverk kontrollert ${RULESET.verified})\n${example?'\nTEGNINGEN ER ROMLYS EKSEMPELBOLIG, IKKE DIN BOLIG.\n':''}\nDINE ØNSKER\n${project.bedrooms} soverom, ${project.bathrooms} bad\n${project.wishes||'Ingen ønsker skrevet inn.'}\n\nTEGNEDE ROM\n${state.rooms.map(room).join('\n')||'Ingen rom tegnet.'}\n\nVINDUER OG DØRER\n${openings.map(opening).join('\n')||'Ingen tegnet.'}\n\nENDRINGER I VEGGER\n${wallChanges(state).join('\n')||'Ingen vegger er markert.'}\n\nDAGENS PLANLØSNING\n${baselineBrief(state)}\n\nOPPLYSNINGER DU HAR GITT\n${FACT_QUESTIONS.map(q=>`${q.label} ${factText(project,q)}`).join('\n')}\n\nVEILEDENDE KONTROLL (${counts})\n${report.results.map((r,i)=>`${i+1}. [${STATUS_LABELS[r.status]}] ${r.title} – ${r.ref}\n${r.message}${r.url?`\nKilde: ${r.url}`:''}`).join('\n\n')}\n\nFORUTSETNINGER\n${report.assumptions.map(a=>`- ${a}`).join('\n')}\n\n${DISCLAIMER}\n\nMålene er skisseverdier og må kontrolleres mot oppmåling. Dette er ikke AI-analyse, teknisk kontroll eller en ferdig byggesøknad.\n`;
}
