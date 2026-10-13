/* =====================================================================
   BACKSTAGE PASS — game controller
   State, saving, screens and every interaction. Numbers come from Sim.
   ===================================================================== */

const SoundManager = {
    playSFX(id) {
        if (!Game.settings.sfxEnabled) return;
        const audio = document.getElementById(id);
        if (!audio) return;
        try {
            audio.currentTime = 0;
            audio.volume = Game.settings.volume / 100;
            audio.play().catch(() => {});
        } catch (e) { /* audio unavailable */ }
    }
};

document.addEventListener('click', event => {
    const t = event.target.closest('button');
    if (t && !t.disabled) SoundManager.playSFX('click-sound');
});

const MENU_SCREENS = ['screen-splash', 'screen-main-menu', 'screen-settings', 'screen-intro'];
const SCREEN_ART = {
    'screen-main-menu': 'menu', 'screen-settings': 'settings', 'screen-intro': 'intro', 'screen-identity-setup': 'identity',
    'screen-venue-selector': 'market', 'screen-floor-designer': 'blueprint', 'screen-office': 'office', 'screen-books': 'office',
    'screen-band-scouting': 'scout', 'screen-marketing': 'marketing', 'screen-event-card': 'event',
    'screen-live-show': 'live', 'screen-post-show': 'postshow'
};

const fmt = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const fmtSigned = n => (n >= 0 ? '+$' : '-$') + Math.abs(Math.round(n)).toLocaleString();
const fmtK = n => {
    const a = Math.abs(n), s = n < 0 ? '-$' : '$';
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
    if (a >= 1e4) return s + Math.round(a / 1000) + 'K';
    return s + Math.round(a).toLocaleString();
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls) => `<svg class="ic ${cls || ''}"><use href="#i-${id}"/></svg>`;
const stars = q => { const n = Math.max(0, Math.min(5, Math.round(q))); return '★'.repeat(n) + '☆'.repeat(5 - n); };
const clone = o => JSON.parse(JSON.stringify(o));

const Game = {
    state: null,
    settings: { volume: 80, music: 70, sfxEnabled: true, speed: 1, quality: 'high' },
    ui: { screen: 'screen-splash', prev: 'screen-main-menu', designer: null, booking: null, live: null, lastResult: null },
    scene: null,
    rng: Math.random,

    /* =================================================================
       Boot
       ================================================================= */
    init() {
        this.loadSettings();
        this.refreshMenu();
        document.addEventListener('keydown', e => this.handleKeyPress(e));
        window.addEventListener('resize', () => { if (this.scene) this.scene.resize(); });
        const vol = document.getElementById('setting-vol-slider');
        vol.value = this.settings.volume;
        document.getElementById('setting-music-slider').value = this.settings.music;
        this.updateSettingsFromUI(true);
        this.renderSettingsControls();
        document.getElementById('input-venue-custom-name').addEventListener('input', e => {
            document.getElementById('identity-neon').textContent = e.target.value || ' ';
        });
        this.switchScreen('screen-splash');
        document.getElementById('screen-splash').focus();
    },

    /* =================================================================
       Persistence
       ================================================================= */
    defaultState() {
        return {
            version: 6,
            seed: Math.floor(Math.random() * 1e9),
            funds: DATA.START_FUNDS, rep: DATA.START_REP, hype: 0, day: 1,
            companyName: 'Underground Empire',
            activeVenueId: null,
            venues: {},
            history: {},
            roster: null,
            log: [],
            repLog: [[1, 0]],
            stats: { revenue: 0, profit: 0, shows: 0, bestNet: null, bestAttendance: 0, rentPaid: 0, buildSpent: 0, sellouts: 0 },
            nextId: 1,
            overdue: false,
            flags: { named: false, legend: false }
        };
    },

    loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(DATA.SETTINGS_KEY) || 'null');
            if (s) Object.assign(this.settings, s);
        } catch (e) { /* storage unavailable */ }
    },

    saveSettings() {
        try { localStorage.setItem(DATA.SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
    },

    readSave() {
        try {
            const raw = localStorage.getItem(DATA.SAVE_KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            return s && s.version === 6 ? s : null;
        } catch (e) { return null; }
    },

    saveGame(silent) {
        if (!this.state) return false;
        try {
            this.state.savedAt = Date.now();
            localStorage.setItem(DATA.SAVE_KEY, JSON.stringify(this.state));
            if (!silent) { SoundManager.playSFX('save-ding'); this.toast('Progress saved.', 'good'); }
            this.refreshMenu();
            return true;
        } catch (e) {
            this.toast('Could not save — browser storage is unavailable.', 'bad');
            return false;
        }
    },

    manualSave() { this.saveGame(false); },
    saveGameFromMenu() { this.saveGame(false); },

    loadGame() {
        const saved = this.readSave();
        if (!saved) { this.toast('No saved tour found.', 'bad'); return; }
        // Fill in anything a slightly older save might be missing.
        const base = this.defaultState();
        this.state = Object.assign(base, saved);
        this.state.stats = Object.assign(base.stats, saved.stats || {});
        this.state.flags = Object.assign(base.flags, saved.flags || {});
        this.ui.booking = null;
        this.ui.live = null;
        Music.stop();
        this.switchScreen(this.state.activeVenueId ? 'screen-office' : 'screen-venue-selector');
        this.toast(`Welcome back, ${this.state.companyName}.`, 'good');
    },

    confirmDeleteSave() {
        this.modal({
            title: 'DELETE SAVED GAME?',
            html: '<p>This permanently erases your saved tour on this device.</p>',
            actions: [
                { label: 'CANCEL', cls: 'btn-secondary' },
                { label: 'DELETE', cls: 'btn-primary', onClick: () => {
                    try { localStorage.removeItem(DATA.SAVE_KEY); } catch (e) { /* ignore */ }
                    this.state = null;
                    this.refreshMenu();
                    this.toast('Saved game deleted.');
                } }
            ]
        });
    },

    refreshMenu() {
        const save = this.readSave();
        const cont = document.getElementById('continue-btn');
        const info = document.getElementById('menu-save-info');
        const saveBtn = document.getElementById('save-menu-btn');
        cont.hidden = !save;
        const ng = document.getElementById('new-game-btn');
        ng.className = save ? 'btn btn-secondary' : 'btn btn-primary';
        saveBtn.hidden = !(this.state && this.state.activeVenueId);
        if (save) {
            const v = save.activeVenueId && save.venues[save.activeVenueId];
            info.textContent = `${save.companyName.slice(0, 18)} · WK ${Sim.weekOf(save.day)}${v ? '' : ''}`;
        } else {
            info.textContent = 'NO SAVED TOUR';
        }
    },

    /* =================================================================
       Helpers
       ================================================================= */
    vDef(id) { return Sim.venueDef(id); },
    vState(id) { return this.state.venues[id]; },
    activeDef() { return this.state.activeVenueId ? this.vDef(this.state.activeVenueId) : null; },
    activeState() { return this.state.activeVenueId ? this.vState(this.state.activeVenueId) : null; },
    reportFor(id, items, floor) {
        const vs = this.vState(id);
        return Sim.analyze(this.vDef(id), items || vs.items, floor || vs.floor);
    },
    leasedIds() { return Object.keys(this.state.venues).filter(id => this.state.venues[id].leased); },
    weeklyOverhead() { return this.leasedIds().reduce((s, id) => s + this.vDef(id).weekly, 0); },
    daysToRent() { const idx = Sim.dayIdxOf(this.state.day); return idx === 0 ? 7 : 7 - idx; },

    changeFunds(delta) {
        this.state.funds += delta;
        const el = document.getElementById('hud-cash');
        if (el && delta !== 0) {
            el.classList.remove('flash-up', 'flash-down');
            void el.offsetWidth;
            el.classList.add(delta > 0 ? 'flash-up' : 'flash-down');
        }
        this.updateHUD();
    },

    /* =================================================================
       Screens, HUD, modals, toasts
       ================================================================= */
    switchScreen(screenId) {
        const prev = this.ui.screen;
        if (prev === 'screen-live-show' && screenId !== 'screen-live-show') this.stopLiveTimer();
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
        if (screenId !== 'screen-settings') this.ui.prev = screenId;
        this.ui.screen = screenId;

        const art = SCREEN_ART[screenId];
        document.getElementById('game-background').style.backgroundImage = art ? `url('img/${art}.svg')` : '';

        const showHud = !!this.state && !MENU_SCREENS.includes(screenId);
        document.getElementById('hud').classList.toggle('hidden', !showHud);
        document.body.classList.toggle('has-hud', showHud);

        if (MENU_SCREENS.includes(screenId)) {
            if (screenId !== 'screen-splash' || Music.started) Music.play('menu');
        } else if (screenId !== 'screen-live-show') {
            Music.stop();
        }

        if (this.scene && screenId !== 'screen-floor-designer' && screenId !== 'screen-live-show') this.scene.pause();

        switch (screenId) {
            case 'screen-main-menu': this.refreshMenu(); break;
            case 'screen-venue-selector': this.renderVenues(); break;
            case 'screen-floor-designer': this.renderDesigner(); break;
            case 'screen-office': this.renderOffice(); break;
            case 'screen-books': this.renderBooks(); break;
            case 'screen-band-scouting': this.renderBands(); break;
            case 'screen-marketing': this.renderSetup(); break;
        }
        if (showHud) this.updateHUD();
        const scrollers = target ? target.querySelectorAll('.scroll') : [];
        scrollers.forEach(s => { s.scrollTop = 0; });
    },

    goBack() {
        this.saveSettings();
        this.switchScreen(this.ui.prev && this.ui.prev !== 'screen-settings' ? this.ui.prev : 'screen-main-menu');
    },

    updateHUD() {
        if (!this.state) return;
        const s = this.state;
        const vs = this.activeState();
        document.getElementById('hud-company').textContent = s.companyName;
        document.getElementById('hud-venue').textContent = vs ? vs.name : 'No venue yet';
        const cash = document.getElementById('hud-cash');
        cash.textContent = fmt(s.funds);
        cash.classList.toggle('neg', s.funds < 0);
        document.getElementById('hud-week').textContent = 'Week ' + Sim.weekOf(s.day);
        document.getElementById('hud-day').textContent = DATA.DAY_NAMES[Sim.dayIdxOf(s.day)];
        const g = Sim.gradeOf(s.rep);
        document.getElementById('hud-grade').textContent = g.grade;
        document.getElementById('hud-rep-fill').style.width = Math.min(100, s.rep) + '%';
        const rent = this.weeklyOverhead();
        const d = this.daysToRent();
        const rentEl = document.getElementById('hud-rent');
        rentEl.textContent = rent ? `${fmt(rent)} in ${d}d` : '—';
        rentEl.classList.toggle('warn', rent > 0 && s.funds < rent);
    },

    modal({ title, html, actions, dismissable = true }) {
        const root = document.getElementById('modal-root');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = html || '';
        const act = document.getElementById('modal-actions');
        act.innerHTML = '';
        (actions || [{ label: 'OK', cls: 'btn-primary' }]).forEach(a => {
            const b = document.createElement('button');
            b.className = 'btn ' + (a.cls || 'btn-secondary');
            b.textContent = a.label;
            if (a.disabled) b.disabled = true;
            b.onclick = () => { if (!a.keepOpen) this.closeModal(); if (a.onClick) a.onClick(); };
            act.appendChild(b);
        });
        root.dataset.dismissable = dismissable ? '1' : '';
        root.classList.remove('hidden');
        root.onclick = e => { if (e.target === root && root.dataset.dismissable) this.closeModal(); };
        const first = act.querySelector('button:last-child');
        if (first) setTimeout(() => first.focus(), 30);
    },

    closeModal() { document.getElementById('modal-root').classList.add('hidden'); },
    modalOpen() { return !document.getElementById('modal-root').classList.contains('hidden'); },

    // Kept for compatibility with the original API.
    showModalAlert(header, message) { this.modal({ title: header, html: `<p>${esc(message)}</p>` }); },

    toast(msg, tone) {
        const root = document.getElementById('toast-root');
        const t = document.createElement('div');
        t.className = 'toast ' + (tone || '');
        t.innerHTML = msg;
        root.appendChild(t);
        setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3400);
        while (root.children.length > 4) root.firstChild.remove();
    },

    /* =================================================================
       Menus
       ================================================================= */
    enterMainFromSplash() {
        Music.unlock();
        Music.setVolume(this.settings.music / 100 * this.settings.volume / 100);
        Music.play('menu');
        this.switchScreen('screen-main-menu');
    },

    startNewGame() {
        const begin = () => {
            this.state = this.defaultState();
            this.switchScreen('screen-intro');
        };
        if (this.readSave()) {
            this.modal({
                title: 'START OVER?',
                html: '<p>Starting a new game will overwrite your saved tour when you next save.</p>',
                actions: [{ label: 'CANCEL' }, { label: 'NEW GAME', cls: 'btn-primary', onClick: begin }]
            });
        } else begin();
    },

    beginCompany() { this.switchScreen('screen-venue-selector'); },

    openPauseMenu() {
        if (this.ui.screen === 'screen-live-show' && this.ui.live && !this.ui.live.done) this.setLivePaused(true);
        this.modal({
            title: 'PAUSED',
            html: `<p>${esc(this.state.companyName)} · Week ${Sim.weekOf(this.state.day)}, ${DATA.DAY_NAMES[Sim.dayIdxOf(this.state.day)]}</p>`,
            actions: [
                { label: 'RESUME', cls: 'btn-primary', onClick: () => this.setLivePaused(false) },
                { label: 'SAVE GAME', onClick: () => { this.saveGame(false); this.setLivePaused(false); } },
                { label: 'SETTINGS', onClick: () => { this.ui.prevBeforeSettings = this.ui.screen; this.switchScreen('screen-settings'); } },
                { label: 'QUIT TO MENU', onClick: () => this.quitToMenu() }
            ]
        });
    },

    quitToMenu() {
        const go = () => { this.stopLiveTimer(); this.switchScreen('screen-main-menu'); };
        if (this.ui.live && !this.ui.live.done) {
            this.modal({
                title: 'LEAVE MID-SHOW?',
                html: '<p>Tonight\'s show will be abandoned and upfront costs are lost. Your last save is kept.</p>',
                actions: [{ label: 'STAY' , onClick: () => this.setLivePaused(false) }, { label: 'LEAVE', cls: 'btn-primary', onClick: () => { this.ui.live = null; go(); } }]
            });
        } else {
            this.saveGame(true);
            go();
        }
    },

    renderSettingsControls() {
        const speed = document.getElementById('setting-speed');
        speed.innerHTML = [1, 2, 4].map(s => `<button class="${this.settings.speed === s ? 'on' : ''}" onclick="Game.setSetting('speed', ${s})">${s}×</button>`).join('');
        const q = document.getElementById('setting-quality');
        q.innerHTML = [['low', 'FAST'], ['high', 'PRETTY']].map(([k, l]) => `<button class="${this.settings.quality === k ? 'on' : ''}" onclick="Game.setSetting('quality', '${k}')">${l}</button>`).join('');
        document.getElementById('setting-sfx-btn').textContent = `SFX: ${this.settings.sfxEnabled ? 'ON' : 'OFF'}`;
    },

    setSetting(k, v) {
        this.settings[k] = v;
        this.saveSettings();
        this.renderSettingsControls();
        if (k === 'quality' && this.scene) this.scene.setQuality(v);
    },

    updateSettingsFromUI(silent) {
        const vol = parseInt(document.getElementById('setting-vol-slider').value, 10);
        const mus = parseInt(document.getElementById('setting-music-slider').value, 10);
        document.getElementById('setting-vol-val').textContent = vol;
        document.getElementById('setting-music-val').textContent = mus;
        this.settings.volume = vol;
        this.settings.music = mus;
        Music.setVolume((mus / 100) * (vol / 100));
        if (!silent) this.saveSettings();
    },

    toggleSFX() {
        this.settings.sfxEnabled = !this.settings.sfxEnabled;
        this.saveSettings();
        this.renderSettingsControls();
    },

    /* =================================================================
       Identity (company + venue name)
       ================================================================= */
    openIdentity() {
        const first = !this.state.flags.named;
        const vs = this.activeState();
        document.getElementById('identity-title').textContent = first ? 'ESTABLISH IDENTITY' : 'NAME YOUR NEW VENUE';
        document.getElementById('identity-company-group').classList.toggle('hidden', !first);
        document.getElementById('identity-story').innerHTML = first
            ? '<p>You\'ve got the keys to your first property! Before opening the doors, put your company\'s name on the paperwork and your venue\'s name on the sign.</p>'
            : `<p>New keys, new sign. What should ${esc(this.activeDef().name.toLowerCase())} be called?</p>`;
        document.getElementById('input-company-name').value = this.state.companyName;
        document.getElementById('input-venue-custom-name').value = vs.name;
        document.getElementById('identity-neon').textContent = vs.name;
        document.getElementById('identity-proceed').innerHTML = 'TO THE FLOOR PLAN' + icon('next');
        this.switchScreen('screen-identity-setup');
    },

    identityBack() { this.switchScreen('screen-venue-selector'); },

    saveIdentityAndProceed() {
        const comp = document.getElementById('input-company-name').value.trim();
        const ven = document.getElementById('input-venue-custom-name').value.trim();
        if (!this.state.flags.named && comp) this.state.companyName = comp.slice(0, 32);
        if (ven) this.activeState().name = ven.slice(0, 32);
        this.state.flags.named = true;
        this.saveGame(true);
        this.openDesigner();
    },

    /* =================================================================
       Venue marketplace
       ================================================================= */
    renderVenues() {
        const s = this.state;
        const anyLeased = this.leasedIds().length > 0;
        const back = document.getElementById('market-back');
        back.innerHTML = icon('back') + (anyLeased ? 'OFFICE' : 'BACK');
        back.onclick = () => this.switchScreen(anyLeased ? 'screen-office' : 'screen-intro');
        document.getElementById('market-note').textContent = anyLeased
            ? `Weekly overhead: ${fmt(this.weeklyOverhead())}`
            : 'Pick your first room. The deposit covers week one.';
        const list = document.getElementById('venue-list');
        list.innerHTML = DATA.VENUES.map(v => {
            const vs = s.venues[v.id];
            const leased = vs && vs.leased;
            const active = s.activeVenueId === v.id;
            const locked = !leased && s.rep < v.repReq;
            const afford = s.funds >= v.deposit;
            let actions;
            if (leased) {
                actions = `${active ? `<button class="btn btn-primary" onclick="Game.openDesigner()">${icon('blueprint')}DESIGN</button>`
                    : `<button class="btn btn-primary" onclick="Game.setActiveVenue('${v.id}')">MAKE ACTIVE</button>`}
                    <button class="btn btn-secondary" onclick="Game.endLease('${v.id}')">END LEASE</button>`;
            } else if (locked) {
                actions = `<div class="lock-reason">${icon('key')}Landlord wants a reputation of ${v.repReq}+ (you: ${Math.floor(s.rep)})</div>`;
            } else {
                actions = `<button class="btn ${afford ? 'btn-primary' : 'btn-secondary'}" onclick="Game.leaseVenue('${v.id}')" ${afford ? '' : 'disabled'}>LEASE · ${fmt(v.deposit)}</button>`;
            }
            const report = leased ? this.reportFor(v.id) : null;
            return `<article class="venue-card ${leased ? 'leased' : ''} ${active ? 'active-venue' : ''} ${locked ? 'locked' : ''}">
                <div class="venue-thumb">${Thumbs.venue(v.id)}
                    <span class="venue-rating">${v.rating}</span>
                    ${active ? '<span class="venue-badge">ACTIVE</span>' : leased ? '<span class="venue-badge dark">LEASED</span>' : ''}
                </div>
                <div class="venue-body">
                    <div><div class="venue-name">${esc(leased ? vs.name : v.name)}</div><div class="venue-type">${esc(v.name)} · ${(v.cols * v.tileFt)}×${(v.rows * v.tileFt)} ft</div></div>
                    <div class="venue-desc">${esc(v.desc)}</div>
                    <div class="perk"><b>${esc(v.perk.name)}:</b> ${esc(v.perk.desc)}</div>
                    <div class="spec-grid">
                        <span>Max standing</span><b>~${Sim.maxStanding(v).toLocaleString()}</b>
                        <span>${leased ? 'Legal capacity' : 'Signing deposit'}</span><b>${leased ? report.legalCap.toLocaleString() : fmt(v.deposit)}</b>
                        <span>Weekly rent</span><b>${fmt(v.weekly)}</b>
                        <span>Build costs</span><b>${v.perk.id === 'diy' ? '×0.8' : '×' + v.costScale}</b>
                    </div>
                    <div class="venue-actions">${actions}</div>
                </div>
            </article>`;
        }).join('');
    },

    leaseVenue(id) {
        const v = this.vDef(id);
        const s = this.state;
        if (s.rep < v.repReq) { this.toast(`The landlord wants reputation ${v.repReq}+.`, 'bad'); return; }
        if (s.funds < v.deposit) { this.toast(`You need ${fmt(v.deposit)} for the deposit.`, 'bad'); return; }
        const first = this.leasedIds().length === 0;
        this.modal({
            title: 'SIGN THE LEASE?',
            html: `<p><b>${esc(v.name)}</b> — ${esc(v.desc)}</p>
                <div class="ledger-mini">
                    <span>Signing deposit (due now)</span><b class="neg">${fmt(v.deposit)}</b>
                    <span>Rent, every Monday</span><b>${fmt(v.weekly)}/wk</b>
                    <span>Total weekly overhead after signing</span><b>${fmt(this.weeklyOverhead() + v.weekly)}/wk</b>
                    <span>Cash after signing</span><b class="money">${fmt(s.funds - v.deposit)}</b>
                </div>
                <p class="dim">${first ? 'Tip: keep enough cash to build restrooms, a bar, speakers and lights.' : 'Your current venue keeps charging rent until you end its lease.'}</p>`,
            actions: [{ label: 'NOT YET' }, { label: 'SIGN · ' + fmt(v.deposit), cls: 'btn-primary', onClick: () => this.doLease(id) }]
        });
    },

    doLease(id) {
        const v = this.vDef(id);
        this.changeFunds(-v.deposit);
        const items = v.prebuilt.map(p => ({ id: this.state.nextId++, type: p.type, r: p.r, c: p.c, w: p.w, h: p.h, paid: 0 }));
        this.state.venues[id] = { leased: true, name: v.defaultName, items, floor: 'concrete', shows: 0, best: 0, revenue: 0, profit: 0, since: this.state.day };
        this.state.activeVenueId = id;
        SoundManager.playSFX('money-sound');
        this.saveGame(true);
        this.openIdentity();
    },

    setActiveVenue(id) {
        this.state.activeVenueId = id;
        this.toast(`${esc(this.vState(id).name)} is now your active venue.`, 'good');
        this.renderVenues();
        this.updateHUD();
    },

    endLease(id) {
        const v = this.vDef(id);
        const vs = this.vState(id);
        if (this.leasedIds().length <= 1) { this.toast('You need at least one venue. Lease another before giving this one up.', 'bad'); return; }
        const refund = Math.round(v.deposit * DATA.LEASE_EXIT_REFUND);
        this.modal({
            title: 'END THE LEASE?',
            html: `<p>Hand back the keys to <b>${esc(vs.name)}</b>? You'll stop paying ${fmt(v.weekly)}/week and get back half the deposit (${fmt(refund)}). Everything you built there stays with the landlord.</p>`,
            actions: [{ label: 'KEEP IT' }, { label: 'END LEASE', cls: 'btn-primary', onClick: () => {
                delete this.state.venues[id];
                this.changeFunds(refund);
                if (this.state.activeVenueId === id) this.state.activeVenueId = this.leasedIds()[0];
                this.saveGame(true);
                this.renderVenues();
                this.toast(`Lease ended. ${fmt(refund)} deposit returned.`);
            } }]
        });
    },

    /* =================================================================
       Floor plan designer
       ================================================================= */
    openDesigner() {
        const vs = this.activeState();
        if (!vs) { this.switchScreen('screen-venue-selector'); return; }
        const want3d = this.ui.designerView !== 'plan';
        this.ui.designer = {
            venueId: this.state.activeVenueId,
            draft: clone(vs.items),
            floor: vs.floor,
            tool: this.ui.designer && this.ui.designer.tool || 'bar',
            rot: false,
            view: want3d ? '3d' : 'plan',
            overlay: false,
            hover: null
        };
        this.switchScreen('screen-floor-designer');
    },

    designerDef() { return this.vDef(this.ui.designer.venueId); },

    pendingChanges() {
        const d = this.ui.designer;
        if (!d) return null;
        const vs = this.vState(d.venueId);
        const v = this.vDef(d.venueId);
        const committed = new Map(vs.items.map(i => [i.id, i]));
        const draftIds = new Set(d.draft.map(i => i.id));
        let build = 0, salvage = 0, added = 0, removed = 0;
        d.draft.forEach(i => { if (!committed.has(i.id)) { build += Sim.itemCost(v, i.type); added++; } });
        vs.items.forEach(i => { if (!draftIds.has(i.id)) { salvage += Math.round((i.paid || 0) * DATA.SALVAGE_RATE); removed++; } });
        const floor = d.floor !== vs.floor ? Sim.floorCost(v, d.floor) : 0;
        return { build, salvage, floor, net: build + floor - salvage, added, removed, any: added + removed > 0 || d.floor !== vs.floor };
    },

    renderDesigner() {
        const d = this.ui.designer;
        if (!d) return;
        const v = this.designerDef();
        const vs = this.vState(d.venueId);
        document.getElementById('designer-panel-title').textContent = `${vs.name.toUpperCase()} — FLOOR PLAN`;
        document.getElementById('designer-scale').textContent = `${v.cols * v.tileFt} × ${v.rows * v.tileFt} ft · each square ${v.tileFt}×${v.tileFt} ft`;
        this.renderPalette();
        this.renderCameraPresets();
        this.setDesignerView(d.view, true);
        this.refreshDesigner();
    },

    refreshDesigner() {
        const d = this.ui.designer;
        const v = this.designerDef();
        d.report = Sim.analyze(v, d.draft, d.floor);
        if (d.view === '3d' && this.scene) {
            this.scene.setLayout(v, d.draft, d.floor, d.report);
            this.scene.setOverlay(d.overlay ? d.report : null);
        } else {
            this.renderPlan();
        }
        this.renderReport();
        this.renderEstimate();
        const rot = document.getElementById('rotate-btn');
        const def = DATA.ITEMS[d.tool];
        rot.disabled = !(def && def.rotatable);
        rot.classList.toggle('on', d.rot);
        document.getElementById('overlay-btn').classList.toggle('on', d.overlay);
    },

    renderPalette() {
        const d = this.ui.designer;
        const v = this.designerDef();
        const pal = document.getElementById('designer-palette');
        let html = '';
        DATA.ITEM_CATEGORIES.forEach(cat => {
            html += `<div class="pal-cat">${cat.name}</div>`;
            Object.entries(DATA.ITEMS).filter(([, it]) => it.cat === cat.id).forEach(([type, it]) => {
                html += `<button class="tool ${d.tool === type ? 'active' : ''}" onclick="Game.selectTool('${type}')" title="${esc(this.itemDesc(type, v))}">
                    <span class="tool-icon" style="background:${it.color}">${icon(type === 'cocktail' ? 'cocktail' : type)}</span>
                    <span class="tool-name">${it.name}</span>
                    <span class="tool-meta"><b>${fmt(Sim.itemCost(v, type))}</b><span>${it.w}×${it.h}</span></span>
                </button>`;
            });
        });
        html += `<button class="tool erase ${d.tool === 'erase' ? 'active' : ''}" onclick="Game.selectTool('erase')"><span class="tool-icon">${icon('erase')}</span><span class="tool-name">Demolish</span><span class="tool-meta"><span>Refunds ${DATA.SALVAGE_RATE * 100}% of build cost</span></span></button>`;
        html += `<div class="tool-desc" id="tool-desc">${esc(d.tool === 'erase' ? 'Click equipment to tear it out. Unapproved items refund in full.' : this.itemDesc(d.tool, v))}</div>`;
        html += `<div class="pal-cat">Floor finish</div><div class="floor-pick">${DATA.FLOORS.map(f => `
            <button class="floor-chip ${d.floor === f.id ? 'on' : ''}" onclick="Game.setFloor('${f.id}')" title="${esc(f.desc)}">
                <span class="sw" style="background:${Thumbs.floorSwatch(f.id)}"></span>${f.name}<br><b class="money">${f.perTile ? fmt(Sim.floorCost(v, f.id)) : 'Free'}</b>
            </button>`).join('')}</div>`;
        pal.innerHTML = html;
    },

    itemDesc(type, v) {
        const it = DATA.ITEMS[type];
        if (!it) return '';
        const map = {
            barCap: Sim.barCapPerSegment(v), cocktailCap: Sim.cocktailCapPerSegment(v), restroomCap: Sim.restroomCapPerBlock(v),
            merchCap: Sim.merchCapPerTable(v), radius: it.radius, seatPpt: Sim.seatPpt(v), ppt: Sim.ppt(v), vipCap: Sim.vipCapPerLounge(v)
        };
        return it.desc.replace(/\{(\w+)\}/g, (m, k) => map[k] !== undefined ? map[k].toLocaleString() : m);
    },

    selectTool(type) {
        const d = this.ui.designer;
        d.tool = type;
        d.rot = false;
        this.renderPalette();
        this.refreshDesigner();
        this.setHint(type === 'erase' ? 'Demolish: click a fixture to remove it.' : `${DATA.ITEMS[type].name}: click the floor to place it.`);
    },

    rotateTool() {
        const d = this.ui.designer;
        const def = DATA.ITEMS[d.tool];
        if (!def || !def.rotatable) return;
        d.rot = !d.rot;
        this.refreshDesigner();
        if (d.hover) this.designerHover(d.hover.r, d.hover.c);
    },

    toggleOverlay() {
        const d = this.ui.designer;
        d.overlay = !d.overlay;
        this.refreshDesigner();
    },

    setFloor(id) {
        this.ui.designer.floor = id;
        this.renderPalette();
        this.refreshDesigner();
    },

    setDesignerView(view, silent) {
        const d = this.ui.designer;
        if (view === '3d' && !this.ensureScene()) {
            view = 'plan';
            if (!silent) this.toast('3D view needs WebGL, which this browser has turned off. Using the blueprint.', 'bad');
        }
        d.view = view;
        this.ui.designerView = view;
        document.querySelectorAll('#view-mode button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
        document.getElementById('three-host').classList.toggle('hidden', view !== '3d');
        document.getElementById('plan-host').classList.toggle('hidden', view !== 'plan');
        document.getElementById('camera-presets').classList.toggle('hidden', view !== '3d');
        if (view === '3d') {
            this.scene.attach(document.getElementById('three-host'));
            this.scene.setMode('design');
            this.scene.onHover = (r, c) => this.designerHover(r, c);
            this.scene.onClick = (r, c, alt) => this.designerClick(r, c, alt);
            this.scene.onLeave = () => this.designerLeave();
            const v = this.designerDef();
            this.scene.setLayout(v, d.draft, d.floor, d.report || Sim.analyze(v, d.draft, d.floor), true);
            this.scene.resume();
        } else if (this.scene) {
            this.scene.pause();
        }
        if (!silent) this.refreshDesigner();
    },

    ensureScene() {
        if (this.scene) return true;
        if (this.sceneFailed || typeof Scene3D === 'undefined') return false;
        try {
            this.scene = Scene3D.create({ quality: this.settings.quality });
        } catch (e) {
            console.warn('3D unavailable:', e);
            this.scene = null;
        }
        if (!this.scene) { this.sceneFailed = true; return false; }
        return true;
    },

    renderCameraPresets() {
        const host = document.getElementById('camera-presets');
        const presets = [['door', 'FROM THE DOOR'], ['stage', 'FROM THE STAGE'], ['balcony', 'BALCONY'], ['top', 'OVERHEAD']];
        const cur = this.scene ? this.scene.preset : 'door';
        host.innerHTML = presets.map(([k, l]) => `<button data-p="${k}" class="${cur === k ? 'on' : ''}" onclick="Game.setCamera('${k}')">${icon('camera')}${l}</button>`).join('');
    },

    setCamera(p) {
        if (!this.scene) return;
        this.scene.setCamera(p);
        document.querySelectorAll('#camera-presets button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    },

    footprint() {
        const d = this.ui.designer;
        const def = DATA.ITEMS[d.tool];
        if (!def) return { w: 1, h: 1 };
        return d.rot ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
    },

    itemAt(r, c) {
        return this.ui.designer.draft.find(i => r >= i.r && r < i.r + i.h && c >= i.c && c < i.c + i.w);
    },

    setHint(text, tone) {
        const h = document.getElementById('designer-hint');
        h.textContent = text;
        h.className = 'viewport-hint' + (tone ? ' ' + tone : '');
    },

    designerHover(r, c) {
        const d = this.ui.designer;
        if (!d) return;
        d.hover = { r, c };
        const v = this.designerDef();
        if (d.tool === 'erase') {
            const it = this.itemAt(r, c);
            if (it) {
                const fresh = !this.vState(d.venueId).items.some(i => i.id === it.id);
                const refund = fresh ? Sim.itemCost(v, it.type) : Math.round((it.paid || 0) * DATA.SALVAGE_RATE);
                this.setHint(`Remove ${DATA.ITEMS[it.type].name} (${fresh ? 'not built yet' : 'salvage'} +${fmt(refund)})`, 'bad');
                this.showGhost({ r: it.r, c: it.c, w: it.w, h: it.h }, false);
            } else {
                this.setHint('Demolish: hover over a fixture.');
                this.showGhost(null);
            }
            return;
        }
        const fp = this.footprint();
        const check = Sim.canPlace(v, d.draft, d.tool, r, c, fp.w, fp.h);
        this.showGhost({ r, c, w: fp.w, h: fp.h }, check.ok);
        if (check.ok) this.setHint(`${DATA.ITEMS[d.tool].name} — ${fmt(Sim.itemCost(v, d.tool))}. Click to place.${DATA.ITEMS[d.tool].rotatable ? ' Press R to rotate.' : ''}`, 'good');
        else this.setHint(check.reason, 'bad');
    },

    designerLeave() {
        if (!this.ui.designer) return;
        this.ui.designer.hover = null;
        this.showGhost(null);
    },

    showGhost(rect, ok) {
        const d = this.ui.designer;
        if (d.view === '3d' && this.scene) this.scene.setGhost(rect, ok, d.tool);
        else this.renderPlanGhost(rect, ok);
    },

    designerClick(r, c, alt) {
        const d = this.ui.designer;
        const v = this.designerDef();
        if (d.tool === 'erase' || alt) {
            const it = this.itemAt(r, c);
            if (!it) return;
            d.draft = d.draft.filter(i => i.id !== it.id);
            this.refreshDesigner();
            this.designerHover(r, c);
            return;
        }
        const fp = this.footprint();
        const check = Sim.canPlace(v, d.draft, d.tool, r, c, fp.w, fp.h);
        if (!check.ok) { this.setHint(check.reason, 'bad'); return; }
        d.draft.push({ id: this.state.nextId++, type: d.tool, r, c, w: fp.w, h: fp.h, paid: null });
        this.refreshDesigner();
        this.designerHover(r, c);
    },

    renderPlan() {
        const d = this.ui.designer;
        const v = this.designerDef();
        const host = document.getElementById('plan-host');
        const rect = host.getBoundingClientRect();
        const cell = Math.max(18, Math.min(46, Math.floor(Math.min((rect.width || 600) - 50, ((rect.height || 400) - 50) * v.cols / v.rows) / v.cols)));
        const doors = Sim.doorCellSet(v);
        const dead = new Set((d.report.trapped || []).map(([r, c]) => r * 1000 + c));
        const cov = d.overlay ? d.report.coverage : null;
        let cells = '';
        for (let r = 0; r < v.rows; r++) {
            for (let c = 0; c < v.cols; c++) {
                const k = r * 1000 + c;
                let cls = 'plan-cell';
                let style = '';
                if (Sim.isStage(v, r, c)) cls += ' stage';
                else if (doors.has(k)) cls += ' door';
                if (dead.has(k)) cls += ' dead';
                if (cov && cov.has(k)) {
                    const lv = cov.get(k);
                    style = `background:${lv > 0 ? `rgba(61,220,132,${0.15 + lv * 0.5})` : 'rgba(255,59,48,0.35)'}`;
                } else if (!Sim.isStage(v, r, c) && !doors.has(k)) {
                    style = `background:${Thumbs.floorSwatch(d.floor, true)}`;
                }
                cells += `<div class="${cls}" data-r="${r}" data-c="${c}" style="${style}"></div>`;
            }
        }
        const items = d.draft.map(i => {
            const it = DATA.ITEMS[i.type];
            const fresh = !this.vState(d.venueId).items.some(x => x.id === i.id);
            return `<div class="plan-item" style="left:${i.c * cell + 2}px;top:${i.r * cell + 2}px;width:${i.w * cell - 4}px;height:${i.h * cell - 4}px;background:${it.color};${fresh ? 'outline:2px dashed #fff;' : ''}" title="${esc(it.name)}">${icon(i.type)}</div>`;
        }).join('');
        const st = v.stage;
        const stageLabel = `<div class="plan-stage-label" style="left:${st.x * cell}px;top:0;width:${st.w * cell}px;height:${st.d * cell}px">STAGE</div>`;
        const doorEls = v.doors.map(dr => {
            const dc = Sim.doorCell(v, dr);
            const t = 10;
            let s;
            if (dr.side === 'bottom') s = `left:${dc.c * cell + 3}px;top:${v.rows * cell - 2}px;width:${cell - 6}px;height:${t}px`;
            else if (dr.side === 'left') s = `left:${-t - 2}px;top:${dc.r * cell + 3}px;width:${t}px;height:${cell - 6}px`;
            else s = `left:${v.cols * cell - 2}px;top:${dc.r * cell + 3}px;width:${t}px;height:${cell - 6}px`;
            return `<div class="plan-door ${dr.kind}" style="${s}" title="${dr.kind === 'main' ? 'Main entrance' : 'Fire exit'}"></div>`;
        }).join('');
        host.innerHTML = `<div class="plan" id="plan-grid" style="--cell:${cell}px;grid-template-columns:repeat(${v.cols}, ${cell}px)">${cells}${stageLabel}${items}${doorEls}</div>`;
        const grid = document.getElementById('plan-grid');
        grid.onmousemove = e => { const t = e.target.closest('.plan-cell'); if (t) this.designerHover(+t.dataset.r, +t.dataset.c); };
        grid.onmouseleave = () => this.designerLeave();
        grid.onclick = e => { const t = e.target.closest('.plan-cell'); if (t) this.designerClick(+t.dataset.r, +t.dataset.c); };
        grid.oncontextmenu = e => { const t = e.target.closest('.plan-cell'); if (t) { e.preventDefault(); this.designerClick(+t.dataset.r, +t.dataset.c, true); } };
        if (d.hover) this.designerHover(d.hover.r, d.hover.c);
    },

    renderPlanGhost(rect, ok) {
        document.querySelectorAll('.plan-cell.ghost-ok, .plan-cell.ghost-bad').forEach(el => el.classList.remove('ghost-ok', 'ghost-bad'));
        if (!rect) return;
        for (let r = rect.r; r < rect.r + rect.h; r++) for (let c = rect.c; c < rect.c + rect.w; c++) {
            const el = document.querySelector(`.plan-cell[data-r="${r}"][data-c="${c}"]`);
            if (el) el.classList.add(ok ? 'ghost-ok' : 'ghost-bad');
        }
    },

    renderReport() {
        const d = this.ui.designer;
        const v = this.designerDef();
        const a = d.report;
        const pct = x => Math.round(Math.max(0, Math.min(1, x)) * 100);
        const meter = (label, val, frac, tone) => `<div class="meter-row"><div class="mr-head"><span>${label}</span><b>${val}</b></div><div class="meter"><i style="width:${pct(frac)}%;background:${tone || (frac >= 0.85 ? 'var(--green)' : frac >= 0.5 ? 'var(--amber)' : 'var(--red)')}"></i></div></div>`;
        const sign = a.legal
            ? `<div class="occupancy-sign"><div class="os-top">MAXIMUM OCCUPANCY</div><div class="os-num">${a.legalCap.toLocaleString()}</div><div class="os-bot">BY ORDER OF THE FIRE MARSHAL</div></div>`
            : `<div class="occupancy-sign illegal"><div class="os-top">OCCUPANCY PERMIT</div><div class="os-num">DENIED</div><div class="os-bot">FIX THE VIOLATIONS BELOW</div></div>`;
        const issues = a.violations.map(t => `<li class="v">${icon('x')}<span>${esc(t)}</span></li>`)
            .concat(a.warnings.map(t => `<li class="w">${icon('warn')}<span>${esc(t)}</span></li>`));
        if (!issues.length) issues.push(`<li class="ok">${icon('check')}<span>A pro-grade room. The fire marshal is impressed.</span></li>`);
        document.getElementById('designer-report').innerHTML = `
            ${sign}
            <div class="report-card"><h4>Capacity</h4><div class="cap-break">
                <span>Standing (${a.ppt}/square)</span><b>${(a.standingCells * a.ppt).toLocaleString()}</b>
                <span>Seated (${a.seatPpt}/square)</span><b>${(a.seatCells * a.seatPpt).toLocaleString()}</b>
                <span>VIP lounges</span><b>${a.vipCap.toLocaleString()}</b>
                <span>Floor holds</span><b>${a.floorCap.toLocaleString()}</b>
                <span>Restrooms allow</span><b class="${a.restroomCap < a.floorCap ? 'warn' : ''}">${a.restroomCap.toLocaleString()}</b>
            </div></div>
            <div class="report-card"><h4>Production</h4>
                ${meter('Sound coverage', pct(a.soundCoverage) + '%', a.soundCoverage)}
                ${meter('Sound quality', pct(a.soundQuality) + '%', a.soundQuality)}
                ${meter('Lighting', a.lightPts.toFixed(1) + ' / ' + a.lightIdeal.toFixed(1) + ' pts', a.lightScore)}
                ${meter('Bar service', a.barCap.toLocaleString() + ' guests', a.legalCap ? a.barCap / a.legalCap : 0)}
                ${meter('Merch service', a.merchCap.toLocaleString() + ' guests', a.legalCap ? a.merchCap / a.legalCap : 0)}
            </div>
            <div class="report-card"><h4>Fire marshal & notes</h4><ul class="issues">${issues.join('')}</ul></div>
            <div class="report-card"><h4>Running costs</h4><div class="cap-break"><span>Rent (weekly)</span><b>${fmt(v.weekly)}</b><span>Drinks sell for</span><b>${fmt(v.drinkPrice * (1 + 0.4 * a.cocktailShare))} avg</b></div></div>`;
    },

    renderEstimate() {
        const p = this.pendingChanges();
        const s = this.state;
        const est = document.getElementById('designer-estimate');
        const legal = this.ui.designer.report.legal;
        if (!p.any) {
            est.innerHTML = `<span class="muted">${icon('check')} Layout matches what's built.</span>`;
        } else {
            est.innerHTML = `<span>Build <b class="neg">${fmt(p.build + p.floor)}</b></span>
                ${p.salvage ? `<span>Salvage <b class="pos">+${fmt(p.salvage)}</b></span>` : ''}
                <span>Net <b class="${p.net > 0 ? 'neg' : 'pos'}">${fmtSigned(-p.net)}</b></span>
                <span class="muted">Cash after: <b class="${s.funds - p.net < 0 ? 'neg' : ''}">${fmt(s.funds - p.net)}</b></span>`;
        }
        document.getElementById('discard-btn').disabled = !p.any;
        const approve = document.getElementById('approve-btn');
        approve.disabled = !p.any;
        approve.textContent = p.any ? `APPROVE CONSTRUCTION · ${fmt(Math.max(0, p.net))}` : 'APPROVE CONSTRUCTION';
        approve.classList.toggle('hidden', !p.any);
        const book = document.getElementById('designer-book-btn');
        book.classList.toggle('hidden', p.any);
        book.disabled = !legal;
        book.title = legal ? '' : 'Fix the fire code violations first.';
    },

    approveConstruction() {
        const d = this.ui.designer;
        const p = this.pendingChanges();
        if (!p.any) return;
        if (p.net > this.state.funds) { this.toast(`Not enough cash: this work costs ${fmt(p.net)}.`, 'bad'); return; }
        const v = this.designerDef();
        const vs = this.vState(d.venueId);
        const committed = new Set(vs.items.map(i => i.id));
        d.draft.forEach(i => { if (!committed.has(i.id)) i.paid = Sim.itemCost(v, i.type); });
        vs.items = clone(d.draft);
        vs.floor = d.floor;
        this.changeFunds(-p.net);
        if (p.net > 0) this.state.stats.buildSpent += p.net;
        SoundManager.playSFX('money-sound');
        this.saveGame(true);
        this.toast(`Construction complete${p.net > 0 ? ` (${fmt(p.net)})` : ''}. Legal capacity: ${d.report.legalCap.toLocaleString()}.`, 'good');
        this.refreshDesigner();
        if (this.scene) this.scene.celebrate();
    },

    discardDraft() {
        const d = this.ui.designer;
        const vs = this.vState(d.venueId);
        d.draft = clone(vs.items);
        d.floor = vs.floor;
        this.renderPalette();
        this.refreshDesigner();
    },

    leaveDesigner(target) {
        const p = this.pendingChanges();
        const go = () => {
            if (target === 'book') this.startBooking();
            else this.switchScreen(target);
        };
        if (p && p.any) {
            this.modal({
                title: 'UNAPPROVED CHANGES',
                html: `<p>You have ${p.added + p.removed} unapproved change${p.added + p.removed === 1 ? '' : 's'} (${fmtSigned(-p.net)}). Leave without building them?</p>`,
                actions: [{ label: 'KEEP EDITING' }, { label: 'DISCARD & LEAVE', cls: 'btn-primary', onClick: () => { this.discardDraft(); go(); } }]
            });
        } else go();
    },

    /* =================================================================
       Office hub
       ================================================================= */
    renderOffice() {
        const s = this.state;
        const g = Sim.gradeOf(s.rep);
        const next = DATA.GRADES.find(x => x.min > s.rep);
        document.getElementById('office-company-name').textContent = s.companyName;
        document.getElementById('office-grade-badge').textContent = g.grade;
        document.getElementById('office-grade').textContent = g.title;
        document.getElementById('office-rep-fill').style.width = Math.min(100, s.rep) + '%';
        document.getElementById('office-rep-caption').textContent = `Reputation ${s.rep.toFixed(1)} / 100${next ? ` · ${next.grade} at ${next.min}` : ''}`;
        document.getElementById('office-funds').textContent = fmt(s.funds);
        document.getElementById('office-funds').classList.toggle('neg', s.funds < 0);
        document.getElementById('office-shows-hosted').textContent = s.stats.shows;
        document.getElementById('office-lifetime-rev').textContent = fmtK(s.stats.revenue);
        document.getElementById('office-venues-owned').textContent = `${this.leasedIds().length} / ${DATA.VENUES.length}`;
        document.getElementById('office-note').textContent = `Week ${Sim.weekOf(s.day)} · ${DATA.DAY_NAMES[Sim.dayIdxOf(s.day)]}`;

        const v = this.activeDef();
        const vs = this.activeState();
        const card = document.getElementById('office-venue-card');
        let report = null;
        if (v) {
            report = this.reportFor(v.id);
            card.innerHTML = `<div class="eyebrow">Active venue</div>
                <div class="vm-name">${esc(vs.name)}</div>
                <div class="cap-break">
                    <span>Legal capacity</span><b>${report.legal ? report.legalCap.toLocaleString() : '<span class="neg">No permit</span>'}</b>
                    <span>Sound / lights</span><b>${Math.round(report.soundQuality * 100)}% / ${Math.round(Math.min(1, report.lightScore) * 100)}%</b>
                    <span>Shows here</span><b>${vs.shows}</b>
                    <span>Perk</span><b>${esc(v.perk.name)}</b>
                </div>`;
        } else {
            card.innerHTML = '<div class="eyebrow">Active venue</div><p class="muted">No venue yet. Head to the marketplace.</p>';
        }

        const alerts = [];
        if (!v) alerts.push(['warn', 'Lease a venue to start booking shows.']);
        else if (!report.legal) alerts.push(['bad', `Fire code: ${report.violations[0]}`]);
        else if (report.warnings.length && s.stats.shows < 3) alerts.push(['warn', report.warnings[0]]);
        const rent = this.weeklyOverhead();
        if (rent) {
            const d = this.daysToRent();
            alerts.push([s.funds < rent ? 'bad' : 'good', `Rent of ${fmt(rent)} due ${d === 1 ? 'tomorrow' : `in ${d} days`} (Monday).`]);
        }
        if (s.overdue) alerts.unshift(['bad', 'RENT OVERDUE. Get back above $0 by Monday or you will be evicted.']);
        const nextVenue = DATA.VENUES.find(x => !s.venues[x.id] && s.rep >= x.repReq && x.tier > (v ? v.tier : -1));
        if (nextVenue) alerts.push(['good', `${nextVenue.name} will now lease to you (${fmt(nextVenue.deposit)} deposit).`]);
        if (s.hype >= 10) alerts.push(['good', `Buzz is high: +${s.hype}% turnout from word of mouth.`]);
        if (s.hype <= -10) alerts.push(['warn', `Bad buzz: ${s.hype}% turnout. Put on a great show.`]);
        document.getElementById('office-alerts').innerHTML = alerts.map(([t, m]) => `<div class="alert ${t}">${icon(t === 'good' ? 'check' : 'warn')}<span>${esc(m)}</span></div>`).join('');
        const book = document.getElementById('office-book-btn');
        book.disabled = !v || !report.legal;
        document.getElementById('office-scene').classList.toggle('hint', s.stats.shows < 2);
    },

    /* =================================================================
       The books (stats)
       ================================================================= */
    renderBooks() {
        const s = this.state;
        const log = s.log;
        const avgVibe = log.length ? Math.round(log.reduce((a, l) => a + l.vibe, 0) / log.length) : 0;
        const best = log.reduce((b, l) => (!b || l.net > b.net ? l : b), null);
        const recent = log.slice(-40);
        const tiles = [
            ['Cash on hand', fmtK(s.funds), `Weekly overhead ${fmt(this.weeklyOverhead())}`],
            ['Lifetime revenue', fmtK(s.stats.revenue), `${s.stats.shows} shows`],
            ['Lifetime profit', fmtK(s.stats.profit), `after bands, staff & stock`],
            ['Rent paid', fmtK(s.stats.rentPaid), `build-outs ${fmtK(s.stats.buildSpent)}`],
            ['Avg crowd vibe', log.length ? avgVibe : '—', log.length ? Sim.vibeLabel(avgVibe) : 'no shows yet'],
            ['Sellouts', s.stats.sellouts, `best crowd ${s.stats.bestAttendance.toLocaleString()}`]
        ];
        const body = document.getElementById('books-body');
        body.innerHTML = `
            <div class="kpi-row">${tiles.map(([l, v, sub]) => `<div class="kpi-tile"><span>${l}</span><b>${v}</b><small>${sub}</small></div>`).join('')}</div>
            <div class="chart-row">
                <div class="chart-card"><h4><span>Net profit per show</span><span class="dim">last ${recent.length}</span></h4>${recent.length ? Charts.bars(recent.map(l => ({ v: l.net, tip: `Wk ${Sim.weekOf(l.day)} ${DATA.DAYS[Sim.dayIdxOf(l.day)]} · ${esc(l.headliner)}<br>Net ${fmt(l.net)}` }))) : '<div class="chart-empty">Host a show to start the ledger.</div>'}</div>
                <div class="chart-card"><h4><span>Reputation</span><span class="dim">${s.rep.toFixed(1)} now</span></h4>${s.repLog.length > 1 ? Charts.line(s.repLog.map(([d, r]) => ({ v: r, tip: `Week ${Sim.weekOf(d)} · rep ${r.toFixed(1)}` })), { max: 100 }) : '<div class="chart-empty">Builds after your first show.</div>'}</div>
            </div>
            <div class="chart-row">
                <div class="chart-card"><h4><span>Room fill per show</span><span class="dim">% of legal capacity</span></h4>${recent.length ? Charts.line(recent.map(l => ({ v: Math.round(l.fill * 100), tip: `${esc(l.headliner)} · ${l.attendance.toLocaleString()} / ${l.cap.toLocaleString()}` })), { max: 100, suffix: '%' }) : '<div class="chart-empty">No shows yet.</div>'}</div>
                <div class="table-card"><h4>Venue portfolio</h4><table class="tbl"><thead><tr><th>Venue</th><th class="r">Shows</th><th class="r">Revenue</th><th class="r">Profit</th></tr></thead><tbody>
                    ${Object.entries(s.venues).map(([id, vs]) => `<tr><td>${esc(vs.name)}${id === s.activeVenueId ? ' <span class="chip">active</span>' : ''}</td><td class="r">${vs.shows}</td><td class="r">${fmtK(vs.revenue || 0)}</td><td class="r ${vs.profit < 0 ? 'neg' : ''}">${fmtK(vs.profit || 0)}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">No venues.</td></tr>'}
                </tbody></table>${best ? `<p class="dim" style="margin-top:8px;font-size:.7rem">Best night: ${esc(best.headliner)} at ${esc(best.venue)} — ${fmt(best.net)}</p>` : ''}</div>
            </div>
            <div class="table-card"><h4>Show log</h4><table class="tbl"><thead><tr><th>Night</th><th>Venue</th><th>Bill</th><th class="r">Crowd</th><th class="r">Vibe</th><th class="r">Net</th></tr></thead><tbody>
                ${log.slice(-25).reverse().map(l => `<tr><td>Wk ${Sim.weekOf(l.day)} ${DATA.DAYS[Sim.dayIdxOf(l.day)]}</td><td>${esc(l.venue)}</td><td>${esc(l.bill.join(' / '))}</td><td class="r">${l.attendance.toLocaleString()} / ${l.cap.toLocaleString()}</td><td class="r">${l.vibe}</td><td class="r ${l.net < 0 ? 'neg' : 'pos'}">${fmt(l.net)}</td></tr>`).join('') || '<tr><td colspan="6" class="dim">No shows yet.</td></tr>'}
            </tbody></table></div>`;
        Charts.bindTips(body);
    },

    /* =================================================================
       Booking: the three-band bill
       ================================================================= */
    startBooking() {
        const v = this.activeDef();
        if (!v) { this.switchScreen('screen-venue-selector'); return; }
        const report = this.reportFor(v.id);
        if (!report.legal) {
            this.modal({
                title: 'NO OCCUPANCY PERMIT',
                html: `<p>The fire marshal won't let you open:</p><ul class="issues">${report.violations.map(t => `<li class="v">${icon('x')}<span>${esc(t)}</span></li>`).join('')}</ul>`,
                actions: [{ label: 'LATER' }, { label: 'FIX FLOOR PLAN', cls: 'btn-primary', onClick: () => this.openDesigner() }]
            });
            return;
        }
        this.ensureRoster();
        this.ui.booking = { lineup: [], openMic: false, night: 0, price: null, deal: 'guarantee', marketing: 'flyers', security: 'standard' };
        this.switchScreen('screen-band-scouting');
    },

    ensureRoster() {
        const week = Sim.weekOf(this.state.day);
        if (!this.state.roster || this.state.roster.week !== week) {
            this.state.roster = Object.assign({ week }, Sim.weeklyRoster(week, this.state.rep, this.state.seed));
        }
    },

    bookingCtx() {
        const b = this.ui.booking;
        const v = this.activeDef();
        const report = this.reportFor(v.id);
        const showDay = this.state.day + (b.night || 0);
        const bands = b.lineup.map(Sim.bandById);
        const bill = Sim.makeBill(bands, showDay, this.state.history);
        return { venue: v, report, bill, showDay };
    },

    renderBands() {
        const b = this.ui.booking;
        if (!b) return;
        const s = this.state;
        const { report, bill } = this.bookingCtx();
        const list = document.getElementById('band-list');
        const ids = s.roster.ids.slice();
        document.getElementById('roster-note').textContent = `Week ${s.roster.week} roster · refreshes Monday`;
        const card = (band, teaser) => {
            const g = DATA.GENRES[band.genre];
            const t = Sim.tierOf(band);
            const status = teaser ? { ok: false, reason: `Unlocks at reputation ${t.repReq}` } : Sim.bandStatus(band, { rep: s.rep, report });
            const inBill = b.lineup.includes(band.id);
            const recent = Sim.recentlyPlayed(band.id, s.day, s.history);
            const slot = inBill ? bill.slots.find(x => x.band.id === band.id) : null;
            return `<button class="band-card ${inBill ? 'booked' : ''} ${status.ok ? '' : 'locked'}" style="--g:${g.color}" onclick="Game.toggleBookBand('${band.id}')" ${status.ok ? '' : 'aria-disabled="true"'}>
                ${slot ? `<span class="band-slot-tag">${slot.slot.label.toUpperCase()}</span>` : ''}
                <div class="band-top"><div class="band-name">${esc(band.name)}</div>${slot ? '' : `<span class="tier-tag">T${band.tier} · ${t.label}</span>`}</div>
                <div class="band-tagline">${esc(band.tag)}</div>
                <div class="chips">
                    <span class="chip genre">${g.label}</span>
                    <span class="chip ${band.consistency}">${DATA.CONSISTENCY[band.consistency].label}</span>
                    ${recent ? '<span class="chip recent">Played this week −25% draw</span>' : ''}
                </div>
                <div class="band-stats">
                    <div><span>Draw</span>${band.draw.toLocaleString()}</div>
                    <div><span>Live</span><span class="stars">${stars(band.quality)}</span></div>
                    <div><span>Headline fee</span>${fmtK(band.fee)}</div>
                </div>
                ${status.ok ? '' : `<div class="band-lock">${icon('key')} ${esc(status.reason)}</div>`}
            </button>`;
        };
        list.innerHTML = ids.map(id => card(Sim.bandById(id))).join('') + (s.roster.teaser ? card(Sim.bandById(s.roster.teaser), true) : '');
        this.renderBill();
    },

    toggleBookBand(bandId) {
        const b = this.ui.booking;
        b.openMic = false;
        b.lineup = b.lineup.filter(id => id !== 'open_mic');
        if (b.lineup.includes(bandId)) {
            b.lineup = b.lineup.filter(id => id !== bandId);
        } else {
            const band = Sim.bandById(bandId);
            if (this.state.roster.teaser === bandId) { this.toast(`${esc(band.name)} won't take your call yet.`, 'bad'); return; }
            const st = Sim.bandStatus(band, { rep: this.state.rep, report: this.reportFor(this.state.activeVenueId) });
            if (!st.ok) { this.toast(esc(st.reason), 'bad'); return; }
            if (b.lineup.length >= 3) { this.toast('The bill is full (3 bands). Remove one first.', 'bad'); return; }
            b.lineup.push(bandId);
        }
        b.price = null;
        this.renderBands();
    },

    removeFromBill(bandId) { this.toggleBookBand(bandId); },

    renderBill() {
        const b = this.ui.booking;
        const { bill } = this.bookingCtx();
        const slotsEl = document.getElementById('bill-slots');
        const labels = DATA.SLOTS;
        // Fill display slots from the headliner down.
        const filled = {};
        bill.slots.forEach(s => { filled[s.slot.id] = s; });
        slotsEl.innerHTML = labels.map(def => {
            const s = filled[def.id];
            if (!s) return `<div class="slot ${def.id}"><span class="slot-label">${def.label}</span><span class="slot-band dim">Pick a band</span></div>`;
            const g = DATA.GENRES[s.band.genre];
            return `<div class="slot filled ${def.id}" style="--g:${g.color}"><span class="slot-label">${def.label}</span>
                <span class="slot-band"><b>${esc(s.band.name)}</b><small>${g.label} · ${s.band.openMic ? 'free' : fmt(s.pay)}${s.recent ? ' · overplayed' : ''}</small></span>
                <button class="slot-x" onclick="Game.removeFromBill('${s.band.id}')" aria-label="Remove">${icon('x')}</button></div>`;
        }).join('');
        const chemEl = document.getElementById('bill-chem');
        if (b.lineup.length >= 2 && !bill.openMic) {
            const c = Sim.chemLabel(bill.chemistry);
            const bands = bill.slots.map(s => s.band);
            let worst = null, bestPair = null;
            for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
                const v = Sim.genreChem(bands[i].genre, bands[j].genre);
                if (!worst || v < worst.v) worst = { v, a: bands[i], b: bands[j] };
                if (!bestPair || v > bestPair.v) bestPair = { v, a: bands[i], b: bands[j] };
            }
            const note = worst.v < 0.4
                ? `${DATA.GENRES[worst.a.genre].label} and ${DATA.GENRES[worst.b.genre].label} fans won't stick around for each other.`
                : bestPair.v >= 0.8 ? `${DATA.GENRES[bestPair.a.genre].label} + ${DATA.GENRES[bestPair.b.genre].label}: crowds that cross over.` : 'Some crossover, some bar breaks.';
            chemEl.className = 'chem ' + c.tone;
            chemEl.innerHTML = `<div class="chem-head"><span>LINEUP CHEMISTRY</span><b>${c.label}</b></div><div class="chem-bar"><i style="left:${Math.round(bill.chemistry * 100)}%"></i></div><div class="chem-note">${esc(note)}</div>`;
        } else if (bill.openMic) {
            chemEl.className = 'chem good';
            chemEl.innerHTML = '<div class="chem-head"><span>OPEN MIC NIGHT</span><b>DIY</b></div><div class="chem-note">No fees, no riders, small crowd. Anything can happen.</div>';
        } else {
            chemEl.className = 'chem';
            chemEl.innerHTML = '<div class="chem-head"><span>LINEUP CHEMISTRY</span><b class="dim">—</b></div><div class="chem-note">Book three acts. The biggest draw headlines; genres that mix well bring a bigger, happier crowd.</div>';
        }
        const sum = document.getElementById('bill-summary');
        if (b.lineup.length) {
            const headFee = bill.openMic ? 0 : bill.headliner.fee;
            sum.innerHTML = `<span>Combined draw</span><b>${bill.draw.toLocaleString()} fans</b>
                <span>Fair ticket price</span><b>${fmt(bill.fair)}</b>
                <span>Headliner guarantee</span><b>${fmt(headFee)}</b>
                <span>Support & opener pay</span><b>${fmt(bill.openMic ? 0 : bill.fees - headFee)}</b>
                <span>Hospitality riders</span><b>${fmt(Sim.riderCost({ bill, venue: this.activeDef() }))}</b>`;
        } else sum.innerHTML = '';
        const ok = bill.openMic || b.lineup.length === 3;
        const btn = document.getElementById('proceed-btn');
        btn.disabled = !ok;
        btn.innerHTML = (ok ? 'SET UP THE NIGHT' : `BOOK ${3 - b.lineup.length} MORE BAND${3 - b.lineup.length === 1 ? '' : 'S'}`) + icon('next');
    },

    bookOpenMic() {
        const b = this.ui.booking;
        b.lineup = ['open_mic'];
        b.openMic = true;
        b.price = null;
        this.renderBands();
        this.proceedToMarketing();
    },

    proceedToMarketing() {
        const b = this.ui.booking;
        if (!(b.openMic || b.lineup.length === 3)) return;
        this.switchScreen('screen-marketing');
    },

    /* =================================================================
       Show setup
       ================================================================= */
    setupCtx() {
        const b = this.ui.booking;
        const base = this.bookingCtx();
        if (b.price === null) b.price = base.bill.fair;
        if (Sim.tierOf(base.bill.headliner).guaranteeOnly || base.bill.openMic) b.deal = 'guarantee';
        return Object.assign(base, {
            deal: b.deal, price: b.price, marketingId: b.marketing, securityId: b.security,
            dayIdx: Sim.dayIdxOf(base.showDay), rep: this.state.rep, hype: this.state.hype
        });
    },

    renderSetup() {
        const b = this.ui.booking;
        if (!b) return;
        const ctx = this.setupCtx();
        const { bill, report } = ctx;
        document.getElementById('setup-bill-note').textContent = bill.openMic ? 'Open Mic Night' : bill.slots.slice().reverse().map(s => s.band.name).join(' · ');

        // Nights
        const s = this.state;
        let nights = '';
        for (let i = 0; i < 7; i++) {
            const day = s.day + i;
            const idx = Sim.dayIdxOf(day);
            const rent = i > 0 && idx === 0;
            const m = DATA.DAY_TURNOUT[idx];
            nights += `<button class="night ${b.night === i ? 'on' : ''} ${rent ? 'rent' : ''}" onclick="Game.setNight(${i})" title="${rent ? 'Rent is due before this show' : ''}">
                <small>${i === 0 ? 'TONIGHT' : i === 1 ? 'TOMORROW' : 'WK ' + Sim.weekOf(day)}</small><b>${DATA.DAYS[idx]}</b>
                <span class="mult ${m >= 1 ? 'pos' : 'warn'}">${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%</span></button>`;
        }
        document.getElementById('night-picker').innerHTML = nights;

        // Price
        const slider = document.getElementById('price-slider');
        const max = Math.max(bill.fair * 3, bill.fair + 20);
        slider.max = max;
        slider.step = bill.fair >= 50 ? 5 : 1;
        slider.value = b.price;
        document.getElementById('price-tag').textContent = fmt(b.price);
        document.getElementById('fair-note').textContent = `— fans think ${fmt(bill.fair)} is fair`;

        // Deal
        const dealBlock = document.getElementById('deal-block');
        dealBlock.classList.toggle('hidden', bill.openMic);
        if (!bill.openMic) {
            const t = Sim.tierOf(bill.headliner);
            document.getElementById('deal-grid').innerHTML = `
                <button class="opt-card ${b.deal === 'guarantee' ? 'on' : ''}" onclick="Game.setDeal('guarantee')"><h4>Flat guarantee</h4><p>Pay ${esc(bill.headliner.name)} up front. You keep every ticket dollar.</p><span class="opt-cost">${fmt(bill.headliner.fee)} now</span></button>
                <button class="opt-card ${b.deal === 'split' ? 'on' : ''}" onclick="Game.setDeal('split')" ${t.guaranteeOnly ? 'disabled' : ''}><h4>Door split</h4><p>${t.guaranteeOnly ? 'Acts this big only take guarantees.' : `They take ${Math.round(t.split * 100)}% of ticket sales. Less risk, less upside.`}</p><span class="opt-cost">$0 now</span></button>`;
        }

        // Marketing
        document.getElementById('marketing-grid').innerHTML = DATA.MARKETING.map(m => {
            const cost = Sim.marketingCost(m.id, report);
            return `<button class="opt-card ${b.marketing === m.id ? 'on' : ''}" onclick="Game.selectMarketing('${m.id}')"><h4>${m.name}</h4><p>${m.desc}</p><span class="opt-cost">${cost ? fmt(cost) : 'Free'} · ${Math.round(m.mult * 100)}% reach</span></button>`;
        }).join('');

        // Security
        document.getElementById('security-seg').innerHTML = DATA.SECURITY.map(sc => `<button class="${b.security === sc.id ? 'on' : ''}" onclick="Game.setSecurity('${sc.id}')" title="${sc.desc}">${sc.name.toUpperCase()} <span class="dim">${sc.desc.replace('1 guard per ', '1:').replace(' guests', '')}</span></button>`).join('');

        this.renderForecast();
    },

    renderForecast() {
        const ctx = this.setupCtx();
        const { plan, result: r } = Sim.projectShow(ctx);
        const upfront = Sim.upfrontCost(ctx);
        const s = this.state;
        const lo = Sim.attendanceFor(Math.round(plan.demand * 0.9), ctx.report).attendance;
        const hi = Sim.attendanceFor(Math.round(plan.demand * 1.1), ctx.report).attendance;
        const rentDue = (() => { let t = 0; for (let d = s.day + 1; d <= ctx.showDay; d++) if (Sim.dayIdxOf(d) === 0) t += this.weeklyOverhead(); return t; })();
        const afford = s.funds - rentDue >= upfront;
        document.getElementById('forecast-body').innerHTML = `
            <div class="fc-big"><span>Expected crowd</span><b>${lo === hi ? lo.toLocaleString() : `${lo.toLocaleString()}–${hi.toLocaleString()}`}</b><small>of ${ctx.report.legalCap.toLocaleString()} legal capacity · ${plan.demand.toLocaleString()} want in</small></div>
            <div class="fc-big"><span>Projected profit</span><b class="${r.net >= 0 ? 'pos' : 'neg'}">${fmtSigned(r.net)}</b><small>if the bands play to form · vibe ~${r.sat.score} (${Sim.vibeLabel(r.sat.score)})</small></div>
            <div class="fc-lines">
                <span>Tickets</span><b>${fmt(r.ticketGross)}</b>
                <span>Bar sales (net of stock)</span><b>${fmt(r.barGross - r.barCogs)}</b>
                <span>Merch commission</span><b>${fmt(r.merchCut)}</b>
                <span>Bands${ctx.deal === 'split' ? ' (incl. door split)' : ''}</span><b class="neg">−${fmt(r.bandPay + r.rider)}</b>
                <span>Staff (${r.staffCount})</span><b class="neg">−${fmt(r.staff)}</b>
                <span>Promotion</span><b class="neg">−${fmt(r.marketing)}</b>
                <span class="total">Due when doors open</span><b class="total ${afford ? '' : 'neg'}">${fmt(upfront)}</b>
                ${rentDue ? `<span class="warn">Rent due before the show</span><b class="warn">${fmt(rentDue)}</b>` : ''}
            </div>`;
        const btn = document.getElementById('launch-btn');
        btn.disabled = !afford;
        btn.innerHTML = afford ? `OPEN DOORS · ${DATA.DAYS[ctx.dayIdx]}${icon('next')}` : `NEED ${fmt(upfront + rentDue - s.funds)} MORE`;
    },

    setNight(i) { this.ui.booking.night = i; this.renderSetup(); },
    setPrice(v) {
        this.ui.booking.price = Math.max(0, parseInt(v, 10) || 0);
        document.getElementById('price-tag').textContent = fmt(this.ui.booking.price);
        this.renderForecast();
    },
    nudgePrice(d) {
        const slider = document.getElementById('price-slider');
        const step = parseInt(slider.step, 10) || 1;
        const nv = Math.max(0, Math.min(parseInt(slider.max, 10), this.ui.booking.price + d * step));
        slider.value = nv;
        this.setPrice(nv);
    },
    setDeal(d) { this.ui.booking.deal = d; this.renderSetup(); },
    selectMarketing(id) { this.ui.booking.marketing = id; this.renderSetup(); },
    setSecurity(id) { this.ui.booking.security = id; this.renderSetup(); },

    launchShow() {
        const ctx = this.setupCtx();
        const s = this.state;
        // Skip ahead to the chosen night (rent may come due on the way).
        if (ctx.showDay > s.day) {
            const ok = this.advanceTo(ctx.showDay, true);
            if (!ok) return;
        }
        const upfront = Sim.upfrontCost(ctx);
        if (s.funds < upfront) { this.toast(`You need ${fmt(upfront)} to open the doors.`, 'bad'); this.switchScreen('screen-marketing'); return; }
        this.changeFunds(-upfront);
        this.ui.live = { ctx, upfront, mods: { cash: 0, vibe: 0, rep: 0, hype: 0, barBonus: 0, ticketBonus: 0 }, notes: [] };
        if (this.rng() < 0.55) {
            const ev = Sim.pickEvent(ctx, this.rng);
            this.showEvent(ev);
        } else {
            this.startLive();
        }
    },

    /* =================================================================
       Pre-show event
       ================================================================= */
    showEvent(ev) {
        const live = this.ui.live;
        live.event = ev;
        const scale = live.ctx.venue.costScale;
        document.getElementById('event-card-title').textContent = ev.title;
        document.getElementById('event-card-desc').textContent = ev.desc;
        document.getElementById('event-when').textContent = `${DATA.DAY_NAMES[live.ctx.dayIdx]} · ${this.activeState().name}`;
        const cont = document.getElementById('event-choices-container');
        cont.innerHTML = ev.choices.map((ch, i) => {
            const cost = ch.effects.cash && ch.effects.cash < 0 ? Sim.roundMoney(-ch.effects.cash * scale) : 0;
            const desc = Sim.describeEffects(ch.effects, scale) || 'no effect';
            return `<button class="choice" onclick="Game.resolveEvent(${i})" ${cost > this.state.funds ? 'disabled' : ''}><span>${esc(ch.text)}</span><small>${desc}</small></button>`;
        }).join('');
        this.switchScreen('screen-event-card');
    },

    resolveEvent(i) {
        const live = this.ui.live;
        const ch = live.event.choices[i];
        const out = Sim.resolveEffects(ch.effects, live.ctx.venue.costScale, this.rng);
        this.applyMods(out, live.event.title);
        const parts = [];
        if (out.cash) parts.push(`<b class="${out.cash > 0 ? 'pos' : 'neg'}">${fmtSigned(out.cash)}</b>`);
        if (out.vibe) parts.push(`${out.vibe > 0 ? '+' : ''}${out.vibe} vibe tonight`);
        if (out.hype) parts.push(`${out.hype > 0 ? '+' : ''}${out.hype} hype`);
        if (out.rep) parts.push(`${out.rep > 0 ? '+' : ''}${out.rep} rep`);
        document.getElementById('event-choices-container').innerHTML = `
            <div class="choice-result">${out.notes.length ? esc(out.notes.join(' ')) + '<br>' : ''}${parts.join(' · ') || 'Nothing changes.'}</div>
            <button class="btn btn-primary btn-lg" onclick="Game.startLive()">OPEN THE DOORS${icon('next')}</button>`;
    },

    applyMods(out, source) {
        const m = this.ui.live.mods;
        m.cash += out.cash || 0;
        m.vibe += out.vibe || 0;
        m.rep += out.rep || 0;
        m.barBonus += out.barBonus || 0;
        m.ticketBonus += out.ticketBonus || 0;
        // Hype moves the buzz right away (and tonight's walk-up crowd).
        if (out.hype) this.state.hype = Sim.clamp(this.state.hype + out.hype, -40, 40);
        if (out.cash) this.ui.live.notes.push({ source, cash: out.cash });
    },

    /* =================================================================
       Live show
       ================================================================= */
    startLive() {
        const live = this.ui.live;
        const ctx = live.ctx;
        ctx.hype = this.state.hype;
        live.plan = Sim.planShow(ctx, this.rng);
        const crises = Sim.rollCrises(ctx, live.plan, this.rng);
        const spots = [30 + Math.random() * 18, 66 + Math.random() * 18];
        live.crises = crises.map((id, i) => ({ id, at: spots[i], done: false }));
        live.progress = 0;
        live.revealed = [];
        live.done = false;
        live.paused = false;
        live.speed = this.settings.speed || 1;
        live.phase = -1;
        live.lastFlavor = 0;
        this.switchScreen('screen-live-show');
        document.getElementById('live-feed').innerHTML = '';
        document.getElementById('interactive-crisis-box').classList.add('hidden');
        const fin = document.getElementById('finish-show-btn');
        fin.disabled = true;
        fin.textContent = 'SHOW IN PROGRESS…';
        document.getElementById('live-cap').textContent = `of ${ctx.report.legalCap.toLocaleString()}`;
        document.getElementById('live-price').textContent = `${fmt(ctx.price)} a ticket`;
        this.renderTimeline();
        this.renderSpeed();
        if (this.ensureScene()) {
            this.scene.attach(document.getElementById('live-three-host'));
            this.scene.setMode('live');
            this.scene.setLayout(ctx.venue, this.activeState().items, this.activeState().floor, ctx.report, true);
            this.scene.setCamera('crowd');
            this.scene.resume();
        } else {
            document.getElementById('live-three-host').innerHTML = `<div class="viewport-fallback" style="background:url('img/live.svg') center/cover"></div>`;
        }
        Music.play('live', { genre: ctx.bill.genre });
        Music.setCrowd(0.1);
        this.feed(`Doors open at ${esc(this.activeState().name)}. ${live.plan.demand > ctx.report.legalCap ? 'The line wraps around the block.' : 'Fans trickle in from the street.'}`);
        this.stopLiveTimer();
        live.timer = setInterval(() => this.liveTick(), 100);
    },

    stopLiveTimer() {
        if (this.ui.live && this.ui.live.timer) { clearInterval(this.ui.live.timer); this.ui.live.timer = null; }
    },

    setLivePaused(p) { if (this.ui.live) this.ui.live.userPaused = p; },

    renderSpeed() {
        const live = this.ui.live;
        document.getElementById('speed-ctl').innerHTML = `<div class="seg seg-sm">${[1, 2, 4].map(sp => `<button class="${live.speed === sp ? 'on' : ''}" onclick="Game.setSpeed(${sp})">${sp}×</button>`).join('')}<button onclick="Game.skipShow()" title="Skip to the end">${icon('ff')}</button></div>`;
    },

    setSpeed(sp) { this.ui.live.speed = sp; this.settings.speed = sp; this.saveSettings(); this.renderSpeed(); },
    skipShow() { this.ui.live.speed = 40; this.renderSpeed(); },

    phases() {
        const bill = this.ui.live.ctx.bill;
        if (bill.openMic) return [['DOORS', 0, 12], ['SIGN-UPS', 12, 35], ['ACTS', 35, 60], ['FEATURE', 60, 92], ['LAST CALL', 92, 100]];
        const bySlot = id => (bill.slots.find(s => s.slot.id === id) || {}).band;
        return [['DOORS', 0, 12], [bySlot('opener') ? 'OPENER' : 'SET 1', 12, 35], ['SUPPORT', 35, 60], ['HEADLINER', 60, 92], ['ENCORE', 92, 100]];
    },

    renderTimeline() {
        const live = this.ui.live;
        const p = live.progress || 0;
        document.getElementById('live-timeline').innerHTML = this.phases().map(([l, a, b]) => `<div class="tl ${p >= b ? 'done' : p >= a ? 'now' : ''}">${l}</div>`).join('');
    },

    feed(msg, tone) {
        const f = document.getElementById('live-feed');
        const li = document.createElement('li');
        li.className = tone || '';
        li.innerHTML = msg;
        f.prepend(li);
        while (f.children.length > 40) f.lastChild.remove();
    },

    // Satisfaction so far: revealed sets use real performances, the rest are assumed to match their usual level.
    liveSat() {
        const live = this.ui.live;
        const perf = live.ctx.bill.slots.map((s, i) => live.revealed.includes(i) ? live.plan.performances[i] : s.band.quality);
        const attNow = this.liveAttendance();
        const plan = Object.assign({}, live.plan, { performances: perf, attendance: Math.max(attNow, 1), fill: attNow / live.ctx.report.legalCap });
        return Sim.satisfaction(live.ctx, plan, live.mods).score;
    },

    liveAttendance() {
        const live = this.ui.live;
        const p = live.progress;
        const frac = p < 12 ? (p / 12) * 0.35 : Math.min(1, 0.35 + ((p - 12) / 48) * 0.65);
        return Math.round(live.plan.attendance * frac);
    },

    liveTick() {
        const live = this.ui.live;
        if (!live || live.done || live.crisisOpen || live.userPaused || this.modalOpen()) return;
        live.progress = Math.min(100, live.progress + 0.55 * live.speed);
        const p = live.progress;
        const ctx = live.ctx;
        const bill = ctx.bill;

        // Set changes & performance reveals
        const phases = this.phases();
        const ph = phases.findIndex(([, a, b]) => p >= a && p < b);
        const phaseIdx = ph === -1 ? phases.length - 1 : ph;
        if (phaseIdx !== live.phase) {
            live.phase = phaseIdx;
            this.renderTimeline();
            const slotIdx = { 1: 0, 2: 1, 3: 2 }[phaseIdx];
            const slotDefs = ['opener', 'support', 'headliner'];
            if (bill.openMic) {
                if (phaseIdx === 1) this.feed('The sign-up sheet fills fast. First act tunes a borrowed guitar.');
                if (phaseIdx === 4) this.feed('Last call. The bartender rings the bell.', 'big');
                document.getElementById('live-now-playing').textContent = phaseIdx > 0 && phaseIdx < 4 ? 'OPEN MIC NIGHT' : phaseIdx === 4 ? 'LAST CALL' : 'DOORS OPEN';
            } else if (slotIdx !== undefined) {
                const s = bill.slots.find(x => x.slot.id === slotDefs[slotIdx]);
                if (s) {
                    document.getElementById('live-now-playing').textContent = s.band.name.toUpperCase();
                    this.feed(`<b>${esc(s.band.name)}</b> take${s.band.name.endsWith('s') ? '' : 's'} the stage${s.slot.id === 'headliner' ? ' to a roar' : ''}.`, 'big');
                }
            } else if (phaseIdx === 4) {
                document.getElementById('live-now-playing').textContent = 'ENCORE!';
                this.feed('The crowd stomps for an encore…', 'big');
            }
            document.getElementById('live-status').textContent = phases[phaseIdx][0];
            if (this.scene) this.scene.setLive({ playing: phaseIdx > 0, phase: phaseIdx });
        }
        const reveals = bill.openMic ? [[0, 75]] : bill.slots.map((s, i) => [i, { opener: 26, support: 50, headliner: 82 }[s.slot.id]]);
        reveals.forEach(([i, at]) => {
            if (p >= at && !live.revealed.includes(i)) {
                live.revealed.push(i);
                const perf = live.plan.performances[i];
                const band = bill.slots[i].band;
                const tone = perf >= 3.6 ? 'good' : perf < 2.5 ? 'bad' : '';
                this.feed(`${esc(band.name)} played ${Sim.performanceLabel(perf)} (${perf.toFixed(1)}★).`, tone);
                if (this.scene) this.scene.pulse(perf >= 3.6 ? 1 : 0.3);
            }
        });

        // Crises pause the show
        const due = live.crises.find(c => !c.done && p >= c.at);
        if (due) { this.openCrisis(due); }

        // Running numbers
        const att = this.liveAttendance();
        const sat = this.liveSat();
        const running = Sim.settleShow(ctx, Object.assign({}, live.plan, { performances: bill.slots.map((s, i) => live.revealed.includes(i) ? live.plan.performances[i] : s.band.quality) }), live.mods);
        const frac = p / 100;
        document.getElementById('live-progress-bar').style.width = p + '%';
        document.getElementById('live-attendance').textContent = att.toLocaleString();
        document.getElementById('live-bar').textContent = fmt(running.barGross * frac);
        document.getElementById('live-bar-note').textContent = `${Math.round(running.barGross * frac / running.drinkPrice || 0).toLocaleString()} drinks poured`;
        document.getElementById('live-tickets').textContent = fmt(running.ticketGross * Math.min(1, att / Math.max(1, live.plan.attendance)));
        document.getElementById('live-merch').textContent = fmt(running.merchCut * frac);
        document.getElementById('live-vibe').textContent = p < 8 ? 'GATHERING' : Sim.vibeLabel(sat);
        document.getElementById('live-vibe-fill').style.width = (p < 8 ? 50 : sat) + '%';
        Music.setCrowd(Math.min(1, (att / Math.max(1, ctx.report.legalCap)) * (0.4 + sat / 160)));
        if (this.scene) this.scene.setLive({ crowd: att / Math.max(1, ctx.report.legalCap), vibe: sat / 100, genre: bill.genre });

        // Flavor
        if (p - live.lastFlavor > 9 && p > 14 && p < 95) {
            live.lastFlavor = p;
            this.feed(this.flavorLine(sat, att));
        }

        if (p >= 100) this.endLive();
    },

    flavorLine(sat, att) {
        const pick = a => a[Math.floor(Math.random() * a.length)];
        if (sat >= 80) return pick(['The floor is bouncing. Literally.', 'Phones in the air for a singalong.', 'Someone crowd-surfs all the way to the bar.', 'The bar can barely keep up. Nobody minds.', 'Strangers hugging at the barrier.']);
        if (sat >= 60) return pick(['Heads nodding all the way to the back wall.', 'A small pit opens up near the front.', 'Merch line is ten deep.', 'The sound guy gives you a thumbs up.', `${att.toLocaleString()} people and the room feels alive.`]);
        if (sat >= 40) return pick(['Polite applause between songs.', 'Some folks drift toward the bar.', 'A couple near the door checks their phones.', 'The crowd warms up slowly.']);
        return pick(['Long gaps of silence between songs.', 'People are leaving early.', 'Someone asks for a refund at the door.', 'The bartender looks bored.']);
    },

    openCrisis(c) {
        const live = this.ui.live;
        live.crisisOpen = c;
        const cr = DATA.CRISES.find(x => x.id === c.id);
        const scale = live.ctx.venue.costScale;
        document.getElementById('crisis-prompt-title').textContent = cr.title;
        document.getElementById('crisis-prompt-desc').textContent = cr.desc;
        const secName = DATA.SECURITY.find(s => s.id === live.ctx.securityId).name.toLowerCase();
        document.getElementById('crisis-choices').innerHTML = cr.choices.map((ch, i) => {
            const desc = ch.key === 'security' ? `depends on your ${secName} security` : (Sim.describeEffects(ch.effects, scale) || 'no effect');
            return `<button class="choice" onclick="Game.resolveCrisis(${i})"><span>${esc(ch.text)}</span><small>${desc}</small></button>`;
        }).join('');
        document.getElementById('interactive-crisis-box').classList.remove('hidden');
        if (this.scene) this.scene.alarm(true);
    },

    resolveCrisis(i) {
        const live = this.ui.live;
        const c = live.crisisOpen;
        if (!c) return;
        const cr = DATA.CRISES.find(x => x.id === c.id);
        const ch = cr.choices[i];
        const out = ch.key === 'security' ? Sim.securityOutcome(live.ctx.securityId, this.rng) : Sim.resolveEffects(ch.effects, live.ctx.venue.costScale, this.rng);
        this.applyMods(out, cr.title);
        c.done = true;
        live.crisisOpen = null;
        document.getElementById('interactive-crisis-box').classList.add('hidden');
        const bits = [];
        if (out.cash) bits.push(fmtSigned(out.cash));
        if (out.vibe) bits.push(`${out.vibe > 0 ? '+' : ''}${out.vibe} vibe`);
        if (out.rep) bits.push(`${out.rep > 0 ? '+' : ''}${out.rep} rep`);
        this.feed(`<b>${esc(cr.title)}:</b> ${esc(out.notes.join(' ') || ch.text + '.')} ${bits.length ? `<span class="dim">(${bits.join(', ')})</span>` : ''}`, (out.vibe || 0) + (out.rep || 0) * 3 >= 0 ? 'good' : 'bad');
        if (this.scene) this.scene.alarm(false);
    },

    // Kept for compatibility with the original button handlers.
    resolveCrisisLegacy(action) { this.resolveCrisis(action === 'intervene' ? 0 : 1); },

    endLive() {
        const live = this.ui.live;
        live.done = true;
        this.stopLiveTimer();
        live.result = Sim.settleShow(live.ctx, live.plan, live.mods);
        document.getElementById('live-status').textContent = 'SHOW CONCLUDED';
        document.getElementById('live-now-playing').textContent = 'GOODNIGHT!';
        this.feed(`House lights up. ${live.plan.attendance.toLocaleString()} fans spill out into the night.`, 'big');
        this.renderTimeline();
        Music.setCrowd(live.result.sat.score > 60 ? 1 : 0.4);
        setTimeout(() => Music.setCrowd(0), 2500);
        const fin = document.getElementById('finish-show-btn');
        fin.disabled = false;
        fin.innerHTML = 'VIEW SETTLEMENT' + icon('next');
        if (this.scene) this.scene.setLive({ playing: false, phase: 5 });
    },

    finishShow() {
        const live = this.ui.live;
        if (!live || !live.done) return;
        const s = this.state;
        const ctx = live.ctx;
        const r = live.result;
        const vs = this.activeState();
        // Upfront costs were already paid; the settlement net includes them.
        this.changeFunds(r.net + live.upfront);
        const repBefore = s.rep;
        s.rep = Sim.clamp(s.rep + r.repDelta, 0, 100);
        s.hype = r.hypeNext;
        ctx.bill.slots.forEach(sl => { if (!sl.band.openMic) s.history[sl.band.id] = ctx.showDay; });
        s.stats.revenue += r.revenue;
        s.stats.profit += r.net;
        s.stats.shows++;
        s.stats.bestAttendance = Math.max(s.stats.bestAttendance, live.plan.attendance);
        if (live.plan.fill >= 0.98) s.stats.sellouts++;
        vs.shows++;
        vs.revenue = (vs.revenue || 0) + r.revenue;
        vs.profit = (vs.profit || 0) + r.net;
        vs.best = Math.max(vs.best || 0, live.plan.attendance);
        s.log.push({
            day: ctx.showDay, venue: vs.name, headliner: ctx.bill.headliner.name,
            bill: ctx.bill.slots.slice().reverse().map(x => x.band.name),
            attendance: live.plan.attendance, cap: ctx.report.legalCap, fill: live.plan.fill, vibe: r.sat.score, net: r.net, revenue: r.revenue
        });
        if (s.log.length > 200) s.log.shift();
        s.repLog.push([ctx.showDay, Math.round(s.rep * 10) / 10]);
        if (s.repLog.length > 200) s.repLog.shift();
        const legend = ctx.venue.id === 'stadium' && live.plan.fill >= 0.98 && !s.flags.legend;
        if (legend) s.flags.legend = true;
        this.ui.lastResult = { r, ctx, plan: live.plan, repBefore, notes: live.notes, legend };
        this.ui.live = null;
        this.saveGame(true);
        this.renderPost();
        this.switchScreen('screen-post-show');
        SoundManager.playSFX('money-sound');
        if (legend) setTimeout(() => this.modal({
            title: 'LIVING LEGEND',
            html: `<p>You sold out the Metro Mega Stadium. From a leaky warehouse to ${live.plan.attendance.toLocaleString()} screaming fans — ${esc(s.companyName)} is the biggest name in live music.</p><p class="dim">You can keep playing as long as you like.</p>`,
            actions: [{ label: 'KEEP ROCKING', cls: 'btn-primary' }]
        }), 600);
    },

    renderPost() {
        const { r, ctx, plan, repBefore, notes } = this.ui.lastResult;
        const s = this.state;
        const vs = this.activeState();
        document.getElementById('post-when').textContent = `Week ${Sim.weekOf(ctx.showDay)} · ${DATA.DAY_NAMES[ctx.dayIdx]} · ${vs.name}`;
        const badge = document.getElementById('post-result');
        badge.textContent = r.net >= 0 ? (plan.fill >= 0.98 ? 'SOLD OUT' : 'PROFIT') : 'LOSS';
        badge.classList.toggle('loss', r.net < 0);
        const row = (label, val, cost) => `<div class="lg-row ${cost ? 'cost' : ''}"><span>${label}</span><b>${cost ? '−' : ''}${fmt(Math.abs(val))}</b></div>`;
        const eventCosts = notes.length ? notes.map(n => `<div class="lg-row ${n.cash < 0 ? 'cost' : ''}"><span>${esc(n.source)}</span><b>${n.cash < 0 ? '−' : '+'}${fmt(Math.abs(n.cash))}</b></div>`).join('') : '';
        document.getElementById('post-ledger').innerHTML = `
            <h3>NIGHTLY SETTLEMENT</h3>
            <div class="sub">${esc(ctx.bill.slots.slice().reverse().map(x => x.band.name).join(' · '))}</div>
            <div class="lg-row"><span>Attendance</span><b>${plan.attendance.toLocaleString()} / ${ctx.report.legalCap.toLocaleString()} (${Math.round(plan.fill * 100)}%)</b></div>
            <h4>Revenue</h4>
            ${row(`General admission <small>(${plan.gaSold.toLocaleString()} × ${fmt(ctx.price)})</small>`, r.gaRevenue)}
            ${plan.vipSold ? row(`VIP <small>(${plan.vipSold} × ${fmt(ctx.price * DATA.VIP_PRICE_MULT)})</small>`, r.vipRevenue) : ''}
            ${row(`Bar sales <small>(${r.served.toLocaleString()} served)</small>`, r.barGross)}
            ${row(`Merch commission <small>(20% of ${fmt(r.merchGross)})</small>`, r.merchCut)}
            ${r.sponsor ? row('Sponsorship', r.sponsor) : ''}
            <h4>Costs</h4>
            ${ctx.bill.openMic ? '' : row(`${esc(ctx.bill.headliner.name)} <small>(${ctx.deal === 'split' ? Math.round(Sim.tierOf(ctx.bill.headliner).split * 100) + '% of door' : 'guarantee'})</small>`, r.headPay, true)}
            ${r.support ? row('Support & opener', r.support, true) : ''}
            ${r.rider ? row('Hospitality riders', r.rider, true) : ''}
            ${row(`Bar stock <small>(${Math.round(DATA.BAR_COGS * 100)}% pour cost)</small>`, r.barCogs, true)}
            ${row(`Staff <small>(${r.guards} security, ${r.bartenders} bar, ${r.doorStaff} door, ${r.crew} crew)</small>`, r.staff, true)}
            ${r.marketing ? row('Promotion', r.marketing, true) : ''}
            ${eventCosts ? '<h4>Incidents & events</h4>' + eventCosts : ''}
            <div class="lg-total ${r.net >= 0 ? 'pos' : 'neg'}"><span>NET</span><b>${fmtSigned(r.net)}</b></div>
            <div class="lg-bank"><span>Bank balance</span><span>${fmt(s.funds)}</span></div>`;

        // Review
        const sc = r.sat.score;
        const outlet = DATA.REVIEW_OUTLETS[(ctx.showDay * 7 + plan.attendance) % DATA.REVIEW_OUTLETS.length];
        const perfs = plan.performances.map((p, i) => ({ p, band: ctx.bill.slots[i].band }));
        const top = perfs.reduce((a, b) => (b.p > a.p ? b : a));
        const low = perfs.reduce((a, b) => (b.p < a.p ? b : a));
        const quotes = sc >= 90 ? [`A night this city will talk about for years.`, `${top.band.name} tore the roof off.`]
            : sc >= 75 ? ['Sweaty, loud, perfect.', `${top.band.name} stole the show.`]
                : sc >= 60 ? ['A solid night out.', `Worth it for ${top.band.name} alone.`]
                    : sc >= 45 ? ['Fine, if forgettable.', `${low.band.name} dragged the night down.`]
                        : ['Flat. Skip it next time.', `${low.band.name} never found their footing.`];
        const quote = quotes[(ctx.showDay + plan.attendance) % quotes.length];
        document.getElementById('post-review').innerHTML = `<div class="stars">${stars(sc / 20)}</div><q>${esc(quote)}</q><cite>— ${outlet}</cite>`;

        document.getElementById('post-sets').innerHTML = `<h4>Sets</h4>` + ctx.bill.slots.slice().reverse().map(sl => {
            const i = ctx.bill.slots.indexOf(sl);
            const p = plan.performances[i];
            return `<div class="set-row"><span>${esc(sl.band.name)} <small>${sl.slot.label.toLowerCase()}</small></span><span><span class="stars">${stars(p)}</span> <small>${Sim.performanceLabel(p)}</small></span></div>`;
        }).join('');
        document.getElementById('post-vibe').innerHTML = `<h4>Crowd vibe: ${sc} — ${Sim.vibeLabel(sc)}</h4>` + r.sat.parts.map(p => `<div class="vb-row"><span>${esc(p.label)}</span><b class="${p.v >= 0 ? 'pos' : 'neg'}">${p.v > 0 ? '+' : ''}${p.v}</b></div>`).join('');
        const g0 = Sim.gradeOf(repBefore), g1 = Sim.gradeOf(s.rep);
        document.getElementById('post-rep').innerHTML = `<h4>Reputation</h4>
            <div class="vb-row"><span>Change</span><b class="${r.repDelta >= 0 ? 'pos' : 'neg'}">${r.repDelta >= 0 ? '+' : ''}${r.repDelta.toFixed(1)}</b></div>
            <div class="vb-row"><span>Now</span><b>${s.rep.toFixed(1)} · ${g1.grade} ${g1.title}</b></div>
            <div class="vb-row"><span>Buzz for next show</span><b class="${s.hype >= 0 ? 'pos' : 'neg'}">${s.hype >= 0 ? '+' : ''}${s.hype}%</b></div>
            ${g1.grade !== g0.grade && s.rep > repBefore ? `<div class="alert good">${icon('star')}<span>Promoted to ${g1.grade}: ${g1.title}! Bigger acts will return your calls.</span></div>` : ''}`;
    },

    proceedToNextGigCycle() {
        this.advanceTo(this.state.day + 1, false);
    },

    /* =================================================================
       Time & rent
       ================================================================= */
    // Moves the calendar forward, charging rent each Monday. Returns false on eviction.
    advanceTo(newDay, duringBooking) {
        const s = this.state;
        let rentTotal = 0;
        const weeks = [];
        for (let d = s.day + 1; d <= newDay; d++) {
            if (Sim.dayIdxOf(d) === 0) {
                const rent = this.weeklyOverhead();
                rentTotal += rent;
                weeks.push(Sim.weekOf(d));
            }
        }
        s.day = newDay;
        if (rentTotal) {
            this.changeFunds(-rentTotal);
            s.stats.rentPaid += rentTotal;
            this.ensureRoster();
        }
        if (rentTotal && s.funds < 0) {
            if (s.overdue) { this.evict(); return false; }
            s.overdue = true;
        } else if (s.funds >= 0) s.overdue = false;
        this.saveGame(true);

        const next = () => { if (!duringBooking) this.switchScreen('screen-office'); };
        if (rentTotal) {
            const lastWeek = s.log.filter(l => Sim.weekOf(l.day) === weeks[weeks.length - 1] - 1);
            const weekNet = lastWeek.reduce((a, l) => a + l.net, 0);
            const lines = this.leasedIds().map(id => `<span>${esc(this.vState(id).name)}</span><b class="neg">−${fmt(this.vDef(id).weekly)}</b>`).join('');
            const html = `<div class="ledger-mini">${lines}${weeks.length > 1 ? `<span>× ${weeks.length} weeks</span><b></b>` : ''}
                <span>Last week's shows (${lastWeek.length})</span><b class="${weekNet >= 0 ? 'pos' : 'neg'}">${fmtSigned(weekNet)}</b>
                <span>Cash after rent</span><b class="${s.funds < 0 ? 'neg' : 'money'}">${fmt(s.funds)}</b></div>
                ${s.overdue ? '<p class="neg"><b>You can\'t cover rent.</b> The landlord gives you one week. Be above $0 next Monday or you\'re out.</p>' : ''}
                <p class="dim">A new week's roster of bands is taking calls.</p>`;
            if (duringBooking) this.toast(`Rent paid: −${fmt(rentTotal)}`, s.overdue ? 'bad' : '');
            else this.modal({ title: `WEEK ${Sim.weekOf(s.day)} BEGINS`, html, actions: [{ label: 'BACK TO WORK', cls: 'btn-primary', onClick: next }], dismissable: false });
            if (!duringBooking) return true;
        }
        next();
        return true;
    },

    evict() {
        this.stopLiveTimer();
        try { localStorage.removeItem(DATA.SAVE_KEY); } catch (e) { /* ignore */ }
        const s = this.state;
        this.modal({
            title: 'EVICTED',
            html: `<p>Two Mondays without rent. The landlord changed the locks on ${esc(this.activeState() ? this.activeState().name : 'your venue')}.</p>
                <div class="ledger-mini"><span>Shows hosted</span><b>${s.stats.shows}</b><span>Lifetime revenue</span><b>${fmt(s.stats.revenue)}</b><span>Peak reputation</span><b>${Math.max(...s.repLog.map(x => x[1])).toFixed(1)}</b></div>
                <p class="dim">Every legend has a comeback story.</p>`,
            actions: [{ label: 'MAIN MENU', onClick: () => { this.state = null; this.switchScreen('screen-main-menu'); } },
                { label: 'START OVER', cls: 'btn-primary', onClick: () => { this.state = this.defaultState(); this.switchScreen('screen-intro'); } }],
            dismissable: false
        });
    },

    /* =================================================================
       Keyboard
       ================================================================= */
    handleKeyPress(event) {
        const tag = (event.target.tagName || '').toLowerCase();
        if (event.key === 'Enter' && this.ui.screen === 'screen-splash') { this.enterMainFromSplash(); return; }
        if (tag === 'input') return;
        if (event.key === 'Escape') {
            if (this.modalOpen()) { if (document.getElementById('modal-root').dataset.dismissable) this.closeModal(); return; }
            if (this.ui.screen === 'screen-settings') this.goBack();
            else if (this.state && !MENU_SCREENS.includes(this.ui.screen)) this.openPauseMenu();
        }
        if (this.ui.screen === 'screen-floor-designer' && !this.modalOpen()) {
            if (event.key === 'r' || event.key === 'R') this.rotateTool();
            if (event.key === 'Delete' || event.key === 'Backspace') this.selectTool('erase');
        }
    }
};

/* =====================================================================
   Charts (The Books) — single-series SVG, hover tooltips
   ===================================================================== */
const Charts = {
    W: 520, H: 170, PAD: { l: 46, r: 10, t: 10, b: 18 },
    POS: '#3f8fdc', NEG: '#d9772f', GRID: '#26262f', AXIS: '#6a6676',

    ticks(min, max) {
        const span = max - min || 1;
        const raw = span / 3;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
        const out = [];
        for (let v = Math.floor(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
        return out;
    },

    label(v, suffix) {
        if (suffix) return Math.round(v) + suffix;
        return fmtK(v).replace('$-', '-$');
    },

    bars(data) {
        const { W, H, PAD } = this;
        const vals = data.map(d => d.v);
        let max = Math.max(0, ...vals), min = Math.min(0, ...vals);
        if (max === min) max = min + 1;
        const ticks = this.ticks(min, max);
        min = Math.min(min, ticks[0]); max = Math.max(max, ticks[ticks.length - 1]);
        const y = v => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - min) / (max - min));
        const slot = (W - PAD.l - PAD.r) / data.length;
        const bw = Math.min(24, Math.max(2, slot - 2));
        const base = y(0);
        let g = ticks.map(t => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" stroke="${this.GRID}" stroke-width="1"/><text x="${PAD.l - 6}" y="${y(t) + 3}" fill="${this.AXIS}" font-size="9" text-anchor="end">${this.label(t)}</text>`).join('');
        g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${base}" y2="${base}" stroke="#4a4a58" stroke-width="1"/>`;
        data.forEach((d, i) => {
            const x = PAD.l + i * slot + (slot - bw) / 2;
            const top = y(Math.max(0, d.v)), bot = y(Math.min(0, d.v));
            const h = Math.max(1, bot - top);
            const r = Math.min(4, bw / 2, h);
            const path = d.v >= 0
                ? `M${x},${bot} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${bot} Z`
                : `M${x},${top} V${bot - r} Q${x},${bot} ${x + r},${bot} H${x + bw - r} Q${x + bw},${bot} ${x + bw},${bot - r} V${top} Z`;
            g += `<path d="${path}" fill="${d.v >= 0 ? this.POS : this.NEG}"/>`;
            g += `<rect x="${PAD.l + i * slot}" y="${PAD.t}" width="${slot}" height="${H - PAD.t - PAD.b}" fill="transparent" data-tip="${d.tip}"/>`;
        });
        return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Net profit per show">${g}</svg>`;
    },

    line(data, opts) {
        opts = opts || {};
        const { W, H, PAD } = this;
        const max = opts.max || Math.max(1, ...data.map(d => d.v));
        const min = 0;
        const ticks = this.ticks(min, max);
        const y = v => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - min) / (max - min));
        const x = i => PAD.l + (data.length === 1 ? 0 : i * (W - PAD.l - PAD.r) / (data.length - 1));
        let g = ticks.map(t => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" stroke="${this.GRID}" stroke-width="1"/><text x="${PAD.l - 6}" y="${y(t) + 3}" fill="${this.AXIS}" font-size="9" text-anchor="end">${this.label(t, opts.suffix || ' ')}</text>`).join('');
        const pts = data.map((d, i) => `${x(i)},${y(d.v)}`).join(' ');
        g += `<polygon points="${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}" fill="${this.POS}" opacity="0.1"/>`;
        g += `<polyline points="${pts}" fill="none" stroke="${this.POS}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
        const last = data[data.length - 1];
        g += `<circle cx="${x(data.length - 1)}" cy="${y(last.v)}" r="4" fill="${this.POS}" stroke="#14141b" stroke-width="2"/>`;
        const slot = (W - PAD.l - PAD.r) / Math.max(1, data.length - 1);
        data.forEach((d, i) => { g += `<rect x="${x(i) - slot / 2}" y="${PAD.t}" width="${slot}" height="${H - PAD.t - PAD.b}" fill="transparent" data-tip="${d.tip}"/>`; });
        return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${opts.suffix ? 'Room fill' : 'Reputation'} over time">${g}</svg>`;
    },

    bindTips(root) {
        let tip = document.querySelector('.chart-tip');
        if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip hidden'; document.body.appendChild(tip); }
        root.querySelectorAll('[data-tip]').forEach(el => {
            el.addEventListener('mousemove', e => {
                tip.innerHTML = el.dataset.tip;
                tip.classList.remove('hidden');
                tip.style.left = Math.min(window.innerWidth - 220, e.clientX + 12) + 'px';
                tip.style.top = (e.clientY + 12) + 'px';
            });
            el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
        });
    }
};

/* =====================================================================
   Venue thumbnails & floor swatches (inline SVG)
   ===================================================================== */
const Thumbs = {
    floorSwatch(id, plan) {
        switch (id) {
            case 'checker': return plan ? 'repeating-conic-gradient(#e9e4da 0 25%, #1b1b1f 0 50%) 0 0 / 50% 50%' : 'repeating-conic-gradient(#e9e4da 0 25%, #1b1b1f 0 50%) 0 0 / 10px 10px';
            case 'hardwood': return 'repeating-linear-gradient(90deg, #6b4a2b 0 7px, #5a3d22 7px 14px)';
            case 'blackgloss': return 'linear-gradient(135deg, #0a0a0f, #22222c 45%, #0a0a0f)';
            default: return plan ? 'rgba(160,170,180,0.12)' : 'linear-gradient(135deg, #4a4a50, #3a3a40)';
        }
    },

    venue(id) {
        const sky = `<defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b1e"/><stop offset="1" stop-color="#2a1030"/></linearGradient>
            <radialGradient id="glow-${id}"><stop offset="0" stop-color="#ffb238" stop-opacity="0.8"/><stop offset="1" stop-color="#ffb238" stop-opacity="0"/></radialGradient></defs>
            <rect width="320" height="120" fill="url(#sky-${id})"/>
            <g fill="#fff" opacity="0.7"><circle cx="30" cy="16" r="0.9"/><circle cx="90" cy="30" r="0.7"/><circle cx="160" cy="12" r="1"/><circle cx="240" cy="24" r="0.8"/><circle cx="290" cy="10" r="0.7"/><circle cx="200" cy="40" r="0.6"/></g>
            <rect y="108" width="320" height="12" fill="#121218"/>`;
        const scenes = {
            warehouse: `<path d="M40 108V58l40-18 40 18 40-18 40 18 40-18v68z" fill="#3a2a26"/><g stroke="#2a1d1a" stroke-width="1">${Array.from({ length: 9 }, (_, i) => `<line x1="40" x2="240" y1="${64 + i * 5}" y2="${64 + i * 5}"/>`).join('')}</g>
                <rect x="118" y="74" width="44" height="34" fill="#1d1d22" stroke="#555" /><g stroke="#2e2e35">${Array.from({ length: 6 }, (_, i) => `<line x1="118" x2="162" y1="${78 + i * 5}" y2="${78 + i * 5}"/>`).join('')}</g>
                <circle cx="140" cy="68" r="14" fill="url(#glow-${id})"/><rect x="136" y="66" width="8" height="3" fill="#ffd27a"/>
                <rect x="58" y="70" width="18" height="12" fill="#2a3a55" opacity="0.6"/><rect x="200" y="70" width="18" height="12" fill="#ffb238" opacity="0.35"/>`,
            basement: `<rect x="60" y="40" width="200" height="68" fill="#2c2c34"/><g fill="#ffcf7a" opacity="0.5"><rect x="80" y="52" width="16" height="12"/><rect x="120" y="52" width="16" height="12"/><rect x="200" y="52" width="16" height="12"/></g>
                <rect x="140" y="80" width="60" height="28" fill="#0b0b0e"/><path d="M140 108l14-22h46" stroke="#555" fill="none"/><rect x="176" y="90" width="16" height="18" fill="#c4161c" opacity="0.8"/>
                <circle cx="184" cy="86" r="22" fill="#ff3b30" opacity="0.15"/><text x="100" y="78" fill="#ff3d9a" font-family="Impact, sans-serif" font-size="13" letter-spacing="2" style="filter:drop-shadow(0 0 3px #ff3d9a)">CRYPT</text>`,
            storefront: `<rect x="50" y="36" width="220" height="72" fill="#33343c"/><rect x="50" y="36" width="220" height="10" fill="#22232a"/>
                <path d="M60 58h200l-8 10H68z" fill="#8b0000"/><g stroke="#a33" stroke-width="2">${Array.from({ length: 10 }, (_, i) => `<line x1="${70 + i * 20}" y1="58" x2="${68 + i * 20}" y2="68"/>`).join('')}</g>
                <rect x="66" y="72" width="70" height="36" fill="#ffb238" opacity="0.35"/><rect x="184" y="72" width="70" height="36" fill="#ffb238" opacity="0.35"/>
                <g stroke="#6b4a2b" stroke-width="4"><line x1="66" y1="80" x2="136" y2="96"/><line x1="184" y1="96" x2="254" y2="80"/></g><rect x="146" y="74" width="28" height="34" fill="#141418"/>`,
            garage: `<rect x="40" y="44" width="240" height="64" fill="#3b3d44"/><rect x="40" y="38" width="240" height="8" fill="#55575f"/>
                ${[60, 130, 200].map(x => `<rect x="${x}" y="60" width="56" height="48" fill="#22242a"/><g stroke="#33353c">${Array.from({ length: 7 }, (_, i) => `<line x1="${x}" x2="${x + 56}" y1="${64 + i * 6}" y2="${64 + i * 6}"/>`).join('')}</g>`).join('')}
                <rect x="130" y="60" width="56" height="20" fill="#ffb238" opacity="0.45"/><text x="116" y="54" fill="#4fd1ff" font-family="Impact, sans-serif" font-size="11" letter-spacing="3" style="filter:drop-shadow(0 0 3px #4fd1ff)">GARAGE</text>`,
            downtown_venue: `<rect x="70" y="20" width="180" height="88" fill="#2a2630"/><g fill="#ffcf7a" opacity="0.35">${[30, 44].map(y => [86, 112, 190, 216].map(x => `<rect x="${x}" y="${y}" width="14" height="9"/>`).join('')).join('')}</g>
                <rect x="80" y="60" width="160" height="22" fill="#111"/><g fill="#ffd27a">${Array.from({ length: 20 }, (_, i) => `<circle cx="${84 + i * 8}" cy="62" r="1.4"/><circle cx="${84 + i * 8}" cy="80" r="1.4"/>`).join('')}</g>
                <text x="160" y="76" fill="#fff" font-family="Impact, sans-serif" font-size="12" text-anchor="middle" letter-spacing="2">TONIGHT · LIVE</text><rect x="140" y="86" width="40" height="22" fill="#c4161c" opacity="0.6"/>`,
            music_theatre: `<rect x="60" y="30" width="200" height="78" fill="#3a2d28"/><path d="M60 30l100-14 100 14z" fill="#4a3a32"/>
                <rect x="150" y="6" width="20" height="58" fill="#181818" stroke="#ffb238"/><g fill="#ff3b30">${'PALACE'.split('').map((ch, i) => `<text x="160" y="${18 + i * 8}" font-family="Impact, sans-serif" font-size="8" text-anchor="middle">${ch}</text>`).join('')}</g>
                <rect x="84" y="66" width="152" height="16" fill="#111"/><g fill="#ffd27a">${Array.from({ length: 18 }, (_, i) => `<circle cx="${88 + i * 8.4}" cy="68" r="1.3"/>`).join('')}</g>
                ${[96, 140, 180, 220].map(x => `<rect x="${x - 10}" y="86" width="16" height="22" fill="#ffb238" opacity="0.4"/>`).join('')}`,
            festival: `<path d="M0 108 Q160 70 320 108z" fill="#16241a"/><path d="M90 96 Q160 20 230 96z" fill="none" stroke="#d8d8e0" stroke-width="4"/><path d="M100 96 Q160 34 220 96z" fill="#1a1a22"/>
                <g opacity="0.7"><path d="M160 40 L120 100 L200 100z" fill="#ff3d9a" opacity="0.25"/><path d="M160 40 L140 100 L260 100z" fill="#4fd1ff" opacity="0.18"/></g>
                <g fill="#0a0a0e">${Array.from({ length: 30 }, (_, i) => `<circle cx="${70 + i * 6.3}" cy="${102 + (i % 3)}" r="3"/>`).join('')}</g>`,
            stadium: `<ellipse cx="160" cy="98" rx="140" ry="26" fill="#2a2c34"/><ellipse cx="160" cy="94" rx="118" ry="18" fill="#1b5e33"/><path d="M20 98 Q20 60 160 56 Q300 60 300 98" fill="none" stroke="#45474f" stroke-width="10"/>
                ${[40, 280].map(x => `<line x1="${x}" y1="98" x2="${x}" y2="20" stroke="#55575f" stroke-width="3"/><rect x="${x - 10}" y="14" width="20" height="8" fill="#fff"/><path d="M${x} 22 L${x < 160 ? x + 90 : x - 90} 100 L${x < 160 ? x + 40 : x - 40} 100z" fill="#fff" opacity="0.12"/>`).join('')}
                <circle cx="160" cy="92" r="3" fill="#ffb238"/>`
        };
        return `<svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${sky}${scenes[id] || ''}</svg>`;
    }
};

window.addEventListener('DOMContentLoaded', () => Game.init());
