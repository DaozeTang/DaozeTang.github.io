/* =============================================================================
   PIXEL SCENE — tiny 8-bit "object detection" viewports.
   One canvas, integer-ish scaling, 8 fps, honest scanlines.
   Markup contract:
     <div class="screen"><canvas id="scene" data-scene="workshop"></canvas></div>
   Detection boxes are real DOM elements so the labels stay razor sharp.
   ============================================================================= */
(function () {
    "use strict";

    var canvas = document.getElementById("scene");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scene;
    var W = 1;
    var H = 1;
    var p = 1;
    var tick = 0;
    var raf = null;
    var last = 0;
    var visible = true;
    var current = null;

    /* --- painting helpers -------------------------------------------------- */

    function fill(color) {
        if (current !== color) {
            ctx.fillStyle = color;
            current = color;
        }
    }

    function r(x, y, w, h, color) {
        if (w <= 0 || h <= 0) return;
        fill(color);
        var x0 = Math.round(x * p);
        var y0 = Math.round(y * p);
        ctx.fillRect(x0, y0, Math.max(1, Math.round((x + w) * p) - x0), Math.max(1, Math.round((y + h) * p) - y0));
    }

    function px(x, y, color) {
        r(x, y, 1, 1, color);
    }

    function sprite(map, ox, oy, palette) {
        for (var y = 0; y < map.length; y++) {
            var row = map[y];
            for (var x = 0; x < row.length; x++) {
                var ch = row.charAt(x);
                var color = palette[ch];
                if (!color) continue;
                px(ox + x, oy + y, color);
            }
        }
    }

    function ditherRect(x, y, w, h, colorA, colorB) {
        for (var yy = 0; yy < h; yy++) {
            for (var xx = 0; xx < w; xx++) {
                px(x + xx, y + yy, ((xx + yy) % 2 === 0) ? colorA : colorB);
            }
        }
    }

    function disc(cx, cy, radius, color) {
        for (var y = -radius; y <= radius; y++) {
            for (var x = -radius; x <= radius; x++) {
                if (x * x + y * y <= radius * radius + radius * 0.6) px(cx + x, cy + y, color);
            }
        }
    }

    function ring(cx, cy, radius, color) {
        for (var y = -radius; y <= radius; y++) {
            for (var x = -radius; x <= radius; x++) {
                var d = x * x + y * y;
                if (d <= radius * radius && d > (radius - 1) * (radius - 1)) px(cx + x, cy + y, color);
            }
        }
    }

    var C = {
        ink: "#0b0d16",
        night: "#141a2e",
        navy: "#1b2238",
        slate: "#2b3352",
        haze: "#3b4568",
        mist: "#5b678e",
        paper: "#f1e7d2",
        paperShade: "#d8cba9",
        green: "#56d98b",
        greenDim: "#2f8f5c",
        greenDeep: "#173d2b",
        gold: "#ffc24b",
        goldDim: "#b07c1e",
        coral: "#ff8267",
        rust: "#c8493a",
        blue: "#8fa9ff",
        wood: "#7a5638",
        woodDark: "#4c3320",
        woodLight: "#9a7444",
        fur: "#e0b07a",
        furDark: "#b9834c",
        furPale: "#f2d3a5",
        pink: "#e8846f",
        white: "#fbf6e9"
    };

    var SCENES = {};

    /* ---------------------------------------------------------------------
       SCENE: workshop — a CRT, a mug, some books and one loafed cat.
       ------------------------------------------------------------------ */

    var LOAF = [
        "..##..........##..",
        ".#ff#........#ff#.",
        ".#fffdfffffffdff#.",
        "#ffffffffffffffff#",
        "#fkffffffffffkfff#",
        "#fffffffffffffkff#",
        "#fffffppfffffffff#",
        "#ffffffffffffkfff#",
        ".#fffffffffffkff#.",
        "..##############.."
    ];

    SCENES.workshop = {
        width: 168,
        height: 105,
        boxes: [
            { label: "CRT", conf: "0.99", x: 44, y: 18, w: 66, h: 62, side: "top" },
            { label: "CAT", conf: "1.00", x: 122, y: 62, w: 30, h: 20, side: "top" },
            { label: "MUG", conf: "0.96", x: 104, y: 62, w: 18, h: 20, side: "bottom" },
            { label: "BOOKS", conf: "0.91", x: 20, y: 58, w: 28, h: 24, side: "bottom" }
        ],
        draw: function (t) {
            /* wall */
            r(0, 0, W, 74, C.night);
            for (var band = 8; band < 74; band += 8) r(0, band, W, 3, "#171e33");
            r(0, 70, W, 4, C.navy);
            r(0, 73, W, 1, "#2a3350");

            /* window */
            r(7, 9, 44, 40, C.navy);
            r(9, 11, 40, 36, "#090f22");
            disc(38, 19, 5, "#f3e7c7");
            px(36, 17, "#d8cba9"); px(37, 18, "#d8cba9"); px(38, 18, "#d8cba9"); px(39, 17, "#d8cba9");
            var stars = [[13, 16], [17, 24], [21, 14], [25, 30], [31, 40], [44, 30], [18, 38], [12, 42], [42, 14]];
            for (var s = 0; s < stars.length; s++) {
                if ((t + s * 2) % 9 < 7) px(stars[s][0], stars[s][1], s % 3 === 0 ? C.paper : C.mist);
            }
            r(9, 28, 40, 1, "#1a2340");
            r(28, 11, 1, 36, "#1a2340");
            r(7, 9, 44, 2, "#31395c");
            r(7, 47, 44, 2, "#31395c");
            r(7, 9, 2, 40, "#31395c");
            r(49, 9, 2, 40, "#31395c");
            r(6, 49, 46, 2, "#242c47");

            /* poster: the paper-on-the-wall */
            r(112, 11, 40, 36, "#232a44");
            r(114, 13, 36, 32, C.paper);
            r(118, 17, 20, 2, C.ink);
            r(118, 22, 26, 1, "#9a968f");
            r(118, 26, 24, 1, "#9a968f");
            r(118, 30, 27, 1, "#9a968f");
            r(118, 34, 15, 1, "#9a968f");
            r(140, 17, 6, 6, C.greenDim);
            r(141, 18, 4, 4, C.green);
            r(118, 38, 30, 2, C.rust);
            r(118, 41, 12, 1, "#9a968f");

            /* desk */
            r(0, 74, W, 12, C.wood);
            r(0, 74, W, 2, C.woodLight);
            r(0, 80, W, 1, "#6a4a2e");
            r(0, 86, W, 19, C.woodDark);
            r(0, 86, W, 1, "#3a2616");
            r(12, 92, 30, 1, "#432c1a");
            r(128, 92, 30, 1, "#432c1a");

            /* monitor */
            r(44, 18, 66, 58, "#262d47");
            r(46, 20, 62, 50, "#151a2d");
            r(48, 22, 58, 44, C.ink);
            r(44, 18, 66, 2, "#3a436b");
            r(44, 74, 66, 2, "#1b2136");

            /* screen content */
            var code = [
                [6, 3], [16, 5], [10, 2], [24, 6], [14, 3],
                [20, 7], [9, 2], [18, 5], [12, 6], [22, 4], [8, 2]
            ];
            for (var i = 0; i < code.length; i++) {
                var ly = 26 + i * 4;
                if (ly > 60) break;
                r(52, ly, code[i][0], 1, i % 5 === 0 ? C.green : (i % 3 === 0 ? "#3f7d63" : C.greenDim));
                if (i % 3 === 1) r(52 + code[i][0] + 2, ly, code[i][1], 1, "#315a49");
            }
            if (Math.floor(t / 3) % 2 === 0) r(52, 62, 3, 2, C.green);
            px(105, 24, t % 6 < 3 ? C.green : C.greenDeep);
            px(102, 24, C.goldDim);

            /* stand */
            r(70, 76, 14, 4, "#262d47");
            r(62, 80, 30, 3, "#2f3757");

            /* keyboard */
            r(50, 83, 52, 8, "#1d2236");
            r(51, 84, 50, 6, "#2b3352");
            for (var k = 0; k < 16; k++) r(53 + k * 3, 85, 2, 1, "#3b4568");
            for (var k2 = 0; k2 < 15; k2++) r(54 + k2 * 3, 87, 2, 1, "#3b4568");

            /* desk plant */
            r(4, 68, 14, 6, "#8d6b4a");
            r(5, 68, 12, 2, "#a9825a");
            var sway = t % 8 < 4 ? 0 : 1;
            r(9 + sway, 58, 2, 10, C.greenDim);
            r(14, 60, 2, 8, C.greenDim);
            r(9 + sway, 56, 7, 3, C.green);
            r(6, 60, 4, 2, C.greenDim);
            r(15, 62, 4, 2, C.greenDim);
            r(11, 54, 3, 2, "#6fe3a1");

            /* books */
            r(20, 70, 26, 4, C.rust);
            r(21, 71, 24, 2, "#e0654f");
            r(22, 66, 22, 4, C.blue);
            r(23, 67, 20, 1, "#a9bcff");
            r(24, 62, 18, 4, C.gold);
            r(25, 63, 16, 1, "#ffe08a");

            /* mug */
            r(104, 66, 14, 8, C.paperShade);
            r(105, 67, 12, 6, C.paper);
            r(105, 67, 12, 2, C.white);
            r(117, 68, 2, 4, C.paperShade);
            r(116, 69, 1, 2, C.paper);
            r(107, 69, 4, 2, C.green);
            for (var st = 0; st < 3; st++) {
                var sy = 65 - ((t + st * 3) % 10);
                px(107 + (st === 1 ? 5 : 1) + ((t + st) % 2), sy, "#7d86a6");
            }

            /* cat loaf */
            sprite(LOAF, 122, 66, {
                "#": "#5d3d22",
                "f": C.fur,
                "d": C.furDark,
                "k": "#2a1d12",
                "p": C.pink
            });

            /* floor shadow */
            ditherRect(0, 86, W, 5, "#4c3320", "#452e1c");
        }
    };

    /* ---------------------------------------------------------------------
       SCENE: horizon — sunset, farmland, one drone, one sitter.
       ------------------------------------------------------------------ */

    var SITTER = [
        "..####....",
        ".#ffff#...",
        ".#fkkf#...",
        ".#ffff#...",
        ".#fwwf#...",
        "##ffff##..",
        "#wwwwww#..",
        "#wwwwww#..",
        "#wwddww#..",
        ".##..##...",
        ".#....#...",
        ".........."
    ];

    var TINY_CAT = [
        ".#....#.",
        ".#ffff#.",
        "#ffffff#",
        "#f#ff#f#",
        "#ffffff#",
        ".######."
    ];

    var DRONE = [
        "..#...#..",
        ".#.....#.",
        "###.#.###",
        "..#.#.#..",
        "...#.#..."
    ];

    SCENES.horizon = {
        width: 320,
        height: 80,
        boxes: [
            { label: "PERSON", conf: "0.97", x: 92, y: 42, w: 18, h: 22, side: "bottom" },
            { label: "CAT", conf: "0.99", x: 112, y: 52, w: 12, h: 9, side: "bottom" },
            { label: "DRONE", conf: "0.93", x: 194, y: 12, w: 20, h: 14, side: "top" },
            { label: "BARN", conf: "0.88", x: 44, y: 38, w: 30, h: 20, side: "top" }
        ],
        draw: function (t) {
            var bands = [
                { h: 9, a: "#0e1430", b: "#131a3a" },
                { h: 9, a: "#131a3a", b: "#1a2148" },
                { h: 9, a: "#1a2148", b: "#272a58" },
                { h: 9, a: "#272a58", b: "#3b3162" },
                { h: 9, a: "#3b3162", b: "#5a3a61" },
                { h: 9, a: "#5a3a61", b: "#85485c" },
                { h: 9, a: "#85485c", b: "#ae5b52" },
                { h: 9, a: "#ae5b52", b: "#d1744d" }
            ];
            var y = 0;
            bands.forEach(function (band) {
                r(0, y, W, band.h, band.a);
                ditherRect(0, y + band.h - 2, W, 2, band.a, band.b);
                y += band.h;
            });

            for (var i = 0; i < 30; i++) {
                var sx = (i * 67 + 17) % W;
                var sy = (i * 31 + 3) % 30;
                if ((t * 0.5 + i) % 10 < 7) px(sx, sy, i % 4 === 0 ? C.paper : "#8f8fae");
            }

            disc(248, 34, 11, "#f3bd58");
            disc(248, 34, 8, "#ffd98b");
            ring(248, 34, 14, "#d99a4a");
            for (var ray = 0; ray < 10; ray++) {
                var angle = (ray / 10) * Math.PI * 2;
                var rx = 248 + Math.round(Math.cos(angle) * 18);
                var ry = 34 + Math.round(Math.sin(angle) * 18);
                if ((t + ray) % 7 < 4) px(rx, ry, "#e8b45f");
            }

            var clouds = [[-28, 18, 38], [64, 8, 30], [150, 24, 34], [246, 12, 26]];
            clouds.forEach(function (cloud, index) {
                var cx = Math.round(((cloud[0] + t * (0.7 + index * 0.25)) % (W + 76) + W + 76) % (W + 76)) - 34;
                var cy = cloud[1];
                var cw = cloud[2];
                r(cx + Math.round(cw * 0.20), cy, Math.round(cw * 0.58), 2, "#4c3569");
                r(cx + Math.round(cw * 0.08), cy + 2, Math.round(cw * 0.84), 2, "#573d74");
                r(cx, cy + 4, cw, 3, "#62447f");
                r(cx + Math.round(cw * 0.10), cy + 7, Math.round(cw * 0.80), 2, "#4a3468");
                r(cx + Math.round(cw * 0.30), cy + 1, Math.round(cw * 0.36), 2, "#7d5a9d");
                r(cx + Math.round(cw * 0.16), cy + 5, Math.round(cw * 0.30), 1, "#7a559a");
            });

            for (var hx = 0; hx < W; hx++) {
                var h1 = 46 + Math.round(Math.sin(hx / 36) * 4) + Math.round(Math.sin(hx / 12) * 1);
                r(hx, h1, 1, 80 - h1, "#221b3a");
                var h2 = 52 + Math.round(Math.sin(hx / 24 + 2.2) * 3);
                r(hx, h2, 1, 80 - h2, "#182631");
            }

            /* barn */
            r(52, 46, 24, 14, "#3a2b33");
            r(52, 46, 24, 2, "#58414c");
            r(50, 44, 28, 3, "#241d24");
            r(56, 50, 6, 10, "#1d2029");
            r(65, 50, 5, 5, "#f0c061");
            r(65, 55, 5, 5, "#262b38");
            r(59, 40, 10, 4, "#4a3340");
            r(60, 38, 8, 2, "#5c3f4c");
            r(62, 41, 4, 1, "#f0c061");

            /* fields: ploughed furrows getting wider toward the viewer */
            r(0, 57, W, 23, "#1d3a32");
            for (var fy = 57; fy < 80; fy++) {
                var depth = (fy - 57) / 23;
                if (fy % 3 === 0) r(0, fy, W, 1, depth > 0.55 ? "#33553f" : "#2a4b3c");
                if (fy % 3 === 2 && depth > 0.45) r(0, fy, W, 1, "#244233");
            }
            ditherRect(0, 57, W, 3, "#1d3a32", "#2a4b3c");
            for (var cx2 = -14; cx2 < W + 14; cx2 += 24) {
                r(cx2 + 4, 66, 13, 1, "#17342b");
                r(cx2 + 2, 71, 16, 1, "#17342b");
                r(cx2 + 6, 76, 12, 1, "#122b23");
            }
            ditherRect(0, 76, W, 4, "#122b23", "#0f241d");

            /* fence */
            for (var fx = 4; fx < W; fx += 16) {
                r(fx, 60, 1, 6, "#20262f");
                r(fx, 62, 16, 1, "#20262f");
            }

            /* sitter + cat */
            sprite(SITTER, 96, 42, {
                "#": "#111827", "f": C.fur, "k": "#1c140d", "w": "#d9cdb6", "d": C.furDark
            });
            sprite(TINY_CAT, 114, 52, { "#": "#111827", "f": C.furDark });
            r(93, 56, 11, 1, "#2b3352");
            if (t % 4 < 3) r(96, 54, 2, 1, C.green);

            /* drone */
            var dy = 18 + (t % 8 < 4 ? 0 : -1);
            sprite(DRONE, 201, dy, { "#": "#1d2236" });
            if (Math.floor(t / 2) % 2 === 0) px(209, dy + 4, C.coral);
            r(202, dy - 2, 6, 1, "#3b4568");
            r(200, dy + 2, 1, 2, "#3b4568");
            r(209, dy + 2, 1, 2, "#3b4568");

            /* foreground grass fringe */
            for (var g = 0; g < W; g++) {
                var gh = ((g * 13 + 5) % 4) + 1;
                r(g, 80 - gh, 1, gh, g % 3 === 0 ? "#0f241d" : "#0b1d18");
            }
            r(0, 79, W, 1, "#0b1d18");
        }
    };

    /* --- scene selection (definitions exist from here on) ------------------ */

    scene = SCENES[canvas.dataset.scene] || SCENES.workshop;
    W = scene.width;
    H = scene.height;

    /* --- responsive scaling ------------------------------------------------ */

    function resize() {
        var rect = canvas.getBoundingClientRect();
        var cssW = rect.width || 480;
        var cssH = rect.height || (cssW * H / W);
        p = cssW / W;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(cssW * dpr));
        canvas.height = Math.max(1, Math.round(cssH * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        current = null;
        draw();
    }

    function draw() {
        current = null;
        scene.draw(tick);
    }

    /* --- overlay boxes ----------------------------------------------------- */

    function buildOverlay() {
        var host = canvas.parentElement;
        if (!host || host.querySelector(".det-layer")) return;
        var layer = document.createElement("div");
        layer.className = "det-layer";
        layer.setAttribute("aria-hidden", "true");
        var scan = document.createElement("div");
        scan.className = "det-scan";
        layer.appendChild(scan);
        scene.boxes.forEach(function (box, index) {
            var el = document.createElement("div");
            el.className = "det det--" + (box.side || "top");
            el.style.setProperty("--x", (box.x / W) * 100);
            el.style.setProperty("--y", (box.y / H) * 100);
            el.style.setProperty("--w", (box.w / W) * 100);
            el.style.setProperty("--h", (box.h / H) * 100);
            el.style.animationDelay = (index * 140) + "ms";
            var tag = document.createElement("span");
            tag.className = "det__tag";
            tag.textContent = box.label + " " + box.conf;
            el.appendChild(tag);
            layer.appendChild(el);
        });
        host.appendChild(layer);
    }

    /* --- loop -------------------------------------------------------------- */

    function loop(now) {
        raf = null;
        if (!visible) return;
        if (!last) last = now;
        if (now - last >= 125) {
            last = now;
            tick += 1;
            draw();
        }
        raf = window.requestAnimationFrame(loop);
    }

    function start() {
        if (raf || reduced) return;
        last = 0;
        raf = window.requestAnimationFrame(loop);
    }

    function stop() {
        if (raf) window.cancelAnimationFrame(raf);
        raf = null;
    }

    if ("ResizeObserver" in window) {
        new ResizeObserver(function () { resize(); }).observe(canvas.parentElement);
    } else {
        window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                visible = entry.isIntersecting;
                if (visible) start();
                else stop();
            });
        }, { threshold: 0.05 }).observe(canvas);
    }

    resize();
    draw();
    buildOverlay();
    if (!reduced) start();
})();
