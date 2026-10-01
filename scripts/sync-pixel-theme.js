#!/usr/bin/env node
'use strict';

/*
 * sync-pixel-theme.js — keeps the shared pixel design system identical across
 * the Blog repository and the personal-homepage repository.
 *
 * The two sites live side by side (…/GitHub/Blog and …/GitHub/DaozeTang.github.io)
 * and share a pixel "core" of SCSS partials. This tool:
 *   check   verify the shared partials are byte-identical with the sibling repo
 *           and that every var(--token) used is actually defined          (default)
 *   sync    copy the sibling repo's shared partials over this repo's copies
 *   tokens  only run the token-coverage audit
 *
 * When no sibling checkout exists (e.g. inside a single-repo CI job) the
 * cross-repo comparison is skipped and the local audits still run.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLES = path.join(ROOT, 'src', 'styles');

/* Files that form the shared pixel core — must be identical in both repos. */
const SHARED = [
    '_tokens.scss',
    '_base.scss',
    '_pixel.scss',
    '_layout.scss',
    '_cards.scss',
    '_navbar.scss',
    '_footer.scss',
    '_buttons.scss',
    '_animations.scss',
    '_responsive.scss',
];

/* Markers that prove a partial is still written in the pixel system. */
const REQUIRED_MARKERS = {
    '_tokens.scss': ['--px:', '--px-line', 'steps('],
    '_base.scss': ['canvas-grid', 'canvas-scanlines', 'image-rendering'],
    '_pixel.scss': ['--px-clip', 'px-notch', 'lq-glare'],
};

/* Legacy "glass / soft UI" declarations that must not survive in the pixel
   core. Matched as whole declarations and judged on the parsed value, so the
   pixel-legal forms (`backdrop-filter: none`, `border-radius: 0`,
   `border-radius: var(--radius-*)`) are not false positives. */
const CHECKS = [
    {
        name: 'glassmorphism blur must not return',
        re: /(?:-webkit-)?backdrop-filter\s*:\s*([^;]+);/g,
        bad: (v) => !/^none\b/.test(v.trim()),
    },
    {
        name: 'rounded corners break the pixel grid',
        re: /border-radius\s*:\s*([^;]+);/g,
        bad: (v) => {
            const value = v.trim();
            if (/^var\(--radius/.test(value)) return false;
            return value.split(/\s+/).some((p) => !/^0(px|rem|em)?$/i.test(p));
        },
    },
    {
        name: 'blurred shadows are not pixel shadows (use Nx Nx 0 0 color)',
        re: /box-shadow\s*:\s*([^;]+);/g,
        bad: (v) => /\d+(?:\.\d+)?px\s+\d+(?:\.\d+)?px\s+\d{2,}px/.test(v),
    },
    {
        name: 'large text-shadow clips pixel-font glyph tops in Chrome (keep offsets <= 2px)',
        re: /text-shadow\s*:\s*([^;]+);/g,
        bad: (v) => {
            if (/^\s*none\s*$/.test(v)) return false;
            return (v.match(/(\d+(?:\.\d+)?)px/g) || [])
                .some((px) => parseFloat(px) >= 3);
        },
    },
    {
        name: 'smooth motion must use steps() in the pixel system',
        re: /transition(?:-timing-function)?\s*:\s*([^;]+);/g,
        bad: (v) => /cubic-bezier|ease-in-out|ease-out|ease-in\b/.test(v) && !/steps\(/.test(v),
    },
];

/* a conic-gradient tint only tiles when the rule also sets background-size */
function auditDitherTiles(dir) {
    const hits = [];
    for (const file of listScss(dir)) {
        const css = stripComments(read(file));
        for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            if (m[2].includes('var(--px-dither)') && !m[2].includes('background-size')) {
                hits.push({
                    file: path.basename(file),
                    why: '--px-dither needs background-size or it stretches into giant blocks',
                    sample: m[1].trim().split('\n').pop().slice(0, 60),
                });
            }
        }
    }
    return hits;
}

function auditLegacy(dir) {
    const hits = [];
    for (const file of listScss(dir)) {
        const css = stripComments(read(file));
        for (const { name, re, bad } of CHECKS) {
            re.lastIndex = 0;
            for (const m of css.matchAll(re)) {
                if (bad(m[1])) {
                    hits.push({ file: path.basename(file), why: name, sample: m[0].trim().slice(0, 72) });
                }
            }
        }
    }
    return hits;
}

function siblingRoot() {
    const candidates = ['DaozeTang.github.io', 'Blog'];
    for (const name of candidates) {
        const dir = path.resolve(ROOT, '..', name);
        if (dir === ROOT) continue;
        if (fs.existsSync(path.join(dir, 'src', 'styles', '_tokens.scss'))) return dir;
    }
    return null;
}

function listScss(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.scss'))
        .map((f) => path.join(dir, f));
}

function read(p) {
    return fs.readFileSync(p, 'utf8');
}

/* strip CSS comments so prose inside the header banners is never audited */
function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ---------------- token coverage ---------------- */

function auditTokens() {
    const files = listScss(STYLES);
    const defined = new Set();
    const used = new Map();

    for (const file of files) {
        const css = stripComments(read(file));
        for (const m of css.matchAll(/(--[a-z0-9][a-z0-9-]*)\s*:/gi)) defined.add(m[1]);
        for (const m of css.matchAll(/var\(\s*(--[a-z0-9][a-z0-9-]*)/gi)) {
            if (!used.has(m[1])) used.set(m[1], path.basename(file));
        }
    }

    /* vars set from JS / inline styles are legitimate external definitions */
    const external = new Set(['--mx', '--my']);
    const jsPath = path.join(ROOT, 'src', 'scripts', 'site.js');
    if (fs.existsSync(jsPath)) {
        for (const m of read(jsPath).matchAll(/setProperty\(\s*['"](--[a-z0-9-]+)/gi)) {
            external.add(m[1]);
        }
    }

    const missing = [...used.keys()].filter((t) => !defined.has(t) && !external.has(t));
    return { defined: defined.size, used: used.size, missing, usedBy: used };
}

/* ---------------- forbidden patterns ---------------- */

function auditForbidden() {
    const hits = [];
    for (const file of listScss(STYLES)) {
        const css = read(file);
        for (const { re, why } of FORBIDDEN) {
            re.lastIndex = 0;
            for (const m of css.matchAll(re)) {
                hits.push({ file: path.basename(file), why, sample: m[0].trim().slice(0, 72) });
            }
        }
    }
    return hits;
}

/* ---------------- main ---------------- */

const mode = process.argv[2] || 'check';
const problems = [];

if (mode === 'sync') {
    const sib = siblingRoot();
    if (!sib) {
        console.error('sync: no sibling repository found next to ' + path.basename(ROOT));
        process.exit(2);
    }
    for (const f of SHARED) {
        const src = path.join(sib, 'src', 'styles', f);
        fs.copyFileSync(src, path.join(STYLES, f));
        console.log('copied ' + f + ' <- ' + path.relative(path.resolve(ROOT, '..'), src));
    }
    console.log('pixel core synced from ' + sib);
    process.exit(0);
}

/* 1. every shared partial exists and is non-empty */
for (const f of SHARED) {
    const p = path.join(STYLES, f);
    if (!fs.existsSync(p)) problems.push('missing shared partial: src/styles/' + f);
    else if (read(p).trim().length === 0) problems.push('empty shared partial: src/styles/' + f);
}

/* 2. pixel markers present / legacy glass module gone */
for (const [f, markers] of Object.entries(REQUIRED_MARKERS)) {
    const p = path.join(STYLES, f);
    if (!fs.existsSync(p)) continue;
    const css = read(p);
    for (const marker of markers) {
        if (!css.includes(marker)) problems.push(f + ': expected pixel marker "' + marker + '"');
    }
}
if (fs.existsSync(path.join(STYLES, '_glass.scss'))) {
    problems.push('src/styles/_glass.scss still present — the pixel core uses _pixel.scss');
}
const siteScss = path.join(STYLES, 'site.scss');
if (fs.existsSync(siteScss)) {
    const entry = read(siteScss);
    if (!entry.includes('"pixel"')) problems.push('site.scss must @use "pixel"');
    if (/@use\s+"glass"/.test(entry)) problems.push('site.scss must not @use "glass"');
    for (const f of SHARED) {
        const base = f.replace(/^_/, '').replace(/\.scss$/, '');
        if (!entry.includes('"' + base + '"')) problems.push('site.scss does not import shared core: ' + base);
    }
}

/* 3. shared core must be byte-identical with the sibling repository */
const sib = siblingRoot();
if (sib) {
    for (const f of SHARED) {
        const a = path.join(STYLES, f);
        const b = path.join(sib, 'src', 'styles', f);
        if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
        if (read(a) !== read(b)) problems.push('pixel core drift: src/styles/' + f + ' != ' + path.relative(ROOT, b));
    }
}

/* 3b. the palette announced to the OS/browser must equal the token palette */
(function auditThemeColor() {
    const tokens = read(path.join(STYLES, '_tokens.scss'));
    const light = /\n\s*--bg:\s*(#[0-9a-f]{6})/i.exec(tokens);
    const dark = /\[data-theme="dark"\][\s\S]*?--bg:\s*(#[0-9a-f]{6})/i.exec(tokens);
    if (!light || !dark) {
        problems.push('_tokens.scss: could not read the light/dark --bg values');
        return;
    }
    const sources = {
        'src/partials/head.liquid': path.join(ROOT, 'src/partials/head.liquid'),
        'src/scripts/site.js': path.join(ROOT, 'src/scripts/site.js'),
    };
    for (const [label, file] of Object.entries(sources)) {
        if (!fs.existsSync(file)) continue;
        const body = read(file);
        for (const want of [light[1], dark[1]]) {
            if (!body.toLowerCase().includes(want.toLowerCase())) {
                problems.push(label + ' does not use the current palette colour ' + want);
            }
        }
    }
}());

/* 4. token coverage + legacy glass/soft-UI patterns */
const tokens = auditTokens();
for (const t of tokens.missing) problems.push('undefined design token used: ' + t + ' (first seen in ' + tokens.usedBy[t] + ')');

const forbidden = auditLegacy(STYLES).concat(auditDitherTiles(STYLES));
for (const h of forbidden) problems.push(h.file + ': ' + h.why + ' — ' + h.sample);

console.log('pixel theme check — ' + path.basename(ROOT));
console.log('  shared partials : ' + SHARED.length + (sib ? ' (compared with ' + path.basename(sib) + ')' : ' (no sibling checkout)'));
console.log('  tokens defined  : ' + tokens.defined + ', used: ' + tokens.used + ', unresolved: ' + tokens.missing.length);
console.log('  legacy patterns : ' + forbidden.length + ' hit(s)');

if (problems.length) {
    console.error('\nFAIL');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
}
console.log('\nOK — pixel design system is unified');
