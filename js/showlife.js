/* =====================================================================
   BACKSTAGE PASS — Show life
   Makes a night sound like a real gig: every act plays its own song in
   its own genre, the crowd cheers when a band walks on and after a
   great set, and the night ends with applause instead of silence.
   ===================================================================== */

(() => {
    if (typeof Game === 'undefined' || typeof Music === 'undefined' || !Music.nextSong) return;

    const SLOT_FOR_PHASE = { 1: 'opener', 2: 'support', 3: 'headliner' };

    // Who is on stage during a phase of the night (null = nobody).
    function actFor(bill, phase) {
        if (bill.openMic) return phase > 0 && phase < 5 ? bill.headliner : null;
        if (phase === 4) return bill.headliner;
        const id = SLOT_FOR_PHASE[phase];
        const slot = id && bill.slots.find(s => s.slot.id === id);
        return slot ? slot.band : null;
    }

    const now = () => (window.performance ? performance.now() : Date.now());

    const liveTick = Game.liveTick;
    Game.liveTick = function () {
        const live = this.ui.live;
        const phase = live ? live.phase : null;
        const seen = live && live.revealed ? live.revealed.length : 0;
        liveTick.apply(this, arguments);
        if (!live || live !== this.ui.live || live.done) return;
        // Skipping to the end shouldn't machine-gun songs and cheers
        const rushing = live.speed >= 10;

        if (phase !== null && live.phase !== phase && live.phase > 0) {
            const bill = live.ctx.bill;
            const act = actFor(bill, live.phase);
            if (!rushing && now() - (live.songAt || 0) > 1200) {
                live.songAt = now();
                Music.nextSong((act && act.genre) || bill.genre);
            }
        }
        if (live.revealed && live.revealed.length > seen && !rushing) {
            const i = live.revealed[live.revealed.length - 1];
            const perf = live.plan.performances[i];
            Music.cheer(perf >= 3.6 ? 0.95 : perf >= 2.5 ? 0.55 : 0.2);
        }
    };

    const endLive = Game.endLive;
    Game.endLive = function () {
        endLive.apply(this, arguments);
        const live = this.ui.live;
        if (!live || !live.result) return;
        const sat = live.result.sat ? live.result.sat.score : 50;
        Music.endSet();
        Music.applause(Math.max(0.25, Math.min(1, sat / 90)));
    };
})();
