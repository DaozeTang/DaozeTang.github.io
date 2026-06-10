(function () {
    "use strict";

    var root = document.documentElement;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    
    var themeToggle = document.getElementById("theme-toggle");
    var THEME_COLORS = { light: "#f7f4ec", dark: "#14120e" };

    function syncToggle() {
        if (!themeToggle) return;
        var isDark = root.getAttribute("data-theme") === "dark";
        var icon = themeToggle.querySelector("i");
        if (icon) icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
        themeToggle.setAttribute("aria-pressed", String(isDark));
        themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            try { localStorage.setItem("theme", next); } catch (e) {  }
            root.setAttribute("data-theme", next);

            var meta = document.getElementById("meta-theme-color");
            if (meta) meta.setAttribute("content", THEME_COLORS[next]);

            syncToggle();
        });
        syncToggle();
    }

    
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
