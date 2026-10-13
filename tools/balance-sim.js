/* Balance simulator: an automated promoter plays the economy so we can
   check that money and reputation progress sensibly.
   Usage: node tools/balance-sim.js [runs] [maxDays] [--verbose]          */

const Sim = require('../js/sim.js');
const D = Sim.D;

const RUNS = parseInt(process.argv[2] || '20', 10);
const MAX_DAYS = parseInt(process.argv[3] || '400', 10);
const VERBOSE = process.argv.includes('--verbose');
const NAIVE = process.argv.includes('--naive');   // casual player: random bills, default price

// Greedy auto-builder: tries to reach a sensible, legal layout within budget.
function autoBuild(v, items, budget) {
    let spent = 0;
    let nextId = 1000;
    const tryPlace = (type, cells, maxCount) => {
        let placed = 0;
        for (const [r, c, w, h] of cells) {
            if (maxCount !== undefined && placed >= maxCount) break;
            const cost = Sim.itemCost(v, type);
            if (spent + cost > budget) return placed;
            const check = Sim.canPlace(v, items, type, r, c, w, h);
            if (!check.ok) continue;
            const trial = items.concat([{ id: nextId, type, r, c, w, h }]);
            const a = Sim.analyze(v, trial, 'concrete');
            if (!a.legal && Sim.analyze(v, items, 'concrete').legal) continue;
            if (a.trapped.length > Sim.analyze(v, items, 'concrete').trapped.length) continue;
            items.push({ id: nextId++, type, r, c, w, h });
            spent += cost;
            placed++;
        }
        return placed;
    };
    const all = [];
    for (let r = 0; r < v.rows; r++) for (let c = 0; c < v.cols; c++) all.push([r, c]);
    const perim = all.filter(([r, c]) => Sim.isPerimeter(v, r, c) && r >= v.stage.d);
    const a0 = () => Sim.analyze(v, items, 'concrete');
    const wallSpots = perim.map(([r, c]) => (c === 0 || c === v.cols - 1) ? [r, c, 1, 2] : [r, c, 2, 1]);
    const wings = all.filter(([r, c]) => r < v.stage.d && (c === v.stage.x - 1 || c === v.stage.x + v.stage.w));
    const stage = all.filter(([r, c]) => Sim.isStage(v, r, c)).map(([r, c]) => [r, c, 1, 1]);
    const mid = all.filter(([r]) => r >= Math.floor(v.rows * 0.55)).sort((x, y) => Math.abs(x[1] - v.cols / 2) - Math.abs(y[1] - v.cols / 2));
    const hasType = t => items.some(i => i.type === t);

    // 0. Green room backstage (wings first) so touring acts will book.
    if (v.tier >= 1 && !hasType('greenroom')) {
        const spots = all.filter(([r, c]) => Sim.isPerimeter(v, r, c)).sort((x, y) => x[0] - y[0]);
        tryPlace('greenroom', spots.map(([r, c]) => [r, c, 2, 2]), 1);
    }
    // 1. Main speakers and a mix booth.
    if (items.filter(i => Sim.D.ITEMS[i.type].rule === 'nearStage').length < 2) tryPlace(v.tier >= 4 ? 'linearray' : 'pa', wings.map(([r, c]) => [r, c, 1, 1]), 2);
    if (!hasType('foh')) tryPlace('foh', mid.map(([r, c]) => [r, c, 2, 1]), 1);
    // 2. Restrooms up to ~70% of the floor, bars to match.
    for (let i = 0; i < 12 && a0().restroomCap < a0().floorCap * 0.7; i++) if (!tryPlace('restroom', wallSpots, 1)) break;
    for (let i = 0; i < 20 && a0().barCap < a0().legalCap; i++) if (!tryPlace('bar', perim.map(([r, c]) => [r, c, 1, 1]), 1)) break;
    // 3. Green room, lights, merch.
    for (let i = 0; i < 8 && a0().lightScore < 1; i++) if (!tryPlace(v.tier >= 5 ? 'movers' : 'pars', stage, 1)) break;
    if (!hasType('merch')) tryPlace('merch', perim.slice().reverse().map(([r, c]) => [r, c, 1, 1]), 1);
    // 4. Fill remaining restroom gap, then delay towers for dead zones.
    for (let i = 0; i < 12 && a0().restroomCap < a0().floorCap * 0.9; i++) if (!tryPlace('restroom', wallSpots, 1)) break;
    for (let i = 0; i < 20 && a0().barCap < a0().legalCap; i++) if (!tryPlace('bar', perim.map(([r, c]) => [r, c, 1, 1]), 1)) break;
    for (let i = 0; i < 6 && a0().soundCoverage < 0.85; i++) {
        const back = all.filter(([r]) => r >= v.rows / 2).sort((x, y) => y[0] - x[0]);
        if (!tryPlace('delay', back.map(([r, c]) => [r, c, 1, 1]), 1)) break;
    }
    return spent;
}

function bestShow(state, venue, items, rng) {
    const report = Sim.analyze(venue, items, 'concrete');
    const week = Sim.weekOf(state.day);
    const roster = Sim.weeklyRoster(week, state.rep, state.seed).ids.map(Sim.bandById);
    const ok = roster.filter(b => Sim.bandStatus(b, { rep: state.rep, report }).ok);
    const options = [];
    const consider = (bands) => {
        const bill = Sim.makeBill(bands, state.day, state.history);
        for (const deal of bill.openMic ? ['guarantee'] : ['guarantee', 'split']) {
            for (const mk of D.MARKETING) {
                for (const pm of [0.8, 1, 1.2, 1.4]) {
                    const price = Math.max(1, Math.round(bill.fair * pm));
                    const ctx = { venue, report, bill, deal, price, marketingId: mk.id, securityId: 'standard',
                        dayIdx: Sim.dayIdxOf(state.day), rep: state.rep, hype: state.hype };
                    const up = Sim.upfrontCost(ctx);
                    if (up > state.funds) continue;
                    const demand = Sim.forecastDemand(ctx);
                    const plan = Sim.attendanceFor(demand, report);
                    plan.performances = bill.slots.map(s => s.band.quality);
                    const res = Sim.settleShow(ctx, plan, {});
                    // Value reputation too while it still gates progress.
                    options.push({ ctx, score: res.net + res.repDelta * 40 * venue.costScale });
                }
            }
        }
    };
    if (NAIVE) {
        for (let tries = 0; tries < 20; tries++) {
            const pick = ok.slice().sort(() => rng() - 0.5).slice(0, 3);
            if (pick.length < 3) break;
            const bill = Sim.makeBill(pick, state.day, state.history);
            const ctx = { venue, report, bill, deal: 'guarantee', price: bill.fair, marketingId: 'flyers', securityId: 'standard',
                dayIdx: Sim.dayIdxOf(state.day), rep: state.rep, hype: state.hype };
            if (Sim.upfrontCost(ctx) <= state.funds && Sim.projectShow(ctx).result.net > -100) return ctx;
        }
        const ctx = { venue, report, bill: Sim.makeBill([D.OPEN_MIC], state.day, state.history), deal: 'guarantee', price: 5,
            marketingId: 'flyers', securityId: 'standard', dayIdx: Sim.dayIdxOf(state.day), rep: state.rep, hype: state.hype };
        return Sim.upfrontCost(ctx) <= state.funds ? ctx : null;
    }
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) for (let k = j + 1; k < ok.length; k++) consider([ok[i], ok[j], ok[k]]);
    consider([D.OPEN_MIC]);
    options.sort((a, b) => b.score - a.score);
    return options[0] && options[0].score > 0 ? options[0].ctx : null;
}

function run(seed) {
    const rng = Sim.makeRng(seed);
    const state = { funds: D.START_FUNDS, rep: 0, hype: 0, day: 1, seed, history: {}, venueIdx: 0, shows: 0 };
    let venue = D.VENUES[0];
    let items = venue.prebuilt.map((p, i) => ({ ...p, id: i }));
    state.funds -= venue.deposit;
    state.funds -= autoBuild(venue, items, state.funds - 2500);
    const log = [];
    const reached = { [venue.id]: 1 };
    let bankrupt = false;
    let lossShows = 0;

    while (state.day <= MAX_DAYS) {
        // Upgrade when we can afford the next lease + a build-out budget.
        const next = D.VENUES[state.venueIdx + 1];
        if (next && state.rep >= next.repReq) {
            const buildBudget = next.deposit * 1.2 + 10000;
            if (state.funds > next.deposit + buildBudget + next.weekly * 2) {
                state.funds -= next.deposit;
                state.venueIdx++;
                venue = next;
                items = venue.prebuilt.map((p, i) => ({ ...p, id: i }));
                const spent = autoBuild(venue, items, buildBudget);
                state.funds -= spent;
                reached[venue.id] = state.day;
                const a = Sim.analyze(venue, items, 'concrete');
                log.push(`Day ${state.day}: leased ${venue.name} (build $${spent.toLocaleString()}, cap ${a.legalCap}, legal ${a.legal}) rep ${state.rep.toFixed(1)}`);
            }
        }
        const ctx = bestShow(state, venue, items, rng);
        if (ctx) {
            const plan = Sim.planShow(ctx, rng);
            const mods = { cash: 0, vibe: 0, rep: 0, hype: 0 };
            // Random event ~55% of nights, crises from the roll.
            if (rng() < 0.55) {
                const ev = Sim.pickEvent(ctx, rng);
                const choice = ev.choices[0];
                const r = Sim.resolveEffects(choice.effects, venue.costScale, rng);
                ['cash', 'vibe', 'rep', 'hype'].forEach(k => mods[k] += r[k]);
            }
            Sim.rollCrises(ctx, plan, rng).forEach(id => {
                const cr = D.CRISES.find(c => c.id === id);
                const choice = cr.choices[0];
                const r = choice.key === 'security' ? Sim.securityOutcome(ctx.securityId, rng) : Sim.resolveEffects(choice.effects, venue.costScale, rng);
                ['cash', 'vibe', 'rep', 'hype'].forEach(k => mods[k] += r[k] || 0);
            });
            const res = Sim.settleShow(ctx, plan, mods);
            state.funds += res.net;
            state.rep = Sim.clamp(state.rep + res.repDelta, 0, 100);
            state.hype = res.hypeNext;
            ctx.bill.slots.forEach(s => { state.history[s.band.id] = state.day; });
            state.shows++;
            if (res.net < 0) lossShows++;
            state.vibes = (state.vibes || []).concat(res.sat.score);
            if (VERBOSE && state.shows % 10 === 0) {
                log.push(`  show ${state.shows} day ${state.day} ${venue.id} att ${plan.attendance}/${ctx.report.legalCap} $${ctx.price} vibe ${res.sat.score} net $${res.net.toLocaleString()} funds $${Math.round(state.funds).toLocaleString()} rep ${state.rep.toFixed(1)} head ${ctx.bill.headliner.name}`);
            }
        }
        state.day++;
        if (Sim.dayIdxOf(state.day) === 0) {
            state.funds -= venue.weekly;
            if (state.funds < 0) { bankrupt = true; log.push(`BANKRUPT day ${state.day}`); break; }
        }
        if (venue.id === 'stadium' && state.funds > 5e6) break;
    }
    return { state, reached, log, bankrupt, lossShows };
}

const results = [];
for (let i = 1; i <= RUNS; i++) {
    const r = run(i * 31 + 7);
    results.push(r);
    if (VERBOSE || i === 1) { console.log(`--- run ${i} ---`); r.log.forEach(l => console.log(l)); }
}
console.log('\nVenue reached (median day):');
D.VENUES.forEach(v => {
    const days = results.map(r => r.reached[v.id]).filter(Boolean).sort((a, b) => a - b);
    console.log(`  ${v.name.padEnd(26)} ${days.length}/${RUNS} runs, median day ${days.length ? days[Math.floor(days.length / 2)] : '-'}`);
});
console.log(`Avg vibe: ${(results.reduce((s, r) => s + r.state.vibes.reduce((a, b) => a + b, 0), 0) / results.reduce((s, r) => s + r.state.vibes.length, 0)).toFixed(1)}`);
console.log(`Bankruptcies: ${results.filter(r => r.bankrupt).length}/${RUNS}`);
console.log(`Losing shows: ${(results.reduce((s, r) => s + r.lossShows, 0) / results.reduce((s, r) => s + r.state.shows, 0) * 100).toFixed(1)}%`);
