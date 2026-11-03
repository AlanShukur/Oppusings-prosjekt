// State shared by the studio modules. Imports can't be reassigned, so whatever more than one module changes lives on `studio`.
import { PlanEditor } from './plan.js';
import { createLocalApi, LOCAL_USER } from './local-store.js';

export const api=createLocalApi();
export const session={user:LOCAL_USER};
export const studio={
  project:{name:'Eksempelbolig',municipality:'',bedrooms:2,bathrooms:1,wishes:'En sosial stue og et ekstra soverom. Behold mest mulig av den opprinnelige planløsningen.',variant:'01'},
  activeRecord:null,uploads:[],selectedId:'living',
  loadingProject:false,transitioning:false,filesBusy:0,fileMutation:0,sessionReady:false,
  lastSaveStatus:{state:'loading',message:'Åpner lagringen …'},
};
// The plan editor and the example plan it starts with. app.js creates the editor once, at startup.
export let editor=null,initialPlan=null;
export function createEditor(container,callbacks){editor=new PlanEditor(container,callbacks);initialPlan=editor.getState();return editor;}
