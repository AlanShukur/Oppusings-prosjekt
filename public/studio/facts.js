import { fmt } from './format.js';

// Facts the indicative TEK17 check needs. Limits mirror lib/projects-api.mjs; blank means "not answered".
export const FACT_QUESTIONS=[
{group:'building',key:'ceilingHeight',label:'Takhøyde i boligen (m)',type:'number',min:1.5,max:6,placeholder:'For eksempel 2,4'},
{group:'building',key:'lightTransmission',label:'Lystransmisjon i glasset (LT)',type:'number',min:.3,max:1,placeholder:'For eksempel 0,6'},
{group:'building',key:'permitBefore2011',label:'Ble boligen omsøkt før 1. juli 2011?',type:'bool'},
{group:'building',key:'accessibleUnit',label:'Krav om tilgjengelig boenhet?',type:'bool',hint:'Gjelder bygninger med heiskrav, eller der alle hovedfunksjoner ligger på inngangsplanet.'},
{group:'building',key:'multiLevelUnit',label:'Går boligen over flere plan?',type:'bool'},
{group:'building',key:'planLevel',label:'Hvilket plan viser tegningen?',type:'select',options:[['inngangsplan','Inngangsplanet'],['annen','Et annet plan']]},
{group:'building',key:'multiUnitBuilding',label:'Flere boenheter i bygningen?',type:'bool'},
{group:'building',key:'existingBathrooms',label:'Antall bad i dag',type:'integer',min:0,max:5},
{group:'building',key:'externalStorageM2',label:'Bod utenfor boligen (m²)',type:'number',min:0,max:100},
{group:'measures',key:'bearingWall',label:'Fjernes eller endres bærende vegger?',type:'select',options:[['nei','Nei'],['ja','Ja'],['vet-ikke','Vet ikke']]},
{group:'measures',key:'facade',label:'Nye eller flyttede vinduer eller dører i yttervegg?',type:'bool'},
{group:'measures',key:'useChange',label:'Tas bod, kjeller eller loft i bruk som oppholdsrom?',type:'select',options:[['nei','Nei'],['tilleggsdel-hoveddel','Ja'],['innen-hoveddel','Nei, men rom får ny bruk']]},
{group:'measures',key:'newPipesThroughFireSeparation',label:'Nye rør eller kanaler gjennom vegg eller dekke mot nabo?',type:'bool'}
];
export function factValue(project,question){return project[question.group]?.[question.key];}
export function factText(project,question){const value=factValue(project,question);return value===undefined?'Ikke oppgitt':value===true?'Ja':value===false?'Nei':question.options?question.options.find(([key])=>key===value)?.[1]??String(value):fmt(value);}
