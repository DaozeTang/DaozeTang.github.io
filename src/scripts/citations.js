(function () {
    "use strict";

    var API_BASE = "https://api.semanticscholar.org/graph/v1/paper/";
    var PAPER_BASE = "https://www.semanticscholar.org/paper/";
    var CACHE_PREFIX = "s2-citations:";
    var CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    function readCache(id) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + id);
            if (!raw) return null;
            var entry = JSON.parse(raw);
            if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
            return entry.count;
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

    function fetchCount(id) {
        var cached = readCache(id);
        if (cached !== null) return Promise.resolve(cached);

        return fetch(API_BASE + id + "?fields=citationCount")
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (data) {
                var count = data && typeof data.citationCount === "number" ? data.citationCount : null;
                if (count !== null) writeCache(id, count);
                return count;
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

    document.querySelectorAll("[data-semantic-scholar-id]").forEach(function (slot) {
        var id = slot.getAttribute("data-semantic-scholar-id");
        if (!id) return;
        fetchCount(id)
            .then(function (count) {
                if (typeof count === "number" && count > 0) renderChip(slot, id, count);
            })
            .catch(function () {  });
    });
})();
