/* Generates the game's illustrated scenes as SVG files in img/.
   Usage: node tools/build-art.js                                        */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'img');
fs.mkdirSync(OUT, { recursive: true });

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = (a, b) => a + rnd() * (b - a);

const defs = `<defs>
  <filter id="blur4"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="blur12"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="blur30"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="neon" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="glowW"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowA"><stop offset="0" stop-color="#ffb238" stop-opacity=".9"/><stop offset="1" stop-color="#ffb238" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowR"><stop offset="0" stop-color="#ff3b30" stop-opacity=".9"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowP"><stop offset="0" stop-color="#ff3d9a" stop-opacity=".9"/><stop offset="1" stop-color="#ff3d9a" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowC"><stop offset="0" stop-color="#4fd1ff" stop-opacity=".9"/><stop offset="1" stop-color="#4fd1ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05050f"/><stop offset=".6" stop-color="#1a0d2a"/><stop offset="1" stop-color="#3a1424"/></linearGradient>
  <linearGradient id="beamR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3b30" stop-opacity=".75"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></linearGradient>
  <linearGradient id="beamA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb238" stop-opacity=".7"/><stop offset="1" stop-color="#ffb238" stop-opacity="0"/></linearGradient>
  <linearGradient id="beamC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fd1ff" stop-opacity=".65"/><stop offset="1" stop-color="#4fd1ff" stop-opacity="0"/></linearGradient>
  <linearGradient id="beamP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3d9a" stop-opacity=".7"/><stop offset="1" stop-color="#ff3d9a" stop-opacity="0"/></linearGradient>
  <linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a22"/><stop offset="1" stop-color="#2a1a10"/></linearGradient>
  <pattern id="brick" width="60" height="24" patternUnits="userSpaceOnUse"><rect width="60" height="24" fill="#1c1210"/><rect x="1" y="1" width="58" height="10" fill="#3a2420"/><rect x="-29" y="13" width="58" height="10" fill="#33201c"/><rect x="31" y="13" width="58" height="10" fill="#3d2622"/></pattern>
</defs>`;

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${defs}${body}</svg>`;
const glow = (x, y, r, id, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})" opacity="${op}"/>`;
const stars = (w, h, n) => Array.from({ length: n }, () => `<circle cx="${R(0, w).toFixed(0)}" cy="${R(0, h).toFixed(0)}" r="${R(0.5, 1.6).toFixed(1)}" fill="#fff" opacity="${R(0.3, 0.9).toFixed(2)}"/>`).join('');

// Crowd silhouettes: heads & shoulders, some hands up.
function crowd(w, y0, rows, scale, color = '#050507') {
    let out = '';
    for (let r = 0; r < rows; r++) {
        const y = y0 + r * 26 * scale;
        const s = scale * (1 + r * 0.25);
        for (let x = -20; x < w + 20; x += R(26, 40) * s) {
            const hx = x + R(-6, 6), hy = y + R(-6, 6);
            out += `<ellipse cx="${hx}" cy="${hy}" rx="${11 * s}" ry="${13 * s}" fill="${color}"/>`;
            out += `<path d="M${hx - 24 * s} ${hy + 60 * s} Q${hx - 22 * s} ${hy + 14 * s} ${hx} ${hy + 12 * s} Q${hx + 22 * s} ${hy + 14 * s} ${hx + 24 * s} ${hy + 60 * s}z" fill="${color}"/>`;
            if (rnd() < 0.3) {
                const side = rnd() < 0.5 ? -1 : 1;
                out += `<path d="M${hx + side * 14 * s} ${hy + 18 * s} L${hx + side * R(20, 34) * s} ${hy - R(40, 60) * s}" stroke="${color}" stroke-width="${7 * s}" stroke-linecap="round"/>`;
                if (rnd() < 0.3) out += `<rect x="${hx + side * 26 * s - 4 * s}" y="${hy - 66 * s}" width="${8 * s}" height="${12 * s}" rx="2" fill="#bfe3ff" opacity=".85"/>`;
            }
        }
    }
    return out;
}

// Band silhouettes on a stage (x center, y stage top, scale).
function band(cx, y, s) {
    const c = '#030304';
    const person = (x, pose) => {
        let p = `<ellipse cx="${x}" cy="${y - 150 * s}" rx="${13 * s}" ry="${15 * s}" fill="${c}"/>`;
        p += `<path d="M${x - 22 * s} ${y - 128 * s} L${x + 22 * s} ${y - 128 * s} L${x + 16 * s} ${y - 60 * s} L${x - 16 * s} ${y - 60 * s}z" fill="${c}"/>`;
        p += `<path d="M${x - 12 * s} ${y - 62 * s} L${x - 20 * s} ${y} M${x + 12 * s} ${y - 62 * s} L${x + 22 * s} ${y}" stroke="${c}" stroke-width="${13 * s}" stroke-linecap="round"/>`;
        if (pose === 'guitar') p += `<path d="M${x - 40 * s} ${y - 70 * s} L${x + 50 * s} ${y - 112 * s}" stroke="${c}" stroke-width="${6 * s}"/><ellipse cx="${x - 22 * s}" cy="${y - 74 * s}" rx="${26 * s}" ry="${18 * s}" fill="${c}" transform="rotate(-25 ${x - 22 * s} ${y - 74 * s})"/><path d="M${x + 18 * s} ${y - 120 * s} L${x - 6 * s} ${y - 82 * s}" stroke="${c}" stroke-width="${8 * s}" stroke-linecap="round"/>`;
        if (pose === 'mic') p += `<path d="M${x} ${y} L${x} ${y - 120 * s}" stroke="${c}" stroke-width="${3 * s}"/><path d="M${x + 16 * s} ${y - 126 * s} L${x + 4 * s} ${y - 160 * s}" stroke="${c}" stroke-width="${9 * s}" stroke-linecap="round"/>`;
        return p;
    };
    let out = '';
    out += `<ellipse cx="${cx}" cy="${y - 40 * s}" rx="${46 * s}" ry="${40 * s}" fill="${c}"/><rect x="${cx - 70 * s}" y="${y - 90 * s}" width="${30 * s}" height="${4 * s}" fill="#d4af37" opacity=".6"/><ellipse cx="${cx + 60 * s}" cy="${y - 110 * s}" rx="${26 * s}" ry="${4 * s}" fill="#d4af37" opacity=".5"/>`;
    out += person(cx, 'drums');
    out += person(cx - 180 * s, 'guitar') + person(cx + 180 * s, 'guitar') + person(cx + 40 * s, 'mic');
    out += `<rect x="${cx - 300 * s}" y="${y - 90 * s}" width="${60 * s}" height="${90 * s}" fill="#0c0c0e"/><rect x="${cx + 240 * s}" y="${y - 90 * s}" width="${60 * s}" height="${90 * s}" fill="#0c0c0e"/>`;
    return out;
}

function stageScene(w, h, opts = {}) {
    const sy = h * 0.68;
    let b = `<rect width="${w}" height="${h}" fill="#08070b"/>`;
    b += `<rect x="0" y="0" width="${w}" height="${sy}" fill="url(#brick)" opacity=".35"/>`;
    b += `<path d="M${w * 0.12} 0 H${w * 0.88} V${sy} H${w * 0.12}z" fill="#3a0608" opacity=".55"/>`;
    for (let i = 0; i < 18; i++) b += `<rect x="${w * 0.12 + i * w * 0.0422}" y="0" width="${w * 0.02}" height="${sy}" fill="#000" opacity=".25"/>`;
    b += `<rect x="0" y="${h * 0.06}" width="${w}" height="${h * 0.02}" fill="#2a2a30"/>`;
    const lamps = opts.lamps || 9;
    const cols = ['beamR', 'beamA', 'beamP', 'beamC'];
    for (let i = 0; i < lamps; i++) {
        const x = w * (0.1 + 0.8 * i / (lamps - 1));
        const tx = x + R(-w * 0.15, w * 0.15);
        b += `<path d="M${x - 6} ${h * 0.08} L${tx - w * 0.06} ${sy + 20} L${tx + w * 0.06} ${sy + 20} L${x + 6} ${h * 0.08}z" fill="url(#${cols[i % 4]})" opacity=".55" filter="url(#blur4)"/>`;
        b += glow(x, h * 0.085, 26, ['glowR', 'glowA', 'glowP', 'glowC'][i % 4]);
        b += `<rect x="${x - 9}" y="${h * 0.07}" width="18" height="16" rx="3" fill="#111"/>`;
    }
    b += `<ellipse cx="${w / 2}" cy="${sy * 0.75}" rx="${w * 0.45}" ry="${h * 0.25}" fill="#fff" opacity=".06" filter="url(#blur30)"/>`;
    if (opts.band !== false) b += band(w / 2, sy, opts.bandScale || h / 900);
    b += `<rect x="0" y="${sy}" width="${w}" height="${h * 0.04}" fill="url(#wood)"/><rect x="0" y="${sy}" width="${w}" height="3" fill="#ff3b30" opacity=".8"/>`;
    b += `<rect x="0" y="${sy + h * 0.04}" width="${w}" height="${h}" fill="#050507"/>`;
    if (opts.crowd !== false) b += crowd(w, sy + h * 0.1, opts.rows || 3, h / 900);
    b += `<rect width="${w}" height="${h}" fill="url(#fadeDown)" opacity=".4"/>`;
    return b;
}

const scenes = {
    splash: () => svg(1600, 900, stageScene(1600, 900, { lamps: 11, rows: 4 })),
    live: () => svg(1200, 800, stageScene(1200, 800, { lamps: 9 })),
    scout: () => svg(1200, 600, stageScene(1200, 600, { lamps: 5, rows: 2 })),

    menu: () => svg(600, 900, `<rect width="600" height="900" fill="url(#night)"/>${stars(600, 300, 60)}
        <rect x="40" y="220" width="520" height="520" fill="url(#brick)"/>
        <rect x="70" y="300" width="460" height="110" fill="#0a0a0a" stroke="#2a2a2a" stroke-width="6"/>
        ${Array.from({ length: 24 }, (_, i) => glow(84 + i * 19, 304, 7, 'glowA') + glow(84 + i * 19, 406, 7, 'glowA')).join('')}
        <text x="300" y="352" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="44" fill="#ffb238" filter="url(#neon)" letter-spacing="4">LIVE TONIGHT</text>
        <text x="300" y="392" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="22" fill="#fff" letter-spacing="6">DOORS 8PM · ALL AGES</text>
        <rect x="230" y="520" width="140" height="220" fill="#1a0c0c" stroke="#3a2a2a" stroke-width="6"/>
        <rect x="244" y="534" width="112" height="90" fill="#ff8a3a" opacity=".55"/>${glow(300, 560, 120, 'glowA', 0.5)}
        <rect x="80" y="450" width="90" height="130" fill="#c4161c" transform="rotate(-4 125 515)"/><rect x="92" y="470" width="66" height="40" fill="#111" transform="rotate(-4 125 515)"/>
        <rect x="430" y="455" width="90" height="125" fill="#ffb238" transform="rotate(3 475 515)"/><circle cx="475" cy="500" r="26" fill="#111" transform="rotate(3 475 515)"/>
        <text x="300" y="275" text-anchor="middle" font-family="Impact, sans-serif" font-size="30" fill="#ff3d9a" filter="url(#neon)" letter-spacing="3">BACKSTAGE</text>
        <rect x="0" y="740" width="600" height="160" fill="#0b0b10"/>
        <rect x="0" y="742" width="600" height="160" fill="#ffb238" opacity=".05"/>
        <path d="M250 760 L350 760 L420 900 L180 900z" fill="#ff8a3a" opacity=".12" filter="url(#blur12)"/>
        <line x1="530" y1="740" x2="530" y2="440" stroke="#222" stroke-width="8"/>${glow(530, 440, 90, 'glowW', 0.35)}<circle cx="530" cy="440" r="10" fill="#fff8e0"/>
        <path d="M60 830 h80 M220 860 h120 M420 820 h90" stroke="#ffb238" stroke-width="3" opacity=".25"/>`),

    settings: () => svg(600, 900, `<rect width="600" height="900" fill="#0b0b10"/>
        <g transform="translate(0 120)">${Array.from({ length: 8 }, (_, ch) => {
            const x = 40 + ch * 68;
            let g = `<rect x="${x}" y="0" width="58" height="700" rx="6" fill="#18181f" stroke="#2a2a35"/>`;
            for (let k = 0; k < 5; k++) { const col = ['#ff3b30', '#ffb238', '#4fd1ff', '#3ddc84', '#b98cff'][k]; g += `<circle cx="${x + 29}" cy="${40 + k * 62}" r="17" fill="#26262f" stroke="${col}" stroke-width="3"/><line x1="${x + 29}" y1="${40 + k * 62}" x2="${x + 29 + 12 * Math.cos(R(0, 6))}" y2="${40 + k * 62 + 12 * Math.sin(R(0, 6))}" stroke="#fff" stroke-width="3"/>`; }
            g += `<rect x="${x + 26}" y="360" width="6" height="300" fill="#050507"/>`;
            const fy = R(400, 620); g += `<rect x="${x + 12}" y="${fy}" width="34" height="18" rx="3" fill="#ddd"/>`;
            for (let l = 0; l < 10; l++) g += `<rect x="${x + 6}" y="${640 - l * 26}" width="8" height="18" fill="${l > 7 ? '#ff3b30' : l > 5 ? '#ffb238' : '#3ddc84'}" opacity="${l < R(3, 10) ? 1 : 0.15}"/>`;
            return g;
        }).join('')}</g>
        <rect width="600" height="900" fill="url(#fadeDown)" opacity=".6"/>${glow(300, 80, 260, 'glowC', 0.25)}`),

    intro: () => svg(600, 900, `<rect width="600" height="900" fill="url(#night)"/>${stars(600, 420, 90)}
        <circle cx="440" cy="150" r="46" fill="#f4ecd8"/>${glow(440, 150, 140, 'glowW', 0.25)}
        <path d="M0 460 L80 380 L160 430 L260 340 L360 420 L460 360 L600 440 L600 520 L0 520z" fill="#120d1c"/>
        <rect y="500" width="600" height="400" fill="#0a0a0e"/>
        <path d="M300 500 L80 900 L520 900z" fill="#16161c"/>
        ${Array.from({ length: 7 }, (_, i) => { const t = i / 7, y = 510 + t * t * 390, w = 2 + t * 10, hh = 6 + t * 40; return `<rect x="${300 - w / 2}" y="${y}" width="${w}" height="${hh}" fill="#ffb238" opacity=".8"/>`; }).join('')}
        <g transform="translate(150 560)">
            <path d="M0 140 L0 50 Q0 20 30 20 L250 20 Q290 20 300 60 L310 140z" fill="#2a3a4a"/>
            <rect x="20" y="36" width="70" height="40" fill="#ffcf7a" opacity=".55"/><rect x="100" y="36" width="70" height="40" fill="#0a0a10"/><rect x="180" y="36" width="80" height="40" fill="#0a0a10"/>
            <rect x="0" y="92" width="310" height="10" fill="#c4161c"/><text x="150" y="128" text-anchor="middle" font-family="Impact, sans-serif" font-size="18" fill="#ffb238" opacity=".8">ON TOUR</text>
            <circle cx="60" cy="146" r="26" fill="#050505"/><circle cx="250" cy="146" r="26" fill="#050505"/><circle cx="60" cy="146" r="10" fill="#444"/><circle cx="250" cy="146" r="10" fill="#444"/>
            ${glow(312, 110, 60, 'glowW', 0.7)}${glow(-4, 112, 30, 'glowR', 0.8)}
        </g>
        <path d="M462 670 L600 620 L600 760z" fill="#fff" opacity=".07"/>`),

    identity: () => svg(600, 900, `<rect width="600" height="900" fill="url(#brick)"/><rect width="600" height="900" fill="#000" opacity=".55"/>
        ${glow(300, 420, 330, 'glowP', 0.35)}
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon)">
            <path d="M300 160 L300 330 M262 160 h76" stroke="#4fd1ff" stroke-width="8"/>
            <path d="M300 330 Q230 330 230 420 Q230 470 260 490 Q210 520 220 590 Q235 660 300 660 Q365 660 380 590 Q390 520 340 490 Q370 470 370 420 Q370 330 300 330z" stroke="#ff3d9a" stroke-width="9"/>
            <circle cx="300" cy="520" r="34" stroke="#ff3d9a" stroke-width="7"/>
            <path d="M120 760 L160 720 L200 760 L240 720 L280 760" stroke="#ffb238" stroke-width="7"/>
            <path d="M330 720 v40 M330 720 h40 v20 h-40 M400 720 v40 h40 M470 720 v40" stroke="#3ddc84" stroke-width="7"/>
        </g>
        <path d="M80 120 l20 -40 l20 40 l-44 -26 h48z" fill="#ffb238" filter="url(#neon)" opacity=".9"/>
        <path d="M480 220 l14 -28 l14 28 l-30 -18 h32z" fill="#4fd1ff" filter="url(#neon)" opacity=".9"/>`),

    market: () => svg(600, 900, `<rect width="600" height="900" fill="url(#night)"/>${stars(600, 300, 70)}
        ${Array.from({ length: 9 }, (_, i) => {
            const x = i * 70 - 20, w = R(60, 110), top = R(260, 520);
            let b = `<rect x="${x}" y="${top}" width="${w}" height="${900 - top}" fill="${['#141420', '#191926', '#10101a'][i % 3]}"/>`;
            for (let wy = top + 16; wy < 860; wy += 26) for (let wx = x + 10; wx < x + w - 12; wx += 18) if (rnd() < 0.4) b += `<rect x="${wx}" y="${wy}" width="9" height="13" fill="${rnd() < 0.8 ? '#ffcf7a' : '#4fd1ff'}" opacity="${R(0.3, 0.9).toFixed(2)}"/>`;
            return b;
        }).join('')}
        <g transform="translate(150 600)"><rect width="300" height="300" fill="#22212c"/><rect x="0" y="0" width="300" height="14" fill="#33323f"/>
            <rect x="40" y="60" width="220" height="90" fill="#efe6d2" transform="rotate(-3 150 105)"/>
            <text x="150" y="104" text-anchor="middle" font-family="Impact, sans-serif" font-size="46" fill="#c4161c" transform="rotate(-3 150 105)">FOR LEASE</text>
            <text x="150" y="136" text-anchor="middle" font-family="Courier New, monospace" font-size="16" fill="#222" transform="rotate(-3 150 105)">CALL 555-0199</text>
            <rect x="110" y="190" width="80" height="110" fill="#0b0b0f"/>${glow(150, 186, 50, 'glowA', 0.6)}</g>
        <rect width="600" height="900" fill="url(#fadeDown)" opacity=".5"/>`),

    blueprint: () => svg(1200, 800, `<rect width="1200" height="800" fill="#0b2a4a"/>
        ${Array.from({ length: 61 }, (_, i) => `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="800" stroke="#fff" stroke-opacity="${i % 5 ? 0.05 : 0.12}"/>`).join('')}
        ${Array.from({ length: 41 }, (_, i) => `<line x1="0" y1="${i * 20}" x2="1200" y2="${i * 20}" stroke="#fff" stroke-opacity="${i % 5 ? 0.05 : 0.12}"/>`).join('')}
        <g fill="none" stroke="#d8ecff" stroke-width="4"><rect x="200" y="140" width="800" height="520"/><rect x="420" y="140" width="360" height="90"/><rect x="200" y="560" width="120" height="100"/><path d="M560 660 v-40 a40 40 0 0 1 40 40"/></g>
        <text x="600" y="195" text-anchor="middle" font-family="Courier New, monospace" font-size="28" fill="#d8ecff">STAGE</text>`),

    office: () => svg(1600, 1000, `<rect width="1600" height="1000" fill="#1a1416"/>
        <rect width="1600" height="560" fill="url(#brick)" opacity=".7"/><rect width="1600" height="560" fill="#2a0a18" opacity=".35"/>
        <rect y="540" width="1600" height="20" fill="#ff3d9a" opacity=".5" filter="url(#blur4)"/>
        <g transform="translate(80 80)"><rect width="430" height="360" fill="#0b0b1a" stroke="#3a2a2a" stroke-width="14"/>${stars(430, 160, 30)}
            ${Array.from({ length: 7 }, (_, i) => { const x = i * 62, top = R(120, 230); let b = `<rect x="${x}" y="${top}" width="56" height="${360 - top}" fill="#141424"/>`; for (let wy = top + 10; wy < 350; wy += 20) for (let wx = x + 6; wx < x + 50; wx += 14) if (rnd() < 0.4) b += `<rect x="${wx}" y="${wy}" width="7" height="10" fill="#ffcf7a" opacity=".7"/>`; return b; }).join('')}
            <line x1="215" y1="0" x2="215" y2="360" stroke="#3a2a2a" stroke-width="10"/><line x1="0" y1="180" x2="430" y2="180" stroke="#3a2a2a" stroke-width="10"/>
            <text x="215" y="-14" text-anchor="middle" font-family="Courier New, monospace" font-size="22" fill="#ffb238">VENUES FOR LEASE</text></g>
        <g transform="translate(610 80)"><rect width="440" height="340" fill="#8a6a44" stroke="#4a3220" stroke-width="12"/>
            ${['#c4161c', '#ffb238', '#4fd1ff', '#ff3d9a', '#3ddc84', '#efe6d2'].map((c, i) => `<rect x="${24 + (i % 3) * 138}" y="${24 + Math.floor(i / 3) * 150}" width="118" height="${i % 2 ? 120 : 140}" fill="${c}" transform="rotate(${R(-6, 6).toFixed(1)} ${80 + (i % 3) * 138} ${90 + Math.floor(i / 3) * 150})"/><circle cx="${83 + (i % 3) * 138}" cy="${30 + Math.floor(i / 3) * 150}" r="6" fill="#c00"/>`).join('')}
            <text x="220" y="-14" text-anchor="middle" font-family="Courier New, monospace" font-size="22" fill="#ffb238">SHOW HISTORY</text></g>
        <g transform="translate(1310 230)"><rect width="230" height="460" fill="#4a4e58" stroke="#2a2d33" stroke-width="6"/>${[0, 1, 2, 3].map(i => `<rect x="18" y="${20 + i * 110}" width="194" height="94" fill="#5a5f6a" stroke="#2a2d33" stroke-width="3"/><rect x="90" y="${56 + i * 110}" width="50" height="10" rx="4" fill="#b0b4bc"/>`).join('')}
            <text x="115" y="-14" text-anchor="middle" font-family="Courier New, monospace" font-size="22" fill="#ffb238">SAVE FILES</text></g>
        <g transform="translate(1080 60)"><rect x="40" y="0" width="16" height="420" fill="#2a2a2a"/><path d="M48 380 q-40 0 -50 -60 q-10 -60 30 -80 q-30 -40 0 -90 q30 -30 40 0 l0 -150" fill="#9a2a1a"/><rect x="44" y="0" width="8" height="200" fill="#d8c8a0"/></g>
        <path d="M0 560 L1600 560 L1600 1000 L0 1000z" fill="url(#wood)"/>
        <rect y="560" width="1600" height="14" fill="#7a5232"/>
        ${glow(1250, 540, 260, 'glowA', 0.35)}<path d="M1200 540 L1300 540 L1280 470 L1220 470z" fill="#1c6a4a"/><rect x="1246" y="540" width="8" height="70" fill="#222"/>
        <g transform="translate(330 600) rotate(-6)"><rect width="330" height="200" fill="#1d4a7a"/>${Array.from({ length: 10 }, (_, i) => `<line x1="${i * 33}" y1="0" x2="${i * 33}" y2="200" stroke="#fff" stroke-opacity=".12"/>`).join('')}<rect x="40" y="30" width="250" height="140" fill="none" stroke="#d8ecff" stroke-width="4"/><rect x="110" y="30" width="110" height="40" fill="none" stroke="#d8ecff" stroke-width="3"/><circle cx="330" cy="100" r="34" fill="#cfe4ff" opacity=".7"/>
            <text x="165" y="-10" text-anchor="middle" font-family="Courier New, monospace" font-size="20" fill="#ffb238">FLOOR PLAN</text></g>
        <g transform="translate(710 620)"><rect width="270" height="170" fill="#5a1414" rx="6"/><rect x="134" width="4" height="170" fill="#2a0808"/><rect x="12" y="12" width="116" height="146" fill="#efe6d2"/><rect x="144" y="12" width="116" height="146" fill="#efe6d2"/>${Array.from({ length: 8 }, (_, i) => `<line x1="22" y1="${30 + i * 16}" x2="118" y2="${30 + i * 16}" stroke="#8a8270"/><line x1="154" y1="${30 + i * 16}" x2="250" y2="${30 + i * 16}" stroke="#8a8270"/>`).join('')}
            <text x="135" y="-12" text-anchor="middle" font-family="Courier New, monospace" font-size="20" fill="#ffb238">THE BOOKS</text></g>
        <g transform="translate(1070 590)"><rect width="200" height="150" rx="14" fill="#141418"/><rect x="20" y="20" width="160" height="50" rx="6" fill="#3ddc84" opacity=".25"/><text x="100" y="54" text-anchor="middle" font-family="Courier New, monospace" font-size="20" fill="#3ddc84">BOOKING</text>${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${34 + c * 46}" y="${84 + r * 18}" width="36" height="12" rx="3" fill="#2a2a30"/>`).join('')).join('')}
            <path d="M-20 40 q-40 -60 30 -70 l160 0 q70 10 30 70" fill="none" stroke="#141418" stroke-width="26" stroke-linecap="round"/>${glow(100, 40, 120, 'glowC', 0.25)}
            <text x="100" y="-48" text-anchor="middle" font-family="Courier New, monospace" font-size="20" fill="#ffb238">BOOK A SHOW</text></g>
        <rect x="180" y="810" width="150" height="40" fill="#d4af37" opacity=".6" transform="rotate(8 255 830)"/><circle cx="590" cy="860" r="40" fill="#e8e0d0" opacity=".9"/><circle cx="590" cy="860" r="28" fill="#3a2010"/>
        <rect width="1600" height="1000" fill="url(#fadeDown)" opacity=".25"/>`),

    event: () => svg(600, 900, `<rect width="600" height="900" fill="#0d0d12"/><rect width="600" height="900" fill="url(#wood)" opacity=".45"/>
        ${glow(300, 450, 300, 'glowR', 0.25)}
        <g transform="translate(160 160) rotate(-8 140 290)"><rect width="280" height="560" rx="36" fill="#09090b" stroke="#2a2a30" stroke-width="6"/><rect x="18" y="60" width="244" height="440" rx="10" fill="#141420"/>
            <text x="140" y="110" text-anchor="middle" font-family="Courier New, monospace" font-size="38" fill="#fff">11:47 PM</text>
            ${['#ff3b30', '#ffb238', '#4fd1ff', '#ff3d9a'].map((c, i) => `<rect x="30" y="${150 + i * 84}" width="220" height="70" rx="10" fill="#1f1f2c"/><rect x="40" y="${162 + i * 84}" width="20" height="20" rx="5" fill="${c}"/><rect x="70" y="${164 + i * 84}" width="${R(90, 160).toFixed(0)}" height="10" rx="4" fill="#ddd"/><rect x="70" y="${184 + i * 84}" width="${R(60, 150).toFixed(0)}" height="8" rx="4" fill="#666"/>`).join('')}
        </g>${glow(300, 330, 150, 'glowC', 0.25)}
        <path d="M110 200 l-30 -20 M100 240 l-40 0 M480 220 l30 -20 M500 260 l40 0" stroke="#ffb238" stroke-width="6" stroke-linecap="round"/>`),

    marketing: () => svg(1200, 600, `<rect width="1200" height="600" fill="url(#brick)"/>
        ${Array.from({ length: 14 }, (_, i) => {
            const x = 30 + (i % 7) * 165 + R(-10, 10), y = 40 + Math.floor(i / 7) * 270 + R(-10, 10), c = ['#c4161c', '#ffb238', '#4fd1ff', '#ff3d9a', '#3ddc84', '#efe6d2', '#b98cff'][i % 7];
            return `<g transform="rotate(${R(-5, 5).toFixed(1)} ${x + 70} ${y + 110})"><rect x="${x}" y="${y}" width="140" height="220" fill="${c}"/><circle cx="${x + 70}" cy="${y + 90}" r="${R(28, 46).toFixed(0)}" fill="#111" opacity=".85"/><rect x="${x + 16}" y="${y + 158}" width="108" height="16" fill="#111"/><rect x="${x + 30}" y="${y + 184}" width="80" height="10" fill="#111" opacity=".7"/><rect x="${x}" y="${y}" width="140" height="220" fill="#fff" opacity=".06"/></g>`;
        }).join('')}
        <rect width="1200" height="600" fill="#000" opacity=".25"/>${glow(600, -40, 520, 'glowA', 0.35)}`),

    postshow: () => svg(600, 900, `<rect width="600" height="900" fill="#060608"/>
        <rect width="600" height="560" fill="#2a0608" opacity=".5"/>${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 52}" y="0" width="24" height="560" fill="#000" opacity=".3"/>`).join('')}
        <rect y="560" width="600" height="340" fill="url(#wood)"/>
        ${glow(300, 330, 320, 'glowW', 0.35)}
        <line x1="300" y1="360" x2="300" y2="740" stroke="#1a1a1a" stroke-width="8"/><path d="M260 740 h80 l-40 -20z" fill="#1a1a1a"/>
        <path d="M285 310 q15 -40 30 0 q4 30 -15 40 q-19 -10 -15 -40z" fill="#fff8e0"/>${glow(300, 325, 90, 'glowW', 0.9)}
        <path d="M300 300 L230 330 M300 300 L370 330 M300 300 V250" stroke="#2a2a2a" stroke-width="3"/>
        ${Array.from({ length: 80 }, () => `<rect x="${R(0, 600).toFixed(0)}" y="${R(600, 900).toFixed(0)}" width="${R(5, 12).toFixed(0)}" height="${R(3, 7).toFixed(0)}" fill="${['#ff3b30', '#ffb238', '#4fd1ff', '#ff3d9a', '#3ddc84', '#fff'][Math.floor(R(0, 6))]}" transform="rotate(${R(0, 180).toFixed(0)})" opacity=".8"/>`).join('')}
        <path d="M120 800 q60 -40 120 -10 t140 0" stroke="#0a0a0a" stroke-width="7" fill="none"/>
        <rect x="430" y="700" width="80" height="110" fill="#efe6d2" transform="rotate(12 470 755)"/><text x="470" y="740" text-anchor="middle" font-family="Courier New, monospace" font-size="12" fill="#222" transform="rotate(12 470 755)">SETLIST</text>`)
};

Object.entries(scenes).forEach(([name, fn]) => {
    const out = fn();
    fs.writeFileSync(path.join(OUT, name + '.svg'), out);
    console.log(name.padEnd(10), (out.length / 1024).toFixed(1) + ' KB');
});
