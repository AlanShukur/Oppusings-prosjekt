// Browser UI helpers shared by the studio: icons, the $ shortcut, toasts, downloads and the phone workspace tabs.

const paths={
brand:'<path d="m4 10 8-7 8 7v10h-6v-7h-4v7H4z"/><path d="M9 6V3"/>',
home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2.5M12 17h.01"/>',
'chevron-right':'<path d="m9 5 7 7-7 7"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',
'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
check:'<path d="m5 12 4 4L19 6"/>',cloud:'<path d="M7 18a5 5 0 0 1-1-10 6.5 6.5 0 0 1 12.5 1A4.5 4.5 0 0 1 18 18"/><path d="m9 16 2 2 4-4"/>',
export:'<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
sparkles:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4"/>',
sliders:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
cursor:'<path d="m5 3 14 9-7 1-3 7z"/>',wall:'<path d="M3 5h18v14H3zM3 12h18M9 5v7m6 0v7"/>',
door:'<path d="M4 21h16M6 21V4l11-2v19M17 4h3v17M13 12h.01"/>',window:'<path d="M3 4h18v16H3zM12 4v16M3 12h18"/>',
sofa:'<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M5 18h14M4 20v-2m16 2v-2M5 11a2 2 0 0 0-3 2v5h20v-5a2 2 0 0 0-3-2v4H5z"/>',
table:'<path d="M3 8h18v5H3zM5 13v8m14-8v8M5 8V4m14 4V4"/>',
bed:'<path d="M3 18V7m18 11V7M3 14h18v6M3 20v2m18-2v2M6 14V6h12v8M8 10h3m2 0h3"/>',
plant:'<path d="M7 15h10l-2 7H9zM12 15V8M12 11C3 12 3 3 3 3s9-1 9 8ZM12 8C12 1 21 2 21 2s1 8-9 8"/>',
bath:'<path d="M3 12h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 12V5a3 3 0 0 1 6 0M5 22v-2m14 2v-2"/>',
hall:'<path d="M4 3h16v18H4zM9 3v18m6-10h2"/>',
plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
bulb:'<path d="M9 19h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 .7-1 1.5-1 2H9c0-.5 0-1.3-1-2Z"/>',
layers:'<path d="m12 3 10 6-10 6L2 9zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
undo:'<path d="M3 9h11a7 7 0 0 1 0 14M3 9l5-5M3 9l5 5"/>',redo:'<path d="M21 9H10a7 7 0 0 0 0 14M21 9l-5-5m5 5-5 5"/>',
cube:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10M7 5l10 6"/>',
expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/>',
edit:'<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',upload:'<path d="M12 16V3M7 8l5-5 5 5M3 15v6h18v-6"/>',
file:'<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 13h8m-8 4h8"/>',
warning:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
document:'<path d="M5 2h14v20H5zM8 7h8m-8 5h8m-8 5h5"/>',
hand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-6a1.5 1.5 0 0 1 3 0V12m0-5.5a1.5 1.5 0 0 1 3 0V13m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a7 7 0 0 1-5.6-2.8L4 16.5a1.6 1.6 0 0 1 2.5-2L8 16"/>'
};
export const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.home}</svg>`;
export function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
export const $=(s)=>document.querySelector(s);
let toastTimer;
// Re-showing the popover puts the toast in the top layer above any open dialog and its backdrop.
export function toast(message){const el=$('#toast');el.textContent=message;try{if(el.matches(':popover-open'))el.hidePopover();el.showPopover();}catch{}el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
export function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export const compactWorkspace=window.matchMedia('(max-width: 900px)');
export function setWorkspacePanel(panel){
  if(!['canvas','tools','properties'].includes(panel))return;
  $('.studio').dataset.panel=panel;
  document.querySelectorAll('[data-workspace-panel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workspacePanel===panel)));
  const activePanel=$('#workspace-'+panel);
  if(compactWorkspace.matches&&document.activeElement?.closest('.tools-panel,.properties-panel,.canvas-panel')&&!activePanel.contains(document.activeElement)){
    $('[data-workspace-panel="'+panel+'"]').focus({preventScroll:true});
  }
}
export function bindWorkspacePanels(){
  document.querySelectorAll('[data-workspace-panel]').forEach(button=>button.onclick=()=>setWorkspacePanel(button.dataset.workspacePanel));
  compactWorkspace.addEventListener('change',()=>{
    if(!compactWorkspace.matches)return;
    const focusedPanel=document.activeElement?.closest('#workspace-tools,#workspace-properties');
    setWorkspacePanel(focusedPanel?.id.replace('workspace-','')||$('.studio').dataset.panel);
  });
}
