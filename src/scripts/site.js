/* =============================================================================
   PIXEL LAB — homepage behaviour.
   Progressive enhancement only: every control exists in the markup first, so a
   stale cache, a blocked script, or a parser error still leaves a usable page.
   ============================================================================= */
(function () {
    "use strict";

    var root = document.documentElement;
    root.classList.add("js-enhanced");
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    var mobileQuery = window.matchMedia("(max-width: 1180px)");
    var reducedMotion = motionQuery.matches;

    function listenMedia(query, handler) {
        if (typeof query.addEventListener === "function") query.addEventListener("change", handler);
        else if (typeof query.addListener === "function") query.addListener(handler);
    }

    function announce(message) {
        var live = document.getElementById("px-status");
        if (!live) {
            live = document.createElement("p");
            live.id = "px-status";
            live.className = "visually-hidden";
            live.setAttribute("role", "status");
            live.setAttribute("aria-live", "polite");
            document.body.appendChild(live);
        }
        live.textContent = "";
        window.setTimeout(function () { live.textContent = message; }, 40);
    }

    listenMedia(motionQuery, function (event) { reducedMotion = event.matches; });

    /* ---------------------------------------------------------------------
       Theme: light -> dark -> system, shared with the blog through a cookie.
       ------------------------------------------------------------------ */

    var themeToggle = document.getElementById("theme-toggle");
    var THEME_COLORS = { light: "#f1e7d2", dark: "#101119" };
    var MODE_ORDER = ["light", "dark", "system"];
    var MODE_LABELS = {
        light: "Theme: light (click for dark)",
        dark: "Theme: dark (click to follow system)",
        system: "Theme: follow system (click for light)"
    };
    var THEME_NAMES = { light: "Light theme", dark: "Dark theme", system: "Following the system theme" };

    function currentMode() {
        return root.getAttribute("data-theme-mode") || "system";
    }

    function appliedTheme(mode) {
        return mode === "system" ? (darkQuery.matches ? "dark" : "light") : mode;
    }

    function persistMode(mode) {
        try { localStorage.setItem("theme", mode); } catch (e) {}
        try {
            var host = location.hostname;
            if (host === "dztang.net" || host.endsWith(".dztang.net")) {
                document.cookie = "dzt_theme=" + mode + "; Domain=.dztang.net; Path=/; Max-Age=31536000; SameSite=Lax";
            }
        } catch (e) {}
    }

    function applyMode(mode, notify) {
        var theme = appliedTheme(mode);
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-theme-mode", mode);

        var meta = document.getElementById("meta-theme-color");
        if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
        if (themeToggle) {
            themeToggle.setAttribute("aria-label", MODE_LABELS[mode]);
            themeToggle.setAttribute("title", MODE_LABELS[mode]);
        }
        if (notify) announce(THEME_NAMES[mode] + ".");
    }

    /* A stepped dither shutter: cover the screen, swap, uncover. */
    var wipeTimer = null;
    function switchThemeWithWipe(apply) {
        var canClip = window.CSS && CSS.supports && CSS.supports("clip-path", "inset(0 0 0 0)");
        if (reducedMotion || !document.body || !canClip) { apply(); return; }
        var wipe = document.createElement("div");
        wipe.className = "wipe";
        wipe.setAttribute("aria-hidden", "true");
        document.body.appendChild(wipe);
        window.requestAnimationFrame(function () {
            wipe.classList.add("is-run");
            window.clearTimeout(wipeTimer);
            wipeTimer = window.setTimeout(function () {
                apply();
                wipe.classList.remove("is-run");
                wipe.classList.add("is-out");
                window.setTimeout(function () { wipe.remove(); }, 230);
            }, 200);
        });
    }

    var switchingTheme = false;
    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            if (switchingTheme) return;
            switchingTheme = true;
            window.setTimeout(function () { switchingTheme = false; }, 460);
            var next = MODE_ORDER[(MODE_ORDER.indexOf(currentMode()) + 1) % MODE_ORDER.length];
            switchThemeWithWipe(function () {
                persistMode(next);
                applyMode(next, true);
            });
        });
        applyMode(currentMode());
    }

    listenMedia(darkQuery, function () {
        if (currentMode() === "system") applyMode("system");
    });

    /* Some browsers miss prefers-color-scheme changes while the tab is hidden;
       re-check whenever the page regains attention. */
    function syncSystemTheme() {
        if (currentMode() === "system") applyMode("system");
    }
    window.addEventListener("focus", syncSystemTheme);
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) syncSystemTheme();
    });

    /* ---------------------------------------------------------------------
       Masthead: sticky shadow, scroll meter, and a mobile auto-hide.
       ------------------------------------------------------------------ */

    var header = document.getElementById("site-header");
    var scrollFill = document.getElementById("scroll-fill");
    var burger = document.getElementById("nav-burger");
    var drawer = document.getElementById("nav-drawer");
    var drawerTimer = null;
    var lastY = window.scrollY;
    var scrollQueued = false;

    function updateScrollUI() {
        scrollQueued = false;
        var y = window.scrollY;
        if (header) {
            header.classList.toggle("is-scrolled", y > 8);
            if (mobileQuery.matches && !header.classList.contains("is-open")) {
                if (y > 320 && y > lastY + 4) header.classList.add("is-hidden");
                else if (y < lastY - 4 || y <= 320) header.classList.remove("is-hidden");
            } else {
                header.classList.remove("is-hidden");
            }
        }
        if (scrollFill) {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            var p = max > 0 ? Math.min(100, (y / max) * 100) : 0;
            scrollFill.style.setProperty("--p", p.toFixed(1));
        }
        lastY = y;
    }

    function requestScrollUI() {
        if (scrollQueued) return;
        scrollQueued = true;
        window.requestAnimationFrame(updateScrollUI);
    }

    window.addEventListener("scroll", requestScrollUI, { passive: true });
    window.addEventListener("resize", requestScrollUI);
    window.addEventListener("load", requestScrollUI);
    if ("ResizeObserver" in window) {
        new ResizeObserver(requestScrollUI).observe(document.body);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestScrollUI);
    updateScrollUI();

    /* ---------------------------------------------------------------------
       Drawer: disclosure + focus handling.
       ------------------------------------------------------------------ */

    function setDrawer(open, options) {
        if (!header || !burger || !drawer) return;
        var visible = !!open && mobileQuery.matches;
        var opts = options || {};
        window.clearTimeout(drawerTimer);

        if (visible) {
            drawer.hidden = false;
            header.classList.add("is-open");
            window.requestAnimationFrame(function () { drawer.classList.add("is-open"); });
            burger.setAttribute("aria-expanded", "true");
            burger.setAttribute("aria-label", "Close navigation");
            if (opts.focus) {
                var first = drawer.querySelector("a, button");
                if (first) first.focus();
            }
        } else {
            var wasOpen = header.classList.contains("is-open");
            header.classList.remove("is-open");
            drawer.classList.remove("is-open");
            burger.setAttribute("aria-expanded", "false");
            burger.setAttribute("aria-label", "Open navigation");
            drawerTimer = window.setTimeout(function () {
                if (!header.classList.contains("is-open")) drawer.hidden = true;
            }, reducedMotion ? 0 : 260);
            if (opts.restoreFocus && wasOpen) burger.focus();
        }
    }

    if (burger && drawer && header) {
        root.classList.add("nav-ready");
        setDrawer(false);
        burger.addEventListener("click", function (event) {
            var open = burger.getAttribute("aria-expanded") !== "true";
            setDrawer(open, { focus: open && event.detail === 0 });
        });
        document.addEventListener("click", function (event) {
            if (header.classList.contains("is-open") && !header.contains(event.target)) setDrawer(false);
        });
        header.addEventListener("focusout", function (event) {
            if (!header.classList.contains("is-open")) return;
            if (event.relatedTarget && header.contains(event.relatedTarget)) return;
            setDrawer(false);
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && header.classList.contains("is-open")) {
                var inside = drawer.contains(document.activeElement);
                setDrawer(false, { restoreFocus: inside });
            }
        });
        listenMedia(mobileQuery, function () { setDrawer(false); });
    }

    /* ---------------------------------------------------------------------
       Scroll reveal: the CSS holds the offset, this only adds .is-in.
       ------------------------------------------------------------------ */

    var revealTargets = Array.prototype.slice.call(
        document.querySelectorAll(".sec, .cart, .award, .collab, .proj, .reg, .page-head")
    );

    if (revealTargets.length && !reducedMotion && "IntersectionObserver" in window) {
        revealTargets.forEach(function (el) { el.classList.add("reveal"); });
        revealTargets.forEach(function (el) {
            var index = 0;
            var node = el;
            while ((node = node.previousElementSibling)) {
                if (node.classList.contains("reveal")) index += 1;
            }
            el.style.setProperty("--i", String(Math.min(index, 5)));
        });

        var revealer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-in");
                revealer.unobserve(entry.target);
            });
        }, { threshold: 0.04, rootMargin: "0px 0px -40px 0px" });

        revealTargets.forEach(function (el) { revealer.observe(el); });
        window.setTimeout(function () {
            revealTargets.forEach(function (el) { el.classList.add("is-in"); });
        }, 2600);
    }

    /* ---------------------------------------------------------------------
       Horizon: a crosshair readout that snaps to the scene's 320x80 grid.
       ------------------------------------------------------------------ */

    var horizonScreen = document.querySelector(".horizon__screen");
    var horizonCursor = horizonScreen && horizonScreen.querySelector(".horizon__cursor");
    var horizonReadout = document.getElementById("horizon-readout");
    var canHover = window.matchMedia("(hover: hover)").matches;
    if (horizonScreen && horizonCursor && canHover) {
        var pointerQueued = false;
        var pxX = 160;
        var pxY = 40;
        var paintCursor = function () {
            pointerQueued = false;
            horizonCursor.style.setProperty("--mx", ((pxX / 320) * 100).toFixed(2));
            horizonCursor.style.setProperty("--my", ((pxY / 80) * 100).toFixed(2));
            if (horizonReadout) {
                horizonReadout.textContent = "X " + String(pxX).padStart(3, "0") + " Y " + String(pxY).padStart(3, "0");
            }
        };
        horizonScreen.addEventListener("pointermove", function (event) {
            var rect = horizonScreen.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            pxX = Math.max(0, Math.min(320, Math.round(((event.clientX - rect.left) / rect.width) * 320)));
            pxY = Math.max(0, Math.min(80, Math.round(((event.clientY - rect.top) / rect.height) * 80)));
            if (pointerQueued) return;
            pointerQueued = true;
            window.requestAnimationFrame(paintCursor);
        });
        horizonScreen.addEventListener("pointerleave", function () {
            if (horizonReadout) horizonReadout.textContent = "";
        });
    }

    /* ---------------------------------------------------------------------
       Counting HUD numbers, in discrete steps.
       ------------------------------------------------------------------ */

    function animateCount(el) {
        var target = parseInt(el.getAttribute("data-count-to"), 10);
        if (isNaN(target)) return;
        var format = function (value) { return value.toLocaleString("en-US"); };
        if (reducedMotion || target <= 0) {
            el.textContent = format(target);
            return;
        }
        var start = null;
        var frames = 12;
        function step(timestamp) {
            if (start === null) start = timestamp;
            var progress = Math.min((timestamp - start) / 760, 1);
            var quantised = Math.floor(progress * frames) / frames;
            el.textContent = format(Math.round(target * quantised));
            if (progress < 1) window.requestAnimationFrame(step);
            else el.textContent = format(target);
        }
        window.requestAnimationFrame(step);
    }

    var counters = document.querySelectorAll("[data-count-to]");
    if (counters.length) {
        if ("IntersectionObserver" in window) {
            var countObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    animateCount(entry.target);
                    countObserver.unobserve(entry.target);
                });
            }, { threshold: 0.4 });
            Array.prototype.forEach.call(counters, function (el) { countObserver.observe(el); });
        } else {
            Array.prototype.forEach.call(counters, animateCount);
        }
    }

    /* ---------------------------------------------------------------------
       Year rail: highlight the group currently in view.
       ------------------------------------------------------------------ */

    var rail = document.getElementById("year-rail");
    var yearSections = Array.prototype.slice.call(document.querySelectorAll(".year-block[id]"));
    if (rail && yearSections.length) {
        var railLinks = Array.prototype.slice.call(rail.querySelectorAll(".rail__link"));
        var setActive = function (id) {
            railLinks.forEach(function (link) {
                var active = link.getAttribute("href") === "#" + id;
                link.classList.toggle("is-active", active);
                if (active) link.setAttribute("aria-current", "location");
                else link.removeAttribute("aria-current");
            });
        };
        var railQueued = false;
        var syncRail = function () {
            railQueued = false;
            var offset = (header ? header.offsetHeight : 72) + 72;
            var current = null;
            for (var i = 0; i < yearSections.length; i++) {
                var section = yearSections[i];
                if (section.hidden) continue;
                if (!current) current = section.id;
                if (section.getBoundingClientRect().top - offset <= 0) current = section.id;
            }
            if (current) setActive(current);
        };
        var requestRail = function () {
            if (railQueued) return;
            railQueued = true;
            window.requestAnimationFrame(syncRail);
        };
        window.addEventListener("scroll", requestRail, { passive: true });
        window.addEventListener("resize", requestRail);
        setActive(yearSections[0].id);
        syncRail();
    }

    /* ---------------------------------------------------------------------
       Portrait: pixel study <-> photograph.
       ------------------------------------------------------------------ */

    var portrait = document.getElementById("portrait-card");
    var portraitToggle = document.querySelector("[data-portrait-toggle]");
    var portraitStatus = document.getElementById("portrait-status");
    if (portrait && portraitToggle) {
        portraitToggle.setAttribute("aria-pressed", "false");
        portraitToggle.addEventListener("click", function () {
            var showPhoto = !portrait.classList.contains("is-photo");
            portrait.classList.toggle("is-photo", showPhoto);
            portraitToggle.setAttribute("aria-pressed", String(showPhoto));
            portraitToggle.textContent = showPhoto ? "view sprite" : "view photo";
            if (portraitStatus) {
                portraitStatus.textContent = showPhoto
                    ? "Showing the original photograph."
                    : "Showing the 16-colour pixel study.";
            }
        });
    }

    /* ---------------------------------------------------------------------
       XP meters charge cell by cell.
       ------------------------------------------------------------------ */

    Array.prototype.forEach.call(document.querySelectorAll(".meter"), function (meter) {
        meter.classList.add("meter--charge");
        Array.prototype.forEach.call(meter.children, function (cell, index) {
            if (cell.classList.contains("is-on")) cell.style.setProperty("--i", String(index));
        });
    });

    /* ---------------------------------------------------------------------
       Dialogs (WeChat QR and any future modal).
       ------------------------------------------------------------------ */

    Array.prototype.forEach.call(document.querySelectorAll("[data-dialog-target]"), function (opener) {
        var dialog = document.getElementById(opener.getAttribute("data-dialog-target"));
        if (!dialog || typeof dialog.showModal !== "function") return;
        opener.addEventListener("click", function () { dialog.showModal(); });
        Array.prototype.forEach.call(dialog.querySelectorAll("[data-dialog-close]"), function (button) {
            button.addEventListener("click", function () { dialog.close(); });
        });
        dialog.addEventListener("click", function (event) {
            if (event.target !== dialog) return;
            var rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
                dialog.close();
            }
        });
    });

    /* ---------------------------------------------------------------------
       Back to top.
       ------------------------------------------------------------------ */

    var backToTop = document.getElementById("back-to-top");
    if (backToTop) {
        var syncBackToTop = function () {
            backToTop.classList.toggle("is-visible", window.scrollY > 480);
        };
        window.addEventListener("scroll", syncBackToTop, { passive: true });
        syncBackToTop();
        backToTop.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
            var main = document.getElementById("main-content");
            if (main) main.focus({ preventScroll: true });
        });
    }

    /* ---------------------------------------------------------------------
       Project log: filter by role. The buttons ship hidden, so a blocked
       script leaves the complete, readable list in place.
       ------------------------------------------------------------------ */

    var projectFilter = document.querySelector("[data-project-filter]");
    if (projectFilter) {
        var roleButtons = Array.prototype.slice.call(projectFilter.querySelectorAll("[data-role-filter]"));
        var projectCards = Array.prototype.slice.call(document.querySelectorAll(".proj[data-role]"));
        var projectYearBlocks = Array.prototype.slice.call(document.querySelectorAll("[data-year-block]"));
        var projectEmpty = document.querySelector("[data-project-empty]");
        var filterNote = document.querySelector("[data-filter-note]");

        var applyRoleFilter = function (role, quiet) {
            var shown = 0;
            projectCards.forEach(function (card) {
                var match = role === "all" || card.getAttribute("data-role") === role;
                card.classList.toggle("is-filtered", !match);
                if (match) shown += 1;
            });
            projectYearBlocks.forEach(function (block) {
                var any = !!block.querySelector(".proj:not(.is-filtered)");
                block.hidden = !any;
                var railLink = document.querySelector('#year-rail a[href="#' + block.id + '"]');
                if (railLink) railLink.hidden = !any;
            });
            if (projectEmpty) projectEmpty.hidden = shown !== 0;
            if (filterNote) {
                filterNote.textContent = (role === "all" ? "All roles" : role) + " \u00b7 " + shown + " of " + projectCards.length + " records";
            }
            roleButtons.forEach(function (button) {
                var active = button.getAttribute("data-role-filter") === role;
                button.classList.toggle("is-active", active);
                button.setAttribute("aria-pressed", active ? "true" : "false");
            });
            if (!quiet) announce(shown + " project records shown");
            window.dispatchEvent(new Event("scroll"));
        };

        projectFilter.hidden = false;
        roleButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                applyRoleFilter(button.getAttribute("data-role-filter"));
            });
        });
        applyRoleFilter("all", true);
    }

    /* ---------------------------------------------------------------------
       Copy buttons (registration numbers).
       ------------------------------------------------------------------ */

    var copyButtons = document.querySelectorAll("[data-copy]");
    Array.prototype.forEach.call(copyButtons, function (button) {
        button.addEventListener("click", function () {
            var value = button.getAttribute("data-copy") || "";
            var settle = function (ok) {
                if (!ok) {
                    announce("Copy failed");
                    return;
                }
                button.classList.add("is-done");
                announce("Copied " + value);
                window.setTimeout(function () { button.classList.remove("is-done"); }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(value).then(function () { settle(true); }, function () { settle(false); });
                return;
            }
            var helper = document.createElement("textarea");
            helper.value = value;
            helper.setAttribute("readonly", "");
            helper.style.position = "fixed";
            helper.style.opacity = "0";
            document.body.appendChild(helper);
            helper.select();
            var ok = false;
            try {
                ok = document.execCommand("copy");
            } catch (error) {
                ok = false;
            }
            document.body.removeChild(helper);
            settle(ok);
        });
    });

    /* ---------------------------------------------------------------------
       Footer clock: local time, paused while the tab is hidden.
       ------------------------------------------------------------------ */

    var clock = document.getElementById("footer-clock");
    if (clock) {
        var pad = function (n) { return n < 10 ? "0" + n : String(n); };
        var tickClock = function () {
            var now = new Date();
            clock.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
            clock.setAttribute("title", now.toLocaleString());
        };
        tickClock();
        var clockTimer = window.setInterval(tickClock, 1000);
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) {
                window.clearInterval(clockTimer);
                clockTimer = null;
            } else if (!clockTimer) {
                tickClock();
                clockTimer = window.setInterval(tickClock, 1000);
            }
        });
    }

    /* ---------------------------------------------------------------------
       bfcache / resize housekeeping.
       ------------------------------------------------------------------ */

    window.addEventListener("pageshow", function (event) {
        if (!event.persisted) return;
        setDrawer(false);
        lastY = window.scrollY;
        updateScrollUI();
    });
})();