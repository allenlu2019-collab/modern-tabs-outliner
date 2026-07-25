import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const indexHtml = await readFile(resolve(distDir, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(distDir, 'manifest.json'), 'utf8'));

const referencedFiles = [
  manifest.background?.service_worker,
  ...Array.from(indexHtml.matchAll(/(?:src|href)="\/([^"]+)"/g), (match) => match[1]),
].filter(Boolean);

for (const file of referencedFiles) {
  await access(resolve(distDir, file));
}

for (const file of ['main.js', manifest.background.service_worker]) {
  const source = await readFile(resolve(distDir, file), 'utf8');
  if (/^\s*import\s.+from\s+["'][^"']+["']/m.test(source)) {
    throw new Error(`${file} must be self-contained`);
  }
}

console.log(`Verified ${referencedFiles.length} extension assets`);
