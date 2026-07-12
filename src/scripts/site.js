(function () {
    "use strict";

    var root = document.documentElement;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

    var themeToggle = document.getElementById("theme-toggle");
    var THEME_COLORS = { light: "#f9f7f6", dark: "#16110e" };
    var MODE_ORDER = ["light", "dark", "system"];
    var MODE_ICONS = {
        light: "fas fa-sun",
        dark: "fas fa-moon",
        system: "fas fa-circle-half-stroke",
    };
    var MODE_LABELS = {
        light: "Theme: light (click for dark)",
        dark: "Theme: dark (click to follow system)",
        system: "Theme: follow system (click for light)",
    };

    function currentMode() {
        return root.getAttribute("data-theme-mode") || "system";
    }

    function appliedTheme(mode) {
        return mode === "system" ? (darkQuery.matches ? "dark" : "light") : mode;
    }

    function applyMode(mode) {
        var theme = appliedTheme(mode);
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-theme-mode", mode);

        var meta = document.getElementById("meta-theme-color");
        if (meta) meta.setAttribute("content", THEME_COLORS[theme]);

        if (themeToggle) {
            var icon = themeToggle.querySelector("i");
            if (icon) icon.className = MODE_ICONS[mode];
            themeToggle.setAttribute("aria-label", MODE_LABELS[mode]);
            themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            var next = MODE_ORDER[(MODE_ORDER.indexOf(currentMode()) + 1) % MODE_ORDER.length];
            try { localStorage.setItem("theme", next); } catch (e) {}
            applyMode(next);
        });
        applyMode(currentMode());
    }

    darkQuery.addEventListener("change", function () {
        if (currentMode() === "system") applyMode("system");
    });

    var topbar = document.getElementById("topbar");
    var burger = document.getElementById("nav-burger");

    if (topbar) {
        var onScroll = function () {
            topbar.classList.toggle("nav-scrolled", window.scrollY > 16);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    function closeNav() {
        if (!topbar) return;
        topbar.classList.remove("nav-open");
        if (burger) burger.setAttribute("aria-expanded", "false");
    }

    if (burger && topbar) {
        burger.addEventListener("click", function (event) {
            event.stopPropagation();
            var open = topbar.classList.toggle("nav-open");
            burger.setAttribute("aria-expanded", String(open));
        });

        document.addEventListener("click", function (event) {
            if (topbar.classList.contains("nav-open") && !topbar.contains(event.target)) closeNav();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeNav();
        });

        topbar.querySelectorAll(".nav-link").forEach(function (link) {
            link.addEventListener("click", closeNav);
        });
    }

    var revealTargets = document.querySelectorAll(".section, .year-section");

    if ("IntersectionObserver" in window && !reducedMotion) {
        revealTargets.forEach(function (el) { el.classList.add("reveal-item"); });

        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05, rootMargin: "0px 0px -40px 0px" });

        revealTargets.forEach(function (el) { revealObserver.observe(el); });
    }

    var counters = document.querySelectorAll("[data-count-to]");

    function animateCount(el) {
        var target = parseInt(el.getAttribute("data-count-to"), 10);
        if (isNaN(target)) return;
        if (reducedMotion || target <= 0) {
            el.textContent = target.toLocaleString("en-US");
            return;
        }

        var duration = 1400;
        var start = null;

        function step(timestamp) {
            if (start === null) start = timestamp;
            var progress = Math.min((timestamp - start) / duration, 1);
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
                    if (entry.isIntersecting) {
                        animateCount(entry.target);
                        countObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.4 });

            counters.forEach(function (el) { countObserver.observe(el); });
        } else {
            counters.forEach(animateCount);
        }
    }

    var rail = document.getElementById("year-rail");
    var yearSections = document.querySelectorAll(".year-section");

    if (rail && yearSections.length && "IntersectionObserver" in window) {
        var railLinks = rail.querySelectorAll(".rail-link");

        var setActive = function (id) {
            railLinks.forEach(function (link) {
                link.classList.toggle("active", link.getAttribute("href") === "#" + id);
            });
        };

        var spyObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) setActive(entry.target.id);
            });
        }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });

        yearSections.forEach(function (section) { spyObserver.observe(section); });
        setActive(yearSections[0].id);
    }

    document.querySelectorAll("[data-dialog-target]").forEach(function (opener) {
        var dialog = document.getElementById(opener.getAttribute("data-dialog-target"));
        if (!dialog || typeof dialog.showModal !== "function") return;

        opener.addEventListener("click", function () { dialog.showModal(); });

        dialog.addEventListener("click", function (event) {
            if (event.target === dialog) dialog.close();
        });

        dialog.querySelectorAll("[data-dialog-close]").forEach(function (btn) {
            btn.addEventListener("click", function () { dialog.close(); });
        });
    });
})();
(function () {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches || !window.matchMedia("(pointer: fine)").matches) return;
    var glow = document.querySelector(".canvas-glow");
    if (!glow) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    function tick() {
        cx += (tx - cx) * 0.06;
        cy += (ty - cy) * 0.06;
        glow.style.transform = "translate3d(" + (cx * 44).toFixed(2) + "px," + (cy * 44).toFixed(2) + "px,0)";
        if (Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005) {
            raf = requestAnimationFrame(tick);
        } else { raf = null; }
    }
    window.addEventListener("pointermove", function (e) {
        tx = e.clientX / window.innerWidth - 0.5;
        ty = e.clientY / window.innerHeight - 0.5;
        if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
})();
(function () {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var sel = ".pub-item, .tool-card, .post-item, .award-card, a.post-nav-card";
    var cards = document.querySelectorAll(sel);
    if (!cards.length) return;
    cards.forEach(function (el) { el.classList.add("lq-glare"); });
    document.addEventListener("pointermove", function (e) {
        var t = e.target.closest ? e.target.closest(".lq-glare") : null;
        if (!t) return;
        var r = t.getBoundingClientRect();
        t.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        t.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
})();
