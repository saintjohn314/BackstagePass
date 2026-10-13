/* =====================================================================
   BACKSTAGE PASS — static game data
   Venues, equipment catalog, bands, genres, events and live crises.
   All money values are in US dollars.
   ===================================================================== */

const DATA = {
    START_FUNDS: 20000,
    START_REP: 0,
    WAGE_PER_SHIFT: 80,        // per staff member, per show night
    BAR_COGS: 0.22,            // pour cost: share of bar sales spent on stock
    MERCH_COMMISSION: 0.20,    // venue's cut of the band's merch sales
    VIP_PRICE_MULT: 3,         // VIP ticket = 3x general admission
    VIP_DEMAND_SHARE: 0.08,    // share of the crowd that will pay for VIP
    SALVAGE_RATE: 0.5,         // demolishing built equipment refunds 50%
    LEASE_EXIT_REFUND: 0.5,    // ending a lease returns half the deposit
    SAVE_KEY: 'backstagePassSaveV6',
    SETTINGS_KEY: 'backstagePassSettings',

    DAYS: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    DAY_NAMES: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    // Weekend crowds are bigger — every promoter knows it.
    DAY_TURNOUT: [0.60, 0.70, 0.80, 0.95, 1.15, 1.25, 0.85],

    GRADES: [
        { min: 0,  grade: 'D',  title: 'DIY Underdog' },
        { min: 10, grade: 'C',  title: 'Local Hangout' },
        { min: 25, grade: 'B',  title: 'Scene Staple' },
        { min: 45, grade: 'A',  title: 'Regional Powerhouse' },
        { min: 65, grade: 'A+', title: 'Industry Heavyweight' },
        { min: 85, grade: 'S',  title: 'Living Legend' }
    ],

    /* ---------------------------------------------------------------
       VENUES
       Grid squares represent real floor area (tileFt x tileFt feet).
       Fire code: 5 sq ft per standing guest, 7 sq ft per seated guest.
       Stage sits on the top wall; the main entrance is on the bottom wall.
       --------------------------------------------------------------- */
    VENUES: [
        {
            id: 'warehouse', name: 'Abandoned Warehouse', defaultName: 'The Warehouse', rating: 'C-', tier: 0,
            cols: 8, rows: 7, tileFt: 5,
            deposit: 3000, weekly: 600, repReq: 0, drinkPrice: 6, costScale: 1,
            stage: { x: 2, w: 4, d: 1 },
            doors: [{ side: 'bottom', at: 3, kind: 'main' }, { side: 'right', at: 3, kind: 'fire' }],
            prebuilt: [{ type: 'restroom', r: 6, c: 0, w: 2, h: 1 }],
            perk: { id: 'diy', name: 'Raw Space', desc: 'Bare concrete shell — all construction costs 20% less.' },
            desc: 'A grungy industrial shell with one working restroom. Perfect starting DIY space.'
        },
        {
            id: 'basement', name: 'The Subterranean Crypt', defaultName: 'The Crypt', rating: 'C', tier: 1,
            cols: 9, rows: 8, tileFt: 5,
            deposit: 9000, weekly: 1100, repReq: 10, drinkPrice: 6, costScale: 1.2,
            stage: { x: 2, w: 5, d: 1 },
            doors: [{ side: 'bottom', at: 1, kind: 'main' }, { side: 'right', at: 4, kind: 'fire' }],
            prebuilt: [
                { type: 'bar', r: 2, c: 0, w: 1, h: 1 }, { type: 'bar', r: 3, c: 0, w: 1, h: 1 }, { type: 'bar', r: 4, c: 0, w: 1, h: 1 },
                { type: 'restroom', r: 7, c: 6, w: 2, h: 1 }
            ],
            perk: { id: 'stone', name: 'Stone Acoustics', desc: 'Vaulted brick walls make heavy music hit harder: +6 vibe for Metal & Punk.' },
            desc: 'Dark, damp, loud underground hub. Comes with an old bar along the west wall.'
        },
        {
            id: 'storefront', name: 'Downtown Storefront', defaultName: 'The Storefront', rating: 'C+', tier: 2,
            cols: 10, rows: 8, tileFt: 6,
            deposit: 18000, weekly: 1900, repReq: 20, drinkPrice: 7, costScale: 1.5,
            stage: { x: 3, w: 4, d: 1 },
            doors: [{ side: 'bottom', at: 5, kind: 'main' }, { side: 'left', at: 3, kind: 'fire' }],
            prebuilt: [
                { type: 'restroom', r: 0, c: 0, w: 1, h: 2 },
                { type: 'bar', r: 2, c: 9, w: 1, h: 1 }, { type: 'bar', r: 3, c: 9, w: 1, h: 1 }, { type: 'bar', r: 4, c: 9, w: 1, h: 1 }
            ],
            perk: { id: 'frontage', name: 'Street Frontage', desc: 'Big windows on a busy block: +10% walk-up turnout.' },
            desc: 'Boarded-up retail space with heavy foot traffic and a former café bar.'
        },
        {
            id: 'garage', name: 'Former Auto Garage', defaultName: 'The Garage', rating: 'B-', tier: 3,
            cols: 11, rows: 9, tileFt: 7,
            deposit: 40000, weekly: 3200, repReq: 32, drinkPrice: 7, costScale: 2,
            stage: { x: 3, w: 5, d: 2 },
            doors: [{ side: 'bottom', at: 5, kind: 'main' }, { side: 'left', at: 5, kind: 'fire' }, { side: 'right', at: 5, kind: 'fire' }],
            prebuilt: [{ type: 'restroom', r: 8, c: 9, w: 2, h: 1 }],
            perk: { id: 'loadin', name: 'Roll-Up Load-In', desc: 'Bands drive straight onto the stage: hospitality riders cost 50% less.' },
            desc: 'Spacious garage bays with a roll-up door and phenomenal natural acoustics.'
        },
        {
            id: 'downtown_venue', name: 'Downtown Venue', defaultName: 'The Downtown', rating: 'B+', tier: 4,
            cols: 12, rows: 9, tileFt: 9,
            deposit: 95000, weekly: 6500, repReq: 45, drinkPrice: 8, costScale: 3.5,
            stage: { x: 3, w: 6, d: 2 },
            doors: [{ side: 'bottom', at: 6, kind: 'main' }, { side: 'left', at: 5, kind: 'fire' }, { side: 'right', at: 5, kind: 'fire' }],
            prebuilt: [
                { type: 'bar', r: 2, c: 11, w: 1, h: 1 }, { type: 'bar', r: 3, c: 11, w: 1, h: 1 }, { type: 'bar', r: 4, c: 11, w: 1, h: 1 },
                { type: 'restroom', r: 8, c: 0, w: 2, h: 1 }, { type: 'restroom', r: 8, c: 10, w: 2, h: 1 },
                { type: 'pa', r: 0, c: 2, w: 1, h: 1 }, { type: 'pa', r: 1, c: 9, w: 1, h: 1 },
                { type: 'foh', r: 6, c: 5, w: 2, h: 1 },
                { type: 'greenroom', r: 0, c: 0, w: 2, h: 2 },
                { type: 'pars', r: 0, c: 4, w: 1, h: 1 }, { type: 'pars', r: 0, c: 7, w: 1, h: 1 }
            ],
            perk: { id: 'nightlife', name: 'Nightlife District', desc: 'Bar-hopping crowds all night: +15% bar sales.' },
            desc: 'An established rock club in the heart of the nightlife district. Already fitted out.'
        },
        {
            id: 'music_theatre', name: 'Music Theatre', defaultName: 'The Palace Theatre', rating: 'A-', tier: 5,
            cols: 13, rows: 10, tileFt: 11,
            deposit: 250000, weekly: 15000, repReq: 58, drinkPrice: 10, costScale: 6,
            stage: { x: 3, w: 7, d: 2 },
            doors: [{ side: 'bottom', at: 6, kind: 'main' }, { side: 'left', at: 6, kind: 'fire' }, { side: 'right', at: 6, kind: 'fire' }],
            prebuilt: [
                { type: 'greenroom', r: 0, c: 0, w: 2, h: 2 },
                { type: 'pa', r: 0, c: 2, w: 1, h: 1 }, { type: 'pa', r: 1, c: 10, w: 1, h: 1 },
                { type: 'pars', r: 0, c: 4, w: 1, h: 1 }, { type: 'pars', r: 0, c: 6, w: 1, h: 1 }, { type: 'pars', r: 0, c: 8, w: 1, h: 1 },
                { type: 'bar', r: 2, c: 0, w: 1, h: 1 }, { type: 'bar', r: 3, c: 0, w: 1, h: 1 },
                { type: 'bar', r: 2, c: 12, w: 1, h: 1 }, { type: 'bar', r: 3, c: 12, w: 1, h: 1 },
                { type: 'restroom', r: 9, c: 0, w: 2, h: 1 }, { type: 'restroom', r: 9, c: 11, w: 2, h: 1 },
                { type: 'foh', r: 4, c: 6, w: 2, h: 1 }
            ].concat(seatBlock(5, 8, 1, 5), seatBlock(5, 8, 7, 11)),
            perk: { id: 'landmark', name: 'Historic Landmark', desc: 'Every show here is press-worthy: +50% reputation gains.' },
            desc: 'A historic tiered hall with balcony boxes, classic stage lighting and seating.'
        },
        {
            id: 'festival', name: 'Open-Air Amphitheater', defaultName: 'The Amphitheater', rating: 'A', tier: 6,
            cols: 14, rows: 10, tileFt: 20,
            deposit: 700000, weekly: 38000, repReq: 70, drinkPrice: 12, costScale: 15,
            stage: { x: 4, w: 6, d: 2 },
            doors: [{ side: 'bottom', at: 4, kind: 'main' }, { side: 'bottom', at: 9, kind: 'main' }, { side: 'left', at: 5, kind: 'fire' }, { side: 'right', at: 5, kind: 'fire' }],
            prebuilt: [
                { type: 'restroom', r: 9, c: 0, w: 2, h: 1 }, { type: 'restroom', r: 9, c: 12, w: 2, h: 1 },
                { type: 'restroom', r: 2, c: 0, w: 1, h: 2 },
                { type: 'bar', r: 7, c: 0, w: 1, h: 1 }, { type: 'bar', r: 8, c: 0, w: 1, h: 1 },
                { type: 'bar', r: 7, c: 13, w: 1, h: 1 }, { type: 'bar', r: 8, c: 13, w: 1, h: 1 },
                { type: 'pa', r: 1, c: 3, w: 1, h: 1 }, { type: 'pa', r: 1, c: 10, w: 1, h: 1 }
            ].concat(seatBlock(2, 4, 3, 10)),
            perk: { id: 'stars', name: 'Under the Stars', desc: 'Summer nights in the open air: +8 crowd vibe at every show.' },
            desc: 'Expansive outdoor bowl with pavilion seats up front and a huge lawn behind.'
        },
        {
            id: 'stadium', name: 'Metro Mega Stadium', defaultName: 'Metro Mega Stadium', rating: 'S', tier: 7,
            cols: 16, rows: 11, tileFt: 40,
            deposit: 2500000, weekly: 120000, repReq: 82, drinkPrice: 14, costScale: 40,
            stage: { x: 5, w: 6, d: 2 },
            doors: [
                { side: 'bottom', at: 4, kind: 'main' }, { side: 'bottom', at: 11, kind: 'main' },
                { side: 'left', at: 3, kind: 'fire' }, { side: 'left', at: 8, kind: 'fire' },
                { side: 'right', at: 3, kind: 'fire' }, { side: 'right', at: 8, kind: 'fire' }
            ],
            prebuilt: [
                { type: 'restroom', r: 10, c: 0, w: 2, h: 1 }, { type: 'restroom', r: 10, c: 14, w: 2, h: 1 },
                { type: 'restroom', r: 0, c: 0, w: 2, h: 1 }, { type: 'restroom', r: 0, c: 14, w: 2, h: 1 },
                { type: 'bar', r: 5, c: 0, w: 1, h: 1 }, { type: 'bar', r: 6, c: 0, w: 1, h: 1 },
                { type: 'bar', r: 5, c: 15, w: 1, h: 1 }, { type: 'bar', r: 6, c: 15, w: 1, h: 1 },
                { type: 'pa', r: 0, c: 4, w: 1, h: 1 }, { type: 'pa', r: 1, c: 11, w: 1, h: 1 },
                { type: 'foh', r: 7, c: 7, w: 2, h: 1 },
                { type: 'greenroom', r: 0, c: 2, w: 2, h: 2 }
            ],
            perk: { id: 'sponsors', name: 'Naming Rights', desc: 'Corporate sponsors pay 5% of ticket sales on top of every show.' },
            desc: 'The massive concrete bowl where legends are made. Only the biggest acts can fill it.'
        }
    ],

    /* ---------------------------------------------------------------
       EQUIPMENT CATALOG (floor plan designer)
       cost is the base price; each venue multiplies by its costScale.
       rule: where it may be placed.
         floor      – any open floor square
         wall       – must touch an exterior wall (plumbing / backstage)
         wallOrBar  – touch a wall or extend an existing bar
         nearStage  – must flank the stage (main speakers / barriers)
         onStage    – mounted on the stage itself (lighting)
         crowd      – out in the room, away from the stage (delay speakers)
       walk: guests can stand/walk through it (counts toward capacity)
       --------------------------------------------------------------- */
    ITEM_CATEGORIES: [
        { id: 'service', name: 'Bars & Service' },
        { id: 'sound', name: 'Sound' },
        { id: 'lights', name: 'Stage & Lighting' },
        { id: 'crowd', name: 'Crowd Areas' },
        { id: 'decor', name: 'Decor & Extras' }
    ],

    ITEMS: {
        bar:       { cat: 'service', name: 'Bar Counter', w: 1, h: 1, cost: 700, rule: 'wallOrBar', color: '#b8452f',
                     desc: 'One bartender station. Serves about {barCap} guests a night.' },
        cocktail:  { cat: 'service', name: 'Craft Cocktail Bar', w: 1, h: 1, cost: 1800, rule: 'wallOrBar', color: '#d4732a',
                     desc: 'Premium pours: serves {cocktailCap} guests at +40% per drink.' },
        restroom:  { cat: 'service', name: 'Restrooms', w: 2, h: 1, cost: 3000, rule: 'wall', color: '#2f7fb8', rotatable: true,
                     desc: 'Plumbing code: each block legally covers {restroomCap} guests. Must touch a wall.' },
        merch:     { cat: 'service', name: 'Merch Table', w: 1, h: 1, cost: 200, rule: 'floor', color: '#8a5cc2',
                     desc: 'Lets bands sell shirts. You keep 20% commission. Serves {merchCap} guests.' },
        greenroom: { cat: 'service', name: 'Green Room', w: 2, h: 2, cost: 2500, rule: 'wall', color: '#3f8f5a', max: 1,
                     desc: 'Backstage lounge. Required by touring acts (Tier 3+). Bands play better.' },

        pa:        { cat: 'sound', name: 'PA Speaker Stack', w: 1, h: 1, cost: 1200, rule: 'nearStage', color: '#3a3a46', radius: 6.5, quality: 1,
                     desc: 'Main speakers. Must flank the stage. Covers a {radius}-square radius.' },
        linearray: { cat: 'sound', name: 'Line Array', w: 1, h: 1, cost: 4000, rule: 'nearStage', color: '#22222c', radius: 9, quality: 1.15,
                     desc: 'Pro flown speakers: {radius}-square throw and +15% sound quality.' },
        delay:     { cat: 'sound', name: 'Delay Tower', w: 1, h: 1, cost: 2000, rule: 'crowd', color: '#4a4a58', radius: 4.5, quality: 1,
                     desc: 'Fills sound at the back of big rooms. Covers a {radius}-square radius.' },
        foh:       { cat: 'sound', name: 'FOH Mix Booth', w: 2, h: 1, cost: 1500, rule: 'floor', color: '#556070', rotatable: true, max: 1,
                     desc: 'Front-of-house desk for your engineer. Without one, sound quality is capped at 65%.' },

        pars:      { cat: 'lights', name: 'Par Can Rig', w: 1, h: 1, cost: 600, rule: 'onStage', color: '#c99a1e', light: 1,
                     desc: 'Classic colored stage wash. +1 lighting point.' },
        movers:    { cat: 'lights', name: 'Moving Head Rig', w: 1, h: 1, cost: 2000, rule: 'onStage', color: '#c25ac9', light: 2.5,
                     desc: 'Sweeping beams that sync to the music. +2.5 lighting points.' },
        ledwall:   { cat: 'lights', name: 'LED Video Wall', w: 2, h: 1, cost: 6000, rule: 'onStage', color: '#2fb8b0', light: 5, max: 1,
                     desc: 'A giant video backdrop. +5 lighting points.' },
        fog:       { cat: 'lights', name: 'Haze Machine', w: 1, h: 1, cost: 400, rule: 'onStage', color: '#8f9aa6', max: 1,
                     desc: 'Makes every beam visible: lighting effect x1.2.' },
        barrier:   { cat: 'lights', name: 'Crowd Barrier', w: 1, h: 1, cost: 300, rule: 'nearStage', color: '#9a9aa6', walk: true,
                     desc: 'Steel pit barricade. Fewer mosh-pit and crowd-surf incidents.' },

        seating:   { cat: 'crowd', name: 'Seating', w: 1, h: 1, cost: 120, rule: 'floor', color: '#5a4636', walk: true,
                     desc: 'Holds {seatPpt} seated guests instead of {ppt} standing. Jazz & folk crowds love it.' },
        vip:       { cat: 'crowd', name: 'VIP Lounge', w: 2, h: 2, cost: 2500, rule: 'floor', color: '#b39b3a', walk: true,
                     desc: 'Holds {vipCap} VIP guests paying 3x the ticket price (and drinking twice as much).' },

        neon:      { cat: 'decor', name: 'Neon Sign', w: 1, h: 1, cost: 500, rule: 'wall', color: '#e53fa0',
                     desc: 'Custom glowing signage. +1.5 crowd vibe (up to 3 signs).' },
        mural:     { cat: 'decor', name: 'Photo Mural', w: 1, h: 1, cost: 800, rule: 'wall', color: '#4fa3e5',
                     desc: 'Instagram bait. Fans post it: +3 hype for future shows (up to 2).' },
        arcade:    { cat: 'decor', name: 'Arcade Corner', w: 2, h: 1, cost: 1500, rule: 'floor', color: '#5fd16b', rotatable: true,
                     desc: 'Pinball & cabinets keep people around: +5% bar sales (up to 3).' }
    },

    FLOORS: [
        { id: 'concrete', name: 'Sealed Concrete', perTile: 0, color: '#2a2a30', desc: 'Free. Indestructible. Smells like beer.' },
        { id: 'checker', name: 'Checkerboard Tile', perTile: 35, color: '#2c2c2c', desc: '+3 vibe for Punk, Indie & Pop crowds.', genres: ['punk', 'indie', 'pop'] },
        { id: 'hardwood', name: 'Hardwood', perTile: 60, color: '#4a3424', desc: '+3 vibe for Jazz, Folk & Country crowds.', genres: ['jazz', 'folk', 'country'] },
        { id: 'blackgloss', name: 'Black Gloss Epoxy', perTile: 50, color: '#121218', desc: '+3 vibe for Electronic, Synthwave & Hip-Hop crowds.', genres: ['edm', 'synth', 'hiphop'] }
    ],

    /* ---------------------------------------------------------------
       PROMOTION, SECURITY
       --------------------------------------------------------------- */
    MARKETING: [
        { id: 'word',   name: 'Word of Mouth',       perCap: 0,   min: 0,   mult: 0.70, desc: 'Free. Only the diehards hear about it.' },
        { id: 'flyers', name: 'Xerox Flyers',        perCap: 0.4, min: 40,  mult: 1.00, desc: 'Telephone poles and coffee shops.' },
        { id: 'social', name: 'Social Ad Blast',     perCap: 1.2, min: 120, mult: 1.25, desc: 'Targeted ads to local fans.' },
        { id: 'street', name: 'Street Team Squad',   perCap: 2.5, min: 250, mult: 1.45, desc: 'Posters, stickers and hand-to-hand.' },
        { id: 'press',  name: 'Radio & Press Blitz', perCap: 5,   min: 600, mult: 1.70, desc: 'Interviews, radio spots and ticket giveaways.' }
    ],

    SECURITY: [
        { id: 'light',    name: 'Light',    ratio: 150, risk: 1.5, desc: '1 guard per 150 guests' },
        { id: 'standard', name: 'Standard', ratio: 75,  risk: 1.0, desc: '1 guard per 75 guests' },
        { id: 'heavy',    name: 'Heavy',    ratio: 35,  risk: 0.5, desc: '1 guard per 35 guests' }
    ],

    /* ---------------------------------------------------------------
       GENRES — how each crowd behaves
       style: what layout they prefer; drink: bar spend multiplier;
       aggression: incident risk; lightW / soundW: how much they care.
       --------------------------------------------------------------- */
    GENRES: {
        punk:    { label: 'Punk',            style: 'standing', drink: 1.3, aggression: 1.6, lightW: 0.6, soundW: 0.8, color: '#ff3b3b' },
        metal:   { label: 'Metal',           style: 'standing', drink: 1.4, aggression: 1.7, lightW: 1.0, soundW: 1.2, color: '#c0c0c8' },
        indie:   { label: 'Indie Rock',      style: 'standing', drink: 1.1, aggression: 0.8, lightW: 0.8, soundW: 1.0, color: '#ffb238' },
        synth:   { label: 'Synthwave',       style: 'standing', drink: 1.1, aggression: 0.7, lightW: 2.0, soundW: 1.1, color: '#ff3d9a' },
        edm:     { label: 'Electronic',      style: 'standing', drink: 1.2, aggression: 0.9, lightW: 2.0, soundW: 1.3, color: '#4fd1ff' },
        hiphop:  { label: 'Hip-Hop',         style: 'standing', drink: 1.1, aggression: 1.2, lightW: 1.2, soundW: 1.4, color: '#b98cff' },
        pop:     { label: 'Pop',             style: 'standing', drink: 0.8, aggression: 0.6, lightW: 1.4, soundW: 1.1, color: '#ff8ad8' },
        country: { label: 'Country',         style: 'mixed',    drink: 1.5, aggression: 0.9, lightW: 0.8, soundW: 1.0, color: '#e0a060' },
        jazz:    { label: 'Jazz & Soul',     style: 'seated',   drink: 1.0, aggression: 0.3, lightW: 0.6, soundW: 1.0, color: '#5fd1b0' },
        folk:    { label: 'Folk / Acoustic', style: 'seated',   drink: 0.9, aggression: 0.3, lightW: 0.5, soundW: 0.8, color: '#a8d16b' }
    },

    /* ---------------------------------------------------------------
       BAND TIERS
       draw: fans who'd come at a fair price with basic promo.
       fee: flat guarantee. split: band's share of the door on a door deal.
       fair: the ticket price fans consider fair.
       --------------------------------------------------------------- */
    TIERS: [
        null,
        { tier: 1, label: 'Local Opener',    repReq: 0,  minCap: 0,     split: 0.70, fair: 10,  merch: 2,  rider: 0,     greenroom: false, guaranteeOnly: false },
        { tier: 2, label: 'Local Headliner', repReq: 8,  minCap: 0,     split: 0.75, fair: 14,  merch: 3,  rider: 50,    greenroom: false, guaranteeOnly: false },
        { tier: 3, label: 'Regional Act',    repReq: 20, minCap: 150,   split: 0.80, fair: 22,  merch: 4,  rider: 150,   greenroom: true,  guaranteeOnly: false },
        { tier: 4, label: 'National Club Act', repReq: 35, minCap: 450, split: 0.85, fair: 32,  merch: 6,  rider: 600,   greenroom: true,  guaranteeOnly: false },
        { tier: 5, label: 'Theater Headliner', repReq: 50, minCap: 1200, split: 0.85, fair: 55, merch: 9,  rider: 2500,  greenroom: true,  guaranteeOnly: true },
        { tier: 6, label: 'Festival Headliner', repReq: 66, minCap: 4000, split: 0.85, fair: 75, merch: 12, rider: 10000, greenroom: true,  guaranteeOnly: true },
        { tier: 7, label: 'Stadium Superstar', repReq: 82, minCap: 15000, split: 0.85, fair: 110, merch: 18, rider: 40000, greenroom: true, guaranteeOnly: true }
    ],

    // consistency: steady = reliable every night, solid = mostly reliable,
    // erratic = could be the best set of the year or a total trainwreck.
    BANDS: [
        // Tier 1 — local openers
        { id: 'static_decay',    name: 'Static Decay',             genre: 'punk',    tier: 1, draw: 55,  fee: 150, quality: 2, consistency: 'erratic', tag: 'Three chords, zero rehearsals.' },
        { id: 'basement_saints', name: 'The Basement Saints',      genre: 'indie',   tier: 1, draw: 70,  fee: 200, quality: 3, consistency: 'solid',   tag: 'Jangly guitars and sad-boy lyrics.' },
        { id: 'velvet_mileage',  name: 'Velvet Mileage',           genre: 'folk',    tier: 1, draw: 40,  fee: 100, quality: 3, consistency: 'steady',  tag: 'Banjo, harmonies and a suitcase kick drum.' },
        { id: 'sour_milk',       name: 'Sour Milk Society',        genre: 'punk',    tier: 1, draw: 85,  fee: 250, quality: 2, consistency: 'erratic', tag: 'Loud, fast, and usually spilled on.' },
        { id: 'dj_low_battery',  name: 'DJ Low Battery',           genre: 'edm',     tier: 1, draw: 60,  fee: 150, quality: 2, consistency: 'solid',   tag: 'Laptop bangers from a college dorm.' },
        { id: 'thursday_jazz',   name: 'Thursday Jazz Collective', genre: 'jazz',    tier: 1, draw: 45,  fee: 175, quality: 4, consistency: 'steady',  tag: 'Music students who actually swing.' },
        { id: 'grave_lettuce',   name: 'Grave Lettuce',            genre: 'metal',   tier: 1, draw: 50,  fee: 120, quality: 2, consistency: 'erratic', tag: 'Doom metal about vegetables. Somehow works.' },
        { id: 'lil_mixtape',     name: "Lil' Mixtape",             genre: 'hiphop',  tier: 1, draw: 65,  fee: 180, quality: 3, consistency: 'erratic', tag: 'Fast flows, faster mood swings.' },
        { id: 'honey_gravel',    name: 'Honey & Gravel',           genre: 'country', tier: 1, draw: 45,  fee: 140, quality: 3, consistency: 'steady',  tag: 'Two-step anthems for the heartbroken.' },
        { id: 'pastel_phantom',  name: 'Pastel Phantom',           genre: 'synth',   tier: 1, draw: 50,  fee: 130, quality: 3, consistency: 'solid',   tag: 'Bedroom synthpop with a fog machine.' },
        { id: 'glitter_bandaid', name: 'Glitter Bandaid',          genre: 'pop',     tier: 1, draw: 60,  fee: 160, quality: 2, consistency: 'erratic', tag: 'Bubblegum hooks, chaotic live show.' },
        // Tier 2 — local headliners
        { id: 'neon_echoes',     name: 'Neon Echoes',              genre: 'synth',   tier: 2, draw: 150, fee: 450, quality: 3, consistency: 'solid',   tag: 'Retro-futurist synth heroes of the east side.' },
        { id: 'rust_bone',       name: 'Rust & Bone',              genre: 'metal',   tier: 2, draw: 200, fee: 750, quality: 4, consistency: 'solid',   tag: 'Riffs heavy enough to crack the foundation.' },
        { id: 'cassette_ghosts', name: 'Cassette Ghosts',          genre: 'indie',   tier: 2, draw: 130, fee: 380, quality: 3, consistency: 'steady',  tag: 'Lo-fi darlings of the college radio chart.' },
        { id: 'lil_overdraft',   name: "Lil' Overdraft",           genre: 'hiphop',  tier: 2, draw: 170, fee: 600, quality: 3, consistency: 'erratic', tag: 'Broke, brilliant and always late.' },
        { id: 'dirt_road',       name: 'Dirt Road Diplomats',      genre: 'country', tier: 2, draw: 110, fee: 320, quality: 4, consistency: 'steady',  tag: 'Fiddle-driven honky-tonk with tight harmonies.' },
        { id: 'paperboys',       name: 'The Midnight Paperboys',   genre: 'pop',     tier: 2, draw: 190, fee: 700, quality: 3, consistency: 'solid',   tag: 'Boy-band hooks with garage-band guitars.' },
        { id: 'bad_credit',      name: 'Bad Credit',               genre: 'punk',    tier: 2, draw: 140, fee: 420, quality: 3, consistency: 'erratic', tag: 'Pop-punk for people with student loans.' },
        { id: 'moss_choir',      name: 'Moss Choir',               genre: 'folk',    tier: 2, draw: 100, fee: 300, quality: 4, consistency: 'steady',  tag: 'Eight-part harmonies that make grown men cry.' },
        { id: 'velvet_undertow', name: 'Velvet Undertow',          genre: 'jazz',    tier: 2, draw: 105, fee: 400, quality: 4, consistency: 'steady',  tag: 'Smoky neo-soul with a killer horn section.' },
        { id: 'kilowatt_kids',   name: 'Kilowatt Kids',            genre: 'edm',     tier: 2, draw: 160, fee: 520, quality: 3, consistency: 'solid',   tag: 'Two brothers, four synths, one strobe light.' },
        // Tier 3 — regional acts
        { id: 'hollow_crown',    name: 'Hollow Crown',             genre: 'metal',   tier: 3, draw: 420, fee: 2400, quality: 4, consistency: 'solid',   tag: 'Regional thrash legends with a cult following.' },
        { id: 'glass_harbor',    name: 'Glass Harbor',             genre: 'indie',   tier: 3, draw: 300, fee: 1500, quality: 4, consistency: 'steady',  tag: 'Dreamy indie that blogs keep calling "next."' },
        { id: 'kid_afterglow',   name: 'Kid Afterglow',            genre: 'pop',     tier: 3, draw: 560, fee: 3400, quality: 3, consistency: 'erratic', tag: 'A viral hit and not much of a live show — yet.' },
        { id: 'copper_cartel',   name: 'The Copper Cartel',        genre: 'country', tier: 3, draw: 260, fee: 1200, quality: 4, consistency: 'steady',  tag: 'Outlaw country with slide guitar to spare.' },
        { id: 'sector_seven',    name: 'Sector Seven Sound System', genre: 'edm',    tier: 3, draw: 480, fee: 2800, quality: 3, consistency: 'solid',   tag: 'Warehouse-rave collective with a light show.' },
        { id: 'marisol',         name: 'Marisol & the Night Shift', genre: 'jazz',   tier: 3, draw: 280, fee: 1600, quality: 5, consistency: 'steady',  tag: 'A once-in-a-generation voice. Bring tissues.' },
        { id: 'riot_permit',     name: 'Riot Permit',              genre: 'punk',    tier: 3, draw: 350, fee: 1800, quality: 4, consistency: 'erratic', tag: 'Political hardcore. Pits guaranteed.' },
        { id: 'chrome_valentine', name: 'Chrome Valentine',        genre: 'synth',   tier: 3, draw: 400, fee: 2200, quality: 4, consistency: 'solid',   tag: 'Dark synth duo in matching leather jackets.' },
        { id: 'sable_kingdom',   name: 'Sable Kingdom',            genre: 'hiphop',  tier: 3, draw: 450, fee: 2600, quality: 4, consistency: 'erratic', tag: 'Conscious rap crew with a live band.' },
        { id: 'lantern_folk',    name: 'The Lantern Folk',         genre: 'folk',    tier: 3, draw: 250, fee: 1300, quality: 4, consistency: 'steady',  tag: 'Stomp-clap folk built for singalongs.' },
        // Tier 4 — national club acts
        { id: 'paper_satellites', name: 'Paper Satellites',        genre: 'indie',   tier: 4, draw: 900,  fee: 8000,  quality: 4, consistency: 'solid',   tag: 'Festival-circuit indie with a hit single.' },
        { id: 'mc_overtime',     name: 'MC Overtime',              genre: 'hiphop',  tier: 4, draw: 1400, fee: 14000, quality: 4, consistency: 'erratic', tag: 'Chart-climbing MC with a famously wild show.' },
        { id: 'widows_peak',     name: "Widow's Peak",             genre: 'metal',   tier: 4, draw: 1100, fee: 10000, quality: 5, consistency: 'solid',   tag: 'Technical metal virtuosos. Tight as a drum.' },
        { id: 'lucid_arcade',    name: 'Lucid Arcade',             genre: 'synth',   tier: 4, draw: 1700, fee: 18000, quality: 4, consistency: 'solid',   tag: 'Synthwave stars with a laser-heavy production.' },
        { id: 'honeycomb_riot',  name: 'The Honeycomb Riot',       genre: 'punk',    tier: 4, draw: 750,  fee: 6000,  quality: 4, consistency: 'erratic', tag: 'Skate-punk veterans on a reunion tour.' },
        { id: 'golden_hour',     name: 'Golden Hour Radio',        genre: 'pop',     tier: 4, draw: 1300, fee: 13000, quality: 4, consistency: 'steady',  tag: 'Sunny indie-pop all over streaming playlists.' },
        { id: 'bluebird',        name: 'Bluebird Revival',         genre: 'country', tier: 4, draw: 800,  fee: 7000,  quality: 4, consistency: 'steady',  tag: 'Americana revival darlings.' },
        { id: 'low_tide',        name: 'Low Tide Quartet',         genre: 'jazz',    tier: 4, draw: 720,  fee: 6500,  quality: 5, consistency: 'steady',  tag: 'Grammy-nominated modern jazz.' },
        // Tier 5 — theater headliners
        { id: 'aurora_static',   name: 'Aurora Static',            genre: 'pop',     tier: 5, draw: 4200, fee: 75000, quality: 4, consistency: 'solid',   tag: 'Arena-ready pop on the way up.' },
        { id: 'saint_juniper',   name: 'Saint Juniper',            genre: 'folk',    tier: 5, draw: 2200, fee: 32000, quality: 5, consistency: 'steady',  tag: 'Hushed, devastating folk. Phones away, please.' },
        { id: 'black_lantern',   name: 'Black Lantern',            genre: 'metal',   tier: 5, draw: 3000, fee: 48000, quality: 5, consistency: 'solid',   tag: 'Pyro, corpse paint and perfect musicianship.' },
        { id: 'prism_choir',     name: 'Prism Choir',              genre: 'edm',     tier: 5, draw: 4800, fee: 88000, quality: 4, consistency: 'erratic', tag: 'Euphoric electronic with a 40-person choir.' },
        { id: 'yasmin_gold',     name: 'Yasmin Gold',              genre: 'jazz',    tier: 5, draw: 2600, fee: 40000, quality: 5, consistency: 'steady',  tag: 'Soul diva with a voice like warm honey.' },
        { id: 'crown_heights',   name: 'Crown Heights Cypher',     genre: 'hiphop',  tier: 5, draw: 3600, fee: 60000, quality: 4, consistency: 'erratic', tag: 'Five MCs, one turntablist, zero chill.' },
        { id: 'wreckless_hearts', name: 'The Wreckless Hearts',    genre: 'country', tier: 5, draw: 2800, fee: 45000, quality: 4, consistency: 'solid',   tag: 'Country-rock heartbreakers.' },
        // Tier 6 — festival headliners
        { id: 'thunder_orchard', name: 'Thunder Orchard',          genre: 'country', tier: 6, draw: 7000,  fee: 180000, quality: 5, consistency: 'steady',  tag: 'Stadium country with a fiddle section.' },
        { id: 'neon_cathedral',  name: 'Neon Cathedral',           genre: 'synth',   tier: 6, draw: 9500,  fee: 260000, quality: 5, consistency: 'solid',   tag: 'Synthwave gods. Their light rig has its own truck.' },
        { id: 'hollow_kings',    name: 'The Hollow Kings',         genre: 'indie',   tier: 6, draw: 12000, fee: 350000, quality: 4, consistency: 'solid',   tag: 'The biggest indie band of the decade.' },
        { id: 'lady_voltage',    name: 'Lady Voltage',             genre: 'pop',     tier: 6, draw: 14500, fee: 440000, quality: 5, consistency: 'erratic', tag: 'Pop provocateur. Every show is a headline.' },
        { id: 'concrete_saints', name: 'Concrete Saints',          genre: 'hiphop',  tier: 6, draw: 10500, fee: 300000, quality: 4, consistency: 'erratic', tag: 'Hip-hop supergroup reunion.' },
        { id: 'doomsday_parade', name: 'Doomsday Parade',          genre: 'metal',   tier: 6, draw: 8000,  fee: 210000, quality: 5, consistency: 'solid',   tag: 'Metal titans with flamethrowers.' },
        // Tier 7 — stadium superstars
        { id: 'starfall',        name: 'Starfall Empire',          genre: 'pop',     tier: 7, draw: 42000, fee: 1600000, quality: 5, consistency: 'solid',   tag: 'The biggest pop act on the planet.' },
        { id: 'ironclad',        name: 'IRONCLAD',                 genre: 'metal',   tier: 7, draw: 30000, fee: 1000000, quality: 5, consistency: 'steady',  tag: 'Forty years of heavy metal thunder.' },
        { id: 'midnight_monarchs', name: 'Midnight Monarchs',      genre: 'indie',   tier: 7, draw: 36000, fee: 1300000, quality: 5, consistency: 'solid',   tag: 'Anthemic rock that fills every seat.' },
        { id: 'echo_republic',   name: 'Echo Republic',            genre: 'edm',     tier: 7, draw: 48000, fee: 1900000, quality: 5, consistency: 'erratic', tag: 'Superstar DJs with a stadium-sized drop.' },
        { id: 'king_halcyon',    name: 'King Halcyon',             genre: 'hiphop',  tier: 7, draw: 40000, fee: 1500000, quality: 5, consistency: 'solid',   tag: 'Rap royalty on a farewell tour.' },
        { id: 'wildflower_revue', name: 'The Wildflower Revue',    genre: 'country', tier: 7, draw: 28000, fee: 950000,  quality: 5, consistency: 'steady',  tag: 'Country megastars and their 12-piece band.' }
    ],

    // How each slot on a three-band bill contributes.
    SLOTS: [
        // fee: share of the band's headline fee they ask for in this slot
        { id: 'opener',    label: 'Opener',    draw: 0.25, weight: 0.15, fee: 0.25 },
        { id: 'support',   label: 'Support',   draw: 0.50, weight: 0.25, fee: 0.50 },
        { id: 'headliner', label: 'Headliner', draw: 1.00, weight: 0.60, fee: 1.00 }
    ],
    CONSISTENCY: {
        steady:  { label: 'Steady',  sd: 0.35 },
        solid:   { label: 'Solid',   sd: 0.7 },
        erratic: { label: 'Erratic', sd: 1.3 }
    },

    // Genre chemistry: 1 = perfect bill, 0 = total clash.
    CHEMISTRY: {
        punk:    { punk: 1, metal: .8, indie: .8, synth: .4, edm: .3, hiphop: .4, pop: .4, country: .5, jazz: .1, folk: .4 },
        metal:   { metal: 1, indie: .4, synth: .3, edm: .3, hiphop: .4, pop: .1, country: .2, jazz: .1, folk: .2 },
        indie:   { indie: 1, synth: .7, edm: .5, hiphop: .5, pop: .8, country: .6, jazz: .5, folk: .9 },
        synth:   { synth: 1, edm: .9, hiphop: .5, pop: .8, country: .1, jazz: .4, folk: .2 },
        edm:     { edm: 1, hiphop: .8, pop: .8, country: .2, jazz: .3, folk: .1 },
        hiphop:  { hiphop: 1, pop: .7, country: .2, jazz: .8, folk: .2 },
        pop:     { pop: 1, country: .6, jazz: .4, folk: .5 },
        country: { country: 1, jazz: .4, folk: .9 },
        jazz:    { jazz: 1, folk: .7 },
        folk:    { folk: 1 }
    },

    // Always available so you can never get stuck with no act to book.
    OPEN_MIC: { id: 'open_mic', name: 'Open Mic Night', genre: 'folk', tier: 1, draw: 45, fee: 0, quality: 2, consistency: 'erratic', openMic: true, tag: 'Sign-up sheet at the bar. Anything can happen.' },

    REVIEW_OUTLETS: ['The Underground Zine', 'Static Weekly', 'Loud City Blog', 'The Setlist', 'Night Owl Gazette', 'Pitchfork & Pint'],

    /* ---------------------------------------------------------------
       PRE-SHOW EVENTS
       Effects: cash, rep, hype (future turnout %), vibe (tonight's crowd).
       Cash values are multiplied by the venue's event scale.
       `when` optionally limits an event to certain situations.
       --------------------------------------------------------------- */
    EVENTS: [
        { id: 'noise', title: 'City Noise Complaint', art: 'event',
          desc: 'Neighbors on the block filed a noise petition against your venue.',
          choices: [
              { text: 'Pay the noise fine', effects: { cash: -200 } },
              { text: 'Turn the limiter down tonight', effects: { vibe: -6 } }
          ] },
        { id: 'van', title: 'Gear Van Breakdown', art: 'event',
          desc: "Tonight's band blew a transmission two towns over.",
          choices: [
              { text: 'Pay for a tow & rental van', effects: { cash: -250 } },
              { text: 'Let them roll in late', effects: { hype: -10, vibe: -4 } }
          ] },
        { id: 'blogger', title: 'Underground Music Blogger', art: 'event',
          desc: 'An influential local zine writer is scouting your venue tonight.',
          choices: [
              { text: 'Comp VIP drinks & a guest list spot', effects: { cash: -80, hype: 12, rep: 1 } },
              { text: 'Treat them like a regular fan', effects: { chance: 0.5, win: { hype: 6, note: 'They loved the room anyway.' }, lose: { note: 'They left before the headliner.' } } }
          ] },
        { id: 'marshal', title: 'Fire Marshal Walkthrough', art: 'event',
          desc: 'The fire marshal wants a surprise look at your floor plan and exits.',
          choices: [
              { text: 'Give them the full tour', effects: { rep: 1, note: 'Everything up to code. Certificate renewed.' } },
              { text: "Slip them a 'donation'", effects: { cash: -300, chance: 0.6, win: { note: 'Envelope accepted. Nobody saw anything.' }, lose: { rep: -3, note: 'It was a sting. The local paper ran the story.' } } }
          ] },
        { id: 'distributor', title: 'Beer Distributor Offer', art: 'event',
          desc: 'A macro-brew distributor offers cash to make their lager your only draft.',
          choices: [
              { text: 'Take the deal', effects: { cash: 600, vibe: -3, note: 'Regulars grumble about the beer.' } },
              { text: 'Keep the local craft taps', effects: { rep: 1 } }
          ] },
        { id: 'radio', title: 'College Radio Shout-Out', art: 'event',
          desc: 'The college station offers an on-air spot plugging tonight\'s show.',
          choices: [
              { text: 'Buy the on-air spot', effects: { cash: -300, hype: 15 } },
              { text: 'Pass', effects: {} }
          ] },
        { id: 'cooler', title: 'Broken Bar Cooler', art: 'event',
          desc: 'The walk-in cooler died overnight. Warm beer is a crime.',
          choices: [
              { text: 'Emergency repair', effects: { cash: -350 } },
              { text: 'Serve it warm', effects: { vibe: -8 } }
          ] },
        { id: 'rider', title: 'Rider Dispute', art: 'event',
          desc: 'The headliner\'s manager says the green room spread is "insulting."',
          choices: [
              { text: 'Upgrade the catering', effects: { cash: -200, vibe: 3, note: 'Happy band, better set.' } },
              { text: 'Hold firm', effects: { vibe: -6, note: 'The band plays a sulky, short set.' } }
          ] },
        { id: 'viral', title: 'Your Venue Went Viral', art: 'event',
          desc: 'A clip from last week\'s show is blowing up online.',
          choices: [
              { text: 'Boost the post', effects: { cash: -150, hype: 20 } },
              { text: 'Let it ride', effects: { hype: 8 } }
          ] },
        { id: 'scalpers', title: 'Ticket Scalpers Outside', art: 'event',
          desc: 'Scalpers are selling fake tickets on the sidewalk.',
          choices: [
              { text: 'Hire extra door staff', effects: { cash: -150, rep: 1 } },
              { text: 'Ignore them', effects: { rep: -1, hype: -5 } }
          ] },
        { id: 'sick', title: 'Bartender Calls In Sick', art: 'event',
          desc: 'Your best bartender has the flu. Friday-night levels of thirsty incoming.',
          choices: [
              { text: 'Pay a temp double-time', effects: { cash: -120 } },
              { text: 'Run short-staffed', effects: { vibe: -5 } }
          ] },
        { id: 'theft', title: 'Gear Stolen From Loading Dock', art: 'event',
          desc: 'Somebody walked off with the house mics and a snake cable.',
          choices: [
              { text: 'Rent replacements', effects: { cash: -300 } },
              { text: 'Make do with the backups', effects: { vibe: -6 } }
          ] },
        { id: 'sponsor', title: 'Energy Drink Sponsorship', art: 'event',
          desc: 'A neon-green energy drink brand wants banners on your stage.',
          choices: [
              { text: 'Take the money', effects: { cash: 400, rep: -1, note: "Some fans call you a sellout." } },
              { text: 'Keep it DIY', effects: { rep: 1 } }
          ] },
        { id: 'bandmate', title: 'Old Bandmate Drops By', art: 'event',
          desc: 'Your ex-drummer wants to play a surprise opening set for free.',
          choices: [
              { text: 'Let them open', effects: { chance: 0.6, win: { vibe: 5, hype: 4, note: 'The reunion set brought the house down.' }, lose: { vibe: -3, note: 'Rusty. Very rusty.' } } },
              { text: 'Politely decline', effects: {} }
          ] },
        { id: 'storm', title: 'Thunderstorm Warning', art: 'event', when: 'outdoor',
          desc: 'A storm cell is rolling toward the amphitheater.',
          choices: [
              { text: 'Rent tents & sell ponchos', effects: { cash: -400, vibe: 2 } },
              { text: 'Hope it misses', effects: { chance: 0.5, win: { note: 'Clear skies. Lucky.' }, lose: { hype: -15, vibe: -8, note: 'Soaked crowd. Half went home.' } } }
          ] },
        { id: 'health', title: 'Health Inspector', art: 'event', when: 'bar',
          desc: 'The county health inspector is at the bar asking about your ice machine.',
          choices: [
              { text: 'Deep-clean before doors', effects: { cash: -100, rep: 1 } },
              { text: 'Wing it', effects: { chance: 0.6, win: { note: 'Passed with a B. Good enough.' }, lose: { cash: -500, note: 'Fined for the ice machine. Gross.' } } }
          ] }
    ],

    /* ---------------------------------------------------------------
       LIVE-SHOW CRISES — the show pauses until you decide.
       --------------------------------------------------------------- */
    CRISES: [
        { id: 'mosh', title: 'Mosh Pit Brawl', weight: 'aggression',
          desc: 'A shoving match near the barrier is turning into a real fight.',
          choices: [
              { text: 'Send security in', key: 'security' },
              { text: 'Let them sort it out', effects: { vibe: -8, chance: 0.3, lose: { rep: -1, note: 'Someone filmed it. Bad look.' } } }
          ] },
        { id: 'surfer', title: 'Crowd Surfer Down', weight: 'aggression',
          desc: 'A crowd surfer hit the floor hard near the stage.',
          choices: [
              { text: 'Call EMTs & comp their ticket', effects: { cash: -150, rep: 1, note: 'Handled with care. The crowd cheered.' } },
              { text: 'Keep the show going', effects: { chance: 0.6, win: { vibe: -2, note: 'They walked it off.' }, lose: { cash: -1500, rep: -2, note: 'Their lawyer called the next morning.' } } }
          ] },
        { id: 'power', title: 'Breaker Blown', weight: 'base',
          desc: 'Half the stage just went dark. The amps are dead.',
          choices: [
              { text: 'Pay the emergency electrician', effects: { cash: -250, vibe: -2 } },
              { text: 'Unplugged sing-along while you fix it', effects: { chance: 0.5, win: { vibe: 8, note: 'A magical acoustic moment. Phones in the air.' }, lose: { vibe: -10, note: 'Awkward silence. People drift to the bar.' } } }
          ] },
        { id: 'feedback', title: 'Monitor Feedback Squeal', weight: 'sound',
          desc: 'A piercing squeal rips through the speakers mid-song.',
          choices: [
              { text: 'Rent a backup console', effects: { cash: -200 } },
              { text: 'Push through it', effects: { vibe: -7 } }
          ] },
        { id: 'overcrowd', title: 'Line Around the Block', weight: 'full',
          desc: "The room is at legal capacity and there's still a line outside.",
          choices: [
              { text: 'Close the doors', effects: { rep: 1, note: 'Fire code respected. The line goes home.' } },
              { text: 'Squeeze a few more in', effects: { ticketBonus: 0.06, chance: 0.65, win: { note: 'Sweaty but fine.' }, lose: { cash: -2000, rep: -2.5, note: 'Fire marshal walked in. Massive fine.' } } }
          ] },
        { id: 'bar_rush', title: 'Bar Is Slammed', weight: 'bar',
          desc: 'The bar line is 40 deep and people are getting cranky.',
          choices: [
              { text: 'Call in an extra bartender', effects: { cash: -150, barBonus: 0.08 } },
              { text: 'Switch to cans only', effects: { vibe: -5 } }
          ] },
        { id: 'fake_ids', title: 'Fake IDs at the Bar', weight: 'bar',
          desc: 'Your bartender thinks half the line is using fake IDs.',
          choices: [
              { text: 'Card everyone strictly', effects: { barBonus: -0.08 } },
              { text: 'Look the other way', effects: { chance: 0.75, win: { note: 'Nobody noticed.' }, lose: { cash: -2500, rep: -2.5, note: 'Liquor board sting. Huge fine.' } } }
          ] },
        { id: 'guest', title: 'Surprise Guest', weight: 'base',
          desc: 'A famous musician in the crowd wants to jump on stage for a song.',
          choices: [
              { text: 'Bring them up!', effects: { chance: 0.6, win: { vibe: 10, hype: 8, note: 'The crowd lost its mind. This will be on every feed.' }, lose: { vibe: -4, note: "They didn't know the song." } } },
              { text: 'Stick to the setlist', effects: {} }
          ] }
    ]
};

// Helper used above to lay out blocks of theater seats.
function seatBlock(r0, r1, c0, c1) {
    const out = [];
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) out.push({ type: 'seating', r, c, w: 1, h: 1 });
    }
    return out;
}

if (typeof module !== 'undefined') module.exports = DATA;
