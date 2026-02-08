#!/usr/bin/env node
// build.js - Copy web assets to www/ for Capacitor sync
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

// Clean and recreate www/
if (fs.existsSync(WWW)) {
    fs.rmSync(WWW, { recursive: true });
}
fs.mkdirSync(WWW, { recursive: true });

// Files to copy from root
const files = [
    'index.html',
    'overlay.webp',
    'assetsback-lenormand.webp',
    'icon.png',
    'lenormand-desc-en.json',
    'lenormand-desc-ja.json',
    'audio-manifest.json',
    'credits.json'
];

// Directories to copy recursively
const dirs = [
    'card-images',
    'audio'
];

function copyFileSync(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy files
let count = 0;
for (const file of files) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
        copyFileSync(src, path.join(WWW, file));
        count++;
    } else {
        console.warn(`  WARN: ${file} not found, skipping`);
    }
}

// Copy directories
for (const dir of dirs) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
        copyDirSync(src, path.join(WWW, dir));
        const entries = fs.readdirSync(path.join(WWW, dir));
        count += entries.length;
    } else {
        console.warn(`  WARN: ${dir}/ not found, skipping`);
    }
}

// Report
const totalSize = getTotalSize(WWW);
console.log(`Build complete: ${count} files copied to www/ (${(totalSize / 1024 / 1024).toFixed(1)}MB)`);

function getTotalSize(dir) {
    let size = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            size += getTotalSize(fullPath);
        } else {
            size += fs.statSync(fullPath).size;
        }
    }
    return size;
}
