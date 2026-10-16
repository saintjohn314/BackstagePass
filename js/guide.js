/* =====================================================================
   BACKSTAGE PASS — First-night guide
   A friendly coach card that walks a brand-new player from the intro
   to their first settlement: lease a room, Quick Build, approve it,
   book a band, open the doors. It points at the button to press, and
   it can be skipped at any time. It never shows once you've played a
   show (or skipped it).
   ===================================================================== */

(() => {
    if (typeof Game === 'undefined') return;

    const TOTAL = 8;
    const hidden = new Set();      // steps the player closed with "Got it"
    let card = null, target = null, current = null, raf = 0;

    function active() {
        const s = Game.state;
        if (!s || !s.flags || s.flags.guideDone) return false;
        return (s.stats && s.stats.shows === 0) || Game.ui.screen === 'screen-post-show';
    }

    // Which tip fits the screen you're on (and what you've done there).
    function stepFor(screen) {
        const s = Game.state;
        switch (screen) {
            case 'screen-intro':
                return { key: 'intro', n: 1, title: 'Welcome to Backstage Pass', text: 'You run a music venue. Lease a room, build it out, book bands and keep the crowd happy. Start by finding a place.', target: '#screen-intro .btn-primary' };
            case 'screen-venue-selector':
                if (Game.leasedIds && Game.leasedIds().length) return null;
                return { key: 'lease', n: 2, title: 'Pick your first room', text: 'The Abandoned Warehouse is cheap and needs no reputation. Hit LEASE on it and sign.', target: '#venue-list .venue-card:not(.locked) .venue-actions .btn-primary' };
            case 'screen-identity-setup':
                return { key: 'name', n: 3, title: 'Put your name on it', text: 'Type a company and venue name, or keep the defaults. Then head to the floor plan.', target: '#identity-proceed' };
            case 'screen-floor-designer': {
                const d = Game.ui.designer;
                if (!d || !d.report) return null;
                const p = Game.pendingChanges();
                if (p && p.any) return { key: 'approve', n: 4, title: 'Make it real', text: d.report.legal ? 'Looks good! Hit APPROVE CONSTRUCTION to pay for the build. Made a mistake? UNDO takes it back.' : 'Almost there: fix the red issues in the report on the right (or hit QUICK BUILD), then APPROVE CONSTRUCTION.', target: d.report.legal ? '#approve-btn' : '#quick-build-btn' };
                const bare = d.report.soundCoverage < 0.3 && d.report.barCap === 0;
                if (!d.report.legal || bare) return { key: 'build', n: 4, title: 'Build out the room', text: `${d.report.legal ? 'The room is legal, but it has no speakers, bar or lights yet.' : 'An empty room can\'t open.'} Hit QUICK BUILD to draft restrooms, speakers, a bar and lights in one click. You can move things after.`, target: '#quick-build-btn' };
                return { key: 'book', n: 5, title: 'Ready for a crowd', text: 'The fire marshal signed off. Hit BOOK A SHOW to pick tonight\'s bands.', target: '#designer-book-btn' };
            }
            case 'screen-office':
                return { key: 'office', n: 5, title: 'Your office', text: 'This is home base. Click the desk phone to book your first show.', target: '#screen-office .hotspot[onclick*="startBooking"]' };
            case 'screen-band-scouting': {
                const b = Game.ui.booking;
                const picked = b && (b.openMic || (b.lineup && b.lineup.length));
                const btn = document.getElementById('proceed-btn');
                if (picked && btn && !btn.disabled) return { key: 'lineup2', n: 6, title: 'Nice lineup', text: 'Hit SET UP THE NIGHT when you\'re happy with the bill.', target: '#proceed-btn' };
                return { key: 'lineup', n: 6, title: 'Pick your bands', text: 'Add bands to the bill: an opener, support and a headliner. Cheap acts are fine for a first night. Short on cash? Host an Open Mic Night.', target: '#band-list .band-card:not(.locked):not(.booked)' };
            }
            case 'screen-marketing':
                return { key: 'setup', n: 7, title: 'Set up the night', text: 'Pick a night, a ticket price and some promotion. The forecast shows how it should go. Then hit OPEN DOORS.', target: '#launch-btn' };
            case 'screen-event-card':
                return { key: 'event', n: 7, title: 'Something came up', text: 'Show days get messy. Pick how to handle it; every choice is a trade-off.', target: '#event-choices-container' };
            case 'screen-live-show':
                return { key: 'live', n: 8, title: 'Showtime!', text: 'Watch the headcount and the vibe meter. If trouble starts, the show pauses for your call. Use 2× or 4× to speed things up.', target: '.live-side .vibe' };
            case 'screen-post-show':
                if (!s || s.stats.shows > 1) return null;
                return { key: 'done', n: TOTAL, title: 'Your first show is in the books', text: 'Tickets, bar and merch minus your costs. Head back to the office and book the next one. Bigger rooms unlock as your reputation grows. Have fun!', target: '.post-actions .btn-primary', last: true };
        }
        return null;
    }

    function ensureCard() {
        if (card) return card;
        card = document.createElement('div');
        card.id = 'coach';
        card.className = 'coach hidden';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-live', 'polite');
        card.innerHTML = '<i class="coach-arrow"></i><div class="coach-step"></div><h4></h4><p></p><div class="coach-actions"><button class="coach-ok"></button><button class="coach-skip">Skip guide</button></div>';
        card.querySelector('.coach-ok').onclick = () => {
            if (current && current.last) finishGuide();
            else if (current) { hidden.add(current.key); hide(); }
        };
        card.querySelector('.coach-skip').onclick = () => finishGuide();
        document.body.appendChild(card);
        return card;
    }

    function finishGuide() {
        if (Game.state && Game.state.flags) { Game.state.flags.guideDone = true; Game.saveGame(true); }
        hide();
    }

    function hide() {
        if (card) card.classList.add('hidden');
        if (target) target.classList.remove('coach-glow');
        target = null; current = null;
    }

    function show() {
        if (!active()) { hide(); return; }
        const step = stepFor(Game.ui.screen);
        if (!step || hidden.has(step.key)) { hide(); return; }
        if (step.last) Game.state.flags.guideDone = true;
        ensureCard();
        const fresh = !current || current.key !== step.key;
        current = step;
        card.querySelector('.coach-step').textContent = `FIRST NIGHT · ${step.n} OF ${TOTAL}`;
        card.querySelector('h4').textContent = step.title;
        card.querySelector('p').textContent = step.text;
        card.querySelector('.coach-ok').textContent = step.last ? 'Let\'s go' : 'Got it';
        card.querySelector('.coach-skip').classList.toggle('hidden', !!step.last);
        const el = step.target ? [...document.querySelectorAll(step.target)].find(e => e.offsetParent !== null) : null;
        if (target && target !== el) target.classList.remove('coach-glow');
        target = el || null;
        if (target) target.classList.add('coach-glow');
        card.classList.remove('hidden');
        if (fresh) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
        place();
    }

    // Sit next to the button we're pointing at, without covering it.
    function place() {
        if (!card || card.classList.contains('hidden')) return;
        const vw = window.innerWidth, vh = window.innerHeight, pad = 12;
        const w = card.offsetWidth, h = card.offsetHeight;
        const arrow = card.querySelector('.coach-arrow');
        if (!target || target.offsetParent === null) {
            card.style.left = pad + 'px'; card.style.top = (vh - h - pad) + 'px';
            card.dataset.side = 'none';
            return;
        }
        const r = target.getBoundingClientRect();
        let side = r.bottom + h + 18 < vh - pad ? 'below' : r.top - h - 18 > 64 ? 'above' : (r.left - w - 18 > pad ? 'left' : 'right');
        let x, y;
        if (side === 'above' || side === 'below') {
            x = Math.max(pad, Math.min(vw - w - pad, r.left + r.width / 2 - w / 2));
            y = side === 'above' ? r.top - h - 14 : r.bottom + 14;
            arrow.style.left = Math.max(16, Math.min(w - 16, r.left + r.width / 2 - x)) + 'px';
            arrow.style.top = '';
        } else {
            x = side === 'left' ? r.left - w - 14 : r.right + 14;
            if (x + w > vw - pad) x = vw - w - pad;
            y = Math.max(64, Math.min(vh - h - pad, r.top + r.height / 2 - h / 2));
            arrow.style.top = Math.max(16, Math.min(h - 16, r.top + r.height / 2 - y)) + 'px';
            arrow.style.left = '';
        }
        card.dataset.side = side;
        card.style.left = Math.round(x) + 'px';
        card.style.top = Math.round(y) + 'px';
    }

    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(show); };
    const wrap = (fn, after) => function () { const out = fn.apply(this, arguments); after(); return out; };
    ['switchScreen', 'refreshDesigner', 'renderVenues', 'renderBands', 'renderBill'].forEach(m => {
        if (typeof Game[m] === 'function') Game[m] = wrap(Game[m], later);
    });
    window.addEventListener('resize', () => requestAnimationFrame(place));
    document.addEventListener('scroll', () => requestAnimationFrame(place), true);
    // Modals (lease paperwork etc.) sit on top; step aside while one is open.
    const modal = Game.modal, close = Game.closeModal;
    if (modal) Game.modal = wrap(modal, () => { if (card) card.classList.add('under'); });
    if (close) Game.closeModal = wrap(close, () => { if (card) card.classList.remove('under'); later(); });

    Game.showGuide = function () {
        if (this.state && this.state.flags) { this.state.flags.guideDone = false; hidden.clear(); show(); }
    };
})();
