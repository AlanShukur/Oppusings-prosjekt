import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor } from '../public/studio/plan.js';
import { projectBrief } from '../public/studio/brief.js';
import { FACT_QUESTIONS, factText } from '../public/studio/facts.js';
import { decimal, inputNumber, esc, singleLine, multiLine } from '../public/studio/format.js';
import { DISCLAIMER } from '../public/studio/tek17-check.js';

const element=()=>({innerHTML:'',dataset:{},style:{},addEventListener(){}});
const room=(id,x,y,w,h,type,name)=>({id,name,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const stueOgBod=()=>({rooms:[room('a',0,0,200,200,'living','Stue'),room('b',200,0,200,200,'storage','Bod')],items:[{id:'w1',type:'window',x:100,y:0,rotation:0,width:1.2}],variant:'custom',walls:[]});
const editorWith=plan=>{const editor=new PlanEditor(element());editor.loadState(plan);return editor;};
const project={name:'Leiligheten',municipality:'Oslo',bedrooms:2,bathrooms:1,wishes:'Mer lys i stua',variant:'01',building:{ceilingHeight:2.4},measures:{bearingWall:'vet-ikke'}};
const date=new Date('2026-11-03T12:00:00Z');
const section=(brief,heading)=>brief.split('\n\n').find(part=>part.startsWith(heading+'\n'))?.slice(heading.length+1);

test('the brief lists the project, the drawing and the answers', () => {
  const brief=projectBrief(editorWith(stueOgBod()).getState(),project,{date});
  assert.ok(brief.startsWith('ROMLY – PROSJEKTBRIEF\nLeiligheten\nKommune: Oslo\nDato: 3.11.2026\nKontrollgrunnlag: tek17-veiledende '));
  assert.equal(section(brief,'DINE ØNSKER'),'2 soverom, 1 bad\nMer lys i stua');
  assert.equal(section(brief,'TEGNEDE ROM'),'Stue (Stue): 4 × 4 m, 16 m²\nBod (Bod): 4 × 4 m, 16 m²');
  assert.equal(section(brief,'VINDUER OG DØRER'),'Vindu: bredde 1,2 m, høyde ikke oppgitt, underkant ikke oppgitt');
  assert.equal(section(brief,'ENDRINGER I VEGGER'),'Ingen vegger er markert.');
  assert.equal(section(brief,'DAGENS PLANLØSNING'),'Ikke lagret. Kontrollen sammenligner ikke med dagens planløsning.');
  const answers=section(brief,'OPPLYSNINGER DU HAR GITT').split('\n');
  assert.equal(answers.length,FACT_QUESTIONS.length);
  assert.ok(answers.includes('Takhøyde i boligen (m) 2,4'));
  assert.ok(answers.includes('Fjernes eller endres bærende vegger? Vet ikke'));
  assert.ok(answers.includes('Antall bad i dag Ikke oppgitt'));
  assert.ok(brief.includes(DISCLAIMER));
  assert.ok(!brief.includes('EKSEMPELBOLIG'));
});

test('the brief warns when the drawing is the example home', () => {
  assert.ok(projectBrief(editorWith(stueOgBod()).getState(),project,{example:true,date}).includes('\nTEGNINGEN ER ROMLYS EKSEMPELBOLIG, IKKE DIN BOLIG.\n'));
});

test('a marked wall is listed with its status, and the check finds it', () => {
  const editor=editorWith(stueOgBod());
  editor.updateWall('a:right|b:left',{status:'demolish',loadBearing:'yes'});
  const brief=projectBrief(editor.getState(),project,{date});
  assert.equal(section(brief,'ENDRINGER I VEGGER'),'- Vegg mellom Stue og Bod (4 m): rives, bærende: ja');
  assert.match(brief,/\[Krever trolig søknad\] Riving av bærende vegg/);
});

test('the comparison with "Dagens planløsning" lists the removed wall and its load-bearing answer', () => {
  const editor=editorWith(stueOgBod());
  editor.updateWall('a:right|b:left',{loadBearing:'yes'});
  editor.setBaseline();
  editor.loadState({...editor.getState(),rooms:[room('a',0,0,400,200,'bedroom','Soverom')]});
  const brief=projectBrief(editor.getState(),project,{date});
  assert.equal(section(brief,'DAGENS PLANLØSNING'),`Lagret ${new Date(editor.getState().baseline.savedAt).toLocaleDateString('nb-NO')}.\n- Fjernet: Vegg mellom Stue og Bod (4 m), bærende: ja`);
  assert.match(brief,/\[Krever trolig søknad\] Fjernet bærende vegg/);
});

test('answers read as the user gave them', () => {
  const [ceiling]=FACT_QUESTIONS.filter(q=>q.key==='ceilingHeight'),[permit]=FACT_QUESTIONS.filter(q=>q.key==='permitBefore2011'),[useChange]=FACT_QUESTIONS.filter(q=>q.key==='useChange');
  assert.equal(factText({building:{ceilingHeight:2.44}},ceiling),'2,4');
  assert.equal(factText({building:{permitBefore2011:false}},permit),'Nei');
  assert.equal(factText({measures:{useChange:'tilleggsdel-hoveddel'}},useChange),'Ja');
  assert.equal(factText({},useChange),'Ikke oppgitt');
});

test('numbers take a decimal comma, and text is made safe', () => {
  assert.equal(decimal('3,6'),3.6);
  assert.equal(decimal(' 1 200,5 '),1200.5);
  assert.equal(decimal(''),null);
  assert.ok(Number.isNaN(decimal('tre')));
  assert.equal(inputNumber(2.456),'2,46');
  assert.equal(esc('<b title="x">Kari & Ola\'s</b>'),'&lt;b title=&quot;x&quot;&gt;Kari &amp; Ola&#39;s&lt;/b&gt;');
  assert.equal(singleLine('Stue\nKjøkken'),'Stue Kjøkken');
  assert.equal(multiLine('Linje 1\nLinje 2\u0007'),'Linje 1\nLinje 2');
});
