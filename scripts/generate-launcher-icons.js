#!/usr/bin/env node
// Regenerate Android launcher icons (mipmap-*/ic_launcher*.png and
// ic_launcher_foreground.png) from resources/launcher-icon.png using sharp.
//
// Usage:
//   npm install               # ensure sharp is available
//   npm run icons             # writes android/app/src/main/res/mipmap-*/*.png
//   npm run cap:sync          # then sync into the Android project
//
// The adaptive icon descriptor (mipmap-anydpi-v26/ic_launcher.xml) and the
// background color (values/ic_launcher_background.xml) are left untouched.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'resources', 'launcher-icon.png');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// Standard Android launcher sizes (px) per density.
//   legacy  = ic_launcher.png and ic_launcher_round.png  (48dp base)
//   adaptive = ic_launcher_foreground.png                (108dp base; 72dp safe-zone)
const DENSITIES = [
    { name: 'mdpi',    legacy: 48,  adaptive: 108 },
    { name: 'hdpi',    legacy: 72,  adaptive: 162 },
    { name: 'xhdpi',   legacy: 96,  adaptive: 216 },
    { name: 'xxhdpi',  legacy: 144, adaptive: 324 },
    { name: 'xxxhdpi', legacy: 192, adaptive: 432 }
];

async function main() {
    if (!fs.existsSync(SRC)) {
        console.error(`Source image not found: ${SRC}`);
        process.exit(1);
    }

    // sharp ジョブは互いに独立なので、まとめて並列実行する。
    const jobs = DENSITIES.flatMap((d) => {
        const dir = path.join(RES, `mipmap-${d.name}`);
        fs.mkdirSync(dir, { recursive: true });
        const canvas = d.adaptive;
        const inner = Math.round(canvas * (72 / 108));

        return [
            // Legacy square icon (used on pre-O Android).
            sharp(SRC)
                .resize(d.legacy, d.legacy, { fit: 'cover' })
                .png()
                .toFile(path.join(dir, 'ic_launcher.png')),
            // Legacy "round" icon - same content; the launcher will mask it.
            sharp(SRC)
                .resize(d.legacy, d.legacy, { fit: 'cover' })
                .png()
                .toFile(path.join(dir, 'ic_launcher_round.png')),
            // Adaptive foreground: fit the source into the 72dp safe zone of
            // a transparent 108dp canvas so the launcher's mask can crop
            // without clipping content.
            sharp(SRC)
                .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toBuffer()
                .then((fgInner) =>
                    sharp({
                        create: {
                            width: canvas, height: canvas, channels: 4,
                            background: { r: 0, g: 0, b: 0, alpha: 0 }
                        }
                    })
                        .composite([{ input: fgInner, gravity: 'center' }])
                        .png()
                        .toFile(path.join(dir, 'ic_launcher_foreground.png'))
                )
        ];
    });

    await Promise.all(jobs);
    for (const d of DENSITIES) {
        console.log(`  ${d.name}: legacy ${d.legacy}px, foreground ${d.adaptive}px`);
    }
    console.log('Launcher icons regenerated from resources/launcher-icon.png');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
