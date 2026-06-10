(function () {
    "use strict";

    var API_BASE = "https://api.semanticscholar.org/graph/v1/paper/";
    var PAPER_BASE = "https://www.semanticscholar.org/paper/";
    var CACHE_PREFIX = "s2-citations:";
    var CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    // The unauthenticated Semantic Scholar API is heavily rate-limited
    // (frequent 429/503). Requests are sent one at a time with a gap,
    // failures are retried with backoff, and stale cache is used as a
    // last resort so a transient outage doesn't blank the chips.
    var REQUEST_GAP_MS = 1200;
    var MAX_ATTEMPTS = 4;
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

    function fetchOnce(id) {
        return fetch(API_BASE + id + "?fields=citationCount").then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        }).then(function (data) {
            var count = data && typeof data.citationCount === "number" ? data.citationCount : null;
            if (count === null) throw new Error("Malformed response");
            return count;
        });
    }

    function fetchWithRetry(id, attempt) {
        return fetchOnce(id).catch(function (err) {
            if (attempt >= MAX_ATTEMPTS) throw err;
            var backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
                + Math.random() * 1000;
            return sleep(backoff).then(function () {
                return fetchWithRetry(id, attempt + 1);
            });
        });
    }

    function renderChip(slot, id, count) {
        var chip = document.createElement("a");
        chip.className = "tag tag-cite";
        chip.href = PAPER_BASE + id;
        chip.target = "_blank";
        chip.rel = "noopener";
        chip.title = "Citation count via Semantic Scholar";
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

        var cached = readCache(id);
        if (cached && cached.fresh) {
            maybeRender(slot, id, cached.count);
            return;
        }

        queue = queue.then(function () {
            return fetchWithRetry(id, 1).then(function (count) {
                writeCache(id, count);
                maybeRender(slot, id, count);
            }).catch(function () {
                // All retries failed: fall back to stale cache if any.
                if (cached) maybeRender(slot, id, cached.count);
            }).then(function () {
                return sleep(REQUEST_GAP_MS);
            });
        });
    });
})();
