/* =====================================================================
   BACKSTAGE PASS — simulation engine
   Pure functions only (no DOM): floor plan analysis, fire code checks,
   demand forecasting, show settlement and reputation.
   ===================================================================== */

const Sim = (() => {
    const D = (typeof DATA !== 'undefined') ? DATA : require('./data.js');

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Small seeded RNG (mulberry32) so weekly rosters are stable per save.
    function makeRng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* ---------------------------------------------------------------
       Venue geometry
       --------------------------------------------------------------- */
    const venueDef = id => D.VENUES.find(v => v.id === id);
    const tileArea = v => v.tileFt * v.tileFt;
    const ppt = v => Math.floor(tileArea(v) / 5);          // standing guests per square
    const seatPpt = v => Math.max(1, Math.floor(tileArea(v) / 7));
    const vipCapPerLounge = v => Math.floor(4 * tileArea(v) / 12);
    const restroomCapPerBlock = v => ppt(v) * 15;
    const barCapPerSegment = v => ppt(v) * 18;
    const cocktailCapPerSegment = v => ppt(v) * 14;
    const merchCapPerTable = v => ppt(v) * 40;

    function itemCost(v, type) {
        const base = D.ITEMS[type].cost * v.costScale;
        const disc = v.perk.id === 'diy' ? 0.8 : 1;
        return roundMoney(base * disc);
    }

    function floorCost(v, floorId) {
        const f = D.FLOORS.find(x => x.id === floorId) || D.FLOORS[0];
        const tiles = v.cols * v.rows - v.stage.w * v.stage.d;
        const disc = v.perk.id === 'diy' ? 0.8 : 1;
        return roundMoney(f.perTile * tiles * v.costScale * disc);
    }

    function roundMoney(x) {
        if (x >= 100000) return Math.round(x / 1000) * 1000;
        if (x >= 10000) return Math.round(x / 100) * 100;
        if (x >= 1000) return Math.round(x / 10) * 10;
        return Math.round(x);
    }

    const key = (r, c) => r * 1000 + c;

    function isStage(v, r, c) {
        return r < v.stage.d && c >= v.stage.x && c < v.stage.x + v.stage.w;
    }

    function isPerimeter(v, r, c) {
        return r === 0 || c === 0 || r === v.rows - 1 || c === v.cols - 1;
    }

    // The square just inside each door must stay clear (egress).
    function doorCell(v, door) {
        if (door.side === 'bottom') return { r: v.rows - 1, c: door.at };
        if (door.side === 'top') return { r: 0, c: door.at };
        if (door.side === 'left') return { r: door.at, c: 0 };
        return { r: door.at, c: v.cols - 1 };
    }

    function doorCellSet(v) {
        const s = new Set();
        v.doors.forEach(d => { const dc = doorCell(v, d); s.add(key(dc.r, dc.c)); });
        return s;
    }

    function cellsOf(item) {
        const out = [];
        for (let r = item.r; r < item.r + item.h; r++) {
            for (let c = item.c; c < item.c + item.w; c++) out.push([r, c]);
        }
        return out;
    }

    function occupancy(items) {
        const m = new Map();
        items.forEach(it => cellsOf(it).forEach(([r, c]) => m.set(key(r, c), it)));
        return m;
    }

    /* ---------------------------------------------------------------
       Placement rules
       --------------------------------------------------------------- */
    function canPlace(v, items, type, r, c, w, h) {
        const def = D.ITEMS[type];
        if (!def) return { ok: false, reason: 'Unknown item.' };
        if (r < 0 || c < 0 || r + h > v.rows || c + w > v.cols) {
            return { ok: false, reason: "Doesn't fit inside the walls here." };
        }
        if (def.max && items.filter(i => i.type === type).length >= def.max) {
            return { ok: false, reason: `You can only have ${def.max} ${def.name}.` };
        }
        const occ = occupancy(items);
        const doors = doorCellSet(v);
        const cells = cellsOf({ r, c, w, h });
        for (const [cr, cc] of cells) {
            if (occ.has(key(cr, cc))) return { ok: false, reason: 'That space is already taken.' };
            const onStage = isStage(v, cr, cc);
            if (def.rule === 'onStage' && !onStage) return { ok: false, reason: `${def.name} must be mounted on the stage.` };
            if (def.rule !== 'onStage' && onStage) return { ok: false, reason: 'Keep the stage clear for the band (only lighting goes up there).' };
            if (doors.has(key(cr, cc))) return { ok: false, reason: 'Fire code: keep the square inside every door clear.' };
        }
        const touchesWall = cells.some(([cr, cc]) => isPerimeter(v, cr, cc));
        const neighbors = (pred) => cells.some(([cr, cc]) =>
            [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => pred(cr + dr, cc + dc)));
        const nearStage = cells.some(([cr, cc]) => {
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const nr = cr + dr, nc = cc + dc;
                if (nr >= 0 && nc >= 0 && nr < v.rows && nc < v.cols && isStage(v, nr, nc)) return true;
            }
            return false;
        });

        if (def.rule === 'wall' && !touchesWall) return { ok: false, reason: `${def.name} must touch an exterior wall (plumbing & access).` };
        if (def.rule === 'wallOrBar' && !touchesWall) {
            const extendsBar = neighbors((nr, nc) => {
                const it = occ.get(key(nr, nc));
                return it && (it.type === 'bar' || it.type === 'cocktail');
            });
            if (!extendsBar) return { ok: false, reason: 'Bars must start against a wall — then you can extend them outward.' };
        }
        if (def.rule === 'nearStage' && !nearStage) return { ok: false, reason: `${def.name} must be right next to the stage.` };
        if (def.rule === 'crowd' && nearStage) return { ok: false, reason: 'Delay towers go out in the room — use a PA stack or line array beside the stage.' };
        return { ok: true };
    }

    /* ---------------------------------------------------------------
       Floor plan analysis: capacity, fire code, sound, lights, service
       --------------------------------------------------------------- */
    function analyze(v, items, floorId) {
        const occ = occupancy(items);
        const count = t => items.filter(i => i.type === t).length;
        const P = ppt(v), S = seatPpt(v), VC = vipCapPerLounge(v);

        // Open squares (floor, seats, VIP, barrier rows) — before access checks.
        const open = [];
        for (let r = 0; r < v.rows; r++) {
            for (let c = 0; c < v.cols; c++) {
                if (isStage(v, r, c)) continue;
                const it = occ.get(key(r, c));
                if (it && !D.ITEMS[it.type].walk) continue;
                open.push([r, c]);
            }
        }
        let stageCells = v.stage.w * v.stage.d;

        // Guests come in through the main entrance; anything they can't
        // walk to is dead space. Every fire exit must connect to the room.
        const walk = new Set(open.map(([r, c]) => key(r, c)));
        const reach = new Set();
        const queue = [];
        v.doors.filter(d => d.kind === 'main').forEach(d => {
            const dc = doorCell(v, d);
            const k = key(dc.r, dc.c);
            if (walk.has(k) && !reach.has(k)) { reach.add(k); queue.push([dc.r, dc.c]); }
        });
        while (queue.length) {
            const [r, c] = queue.shift();
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                const k = key(r + dr, c + dc);
                if (walk.has(k) && !reach.has(k)) { reach.add(k); queue.push([r + dr, c + dc]); }
            });
        }
        const crowd = open.filter(([r, c]) => reach.has(key(r, c)));
        const trapped = open.filter(([r, c]) => !reach.has(key(r, c)));
        const blockedExits = v.doors.filter(d => d.kind === 'fire' && !reach.has(key(doorCell(v, d).r, doorCell(v, d).c)));

        // Service fixtures only count if a guest can walk up to them.
        const reachable = it => cellsOf(it).some(([r, c]) =>
            [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => reach.has(key(r + dr, c + dc))));
        const unreachable = [];
        const usable = t => items.filter(i => i.type === t && (reachable(i) || (unreachable.push(i), false))).length;

        let seatCells = 0, vipCells = 0;
        crowd.forEach(([r, c]) => {
            const it = occ.get(key(r, c));
            if (it && it.type === 'seating') seatCells++;
            if (it && it.type === 'vip') vipCells++;
        });
        const standingCells = crowd.length - seatCells - vipCells;
        const vipLounges = items.filter(i => i.type === 'vip' && cellsOf(i).every(([r, c]) => reach.has(key(r, c)))).length;
        const gaCap = standingCells * P + seatCells * S;
        const vipCap = vipLounges * VC;
        const floorCap = gaCap + vipCap;
        const restrooms = usable('restroom');
        const restroomCap = restrooms * restroomCapPerBlock(v);
        const legalCap = Math.min(floorCap, restroomCap);
        const seatShare = floorCap > 0 ? (seatCells * S) / floorCap : 0;

        // Sound coverage: distance from each speaker to each guest square.
        const sources = items.filter(i => D.ITEMS[i.type].radius);
        const coverage = new Map();
        let covered = 0, qualitySum = 0;
        crowd.forEach(([r, c]) => {
            let best = 0, level = 0;
            sources.forEach(s => {
                const def = D.ITEMS[s.type];
                const sr = s.r + (s.h - 1) / 2, sc = s.c + (s.w - 1) / 2;
                const d = Math.hypot(sr - r, sc - c);
                if (d <= def.radius) {
                    best = Math.max(best, def.quality);
                    level = Math.max(level, 1 - (d / def.radius) * 0.5);
                }
            });
            coverage.set(key(r, c), level);
            if (best > 0) { covered++; qualitySum += best; }
        });
        const soundCoverage = crowd.length ? covered / crowd.length : 0;
        const hasFoh = count('foh') > 0;
        const avgQuality = covered ? qualitySum / covered : 0;
        const soundQuality = Math.min(1.15, soundCoverage * avgQuality * (hasFoh ? 1 : 0.65));

        const lightPts = items.reduce((s, i) => s + (D.ITEMS[i.type].light || 0), 0);
        const lightIdeal = Math.max(2, stageCells * 0.75);
        const hasFog = count('fog') > 0;
        const lightScore = Math.min(1.25, (lightPts / lightIdeal) * (hasFog ? 1.2 : 1));

        const bars = usable('bar'), cocktails = usable('cocktail');
        const barCap = bars * barCapPerSegment(v) + cocktails * cocktailCapPerSegment(v);
        const cocktailShare = barCap ? (cocktails * cocktailCapPerSegment(v)) / barCap : 0;
        const merchCap = usable('merch') * merchCapPerTable(v);
        const pitFront = v.stage.w + 2;
        const barrierCoverage = Math.min(1, count('barrier') / pitFront);

        const violations = [];
        const warnings = [];
        if (restrooms === 0) violations.push('No usable restrooms — the city will not issue an occupancy permit.');
        blockedExits.forEach(d => violations.push(`The fire exit on the ${d.side} wall is cut off from the room.`));
        if (legalCap < 10 && restrooms > 0) violations.push('Not enough open floor for a crowd.');
        if (trapped.length) warnings.push(`${trapped.length} square${trapped.length > 1 ? 's are' : ' is'} walled off from the entrance — dead space.`);
        if (unreachable.length) warnings.push(`${unreachable.length} fixture${unreachable.length > 1 ? 's' : ''} can't be reached by guests and won't be used.`);

        if (!sources.some(s => D.ITEMS[s.type].rule === 'nearStage')) warnings.push('No main speakers: nobody can hear the band. Add a PA stack beside the stage.');
        else if (soundCoverage < 0.85) warnings.push(`${Math.round((1 - soundCoverage) * 100)}% of the room has dead sound. Add speakers or a delay tower.`);
        if (!hasFoh) warnings.push('No FOH mix booth: sound quality is capped at 65%.');
        if (barCap === 0) warnings.push('No bar: you will miss out on drink sales (the real money).');
        else if (barCap < legalCap) warnings.push(`Bar can only serve ${barCap.toLocaleString()} of ${legalCap.toLocaleString()} guests. Expect long lines.`);
        if (restroomCap < floorCap && restrooms > 0) warnings.push(`Restrooms limit you to ${restroomCap.toLocaleString()} guests (floor holds ${floorCap.toLocaleString()}).`);
        if (merchCap === 0) warnings.push('No merch table: no merch commission.');
        if (lightPts === 0) warnings.push('No stage lighting: the band is playing in the dark.');
        if (!count('greenroom')) warnings.push('No green room: touring acts (Tier 3+) will not book here.');

        return {
            ppt: P, seatPpt: S, vipCapPerLounge: VC,
            crowdCells: crowd.length, standingCells, seatCells, vipLounges, stageCells,
            gaCap, vipCap, floorCap, restrooms, restroomCap, legalCap, seatShare,
            trapped, blockedExits, unreachable, coverage, soundCoverage, soundQuality, hasFoh,
            lightPts, lightIdeal, lightScore, hasFog,
            barCap, cocktailShare, merchCap, barrierCoverage,
            hasGreenroom: count('greenroom') > 0,
            neon: Math.min(3, count('neon')), mural: Math.min(2, count('mural')), arcade: Math.min(3, usable('arcade')),
            floorId: floorId || 'concrete',
            violations, warnings, legal: violations.length === 0
        };
    }

    // Max standing capacity if the room were totally empty (for listings).
    function maxStanding(v) {
        return (v.cols * v.rows - v.stage.w * v.stage.d) * ppt(v);
    }

    /* ---------------------------------------------------------------
       Bands & the three-band bill
       --------------------------------------------------------------- */
    const tierOf = band => D.TIERS[band.tier];
    const bandById = id => id === D.OPEN_MIC.id ? D.OPEN_MIC : D.BANDS.find(b => b.id === id);

    function bandStatus(band, ctx) {
        if (band.openMic) return { ok: true };
        const t = tierOf(band);
        if (ctx.rep < t.repReq) return { ok: false, reason: `Won't return your calls until reputation ${t.repReq}.` };
        if (ctx.report.legalCap < t.minCap) return { ok: false, reason: `Only plays rooms that hold ${t.minCap.toLocaleString()}+.` };
        if (t.greenroom && !ctx.report.hasGreenroom) return { ok: false, reason: 'Requires a green room backstage.' };
        return { ok: true };
    }

    function recentlyPlayed(bandId, day, history) {
        const last = history[bandId];
        return last !== undefined && day - last < 6;
    }

    function genreChem(a, b) {
        return (D.CHEMISTRY[a] && D.CHEMISTRY[a][b] !== undefined) ? D.CHEMISTRY[a][b] : D.CHEMISTRY[b][a];
    }

    function chemLabel(chem) {
        if (chem >= 0.8) return { label: 'PERFECT BILL', tone: 'good' };
        if (chem >= 0.6) return { label: 'GOOD MIX', tone: 'good' };
        if (chem >= 0.4) return { label: 'ODD PAIRING', tone: 'warn' };
        return { label: 'GENRE CLASH', tone: 'bad' };
    }

    // Build a bill from up to three bands. Billing order is by draw:
    // the biggest name headlines, the smallest opens.
    function makeBill(bands, day, history) {
        history = history || {};
        if (bands.length === 1 && bands[0].openMic) {
            const om = bands[0];
            return {
                openMic: true, complete: true, slots: [{ band: om, slot: D.SLOTS[2], recent: false }], headliner: om,
                draw: om.draw, fair: 5, chemistry: 0.7, fees: 0, riders: 0, merchRate: 0,
                genre: om.genre, aggression: D.GENRES[om.genre].aggression, drink: D.GENRES[om.genre].drink
            };
        }
        if (!bands.length) {
            return { openMic: false, complete: false, slots: [], headliner: null, draw: 0, fair: 10, chemistry: 0.6,
                fees: 0, riders: 0, merchRate: 0, genre: 'indie', aggression: 1, drink: 1 };
        }
        const sorted = bands.slice().sort((a, b) => a.draw - b.draw || a.tier - b.tier);
        const slotDefs = sorted.length === 3 ? D.SLOTS : D.SLOTS.slice(3 - sorted.length);
        const slots = sorted.map((band, i) => ({ band, slot: slotDefs[i], recent: recentlyPlayed(band.id, day, history), pay: Math.round(band.fee * slotDefs[i].fee) }));
        const headliner = sorted[sorted.length - 1];
        let draw = 0, fair = 0, merchRate = 0, aggression = 0, drink = 0, fees = 0, riders = 0, wsum = 0;
        slots.forEach(({ band, slot, recent }) => {
            const t = tierOf(band);
            const g = D.GENRES[band.genre];
            draw += band.draw * slot.draw * (recent ? 0.75 : 1);
            fair += t.fair * (slot.id === 'headliner' ? 1 : slot.id === 'support' ? 0.25 : 0.1);
            merchRate += t.merch * slot.weight;
            aggression += g.aggression * slot.weight;
            drink += g.drink * slot.weight;
            wsum += slot.weight;
            fees += Math.round(band.fee * slot.fee);
            riders += t.rider * (slot.id === 'headliner' ? 1 : 0.5);
        });
        let chem = 1, pairs = 0, sum = 0;
        for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
            sum += genreChem(sorted[i].genre, sorted[j].genre); pairs++;
        }
        if (pairs) chem = sum / pairs;
        return {
            openMic: false, complete: sorted.length === 3, slots, headliner,
            draw: Math.round(draw), fair: roundPrice(fair), chemistry: chem,
            fees, riders: Math.round(riders), merchRate: merchRate / wsum,
            genre: headliner.genre, aggression: aggression / wsum, drink: drink / wsum
        };
    }

    function roundPrice(p) {
        return p >= 50 ? Math.round(p / 5) * 5 : Math.round(p);
    }

    // Each band rolls tonight's performance around its quality.
    function rollPerformances(bill, rng) {
        return bill.slots.map(({ band }) => {
            const sd = D.CONSISTENCY[band.consistency || 'solid'].sd;
            const u = Math.max(1e-9, rng()), v = rng();
            const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
            return Math.round(clamp(band.quality + z * sd, 0.5, 5.5) * 10) / 10;
        });
    }

    function performanceLabel(perf) {
        if (perf >= 5) return 'set of the year';
        if (perf >= 4.2) return 'a killer set';
        if (perf >= 3.4) return 'a solid set';
        if (perf >= 2.5) return 'an uneven set';
        if (perf >= 1.5) return 'a sloppy set';
        return 'a total trainwreck';
    }

    function weeklyRoster(week, rep, seed) {
        const rng = makeRng(seed * 7919 + week * 104729);
        const unlocked = D.TIERS.filter(t => t && rep >= t.repReq).map(t => t.tier);
        const top = Math.max(...unlocked);
        const pool = D.BANDS.filter(b => b.tier <= top && b.tier >= Math.max(1, top - 2));
        const topPool = shuffle(pool.filter(b => b.tier === top), rng);
        const rest = shuffle(pool.filter(b => b.tier !== top), rng);
        const picks = topPool.slice(0, 4).concat(rest, topPool.slice(4)).slice(0, 10);
        picks.sort((a, b) => a.tier - b.tier || a.draw - b.draw);
        const next = D.BANDS.filter(b => b.tier === top + 1);
        const teaser = next.length ? next[Math.floor(rng() * next.length)] : null;
        return { ids: picks.map(b => b.id), teaser: teaser ? teaser.id : null };
    }

    function shuffle(arr, rng) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /* ---------------------------------------------------------------
       Promotion & demand
       --------------------------------------------------------------- */
    function marketingCost(mktId, report) {
        const m = D.MARKETING.find(x => x.id === mktId);
        if (!m || m.perCap === 0) return 0;
        return roundMoney(Math.max(m.min, m.perCap * report.legalCap));
    }

    function priceFactor(price, fair) {
        const p = price / fair;
        return p <= 1 ? 1 + (1 - p) * 0.5 : Math.pow(1 / p, 1.8);
    }

    // Expected demand before nightly randomness (+/-10%).
    function forecastDemand(ctx) {
        const { venue, bill, price, marketingId, dayIdx, rep, hype } = ctx;
        const m = D.MARKETING.find(x => x.id === marketingId) || D.MARKETING[1];
        let d = bill.draw;
        d *= m.mult;
        d *= D.DAY_TURNOUT[dayIdx];
        d *= 0.85 + clamp(rep, 0, 100) / 333;
        d *= 1 + clamp(hype, -40, 40) / 100;
        d *= priceFactor(price, bill.fair);
        d *= 0.85 + 0.25 * bill.chemistry;
        if (venue.perk.id === 'frontage') d *= 1.10;
        return Math.max(0, Math.round(d));
    }

    function attendanceFor(demand, report) {
        const vipDemand = Math.round(demand * D.VIP_DEMAND_SHARE);
        const vipSold = Math.min(vipDemand, report.vipCap, report.legalCap);
        const gaRoom = Math.min(report.gaCap, report.legalCap - vipSold);
        const gaSold = Math.max(0, Math.min(demand - vipSold, gaRoom));
        const attendance = gaSold + vipSold;
        return { demand, vipSold, gaSold, attendance, fill: report.legalCap ? attendance / report.legalCap : 0 };
    }

    function planShow(ctx, rng) {
        rng = rng || Math.random;
        const base = forecastDemand(ctx);
        const noise = 0.9 + rng() * 0.2;
        const plan = attendanceFor(Math.round(base * noise), ctx.report);
        plan.performances = rollPerformances(ctx.bill, rng);
        return plan;
    }

    /* ---------------------------------------------------------------
       Crowd satisfaction ("vibe"), 0–100
       --------------------------------------------------------------- */
    function satisfaction(ctx, plan, mods) {
        const { venue, report, bill, price } = ctx;
        const g = D.GENRES[bill.genre];
        const parts = [];
        const add = (label, v) => { if (Math.abs(v) >= 0.5) parts.push({ label, v: Math.round(v) }); return v; };

        let s = 50;
        let perf = 0;
        bill.slots.forEach(({ slot }, i) => { perf += (plan.performances[i] - 3) * 7 * (bill.openMic ? 1 : slot.weight); });
        s += add('Band performances', perf + (report.hasGreenroom && !bill.openMic ? 3 : 0));
        s += add('Lineup chemistry', (bill.chemistry - 0.6) * 25);
        s += add('Sound', (report.soundQuality - 0.75) * 40 * g.soundW);
        s += add('Lighting', (report.lightScore - 0.5) * 14 * g.lightW);
        if (plan.attendance > 0) {
            if (report.barCap === 0) s += add('No bar', -6);
            else if (report.barCap < plan.attendance) s += add('Bar lines', -(1 - report.barCap / plan.attendance) * 20);
        }
        if (plan.fill >= 0.9) s += add('Packed room energy', 6);
        else if (plan.fill >= 0.6) s += add('Good crowd', 3);
        else if (plan.fill < 0.25) s += add('Empty room', -8);
        else if (plan.fill < 0.4) s += add('Half-empty room', -4);

        if (g.style === 'seated') s += add('Seating for a listening crowd', 12 * Math.min(1, report.seatShare / 0.5) - 4);
        if (g.style === 'standing') s += add('Seats in a standing crowd', -16 * Math.max(0, report.seatShare - 0.25));

        const p = price / bill.fair;
        if (p > 1.3) s += add('Ticket price gouging', -(p - 1.3) * 15);

        s += add('Neon signs', report.neon * 1.5);
        const fl = D.FLOORS.find(f => f.id === report.floorId);
        if (fl && fl.genres && fl.genres.includes(bill.genre)) s += add('Floor finish', 3);
        if (venue.perk.id === 'stone' && (bill.genre === 'metal' || bill.genre === 'punk')) s += add('Stone acoustics', 6);
        if (venue.perk.id === 'stars') s += add('Under the stars', 8);
        if (mods && mods.vibe) s += add('Events & incidents', mods.vibe);

        return { score: Math.round(clamp(s, 0, 100)), parts };
    }

    function vibeLabel(score) {
        if (score >= 90) return 'LEGENDARY';
        if (score >= 75) return 'ELECTRIC';
        if (score >= 60) return 'ROWDY';
        if (score >= 45) return 'DECENT';
        if (score >= 30) return 'RESTLESS';
        return 'DEAD ROOM';
    }

    /* ---------------------------------------------------------------
       Settlement: the night's full profit & loss
       --------------------------------------------------------------- */
    function headlinerPay(ctx, ticketGross) {
        const { bill, deal } = ctx;
        if (bill.openMic) return 0;
        return deal === 'split' ? Math.round(ticketGross * tierOf(bill.headliner).split) : bill.headliner.fee;
    }

    function riderCost(ctx) {
        return Math.round(ctx.bill.riders * (ctx.venue.perk.id === 'loadin' ? 0.5 : 1));
    }

    function supportFees(bill) {
        return bill.openMic ? 0 : bill.fees - bill.headliner.fee;
    }

    function settleShow(ctx, plan, mods) {
        mods = mods || {};
        const { venue, report, bill, price, marketingId, securityId } = ctx;
        const sat = satisfaction(ctx, plan, mods);
        const sec = D.SECURITY.find(s => s.id === securityId) || D.SECURITY[1];

        const ticketBoost = 1 + (mods.ticketBonus || 0);
        const gaRevenue = Math.round(plan.gaSold * price * ticketBoost);
        const vipRevenue = Math.round(plan.vipSold * price * D.VIP_PRICE_MULT);
        const ticketGross = gaRevenue + vipRevenue;

        // Bar: limited by how many guests your bar stations can serve.
        const served = Math.min(plan.attendance, report.barCap);
        const vipShare = plan.attendance ? plan.vipSold / plan.attendance : 0;
        const drinksPerHead = 1.4 * bill.drink * (0.7 + sat.score / 170) * (1 + vipShare);
        const drinkPrice = venue.drinkPrice * (1 + 0.4 * report.cocktailShare);
        let barMult = 1 + (mods.barBonus || 0) + report.arcade * 0.05;
        if (venue.perk.id === 'nightlife') barMult += 0.15;
        const barGross = Math.round(served * drinksPerHead * drinkPrice * barMult);
        const barCogs = Math.round(barGross * D.BAR_COGS);

        // Merch: the bands sell, you keep a commission.
        const merchBuyers = bill.openMic ? 0 : Math.min(plan.attendance, report.merchCap);
        const merchGross = Math.round(merchBuyers * bill.merchRate * (0.6 + sat.score / 125));
        const merchCut = Math.round(merchGross * D.MERCH_COMMISSION);

        const sponsor = venue.perk.id === 'sponsors' ? Math.round(ticketGross * 0.05) : 0;

        // Costs
        const headPay = headlinerPay(ctx, ticketGross);
        const support = supportFees(bill);
        const bandPay = headPay + support;
        const rider = riderCost(ctx);
        const guards = Math.max(1, Math.ceil(plan.attendance / sec.ratio));
        const bartenders = served > 0 ? Math.ceil(served / 90) : 0;
        const doorStaff = Math.max(1, Math.ceil(plan.attendance / 250));
        const crew = 1 + (report.lightPts > 0 ? 1 : 0) + Math.floor(report.legalCap / 1000);
        const staffCount = guards + bartenders + doorStaff + crew;
        const staff = staffCount * D.WAGE_PER_SHIFT;
        const marketing = marketingCost(marketingId, report);
        const incidents = mods.cash || 0;   // negative = cost

        const revenue = ticketGross + barGross + merchCut + sponsor;
        const costs = bandPay + rider + barCogs + staff + marketing;
        const net = revenue - costs + incidents;

        // Reputation: great, packed shows with acts at (or above) your
        // level build it; flops cost a little. It gets harder near the top.
        let rep = (sat.score - 50) / 24;
        if (plan.fill >= 0.9) rep += 0.5;
        else if (plan.fill < 0.4) rep -= 0.5;
        if (rep > 0) {
            const diff = bill.headliner.tier - expectedTier(ctx.rep);
            rep *= diff >= 0 ? 1 + 0.25 * diff : Math.pow(0.5, -diff);
            rep *= 1 - clamp(ctx.rep, 0, 100) / 160;
            if (venue.perk.id === 'landmark') rep *= 1.5;
            if (bill.openMic) rep *= 0.5;
        } else {
            rep *= 0.5;
        }
        rep += mods.rep || 0;
        rep = Math.round(rep * 10) / 10;

        const hypeNext = Math.round(clamp((ctx.hype || 0) * 0.5 + (sat.score - 60) / 3 + report.mural * 3 + (mods.hype || 0), -40, 40));

        return {
            sat, gaRevenue, vipRevenue, ticketGross, barGross, barCogs, served, drinkPrice,
            merchGross, merchCut, sponsor, headPay, support, bandPay, rider, guards, bartenders, doorStaff, crew,
            staffCount, staff, marketing, incidents, revenue, costs, net, repDelta: rep, hypeNext
        };
    }

    // Expected outcome assuming every band plays to its usual level.
    function projectShow(ctx) {
        const plan = attendanceFor(forecastDemand(ctx), ctx.report);
        plan.performances = ctx.bill.slots.map(s => s.band.quality);
        return { plan, result: settleShow(ctx, plan, {}) };
    }

    // Costs paid when doors open: guarantees, support fees, riders, promo.
    function upfrontCost(ctx) {
        const { bill, deal, report, marketingId } = ctx;
        const head = bill.openMic || deal === 'split' ? 0 : bill.headliner.fee;
        return head + supportFees(bill) + riderCost(ctx) + marketingCost(marketingId, report);
    }

    /* ---------------------------------------------------------------
       Events & crises
       --------------------------------------------------------------- */
    function pickEvent(ctx, rng) {
        const pool = D.EVENTS.filter(e => {
            if (e.when === 'outdoor') return ctx.venue.id === 'festival' || ctx.venue.id === 'stadium';
            if (e.when === 'bar') return ctx.report.barCap > 0;
            return true;
        });
        return pool[Math.floor(rng() * pool.length)];
    }

    // Resolve an effects object. Cash is scaled to the size of the venue.
    function resolveEffects(eff, scale, rng) {
        const out = { cash: 0, rep: 0, hype: 0, vibe: 0, barBonus: 0, ticketBonus: 0, notes: [] };
        const apply = e => {
            if (!e) return;
            if (e.cash) out.cash += roundMoney(Math.abs(e.cash) * scale) * Math.sign(e.cash);
            ['rep', 'hype', 'vibe', 'barBonus', 'ticketBonus'].forEach(k => { if (e[k]) out[k] += e[k]; });
            if (e.note) out.notes.push(e.note);
        };
        apply(eff);
        if (eff && eff.chance !== undefined) {
            const won = rng() < eff.chance;
            apply(won ? eff.win : eff.lose);
            out.won = won;
        }
        return out;
    }

    // Describe an effects object for a button label, e.g. "-$250 · -6 vibe".
    function describeEffects(eff, scale) {
        if (!eff) return '';
        const bits = [];
        if (eff.cash) bits.push((eff.cash > 0 ? '+$' : '-$') + roundMoney(Math.abs(eff.cash) * scale).toLocaleString());
        if (eff.vibe) bits.push((eff.vibe > 0 ? '+' : '') + eff.vibe + ' vibe');
        if (eff.hype) bits.push((eff.hype > 0 ? '+' : '') + eff.hype + ' hype');
        if (eff.rep) bits.push((eff.rep > 0 ? '+' : '') + eff.rep + ' rep');
        if (eff.barBonus) bits.push((eff.barBonus > 0 ? '+' : '') + Math.round(eff.barBonus * 100) + '% bar');
        if (eff.ticketBonus) bits.push('+' + Math.round(eff.ticketBonus * 100) + '% tickets');
        if (eff.chance !== undefined) bits.push('risky');
        return bits.join(' · ');
    }

    function securityOutcome(securityId, rng) {
        if (securityId === 'heavy') return { cash: 0, rep: 0, hype: 0, vibe: -1, barBonus: 0, ticketBonus: 0, notes: ['Your heavy security team shut it down in seconds.'] };
        if (securityId === 'standard') {
            return rng() < 0.8
                ? { cash: 0, rep: 0, hype: 0, vibe: -1, barBonus: 0, ticketBonus: 0, notes: ['Security separated them. Show goes on.'] }
                : { cash: 0, rep: 0, hype: 0, vibe: -4, barBonus: 0, ticketBonus: 0, notes: ['It took a while to break up. Mood dipped.'] };
        }
        return rng() < 0.4
            ? { cash: 0, rep: 0, hype: 0, vibe: -2, barBonus: 0, ticketBonus: 0, notes: ['Your one guard somehow handled it.'] }
            : { cash: -300, rep: -1, hype: 0, vibe: -6, barBonus: 0, ticketBonus: 0, notes: ['Too few guards — it spilled into the bar. Broken glass everywhere.'] };
    }

    function rollCrises(ctx, plan, rng) {
        const aggression = ctx.bill.aggression;
        const sec = D.SECURITY.find(s => s.id === ctx.securityId) || D.SECURITY[1];
        const r = ctx.report;
        const weightOf = c => {
            switch (c.weight) {
                case 'aggression': return aggression * sec.risk * (1 - 0.6 * r.barrierCoverage);
                case 'sound': return Math.max(0.1, 1.3 - r.soundQuality);
                case 'full': return plan.fill >= 0.95 ? 1.4 : 0;
                case 'bar': return r.barCap === 0 ? 0 : (r.barCap < plan.attendance ? 1.2 : 0.3);
                default: return 0.6;
            }
        };
        let n = rng() < 0.6 ? 1 : 0;
        if (rng() < 0.2 * sec.risk * aggression) n++;
        const out = [];
        const pool = D.CRISES.map(c => ({ c, w: weightOf(c) })).filter(x => x.w > 0);
        for (let i = 0; i < n && pool.length; i++) {
            const total = pool.reduce((s, x) => s + x.w, 0);
            let roll = rng() * total, idx = 0;
            while (roll > pool[idx].w) { roll -= pool[idx].w; idx++; }
            out.push(pool[idx].c.id);
            pool.splice(idx, 1);
        }
        return out;
    }

    /* ---------------------------------------------------------------
       Calendar & reputation helpers
       --------------------------------------------------------------- */
    // The headliner tier your reputation "should" be booking.
    const expectedTier = rep => Math.min(7, 1 + Math.floor(clamp(rep, 0, 100) / 14));
    const weekOf = day => Math.floor((day - 1) / 7) + 1;
    const dayIdxOf = day => (day - 1) % 7;
    function gradeOf(rep) {
        let g = D.GRADES[0];
        D.GRADES.forEach(x => { if (rep >= x.min) g = x; });
        return g;
    }

    return {
        D, clamp, makeRng, roundMoney,
        venueDef, ppt, seatPpt, vipCapPerLounge, restroomCapPerBlock, barCapPerSegment, cocktailCapPerSegment, merchCapPerTable,
        itemCost, floorCost, isStage, isPerimeter, doorCell, doorCellSet, cellsOf, occupancy, canPlace, analyze, maxStanding,
        tierOf, bandById, bandStatus, recentlyPlayed, genreChem, chemLabel, makeBill, rollPerformances, performanceLabel, weeklyRoster,
        marketingCost, priceFactor, forecastDemand, attendanceFor, planShow, projectShow, headlinerPay, riderCost, supportFees,
        satisfaction, vibeLabel, settleShow, upfrontCost,
        pickEvent, resolveEffects, describeEffects, securityOutcome, rollCrises,
        expectedTier, weekOf, dayIdxOf, gradeOf
    };
})();

if (typeof module !== 'undefined') module.exports = Sim;
