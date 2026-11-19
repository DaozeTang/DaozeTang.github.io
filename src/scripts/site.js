/* Homepage behaviour: theme, drawer, portrait switch, counters, rail spy. */
(function () {
    "use strict";

    var root = document.documentElement;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function listenMedia(query, handler) {
        if (typeof query.addEventListener === "function") query.addEventListener("change", handler);
        else if (typeof query.addListener === "function") query.addListener(handler);
    }

    /* Theme */
    var themeToggle = document.getElementById("theme-toggle");
    var themeIcon = document.getElementById("theme-icon");
    var THEME_COLORS = { light: "#f1e7d2", dark: "#101119" };
    var MODE_ORDER = ["light", "dark", "system"];
    var MODE_ICONS = { light: "#i-sun", dark: "#i-moon", system: "#i-monitor" };
    var MODE_LABELS = {
        light: "Theme: light (click for dark)",
        dark: "Theme: dark (click to follow system)",
        system: "Theme: follow system (click for light)"
    };

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

    function applyMode(mode) {
        var theme = appliedTheme(mode);
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-theme-mode", mode);

        var meta = document.getElementById("meta-theme-color");
        if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
        if (themeIcon) themeIcon.setAttribute("href", MODE_ICONS[mode]);
        if (themeToggle) {
            themeToggle.setAttribute("aria-label", MODE_LABELS[mode]);
            themeToggle.setAttribute("title", MODE_LABELS[mode]);
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            var next = MODE_ORDER[(MODE_ORDER.indexOf(currentMode()) + 1) % MODE_ORDER.length];
            persistMode(next);
            applyMode(next);
        });
        applyMode(currentMode());
    }

    listenMedia(darkQuery, function () {
        if (currentMode() === "system") applyMode("system");
    });

    /* Masthead + drawer */
    var header = document.getElementById("site-header");
    var burger = document.getElementById("nav-burger");
    var drawer = document.getElementById("nav-drawer");
    var mobileQuery = window.matchMedia("(max-width: 1023px)");

    if (header) {
        var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    function setDrawer(open) {
        if (!header || !burger || !drawer) return;
        var visible = open && mobileQuery.matches;
        header.classList.toggle("is-open", visible);
        drawer.hidden = !visible;
        burger.setAttribute("aria-expanded", String(visible));
        burger.setAttribute("aria-label", visible ? "Close navigation" : "Open navigation");
    }

    if (burger && drawer) {
        setDrawer(false);
        burger.addEventListener("click", function () {
            setDrawer(burger.getAttribute("aria-expanded") !== "true");
        });
        document.addEventListener("click", function (event) {
            if (header && header.classList.contains("is-open") && !header.contains(event.target)) setDrawer(false);
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && header && header.classList.contains("is-open")) {
                setDrawer(false);
                burger.focus();
            }
        });
        listenMedia(mobileQuery, function () { setDrawer(false); });
    }

    /* Portrait: pixel study <-> photograph */
    var portrait = document.getElementById("portrait-card");
    var portraitToggle = document.querySelector("[data-portrait-toggle]");
    if (portrait && portraitToggle) {
        portraitToggle.addEventListener("click", function () {
            var showPhoto = !portrait.classList.contains("is-photo");
            portrait.classList.toggle("is-photo", showPhoto);
            portraitToggle.setAttribute("aria-pressed", String(showPhoto));
            portraitToggle.textContent = showPhoto ? "view sprite" : "view photo";
        });
    }

    /* Scroll reveal */
    var revealTargets = document.querySelectorAll(".sec, .cart, .award, .collab, .proj, .reg, .page-head");
    if ("IntersectionObserver" in window && !reducedMotion && revealTargets.length) {
        revealTargets.forEach(function (el) { el.classList.add("reveal"); });
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
        }, 3000);
    }

    /* Counting HUD numbers */
    var counters = document.querySelectorAll("[data-count-to]");
    function animateCount(el) {
        var target = parseInt(el.getAttribute("data-count-to"), 10);
        if (isNaN(target)) return;
        if (reducedMotion || target <= 0) {
            el.textContent = target.toLocaleString("en-US");
            return;
        }
        var start = null;
        function step(timestamp) {
            if (start === null) start = timestamp;
            var progress = Math.min((timestamp - start) / 1200, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased).toLocaleString("en-US");
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    if (counters.length) {
        if ("IntersectionObserver" in window) {
            var countObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    animateCount(entry.target);
                    countObserver.unobserve(entry.target);
                });
            }, { threshold: 0.4 });
            counters.forEach(function (el) { countObserver.observe(el); });
        } else {
            counters.forEach(animateCount);
        }
    }

    /* Year rail tracking */
    var rail = document.getElementById("year-rail");
    var yearSections = document.querySelectorAll(".year-block");
    if (rail && yearSections.length && "IntersectionObserver" in window) {
        var railLinks = rail.querySelectorAll(".rail__link");
        var setActive = function (id) {
            railLinks.forEach(function (link) {
                var active = link.getAttribute("href") === "#" + id;
                link.classList.toggle("is-active", active);
                if (active) link.setAttribute("aria-current", "true");
                else link.removeAttribute("aria-current");
            });
        };
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) setActive(entry.target.id);
            });
        }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });
        yearSections.forEach(function (section) { spy.observe(section); });
        setActive(yearSections[0].id);
    }

    /* Dialogs (WeChat QR, future modals) */
    document.querySelectorAll("[data-dialog-target]").forEach(function (opener) {
        var dialog = document.getElementById(opener.getAttribute("data-dialog-target"));
        if (!dialog || typeof dialog.showModal !== "function") return;
        opener.addEventListener("click", function () { dialog.showModal(); });
        dialog.querySelectorAll("[data-dialog-close]").forEach(function (btn) {
            btn.addEventListener("click", function () { dialog.close(); });
        });
        dialog.addEventListener("click", function (event) {
            if (event.target !== dialog) return;
            var rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
                dialog.close();
            }
        });
    });

    /* Back to top */
    var backToTop = document.getElementById("back-to-top");
    if (backToTop) {
        var syncBackToTop = function () { backToTop.classList.toggle("is-visible", window.scrollY > 480); };
        window.addEventListener("scroll", syncBackToTop, { passive: true });
        syncBackToTop();
        backToTop.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
        });
    }
})();
