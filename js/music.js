/* =====================================================================
   BACKSTAGE PASS — music engine
   Everything is synthesized live with the Web Audio API: an original
   instrumental rock theme for the menus, genre-flavored live sets for
   shows, and crowd noise. No audio files needed.
   ===================================================================== */

const Music = (() => {
    let ctx = null, master = null, musicBus = null, crowdBus = null, reverb = null, revSend = null;
    let guitarBus = null, noiseBuf = null, crowdSrc = null, crowdGain = null;
    let timer = null, current = null, step = 0, nextTime = 0, volume = 0.56;
    const api = { started: false };

    const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

    function unlock() {
        if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC(); } catch (e) { ctx = null; return; }
        api.started = true;

        master = ctx.createGain();
        master.gain.value = volume;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
        master.connect(comp).connect(ctx.destination);

        musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
        crowdBus = ctx.createGain(); crowdBus.gain.value = 1; crowdBus.connect(master);

        // White noise, reused by drums and the crowd.
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

        // Room reverb from a decaying-noise impulse.
        reverb = ctx.createConvolver();
        const len = ctx.sampleRate * 1.8;
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        reverb.buffer = ir;
        revSend = ctx.createGain(); revSend.gain.value = 0.22;
        revSend.connect(reverb).connect(musicBus);

        // Guitar amp: drive -> cab EQ.
        guitarBus = ctx.createGain(); guitarBus.gain.value = 0.32;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
        const shaper = ctx.createWaveShaper(); shaper.curve = distCurve(55); shaper.oversample = '4x';
        const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3600; cab.Q.value = 0.8;
        const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1100; mid.gain.value = 4; mid.Q.value = 1;
        const out = ctx.createGain(); out.gain.value = 0.16;
        guitarBus.connect(hp).connect(shaper).connect(cab).connect(mid).connect(out);
        out.connect(musicBus);
        out.connect(revSend);
    }

    function distCurve(k) {
        const n = 2048, c = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
        return c;
    }

    function env(g, t, a, peak, dur, rel) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + a);
        g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    /* ----------------------------- Drums ----------------------------- */
    function kick(t, vol = 1) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(1.0 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g).connect(musicBus);
        o.start(t); o.stop(t + 0.36);
    }

    function noiseHit(t, { type = 'highpass', freq = 7000, q = 1, vol = 0.3, dur = 0.05, rev = 0 }) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f).connect(g).connect(musicBus);
        if (rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r).connect(revSend); }
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
    }

    function snare(t, vol = 1) {
        noiseHit(t, { type: 'bandpass', freq: 1900, q: 0.7, vol: 0.55 * vol, dur: 0.18, rev: 0.6 });
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        g.gain.setValueAtTime(0.35 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.13);
    }

    const hat = (t, open, vol = 1) => noiseHit(t, { freq: 8000, vol: (open ? 0.12 : 0.09) * vol, dur: open ? 0.22 : 0.045 });
    const crash = t => noiseHit(t, { freq: 5000, vol: 0.18, dur: 1.6, rev: 0.5 });
    const clap = t => { [0, 0.012, 0.024].forEach(o => noiseHit(t + o, { type: 'bandpass', freq: 1400, q: 1.2, vol: 0.3, dur: 0.12, rev: 0.4 })); };

    function tom(t, hz) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(hz * 0.6, t + 0.25);
        g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.32);
    }

    /* ---------------------------- Pitched ---------------------------- */
    function powerChord(t, root, dur, mute) {
        [0, 7, 12].forEach((iv, i) => {
            [-7, 7].forEach(cents => {
                const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
                o.type = 'sawtooth';
                o.frequency.value = midiHz(root + iv);
                o.detune.value = cents + (i === 2 ? 3 : 0);
                f.type = 'lowpass'; f.frequency.value = mute ? 750 : 4200;
                env(g, t, 0.004, mute ? 0.5 : 0.42, dur, mute ? 0.04 : 0.12);
                o.connect(f).connect(g).connect(guitarBus);
                o.start(t); o.stop(t + dur + 0.02);
            });
        });
    }

    // Overdriven lead guitar: two detuned voices through an amp, with
    // whammy-style bends and vibrato that fades in on long notes.
    function rockLead(t, note, dur, bend) {
        const f = midiHz(note);
        const pre = ctx.createGain(), sh = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), g = ctx.createGain();
        const vib = ctx.createOscillator(), vg = ctx.createGain();
        vib.frequency.value = 5.6;
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(dur > 0.3 ? 16 : 0, t + Math.min(dur, 0.6));
        vib.connect(vg);
        const voices = ['sawtooth', 'square'].map((type, i) => {
            const o = ctx.createOscillator();
            o.type = type;
            if (bend) { o.frequency.setValueAtTime(midiHz(note - 2), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1); }
            else o.frequency.setValueAtTime(f, t);
            o.detune.value = i ? 5 : -5;
            vg.connect(o.detune);
            o.connect(pre);
            return o;
        });
        pre.gain.value = 0.5;
        sh.curve = distCurve(28); sh.oversample = '2x';
        lp.type = 'lowpass'; lp.frequency.value = 2500; lp.Q.value = 0.7;
        body.type = 'peaking'; body.frequency.value = 850; body.gain.value = 5; body.Q.value = 0.9;
        env(g, t, 0.006, 0.05, dur, Math.min(0.12, dur / 3));
        pre.connect(sh).connect(lp).connect(body).connect(g);
        g.connect(musicBus);
        g.connect(revSend);
        const dl = ctx.createDelay(); dl.delayTime.value = 0.38;
        const fb = ctx.createGain(); fb.gain.value = 0.2;
        const wet = ctx.createGain(); wet.gain.value = 0.22;
        g.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(musicBus);
        const end = t + dur + 0.05;
        voices.forEach(o => { o.start(t); o.stop(end); });
        vib.start(t); vib.stop(end);
        setTimeout(() => { try { dl.disconnect(); fb.disconnect(); wet.disconnect(); } catch (e) { /* gone */ } }, (t - ctx.currentTime + dur + 2.5) * 1000);
    }

    function bass(t, note, dur, type = 'sawtooth', vol = 0.32) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = type; o2.type = 'sine';
        o.frequency.value = midiHz(note); o2.frequency.value = midiHz(note);
        f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 2;
        env(g, t, 0.005, vol, dur, 0.05);
        o.connect(f); o2.connect(f); f.connect(g).connect(musicBus);
        o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    }

    function lead(t, note, dur, opts = {}) {
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        const sh = ctx.createWaveShaper(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = opts.type || 'square';
        o.frequency.value = midiHz(note);
        if (opts.bend) { o.frequency.setValueAtTime(midiHz(note - 2), t); o.frequency.linearRampToValueAtTime(midiHz(note), t + 0.12); }
        lfo.frequency.value = 5.5; lg.gain.value = opts.type === 'sawtooth' ? 0 : 6;
        lfo.connect(lg).connect(o.detune);
        sh.curve = distCurve(opts.clean ? 2 : 18);
        f.type = 'lowpass'; f.frequency.value = opts.cutoff || 4200;
        env(g, t, 0.01, opts.vol || 0.07, dur, Math.min(0.15, dur / 3));
        o.connect(sh).connect(f).connect(g);
        g.connect(musicBus);
        const dl = ctx.createDelay(); dl.delayTime.value = 0.32;
        const fb = ctx.createGain(); fb.gain.value = 0.28;
        const wet = ctx.createGain(); wet.gain.value = 0.35;
        g.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(musicBus);
        g.connect(revSend);
        o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
        setTimeout(() => { try { dl.disconnect(); fb.disconnect(); wet.disconnect(); } catch (e) { /* gone */ } }, (t - ctx.currentTime + dur + 2.5) * 1000);
    }

    /* ---------------------------------------------------------------
       Songs. Riff events: [step, semitones above key, length in 16ths, mute]
       --------------------------------------------------------------- */
    const RIFF_A = [[0, 0, 1.5, 1], [2, 0, 1.5, 1], [4, 0, 1.5, 1], [6, 0, 1.5, 1], [8, 3, 2, 0], [10, 5, 2, 0], [12, 0, 1.5, 1], [14, 0, 1.5, 1]];
    const RIFF_A2 = [[0, 0, 1.5, 1], [2, 0, 1.5, 1], [4, 0, 1.5, 1], [6, 0, 1.5, 1], [8, 7, 2, 0], [10, 5, 2, 0], [12, 3, 2, 0], [14, 2, 2, 0]];
    const MEL_1 = [
        [[0, 59, 3], [3, 62, 3], [6, 64, 6, 1], [12, 62, 2], [14, 64, 2]],
        [[0, 67, 4, 1], [4, 64, 4], [8, 62, 4], [12, 59, 4]],
        [[0, 57, 3], [3, 59, 3], [6, 62, 4], [10, 64, 6, 1]],
        [[0, 64, 10, 1], [12, 67, 2], [14, 69, 2]]
    ];
    const MEL_CHORUS = [
        [[0, 67, 6, 1], [6, 64, 2], [8, 67, 4], [12, 69, 4]],
        [[0, 71, 8, 1], [8, 69, 4], [12, 67, 4]],
        [[0, 69, 6], [6, 66, 2], [8, 69, 4], [12, 74, 4, 1]],
        [[0, 71, 12, 1], [12, 67, 2], [14, 69, 2]]
    ];
    const CHORUS_ROOTS = [-4, 3, -2, 0];   // C G D E relative to E

    // The menu theme: "Loading Dock Stomp" (A, 116 BPM) — a mid-tempo hard-rock
    // groove: riff, chorus, guitar solo. Riff events: [step, semitones, 16ths, mute]
    const HR_RIFF = [
        [[0, 0, 2, 0], [2, 0, 1, 1], [3, 0, 1, 1], [4, 3, 2, 0], [6, 0, 1, 1], [7, 5, 3, 0], [10, 0, 1, 1], [11, 0, 1, 1], [12, 7, 2, 0], [14, 5, 1, 0], [15, 3, 1, 0]],
        [[0, 0, 2, 0], [2, 0, 1, 1], [3, 0, 1, 1], [4, 3, 2, 0], [6, 0, 1, 1], [7, 5, 3, 0], [10, 7, 2, 0], [12, 10, 2, 0], [14, 7, 2, 0]]
    ];
    const HR_CHORUS = [5, 0, -2, 7]; // D A G E
    // Lead lines: [step, MIDI note, 16ths, bend]
    const HR_HOOK = [
        [[0, 81, 6, 1], [6, 79, 2], [8, 76, 4], [12, 74, 4]],
        [[0, 76, 6, 1], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
        [[0, 79, 4, 1], [4, 76, 2], [6, 74, 2], [8, 79, 4], [12, 81, 4]],
        [[0, 83, 8, 1], [8, 79, 2], [10, 76, 2], [12, 74, 2], [14, 72, 2]]
    ];
    const HR_SOLO = [
        [[0, 76, 3, 1], [3, 79, 1], [4, 81, 4, 1], [8, 79, 2], [10, 76, 2], [12, 74, 2], [14, 72, 2]],
        [[0, 74, 2, 1], [2, 72, 2], [4, 69, 4], [8, 72, 1], [9, 74, 1], [10, 75, 1], [11, 76, 5, 1]],
        [[0, 81, 2], [2, 79, 2], [4, 76, 2], [6, 79, 2], [8, 81, 6, 1], [14, 84, 2]],
        [[0, 81, 2], [2, 79, 1], [3, 76, 1], [4, 74, 2], [6, 72, 2], [8, 69, 8, 1]]
    ];
    function anthemBar(bar) {
        // 0-1 guitar intro, 2-9 riff, 10-13 chorus with the hook, 14-17 riff with a solo
        if (bar < 2) return { sec: 'hrIntro', i: bar };
        if (bar < 10) return { sec: 'hrRiff', i: bar - 2 };
        if (bar < 14) return { sec: 'hrChorus', i: bar - 10, rockLead: HR_HOOK[bar - 10] };
        return { sec: 'hrRiff', i: bar - 14, rockLead: HR_SOLO[bar - 14] };
    }

    const STYLES = {
        anthem: { bpm: 116, key: 45, bars: 18, loopTo: 2, vol: 0.3, arrange: anthemBar },
        rock:   { bpm: 150, key: 45, bars: 16, loopTo: 0, vol: 0.55, arrange: b => b % 8 < 4 ? { sec: 'riff', i: b % 4, lead: b >= 8 ? MEL_1[b % 4].map(n => [n[0], n[1] + 5, n[2], n[3]]) : null } : { sec: 'chorus', i: b % 4 } },
        punk:   { bpm: 178, key: 43, bars: 8, loopTo: 0, vol: 0.55, arrange: b => b < 4 ? { sec: 'punk', i: b } : { sec: 'chorus', i: b - 4 } },
        electro: { bpm: 124, key: 45, bars: 16, loopTo: 0, vol: 0.5, arrange: b => ({ sec: b < 8 ? 'electro' : 'electro2', i: b % 4 }) },
        groove: { bpm: 90, key: 41, bars: 8, loopTo: 0, vol: 0.55, arrange: b => ({ sec: 'groove', i: b % 4 }) }
    };
    const GENRE_STYLE = { punk: 'punk', metal: 'rock', indie: 'rock', country: 'rock', synth: 'electro', edm: 'electro', pop: 'electro', hiphop: 'groove', jazz: 'groove', folk: 'groove' };

    function scheduleStep(st, t, style) {
        const S = STYLES[style];
        const s16 = 60 / S.bpm / 4;
        const total = S.bars * 16;
        let pos = st;
        if (pos >= total) pos = S.loopTo * 16 + ((pos - total) % ((S.bars - S.loopTo) * 16));
        const bar = Math.floor(pos / 16), s = pos % 16;
        const a = S.arrange(bar);
        const K = S.key;
        const lastBarOfPhrase = (a.i % 4) === 3;

        switch (a.sec) {
            case 'intro': {
                if (s === 0) { powerChord(t, K, s16 * 15, false); crash(t); kick(t); bass(t, K - 12, s16 * 15); }
                if (a.i === 0 && s % 4 === 0) hat(t, false);
                if (a.i === 1) {
                    if (s % 2 === 0) kick(t, 0.7);
                    if (s >= 8) snare(t, 0.4 + s / 30);
                }
                break;
            }
            case 'riff': {
                const riff = a.i === 3 ? RIFF_A2 : RIFF_A;
                riff.forEach(([at, n, len, mute]) => { if (at === s) { powerChord(t, K + n, s16 * len, !!mute); } });
                if (s % 2 === 0) { const root = (riff.filter(e => e[0] <= s).pop() || [0, 0])[1]; bass(t, K - 12 + root, s16 * 1.8); }
                if ([0, 8, 10].includes(s)) kick(t);
                if (s === 4 || s === 12) snare(t);
                if (s % 2 === 0) hat(t, s === 14);
                if (s === 0 && a.i === 0) crash(t);
                if (lastBarOfPhrase && s >= 12) { snare(t, 0.6); if (s === 14) tom(t, 110); }
                break;
            }
            case 'hrIntro': {
                // The guitar plays the riff alone, then the drums count the band in
                HR_RIFF[a.i].forEach(([at, n, len, mute]) => { if (at === s) powerChord(t, K + n, s16 * len, !!mute); });
                if (a.i === 1) {
                    if (s % 2 === 0) hat(t, false, 0.6);
                    if (s >= 12) { snare(t, 0.35 + (s - 12) * 0.15); if (s === 14) tom(t, 120); }
                }
                break;
            }
            case 'hrRiff': {
                const riff = HR_RIFF[a.i % 4 === 3 ? 1 : 0];
                riff.forEach(([at, n, len, mute]) => { if (at === s) powerChord(t, K + n, s16 * len, !!mute); });
                if (s % 2 === 0) { const root = (riff.filter(e => e[0] <= s).pop() || [0, 0])[1]; bass(t, K - 12 + root, s16 * 1.7); }
                if (s === 0 || s === 7 || s === 10) kick(t, 0.9);
                if (s === 4 || s === 12) snare(t, 0.85);
                if (s % 2 === 0) hat(t, false, s % 4 === 0 ? 0.8 : 0.55);
                if (s === 0 && a.i % 4 === 0) crash(t);
                if (lastBarOfPhrase && s >= 12) tom(t, [165, 140, 115, 95][s - 12]);
                break;
            }
            case 'hrChorus': {
                const root = HR_CHORUS[a.i % 4];
                if (s === 0 || s === 6 || s === 10) powerChord(t, K + root, s16 * (s === 6 ? 3.6 : 5.6), false);
                if (s === 14) powerChord(t, K + HR_CHORUS[(a.i + 1) % 4], s16 * 2, true);
                if (s % 2 === 0) bass(t, K - 12 + root, s16 * 1.8);
                if (s === 0 || s === 6 || s === 10) kick(t, 0.9);
                if (s === 4 || s === 12) snare(t, 0.85);
                if (s % 2 === 0) hat(t, true, 0.5);
                if (s === 0) crash(t);
                break;
            }
            case 'punk': {
                if (s % 2 === 0) { powerChord(t, K + [0, 0, 5, 3][a.i] + (s >= 8 ? [0, 0, 2, 2][a.i] : 0), s16 * 1.6, s % 4 !== 0); bass(t, K - 12 + [0, 0, 5, 3][a.i], s16 * 1.6); }
                if (s % 4 === 0) kick(t);
                if (s % 4 === 2) snare(t, 0.8);
                hat(t, false, 0.7);
                if (s === 0 && a.i === 0) crash(t);
                break;
            }
            case 'chorus': {
                const root = CHORUS_ROOTS[a.i % 4];
                if (s === 0 || s === 6 || s === 8 || s === 14) powerChord(t, K + root, s16 * (s === 8 ? 6 : 2), false);
                if (s % 2 === 0) bass(t, K - 12 + root, s16 * 1.8);
                if ([0, 3, 8, 11].includes(s)) kick(t);
                if (s === 4 || s === 12) snare(t);
                if (s % 2 === 0) hat(t, true, 0.8);
                if (s === 0) crash(t);
                if (lastBarOfPhrase && s >= 12) { snare(t, 0.7); tom(t, s === 13 ? 140 : 95); }
                break;
            }
            case 'break': {
                if (s % 2 === 0) powerChord(t, K, s16 * 1.2, true);
                if (s === 0 || s === 6) { kick(t); bass(t, K - 12, s16 * 5); }
                if (s === 8) snare(t, 1.1);
                if (s % 4 === 0) hat(t, false);
                if (a.i === 1 && s >= 12) snare(t, 0.5 + (s - 12) * 0.15);
                break;
            }
            case 'electro':
            case 'electro2': {
                const roots = [0, -4, 3, -2];
                const root = roots[a.i];
                if (s % 4 === 0) kick(t, 0.9);
                if (s % 4 === 2) hat(t, true, 0.8);
                if (s === 4 || s === 12) clap(t);
                if (s % 2 === 1) bass(t, K - 12 + root, s16 * 0.9, 'sawtooth', 0.26);
                const arp = [0, 7, 12, 15, 12, 7, 3, 7];
                if (a.sec === 'electro2' || s % 2 === 0) lead(t, K + 12 + root + arp[s % 8], s16 * 0.9, { type: 'sawtooth', clean: true, vol: 0.04, cutoff: 2600 });
                if (s === 0 && a.i === 0) crash(t);
                break;
            }
            case 'groove': {
                const roots = [0, 0, 5, 3];
                const root = roots[a.i];
                const swing = s % 2 === 1 ? s16 * 0.3 : 0;
                if (s === 0 || s === 7 || s === 10) kick(t, 0.95);
                if (s === 4 || s === 12) snare(t, 0.8);
                if (s % 2 === 0 || s === 15) hat(t + swing, false, 0.8);
                if ([0, 3, 6, 10, 12].includes(s)) bass(t, K - 12 + root + (s === 6 ? 7 : s === 12 ? 5 : 0), s16 * 2, 'triangle', 0.4);
                if (s === 0 || s === 8) [0, 3, 7, 10].forEach(iv => lead(t, K + 12 + root + iv, s16 * 6, { type: 'triangle', clean: true, vol: 0.025, cutoff: 1800 }));
                break;
            }
        }
        // Lead melody on top
        if (a.lead) a.lead.forEach(([at, note, len, bend]) => { if (at === s) lead(t, note + (K - 40), s16 * len * 0.95, { bend: !!bend }); });
        if (a.rockLead) a.rockLead.forEach(([at, note, len, bend]) => { if (at === s) rockLead(t, note, s16 * len * 0.95, !!bend); });
        return s16;
    }

    function tick() {
        if (!current) return;
        while (nextTime < ctx.currentTime + 0.15) {
            const dur = scheduleStep(step, nextTime, current.style);
            nextTime += dur;
            step++;
        }
    }

    function play(name, opts) {
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const style = name === 'menu' ? 'anthem' : (GENRE_STYLE[(opts && opts.genre)] || 'rock');
        if (current && current.style === style && current.name === name) return;
        const start = () => {
            current = { name, style };
            step = 0;
            nextTime = ctx.currentTime + 0.08;
            const target = STYLES[style].vol;
            musicBus.gain.cancelScheduledValues(ctx.currentTime);
            musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
            musicBus.gain.exponentialRampToValueAtTime(target, ctx.currentTime + 0.6);
            if (!timer) timer = setInterval(tick, 25);
        };
        if (current) { fadeOut(0.35); setTimeout(start, 380); } else start();
    }

    function fadeOut(sec) {
        if (!ctx || !musicBus) return;
        const t = ctx.currentTime;
        musicBus.gain.cancelScheduledValues(t);
        musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), t);
        musicBus.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    }

    function stop() {
        if (!ctx || !current) { setCrowd(0); return; }
        fadeOut(0.5);
        current = null;
        setTimeout(() => { if (!current && timer) { clearInterval(timer); timer = null; } }, 600);
        setCrowd(0);
    }

    // Crowd: filtered noise that swells with the room.
    function setCrowd(level) {
        if (!ctx) return;
        if (!crowdSrc) {
            crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
            crowdGain = ctx.createGain(); crowdGain.gain.value = 0.0001;
            const wob = ctx.createOscillator(), wg = ctx.createGain();
            wob.frequency.value = 0.35; wg.gain.value = 250;
            wob.connect(wg).connect(bp.frequency); wob.start();
            crowdSrc.connect(bp).connect(lp).connect(crowdGain).connect(crowdBus);
            crowdSrc.start();
        }
        const t = ctx.currentTime;
        crowdGain.gain.cancelScheduledValues(t);
        crowdGain.gain.setTargetAtTime(Math.max(0.0001, level * 0.16), t, 0.6);
    }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v)) * 0.6;
        if (master) master.gain.setTargetAtTime(Math.max(0.0001, volume), ctx.currentTime, 0.1);
    }

    return Object.assign(api, { unlock, play, stop, setVolume, setCrowd });
})();
