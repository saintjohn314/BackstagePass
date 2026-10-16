/* =====================================================================
   BACKSTAGE PASS — Easier floor plan building
   - UNDO button (and Ctrl/Cmd+Z, Ctrl+Shift+Z or Ctrl+Y to redo)
   - Drag across the floor to place a whole row (blueprint and diorama
     views); Shift + drag does the same in the 3D room
   - Clearer messages when you hover over something
   ===================================================================== */

(() => {
    if (typeof Game === 'undefined' || typeof DATA === 'undefined') return;
    const MAX_UNDO = 60;
    const copy = o => JSON.parse(JSON.stringify(o));
    const dz = () => Game.ui && Game.ui.designer;
    const name = type => (DATA.ITEMS[type] || {}).name || 'Item';

    /* ----------------------------- Undo ------------------------------ */
    const snap = (d, label) => ({ draft: copy(d.draft), floor: d.floor, label });
    const same = (a, d) => a.floor === d.floor && JSON.stringify(a.draft) === JSON.stringify(d.draft);

    function push(d, s) {
        d.undo = d.undo || [];
        d.undo.push(s);
        if (d.undo.length > MAX_UNDO) d.undo.shift();
        d.redo = [];
        updateButton();
    }

    // Run fn; if it changed the layout, remember how it was before.
    function undoable(label, fn) {
        return function () {
            const d = dz();
            if (!d || d.stroke) return fn.apply(this, arguments);
            const before = snap(d, typeof label === 'function' ? label.apply(this, arguments) : label);
            const out = fn.apply(this, arguments);
            const now = dz();
            if (now === d && !same(before, d)) push(d, before);
            return out;
        };
    }

    function restore(d, s) {
        d.draft = copy(s.draft);
        d.floor = s.floor;
        Game.renderPalette();
        Game.refreshDesigner();
        if (d.hover) Game.designerHover(d.hover.r, d.hover.c);
    }

    Game.undoDesigner = function () {
        const d = dz();
        if (!d || !d.undo || !d.undo.length) { if (d) this.setHint('Nothing to undo yet.'); return; }
        const s = d.undo.pop();
        (d.redo = d.redo || []).push(snap(d, s.label));
        restore(d, s);
        this.setHint(`Undid ${s.label}.${d.undo.length ? ' Press UNDO again to keep going back.' : ''}`, 'good');
        updateButton();
    };

    Game.redoDesigner = function () {
        const d = dz();
        if (!d || !d.redo || !d.redo.length) return;
        const s = d.redo.pop();
        (d.undo = d.undo || []).push(snap(d, s.label));
        restore(d, s);
        this.setHint(`Redid ${s.label}.`, 'good');
        updateButton();
    };

    Game.designerClick = undoable(function (r, c, alt) {
        const d = dz();
        if (d.tool === 'erase' || alt) {
            const it = this.itemAt(r, c);
            return it ? `removing the ${name(it.type)}` : 'a change';
        }
        return `placing a ${name(d.tool)}`;
    }, Game.designerClick);
    if (Game.quickBuild) Game.quickBuild = undoable('Quick Build', Game.quickBuild);
    Game.setFloor = undoable(function (id) { const f = DATA.FLOORS.find(x => x.id === id); return `the ${f ? f.name : 'floor'} change`; }, Game.setFloor);
    Game.discardDraft = undoable('discarding your changes', Game.discardDraft);

    // Once it's built, the old drafts no longer apply.
    const approve = Game.approveConstruction;
    Game.approveConstruction = function () {
        const out = approve.apply(this, arguments);
        const d = dz(), p = this.pendingChanges();
        if (d && p && !p.any) { d.undo = []; d.redo = []; updateButton(); }
        return out;
    };

    /* ---------------------- Drag to place a row ----------------------- */
    function beginStroke() {
        const d = dz();
        if (!d || d.stroke) return;
        d.stroke = { before: snap(d, d.tool === 'erase' ? 'a demolish sweep' : `a row of ${name(d.tool)}s`), count: 0 };
    }
    function endStroke() {
        const d = dz();
        if (!d || !d.stroke) return;
        const st = d.stroke;
        d.stroke = null;
        if (!same(st.before, d)) {
            push(d, st.before);
            const n = Math.abs(d.draft.length - st.before.draft.length);
            if (n > 1) Game.setHint(`${d.tool === 'erase' ? 'Removed' : 'Placed'} ${n} items in one go. UNDO takes them all back.`, 'good');
        }
    }

    let paint = null, swallowClick = false;
    const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#plan-host .plan-cell') : null; };
    const key = el => el ? el.dataset.r + ',' + el.dataset.c : '';

    function wirePlan() {
        const host = document.getElementById('plan-host');
        if (!host || host.dataset.paint) return;
        host.dataset.paint = '1';
        host.addEventListener('pointerdown', e => {
            if (e.button !== 0 || !dz()) return;
            const cell = e.target.closest && e.target.closest('.plan-cell');
            if (!cell) return;
            paint = { first: cell.dataset, last: key(cell), started: false };
            e.preventDefault();
        }, true);
        window.addEventListener('pointermove', e => {
            if (!paint) return;
            if (!(e.buttons & 1)) { finish(); return; }
            const cell = cellAt(e.clientX, e.clientY);
            if (!cell || key(cell) === paint.last) return;
            if (!paint.started) {
                paint.started = true;
                beginStroke();
                Game.designerClick(+paint.first.r, +paint.first.c);
            }
            paint.last = key(cell);
            Game.designerHover(+cell.dataset.r, +cell.dataset.c);
            Game.designerClick(+cell.dataset.r, +cell.dataset.c);
        });
        const finish = () => {
            if (!paint) return;
            if (paint.started) { endStroke(); swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); }
            paint = null;
        };
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
        host.addEventListener('click', e => { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
    }

    const setView = Game.setDesignerView;
    Game.setDesignerView = function (view) {
        const out = setView.apply(this, arguments);
        wirePlan();
        if (this.scene) {
            this.scene.onPaintStart = () => beginStroke();
            this.scene.onPaintEnd = () => endStroke();
        }
        addButton();
        return out;
    };

    /* ------------------------- Clearer hints -------------------------- */
    const hover = Game.designerHover;
    Game.designerHover = function (r, c) {
        const out = hover.apply(this, arguments);
        const d = dz();
        if (!d || d.tool === 'erase') return out;
        const it = this.itemAt(r, c);
        if (it) this.setHint(`${name(it.type)} is already here. Pick an empty square, or right-click it to demolish.`, 'bad');
        return out;
    };

    const select = Game.selectTool;
    Game.selectTool = function (type) {
        const out = select.apply(this, arguments);
        const d = dz();
        if (d && type !== 'erase') {
            const how = d.view === '3d' ? 'Hold Shift and drag to place a row.' : 'Drag to place a row.';
            this.setHint(`${name(type)}: click the floor to place it. ${how}`);
        } else if (d) {
            this.setHint(`Demolish: click a fixture to remove it${d.view === '3d' ? ', or Shift + drag to sweep' : ', or drag to sweep'}.`);
        }
        return out;
    };

    /* ------------------------- UNDO button ---------------------------- */
    function addButton() {
        if (document.getElementById('undo-btn')) { updateButton(); return; }
        const qb = document.getElementById('quick-build-btn');
        if (!qb) return;
        qb.insertAdjacentHTML('afterend', '<button class="btn-chip" id="undo-btn" onclick="Game.undoDesigner()" title="Undo (Ctrl+Z)" disabled><svg class="ic" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg>UNDO</button>');
        updateButton();
    }
    function updateButton() {
        const b = document.getElementById('undo-btn');
        const d = dz();
        if (!b) return;
        const s = d && d.undo && d.undo[d.undo.length - 1];
        b.disabled = !s;
        b.title = s ? `Undo ${s.label} (Ctrl+Z)` : 'Nothing to undo';
    }
    const refresh = Game.refreshDesigner;
    Game.refreshDesigner = function () {
        const out = refresh.apply(this, arguments);
        updateButton();
        return out;
    };

    /* --------------------------- Keyboard ----------------------------- */
    document.addEventListener('keydown', e => {
        if (Game.ui.screen !== 'screen-floor-designer' || (Game.modalOpen && Game.modalOpen())) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); Game.undoDesigner(); }
        else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); Game.redoDesigner(); }
    });

    addButton();
    wirePlan();
})();
