/* =====================================================================
   BACKSTAGE PASS — 3D venue (Three.js)
   One renderer shared by the floor plan designer and the live show.
   Grid square (r, c) sits at x = c - cols/2 + 0.5, z = r - rows/2 + 0.5.
   ===================================================================== */

const Scene3D = (() => {
    if (typeof THREE === 'undefined') return { create: () => null };

    const VISUAL = {
        warehouse:      { wallH: 3.0, wall: '#4a332b', mood: 0x6688cc, ceilingLights: 0xffd7a0 },
        basement:       { wallH: 2.5, wall: '#4f3a30', mood: 0xcc5544, ceilingLights: 0xff9a60 },
        storefront:     { wallH: 3.0, wall: '#3e3a44', mood: 0xcc77aa, ceilingLights: 0xffe0b0 },
        garage:         { wallH: 3.2, wall: '#3d4048', mood: 0x55aacc, ceilingLights: 0xe8f0ff },
        downtown_venue: { wallH: 3.2, wall: '#2e2630', mood: 0xaa66ff, ceilingLights: 0xffc080 },
        music_theatre:  { wallH: 4.0, wall: '#5a2a26', mood: 0xffaa55, ceilingLights: 0xffd08a, plaster: true },
        festival:       { wallH: 0.5, wall: '#3a3a3a', mood: 0x5577ff, ceilingLights: 0xffffff, outdoor: true },
        stadium:        { wallH: 2.6, wall: '#55575f', mood: 0x88aaff, ceilingLights: 0xffffff, outdoor: true, stands: true }
    };

    const tex = {};
    function canvasTex(key, w, h, draw, repeat) {
        if (tex[key]) return tex[key];
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
        tex[key] = t;
        return t;
    }

    const noise = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };

    const brickTex = (color) => canvasTex('brick' + color, 256, 256, (g, w, h) => {
        g.fillStyle = '#1a1412'; g.fillRect(0, 0, w, h);
        const bw = 64, bh = 24;
        for (let y = 0; y < h; y += bh) {
            for (let x = -bw; x < w; x += bw) {
                const off = (y / bh) % 2 ? bw / 2 : 0;
                const base = new THREE.Color(color);
                base.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
                g.fillStyle = '#' + base.getHexString();
                g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
            }
        }
        noise(g, w, h, 2500, 0.15);
    }, true);

    const floorTex = id => canvasTex('floor-' + id, 256, 256, (g, w, h) => {
        if (id === 'checker') {
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1a1a1e' : '#d9d3c7'; g.fillRect(x * 32, y * 32, 32, 32); }
            noise(g, w, h, 1500, 0.08);
        } else if (id === 'hardwood') {
            for (let y = 0; y < h; y += 16) {
                let x = -Math.random() * 120;
                while (x < w) {
                    const len = 80 + Math.random() * 90;
                    const c = new THREE.Color('#6b4528'); c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
                    g.fillStyle = '#' + c.getHexString(); g.fillRect(x, y, len - 1, 15);
                    x += len;
                }
            }
            noise(g, w, h, 2000, 0.1);
        } else if (id === 'blackgloss') {
            g.fillStyle = '#0b0b10'; g.fillRect(0, 0, w, h); noise(g, w, h, 600, 0.06);
        } else if (id === 'grass') {
            g.fillStyle = '#1f3a22'; g.fillRect(0, 0, w, h);
            for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${80 + Math.random() * 60},${40 + Math.random() * 30},0.6)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
        } else {
            g.fillStyle = '#4a4a4f'; g.fillRect(0, 0, w, h); noise(g, w, h, 6000, 0.12);
            g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
        }
    }, true);

    const woodTex = () => floorTex('hardwood');
    const curtainTex = () => canvasTex('curtain', 256, 128, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 16; i++) grd.addColorStop(i / 16, i % 2 ? '#3a0608' : '#6e0d12');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0.6)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.4)');
        g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
    const glowTex = () => canvasTex('glow', 128, 128, (g, w) => {
        const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, w, w);
    });
    const signTex = (text, color, bg) => canvasTex('sign-' + text + color, 256, 96, (g, w, h) => {
        g.fillStyle = bg || '#0a0a0a'; g.fillRect(0, 0, w, h);
        g.font = `bold 58px 'Bebas Neue', Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = color; g.shadowBlur = 16; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 3);
    });
    const muralTex = seed => canvasTex('mural' + seed, 256, 256, (g, w, h) => {
        const cols = ['#ff3d9a', '#4fd1ff', '#ffb238', '#3ddc84', '#b98cff', '#ff3b30'];
        const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, cols[seed % 6]); grd.addColorStop(1, cols[(seed + 2) % 6]);
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 9; i++) { g.fillStyle = cols[(seed + i) % 6]; g.globalAlpha = 0.8; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1; g.font = `bold 64px 'Bebas Neue', Impact, sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('LIVE', w / 2, h / 2 + 22);
    });
    const tileTex = () => canvasTex('tile', 128, 128, (g, w, h) => {
        g.fillStyle = '#cfd6d8'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#9aa3a6'; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
    }, true);

    function create(opts) {
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: opts.quality !== 'low', powerPreference: 'high-performance' });
        } catch (e) { return null; }
        if (!renderer.getContext()) return null;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.quality === 'low' ? 1 : 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        const canvas = renderer.domElement;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07070a);
        scene.fog = new THREE.FogExp2(0x07070a, 0.02);
        const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
        const raycaster = new THREE.Raycaster();
        const mats = {};
        const M = (key, params) => mats[key] || (mats[key] = new THREE.MeshStandardMaterial(params));
        const B = (key, params) => mats[key] || (mats[key] = new THREE.MeshBasicMaterial(params));

        // Lighting rig
        const hemi = new THREE.HemisphereLight(0x9aa6c8, 0x1a1414, 1.1);
        scene.add(hemi);
        const amb = new THREE.AmbientLight(0x404050, 0.6);
        scene.add(amb);
        const key = new THREE.SpotLight(0xfff0dd, 60, 0, Math.PI / 5, 0.6, 1.2);
        scene.add(key); scene.add(key.target);
        const stageSpots = [0, 1, 2].map(() => { const s = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 7, 0.5, 1.1); scene.add(s); scene.add(s.target); return s; });
        const roomLights = [0, 1, 2].map(() => { const p = new THREE.PointLight(0xffd7a0, 6, 0, 1.6); scene.add(p); return p; });

        const self = {
            preset: 'door', mode: 'design', running: false,
            onHover: null, onClick: null, onLeave: null,
            v: null, items: [], floorId: 'concrete', report: null
        };
        let room = new THREE.Group(); scene.add(room);
        let itemsGroup = new THREE.Group(); scene.add(itemsGroup);
        let overlayGroup = new THREE.Group(); scene.add(overlayGroup);
        let liveGroup = new THREE.Group(); scene.add(liveGroup);
        let ghost = null;
        const walls = [];
        const doors = [];
        const anim = { beams: [], movers: [], screens: [], neon: [], crowd: null, heads: null, band: [], slots: [], haze: [] };
        const live = { crowd: 0, vibe: 0.5, playing: false, phase: 0, color: new THREE.Color(0xff3b30), pulse: 0, alarm: false };
        const cam = { pos: new THREE.Vector3(0, 6, 10), target: new THREE.Vector3(), fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toPos: new THREE.Vector3(), toTarget: new THREE.Vector3(), t: 1, yaw: 0, pitch: 0, zoom: 1 };
        let geo = { W: 8, D: 7, ox: 0, oz: 0, ph: 1, stageH: 0.4, wallH: 3 };
        let clock = new THREE.Clock();
        let rafId = null;

        /* --------------------------- helpers --------------------------- */
        const cellX = c => c - geo.W / 2 + 0.5;
        const cellZ = r => r - geo.D / 2 + 0.5;
        const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        const cyl = (rt, rb, h, mat, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
        const glow = (color, size, opacity = 0.8) => {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
            s.scale.set(size, size, 1);
            return s;
        };
        const beamMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        function dispose(group) {
            group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && !Object.values(tex).includes(o.material.map)) o.material.map.dispose(); });
            group.clear();
        }

        /* ---------------------------- room ----------------------------- */
        function buildRoom() {
            dispose(room);
            walls.length = 0;
            doors.length = 0;
            const v = self.v;
            const vis = VISUAL[v.id] || VISUAL.warehouse;
            geo.W = v.cols; geo.D = v.rows;
            geo.ph = Math.max(0.35, Math.min(1.15, 6 / v.tileFt));
            geo.item = Math.max(0.6, Math.min(1.15, geo.ph * 1.25));
            geo.stageH = Math.max(0.18, Math.min(0.55, geo.ph * 0.45));
            geo.wallH = vis.wallH;
            scene.background = new THREE.Color(vis.outdoor ? 0x0a0c1c : 0x07070a);
            scene.fog.color = scene.background.clone();

            // Floor
            const floorMat = new THREE.MeshStandardMaterial({
                map: floorTex(vis.outdoor && self.floorId === 'concrete' ? 'grass' : self.floorId).clone(),
                roughness: self.floorId === 'blackgloss' ? 0.15 : self.floorId === 'hardwood' ? 0.55 : 0.85,
                metalness: self.floorId === 'blackgloss' ? 0.4 : 0.05
            });
            floorMat.map.needsUpdate = true;
            floorMat.map.repeat.set(geo.W / (self.floorId === 'checker' ? 2 : 3), geo.D / (self.floorId === 'checker' ? 2 : 3));
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(geo.W, geo.D), floorMat);
            floor.rotation.x = -Math.PI / 2;
            room.add(floor);
            // Ground beyond the walls
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(geo.W * 6, geo.D * 6), M('ground' + (vis.outdoor ? 'o' : 'i'), { color: vis.outdoor ? 0x0f1a12 : 0x0c0c0f, roughness: 1 }));
            ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01;
            room.add(ground);

            // Walls (cutaway when the camera is behind them)
            const wallMat = new THREE.MeshStandardMaterial({ map: brickTex(vis.wall).clone(), roughness: 0.95, transparent: true });
            wallMat.map.needsUpdate = true;
            const t = 0.2;
            const mk = (w, d, x, z, nx, nz, len) => {
                const m = wallMat.clone();
                m.map = wallMat.map.clone(); m.map.needsUpdate = true;
                m.map.repeat.set(len / 2, geo.wallH / 1.6);
                const mesh = box(w, geo.wallH, d, m);
                mesh.position.set(x, geo.wallH / 2, z);
                mesh.userData.normal = new THREE.Vector3(nx, 0, nz);
                room.add(mesh);
                walls.push(mesh);
            };
            mk(geo.W + t * 2, t, 0, -geo.D / 2 - t / 2, 0, -1, geo.W);
            mk(geo.W + t * 2, t, 0, geo.D / 2 + t / 2, 0, 1, geo.W);
            mk(t, geo.D, -geo.W / 2 - t / 2, 0, -1, 0, geo.D);
            mk(t, geo.D, geo.W / 2 + t / 2, 0, 1, 0, geo.D);

            if (vis.stands) {
                // Stadium bowl: tiered stands behind the low walls
                const standMat = M('stand', { color: 0x2b2d36, roughness: 0.9 });
                [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([sx, sz]) => {
                    for (let tier = 0; tier < 5; tier++) {
                        const len = sx ? geo.D + tier * 1.6 : geo.W + tier * 1.6;
                        const b = box(sx ? 0.8 : len, 0.5 + tier * 0.5, sx ? len : 0.8, standMat);
                        b.position.set(sx * (geo.W / 2 + 0.6 + tier * 0.8), (0.5 + tier * 0.5) / 2, sz * (geo.D / 2 + 0.6 + tier * 0.8));
                        room.add(b);
                    }
                });
                [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
                    const pole = cyl(0.08, 0.12, 9, M('pole', { color: 0x666870, roughness: 0.6, metalness: 0.6 }));
                    pole.position.set(sx * (geo.W / 2 + 4.5), 4.5, sz * (geo.D / 2 + 4.5)); room.add(pole);
                    const lamp = box(1.4, 0.5, 0.2, B('lampwhite', { color: 0xffffff }));
                    lamp.position.set(pole.position.x, 9, pole.position.z); lamp.lookAt(0, 0, 0); room.add(lamp);
                    const gl = glow(0xffffff, 6, 0.5); gl.position.copy(lamp.position); room.add(gl);
                });
            }
            if (vis.outdoor) {
                // Stars
                const starGeo = new THREE.BufferGeometry();
                const pts = [];
                for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.45 + 0.08; const r = 120; pts.push(Math.cos(a) * r * Math.cos(e), Math.sin(e) * r, Math.sin(a) * r * Math.cos(e)); }
                starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
                room.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false })));
            }

            // Stage
            const st = v.stage;
            const sw = st.w, sd = st.d;
            const sx = st.x + sw / 2 - geo.W / 2, sz = sd / 2 - geo.D / 2;
            const stageMat = new THREE.MeshStandardMaterial({ map: woodTex().clone(), roughness: 0.6, color: 0x9a7a5a });
            stageMat.map.needsUpdate = true; stageMat.map.repeat.set(sw / 2, sd / 2);
            const stage = box(sw, geo.stageH, sd, stageMat);
            stage.position.set(sx, geo.stageH / 2, sz);
            room.add(stage);
            const lip = box(sw, 0.04, 0.04, B('lip', { color: 0xff3b30 }));
            lip.position.set(sx, geo.stageH, sz + sd / 2);
            room.add(lip);
            const curtain = new THREE.Mesh(new THREE.PlaneGeometry(sw + 0.6, geo.wallH * 0.92), new THREE.MeshStandardMaterial({ map: curtainTex(), roughness: 1, side: THREE.DoubleSide }));
            curtain.position.set(sx, geo.wallH * 0.46 + 0.02, -geo.D / 2 + 0.06);
            room.add(curtain);
            const truss = box(sw + 0.4, 0.08, 0.08, M('truss', { color: 0x8a8a92, metalness: 0.8, roughness: 0.35 }));
            truss.position.set(sx, Math.min(geo.wallH - 0.1, geo.stageH + geo.ph * 2.2), sz + sd / 2 - 0.1);
            room.add(truss);
            geo.stage = { x: sx, z: sz, w: sw, d: sd, trussY: truss.position.y };
            // Stage backline (amps & drum riser)
            const ampMat = M('amp', { color: 0x151518, roughness: 0.7 });
            [-0.32, 0.32].forEach(f => {
                const amp = box(0.35 * geo.item, 0.45 * geo.item, 0.25 * geo.item, ampMat);
                amp.position.set(sx + f * sw, geo.stageH + 0.225 * geo.item, sz - sd / 2 + 0.25);
                room.add(amp);
            });
            const riser = box(Math.min(1.2, sw * 0.3), 0.12, Math.min(0.8, sd * 0.5), M('riser', { color: 0x1d1d22 }));
            riser.position.set(sx, geo.stageH + 0.06, sz - sd / 4);
            room.add(riser);
            const kit = new THREE.Group();
            const drumMat = M('drum', { color: 0xb02020, roughness: 0.4, metalness: 0.3 });
            const kickDrum = cyl(0.16 * geo.ph, 0.16 * geo.ph, 0.18 * geo.ph, drumMat); kickDrum.rotation.x = Math.PI / 2; kickDrum.position.y = 0.16 * geo.ph; kit.add(kickDrum);
            [[-0.22, 0.25], [0.22, 0.25]].forEach(([x, y]) => { const t2 = cyl(0.09 * geo.ph, 0.09 * geo.ph, 0.1 * geo.ph, drumMat); t2.position.set(x * geo.ph, y * geo.ph + 0.1, 0); kit.add(t2); });
            const cym = cyl(0.14 * geo.ph, 0.14 * geo.ph, 0.01, M('cym', { color: 0xd4af37, metalness: 0.9, roughness: 0.3 })); cym.position.set(0.32 * geo.ph, 0.55 * geo.ph, -0.05); kit.add(cym);
            kit.position.set(sx, geo.stageH + 0.12, sz - sd / 4 + 0.15);
            room.add(kit);

            // Doors
            v.doors.forEach(d => {
                const dc = Sim.doorCell(v, d);
                const main = d.kind === 'main';
                const dh = Math.min(geo.wallH * 0.85, Math.max(0.9, geo.ph * 1.4));
                const door = box(0.85, dh, 0.06, M('door' + d.kind, { color: main ? 0x3a2a14 : 0x1b2a1f, roughness: 0.6, metalness: 0.3 }));
                const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshBasicMaterial({ map: signTex(main ? 'ENTRANCE' : 'EXIT', main ? '#ffb238' : '#3ddc84') }));
                const gl = glow(main ? 0xffb238 : 0x3ddc84, 1.2, 0.5);
                let x = cellX(dc.c), z = cellZ(dc.r), ry = 0;
                if (d.side === 'bottom') { z = geo.D / 2 - 0.01; ry = Math.PI; }
                else if (d.side === 'left') { x = -geo.W / 2 + 0.01; ry = Math.PI / 2; }
                else if (d.side === 'right') { x = geo.W / 2 - 0.01; ry = -Math.PI / 2; }
                const g = new THREE.Group();
                door.position.y = dh / 2; sign.position.set(0, dh + 0.18, 0.04); gl.position.set(0, dh + 0.18, 0.1);
                g.add(door, sign, gl);
                g.position.set(x, 0, z); g.rotation.y = ry;
                g.userData.side = d.side;
                room.add(g);
                doors.push(g);
            });

            // Room lighting
            const longest = Math.max(geo.W, geo.D);
            key.position.set(sx, geo.wallH + longest * 0.5, sz + longest * 0.7);
            key.target.position.set(sx, geo.stageH, sz);
            key.intensity = 30 + longest * 4;
            roomLights.forEach((p, i) => {
                p.color.setHex(vis.ceilingLights);
                p.position.set((i - 1) * geo.W * 0.3, geo.wallH * 0.9, geo.D * 0.1);
                p.intensity = 2.5 + longest * 0.5;
            });
            hemi.color.setHex(vis.mood);
            stageSpots.forEach((s, i) => {
                s.position.set(sx + (i - 1) * sw * 0.35, geo.stage.trussY, sz + sd / 2);
                s.target.position.set(sx + (i - 1) * sw * 0.2, geo.stageH, sz - sd * 0.2);
                s.intensity = 0;
            });
            scene.fog.density = vis.outdoor ? 0.004 : 0.015;
        }

        /* ---------------------------- items ---------------------------- */
        const itemBuilders = {
            bar(it, w, d) {
                const g = new THREE.Group();
                const h = 0.55 * geo.item;
                const body = box(w * 0.92, h, d * 0.62, M('barbody', { color: 0x3b2416, roughness: 0.6 }));
                body.position.y = h / 2; g.add(body);
                const top = box(w * 0.98, 0.05, d * 0.72, M('bartop', { color: 0x8a5a33, roughness: 0.25, metalness: 0.2 }));
                top.position.y = h + 0.025; g.add(top);
                const glass = ['#3ddc84', '#ffb238', '#b98cff', '#ff3b30'];
                for (let i = 0; i < 4; i++) {
                    const b = cyl(0.03, 0.035, 0.18 * geo.item, new THREE.MeshStandardMaterial({ color: glass[i], emissive: glass[i], emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.85 }), 8);
                    b.position.set((i - 1.5) * w * 0.2, h + 0.12 * geo.item, -d * 0.18);
                    g.add(b);
                }
                const tap = cyl(0.02, 0.02, 0.18 * geo.item, M('chrome', { color: 0xcccccc, metalness: 1, roughness: 0.2 }), 8);
                tap.position.set(0, h + 0.1 * geo.item, d * 0.1); g.add(tap);
                const lamp = glow(0xffc070, 0.9 * geo.item, 0.55); lamp.position.y = h + 0.8 * geo.item; g.add(lamp);
                return g;
            },
            cocktail(it, w, d) {
                const g = itemBuilders.bar(it, w, d);
                const strip = box(w * 0.92, 0.03, 0.02, B('neonOrange', { color: 0xff8a2a }));
                strip.position.set(0, 0.5 * geo.item, d * 0.32); g.add(strip);
                g.children[0].material = M('cocktailbody', { color: 0x1a1a20, roughness: 0.3, metalness: 0.5 });
                anim.neon.push(strip);
                return g;
            },
            restroom(it, w, d) {
                const g = new THREE.Group();
                const h = Math.min(geo.wallH * 0.7, 1.2 * geo.item + 0.4);
                const shell = box(w * 0.96, h, d * 0.96, new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.4 }));
                shell.position.y = h / 2; g.add(shell);
                const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: signTex('WC', '#4fd1ff') }));
                sign.position.set(0, h * 0.75, d * 0.49); g.add(sign);
                const door = box(0.32, h * 0.7, 0.02, M('wcdoor', { color: 0x2f7fb8, roughness: 0.5 }));
                door.position.set(w > 1 ? -w * 0.22 : 0, h * 0.35, d * 0.49); g.add(door);
                if (w > 1) { const d2 = door.clone(); d2.position.x = w * 0.22; g.add(d2); }
                return g;
            },
            merch(it, w, d) {
                const g = new THREE.Group();
                const h = 0.45 * geo.item;
                const top = box(w * 0.8, 0.05, d * 0.5, M('table', { color: 0x222226 }));
                top.position.y = h; g.add(top);
                const cloth = box(w * 0.8, h, 0.02, M('cloth', { color: 0x8a5cc2, roughness: 1 }));
                cloth.position.set(0, h / 2, d * 0.25); g.add(cloth);
                const shirts = ['#111', '#c4161c', '#eee', '#2f7fb8'];
                shirts.forEach((c, i) => { const s = box(0.14, 0.03, 0.12, M('shirt' + c, { color: c })); s.position.set((i - 1.5) * w * 0.17, h + 0.04, 0); g.add(s); });
                const rack = new THREE.Group();
                const bar = cyl(0.01, 0.01, w * 0.7, M('chrome', { color: 0xcccccc, metalness: 1, roughness: 0.2 }), 6); bar.rotation.z = Math.PI / 2; bar.position.y = h * 2.2; rack.add(bar);
                [0, 1, 2].forEach(i => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.22), new THREE.MeshStandardMaterial({ color: shirts[i], side: THREE.DoubleSide })); p.position.set((i - 1) * 0.2, h * 2.2 - 0.13, 0); rack.add(p); });
                rack.position.z = -d * 0.3; g.add(rack);
                return g;
            },
            greenroom(it, w, d) {
                const g = new THREE.Group();
                const h = Math.min(geo.wallH * 0.55, 0.9 * geo.item + 0.3);
                const wallM = M('grwall', { color: 0x2d5a3a, roughness: 0.9 });
                [[w, 0.06, 0, -d / 2 + 0.03], [w, 0.06, 0, d / 2 - 0.03], [0.06, d, -w / 2 + 0.03, 0], [0.06, d, w / 2 - 0.03, 0]].forEach(([ww, dd, x, z], i) => {
                    const m = box(ww * (i === 1 ? 0.6 : 1), h, dd, wallM); m.position.set(x - (i === 1 ? w * 0.2 : 0), h / 2, z); g.add(m);
                });
                const rug = box(w * 0.7, 0.01, d * 0.6, M('rug', { color: 0x6b1a1a, roughness: 1 })); rug.position.y = 0.01; g.add(rug);
                const couchM = M('couch', { color: 0x4a3426, roughness: 0.8 });
                const seat = box(w * 0.6, 0.2 * geo.item, 0.35 * geo.item, couchM); seat.position.set(0, 0.1 * geo.item, -d * 0.25); g.add(seat);
                const back = box(w * 0.6, 0.3 * geo.item, 0.1, couchM); back.position.set(0, 0.25 * geo.item, -d * 0.25 - 0.17 * geo.item); g.add(back);
                const lamp = glow(0xffd28a, 1.2 * geo.item, 0.5); lamp.position.set(w * 0.3, 0.7 * geo.item, d * 0.2); g.add(lamp);
                const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), new THREE.MeshBasicMaterial({ map: signTex('GREEN ROOM', '#3ddc84') }));
                sign.position.set(-w * 0.2, h + 0.15, d / 2); g.add(sign);
                return g;
            },
            pa(it, w, d) {
                const g = new THREE.Group();
                const h = 1.5 * geo.item;
                const cab = box(0.6, h, 0.55, M('cab', { color: 0x141416, roughness: 0.8 }));
                cab.position.y = h / 2; g.add(cab);
                const coneM = M('cone', { color: 0x2b2b30, roughness: 0.5, metalness: 0.4 });
                [[h * 0.3, 0.22], [h * 0.68, 0.14], [h * 0.88, 0.08]].forEach(([y, r]) => {
                    const cone = cyl(r, r, 0.04, coneM, 20); cone.rotation.x = Math.PI / 2; cone.position.set(0, y, 0.28); g.add(cone);
                });
                g.userData.faceCrowd = true;
                return g;
            },
            linearray(it, w, d) {
                const g = new THREE.Group();
                const top = Math.min(geo.wallH - 0.15, geo.stageH + geo.ph * 2.6);
                const pole = cyl(0.03, 0.03, top, M('chrome', { color: 0xcccccc, metalness: 1, roughness: 0.2 }), 8); pole.position.y = top / 2; g.add(pole);
                for (let i = 0; i < 6; i++) {
                    const b = box(0.6, 0.16 * geo.item, 0.4, M('cab', { color: 0x141416, roughness: 0.8 }));
                    b.position.set(0, top - 0.1 - i * 0.17 * geo.item, 0.12);
                    b.rotation.x = i * 0.05;
                    g.add(b);
                }
                g.userData.faceCrowd = true;
                return g;
            },
            delay(it, w, d) {
                const g = new THREE.Group();
                const hgt = Math.min(geo.wallH - 0.3, 2.2 * geo.item);
                const pole = cyl(0.04, 0.06, hgt, M('truss', { color: 0x8a8a92, metalness: 0.8, roughness: 0.35 }), 8); pole.position.y = hgt / 2; g.add(pole);
                const cab = box(0.45, 0.4 * geo.item, 0.35, M('cab', { color: 0x141416 })); cab.position.y = hgt; g.add(cab);
                const base = box(0.5, 0.05, 0.5, M('truss', {})); base.position.y = 0.025; g.add(base);
                g.userData.faceBack = true;
                return g;
            },
            foh(it, w, d) {
                const g = new THREE.Group();
                const riser = box(w * 0.92, 0.12, d * 0.92, M('riser', { color: 0x1d1d22 })); riser.position.y = 0.06; g.add(riser);
                const desk = box(Math.max(w, d) * 0.6, 0.35 * geo.item, Math.min(w, d) * 0.4, M('desk', { color: 0x2a2a30, roughness: 0.5 }));
                desk.position.y = 0.12 + 0.175 * geo.item; g.add(desk);
                const face = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, d) * 0.55, Math.min(w, d) * 0.35), new THREE.MeshBasicMaterial({ map: canvasTex('console', 256, 128, (c, cw, ch) => {
                    c.fillStyle = '#111'; c.fillRect(0, 0, cw, ch);
                    for (let i = 0; i < 24; i++) { c.fillStyle = '#333'; c.fillRect(8 + i * 10, 20, 3, 90); c.fillStyle = ['#3ddc84', '#ffb238', '#ff3b30'][i % 3]; c.fillRect(6 + i * 10, 30 + Math.random() * 60, 7, 6); }
                }) }));
                face.rotation.x = -Math.PI / 2.6; face.position.set(0, 0.12 + 0.36 * geo.item, 0); g.add(face);
                if (w < d) { desk.rotation.y = Math.PI / 2; face.rotation.z = Math.PI / 2; }
                const scr = glow(0x4fd1ff, 0.6, 0.35); scr.position.y = 0.6 * geo.item; g.add(scr);
                return g;
            },
            pars(it, w, d) {
                const g = new THREE.Group();
                const color = [0xff3b30, 0xffb238, 0xff3d9a, 0x4fd1ff, 0x3ddc84][it.id % 5];
                const hgt = geo.stage.trussY - geo.stageH;
                const stand = cyl(0.025, 0.025, hgt, M('truss', { color: 0x8a8a92, metalness: 0.8, roughness: 0.35 }), 6); stand.position.y = hgt / 2; g.add(stand);
                [-0.18, 0.18].forEach(x => {
                    const can = cyl(0.07, 0.09, 0.18, M('can', { color: 0x111114, metalness: 0.6, roughness: 0.4 }), 12);
                    can.position.set(x, hgt, 0.05); can.rotation.x = Math.PI / 2.6; g.add(can);
                    const gl = glow(color, 0.5, 0.9); gl.position.set(x, hgt - 0.05, 0.12); g.add(gl);
                    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.45, hgt + geo.stageH, 20, 1, true), beamMat(color));
                    beam.position.set(x, (hgt) / 2 - geo.stageH / 2, 0.35); beam.rotation.x = -0.35;
                    g.add(beam);
                    anim.beams.push({ mesh: beam, glow: gl, color, base: 0.12 });
                });
                g.userData.onStage = true;
                return g;
            },
            movers(it, w, d) {
                const g = new THREE.Group();
                const color = [0xff3d9a, 0x4fd1ff, 0xb98cff, 0xffffff][it.id % 4];
                const base = box(0.3, 0.12, 0.3, M('mover', { color: 0x151518, metalness: 0.4, roughness: 0.5 })); base.position.y = 0.06; g.add(base);
                const yoke = new THREE.Group(); yoke.position.y = 0.12; g.add(yoke);
                const arm = box(0.3, 0.25, 0.04, M('mover', {})); arm.position.y = 0.12; yoke.add(arm);
                const head = new THREE.Group(); head.position.y = 0.2; yoke.add(head);
                const hb = box(0.2, 0.2, 0.26, M('mover', {})); head.add(hb);
                const lens = glow(color, 0.45, 1); lens.position.z = 0.15; head.add(lens);
                const len = geo.wallH * 1.6 + 2;
                const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.35, len, 16, 1, true), beamMat(color));
                beam.geometry.translate(0, -len / 2, 0); beam.rotation.x = Math.PI / 2; beam.position.z = 0.12;
                head.add(beam);
                anim.movers.push({ yoke, head, beam, phase: it.id * 1.7, color });
                g.userData.onStage = true;
                return g;
            },
            ledwall(it, w, d) {
                const g = new THREE.Group();
                const hgt = Math.min(geo.wallH - geo.stageH - 0.1, Math.max(w, d) * 0.6 + 0.4);
                const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
                const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
                const screen = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, d) * 0.95, hgt), new THREE.MeshBasicMaterial({ map: t }));
                screen.position.set(0, hgt / 2 + 0.05, -Math.min(w, d) * 0.35);
                if (w < d) screen.rotation.y = Math.PI / 2;
                g.add(screen);
                const frame = box(Math.max(w, d) * 0.98, hgt + 0.06, 0.05, M('frame', { color: 0x0a0a0a })); frame.position.copy(screen.position); frame.position.z -= 0.03; frame.rotation.y = screen.rotation.y; g.add(frame);
                anim.screens.push({ canvas, tex: t, t: Math.random() * 10 });
                g.userData.onStage = true;
                return g;
            },
            fog(it, w, d) {
                const g = new THREE.Group();
                const m = box(0.35, 0.18, 0.25, M('fogm', { color: 0x2a2a30, metalness: 0.4 })); m.position.y = 0.09; g.add(m);
                const nozzle = glow(0xffffff, 0.3, 0.3); nozzle.position.set(0, 0.12, 0.15); g.add(nozzle);
                g.userData.onStage = true;
                return g;
            },
            barrier(it, w, d) {
                const g = new THREE.Group();
                const mat = M('steel', { color: 0x9a9aa6, metalness: 0.9, roughness: 0.35 });
                const h = 0.5 * geo.item;
                [0.15, h].forEach(y => { const rail = box(w * 0.95, 0.04, 0.04, mat); rail.position.set(0, y, 0); g.add(rail); });
                for (let i = 0; i < 5; i++) { const p = box(0.02, h, 0.02, mat); p.position.set((i - 2) * w * 0.22, h / 2, 0); g.add(p); }
                const foot = box(w * 0.95, 0.02, 0.4, mat); foot.position.set(0, 0.01, 0.15); g.add(foot);
                return g;
            },
            seating(it, w, d) {
                const g = new THREE.Group();
                const seatM = M('velvet', { color: 0x7a1218, roughness: 0.9 });
                const s = 0.26 * geo.item;
                for (let i = 0; i < 3; i++) {
                    const chair = new THREE.Group();
                    const seat = box(s, 0.06, s, seatM); seat.position.y = s * 1.1; chair.add(seat);
                    const back = box(s, s * 1.2, 0.05, seatM); back.position.set(0, s * 1.7, s / 2); chair.add(back);
                    const leg = box(s * 0.9, s * 1.1, s * 0.1, M('chairleg', { color: 0x111 })); leg.position.y = s * 0.55; chair.add(leg);
                    chair.position.set((i - 1) * w * 0.3, 0, 0);
                    g.add(chair);
                }
                return g;
            },
            vip(it, w, d) {
                const g = new THREE.Group();
                const plat = box(w * 0.95, 0.15, d * 0.95, M('vipplat', { color: 0x1a1414, roughness: 0.4 })); plat.position.y = 0.075; g.add(plat);
                const trim = box(w * 0.96, 0.03, d * 0.96, M('gold', { color: 0xd4af37, metalness: 1, roughness: 0.25 })); trim.position.y = 0.15; g.add(trim);
                const couchM = M('vipcouch', { color: 0x2a0a3a, roughness: 0.6 });
                [[-0.4, 0], [0.4, Math.PI]].forEach(([f, ry]) => {
                    const c = new THREE.Group();
                    const seat = box(w * 0.6, 0.18 * geo.item, 0.3 * geo.item, couchM); seat.position.y = 0.24; c.add(seat);
                    const back = box(w * 0.6, 0.3 * geo.item, 0.08, couchM); back.position.set(0, 0.35, -0.16 * geo.item); c.add(back);
                    c.position.z = f * d * 0.6; c.rotation.y = ry; g.add(c);
                });
                const table = cyl(0.18, 0.18, 0.05, M('gold', {}), 16); table.position.y = 0.38; g.add(table);
                const bottle = glow(0xffd27a, 0.5, 0.6); bottle.position.y = 0.55; g.add(bottle);
                const postM = M('gold', {});
                [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const p = cyl(0.025, 0.025, 0.5 * geo.item, postM, 8); p.position.set(sx * w * 0.45, 0.15 + 0.25 * geo.item, sz * d * 0.45); g.add(p); });
                const rope = box(w * 0.9, 0.02, 0.02, M('rope', { color: 0x8b0000 })); rope.position.set(0, 0.15 + 0.4 * geo.item, d * 0.45); g.add(rope);
                return g;
            },
            neon(it, w, d) {
                const g = new THREE.Group();
                const color = [0xff3d9a, 0x4fd1ff, 0xb98cff, 0xffb238][it.id % 4];
                const shape = new THREE.Shape();
                const s = 0.35;
                shape.moveTo(0.1 * s, 1 * s); shape.lineTo(-0.5 * s, 0); shape.lineTo(-0.05 * s, 0); shape.lineTo(-0.2 * s, -1 * s); shape.lineTo(0.5 * s, 0.1 * s); shape.lineTo(0.05 * s, 0.1 * s); shape.closePath();
                const pts = shape.getPoints().map(p => new THREE.Vector3(p.x, p.y, 0));
                pts.push(pts[0].clone());
                const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 64, 0.025, 8), B('neon' + color, { color }));
                g.add(tube);
                const gl = glow(color, 1.4, 0.6); gl.position.z = 0.05; g.add(gl);
                anim.neon.push(tube);
                g.userData.wall = true; g.userData.mountY = Math.min(geo.wallH * 0.6, 1.4 * geo.item);
                return g;
            },
            mural(it, w, d) {
                const g = new THREE.Group();
                const size = Math.min(geo.wallH * 0.7, 0.95);
                const p = new THREE.Mesh(new THREE.PlaneGeometry(0.95, size), new THREE.MeshStandardMaterial({ map: muralTex(it.id % 6), roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.15, emissiveMap: muralTex(it.id % 6) }));
                g.add(p);
                g.userData.wall = true; g.userData.mountY = Math.min(geo.wallH * 0.55, size / 2 + 0.4);
                return g;
            },
            arcade(it, w, d) {
                const g = new THREE.Group();
                const n = 2;
                for (let i = 0; i < n; i++) {
                    const cab = new THREE.Group();
                    const h = 0.95 * geo.item;
                    const body = box(0.32, h, 0.32, M('arcadebody', { color: [0x2a2a8a, 0x8a2a2a][i], roughness: 0.5 })); body.position.y = h / 2; cab.add(body);
                    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.2), new THREE.MeshBasicMaterial({ color: [0x3ddc84, 0xff3d9a][i] }));
                    scr.position.set(0, h * 0.72, 0.165); cab.add(scr);
                    const gl = glow([0x3ddc84, 0xff3d9a][i], 0.5, 0.4); gl.position.set(0, h * 0.72, 0.2); cab.add(gl);
                    cab.position[w >= d ? 'x' : 'z'] = (i - 0.5) * Math.max(w, d) * 0.45;
                    g.add(cab);
                }
                return g;
            }
        };

        function buildItems() {
            dispose(itemsGroup);
            anim.beams = []; anim.movers = []; anim.screens = []; anim.neon = [];
            let fog = false;
            self.items.forEach(it => {
                const build = itemBuilders[it.type];
                if (!build) return;
                const g = build(it, it.w, it.h);
                const cx = it.c + it.w / 2 - geo.W / 2, cz = it.r + it.h / 2 - geo.D / 2;
                g.position.set(cx, g.userData.onStage ? geo.stageH : 0, cz);
                if (g.userData.wall) {
                    // Mount on the nearest exterior wall
                    const dl = it.c, dr = geo.W - 1 - (it.c + it.w - 1), db = geo.D - 1 - (it.r + it.h - 1), dt = it.r;
                    const m = Math.min(dl, dr, db, dt);
                    if (m === dl) { g.position.x = -geo.W / 2 + 0.03; g.rotation.y = Math.PI / 2; g.userData.wallSide = 'left'; }
                    else if (m === dr) { g.position.x = geo.W / 2 - 0.03; g.rotation.y = -Math.PI / 2; g.userData.wallSide = 'right'; }
                    else if (m === db) { g.position.z = geo.D / 2 - 0.03; g.rotation.y = Math.PI; g.userData.wallSide = 'bottom'; }
                    else { g.position.z = -geo.D / 2 + 0.03; }
                    g.position.y = g.userData.mountY;
                } else if (g.userData.faceCrowd) {
                    g.rotation.y = 0;
                } else if (g.userData.faceBack) {
                    g.rotation.y = 0;
                } else if (it.type === 'bar' || it.type === 'cocktail') {
                    // Bartenders work with their back to the nearest wall
                    if (it.c === 0) g.rotation.y = -Math.PI / 2;
                    else if (it.c === geo.W - 1) g.rotation.y = Math.PI / 2;
                    else if (it.r === geo.D - 1) g.rotation.y = 0;
                    else g.rotation.y = Math.PI;
                } else if (it.type === 'barrier') {
                    if (it.c < self.v.stage.x || it.c >= self.v.stage.x + self.v.stage.w) g.rotation.y = Math.PI / 2;
                }
                if (it.type === 'fog') fog = true;
                g.userData.id = it.id;
                itemsGroup.add(g);
            });
            // Haze sheets when a haze machine is installed
            anim.haze.forEach(h => scene.remove(h));
            anim.haze = [];
            if (fog) {
                for (let i = 0; i < 6; i++) {
                    const h = glow(0x8899bb, Math.max(geo.W, geo.D) * 0.8, 0.07);
                    h.position.set((Math.random() - 0.5) * geo.W * 0.7, 0.6 + Math.random() * geo.wallH * 0.5, -geo.D / 2 + 1 + Math.random() * geo.D * 0.6);
                    scene.add(h); anim.haze.push(h);
                }
            }
            scene.fog.density = (VISUAL[self.v.id].outdoor ? 0.004 : 0.015) * (fog ? 2.2 : 1);
            buildMarkers();
            if (self.mode === 'live') buildLive();
        }

        // Design-mode floor markings: door clearances and dead space.
        let markers = new THREE.Group(); scene.add(markers);
        function buildMarkers() {
            dispose(markers);
            if (self.mode !== 'design' || !self.v) return;
            const v = self.v;
            const plane = new THREE.PlaneGeometry(0.94, 0.94);
            v.doors.forEach(d => {
                const dc = Sim.doorCell(v, d);
                const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: d.kind === 'main' ? 0xffb238 : 0x3ddc84, transparent: true, opacity: 0.22, depthWrite: false }));
                m.rotation.x = -Math.PI / 2; m.position.set(cellX(dc.c), 0.012, cellZ(dc.r));
                markers.add(m);
            });
            (self.report && self.report.trapped || []).forEach(([r, c]) => {
                const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.3, depthWrite: false }));
                m.rotation.x = -Math.PI / 2; m.position.set(cellX(c), 0.013, cellZ(r));
                markers.add(m);
            });
            // Faint grid so squares read clearly
            const lines = [];
            for (let c = 0; c <= v.cols; c++) lines.push(c - geo.W / 2, 0.011, -geo.D / 2, c - geo.W / 2, 0.011, geo.D / 2);
            for (let r = 0; r <= v.rows; r++) lines.push(-geo.W / 2, 0.011, r - geo.D / 2, geo.W / 2, 0.011, r - geo.D / 2);
            const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
            markers.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 })));
        }

        /* --------------------------- overlay --------------------------- */
        self.setOverlay = report => {
            dispose(overlayGroup);
            if (!report) return;
            const plane = new THREE.PlaneGeometry(0.96, 0.96);
            report.coverage.forEach((lv, k) => {
                const r = Math.floor(k / 1000), c = k % 1000;
                const color = lv > 0 ? new THREE.Color().setHSL(0.33 * lv, 0.9, 0.5) : new THREE.Color(0xff3b30);
                const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: lv > 0 ? 0.25 + lv * 0.3 : 0.45, depthWrite: false }));
                m.rotation.x = -Math.PI / 2; m.position.set(cellX(c), 0.02, cellZ(r));
                overlayGroup.add(m);
            });
        };

        /* ---------------------------- ghost ---------------------------- */
        self.setGhost = (rect, ok, tool) => {
            if (ghost) { scene.remove(ghost); ghost.traverse(o => { if (o.geometry) o.geometry.dispose(); }); ghost = null; }
            if (!rect) return;
            const onStage = Sim.isStage(self.v, rect.r, rect.c);
            const h = tool === 'pa' || tool === 'linearray' || tool === 'delay' ? 1.5 * geo.item : tool === 'restroom' || tool === 'greenroom' ? 1 * geo.item : 0.6 * geo.item;
            const g = new THREE.Group();
            const color = ok ? 0x3ddc84 : 0xff3b30;
            const b = box(rect.w * 0.98, h, rect.h * 0.98, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
            b.position.y = h / 2;
            g.add(b);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color }));
            edges.position.copy(b.position);
            g.add(edges);
            g.position.set(rect.c + rect.w / 2 - geo.W / 2, onStage ? geo.stageH : 0, rect.r + rect.h / 2 - geo.D / 2);
            ghost = g;
            scene.add(g);
        };

        /* ----------------------------- live ---------------------------- */
        function buildLive() {
            dispose(liveGroup);
            anim.crowd = null; anim.heads = null; anim.band = []; anim.slots = [];
            const v = self.v, r = self.report;
            if (!r) return;
            const max = self.quality === 'low' ? 220 : 520;
            // Crowd slots, front of the room first
            const occ = Sim.occupancy(self.items);
            const cells = [];
            for (let rr = 0; rr < v.rows; rr++) for (let cc = 0; cc < v.cols; cc++) {
                if (Sim.isStage(v, rr, cc)) continue;
                const it = occ.get(rr * 1000 + cc);
                if (it && !Sim.D.ITEMS[it.type].walk) continue;
                cells.push({ r: rr, c: cc, seated: it && it.type === 'seating', vip: it && it.type === 'vip' });
            }
            const perCell = Math.max(1, Math.ceil(max / Math.max(1, cells.length)));
            const slots = [];
            cells.forEach(cell => {
                const n = cell.seated ? Math.min(3, perCell) : perCell;
                for (let i = 0; i < n; i++) {
                    const jitter = cell.seated ? 0 : 0.36;
                    slots.push({
                        x: cellX(cell.c) + (cell.seated ? (i - 1) * 0.3 : (Math.random() - 0.5) * jitter * 2),
                        z: cellZ(cell.r) + (cell.seated ? 0 : (Math.random() - 0.5) * jitter * 2),
                        seated: cell.seated, vip: cell.vip, phase: Math.random() * Math.PI * 2, front: cell.r + Math.random() * 0.8
                    });
                }
            });
            slots.sort((a, b) => a.front - b.front);
            anim.slots = slots.slice(0, max);
            anim.crowd = Characters.buildCrowd(anim.slots, geo.ph, self.quality);
            if (anim.crowd) liveGroup.add(anim.crowd.group);
            buildBand();
        }

        // Band on stage: genre-styled musicians for whoever is playing right now.
        function buildBand() {
            anim.band.forEach(m => { liveGroup.remove(m); dispose(m); });
            anim.band = Characters.buildBand({ act: live.act, genre: live.genre, ph: geo.ph, stage: geo.stage, stageH: geo.stageH });
            anim.band.forEach(m => liveGroup.add(m));
        }

        self.setLive = (o) => {
            if (o.crowd !== undefined) live.crowd = o.crowd;
            if (o.vibe !== undefined) live.vibe = o.vibe;
            if (o.playing !== undefined) live.playing = o.playing;
            if (o.phase !== undefined) live.phase = o.phase;
            if (o.genre) live.color.set(Sim.D.GENRES[o.genre].color);
            // A new act (or genre) on stage means a new band to draw.
            let rebuild = false;
            if (o.genre && o.genre !== live.genre) { live.genre = o.genre; rebuild = !live.act; }
            if (o.act && (!live.act || o.act.id !== live.act.id)) { live.act = o.act; rebuild = true; }
            if (rebuild && self.mode === 'live' && self.report && geo.stage) buildBand();
        };
        self.pulse = x => { live.pulse = Math.max(live.pulse, x); };
        self.alarm = on => { live.alarm = on; };
        self.celebrate = () => { live.pulse = 1; };

        /* ---------------------------- camera --------------------------- */
        function presetPose(name) {
            const W = geo.W, D = geo.D, L = Math.max(W, D);
            const st = geo.stage || { x: 0, z: -D / 2 + 0.5 };
            switch (name) {
                case 'stage': return { pos: new THREE.Vector3(st.x, geo.stageH + geo.ph * 1.6 + 0.3, -D / 2 + 0.4), target: new THREE.Vector3(0, 0, D / 2) };
                case 'balcony': return { pos: new THREE.Vector3(W * 0.62, Math.max(geo.wallH + 1.5, L * 0.62), D * 0.78), target: new THREE.Vector3(0, 0, -D * 0.05) };
                case 'top': return { pos: new THREE.Vector3(0, L * 1.32 + 2, 0.01 + D * 0.12), target: new THREE.Vector3(0, 0, 0) };
                case 'crowd': return { pos: new THREE.Vector3(st.x * 0.5, geo.ph * 1.5 + 0.4, D * 0.36), target: new THREE.Vector3(st.x, geo.stageH + geo.ph * 0.8, -D / 2 + 0.5) };
                default: return { pos: new THREE.Vector3(0, Math.max(geo.wallH * 0.9, L * 0.42), D / 2 + L * 0.42), target: new THREE.Vector3(0, 0, -D * 0.12) };
            }
        }

        self.setCamera = (name, instant) => {
            self.preset = name;
            const p = presetPose(name);
            cam.fromPos.copy(camera.position); cam.fromTarget.copy(cam.target);
            cam.toPos.copy(p.pos); cam.toTarget.copy(p.target);
            cam.yaw = 0; cam.pitch = 0; cam.zoom = 1;
            cam.t = instant ? 1 : 0;
            if (instant) { camera.position.copy(p.pos); cam.target.copy(p.target); camera.lookAt(cam.target); }
        };

        function updateCamera(dt) {
            if (cam.t < 1) {
                cam.t = Math.min(1, cam.t + dt / 0.7);
                const e = cam.t < 0.5 ? 2 * cam.t * cam.t : 1 - Math.pow(-2 * cam.t + 2, 2) / 2;
                cam.pos.lerpVectors(cam.fromPos, cam.toPos, e);
                cam.target.lerpVectors(cam.fromTarget, cam.toTarget, e);
            } else {
                cam.pos.copy(cam.toPos);
                cam.target.copy(cam.toTarget);
            }
            // User orbit/zoom offsets around the preset
            const off = cam.pos.clone().sub(cam.target);
            const sph = new THREE.Spherical().setFromVector3(off);
            sph.theta += cam.yaw;
            sph.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.05, sph.phi + cam.pitch));
            sph.radius *= cam.zoom;
            let p = new THREE.Vector3().setFromSpherical(sph).add(cam.target);
            // Live mode: a gentle handheld sway
            if (self.mode === 'live') {
                const t = clock.elapsedTime;
                p.x += Math.sin(t * 0.4) * 0.15; p.y += Math.sin(t * 0.7) * 0.05;
            }
            camera.position.copy(p);
            camera.lookAt(cam.target);
            // Cutaway walls between the camera and the room
            walls.forEach(w => {
                const n = w.userData.normal;
                const facing = (camera.position.x - w.position.x) * n.x + (camera.position.z - w.position.z) * n.z > 0;
                w.material.opacity = facing ? 0.08 : 1;
                w.material.depthWrite = !facing;
                w.visible = !facing || self.preset !== 'top';
                w.userData.cut = facing;
            });
            // Hide doors and wall-mounted decor on cut-away walls
            const cutSide = { bottom: walls[1] && walls[1].userData.cut, left: walls[2] && walls[2].userData.cut, right: walls[3] && walls[3].userData.cut };
            doors.forEach(d => { d.visible = !cutSide[d.userData.side]; });
            itemsGroup.children.forEach(g => { if (g.userData.wallSide) g.visible = !cutSide[g.userData.wallSide]; });
        }

        /* ---------------------------- input ---------------------------- */
        const ndc = new THREE.Vector2();
        const planeFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const planeStage = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        function pick(ev) {
            const rect = canvas.getBoundingClientRect();
            ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            const hit = new THREE.Vector3();
            planeStage.constant = -geo.stageH;
            if (raycaster.ray.intersectPlane(planeStage, hit)) {
                const c = Math.floor(hit.x + geo.W / 2), r = Math.floor(hit.z + geo.D / 2);
                if (r >= 0 && c >= 0 && r < geo.D && c < geo.W && Sim.isStage(self.v, r, c)) return { r, c };
            }
            if (raycaster.ray.intersectPlane(planeFloor, hit)) {
                const c = Math.floor(hit.x + geo.W / 2), r = Math.floor(hit.z + geo.D / 2);
                if (r >= 0 && c >= 0 && r < geo.D && c < geo.W && !Sim.isStage(self.v, r, c)) return { r, c };
            }
            return null;
        }
        let down = null, lastCell = null;
        canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, button: e.button, moved: false }; canvas.setPointerCapture(e.pointerId); });
        canvas.addEventListener('pointermove', e => {
            if (down) {
                const dx = e.clientX - down.x, dy = e.clientY - down.y;
                if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
                if (down.moved) {
                    cam.yaw -= e.movementX * 0.006;
                    cam.pitch -= e.movementY * 0.004;
                    cam.yaw = Math.max(-1.2, Math.min(1.2, cam.yaw));
                    cam.pitch = Math.max(-0.6, Math.min(0.6, cam.pitch));
                    return;
                }
            }
            if (self.mode !== 'design') return;
            const cell = pick(e);
            if (cell) {
                if (!lastCell || lastCell.r !== cell.r || lastCell.c !== cell.c) { lastCell = cell; if (self.onHover) self.onHover(cell.r, cell.c); }
            } else if (lastCell) { lastCell = null; if (self.onLeave) self.onLeave(); }
        });
        canvas.addEventListener('pointerup', e => {
            const wasDrag = down && down.moved;
            const button = down ? down.button : 0;
            down = null;
            if (wasDrag || self.mode !== 'design') return;
            const cell = pick(e);
            if (cell && self.onClick) { if (self.onHover) self.onHover(cell.r, cell.c); self.onClick(cell.r, cell.c, button === 2); }
        });
        canvas.addEventListener('pointerleave', () => { if (lastCell && self.onLeave) self.onLeave(); lastCell = null; });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = Math.max(0.45, Math.min(1.6, cam.zoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: false });
        canvas.addEventListener('dblclick', () => { cam.yaw = 0; cam.pitch = 0; cam.zoom = 1; });

        /* ---------------------------- loop ----------------------------- */
        function animate() {
            rafId = requestAnimationFrame(animate);
            const dt = Math.min(0.05, clock.getDelta());
            const t = clock.elapsedTime;
            updateCamera(dt);
            live.pulse = Math.max(0, live.pulse - dt * 0.8);
            const energy = self.mode === 'live' ? (live.playing ? 0.35 + live.vibe * 0.65 : 0.15) : 0.6;

            anim.beams.forEach((b, i) => {
                const flick = self.mode === 'live' ? (0.5 + 0.5 * Math.sin(t * (2 + live.vibe * 6) + i)) : 0.7;
                b.mesh.material.opacity = b.base * (0.4 + flick * energy) + live.pulse * 0.1;
                if (self.mode === 'live' && live.playing) b.mesh.material.color.copy(i % 2 ? live.color : new THREE.Color(b.color));
            });
            anim.movers.forEach(m => {
                const sp = self.mode === 'live' ? 0.6 + live.vibe * 1.8 : 0.5;
                m.yoke.rotation.y = Math.sin(t * sp * 0.7 + m.phase) * 1.1;
                m.head.rotation.x = -0.5 + Math.sin(t * sp + m.phase) * 0.45;
                m.beam.material.opacity = 0.1 + energy * 0.12 + live.pulse * 0.1;
            });
            anim.screens.forEach(s => {
                s.t += dt;
                const g = s.canvas.getContext('2d'), w = s.canvas.width, h = s.canvas.height;
                const hue = (s.t * 40) % 360;
                const grd = g.createLinearGradient(0, 0, w, h);
                grd.addColorStop(0, `hsl(${hue},90%,45%)`); grd.addColorStop(1, `hsl(${(hue + 120) % 360},90%,30%)`);
                g.fillStyle = grd; g.fillRect(0, 0, w, h);
                for (let i = 0; i < 16; i++) {
                    const bh = (0.2 + 0.8 * Math.abs(Math.sin(s.t * (2 + energy * 4) + i * 0.7))) * h * energy;
                    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(i * 16 + 3, h - bh, 10, bh);
                }
                s.tex.needsUpdate = true;
            });
            anim.neon.forEach((n, i) => { n.visible = !(Math.sin(t * 13 + i * 3) > 0.985); });

            // Stage spotlights in live mode
            stageSpots.forEach((s, i) => {
                if (self.mode === 'live' && live.playing) {
                    s.intensity = (8 + energy * 30) * (0.6 + 0.4 * Math.sin(t * 3 + i * 2)) + live.pulse * 30;
                    s.color.copy(live.alarm ? new THREE.Color(0xff0000) : i === 1 ? new THREE.Color(0xffffff) : live.color);
                } else s.intensity = self.mode === 'live' ? 4 : 0;
            });
            roomLights.forEach(p => { p.visible = !(self.mode === 'live' && live.playing); });

            // Crowd
            if (anim.crowd && self.mode === 'live') {
                const n = Math.min(anim.slots.length, Math.round(anim.slots.length * Math.min(1, live.crowd)));
                const bpm = 2.2 + live.vibe * 1.6;
                Characters.animateCrowd(anim.crowd, n, t, { playing: live.playing, vibe: live.vibe, bpm });
                Characters.animateBand(anim.band, t, { visible: live.playing && live.phase > 0 && live.phase < 5, playing: live.playing, vibe: live.vibe });
            }
            renderer.render(scene, camera);
        }

        /* --------------------------- public ---------------------------- */
        self.attach = host => {
            if (canvas.parentElement !== host) host.appendChild(canvas);
            self.resize();
        };
        self.resize = () => {
            const host = canvas.parentElement;
            if (!host) return;
            const w = host.clientWidth || 600, h = host.clientHeight || 400;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.fov = w / h < 1 ? 70 : 55;
            camera.updateProjectionMatrix();
        };
        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => self.resize());
            const watch = () => { if (canvas.parentElement) ro.observe(canvas.parentElement); };
            const orig = self.attach;
            self.attach = host => { orig(host); ro.disconnect(); watch(); };
        }
        self.setMode = mode => {
            self.mode = mode;
            if (mode === 'design') { dispose(liveGroup); anim.crowd = null; anim.band = []; }
            if (mode === 'live') live.act = null;
            buildMarkers();
        };
        self.setLayout = (v, items, floorId, report, resetCamera) => {
            const roomChanged = !self.v || self.v.id !== v.id || self.floorId !== floorId;
            self.v = v; self.items = items.map(i => Object.assign({}, i)); self.floorId = floorId; self.report = report;
            if (roomChanged) buildRoom();
            buildItems();
            if (roomChanged || resetCamera) self.setCamera(self.mode === 'live' ? 'crowd' : (roomChanged ? 'door' : self.preset), roomChanged);
        };
        self.setQuality = q => {
            self.quality = q;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : 2));
            self.resize();
        };
        self.pause = () => { self.running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; };
        self.resume = () => { if (self.running) return; self.running = true; clock.getDelta(); animate(); };
        self.quality = opts.quality;
        return self;
    }

    return { create };
})();
