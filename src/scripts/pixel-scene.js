/* =============================================================================
   AERIAL SCENE — a tiny remote-sensing viewport.
   Three hand-composed orthomosaics (hero field, blog station, wide transect)
   painted on one canvas at 8 fps in a false-colour palette, with real DOM
   detection boxes and a scene-space reticle.
   Markup contract:
     <div class="plate js-plate">
       <canvas id="scene" data-scene="field"></canvas>
       <span class="plate__cursor" aria-hidden="true"></span>
       <span data-readout></span>
     </div>
   ============================================================================= */
(function () {
    "use strict";

    /* One independent painter per <canvas data-scene>, so a page can carry the
       hero plate and the transect strip at the same time. */
    function boot(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reduced = motionQuery.matches;
    var W = 1;
    var H = 1;
    var sx = 1;
    var sy = 1;
    var tick = 0;
    var raf = null;
    var last = 0;
    var visible = true;
    var current = null;
    var scene = null;

    /* --- painting helpers -------------------------------------------------- */

    function fill(color) {
        if (current !== color) {
            ctx.fillStyle = color;
            current = color;
        }
    }

    function r(x, y, w, h, color) {
        if (w <= 0 || h <= 0 || !color) return;
        fill(color);
        var x0 = Math.round(x * sx);
        var y0 = Math.round(y * sy);
        ctx.fillRect(x0, y0, Math.max(1, Math.round((x + w) * sx) - x0), Math.max(1, Math.round((y + h) * sy) - y0));
    }

    function px(x, y, color) {
        r(x, y, 1, 1, color);
    }

    function lineH(x, y, w, color) {
        r(x, y, w, 1, color);
    }

    function lineV(x, y, h, color) {
        r(x, y, 1, h, color);
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

    /* Deterministic pseudo-random so a repaint never flickers. */
    function rnd(seed) {
        var a = seed | 0;
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function speckle(x, y, w, h, color, seed, count) {
        for (var i = 0; i < count; i++) {
            var ex = x + Math.floor(rnd(seed + i * 13) * w);
            var ey = y + Math.floor(rnd(seed + i * 29 + 7) * h);
            px(ex, ey, color);
        }
    }

    /* Furrowed crop rows: 1px row lines on a pitch, with a lit leading edge. */
    function furrow(x, y, w, h, base, row, pitch, phase) {
        r(x, y, w, h, base);
        for (var yy = 0; yy < h; yy += pitch) {
            lineH(x, y + yy + (phase || 0), w, row);
        }
    }

    function furrowV(x, y, w, h, base, row, pitch, phase) {
        r(x, y, w, h, base);
        for (var xx = 0; xx < w; xx += pitch) {
            lineV(x + xx + (phase || 0), y, h, row);
        }
    }

    /* A soft cloud shadow: stacked dithered ellipses, no blur. */
    function cloudShadow(cx, cy, rx, ry, color, alpha) {
        ctx.globalAlpha = alpha;
        for (var y = -ry; y <= ry; y++) {
            var span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
            for (var x = -span; x <= span; x++) {
                if (((x + y) & 1) === 0) px(cx + x, cy + y, color);
            }
        }
        ctx.globalAlpha = 1;
    }

    /* Orthomosaic tile seams + registration crosses. Drawn last, very quiet. */
    function seams(tw, th, W2, H2) {
        ctx.globalAlpha = 0.55;
        for (var x = tw; x < W2; x += tw) lineV(x, 0, H2, "rgba(0,0,0,0.55)");
        for (var y = th; y < H2; y += th) lineH(0, y, W2, "rgba(0,0,0,0.55)");
        ctx.globalAlpha = 1;
        ctx.globalAlpha = 0.5;
        for (var cx = 0; cx <= W2; cx += tw) {
            for (var cy = 0; cy <= H2; cy += th) {
                if (cx === 0 || cy === 0) continue;
                px(cx, cy, "#e9f3e6");
            }
        }
        ctx.globalAlpha = 1;
    }

    var C = {
        void: "#04090a",
        ink: "#06100c",
        paper: "#e9f3e6",
        soilDeep: "#26131b",
        soil: "#3a1c27",
        soilLit: "#552833",
        rowSoil: "#6e3541",
        cropDeep: "#0c2517",
        crop: "#173f26",
        cropLit: "#2b7038",
        cropHi: "#7fd24a",
        cropMax: "#b9f05c",
        olive: "#2b3716",
        oliveLit: "#4a5a21",
        road: "#333a34",
        roadLit: "#4b554c",
        roadEdge: "#1b211d",
        waterDeep: "#072733",
        water: "#0a3a4a",
        waterLit: "#12657e",
        waterHi: "#4fd0e0",
        roof: "#c6d0c2",
        roofShade: "#7d8b80",
        gh: "#9fe4dd",
        ghHi: "#e0fbf5",
        treeDark: "#06170d",
        tree: "#0f3a20",
        treeLit: "#2c7a3d",
        glow: "#ffb454",
        panel: "#123246",
        panelLit: "#2a6f92"
    };

    /* ---------------------------------------------------------------------
       FIELD — the homepage plate. A false-colour farm survey in late light:
       furrowed plots, a canal, a farmstead with greenhouses, and a tractor
       crawling along the track while the tracker keeps hold of it.
       ------------------------------------------------------------------ */

    var SCENES = {};

    /* Large-scale helpers: a plot is a flat field with a few wide furrows and
       sparse stipple. Dense texture at 1px pitch reads as noise, not crops. */
    function hatchH(x, y, w, h, color, pitch, offset) {
        for (var yy = y + (offset || 0); yy < y + h; yy += pitch) lineH(x, yy, w, color);
    }

    function hatchV(x, y, w, h, color, pitch, offset) {
        for (var xx = x + (offset || 0); xx < x + w; xx += pitch) lineV(xx, y, h, color);
    }

    function vignette() {
        ctx.globalAlpha = 0.35;
        for (var i = 0; i < 6; i++) {
            r(0, i, W, 1, "#02060a");
            r(0, H - 1 - i, W, 1, "#02060a");
            r(i, 0, 1, H, "#02060a");
            r(W - 1 - i, 0, 1, H, "#02060a");
        }
        ctx.globalAlpha = 1;
    }

    /* ---------------------------------------------------------------------
       FIELD — the homepage plate. A false-colour farm survey in late light:
       big quiet plots, one canal, a farmstead with greenhouses, and a tractor
       crawling along the track while the tracker keeps hold of it.
       ------------------------------------------------------------------ */

    SCENES.field = {
        width: 320,
        height: 150,
        boxes: function (t) {
            var tractorX = 14 + Math.floor(((t * 0.7) % 150));
            /* Boxes are the object's own pixels in scene units — cast shadows
               and the extruded dark side stay outside:
                 barn roof      170, 82, 46 x 22
                 greenhouses    254, 74, 64 wide, three 7px strips on an 11px
                                pitch (last lit row at y102, so 29 tall)
                 tractor        body from x, cab at x+8, light at x+13, 60..67
                 surveyor       head + jacket 45..47, y58..64 */
            return [
                { label: "BARN", conf: "0.94", x: 170, y: 82, w: 46, h: 22, side: "top" },
                { label: "GREENHOUSE", conf: "0.88", x: 254, y: 74, w: 64, h: 29, side: "bottom" },
                { label: "TRACTOR", conf: "0.91", x: tractorX, y: 60, w: 14, h: 8, side: "top" },
                { label: "SURVEYOR", conf: "0.79", x: 44, y: 57, w: 5, h: 9, side: "bottom" }
            ];
        },
        draw: function (t) {
            r(0, 0, W, H, C.void);
            /* Underlay terrain: any unpainted margin reads as a dark field,
               never as a hole in the plate. */
            r(0, 0, W, 56, C.cropDeep);
            r(0, 72, W, 78, C.olive);

            /* ---- upper fields ------------------------------------------- */
            r(0, 0, 112, 54, C.cropDeep);
            hatchH(0, 0, 112, 54, "rgba(43,112,56,0.5)", 7, 2);
            speckle(2, 3, 106, 46, C.cropLit, 5, 34);
            speckle(2, 3, 106, 46, C.cropHi, 9, 14);
            r(0, 51, 112, 3, C.treeDark);

            r(118, 0, 78, 54, C.crop);
            hatchV(118, 0, 78, 54, "rgba(185,240,92,0.38)", 8, 3);
            speckle(120, 2, 74, 48, C.cropMax, 17, 26);

            r(202, 0, 118, 54, C.soil);
            hatchH(202, 0, 118, 54, "rgba(110,53,65,0.55)", 9, 3);
            speckle(204, 2, 114, 48, C.soilLit, 23, 30);
            speckle(204, 2, 114, 48, C.rowSoil, 29, 18);

            /* canal between the west plots and the soil */
            r(112, 0, 8, 56, C.waterDeep);
            r(114, 0, 5, 56, C.water);
            lineV(114, 0, 56, C.waterLit);
            speckle(114, 2, 4, 52, C.waterHi, 37, 12);
            lineV(112, 0, 56, C.ink);
            lineV(119, 0, 56, C.ink);

            /* ---- farm track --------------------------------------------- */
            r(0, 56, W, 16, C.road);
            lineH(0, 56, W, C.roadEdge);
            lineH(0, 71, W, C.roadEdge);
            hatchH(0, 58, W, 12, "rgba(75,85,76,0.55)", 4, 1);
            for (var dash = 0; dash < W; dash += 28) lineH(dash + 6, 63, 14, "#7d8779");
            lineV(112, 56, 16, C.roadEdge);

            /* ---- lower fields ------------------------------------------- */
            r(0, 72, 104, 78, C.olive);
            hatchH(0, 72, 104, 78, C.oliveLit, 11, 3);
            speckle(2, 74, 100, 74, C.cropLit, 41, 26);
            r(0, 72, 104, 2, C.roadEdge);
            r(102, 72, 2, 78, C.roadEdge);

            /* pond: an irregular shoreline, not a window */
            disc(122, 126, 17, "#2b211b");
            disc(140, 132, 14, "#2b211b");
            disc(122, 126, 15, C.waterDeep);
            disc(140, 132, 12, C.waterDeep);
            disc(122, 126, 12, C.water);
            disc(140, 132, 10, C.water);
            speckle(110, 114, 42, 32, C.waterLit, 43, 26);
            speckle(112, 116, 38, 28, C.waterHi, 45, 10);
            px(118, 118, C.waterHi);
            px(134, 126, C.waterHi);
            px(128, 140, C.waterHi);

            /* farmstead yard */
            r(162, 76, 94, 44, C.roadEdge);
            r(164, 78, 90, 40, C.road);
            hatchH(166, 80, 86, 36, "rgba(75,85,76,0.4)", 6, 2);

            /* barn + silo + truck */
            r(176, 94, 46, 6, "#0a0f0c");
            r(172, 84, 46, 24, C.roofShade);
            r(170, 82, 46, 22, C.roof);
            lineH(170, 82, 46, C.paper);
            lineH(170, 92, 46, C.roofShade);
            lineV(193, 82, 22, C.roofShade);
            r(180, 98, 9, 4, C.cropDeep);
            disc(228, 98, 7, "#0a0f0c");
            disc(226, 96, 6, C.roof);
            ring(226, 96, 6, C.roofShade);
            disc(226, 96, 2, C.roofShade);
            r(236, 106, 15, 7, C.paper);
            r(238, 107, 8, 4, C.roofShade);
            r(247, 104, 4, 5, C.paper);
            lineH(236, 113, 15, C.ink);

            /* greenhouses: three lit ridges */
            for (var g = 0; g < 3; g++) {
                var gy = 74 + g * 11;
                r(254, gy + 2, 64, 8, "#0a0f0c");
                r(254, gy, 64, 7, C.gh);
                lineH(254, gy, 64, C.ghHi);
                lineH(254, gy + 6, 64, C.roofShade);
                lineV(286, gy, 7, C.roofShade);
            }

            /* orchard */
            r(254, 110, 64, 40, C.cropDeep);
            for (var oy = 114; oy < 150; oy += 8) {
                for (var ox = 258; ox < 318; ox += 8) {
                    r(ox, oy + 1, 3, 2, "#04120a");
                    r(ox, oy, 3, 2, C.tree);
                    px(ox + 1, oy - 1, C.treeLit);
                }
            }

            /* tree lines along the field margins — the signature of an
               aerial farm frame */
            for (var tl = 0; tl < W; tl += 6) {
                if (tl < 100 || (tl > 120 && tl < 200)) {
                    px(tl, 0, C.treeDark);
                    px(tl + 2, 0, C.tree);
                }
                if (tl > 200) {
                    px(tl, 55, C.treeDark);
                    px(tl + 2, 55, C.tree);
                }
            }
            for (var tv = 108; tv < 150; tv += 8) {
                px(104, tv, C.treeDark);
                px(104, tv + 2, C.tree);
            }

            /* hedgerow along the track */
            for (var hx = 0; hx < W; hx += 5) {
                if (hx < 104 || hx > 202) {
                    r(hx, 53, 3, 3, C.treeDark);
                    px(hx + 1, 52, C.tree);
                }
            }

            /* surveyor on the track, high-vis jacket */
            r(44, 65, 6, 3, "#0a0f0c");
            r(45, 60, 3, 5, "#e8dc8a");
            r(45, 58, 3, 2, C.glow);
            px(48, 63, C.paper);

            /* tractor: a lit box moving east along the track */
            var tractorX = 14 + Math.floor(((t * 0.7) % 150));
            r(tractorX, 62, 3, 3, "#6a5a2a");
            r(tractorX - 1, 60, 14, 8, "#0a0f0c");
            r(tractorX, 61, 11, 6, "#d8b93f");
            r(tractorX + 8, 60, 4, 4, "#e8dc8a");
            r(tractorX + 1, 64, 3, 2, "#0a0f0c");
            r(tractorX + 7, 64, 3, 2, "#0a0f0c");
            px(tractorX + 13, 63, C.glow);
            if ((t % 4) < 2) {
                px(tractorX - 3, 66, C.roadLit);
                px(tractorX - 5, 65, C.roadLit);
            }

            /* cloud shadows crossing the survey */
            var drift = (t * 1.2) % (W + 180);
            cloudShadow(Math.floor(drift) - 50, 30, 40, 22, "#020806", 0.28);
            cloudShadow(Math.floor(drift * 0.6) + 170, 108, 46, 24, "#020806", 0.24);
            cloudShadow(W - Math.floor(drift * 0.4), 66, 30, 14, "#020806", 0.2);

            /* sensor sweep */
            var scanY = Math.floor((t * 4) % (H + 24)) - 12;
            ctx.globalAlpha = 0.25;
            lineH(0, scanY, W, C.cropMax);
            ctx.globalAlpha = 1;

            seams(80, 75, W, H);
            vignette();
        }
    };

    /* ---------------------------------------------------------------------
       STATION — the blog cover. A field station at night seen from above:
       warm skylights, a dish, a solar array, one cat on the gravel.
       ------------------------------------------------------------------ */

    SCENES.station = {
        width: 200,
        height: 140,
        boxes: function () {
            /* Measured from the drawing: roof 74,50 50x34 over the dark body
               80,62 48x30, so 74..127 x 50..91; dish disc radius 11 at 140,54
               spans 129..151 x 43..65; solar cells start at 56,92 and the last
               cell's right edge is 106; the cat is 110..116 x 87..93. */
            return [
                { label: "STATION", conf: "0.97", x: 74, y: 50, w: 54, h: 42, side: "top" },
                { label: "DISH", conf: "0.9", x: 129, y: 43, w: 23, h: 23, side: "bottom" },
                { label: "PV ARRAY", conf: "0.86", x: 56, y: 92, w: 51, h: 19, side: "bottom" },
                { label: "CAT", conf: "0.99", x: 110, y: 87, w: 7, h: 7, side: "top" }
            ];
        },
        draw: function (t) {
            r(0, 0, W, H, C.cropDeep);

            /* surrounding crops, night tones */
            r(0, 0, 54, H, C.olive);
            hatchV(0, 0, 54, H, "rgba(74,90,33,0.8)", 9, 3);
            speckle(2, 2, 50, H - 4, C.cropLit, 81, 30);

            r(146, 0, 54, H, C.crop);
            hatchV(146, 0, 54, H, "rgba(43,112,56,0.55)", 9, 2);
            speckle(148, 2, 50, H - 4, C.cropHi, 83, 26);

            /* compound gravel */
            r(42, 30, 118, 92, C.roadEdge);
            r(44, 32, 114, 88, C.road);
            hatchH(46, 34, 110, 84, "rgba(75,85,76,0.35)", 8, 2);
            speckle(46, 34, 110, 84, C.roadLit, 87, 60);

            /* lane to the north edge */
            r(148, 4, 12, 30, C.road);
            lineV(148, 4, 30, C.roadEdge);
            lineV(159, 4, 30, C.roadEdge);

            /* main building: warm skylights are the only bright thing */
            r(80, 62, 48, 30, "#0a0f0c");
            r(74, 50, 50, 34, "#213239");
            lineH(74, 50, 50, C.roofShade);
            lineH(74, 83, 50, "#0a0f0c");
            r(78, 57, 16, 6, C.glow);
            r(98, 57, 10, 6, "#ffd08a");
            lineH(78, 64, 30, "#7a4a18");
            r(78, 70, 12, 5, C.glow);
            r(94, 70, 14, 5, "#c98125");
            r(106, 52, 12, 7, C.roofShade);
            lineH(106, 52, 12, C.roof);
            disc(114, 76, 3, C.roofShade);

            /* dish */
            disc(140, 54, 11, "#0a0f0c");
            disc(139, 53, 10, C.roof);
            ring(139, 53, 10, C.ink);
            lineV(139, 45, 16, C.roofShade);
            lineH(131, 53, 16, C.roofShade);
            disc(139, 53, 3, C.ink);
            disc(139, 53, 1, C.paper);

            /* solar array */
            r(56, 92, 48, 18, "#0a0f0c");
            for (var py = 0; py < 5; py++) {
                for (var px2 = 0; px2 < 12; px2++) {
                    r(58 + px2 * 4, 94 + py * 3, 3, 2, ((px2 + py) % 4 === 0) ? C.panelLit : C.panel);
                }
            }
            lineH(56, 92, 48, C.waterHi);

            /* truck */
            r(154, 90, 18, 9, "#0a0f0c");
            r(152, 86, 18, 8, C.roof);
            r(156, 88, 9, 5, C.waterDeep);
            r(166, 88, 3, 5, "#ffcf8a");

            /* pond */
            disc(22, 104, 16, "#0a0f0c");
            disc(22, 104, 15, C.waterDeep);
            disc(22, 104, 12, C.water);
            speckle(12, 94, 20, 20, C.waterLit, 89, 18);
            for (var wy = 96; wy < 114; wy += 5) lineH(16 + (wy % 4), wy, 12, C.waterHi);

            /* cat on the warm gravel */
            r(110, 90, 6, 3, "#0a0f0c");
            r(110, 88, 5, 3, "#e0b07a");
            r(113, 87, 2, 2, "#f2d3a5");
            px(110, 91, "#f2d3a5");

            /* beacon on the dish mast */
            px(139, 43, (Math.floor(t / 2) % 2 === 0) ? C.coral : C.ink);
            px(139, 44, C.paper);

            /* trees at the compound edge */
            for (var tree = 0; tree < 6; tree++) {
                var tx2 = 48 + tree * 23;
                r(tx2, 26, 5, 4, "#04120a");
                r(tx2, 25, 5, 3, C.tree);
                px(tx2 + 2, 24, C.treeLit);
            }

            var drift = (t * 0.8) % 280;
            cloudShadow(Math.floor(drift) - 50, 20, 34, 16, "#020806", 0.24);
            cloudShadow(200 - Math.floor(drift * 0.7), 116, 28, 14, "#020806", 0.2);

            seams(100, 70, W, H);
            vignette();
        }
    };

    /* --- scene selection (definitions exist from here on) ------------------ */

    scene = SCENES[canvas.dataset.scene] || SCENES.field;
    W = scene.width;
    H = scene.height;

    /* ---------------------------------------------------------------------
       Resize: keep the art on integer-ish device pixels in both axes.
       ------------------------------------------------------------------ */

    var lastDpr = 0;
    var host = canvas.parentElement;

    function resize() {
        var rect = canvas.getBoundingClientRect();
        var cssW = rect.width || 480;
        var cssH = rect.height || (cssW * H / W);
        sx = cssW / W;
        sy = cssH / H;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        lastDpr = dpr;
        canvas.width = Math.max(1, Math.round(cssW * dpr));
        canvas.height = Math.max(1, Math.round(cssH * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        current = null;
        if (host) {
            var layer = host.querySelector(".det-layer");
            if (layer) layer.style.setProperty("--scan-span", cssH + "px");
        }
        draw();
    }

    function draw() {
        current = null;
        scene.draw(tick);
    }

    /* ---------------------------------------------------------------------
       Detection overlay: static boxes are built once; truck boxes move.
       ------------------------------------------------------------------ */

    var layer = null;
    var detEls = [];

    function boxList() {
        return scene.boxes(tick) || [];
    }

    function place(el, box) {
        el.style.setProperty("--x", (box.x / W) * 100);
        el.style.setProperty("--y", (box.y / H) * 100);
        el.style.setProperty("--w", (box.w / W) * 100);
        el.style.setProperty("--h", (box.h / H) * 100);
    }

    function buildOverlay() {
        if (!host || host.querySelector(".det-layer")) return;
        layer = document.createElement("div");
        layer.className = "det-layer";
        layer.setAttribute("aria-hidden", "true");
        var scan = document.createElement("div");
        scan.className = "det-scan";
        layer.appendChild(scan);

        boxList().forEach(function (box, index) {
            var el = document.createElement("div");
            el.className = "det det--" + (box.side || "top");
            /* Tiny targets get shorter corner arms so the frame still reads as
               an annotation instead of swallowing a 5px-wide object. */
            if (box.w <= 8) el.classList.add("det--tiny");
            place(el, box);
            el.style.animationDelay = (index * 120) + "ms";
            var tag = document.createElement("span");
            tag.className = "det__tag";
            var tagLabel = document.createElement("span");
            tagLabel.className = "det__label";
            tagLabel.textContent = box.label;
            var tagConf = document.createElement("span");
            tagConf.className = "det__conf";
            tagConf.textContent = box.conf;
            tag.appendChild(tagLabel);
            tag.appendChild(tagConf);
            el.appendChild(tag);
            layer.appendChild(el);
            detEls.push(el);
        });
        host.appendChild(layer);
    }

    function syncOverlay() {
        if (!detEls.length) return;
        var boxes = boxList();
        for (var i = 0; i < detEls.length && i < boxes.length; i++) place(detEls[i], boxes[i]);
    }

    /* ---------------------------------------------------------------------
       Reticle: snap to scene pixels, report coordinates and the box under it.
       ------------------------------------------------------------------ */

    var plate = canvas.closest(".js-plate");
    var cursor = plate && plate.querySelector(".plate__cursor");
    var readout = plate && plate.querySelector("[data-readout]");
    var canHover = window.matchMedia("(hover: hover)").matches;
    if (plate && cursor && canHover) {
        var queued = false;
        var mx = W / 2;
        var my = H / 2;
        var paint = function () {
            queued = false;
            cursor.style.setProperty("--mx", ((mx / W) * 100).toFixed(2));
            cursor.style.setProperty("--my", ((my / H) * 100).toFixed(2));
            if (!readout) return;
            var hit = null;
            boxList().forEach(function (box) {
                if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) hit = box;
            });
            readout.textContent = "x " + String(mx).padStart(3, "0") + "  y " + String(my).padStart(3, "0") +
                (hit ? "  /  " + hit.label + " " + hit.conf : "");
        };
        plate.addEventListener("pointermove", function (event) {
            var rect = plate.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            mx = Math.max(0, Math.min(W, Math.round(((event.clientX - rect.left) / rect.width) * W)));
            my = Math.max(0, Math.min(H, Math.round(((event.clientY - rect.top) / rect.height) * H)));
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(paint);
        });
        plate.addEventListener("pointerleave", function () {
            if (readout) readout.textContent = "";
        });
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
            syncOverlay();
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
        // ResizeObserver ignores DPR-only changes (browser zoom, moving between
        // displays), so keep a cheap width/DPR check on window resize.
        window.addEventListener("resize", function () {
            var rect = canvas.getBoundingClientRect();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (dpr !== lastDpr || Math.abs(rect.width * dpr - canvas.width) > 1) resize();
        });
    } else {
        window.addEventListener("resize", resize);
    }

    function listenMedia(query, handler) {
        if (typeof query.addEventListener === "function") query.addEventListener("change", handler);
        else if (typeof query.addListener === "function") query.addListener(handler);
    }

    listenMedia(motionQuery, function (event) {
        reduced = event.matches;
        if (reduced) {
            stop();
            draw();
        } else if (visible) {
            start();
        }
    });

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                visible = entry.isIntersecting;
                if (visible) start();
                else stop();
            });
        }, { threshold: 0.05 }).observe(canvas);
    }

    buildOverlay();
    resize();
    draw();
    syncOverlay();
    if (!reduced) start();
    }

    Array.prototype.forEach.call(document.querySelectorAll("canvas[data-scene]"), boot);
})();