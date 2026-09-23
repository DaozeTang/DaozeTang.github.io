const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const PUBS_DIR = path.join(ROOT, "src/content/publications");
const OUT_FILE = path.join(ROOT, "src/data/citations.json");

const S2_API = "https://api.semanticscholar.org/graph/v1/paper/";
const OPENALEX_API = "https://api.openalex.org/works/doi:";
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1500;
const GAP_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function listPublicationFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const yearDir = path.join(dir, entry.name);
        for (const file of fs.readdirSync(yearDir)) {
            if (file.endsWith(".md")) out.push(path.join(yearDir, file));
        }
    }
    return out.sort();
}

function readFrontMatter(file) {
    const text = fs.readFileSync(file, "utf-8");
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    try {
        return yaml.load(match[1]) || {};
    } catch (err) {
        console.error(`  ! unreadable front matter in ${path.basename(file)}: ${err.message}`);
        return {};
    }
}

function doiFrom(link) {
    if (typeof link !== "string") return null;
    const match = link.match(/doi\.org\/(.+)$/);
    return match ? match[1] : null;
}

async function getJson(url) {
    const res = await fetch(url, { headers: { "User-Agent": "dztang-site-citations" } });
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function fromSemanticScholar(paperId) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const data = await getJson(S2_API + paperId + "?fields=citationCount");
            if (typeof data?.citationCount !== "number") throw new Error("malformed response");
            return { count: data.citationCount, source: "semanticscholar" };
        } catch (err) {
            if (attempt === MAX_ATTEMPTS) return { error: `semanticscholar: ${err.message}` };
            const wait = err.status === 429
                ? BASE_DELAY_MS * attempt * 2
                : BASE_DELAY_MS * attempt;
            await sleep(wait);
        }
    }
    return { error: "semanticscholar: exhausted" };
}

async function fromOpenAlex(doi) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const data = await getJson(
                OPENALEX_API + encodeURIComponent(doi) + "?select=cited_by_count"
            );
            if (typeof data?.cited_by_count !== "number") throw new Error("malformed response");
            return { count: data.cited_by_count, source: "openalex" };
        } catch (err) {
            if (attempt === MAX_ATTEMPTS) return { error: `openalex: ${err.message}` };
            await sleep(BASE_DELAY_MS * attempt);
        }
    }
    return { error: "openalex: exhausted" };
}

async function resolveCount(paperId, doi, preferredSource) {
    const attempts = [];
    if (preferredSource === "openalex") {
        if (doi) attempts.push({ source: "openalex", run: () => fromOpenAlex(doi) });
        attempts.push({ source: "semanticscholar", run: () => fromSemanticScholar(paperId) });
    } else {
        attempts.push({ source: "semanticscholar", run: () => fromSemanticScholar(paperId) });
        if (doi) attempts.push({ source: "openalex", run: () => fromOpenAlex(doi) });
    }

    const errors = [];
    for (let i = 0; i < attempts.length; i += 1) {
        const result = await attempts[i].run();
        if (!result.error) return { ...result, viaFallback: i > 0 };
        errors.push(result.error);
    }
    return { error: errors.join("; ") || "no usable source" };
}

function loadExisting() {
    try {
        const parsed = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

async function main() {
    const targets = [];
    for (const file of listPublicationFiles(PUBS_DIR)) {
        const data = readFrontMatter(file);
        const paperId = data.semantic_scholar_id;
        if (!paperId) continue;
        targets.push({
            paperId,
            doi: doiFrom(data.links?.Paper),
            title: String(data.title || path.basename(file)).slice(0, 60),
        });
    }

    if (!targets.length) {
        console.log("No publications declare semantic_scholar_id; nothing to do.");
        return;
    }

    const existing = loadExisting();
    const next = {};
    let changed = 0;
    let unchanged = 0;
    let kept = 0;

    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < targets.length; i += 1) {
        const { paperId, doi, title } = targets[i];
        const previous = existing[paperId] || null;
        const preferredSource =
            previous && previous.source === "openalex" ? "openalex" : "semanticscholar";

        const result = await resolveCount(paperId, doi, preferredSource);
        const refuseFallback = !result.error && result.viaFallback && previous;

        if (result.error || refuseFallback) {
            if (previous) {
                next[paperId] = previous;
                kept += 1;
                const why = result.error
                    ? result.error
                    : `${preferredSource} unreachable; not adopting ${result.source} value ${result.count} over cached ${previous.count}`;
                console.log(`  = ${title}  kept ${previous.count} (${previous.source})`);
                console.log(`    ${why}`);
            } else {
                console.log(`  x ${title}  unresolved: ${result.error}`);
            }
        } else {
            const sameValue =
                previous &&
                previous.count === result.count &&
                previous.source === result.source;

            next[paperId] = {
                count: result.count,
                source: result.source,
                fetchedAt: sameValue && previous.fetchedAt ? previous.fetchedAt : today,
            };

            if (sameValue) {
                unchanged += 1;
                console.log(`  = ${title}  ${result.count} via ${result.source} (unchanged)`);
            } else {
                changed += 1;
                const was = previous ? `${previous.count} via ${previous.source}` : "none";
                console.log(`  + ${title}  ${result.count} via ${result.source} (was: ${was})`);
            }
        }

        if (i < targets.length - 1) await sleep(GAP_MS);
    }

    for (const [paperId, entry] of Object.entries(existing)) {
        if (!next[paperId] && !targets.some((t) => t.paperId === paperId)) {
            next[paperId] = entry;
        }
    }

    const sorted = {};
    for (const key of Object.keys(next).sort()) sorted[key] = next[key];

    fs.writeFileSync(OUT_FILE, JSON.stringify(sorted, null, 4) + "\n");
    console.log(
        `\nWrote ${OUT_FILE} (${changed} changed, ${unchanged} unchanged, ${kept} kept from cache).`
    );
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
