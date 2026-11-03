// Text and number helpers. No DOM, so the project brief and the tests can use them in Node.

export const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=(n)=>Number(n).toLocaleString('nb-NO',{maximumFractionDigits:1});
export const clone=data=>JSON.parse(JSON.stringify(data));
// Norwegian keyboards type a decimal comma; '' means "not answered".
export const decimal=value=>{const text=String(value??'').trim().replace(/\s/g,'').replace(',','.');return text===''?null:/^-?\d*\.?\d+$/.test(text)?Number(text):NaN;};
// The server rejects control characters in single-line fields, so they never reach a save.
export const singleLine=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ');
export const multiLine=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
export function inputNumber(value){return String(Math.round(Number(value)*100)/100).replace('.',',');}
export const savedDate=iso=>new Date(iso).toLocaleDateString('nb-NO');
