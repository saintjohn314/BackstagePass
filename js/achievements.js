/* =====================================================================
   BACKSTAGE PASS — Awards (goals & achievements)
   Milestones the player earns while building the empire. They're
   trophies only: unlocking one never changes the economy. Each award
   is checked from the save state, so old saves earn what they already
   deserve the first time they load.
   ===================================================================== */

(() => {
    if (typeof Game === 'undefined' || typeof Sim === 'undefined') return;

    const bestBy = (log, key) => log.reduce((m, l) => Math.max(m, l[key]), -Infinity);
    const tierOfName = name => { const b = DATA.BANDS.find(x => x.name === name); return b ? b.tier : name === DATA.OPEN_MIC.name ? 1 : 0; };
    const profitStreak = log => { let n = 0; for (let i = log.length - 1; i >= 0 && log[i].net > 0; i--) n++; return n; };
    const venueByTier = t => DATA.VENUES.find(v => v.tier === t);

    // lvl: rough difficulty, used to suggest the next goal. secret: hidden until earned.
    const AWARDS = [
        // ---- First steps
        { id: 'keys', cat: 'first', lvl: 1, icon: 'key', name: 'Keys in Hand', desc: 'Lease your first venue.',
            check: s => s.stats.maxVenueTier >= 0 },
        { id: 'build', cat: 'first', lvl: 1, icon: 'blueprint', name: 'Sweat Equity', desc: 'Approve your first build-out.',
            check: s => s.stats.buildSpent > 0 },
        { id: 'first_show', cat: 'first', lvl: 1, icon: 'ticket', name: 'Opening Night', desc: 'Host your first show.',
            check: s => s.stats.shows >= 1 },
        { id: 'first_profit', cat: 'first', lvl: 1, icon: 'cash', name: 'In the Black', desc: 'Turn a profit on a show.',
            check: s => s.stats.bestNet > 0 },
        { id: 'open_mic', cat: 'first', lvl: 2, icon: 'music', name: 'Sign-Up Sheet', desc: 'Host an open mic night.',
            check: s => s.stats.openMics >= 1 },

        // ---- On stage
        { id: 'shows_10', cat: 'stage', lvl: 2, icon: 'users', name: 'Regulars Know Your Name', desc: 'Host 10 shows.',
            check: s => s.stats.shows >= 10, progress: s => [s.stats.shows, 10] },
        { id: 'shows_50', cat: 'stage', lvl: 4, icon: 'users', name: 'Fifty Nights', desc: 'Host 50 shows.',
            check: s => s.stats.shows >= 50, progress: s => [s.stats.shows, 50] },
        { id: 'shows_150', cat: 'stage', lvl: 5, icon: 'users', name: 'Lifer', desc: 'Host 150 shows.',
            check: s => s.stats.shows >= 150, progress: s => [s.stats.shows, 150] },
        { id: 'sellout', cat: 'stage', lvl: 2, icon: 'ticket', name: 'Sold Out', desc: 'Pack the room to legal capacity.',
            check: s => s.stats.sellouts >= 1 },
        { id: 'sellouts_10', cat: 'stage', lvl: 3, icon: 'ticket', name: 'Hottest Ticket in Town', desc: 'Sell out 10 shows.',
            check: s => s.stats.sellouts >= 10, progress: s => [s.stats.sellouts, 10] },
        { id: 'vibe_90', cat: 'stage', lvl: 3, icon: 'star', name: 'A Night to Remember', desc: 'Get a crowd vibe of 90 or higher.',
            check: s => s.stats.bestVibe >= 90, progress: s => [Math.max(0, s.stats.bestVibe), 90] },
        { id: 'streak_5', cat: 'stage', lvl: 2, icon: 'bolt', name: 'Hot Streak', desc: 'Turn a profit five shows in a row.',
            check: s => s.stats.bestStreak >= 5, progress: s => [Math.min(5, profitStreak(s.log)), 5] },
        { id: 'crises_10', cat: 'stage', lvl: 3, icon: 'warn', name: 'Cool Under Pressure', desc: 'Handle 10 mid-show crises.',
            check: s => s.stats.crises >= 10, progress: s => [s.stats.crises, 10] },
        { id: 'trainwreck', cat: 'stage', lvl: 2, icon: 'x', secret: true, name: 'Trainwreck', desc: 'Sit through a set rated under one star.',
            check: s => s.stats.worstSet !== null && s.stats.worstSet < 1 },

        // ---- Talent
        { id: 'tier3', cat: 'talent', lvl: 2, icon: 'music', name: 'Regional Draw', desc: 'Book a Regional Act as your headliner.',
            check: s => s.stats.topTier >= 3 },
        { id: 'tier5', cat: 'talent', lvl: 4, icon: 'music', name: 'Theater Headliner', desc: 'Book a Theater Headliner as your headliner.',
            check: s => s.stats.topTier >= 5 },
        { id: 'tier7', cat: 'talent', lvl: 5, icon: 'star', name: 'Superstar on the Bill', desc: 'Book a Stadium Superstar.',
            check: s => s.stats.topTier >= 7 },

        // ---- Money
        { id: 'bank_50k', cat: 'money', lvl: 3, icon: 'cash', name: 'Fifty Grand', desc: 'Have $50,000 in the bank.',
            check: s => s.funds >= 50000, progress: s => [Math.max(0, s.funds), 50000], money: true },
        { id: 'night_10k', cat: 'money', lvl: 3, icon: 'cash', name: 'Big Night', desc: 'Clear $10,000 profit on a single show.',
            check: s => s.stats.bestNet >= 10000, progress: s => [Math.max(0, s.stats.bestNet || 0), 10000], money: true },
        { id: 'revenue_1m', cat: 'money', lvl: 4, icon: 'cash', name: 'Million-Dollar Promoter', desc: 'Take in $1,000,000 in lifetime revenue.',
            check: s => s.stats.revenue >= 1e6, progress: s => [s.stats.revenue, 1e6], money: true },
        { id: 'bank_1m', cat: 'money', lvl: 5, icon: 'cash', name: 'Seven Figures', desc: 'Have $1,000,000 in the bank.',
            check: s => s.funds >= 1e6, progress: s => [Math.max(0, s.funds), 1e6], money: true },
        { id: 'builder', cat: 'money', lvl: 4, icon: 'blueprint', name: 'Master Builder', desc: 'Spend $100,000 on build-outs.',
            check: s => s.stats.buildSpent >= 100000, progress: s => [s.stats.buildSpent, 100000], money: true },

        // ---- Empire
        { id: 'grade_b', cat: 'empire', lvl: 2, icon: 'star', name: 'Scene Staple', desc: 'Reach a B reputation.',
            check: s => s.rep >= 25, progress: s => [s.rep, 25] },
        { id: 'grade_a', cat: 'empire', lvl: 3, icon: 'star', name: 'Regional Powerhouse', desc: 'Reach an A reputation.',
            check: s => s.rep >= 45, progress: s => [s.rep, 45] },
        { id: 'grade_s', cat: 'empire', lvl: 5, icon: 'star', name: 'Top of the Bill', desc: 'Reach an S reputation.',
            check: s => s.rep >= 85, progress: s => [s.rep, 85] },
        { id: 'two_venues', cat: 'empire', lvl: 3, icon: 'map', name: 'Expansion', desc: 'Run two venues at the same time.',
            check: s => Object.values(s.venues).filter(v => v.leased).length >= 2 },
        { id: 'theatre', cat: 'empire', lvl: 4, icon: 'key', name: 'Velvet Seats', desc: `Lease the ${venueByTier(5).name}.`,
            check: s => s.stats.maxVenueTier >= 5 },
        { id: 'stadium', cat: 'empire', lvl: 5, icon: 'key', name: 'Stadium Rock', desc: `Lease the ${venueByTier(7).name}.`,
            check: s => s.stats.maxVenueTier >= 7 },
        { id: 'legend', cat: 'empire', lvl: 5, icon: 'star', name: 'Living Legend', desc: `Sell out the ${venueByTier(7).name}.`,
            check: s => !!s.flags.legend },
        { id: 'comeback', cat: 'empire', lvl: 3, icon: 'bolt', secret: true, name: 'Back from the Brink', desc: 'Miss rent, then get back in the black before the landlord changes the locks.',
            check: s => s.stats.comebacks >= 1 }
    ];
    const CATS = [
        { id: 'first', name: 'First steps' }, { id: 'stage', name: 'On stage' }, { id: 'talent', name: 'Talent' },
        { id: 'money', name: 'Money' }, { id: 'empire', name: 'Empire' }
    ];
    const NEW_STATS = { openMics: 0, crises: 0, bestVibe: 0, topTier: 0, bestStreak: 0, worstSet: null, comebacks: 0, maxVenueTier: -1 };

    Game.AWARDS = AWARDS;

    // New stats the awards rely on, filled in for saves made before awards existed.
    Game.prepareAwards = function () {
        const s = this.state;
        if (!s) return;
        s.stats = Object.assign({}, NEW_STATS, s.stats);
        if (!s.achievements) {
            s.achievements = {};
            const log = s.log || [];
            if (log.length) {
                s.stats.bestVibe = Math.max(s.stats.bestVibe, bestBy(log, 'vibe'));
                s.stats.bestNet = Math.max(s.stats.bestNet === null ? -Infinity : s.stats.bestNet, bestBy(log, 'net'));
                s.stats.topTier = Math.max(s.stats.topTier, ...log.map(l => tierOfName(l.headliner)));
                s.stats.openMics = Math.max(s.stats.openMics, log.filter(l => l.headliner === DATA.OPEN_MIC.name).length);
                let run = 0;
                log.forEach(l => { run = l.net > 0 ? run + 1 : 0; s.stats.bestStreak = Math.max(s.stats.bestStreak, run); });
            }
        }
        // Remember the biggest room ever leased, even after its lease ends.
        Object.keys(s.venues).forEach(id => { s.stats.maxVenueTier = Math.max(s.stats.maxVenueTier, this.vDef(id).tier); });
    };

    // Record the stats a finished show adds. Called from finishShow before the awards check.
    Game.recordShowForAwards = function (ctx, plan, r) {
        this.prepareAwards();
        const st = this.state.stats;
        st.bestNet = st.bestNet === null ? r.net : Math.max(st.bestNet, r.net);
        st.bestVibe = Math.max(st.bestVibe, r.sat.score);
        st.topTier = Math.max(st.topTier, ctx.bill.headliner.tier || 0);
        if (ctx.bill.openMic) st.openMics++;
        st.bestStreak = Math.max(st.bestStreak, profitStreak(this.state.log));
        const worst = Math.min(...plan.performances);
        st.worstSet = st.worstSet === null ? worst : Math.min(st.worstSet, worst);
    };

    // Unlock anything newly earned. Returns the awards unlocked by this call.
    Game.checkAwards = function (opts) {
        const s = this.state;
        if (!s) return [];
        this.prepareAwards();
        const fresh = AWARDS.filter(a => !s.achievements[a.id] && a.check(s));
        fresh.forEach(a => { s.achievements[a.id] = s.day; });
        if (fresh.length && !(opts && opts.silent)) this.announceAwards(fresh);
        return fresh;
    };

    Game.announceAwards = function (list) {
        SoundManager.playSFX('save-ding');
        list.slice(0, 3).forEach((a, i) => setTimeout(() => this.toast(
            `<span class="award-toast">${icon('trophy')}<span><small>AWARD UNLOCKED</small><b>${esc(a.name)}</b>${esc(a.desc)}</span></span>`, 'award'), i * 450));
        if (list.length > 3) setTimeout(() => this.toast(`…and ${list.length - 3} more. See them in the office.`, 'award'), 3 * 450);
    };

    // Called right after a save loads: back-fill, then quietly hand out what's already earned.
    Game.awardsOnLoad = function () {
        const fresh = this.checkAwards({ silent: true });
        if (fresh.length) setTimeout(() => this.toast(`${icon('trophy')} ${fresh.length} award${fresh.length > 1 ? 's' : ''} unlocked from your past shows.`, 'award'), 900);
    };

    const fracOf = (a, s) => { if (!a.progress) return 0; const [c, m] = a.progress(s); return Math.max(0, Math.min(1, c / m)); };
    const progressText = (a, s) => {
        const [c, m] = a.progress(s);
        const f = n => a.money ? fmtK(n) : Math.floor(n).toLocaleString();
        return `${f(Math.min(c, m))} / ${f(m)}`;
    };

    Game.nextAward = function () {
        const s = this.state;
        const open = AWARDS.filter(a => !s.achievements[a.id] && !a.secret);
        open.sort((a, b) => a.lvl - b.lvl || fracOf(b, s) - fracOf(a, s));
        return open[0] || null;
    };

    // Office card: count, meter, and the next goal to chase.
    Game.renderOfficeAwards = function () {
        const el = document.getElementById('office-awards');
        if (!el || !this.state) return;
        this.prepareAwards();
        const s = this.state;
        const got = AWARDS.filter(a => s.achievements[a.id]).length;
        const next = this.nextAward();
        el.innerHTML = `<div class="awards-card-head"><span class="eyebrow">${icon('trophy')}Awards</span><b>${got} / ${AWARDS.length}</b></div>
            <div class="awards-meter"><div style="width:${got / AWARDS.length * 100}%"></div></div>
            ${next ? `<div class="awards-next"><span>Next goal</span><b>${esc(next.name)}</b><small>${esc(next.desc)}${next.progress ? ` · ${progressText(next, s)}` : ''}</small></div>`
                : '<div class="awards-next"><b>Every award won.</b><small>A true living legend.</small></div>'}`;
        // Gold records on the office shelf, one per award, up to the shelf's room.
        const shelf = document.getElementById('office-shelf');
        if (shelf) {
            const room = 5;
            shelf.querySelector('.shelf-records').innerHTML = Array.from({ length: room }, (_, i) =>
                `<i class="${i < Math.ceil(got / AWARDS.length * room) ? 'won' : ''}"></i>`).join('');
        }
    };

    Game.renderAwards = function () {
        const s = this.state;
        const body = document.getElementById('awards-body');
        if (!body || !s) return;
        this.prepareAwards();
        const got = AWARDS.filter(a => s.achievements[a.id]).length;
        document.getElementById('awards-note').textContent = `${got} of ${AWARDS.length} unlocked`;
        const card = a => {
            const day = s.achievements[a.id];
            const hidden = a.secret && !day;
            const foot = day ? `<span class="award-when">${icon('check')}Week ${Sim.weekOf(day)} · ${DATA.DAYS[Sim.dayIdxOf(day)]}</span>`
                : a.progress && !hidden ? `<div class="award-prog"><div style="width:${fracOf(a, s) * 100}%"></div></div><span class="award-when">${progressText(a, s)}</span>`
                    : `<span class="award-when">${hidden ? 'Secret award' : 'Locked'}</span>`;
            return `<div class="award ${day ? 'won' : ''} ${hidden ? 'secret' : ''}">
                <span class="award-icon">${icon(hidden ? 'key' : a.icon)}</span>
                <div class="award-body"><b>${hidden ? '???' : esc(a.name)}</b><p>${hidden ? 'Keep playing to find out.' : esc(a.desc)}</p>${foot}</div>
            </div>`;
        };
        body.innerHTML = `<div class="awards-summary"><div><span>Unlocked</span><b>${got} / ${AWARDS.length}</b></div><div class="awards-meter big"><div style="width:${got / AWARDS.length * 100}%"></div></div></div>`
            + CATS.map(c => `<h3 class="awards-cat">${c.name}</h3><div class="award-grid">${AWARDS.filter(a => a.cat === c.id).map(card).join('')}</div>`).join('');
    };

    // Post-show: list tonight's unlocks under the reputation box.
    Game.renderPostAwards = function (list) {
        const el = document.getElementById('post-rep');
        if (!el || !list || !list.length) return;
        el.insertAdjacentHTML('beforeend', `<div class="post-awards"><h4>${icon('trophy')}Awards unlocked tonight</h4>${list.map(a => `<div class="vb-row"><span><b>${esc(a.name)}</b></span><small>${esc(a.desc)}</small></div>`).join('')}</div>`);
    };
})();
