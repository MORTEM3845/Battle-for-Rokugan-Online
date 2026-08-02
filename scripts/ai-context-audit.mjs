import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { extname } from 'node:path';

const binaryExtensions = new Set([
    '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.mp3', '.ogg', '.pdf', '.png', '.ttf', '.wav', '.webp',
    '.woff', '.woff2', '.zip'
]);
const generatedPrefixes = ['.codegraph/', '.wrangler/', 'coverage/', 'dist/', 'node_modules/'];
const largeFileBytes = 100 * 1024;

function formatBytes(value) {
    const units = ['B', 'KiB', 'MiB', 'GiB'];
    let size = value;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }

    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function isGenerated(path) {
    return generatedPrefixes.some(prefix => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

function isBinary(path) {
    return binaryExtensions.has(extname(path).toLowerCase());
}

let trackedFiles;
try {
    trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch (error) {
    console.error('Failed to list tracked files. Run this command from the repository root.');
    process.exit(error.status ?? 1);
}

const entries = trackedFiles.map(path => ({ path, bytes: statSync(path).size }));
const generated = entries.filter(entry => isGenerated(entry.path));
const text = entries.filter(entry => !isBinary(entry.path));
const source = text.filter(entry => !isGenerated(entry.path));
const largeText = source.filter(entry => entry.bytes >= largeFileBytes).sort((a, b) => b.bytes - a.bytes);
const topText = [...source].sort((a, b) => b.bytes - a.bytes).slice(0, 20);
const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const sourceBytes = source.reduce((sum, entry) => sum + entry.bytes, 0);
const roughTokens = Math.ceil(sourceBytes / 4);

console.log('AI context audit');
console.log('================');
console.log(`Tracked files: ${entries.length}`);
console.log(`Tracked size: ${formatBytes(totalBytes)}`);
console.log(`Text candidates: ${source.length}`);
console.log(`Text candidate size: ${formatBytes(sourceBytes)}`);
console.log(`Rough upper-bound token estimate: ${roughTokens.toLocaleString('en-US')} (bytes / 4; not a tokenizer)`);

if (generated.length > 0) {
    console.log('\nWarning: generated or index files are tracked:');
    for (const entry of generated)
        console.log(`- ${entry.path} (${formatBytes(entry.bytes)})`);
}

if (largeText.length > 0) {
    console.log(`\nText files >= ${formatBytes(largeFileBytes)}:`);
    for (const entry of largeText)
        console.log(`- ${entry.path} (${formatBytes(entry.bytes)})`);
}

console.log('\nLargest text candidates:');
for (const entry of topText)
    console.log(`- ${entry.path} (${formatBytes(entry.bytes)})`);

console.log('\nUse this report as a repository baseline. Codex should still read only task-relevant symbols and ranges.');
