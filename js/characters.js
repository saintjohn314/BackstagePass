/* =====================================================================
   BACKSTAGE PASS — characters
   Original, genre-styled musicians for the stage and a crowd of fans
   for the floor. Everything is built from Three.js primitives; a small
   two-bone IK keeps hands on frets, mics, keys and drums while they play.
   People are modeled facing +z (toward the crowd), feet at y = 0 and
   about 1 unit tall, then scaled by the venue's person height.
   ===================================================================== */

const Characters = (() => {
    if (typeof THREE === 'undefined') {
        return { buildBand: () => [], animateBand() {}, buildCrowd: () => null, animateCrowd() {} };
    }

    /* ---------------------------- helpers ---------------------------- */
    const TAU = Math.PI * 2;
    const UP = new THREE.Vector3(0, 1, 0);
    const DOWN = new THREE.Vector3(0, -1, 0);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const frac = x => x - Math.floor(x);

    function hashStr(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function makeRng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

    // Shared materials (never disposed, so cached safely across shows).
    const matCache = new Map();
    function mat(color, o = {}) {
        const rough = o.rough === undefined ? 0.7 : o.rough;
        const metal = o.metal || 0;
        const key = [color, rough, metal, o.emissive || '', o.ei || 0, o.double ? 1 : 0].join('|');
        let m = matCache.get(key);
        if (!m) {
            m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
            if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei || 0.6; }
            matCache.set(key, m);
        }
        return m;
    }
    const shade = (hex, l) => '#' + new THREE.Color(hex).offsetHSL(0, 0, l).getHexString();

    const sphereG = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
    const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cylG = (rt, rb, h, seg = 10, open = false, ts = 0, tl = TAU) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl);
    function mesh(geo, m, x = 0, y = 0, z = 0) {
        const o = new THREE.Mesh(geo, m);
        o.position.set(x, y, z);
        return o;
    }
    // A limb hangs from its pivot along -y.
    function limb(len, r0, r1, m) {
        const g = cylG(r1, r0, len, 9);
        g.translate(0, -len / 2, 0);
        return new THREE.Mesh(g, m);
    }
    // A thin rod between two points (stands, straps, cables).
    function rod(a, b, r, m, seg = 6) {
        const d = new THREE.Vector3().subVectors(b, a);
        const o = new THREE.Mesh(cylG(r, r, d.length(), seg), m);
        o.position.copy(a).addScaledVector(d, 0.5);
        o.quaternion.setFromUnitVectors(UP, d.normalize());
        return o;
    }
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    /* ----------------------------- looks ----------------------------- */
    const SKIN = ['#f3cfb3', '#e8b892', '#d29a72', '#b07a52', '#8a5636', '#5e3a24'];
    const HAIR = ['#17100b', '#2b1a10', '#4a2e1a', '#6e4a2a', '#b58a4e', '#dcc07a', '#8a3a1c', '#8c8c92'];
    const BPM = { punk: 172, metal: 150, indie: 124, country: 112, folk: 100, jazz: 96, synth: 118, edm: 126, hiphop: 92, pop: 118 };

    // Who stands where: stage left, center, stage right, drum riser.
    const LINEUP = {
        punk: ['guitar', 'vocal', 'bass', 'drums'],
        metal: ['guitar', 'vocal', 'bass', 'drums'],
        indie: ['guitar', 'vocalGuitar', 'bass', 'drums'],
        country: ['acoustic', 'vocal', 'bass', 'drums'],
        folk: ['acoustic', 'vocalAcoustic', 'acoustic', 'drums'],
        jazz: ['sax', 'vocal', 'bass', 'drums'],
        synth: ['keys', 'vocal', 'keys', 'drums'],
        edm: ['keys', 'dj', 'keys', null],
        hiphop: ['mc', 'mc', 'dj', 'drums'],
        pop: ['guitar', 'singer', 'keys', 'drums']
    };

    // Wardrobe by genre. Every pick is seeded by the band, so a band
    // always looks the same but no two bands look alike.
    const STYLE = {
        punk: {
            hair: ['mohawk', 'spiky', 'spiky', 'buzz', 'long', 'mohawk'], dye: ['#e0306a', '#3ddc84', '#4fd1ff', '#f5d14a', '#ff5a1f'], dyeChance: 0.6,
            top: ['tee', 'tee', 'tank'], topColors: ['#c4161c', '#111114', '#e8e4dc', '#ffb238', '#2b2b30'],
            jacket: ['leather', 'leather', 'vest', 'none'], jacketColors: ['#141416', '#1c1c22'], vestColors: ['#3d5a80', '#2c4566', '#141416'],
            studs: 0.75, pants: ['#141418', '#26324a', '#3a3f4a', '#5a1820'], shoes: ['#101012', '#2a1a12'],
            beard: 0.12, glasses: 0.15, chain: 0.35, guitar: 'offset', guitarColors: ['#111114', '#f0ebe0', '#c4161c', '#2a8a6a']
        },
        metal: {
            hair: ['long', 'long', 'long', 'long', 'bald'], hairColors: ['#0e0a08', '#17100b', '#2b1a10', '#c8a060'], dyeChance: 0,
            top: ['tee', 'tank'], topColors: ['#0c0c0e', '#141416', '#1a1a1e', '#2a0a0a'],
            jacket: ['leather', 'none', 'vest'], jacketColors: ['#0c0c0e', '#141416'], vestColors: ['#1b2a44', '#141416'],
            studs: 0.5, pants: ['#0e0e12', '#16161c', '#22283a'], shoes: ['#0c0c0e'],
            beard: 0.55, glasses: 0, chain: 0.2, guitar: 'shard', guitarColors: ['#0c0c0e', '#d8d8de', '#7a0a12', '#2a2a30']
        },
        indie: {
            hair: ['shaggy', 'shaggy', 'beanie', 'short', 'bun', 'bob'], dyeChance: 0.05, dye: ['#4fd1ff'],
            top: ['shirt', 'tee', 'shirt'], topColors: ['#7a2a2a', '#2a4a6a', '#4a6a3a', '#c09050', '#d8d2c4', '#5a4a7a'],
            jacket: ['none', 'none', 'bomber'], jacketColors: ['#3a4a3a', '#5a3a2a', '#2a2a3a'],
            pants: ['#2a3550', '#3a3a3e', '#5a4a3a', '#1a1a20'], shoes: ['#e8e4dc', '#2a2a2e', '#7a2a2a'],
            beard: 0.3, glasses: 0.3, hats: ['beanie'], guitar: 'single', guitarColors: ['#d4a35a', '#2a6a8a', '#e8e0cc', '#8a2a3a']
        },
        country: {
            hair: ['short', 'long', 'short', 'shaggy'], hatChance: 0.8, hats: ['cowboy'], hatColors: ['#b08a5a', '#1a1612', '#e2d8c4', '#6a4a2e'],
            top: ['shirt'], topColors: ['#4a6a9a', '#8a2a2a', '#e8e0d0', '#3a5a3a', '#6a5a8a'],
            jacket: ['none', 'none', 'vest'], vestColors: ['#5a3a22', '#2a2a2a'],
            pants: ['#2a3a5a', '#34466a', '#2a2a30'], shoes: ['#5a3518', '#3a2412', '#141012'],
            beard: 0.45, glasses: 0.1, buckle: true, guitar: 'single', guitarColors: ['#e8c890', '#c4161c', '#111114']
        },
        folk: {
            hair: ['long', 'bun', 'shaggy', 'beanie', 'bob'], hats: ['beanie'],
            top: ['shirt', 'shirt', 'tee'], topColors: ['#6a5a3a', '#3a5a4a', '#8a6a4a', '#d8ccb4', '#7a4a3a'],
            jacket: ['none', 'cardigan', 'vest'], jacketColors: ['#7a5a3a', '#4a5a4a', '#8a3a2a'], vestColors: ['#4a3a2a', '#3a3a32'],
            pants: ['#4a3a2a', '#5a5040', '#2a3040'], shoes: ['#4a2e1a', '#2a1a10'],
            beard: 0.6, glasses: 0.25, guitar: 'acoustic'
        },
        jazz: {
            hair: ['short', 'short', 'bald', 'afro', 'pomp'], hatChance: 0.4, hats: ['fedora'], hatColors: ['#1a1a20', '#3a2e24', '#4a4a50'],
            top: ['shirt'], topColors: ['#f0ece4', '#e8e0d0', '#1a1a20'],
            jacket: ['blazer'], jacketColors: ['#1a1a24', '#2a2030', '#3a2a24', '#16202e'], tie: 0.7, tieColors: ['#8a1a1a', '#1a1a1a', '#d4af37', '#2a3a6a'],
            pants: ['#1a1a22', '#24202a', '#1a1a1a'], shoes: ['#0c0c0e', '#3a2412'],
            beard: 0.35, glasses: 0.3, dressChance: 0.75, dressColors: ['#8a0e1e', '#d4af37', '#1a1a2a', '#5a1a5a'], sax: true
        },
        synth: {
            hair: ['pomp', 'big', 'big', 'short', 'bob'], dye: ['#ff3d9a', '#b98cff', '#4fd1ff', '#f0f0f0'], dyeChance: 0.45,
            top: ['tee', 'tank'], topColors: ['#111114', '#f0ece4', '#ff3d9a', '#4fd1ff'],
            jacket: ['leather', 'bomber', 'blazer'], jacketColors: ['#ff3d9a', '#4fd1ff', '#b98cff', '#141416', '#e8e8f0'],
            pants: ['#0e0e14', '#1a1a24', '#e8e8f0'], shoes: ['#f0f0f0', '#0c0c0e'],
            beard: 0.1, glasses: 0.65, neon: true, keyColors: ['#141416', '#c4161c', '#e8e8f0']
        },
        edm: {
            hair: ['short', 'spiky', 'buzz', 'cap', 'bob'], dye: ['#4fd1ff', '#3ddc84', '#ff3d9a'], dyeChance: 0.35, hats: ['cap'],
            top: ['hoodie', 'tee', 'hoodie'], topColors: ['#111114', '#4fd1ff', '#1a1a2a', '#3ddc84', '#f0f0f0'],
            jacket: ['none'], pants: ['#0e0e14', '#2a2a30'], shoes: ['#f0f0f0', '#0c0c0e'],
            beard: 0.2, glasses: 0.5, neon: true, headphones: true, keyColors: ['#141416', '#2a2a30']
        },
        hiphop: {
            hair: ['cap', 'afro', 'braids', 'buzz', 'cap', 'bald'], hats: ['cap'], hatColors: ['#c4161c', '#111114', '#ffb238', '#1d5fa8', '#f0f0f0'],
            top: ['hoodie', 'tee', 'jersey'], topColors: ['#ffb238', '#b98cff', '#111114', '#f0f0f0', '#c4161c', '#1d5fa8'],
            jacket: ['none', 'none', 'bomber'], jacketColors: ['#2a2a30', '#5a1a5a', '#1a3a2a'],
            pants: ['#2a3550', '#1a1a20', '#4a4a50', '#6a5a40'], shoes: ['#f0f0f0', '#c4161c', '#111114'],
            beard: 0.35, glasses: 0.45, chain: 0.85, headphones: true
        },
        pop: {
            hair: ['bob', 'long', 'pomp', 'big', 'bun'], dye: ['#ff8ad8', '#b98cff', '#f5d14a', '#4fd1ff'], dyeChance: 0.4,
            top: ['tee', 'tank', 'shirt'], topColors: ['#ff8ad8', '#f0f0f0', '#4fd1ff', '#f5d14a', '#111114'],
            jacket: ['sparkle', 'bomber', 'none'], jacketColors: ['#d4af37', '#c0c0d0', '#ff3d9a', '#b98cff'],
            pants: ['#f0f0f0', '#111114', '#ff8ad8', '#2a3550'], shoes: ['#f0f0f0', '#ff3d9a', '#111114'],
            beard: 0.1, glasses: 0.2, dressChance: 0.5, dressColors: ['#ff3d9a', '#d4af37', '#4fd1ff', '#f0f0f0'],
            guitar: 'offset', guitarColors: ['#ff8ad8', '#f0ebe0', '#4fd1ff'], keyColors: ['#f0f0f0', '#ff3d9a']
        }
    };

    function makeLook(genre, role, r) {
        const S = STYLE[genre] || STYLE.indie;
        const skin = pick(r, SKIN);
        let hairStyle = pick(r, S.hair);
        let hairColor = pick(r, S.hairColors || HAIR);
        if (S.dyeChance && r() < S.dyeChance && hairStyle !== 'buzz' && hairStyle !== 'bald') hairColor = pick(r, S.dye);
        let hat = null;
        if (hairStyle === 'beanie' || hairStyle === 'cap') { hat = { type: hairStyle, color: pick(r, S.hatColors || ['#1a1a20', '#7a2a2a', '#3a4a3a', '#d8ccb4']) }; hairStyle = r() < 0.5 ? 'short' : 'long'; }
        if (S.hatChance && r() < S.hatChance) hat = { type: pick(r, S.hats), color: pick(r, S.hatColors) };
        if (role === 'dj' || role === 'drums') { if (hat && hat.type === 'cowboy') hat = null; }
        const dress = (role === 'vocal' || role === 'singer') && S.dressChance && r() < S.dressChance ? { color: pick(r, S.dressColors), long: genre === 'jazz' } : null;
        if (dress && (hairStyle === 'bald' || hairStyle === 'buzz' || hairStyle === 'mohawk')) hairStyle = pick(r, ['long', 'bob', 'bun']);
        const top = { type: pick(r, S.top), color: pick(r, S.topColors) };
        let jacketType = pick(r, S.jacket || ['none']);
        if (dress) jacketType = genre === 'pop' && r() < 0.5 ? 'sparkle' : 'none';
        const jacket = jacketType === 'none' ? null : {
            type: jacketType,
            color: jacketType === 'vest' ? pick(r, S.vestColors || ['#3a3a3a']) : jacketType === 'sparkle' ? pick(r, S.jacketColors) : pick(r, S.jacketColors || ['#141416']),
            studs: jacketType === 'leather' && S.studs && r() < S.studs
        };
        if (top.type === 'hoodie' && jacket) jacket.type = 'bomber';
        return {
            genre, role, skin,
            build: 0.92 + r() * 0.18, height: 0.96 + r() * 0.08,
            hair: { style: hairStyle, color: hairColor },
            hat, dress, top, jacket,
            tie: S.tie && top.type === 'shirt' && r() < S.tie ? pick(r, S.tieColors) : null,
            pants: pick(r, S.pants), shoes: pick(r, S.shoes),
            beard: !dress && r() < (S.beard || 0) ? pick(r, ['full', 'full', 'goatee', 'stubble']) : null,
            glasses: r() < (S.glasses || 0) ? (S.neon && r() < 0.5 ? pick(r, ['#ff3d9a', '#4fd1ff']) : '#08080a') : null,
            chain: r() < (S.chain || 0),
            buckle: !!S.buckle,
            headphones: role === 'dj' || (S.headphones && role === 'keys' && r() < 0.5)
        };
    }

    /* ---------------------------- the body ---------------------------- */
    function buildPerson(L) {
        const root = new THREE.Group();
        const rig = { root, look: L };
        const bw = L.build;
        const skinM = mat(L.skin, { rough: 0.62 });
        const skinDark = mat(shade(L.skin, -0.06), { rough: 0.62 });
        const topM = mat(L.top.color, { rough: 0.85 });
        const pantsM = mat(L.pants, { rough: 0.88 });
        const shoeM = mat(L.shoes, { rough: 0.45 });
        const hairM = mat(L.hair.color, { rough: 0.75 });
        const hairD = mat(L.hair.color, { rough: 0.75, double: true });
        const J = L.jacket;
        const jacketM = J ? mat(J.color, J.type === 'leather' ? { rough: 0.32, metal: 0.15, double: true } : J.type === 'sparkle' ? { rough: 0.2, metal: 0.75, double: true } : { rough: 0.85, double: true }) : null;
        const dressM = L.dress ? mat(L.dress.color, { rough: 0.45, metal: 0.1 }) : null;

        // Sleeves: what covers the upper arm and the forearm.
        const longSleeve = (J && J.type !== 'vest') || L.top.type === 'shirt' || L.top.type === 'hoodie';
        const sleeveM = J && J.type !== 'vest' ? jacketM : topM;
        const upperM = L.top.type === 'tank' && !(J && J.type !== 'vest') ? skinM : (longSleeve ? sleeveM : skinM);
        const foreM = longSleeve ? sleeveM : skinM;

        /* hips & legs */
        const hips = new THREE.Group(); hips.position.y = 0.5; root.add(hips); rig.hips = hips;
        if (L.dress) {
            const len = L.dress.long ? 0.46 : 0.24;
            const skirt = mesh(cylG(0.084, L.dress.long ? 0.15 : 0.13, len, 16), dressM, 0, 0.04 - len / 2, 0);
            skirt.scale.z = 0.75; hips.add(skirt);
        } else {
            const pelvis = mesh(cylG(0.083 * bw, 0.086, 0.1, 14), pantsM, 0, -0.005, 0); pelvis.scale.z = 0.7; hips.add(pelvis);
            const belt = mesh(cylG(0.087 * bw, 0.087 * bw, 0.018, 14), mat('#141012', { rough: 0.4 }), 0, 0.04, 0); belt.scale.z = 0.71; hips.add(belt);
            const bk = L.buckle ? boxG(0.04, 0.03, 0.01) : boxG(0.022, 0.018, 0.008);
            hips.add(mesh(bk, mat(L.buckle ? '#c9a640' : '#a8a8b0', { rough: 0.25, metal: 0.9 }), 0, 0.04, 0.062));
        }
        const legM = L.dress ? (L.dress.long ? dressM : skinM) : pantsM;
        rig.legs = [1, -1].map(side => {
            const hip = new THREE.Group(); hip.position.set(side * 0.052, -0.01, 0); hips.add(hip);
            if (!L.dress || !L.dress.long) hip.add(limb(0.235, 0.047, 0.038, legM));
            const knee = new THREE.Group(); knee.position.y = -0.235; hip.add(knee);
            knee.add(limb(0.215, 0.037, 0.03, L.dress && !L.dress.long ? skinM : legM));
            const boot = mesh(boxG(0.064, 0.056, 0.118), shoeM, 0, -0.226, 0.022);
            knee.add(boot);
            if (L.shoes === '#f0f0f0') knee.add(mesh(boxG(0.066, 0.016, 0.12), mat('#d0d0d0', { rough: 0.6 }), 0, -0.248, 0.022));
            return { hip, knee, side };
        });

        /* torso */
        const spine = new THREE.Group(); spine.position.y = 0.5; root.add(spine); rig.spine = spine;
        const torsoM = L.dress && L.top.type === 'tank' ? dressM : topM;
        const torsoG = cylG(0.1 * bw, 0.082, 0.31, 16); torsoG.scale(1, 1, 0.62);
        spine.add(mesh(torsoG, torsoM, 0, 0.165, 0));
        if (L.top.type === 'jersey') spine.add(mesh(boxG(0.05, 0.04, 0.004), mat('#f0f0f0', { rough: 0.8 }), 0, 0.2, 0.06));
        if (L.top.type === 'hoodie') {
            const hood = mesh(sphereG(0.07, 12, 8), topM, 0, 0.31, -0.055); hood.scale.set(1.2, 0.65, 0.8); spine.add(hood);
            spine.add(mesh(boxG(0.1, 0.05, 0.01), mat(shade(L.top.color, -0.08), { rough: 0.9 }), 0, 0.08, 0.052));
        }
        if (L.tie) spine.add(mesh(boxG(0.022, 0.15, 0.006), mat(L.tie, { rough: 0.5 }), 0, 0.22, 0.064));
        if (J) {
            const open = J.type === 'blazer' ? 0.42 : J.type === 'vest' ? 0.75 : 0.6;
            const shell = mesh(cylG(0.108 * bw, 0.091, 0.29, 18, true, open, TAU - open * 2), jacketM, 0, 0.17, 0);
            shell.scale.z = 0.68; spine.add(shell);
            if (J.type !== 'vest') {
                // Lapels / collar
                [1, -1].forEach(s => {
                    const lap = mesh(boxG(0.03, 0.12, 0.008), jacketM, s * 0.045, 0.255, 0.058);
                    lap.rotation.z = s * 0.35; lap.rotation.y = s * 0.25; spine.add(lap);
                });
            }
            if (J.studs) {
                const studM = mat('#d8d8e0', { rough: 0.2, metal: 1 });
                for (let i = 0; i < 6; i++) {
                    const s = i < 3 ? 1 : -1, k = i % 3;
                    spine.add(mesh(sphereG(0.006, 6, 4), studM, s * (0.06 + k * 0.012), 0.28 - k * 0.012, 0.065 - k * 0.006));
                }
            }
        }
        if (L.chain) {
            const ch = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 18), mat('#d9b44a', { rough: 0.25, metal: 1 }));
            ch.position.set(0, 0.275, 0.035); ch.rotation.x = 1.25; ch.scale.set(1, 1.3, 1); spine.add(ch);
        }

        /* arms */
        rig.arms = {};
        [['L', 1], ['R', -1]].forEach(([k, side]) => {
            const sh = new THREE.Group(); sh.position.set(side * 0.113 * bw, 0.298, 0); spine.add(sh);
            sh.add(mesh(sphereG(0.041, 12, 8), J && J.type !== 'vest' ? jacketM : (L.top.type === 'tank' ? skinM : (L.dress && L.top.type === 'tank' ? dressM : topM))));
            sh.add(limb(0.17, 0.037, 0.031, upperM));
            if (!longSleeve && L.top.type !== 'tank') sh.add(limb(0.07, 0.043, 0.04, topM));
            const el = new THREE.Group(); el.position.y = -0.17; sh.add(el);
            el.add(limb(0.155, 0.031, 0.025, foreM));
            if (longSleeve) el.add(mesh(cylG(0.027, 0.027, 0.012, 9), skinM, 0, -0.152, 0));
            const hand = mesh(sphereG(0.03, 10, 8), skinM, 0, -0.172, 0); hand.scale.set(0.85, 1.15, 0.72); el.add(hand);
            sh.rotation.z = side * 0.1;
            rig.arms[k] = { sh, el, hand, side, a: 0.17, b: 0.172, cur: null };
        });

        /* neck & head */
        spine.add(mesh(cylG(0.03, 0.035, 0.07, 10), skinM, 0, 0.335, 0));
        const head = new THREE.Group(); head.position.y = 0.355; spine.add(head); rig.head = head;
        const skull = mesh(sphereG(0.066, 20, 16), skinM, 0, 0.068, 0); skull.scale.set(0.93, 1.1, 1.0); head.add(skull);
        const jaw = mesh(sphereG(0.05, 16, 10), skinM, 0, 0.036, 0.014); jaw.scale.set(0.98, 0.92, 1); head.add(jaw);
        [1, -1].forEach(s => { const ear = mesh(sphereG(0.015, 8, 6), skinDark, s * 0.061, 0.066, 0); ear.scale.set(0.45, 1, 0.75); head.add(ear); });
        // Face
        const eyeW = mat('#f4f1ea', { rough: 0.3 }), eyeD = mat('#1c140e', { rough: 0.2 });
        const browM = mat(shade(L.hair.color, -0.05), { rough: 0.8 });
        [1, -1].forEach(s => {
            const w = mesh(sphereG(0.0115, 10, 8), eyeW, s * 0.023, 0.075, 0.054); w.scale.z = 0.6; head.add(w);
            head.add(mesh(sphereG(0.0068, 8, 6), eyeD, s * 0.023, 0.075, 0.0605));
            const b = mesh(boxG(0.027, 0.0065, 0.008), browM, s * 0.023, 0.092, 0.059); b.rotation.z = -s * 0.12; head.add(b);
        });
        const nose = mesh(sphereG(0.012, 8, 6), skinDark, 0, 0.058, 0.066); nose.scale.set(0.75, 1.1, 1); head.add(nose);
        const mouth = mesh(sphereG(0.012, 10, 6), mat('#3a0e0e', { rough: 0.6 }), 0, 0.034, 0.059);
        mouth.scale.set(1.15, 0.32, 0.45); head.add(mouth); rig.mouth = mouth;
        if (L.glasses) {
            const gm = mat(L.glasses, { rough: 0.08, metal: 0.6, emissive: L.glasses === '#08080a' ? null : L.glasses, ei: 0.8 });
            [1, -1].forEach(s => head.add(mesh(boxG(0.031, 0.018, 0.006), gm, s * 0.024, 0.075, 0.068)));
            head.add(mesh(boxG(0.018, 0.004, 0.005), gm, 0, 0.079, 0.068));
            [1, -1].forEach(s => head.add(mesh(boxG(0.004, 0.004, 0.06), gm, s * 0.041, 0.078, 0.04)));
        }
        if (L.beard) {
            const bm = mat(shade(L.hair.color, L.beard === 'stubble' ? 0.04 : 0), { rough: 0.9 });
            if (L.beard === 'goatee') {
                const g = mesh(sphereG(0.02, 8, 6), bm, 0, 0.015, 0.058); g.scale.set(1, 1.3, 0.7); head.add(g);
                head.add(mesh(boxG(0.034, 0.007, 0.008), bm, 0, 0.045, 0.063));
            } else {
                const thetaLen = L.beard === 'stubble' ? Math.PI * 0.3 : Math.PI * 0.42;
                const beard = mesh(new THREE.SphereGeometry(L.beard === 'stubble' ? 0.0675 : 0.071, 16, 10, 0, Math.PI, Math.PI * 0.5, thetaLen), bm, 0, 0.066, 0.004);
                beard.scale.set(0.95, 1.12, 1.03); head.add(beard);
                if (L.beard === 'full') head.add(mesh(boxG(0.036, 0.008, 0.01), bm, 0, 0.046, 0.066));
            }
            mouth.position.z = 0.072;
        }
        buildHair(head, L, hairM, hairD);
        if (L.hat) buildHat(head, L.hat);
        if (L.headphones) {
            const hpM = mat('#18181c', { rough: 0.4, metal: 0.3 });
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.008, 6, 20, Math.PI), hpM);
            band.position.y = 0.075; head.add(band);
            [1, -1].forEach(s => { const cup = mesh(cylG(0.03, 0.03, 0.024, 14), hpM, s * 0.074, 0.068, 0); cup.rotation.z = Math.PI / 2; head.add(cup); });
        }

        root.scale.setScalar(L.height);
        return rig;
    }

    function buildHair(head, L, m, md) {
        const st = L.hair.style;
        if (st === 'bald') return;
        const c = V(0, 0.068, 0);
        const cap = (r = 0.0715, len = 0.47, tilt = -0.3) => {
            const o = mesh(new THREE.SphereGeometry(r, 18, 12, 0, TAU, 0, Math.PI * len), m, c.x, c.y, c.z);
            o.scale.set(0.95, 1.12, 1.04); o.rotation.x = tilt; head.add(o); return o;
        };
        const curtain = (h, open, y = -0.02) => {
            const o = mesh(cylG(0.073, 0.085, h, 18, true, open, TAU - open * 2), md, 0, c.y + 0.05 - h / 2 + y, -0.006);
            o.scale.z = 0.9; head.add(o); return o;
        };
        if (st === 'mohawk') {
            const strip = mesh(boxG(0.02, 0.02, 0.13), m, 0, 0.142, -0.012); strip.rotation.x = 0.15; head.add(strip);
            for (let i = 0; i < 6; i++) {
                const z = 0.05 - i * 0.022;
                const cone = mesh(new THREE.ConeGeometry(0.014, 0.075 - Math.abs(i - 2) * 0.006, 6), m, 0, 0.17 - i * 0.004, z);
                cone.rotation.x = -0.25 - i * 0.12; head.add(cone);
            }
            return;
        }
        if (st === 'afro') { const a = mesh(sphereG(0.098, 16, 12), m, 0, 0.095, -0.012); a.scale.set(1.05, 0.95, 1); head.add(a); return; }
        if (st === 'buzz') { cap(0.068, 0.5, -0.2); return; }
        if (st === 'big') {
            const a = mesh(sphereG(0.088, 16, 12), m, 0, 0.1, -0.02); a.scale.set(1.15, 0.9, 1); head.add(a);
            curtain(0.15, 1.05, 0); return;
        }
        cap();
        if (st === 'long') curtain(0.22, 1.0);
        else if (st === 'bob') curtain(0.13, 1.1, 0.005);
        else if (st === 'shaggy') { curtain(0.1, 1.2, 0.02); const f = mesh(boxG(0.085, 0.022, 0.024), m, 0.006, 0.117, 0.054); f.rotation.z = -0.15; head.add(f); }
        else if (st === 'bun') head.add(mesh(sphereG(0.032, 10, 8), m, 0, 0.14, -0.05));
        else if (st === 'pomp') { const q = mesh(sphereG(0.05, 12, 8), m, 0, 0.138, 0.022); q.scale.set(1, 0.55, 0.95); head.add(q); }
        else if (st === 'spiky') {
            for (let i = 0; i < 9; i++) {
                const a = (i / 9) * TAU, el = 0.35 + (i % 2) * 0.25;
                const dir = V(Math.cos(a) * Math.sin(el), Math.cos(el), Math.sin(a) * Math.sin(el) - 0.1).normalize();
                const cone = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 5), m);
                cone.position.copy(c).addScaledVector(dir, 0.072); cone.position.y += 0.012;
                cone.quaternion.setFromUnitVectors(UP, dir); head.add(cone);
            }
        } else if (st === 'braids') {
            for (let i = 0; i < 9; i++) {
                const a = Math.PI * (0.15 + 0.7 * (i / 8)) + Math.PI;
                const b = mesh(cylG(0.008, 0.007, 0.15, 5), m, Math.cos(a) * 0.062, c.y - 0.04, Math.sin(a) * 0.062 * 0.95);
                head.add(b);
            }
        }
    }

    function buildHat(head, hat) {
        const m = mat(hat.color, { rough: 0.7 });
        const dark = mat(shade(hat.color, -0.18), { rough: 0.6 });
        if (hat.type === 'cowboy') {
            const brim = mesh(cylG(0.125, 0.125, 0.008, 24), m, 0, 0.128, -0.004); brim.scale.z = 0.88; brim.rotation.x = -0.06; head.add(brim);
            [1, -1].forEach(s => { const curl = mesh(cylG(0.012, 0.012, 0.16, 8), m, s * 0.118, 0.137, -0.004); curl.rotation.x = Math.PI / 2; head.add(curl); });
            head.add(mesh(cylG(0.056, 0.07, 0.075, 16), m, 0, 0.168, -0.008));
            head.add(mesh(cylG(0.0705, 0.0705, 0.012, 16), dark, 0, 0.138, -0.008));
        } else if (hat.type === 'fedora') {
            const brim = mesh(cylG(0.098, 0.098, 0.006, 22), m, 0, 0.126, -0.003); brim.rotation.x = -0.12; head.add(brim);
            head.add(mesh(cylG(0.054, 0.064, 0.058, 16), m, 0, 0.156, -0.006));
            head.add(mesh(cylG(0.0645, 0.0645, 0.013, 16), dark, 0, 0.135, -0.006));
        } else if (hat.type === 'beanie') {
            const d = mesh(new THREE.SphereGeometry(0.077, 16, 10, 0, TAU, 0, Math.PI * 0.52), m, 0, 0.072, -0.004);
            d.scale.set(0.97, 1.18, 1.05); d.rotation.x = -0.18; head.add(d);
            const cuff = mesh(cylG(0.075, 0.077, 0.026, 16, true), mat(hat.color, { rough: 0.8, double: true }), 0, 0.083, -0.012);
            cuff.rotation.x = -0.18; cuff.scale.set(0.97, 1, 1.07); head.add(cuff);
        } else if (hat.type === 'cap') {
            const d = mesh(new THREE.SphereGeometry(0.073, 16, 10, 0, TAU, 0, Math.PI * 0.36), m, 0, 0.08, -0.004);
            d.scale.set(0.97, 1.12, 1.04); d.rotation.x = 0.12; head.add(d);
            head.add(mesh(cylG(0.009, 0.009, 0.006, 8), dark, 0, 0.163, -0.008));
            const brim = mesh(boxG(0.075, 0.007, 0.065), dark, 0, 0.112, -0.1); brim.rotation.x = -0.2; head.add(brim);
        }
    }

    /* --------------------------- instruments --------------------------- */
    function bodyShape(kind) {
        const s = new THREE.Shape();
        if (kind === 'shard') {
            // Angular metal body
            s.moveTo(-0.125, 0.015); s.lineTo(-0.05, 0.055); s.lineTo(0.02, 0.04); s.lineTo(0.12, 0.095);
            s.lineTo(0.05, 0.014); s.lineTo(0.05, -0.018); s.lineTo(0.1, -0.07); s.lineTo(0.0, -0.048);
            s.lineTo(-0.08, -0.08); s.lineTo(-0.06, -0.02); s.closePath();
        } else if (kind === 'single') {
            // Single-cutaway
            s.moveTo(-0.1, 0);
            s.bezierCurveTo(-0.105, 0.06, -0.055, 0.075, -0.015, 0.06);
            s.bezierCurveTo(0.01, 0.05, 0.03, 0.058, 0.05, 0.05);
            s.bezierCurveTo(0.06, 0.045, 0.06, 0.025, 0.05, 0.016);
            s.lineTo(0.05, -0.02);
            s.bezierCurveTo(0.085, -0.03, 0.075, -0.068, 0.04, -0.07);
            s.bezierCurveTo(0.01, -0.072, -0.01, -0.06, -0.035, -0.072);
            s.bezierCurveTo(-0.08, -0.085, -0.105, -0.05, -0.1, 0);
        } else if (kind === 'acoustic') {
            s.moveTo(0, 0.052);
            s.bezierCurveTo(0.025, 0.074, 0.105, 0.078, 0.116, 0.0);
            s.bezierCurveTo(0.105, -0.078, 0.025, -0.074, 0.0, -0.052);
            s.bezierCurveTo(-0.03, -0.104, -0.17, -0.11, -0.182, 0.0);
            s.bezierCurveTo(-0.17, 0.11, -0.03, 0.104, 0.0, 0.052);
        } else {
            // Offset double-cutaway
            s.moveTo(-0.1, 0);
            s.bezierCurveTo(-0.105, 0.05, -0.09, 0.076, -0.06, 0.075);
            s.bezierCurveTo(-0.03, 0.074, -0.015, 0.05, 0.0, 0.05);
            s.bezierCurveTo(0.03, 0.05, 0.06, 0.082, 0.088, 0.072);
            s.bezierCurveTo(0.1, 0.064, 0.075, 0.03, 0.05, 0.018);
            s.lineTo(0.05, -0.02);
            s.bezierCurveTo(0.065, -0.03, 0.08, -0.045, 0.072, -0.056);
            s.bezierCurveTo(0.055, -0.07, 0.02, -0.065, 0.0, -0.06);
            s.bezierCurveTo(-0.02, -0.056, -0.04, -0.082, -0.065, -0.08);
            s.bezierCurveTo(-0.095, -0.076, -0.105, -0.04, -0.1, 0);
        }
        return s;
    }

    function buildGuitar(o) {
        const g = new THREE.Group();
        const acoustic = o.kind === 'acoustic';
        const depth = acoustic ? 0.048 : 0.022;
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(o.kind), { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
        bodyGeo.translate(0, 0, -depth / 2);
        g.add(new THREE.Mesh(bodyGeo, mat(o.color, { rough: 0.25, metal: o.kind === 'shard' ? 0.35 : 0.12 })));
        const front = depth / 2 + 0.004;
        const neckStart = acoustic ? 0.1 : 0.035;
        const neckLen = o.bass ? 0.43 : acoustic ? 0.28 : 0.31;
        const neckM = mat(acoustic ? '#b8844c' : '#c8945a', { rough: 0.55 });
        g.add(mesh(boxG(neckLen, 0.026, 0.016), neckM, neckStart + neckLen / 2, 0, front - 0.006));
        g.add(mesh(boxG(neckLen, 0.025, 0.004), mat('#2a1a10', { rough: 0.7 }), neckStart + neckLen / 2, 0, front + 0.004));
        // Headstock & tuners
        const hx = neckStart + neckLen + 0.035;
        const head = mesh(boxG(0.075, o.bass ? 0.05 : 0.042, 0.012), o.kind === 'shard' ? mat(o.color, { rough: 0.25, metal: 0.35 }) : neckM, hx, 0.004, front - 0.006);
        head.rotation.z = o.kind === 'shard' ? 0.18 : -0.06; g.add(head);
        const pegM = mat('#d0d0d8', { rough: 0.25, metal: 1 });
        const pegs = o.bass ? 4 : 6;
        for (let i = 0; i < pegs; i++) {
            const side = o.bass ? (i < 2 ? 1 : -1) : (i % 2 ? 1 : -1);
            const k = o.bass ? i % 2 : Math.floor(i / 2);
            g.add(mesh(cylG(0.004, 0.004, 0.018, 6), pegM, hx - 0.02 + k * 0.022, side * 0.03, front - 0.006));
        }
        // Strings (a faint shimmer)
        const strM = mat('#e8e8f0', { rough: 0.2, metal: 1 });
        for (let i = 0; i < (o.bass ? 4 : 3); i++) {
            const yy = (i - (o.bass ? 1.5 : 1)) * 0.006;
            g.add(mesh(boxG(neckLen + (acoustic ? 0.12 : 0.1), 0.0012, 0.0012), strM, neckStart + neckLen / 2 - (acoustic ? 0.06 : 0.05), yy, front + 0.008));
        }
        if (acoustic) {
            g.add(mesh(cylG(0.03, 0.03, 0.002, 20), mat('#120a06', { rough: 0.9 }), 0.035, 0, front + 0.0005).rotateX(Math.PI / 2));
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.003, 4, 24), mat('#3a2010', { rough: 0.5 }));
            ring.position.set(0.035, 0, front + 0.001); g.add(ring);
            g.add(mesh(boxG(0.018, 0.06, 0.008), mat('#2a1a10', { rough: 0.6 }), -0.09, 0, front + 0.004));
        } else {
            const guard = mat(o.guard || '#efe9dc', { rough: 0.35 });
            const pg = mesh(boxG(0.09, 0.05, 0.002), guard, -0.005, -0.02, front + 0.001); pg.rotation.z = 0.2; g.add(pg);
            const puM = mat('#111114', { rough: 0.4 });
            [-0.02, -0.06].forEach((x, i) => { if (o.bass && i) return; g.add(mesh(boxG(0.012, 0.042, 0.006), puM, x, 0, front + 0.004)); });
            g.add(mesh(boxG(0.01, 0.04, 0.006), pegM, -0.08, 0, front + 0.004));
            [0, 1].forEach(i => g.add(mesh(cylG(0.006, 0.006, 0.008, 8), mat('#141414', { rough: 0.4 }), -0.055 + i * 0.022, -0.045, front + 0.004).rotateX(Math.PI / 2)));
        }
        g.userData.fret = u => V(neckStart + 0.035 + u * (neckLen - 0.05), -0.012, front - 0.002);
        g.userData.strum = V(acoustic ? 0.02 : -0.03, 0.012, front + 0.03);
        g.userData.butt = V(acoustic ? -0.18 : -0.1, 0, -0.004);
        g.userData.horn = V(acoustic ? 0.11 : 0.075, acoustic ? 0.03 : 0.06, -0.004);
        return g;
    }

    function buildMicStand(micY, micZ) {
        const g = new THREE.Group();
        const metal = mat('#1a1a1e', { rough: 0.35, metal: 0.8 });
        const chrome = mat('#c8c8d0', { rough: 0.2, metal: 1 });
        g.add(mesh(cylG(0.055, 0.06, 0.012, 16), metal, 0, 0.006, 0));
        const top = V(0, micY - 0.08, 0);
        g.add(rod(V(0, 0.01, 0), top, 0.006, chrome));
        const tip = V(0, micY, -micZ);
        g.add(rod(top, tip, 0.005, chrome));
        const mic = new THREE.Group(); mic.position.copy(tip);
        mic.add(mesh(cylG(0.009, 0.013, 0.05, 10), mat('#141418', { rough: 0.4 }), 0, -0.025, 0));
        mic.add(mesh(sphereG(0.018, 10, 8), mat('#8a8a92', { rough: 0.5, metal: 0.8 }), 0, 0.01, 0));
        mic.quaternion.setFromUnitVectors(UP, V(0, 0.45, -1).normalize());
        g.userData.handle = V(0, micY - 0.012, -micZ + 0.03);
        g.add(mic);
        return g;
    }

    function handMic() {
        const m = new THREE.Group();
        m.add(mesh(cylG(0.011, 0.014, 0.08, 10), mat('#141418', { rough: 0.4 }), 0, -0.02, 0));
        m.add(mesh(sphereG(0.02, 10, 8), mat('#9a9aa2', { rough: 0.45, metal: 0.8 }), 0, 0.03, 0));
        return m;
    }

    function keysTexture(color) {
        const c = document.createElement('canvas'); c.width = 256; c.height = 32;
        const g = c.getContext('2d');
        g.fillStyle = '#f2efe8'; g.fillRect(0, 0, 256, 32);
        g.strokeStyle = '#8a8680';
        for (let i = 0; i <= 36; i++) { g.beginPath(); g.moveTo(i * 256 / 36, 0); g.lineTo(i * 256 / 36, 32); g.stroke(); }
        g.fillStyle = '#121214';
        for (let i = 0; i < 36; i++) { const n = i % 7; if (n === 2 || n === 6) continue; g.fillRect((i + 0.68) * 256 / 36, 0, 256 / 36 * 0.62, 19); }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    function buildKeyboard(color, glow) {
        const g = new THREE.Group();
        const metal = mat('#1a1a1e', { rough: 0.35, metal: 0.8 });
        [-0.15, 0.15].forEach(x => {
            g.add(rod(V(x - 0.05, 0, -0.06), V(x + 0.05, 0.47, 0.06), 0.008, metal));
            g.add(rod(V(x + 0.05, 0, -0.06), V(x - 0.05, 0.47, 0.06), 0.008, metal));
        });
        g.add(mesh(boxG(0.46, 0.035, 0.14), mat(color, { rough: 0.35, metal: 0.2 }), 0, 0.49, 0));
        const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.07), new THREE.MeshStandardMaterial({ map: keysTexture(), roughness: 0.4 }));
        keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.5085, 0.03); g.add(keys);
        g.add(mesh(boxG(0.1, 0.012, 0.03), mat(glow, { rough: 0.3, emissive: glow, ei: 1.2 }), -0.12, 0.512, -0.04));
        for (let i = 0; i < 5; i++) g.add(mesh(cylG(0.006, 0.006, 0.01, 8), mat('#d8d8de', { rough: 0.3, metal: 0.8 }), 0.02 + i * 0.03, 0.512, -0.045));
        return g;
    }

    function buildDJ(glow) {
        const g = new THREE.Group();
        const dark = mat('#141416', { rough: 0.5 });
        g.add(mesh(boxG(0.66, 0.44, 0.24), dark, 0, 0.22, 0));
        g.add(mesh(boxG(0.62, 0.05, 0.008), mat(glow, { rough: 0.3, emissive: glow, ei: 1.4 }), 0, 0.3, 0.121));
        g.add(mesh(boxG(0.68, 0.03, 0.27), mat('#202024', { rough: 0.4 }), 0, 0.455, 0));
        [-0.19, 0.19].forEach(x => {
            g.add(mesh(boxG(0.17, 0.02, 0.17), mat('#2a2a2e', { rough: 0.4, metal: 0.3 }), x, 0.48, 0));
            g.add(mesh(cylG(0.065, 0.065, 0.008, 24), mat('#0a0a0c', { rough: 0.3 }), x, 0.494, 0));
            g.add(mesh(cylG(0.022, 0.022, 0.009, 16), mat(glow, { rough: 0.3, emissive: glow, ei: 0.8 }), x, 0.496, 0));
        });
        g.add(mesh(boxG(0.13, 0.025, 0.16), mat('#18181c', { rough: 0.4 }), 0, 0.482, 0));
        const lap = mesh(boxG(0.16, 0.1, 0.004), mat('#cfd6e0', { rough: 0.3, emissive: '#7ab8ff', ei: 0.7 }), 0, 0.53, -0.11);
        lap.rotation.x = -0.3; g.add(lap);
        return g;
    }

    function buildSax() {
        const g = new THREE.Group();
        const brass = mat('#d4a640', { rough: 0.22, metal: 1 });
        const path = new THREE.CatmullRomCurve3([V(0.0, 0.27, -0.02), V(0.0, 0.24, 0.03), V(0.0, 0.18, 0.04), V(0.0, 0.05, 0.035), V(0.012, -0.02, 0.03), V(0.045, -0.035, 0.035), V(0.07, 0.0, 0.05), V(0.08, 0.05, 0.07)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, 0.014, 8, false), brass));
        const bell = mesh(cylG(0.045, 0.016, 0.06, 16, true), mat('#d4a640', { rough: 0.22, metal: 1, double: true }), 0.085, 0.08, 0.08);
        bell.rotation.x = 0.35; g.add(bell);
        g.add(mesh(cylG(0.006, 0.008, 0.03, 8), mat('#141414', { rough: 0.4 }), 0, 0.28, -0.035).rotateX(1.2));
        for (let i = 0; i < 5; i++) g.add(mesh(cylG(0.007, 0.007, 0.005, 8), mat('#e8e0c8', { rough: 0.3, metal: 0.6 }), 0.0, 0.17 - i * 0.03, 0.055).rotateX(Math.PI / 2));
        g.userData.mouth = V(0, 0.28, -0.04);
        g.userData.upper = V(0.006, 0.19, 0.06);
        g.userData.lower = V(0.006, 0.08, 0.06);
        return g;
    }

    /* ----------------------------- posing ----------------------------- */
    const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
    const _e = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
    const _m = new THREE.Matrix4();

    // Two-bone IK in the spine's space: aim the upper arm so the hand lands on `target`,
    // bending the elbow toward `pole`.
    function solveArm(arm, target, pole) {
        const a = arm.a, b = arm.b;
        _d.copy(target).sub(arm.sh.position);
        let dist = _d.length();
        if (dist < 1e-5) return;
        _d.divideScalar(dist);
        dist = clamp(dist, Math.abs(a - b) + 0.01, a + b - 0.002);
        const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
        const alpha = Math.acos(cosA);
        _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
        if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0);
        _p.normalize();
        _e.copy(_d).multiplyScalar(Math.cos(alpha) * a).addScaledVector(_p, Math.sin(alpha) * a);
        arm.sh.quaternion.setFromUnitVectors(DOWN, _t.copy(_e).normalize());
        _w.copy(_d).multiplyScalar(dist).sub(_e).normalize();
        _q.copy(arm.sh.quaternion).invert();
        _w.applyQuaternion(_q);
        arm.el.quaternion.setFromUnitVectors(DOWN, _w);
    }

    // Root-space point -> spine space (for things standing on the floor).
    function toSpine(rig, p, out) {
        rig.spine.updateMatrix();
        _m.copy(rig.spine.matrix).invert();
        return out.copy(p).applyMatrix4(_m);
    }
    // Instrument-local point -> spine space (for things strapped on).
    function fromInstr(inst, p, out) {
        inst.updateMatrix();
        return out.copy(p).applyMatrix4(inst.matrix);
    }

    // Ease each hand toward its target so switches look like motion, not teleporting.
    function reach(rig, k, target, pole, dt, speed = 22) {
        const arm = rig.arms[k];
        if (!arm.cur) arm.cur = target.clone();
        else arm.cur.lerp(target, 1 - Math.exp(-dt * speed));
        solveArm(arm, arm.cur, pole);
    }

    const POLE = {
        fretL: V(0.6, -0.8, -0.5), strumR: V(-0.8, -0.5, -0.6),
        downL: V(0.7, -0.6, -0.4), downR: V(-0.7, -0.6, -0.4),
        ear: V(0.6, -0.8, 0.2)
    };

    /* ----------------------------- the band ----------------------------- */
    function setStance(rig, wide) {
        rig.legs.forEach(l => { l.hip.rotation.z = l.side * wide; l.knee.rotation.z = -l.side * wide * 0.7; });
    }

    function makeMember(role, look, genre, r, ctx) {
        const rig = buildPerson(look);
        rig.role = role; rig.genre = genre; rig.seed = r() * 100;
        rig.bpm = (BPM[genre] || 120) * (role === 'drums' ? 1 : 1);
        const S = STYLE[genre] || STYLE.indie;
        const root = rig.root;
        rig.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };
        setStance(rig, 0.09 + r() * 0.06);

        if (role === 'guitar' || role === 'bass' || role === 'acoustic' || role === 'vocalGuitar' || role === 'vocalAcoustic') {
            const acoustic = role === 'acoustic' || role === 'vocalAcoustic' || S.guitar === 'acoustic';
            const kind = acoustic ? 'acoustic' : (S.guitar || 'offset');
            const colors = acoustic ? ['#c8904a', '#a8682e', '#e0b47a', '#5a3018'] : (S.guitarColors || ['#c4161c', '#111114']);
            const inst = buildGuitar({ kind, bass: role === 'bass', color: pick(r, colors), guard: pick(r, ['#efe9dc', '#111114', '#efe9dc']) });
            inst.position.set(-0.025, acoustic ? 0.055 : 0.065, acoustic ? 0.098 : 0.084);
            inst.rotation.set(0, -0.12, role === 'bass' ? 0.36 : 0.42);
            rig.spine.add(inst); rig.inst = inst;
            // Strap over the left shoulder
            const strapM = mat(pick(r, ['#141012', '#5a1a1a', '#2a2a30']), { rough: 0.7 });
            const horn = fromInstr(inst, inst.userData.horn, new THREE.Vector3());
            const butt = fromInstr(inst, inst.userData.butt, new THREE.Vector3());
            const shoulder = V(0.085, 0.33, 0.01);
            rig.spine.add(rod(horn.add(V(0, 0, 0.012)), V(0.08, 0.33, 0.05), 0.006, strapM, 4));
            rig.spine.add(rod(shoulder, butt.add(V(-0.01, 0.0, -0.04)), 0.006, strapM, 4));
            rig.frets = [0.15, 0.35, 0.55, 0.3, 0.7, 0.45].map(u => inst.userData.fret(u));
        }
        if (role === 'vocal' || role === 'vocalGuitar' || role === 'vocalAcoustic') {
            const stand = buildMicStand(0.885 * look.height, 0.075);
            stand.position.z = 0.17;
            root.add(stand); rig.stand = stand;
            stand.scale.setScalar(1 / look.height);
            rig.micPoint = V(0.0, 0.862, 0.17 - 0.075 / look.height + 0.035);
        }
        if (role === 'singer' || role === 'mc') {
            const m = handMic(); rig.spine.add(m); rig.handMic = m;
        }
        if (role === 'keys') {
            const kb = buildKeyboard(pick(r, S.keyColors || ['#141416', '#c4161c']), pick(r, ['#4fd1ff', '#ff3d9a', '#3ddc84', '#ffb238']));
            kb.position.z = 0.24; kb.scale.setScalar(1 / look.height); root.add(kb); rig.kb = kb;
            rig.spine.rotation.x = 0.16;
        }
        if (role === 'dj') {
            const dj = buildDJ(pick(r, ['#4fd1ff', '#ff3d9a', '#b98cff', '#3ddc84']));
            dj.position.z = 0.3; dj.scale.setScalar(1 / look.height); root.add(dj); rig.dj = dj;
        }
        if (role === 'sax') {
            const sx = buildSax();
            sx.position.set(-0.01, 0.07, 0.085); sx.rotation.set(0.12, 0, 0.08);
            rig.spine.add(sx); rig.sax = sx;
        }
        if (role === 'drums') {
            // Seated behind the house kit, with a snare, hi-hat, ride and floor tom of their own.
            rig.hips.position.y = rig.spine.position.y = 0.33;
            rig.legs.forEach(l => { l.hip.rotation.set(-1.42, 0, l.side * 0.18); l.knee.rotation.set(1.5, 0, 0); });
            const metal = mat('#c8c8d0', { rough: 0.25, metal: 1 });
            const brass = mat('#d4af37', { rough: 0.3, metal: 0.95 });
            const shellM = mat(pick(r, ['#b02020', '#141416', '#1d4f8a', '#e8e0cc', '#2a6a4a']), { rough: 0.3, metal: 0.3 });
            const headM = mat('#ece8e0', { rough: 0.6 });
            const kit = new THREE.Group(); kit.scale.setScalar(1 / look.height); root.add(kit);
            kit.add(mesh(cylG(0.075, 0.075, 0.03, 16), mat('#141416', { rough: 0.5 }), 0, 0.3, 0));
            kit.add(rod(V(0, 0, 0), V(0, 0.29, 0), 0.01, metal));
            const drum = (x, y, z, rad, h) => {
                kit.add(mesh(cylG(rad, rad, h, 18), shellM, x, y - h / 2, z));
                kit.add(mesh(cylG(rad * 0.98, rad * 0.98, 0.004, 18), headM, x, y + 0.001, z));
                kit.add(rod(V(x, 0, z), V(x, y - h, z), 0.006, metal));
            };
            const cymbal = (x, y, z, rad, tilt) => {
                kit.add(rod(V(x, 0, z), V(x, y, z), 0.006, metal));
                const c = mesh(cylG(rad * 0.15, rad, 0.008, 20), brass, x, y, z); c.rotation.x = tilt; kit.add(c);
            };
            const kitZ = ctx.kitZ;
            rig.drums = {
                snare: V(0.06, 0.43, 0.2), hat: V(0.2, 0.52, 0.17), ride: V(-0.27, 0.57, 0.22), floor: V(-0.2, 0.37, 0.13),
                tomL: V(0.22, 0.3 + 0.1 / ctx.ph, kitZ), tomR: V(-0.22, 0.3 + 0.1 / ctx.ph, kitZ), crash: V(0.32, 0.55, kitZ - 0.05 / ctx.ph)
            };
            const D = rig.drums;
            drum(D.snare.x, D.snare.y, D.snare.z, 0.058, 0.05);
            drum(D.floor.x, D.floor.y, D.floor.z, 0.07, 0.15);
            cymbal(D.hat.x, D.hat.y, D.hat.z, 0.055, 0.05);
            kit.add(mesh(cylG(0.008, 0.055, 0.008, 20), brass, D.hat.x, D.hat.y - 0.015, D.hat.z));
            cymbal(D.ride.x, D.ride.y, D.ride.z, 0.075, -0.2);
            // Sticks
            const stickM = mat('#e2c79a', { rough: 0.6 });
            ['L', 'R'].forEach(k => {
                const st = mesh(cylG(0.0035, 0.005, 0.17, 6), stickM, 0, -0.172, 0);
                st.geometry.translate(0, -0.06, 0);
                st.rotation.x = -1.15; rig.arms[k].el.add(st);
            });
            rig.spine.rotation.x = 0.12;
        }
        if (role === 'mc' || role === 'singer') setStance(rig, 0.14);
        return rig;
    }

    function updateMember(rig, t, o) {
        const dt = rig.lastT === undefined ? 0.016 : clamp(t - rig.lastT, 0, 0.1);
        rig.lastT = t;
        const playing = !!o.playing;
        const e = playing ? 0.45 + 0.55 * clamp(o.vibe || 0.5, 0, 1) : 0.15;
        const beats = t * rig.bpm / 60 + rig.seed;
        const beatPh = frac(beats);
        const bounce = Math.abs(Math.sin(Math.PI * beats));
        const T = rig.tmp;
        const role = rig.role;
        const metal = rig.genre === 'metal', punk = rig.genre === 'punk';

        // Groove: knees bend on the beat
        if (role !== 'drums' && role !== 'sax') {
            const b = bounce * e;
            rig.hips.position.y = rig.spine.position.y = 0.5 - 0.016 * b;
            rig.legs.forEach(l => { l.hip.rotation.x = -0.22 * b; l.knee.rotation.x = 0.44 * b; });
            let jump = 0;
            if (punk && role !== 'vocal' && playing) {
                const bar = Math.floor(beats / 4);
                if ((bar + Math.floor(rig.seed)) % 4 === 0) jump = Math.max(0, Math.sin(Math.PI * frac(beats / 2))) * 0.09 * e;
            }
            rig.root.position.y = rig.baseY + jump * rig.scale;
        }

        // Head: metal headbangs, everyone else nods
        const nod = metal ? 0.08 + 0.42 * e * Math.pow(bounce, 2) : 0.05 + 0.13 * e * bounce;
        rig.head.rotation.x = nod;
        rig.head.rotation.y = Math.sin(t * 0.45 + rig.seed) * (metal ? 0.08 : 0.2);

        if (rig.inst && !rig.sax) {
            rig.spine.rotation.x = (metal ? 0.14 : 0.06) + 0.05 * e * bounce;
            rig.spine.rotation.z = Math.sin(beats * Math.PI * 0.25) * 0.05;
            const slot = Math.floor(beats / 2 + rig.seed * 3);
            const fret = rig.frets[Math.abs(slot) % rig.frets.length];
            fromInstr(rig.inst, fret, T.a);
            reach(rig, 'L', T.a, POLE.fretL, dt, 10);
            const strumRate = rig.role === 'bass' ? 1 : (punk || metal ? 2 : 1);
            const sw = playing ? Math.sin(beats * Math.PI * 2 * strumRate) : 0;
            fromInstr(rig.inst, rig.inst.userData.strum, T.b);
            T.b.y += 0.035 * sw * e; T.b.z += 0.01;
            reach(rig, 'R', T.b, POLE.strumR, dt, 40);
            if (rig.stand) rig.head.rotation.x = 0.05 + 0.05 * bounce * e;
        } else if (role === 'vocal') {
            rig.spine.rotation.x = 0.07 + 0.04 * e * bounce;
            rig.spine.rotation.z = Math.sin(beats * Math.PI * 0.25) * 0.06;
            toSpine(rig, rig.micPoint, T.a);
            reach(rig, 'R', T.a, POLE.downR, dt);
            const lift = Math.max(0, Math.sin(Math.PI * beats / 4 + rig.seed));
            T.b.set(0.24, 0.2 + 0.22 * lift * e, 0.12 + 0.08 * lift);
            reach(rig, 'L', T.b, POLE.downL, dt, 6);
            rig.head.rotation.x = 0.02 + (metal ? 0.18 * e * bounce * bounce : 0.04 * bounce);
        } else if (role === 'singer' || role === 'mc') {
            const mc = role === 'mc';
            rig.spine.rotation.x = 0.04 + 0.05 * e * bounce;
            rig.root.rotation.y = rig.baseRot + Math.sin(beats * Math.PI * 0.25 + rig.seed) * 0.3;
            T.a.set(-0.035, 0.335, 0.12);
            reach(rig, 'R', T.a, POLE.downR, dt);
            // Mic sits in the fist, pointed at the mouth
            const arm = rig.arms.R;
            rig.handMic.position.copy(arm.cur || T.a);
            rig.handMic.quaternion.setFromUnitVectors(UP, T.c.set(0.035, 0.06, -0.06).normalize());
            const pump = mc ? Math.pow(Math.max(0, Math.sin(Math.PI * beats)), 2) : Math.max(0, Math.sin(Math.PI * beats / 2));
            T.b.set(mc ? 0.14 : 0.24, mc ? 0.18 + 0.24 * pump * e : 0.15 + 0.2 * pump * e, mc ? 0.16 + 0.05 * pump : 0.1);
            reach(rig, 'L', T.b, POLE.downL, dt, mc ? 30 : 8);
        } else if (role === 'keys') {
            rig.spine.rotation.x = 0.17 + 0.04 * bounce * e;
            const hitL = playing ? Math.max(0, Math.sin(Math.PI * 2 * beats)) : 0;
            const hitR = playing ? Math.max(0, Math.sin(Math.PI * 2 * beats + 1.6)) : 0;
            const drift = Math.sin(beats * 0.5 + rig.seed) * 0.05;
            toSpine(rig, T.c.set(0.1 + drift, 0.545 + 0.02 * hitL, 0.22), T.a);
            reach(rig, 'L', T.a, POLE.downL, dt);
            toSpine(rig, T.c.set(-0.1 + drift * 0.6, 0.545 + 0.02 * hitR, 0.22), T.b);
            reach(rig, 'R', T.b, POLE.downR, dt);
        } else if (role === 'dj') {
            rig.spine.rotation.x = 0.12 + 0.06 * bounce * e;
            const scratch = playing ? Math.sin(beats * Math.PI * 2) * 0.03 : 0;
            toSpine(rig, T.c.set(-0.19 + scratch, 0.52, 0.29), T.a);
            reach(rig, 'R', T.a, POLE.downR, dt, 30);
            const cue = Math.floor(beats / 8 + rig.seed) % 2 === 0;
            if (cue) T.b.set(0.1, 0.42, 0.0); else toSpine(rig, T.c.set(0.02, 0.51, 0.29), T.b);
            reach(rig, 'L', T.b, cue ? POLE.ear : POLE.downL, dt, 6);
            rig.head.rotation.z = cue ? 0.15 : 0;
        } else if (role === 'sax') {
            const sway = Math.sin(beats * Math.PI * 0.5 + rig.seed);
            rig.spine.rotation.x = -0.05 + 0.12 * e * Math.max(0, sway);
            rig.spine.rotation.z = sway * 0.08;
            rig.hips.position.y = rig.spine.position.y = 0.5;
            rig.head.rotation.x = 0.28; rig.head.rotation.y = 0;
            fromInstr(rig.sax, rig.sax.userData.upper, T.a); reach(rig, 'L', T.a, POLE.downL, dt);
            fromInstr(rig.sax, rig.sax.userData.lower, T.b); reach(rig, 'R', T.b, POLE.downR, dt);
        } else if (role === 'drums') {
            const D = rig.drums;
            const bar16 = beats % 16;
            const fill = playing && bar16 >= 15;
            const crash = playing && bar16 < 0.5;
            const lift = playing ? 0.07 + 0.05 * e : 0.03;
            const ph8 = frac(beats * 2);
            // Right hand: ride eighths, crash on the downbeat, toms in the fill
            let rT = fill ? (ph8 < 0.5 ? D.tomR : D.floor) : crash ? D.crash : D.ride;
            const rH = playing ? Math.sin(Math.PI * (fill ? frac(beats * 4) : ph8)) : 0.3;
            T.c.copy(rT); T.c.y += 0.045 + lift * rH; T.c.z -= 0.07;
            toSpine(rig, T.c, T.a); reach(rig, 'R', T.a, POLE.downR, dt, 30);
            // Left hand: backbeat on the snare, ghost notes in between
            const backbeat = Math.floor(beats) % 2 === 1;
            const lT = fill ? (ph8 < 0.5 ? D.tomL : D.snare) : D.snare;
            const lH = playing ? (backbeat ? Math.sin(Math.PI * beatPh) * 1.4 : Math.sin(Math.PI * ph8) * 0.35) : 0.3;
            T.c.copy(lT); T.c.y += 0.045 + lift * lH; T.c.z -= 0.07;
            toSpine(rig, T.c, T.b); reach(rig, 'L', T.b, POLE.downL, dt, 30);
            rig.spine.rotation.x = 0.14 + 0.05 * bounce * e;
            rig.legs[1].knee.rotation.x = 1.5 + (playing ? 0.12 * Math.max(0, Math.sin(Math.PI * 2 * beats)) : 0);
        }
        // Singers open their mouths
        if (rig.mouth && (role === 'vocal' || role === 'singer' || role === 'mc' || role === 'vocalGuitar' || role === 'vocalAcoustic')) {
            rig.mouth.scale.y = playing ? 0.35 + 0.8 * Math.abs(Math.sin(t * 7.3 + rig.seed)) * e : 0.32;
        }
    }

    // How far each setup reaches toward the crowd (keeps gear on the stage).
    const FRONT = { vocal: 0.24, vocalGuitar: 0.24, vocalAcoustic: 0.24, keys: 0.34, dj: 0.46 };

    // ctx: { act, genre, ph, stage, stageH }
    function buildBand(ctx) {
        const act = ctx.act || null;
        const genre = (act && act.genre) || ctx.genre || 'indie';
        const r = makeRng(hashStr((act && act.id) || genre));
        let roles = (LINEUP[genre] || LINEUP.indie).slice();
        if (act && act.openMic) roles = [null, 'vocalAcoustic', null, null];
        const st = ctx.stage, ph = ctx.ph;
        const spots = [[-0.3, 0.15], [0, 0.3], [0.3, 0.15], [0, -0.22]];
        const kitZWorld = st.z - st.d / 4 + 0.15;
        const members = [];
        roles.forEach((role, i) => {
            if (!role) return;
            const look = makeLook(genre, role, r);
            let x = st.x + spots[i][0] * st.w, z = st.z + spots[i][1] * st.d, y = ctx.stageH;
            if (role === 'drums') { z = kitZWorld - 0.3 * ph; y += 0.12; }
            else if (role === 'dj' && i === 1) z = st.z - 0.05 * st.d;
            else z = Math.min(z, st.z + st.d / 2 - (FRONT[role] || 0.16) * ph);
            const rig = makeMember(role, look, genre, r, { ph, kitZ: (kitZWorld - z) / ph });
            const g = rig.root;
            g.scale.setScalar(ph * look.height);
            g.position.set(x, y, z);
            rig.baseY = y; rig.scale = ph;
            rig.baseRot = role === 'drums' ? 0 : -spots[i][0] * 0.6;
            g.rotation.y = rig.baseRot;
            g.userData.rig = rig;
            g.visible = false;
            members.push(g);
        });
        return members;
    }

    function animateBand(members, t, o) {
        members.forEach(g => {
            g.visible = !!o.visible;
            if (g.visible) updateMember(g.userData.rig, t, o);
        });
    }

    /* ----------------------------- the crowd ----------------------------- */
    // Bake a list of positioned meshes into one geometry (positions + normals).
    function bake(parts) {
        const pos = [], nor = [];
        parts.forEach(m => {
            m.updateMatrix();
            const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
            g.applyMatrix4(m.matrix);
            pos.push(g.attributes.position.array); nor.push(g.attributes.normal.array);
            g.dispose();
        });
        const cat = arrs => { const n = arrs.reduce((s, a) => s + a.length, 0); const out = new Float32Array(n); let o = 0; arrs.forEach(a => { out.set(a, o); o += a.length; }); return out; };
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(cat(pos), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(cat(nor), 3));
        geo.computeBoundingSphere();
        return geo;
    }

    function crowdGeometries(lowPoly) {
        const seg = lowPoly ? 6 : 8;
        const P = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
            const m = new THREE.Mesh(geo); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); return m;
        };
        const seg2 = (a, b, r0, r1) => {
            const d = new THREE.Vector3().subVectors(b, a);
            const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), seg));
            m.position.copy(a).addScaledVector(d, 0.5);
            m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
            return m;
        };
        const legs = bake([
            seg2(V(0.05, 0.49, 0), V(0.055, 0.04, 0.0), 0.048, 0.035), seg2(V(-0.05, 0.49, 0), V(-0.055, 0.04, 0.0), 0.048, 0.035),
            P(new THREE.BoxGeometry(0.062, 0.05, 0.11), 0.055, 0.025, 0.02), P(new THREE.BoxGeometry(0.062, 0.05, 0.11), -0.055, 0.025, 0.02),
            P(new THREE.CylinderGeometry(0.083, 0.086, 0.1, 10), 0, 0.49, 0, 0, 0, 0, 1, 1, 0.7)
        ]);
        const torso = () => [P(new THREE.CylinderGeometry(0.1, 0.082, 0.31, 12), 0, 0.665, 0, 0, 0, 0, 1, 1, 0.62),
            P(new THREE.SphereGeometry(0.041, seg, 6), 0.112, 0.798, 0), P(new THREE.SphereGeometry(0.041, seg, 6), -0.112, 0.798, 0)];
        const armDown = s => [seg2(V(s * 0.115, 0.8, 0), V(s * 0.135, 0.635, -0.005), 0.036, 0.031), seg2(V(s * 0.135, 0.635, -0.005), V(s * 0.125, 0.48, 0.03), 0.031, 0.026)];
        const armUp = s => [seg2(V(s * 0.115, 0.8, 0), V(s * 0.21, 0.9, 0.05), 0.036, 0.031), seg2(V(s * 0.21, 0.9, 0.05), V(s * 0.17, 1.05, 0.08), 0.031, 0.026)];
        const head = () => [P(new THREE.CylinderGeometry(0.03, 0.035, 0.07, seg), 0, 0.835, 0), P(new THREE.SphereGeometry(0.066, 12, 10), 0, 0.923, 0, 0, 0, 0, 0.93, 1.1, 1)];
        const hand = (x, y, z) => P(new THREE.SphereGeometry(0.03, seg, 6), x, y, z, 0, 0, 0, 0.85, 1.15, 0.75);
        const capG = new THREE.SphereGeometry(0.0715, 14, 10, 0, TAU, 0, Math.PI * 0.55);
        const hairShort = bake([P(capG, 0, 0.923, 0, -0.45, 0, 0, 0.95, 1.12, 1.04)]);
        const hairLong = bake([P(capG, 0, 0.923, 0, -0.45, 0, 0, 0.95, 1.12, 1.04),
            P(new THREE.CylinderGeometry(0.074, 0.088, 0.2, 14, 1, true, 1.1, TAU - 2.2), 0, 0.86, -0.008, 0, 0, 0, 1, 1, 0.9)]);
        return {
            legs, hairShort, hairLong,
            torsoA: bake([...torso(), ...armDown(1), ...armDown(-1)]),
            torsoB: bake([...torso(), ...armDown(1), ...armUp(-1)]),
            skinA: bake([...head(), hand(0.125, 0.46, 0.035), hand(-0.125, 0.46, 0.035)]),
            skinB: bake([...head(), hand(0.125, 0.46, 0.035), hand(-0.168, 1.075, 0.085)])
        };
    }

    const FAN_TOPS = ['#141416', '#1c1c20', '#0e0e10', '#e8e4dc', '#7a1a1a', '#1a2a4a', '#2a2a2e', '#5a1a3a', '#c4161c', '#3a4a3a', '#141416', '#d4a640', '#4a5a7a'];
    const FAN_PANTS = ['#1e2a44', '#26324a', '#141418', '#2e2e34', '#4a4436', '#1a1a1e', '#33415e'];
    const FAN_HAIR = ['#17100b', '#2b1a10', '#4a2e1a', '#6e4a2a', '#b58a4e', '#dcc07a', '#8a3a1c', '#8c8c92', '#17100b', '#2b1a10', '#17100b', '#4a2e1a', '#2b1a10', '#b58a4e', '#e0306a', '#2b1a10'];

    function buildCrowd(slots, ph, quality) {
        const n = slots.length;
        const group = new THREE.Group();
        const G = crowdGeometries(quality === 'low');
        // Materials are dimmed so the floor reads as a dark concert crowd and the band pops
        const im = (geo, rough, tint = 0x6e6e74) => {
            const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: tint, roughness: rough }), Math.max(1, n));
            m.count = 0; m.frustumCulled = false;
            group.add(m); return m;
        };
        const parts = {
            legs: im(G.legs, 0.9), hairS: im(G.hairShort, 0.8), hairL: im(G.hairLong, 0.8),
            torsoA: im(G.torsoA, 0.85), torsoB: im(G.torsoB, 0.85), skinA: im(G.skinA, 0.65, 0x9a8f8a), skinB: im(G.skinB, 0.65, 0x9a8f8a)
        };
        const r = makeRng(n * 7919 + 13);
        const col = new THREE.Color();
        let s = 0, l = 0;
        const fans = slots.map((slot, i) => {
            const f = {
                slot,
                top: pick(r, FAN_TOPS), pants: pick(r, FAN_PANTS), skin: pick(r, SKIN), hair: pick(r, FAN_HAIR),
                bald: r() < 0.06, long: r() < 0.22, up: !slot.seated && r() < 0.24,
                scale: 0.9 + r() * 0.16, yaw: Math.PI + (r() - 0.5) * 0.5
            };
            f.hairIdx = f.bald ? -1 : (f.long ? l++ : s++);
            if (f.bald) f.hairIdx = -1;
            parts.legs.setColorAt(i, col.set(f.pants));
            if (f.hairIdx >= 0) (f.long ? parts.hairL : parts.hairS).setColorAt(f.hairIdx, col.set(f.hair));
            return f;
        });
        // Prefix counts so "the first k fans" maps to instance counts per mesh.
        const pre = { s: [0], l: [0] };
        fans.forEach((f, i) => { pre.s.push(pre.s[i] + (!f.bald && !f.long ? 1 : 0)); pre.l.push(pre.l[i] + (!f.bald && f.long ? 1 : 0)); });
        const crowd = { group, parts, fans, pre, ph, raise: null, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3() };
        recolor(crowd, true);
        recolor(crowd, false);
        Object.values(parts).forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
        return crowd;
    }

    function recolor(crowd, raise) {
        const col = new THREE.Color();
        let a = 0, b = 0;
        const P = crowd.parts;
        crowd.fans.forEach(f => {
            if (raise && f.up) { P.torsoB.setColorAt(b, col.set(f.top)); P.skinB.setColorAt(b, col.set(f.skin)); b++; }
            else { P.torsoA.setColorAt(a, col.set(f.top)); P.skinA.setColorAt(a, col.set(f.skin)); a++; }
        });
        [P.torsoA, P.torsoB, P.skinA, P.skinB].forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
        crowd.raise = raise;
    }

    // o: { playing, vibe, bpm }
    function animateCrowd(crowd, n, t, o) {
        if (!crowd) return;
        const P = crowd.parts, ph = crowd.ph;
        n = Math.min(n, crowd.fans.length);
        const raise = !!o.playing && (o.vibe || 0) > 0.3;
        if (raise !== crowd.raise) recolor(crowd, raise);
        const amp = o.playing ? 0.04 + (o.vibe || 0) * 0.18 : 0.01;
        const bpm = o.bpm || 2.5;
        let a = 0, b = 0;
        const { m4, q, p, sc } = crowd;
        for (let i = 0; i < n; i++) {
            const f = crowd.fans[i], s = f.slot;
            const y = s.seated ? -0.2 * ph : Math.abs(Math.sin(t * bpm + s.phase)) * amp * ph + (s.vip ? 0.15 : 0);
            p.set(s.x, y, s.z);
            q.setFromAxisAngle(UP, f.yaw + (o.playing ? Math.sin(t * 0.7 + s.phase) * 0.08 : 0));
            const k = f.scale * ph;
            sc.set(k, k, k);
            m4.compose(p, q, sc);
            P.legs.setMatrixAt(i, m4);
            if (f.hairIdx >= 0) (f.long ? P.hairL : P.hairS).setMatrixAt(f.hairIdx, m4);
            if (raise && f.up) { P.torsoB.setMatrixAt(b, m4); P.skinB.setMatrixAt(b, m4); b++; }
            else { P.torsoA.setMatrixAt(a, m4); P.skinA.setMatrixAt(a, m4); a++; }
        }
        P.legs.count = n;
        P.hairS.count = crowd.pre.s[n]; P.hairL.count = crowd.pre.l[n];
        P.torsoA.count = P.skinA.count = a;
        P.torsoB.count = P.skinB.count = b;
        Object.values(P).forEach(m => { m.instanceMatrix.needsUpdate = true; });
    }

    return { buildBand, animateBand, buildCrowd, animateCrowd, STYLE, LINEUP };
})();
