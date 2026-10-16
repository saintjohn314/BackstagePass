/* =====================================================================
   BACKSTAGE PASS — Quick Build
   One click drafts a working starter layout for the room you're in:
   restrooms, main speakers, a bar, stage lights, a mix booth and a
   merch table. It only drafts the plan and never spends past your
   rent money — you still review it and hit APPROVE CONSTRUCTION.
   ===================================================================== */

(() => {
    if (typeof Game === 'undefined' || typeof Sim === 'undefined') return;

    // Every square an item of this footprint could start on.
    function allSpots(v, w, h) {
        const out = [];
        for (let r = 0; r + h <= v.rows; r++) for (let c = 0; c + w <= v.cols; c++) out.push({ r, c, w, h });
        return out;
    }

    // Lower score = better spot, per item type.
    function scorer(v, type, draft) {
        const base = typeScorer(v, type, draft);
        if (DATA.ITEMS[type].rule === 'onStage') return base;
        // Keep the walkway inside every door open
        const doors = v.doors.map(d => Sim.doorCell(v, d));
        const blocksDoor = s => doors.some(dc => dc.r >= s.r - 1 && dc.r <= s.r + s.h && dc.c >= s.c - 1 && dc.c <= s.c + s.w);
        return s => base(s) + (blocksDoor(s) ? 8 : 0);
    }

    function typeScorer(v, type, draft) {
        const st = v.stage;
        const midC = (v.cols - 1) / 2;
        const main = v.doors.find(d => d.kind === 'main');
        const md = main ? Sim.doorCell(v, main) : { r: v.rows - 1, c: Math.floor(v.cols / 2) };
        const cx = s => s.c + (s.w - 1) / 2, cy = s => s.r + (s.h - 1) / 2;
        const near = (s, list) => list.some(i => s.r <= i.r + i.h && i.r <= s.r + s.h && s.c <= i.c + i.w && i.c <= s.c + s.w);
        switch (type) {
            case 'restroom':
                // Corners and the back wall, far from the stage
                return s => -cy(s) * 2 + Math.min(cx(s), v.cols - 1 - cx(s)) * 0.6 + (s.w > s.h ? 0 : 0.5);
            case 'pa': {
                const left = draft.filter(i => i.type === 'pa' && i.c < st.x).length;
                const right = draft.filter(i => i.type === 'pa' && i.c >= st.x + st.w).length;
                const wantLeft = left <= right;
                return s => {
                    const flank = wantLeft ? Math.abs(s.c - (st.x - 1)) : Math.abs(s.c - (st.x + st.w));
                    return flank * 2 + s.r;
                };
            }
            case 'delay':
                return s => Math.abs(cy(s) - (st.d + (v.rows - st.d) * 0.65)) + Math.min(Math.abs(cx(s) - v.cols * 0.3), Math.abs(cx(s) - v.cols * 0.7));
            case 'foh':
                return s => Math.abs(cx(s) - midC) * 1.5 + Math.abs(cy(s) - (st.d + (v.rows - st.d) * 0.62));
            case 'bar': {
                const bars = draft.filter(i => i.type === 'bar' || i.type === 'cocktail');
                if (bars.length) return s => (near(s, bars) ? 0 : 50) + Math.abs(cy(s) - cy(bars[0])) + Math.abs(cx(s) - cx(bars[0])) * 3;
                const mid = st.d + (v.rows - st.d) / 2;
                return s => (s.c === 0 || s.c === v.cols - 1 ? 0 : 40) + Math.abs(cy(s) - mid) + (s.c === 0 ? 0 : 0.3);
            }
            case 'pars':
            case 'movers': {
                const mid = st.x + (st.w - 1) / 2;
                return s => -Math.abs(s.c - mid) + s.r * 0.1;
            }
            case 'merch':
                return s => Math.abs(s.r - md.r) * 1.2 + Math.abs(s.c - md.c) + (Math.abs(s.c - md.c) + Math.abs(s.r - md.r) <= 1 ? 6 : 0);
            default:
                return () => 0;
        }
    }

    // Place one item of `type` at the best spot that doesn't make the room worse.
    function placeOne(v, draft, floor, type) {
        const def = DATA.ITEMS[type];
        const shapes = [[def.w, def.h]];
        if (def.rotatable && def.w !== def.h) shapes.push([def.h, def.w]);
        const before = Sim.analyze(v, draft, floor);
        const score = scorer(v, type, draft);
        let spots = [];
        shapes.forEach(([w, h]) => { spots = spots.concat(allSpots(v, w, h)); });
        spots.sort((a, b) => score(a) - score(b));
        for (const s of spots) {
            if (!Sim.canPlace(v, draft, type, s.r, s.c, s.w, s.h).ok) continue;
            const item = { id: Game.state.nextId, type, r: s.r, c: s.c, w: s.w, h: s.h, paid: null };
            const after = Sim.analyze(v, draft.concat([item]), floor);
            if (after.violations.length > before.violations.length) continue;
            if (after.trapped.length > before.trapped.length) continue;
            if (after.unreachable.length > before.unreachable.length) continue;
            Game.state.nextId++;
            return item;
        }
        return null;
    }

    Game.quickBuild = function () {
        const d = this.ui.designer;
        if (!d) return;
        const v = this.designerDef();
        const floor = d.floor;
        // Keep a week's rent in the bank.
        let budget = this.state.funds - Math.max(0, this.pendingChanges().net) - v.weekly;
        const draft = d.draft.slice();
        const added = [], skipped = new Set();
        const count = t => draft.filter(i => i.type === t).length;
        const report = () => Sim.analyze(v, draft, floor);

        const add = type => {
            const cost = Sim.itemCost(v, type);
            if (cost > budget) { skipped.add(DATA.ITEMS[type].name); return false; }
            const it = placeOne(v, draft, floor, type);
            if (!it) return false;
            draft.push(it); added.push(it); budget -= cost;
            return true;
        };

        // 1. A working restroom (no permit without one)
        if (report().restrooms === 0) add('restroom');
        // 2. Main speakers on both sides of the stage
        const mains = () => draft.filter(i => DATA.ITEMS[i.type].rule === 'nearStage' && DATA.ITEMS[i.type].radius).length;
        while (mains() < 2 && add('pa')) { /* keep going */ }
        // 3. A bar along a side wall
        if (report().barCap === 0) add('bar');
        // 4. Enough stage light for the room (moving heads on big stages, fewer fixtures in the band's way)
        let guard = 0;
        while (guard++ < 8) {
            const a = report();
            const need = a.lightIdeal - a.lightPts;
            if (need <= 0) break;
            if (!(v.stage.d >= 2 && need >= 2 && add('movers')) && !add('pars')) break;
        }
        // 5. A mix booth so sound isn't capped
        if (!count('foh')) add('foh');
        // 6. Fill dead sound at the back of big rooms
        guard = 0;
        while (report().soundCoverage < 0.85 && guard++ < 3 && add('delay')) { /* keep going */ }
        // 7. A merch table by the door
        if (report().merchCap === 0) add('merch');
        // 8. With money left over: more restroom capacity, then a bar that can keep up
        guard = 0;
        while (guard++ < 2) {
            const a = report();
            if (a.restroomCap >= a.floorCap * 0.6 || !add('restroom')) break;
        }
        guard = 0;
        while (guard++ < 3) {
            const a = report();
            if (a.barCap >= a.legalCap || !add('bar')) break;
        }

        if (!added.length) {
            const why = skipped.size ? `Not enough cash for ${[...skipped].join(', ')} after rent.` : 'Your layout already covers the basics.';
            this.setHint(`Quick Build: ${why}`, skipped.size ? 'bad' : 'good');
            this.toast(`Quick Build: ${why}`, skipped.size ? 'bad' : '');
            return;
        }
        d.draft = draft;
        this.refreshDesigner();
        const cost = added.reduce((s, i) => s + Sim.itemCost(v, i.type), 0);
        const names = {};
        added.forEach(i => { const n = DATA.ITEMS[i.type].name; names[n] = (names[n] || 0) + 1; });
        const list = Object.entries(names).map(([n, k]) => (k > 1 ? `${k}× ` : '') + n).join(', ');
        const short = skipped.size ? ` Couldn't afford ${[...skipped].join(', ')} yet (keeping a week's rent).` : '';
        this.setHint(`Quick Build drafted ${list} (${fmt(cost)}). Look it over, then hit APPROVE CONSTRUCTION.${short}`, 'good');
        this.toast(`Quick Build: ${added.length} item${added.length > 1 ? 's' : ''} drafted for ${fmt(cost)}.`, 'good');
    };
})();
