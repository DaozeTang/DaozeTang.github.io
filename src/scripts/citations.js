(function () {
    "use strict";

    var S2_API = "https://api.semanticscholar.org/graph/v1/paper/";
    var S2_PAPER = "https://www.semanticscholar.org/paper/";
    var OPENALEX_API = "https://api.openalex.org/works/doi:";
    var CACHE_PREFIX = "s2-citations:";
    var CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    // The unauthenticated Semantic Scholar API is heavily rate-limited
    // (frequent 429/503), so it often fails even with retries. Strategy:
    // try S2 briefly, then fall back to OpenAlex (no practical rate
    // limit), then to stale cache. Requests are serialized with a gap
    // to play nice with S2's limiter.
    var REQUEST_GAP_MS = 1200;
    var S2_ATTEMPTS = 2;
    var BACKOFF_BASE_MS = 2000;

    function readCache(id) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + id);
            if (!raw) return null;
            var entry = JSON.parse(raw);
            if (typeof entry.count !== "number") return null;
            return {
                count: entry.count,
                fresh: Date.now() - entry.fetchedAt <= CACHE_TTL_MS
            };
        } catch (e) {
            return null;
        }
    }

    function writeCache(id, count) {
        try {
            localStorage.setItem(
                CACHE_PREFIX + id,
                JSON.stringify({ count: count, fetchedAt: Date.now() })
            );
        } catch (e) {  }
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function getJson(url) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        });
    }

    function fetchS2(id, attempt) {
        return getJson(S2_API + id + "?fields=citationCount").then(function (data) {
            var count = data && typeof data.citationCount === "number" ? data.citationCount : null;
            if (count === null) throw new Error("Malformed response");
            return count;
        }).catch(function (err) {
            if (attempt >= S2_ATTEMPTS) throw err;
            var backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
                + Math.random() * 1000;
            return sleep(backoff).then(function () {
                return fetchS2(id, attempt + 1);
            });
        });
    }

    function fetchOpenAlex(doi) {
        return getJson(OPENALEX_API + doi + "?select=cited_by_count").then(function (data) {
            var count = data && typeof data.cited_by_count === "number" ? data.cited_by_count : null;
            if (count === null) throw new Error("Malformed response");
            return count;
        });
    }

    function fetchCount(id, doi) {
        return fetchS2(id, 1).catch(function (err) {
            if (doi) return fetchOpenAlex(doi);
            throw err;
        });
    }

    function renderChip(slot, id, count) {
        var chip = document.createElement("a");
        chip.className = "tag tag-cite";
        chip.href = S2_PAPER + id;
        chip.target = "_blank";
        chip.rel = "noopener";
        chip.title = "Citation count via Semantic Scholar / OpenAlex";
        chip.innerHTML = '<i class="ai ai-semanticscholar" aria-hidden="true"></i> ' +
            count + (count === 1 ? " citation" : " citations");
        slot.appendChild(chip);
    }

    function maybeRender(slot, id, count) {
        if (typeof count === "number" && count > 0) renderChip(slot, id, count);
    }

    var queue = Promise.resolve();

    document.querySelectorAll("[data-semantic-scholar-id]").forEach(function (slot) {
        var id = slot.getAttribute("data-semantic-scholar-id");
        if (!id) return;
        var doi = slot.getAttribute("data-doi");

        var cached = readCache(id);
        if (cached && cached.fresh) {
            maybeRender(slot, id, cached.count);
            return;
        }

        queue = queue.then(function () {
            return fetchCount(id, doi).then(function (count) {
                writeCache(id, count);
                maybeRender(slot, id, count);
            }).catch(function () {
                // Everything failed: fall back to stale cache if any.
                if (cached) maybeRender(slot, id, cached.count);
            }).then(function () {
                return sleep(REQUEST_GAP_MS);
            });
        });
    });
})();
