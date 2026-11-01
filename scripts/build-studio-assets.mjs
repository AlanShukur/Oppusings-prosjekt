import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const output=resolve('public/studio/vendor');
await mkdir(output,{recursive:true});
await build({absWorkingDir:process.cwd(),entryPoints:[resolve('public/studio/viewer3d.js')],outfile:resolve(output,'viewer3d.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
await Promise.all([
  copyFile('node_modules/pdfjs-dist/build/pdf.min.mjs',resolve(output,'pdf.mjs')),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',resolve(output,'pdf.worker.mjs')),
  cp('node_modules/pdfjs-dist/cmaps',resolve(output,'cmaps'),{recursive:true}),
  cp('node_modules/pdfjs-dist/standard_fonts',resolve(output,'standard_fonts'),{recursive:true}),
  cp('node_modules/pdfjs-dist/wasm',resolve(output,'wasm'),{recursive:true}),
  copyFile('node_modules/three/LICENSE',resolve(output,'THREE-LICENSE.txt')),
  copyFile('node_modules/pdfjs-dist/LICENSE',resolve(output,'PDFJS-LICENSE.txt')),
]);
console.log('Lokale PDF- og 3D-moduler er bygget. De lastes først når funksjonen brukes.');
