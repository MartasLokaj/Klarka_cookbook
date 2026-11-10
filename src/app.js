/* =====================================================================
   App settings
   ===================================================================== */
const TAGS = { 'vegetarian':'Vegetarian', 'vegan':'Vegan', 'gluten-free':'Gluten-free', 'high-protein':'High-protein', 'low-calorie':'Low-calorie', 'low-carb':'Low-carb', 'keto':'Keto' };
// How each diet tag is worked out from a serving (n = nutrition, f = flags of the ingredients)
const TAG_RULES = {
  'vegetarian':   (n, f) => !f.has('meat') && !f.has('fish'),
  'vegan':        (n, f) => !['meat', 'fish', 'egg', 'dairy', 'honey'].some(x => f.has(x)),
  'gluten-free':  (n, f) => !f.has('gluten'),
  'high-protein': n => n.p >= 20 && n.p * 4 / n.kcal >= 0.2,
  'low-calorie':  n => n.kcal <= 400,
  'low-carb':     n => n.c <= 20,
  'keto':         n => n.c <= 10 && n.f * 9 / n.kcal >= 0.6,
};
const REASON = { 'low-calorie':'a serving would go over 400 kcal', 'low-carb':'a serving would go over 20 g of carbs', 'keto':'it would no longer be keto', 'high-protein':'it would no longer be high-protein' };
const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'high-protein', 'low-calorie', 'low-carb', 'keto'];
const MEALS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' };
const DIFFICULTY = { easy:'Easy', medium:'Medium', hard:'Hard' };
const TAN = '#EADFCB';   // background behind the dish drawings (matches --tan)
const HERO_DISHES = ['smoothie-bowl', 'quinoa-bowl', 'greek-salad', 'salmon-poke', 'yogurt-bowl', 'chickpea-curry'];

const ACTIVITY = [
  { id:'sedentary', name:'Sedentary',  k:1.2,   desc:'You sit most of the day and hardly exercise.' },
  { id:'light',     name:'Light',      k:1.375, desc:'You walk a lot or do light exercise 1–3 times a week.' },
  { id:'moderate',  name:'Moderate',   k:1.55,  desc:'You exercise or play sport 3–5 times a week.' },
  { id:'high',      name:'High',       k:1.725, desc:'You train hard 6–7 times a week.' },
  { id:'very-high', name:'Very high',  k:1.9,   desc:'You do physical work or train twice a day.' },
];
const GOALS = [
  { id:'lose',     name:'Lose weight',     adj:-500 },
  { id:'maintain', name:'Maintain weight', adj:0 },
  { id:'gain',     name:'Gain weight',     adj:300 },
  { id:'muscle',   name:'Build muscle',    adj:250 },
];
const STYLES = [
  { id:'balanced',     name:'Balanced',     desc:'Protein 25% · carbs 45% · fat 30%' },
  { id:'high-protein', name:'High-protein', desc:'Protein 2 g per kg of body weight · fat 25% · carbs make up the rest' },
  { id:'low-carb',     name:'Low-carb',     desc:'Protein 30% · carbs 20% · fat 50%' },
  { id:'keto',         name:'Keto',         desc:'Protein 25% · carbs 5% · fat 70%' },
  { id:'vegetarian',   name:'Vegetarian',   desc:'Same as balanced, without meat or fish add-ons' },
];
const SPLIT = {
  3: [['Breakfast',.30],['Lunch',.40],['Dinner',.30]],
  4: [['Breakfast',.25],['Lunch',.35],['Snack',.15],['Dinner',.25]],
};
const SAMPLE = { sex:'male', age:'30', height:'180', weight:'80', activity:'moderate', goal:'lose', style:'balanced' };
const EMPTY_FORM = { sex:'', age:'', height:'', weight:'', activity:'moderate', goal:'maintain', style:'balanced' };
const CTA_RECIPE = 'scrambled-eggs';   // “What should I eat?” in the calculator opens this recipe

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const NB = ' ';
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits:0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits:1 });
const fmt = n => nf0.format(Math.round(n));
const kcal = n => fmt(n) + NB + 'kcal';
const grams = n => nf1.format(n) + NB + 'g';
const pct = n => Math.round(n) + NB + '%';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, many) => n === 1 ? one : many;
function listText(arr, word = 'and') {
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' ' + word + ' ' + arr[arr.length - 1];
}
function qtyText(q) {
  const whole = Math.floor(q), rest = q - whole;
  if (Math.abs(rest - 0.5) < 1e-9) return (whole ? whole : '') + '½';
  return nf1.format(q);
}

INGREDIENTS.forEach(i => { i.nameN = norm(i.name); i.aliasesN = i.aliases.map(norm); });
const ING = {};
INGREDIENTS.forEach(i => { ING[i.id] = i; });
const ALIAS = new Map();
INGREDIENTS.forEach(i => [i.nameN, ...i.aliasesN].forEach(a => { if (!ALIAS.has(a)) ALIAS.set(a, i.id); }));
const PANTRY = new Set(INGREDIENTS.filter(i => i.pantry).map(i => i.id));
const IN_RECIPES = new Set();
RECIPES.forEach(r => {
  r.ingredients.forEach(x => { IN_RECIPES.add(x.ing); (x.swaps || []).forEach(s => IN_RECIPES.add(s.ing)); });
  r.addons.forEach(a => IN_RECIPES.add(a.ing));
});
const ingName = id => ING[id] ? ING[id].name : id;
const recipeById = id => RECIPES.find(r => r.id === id);

/** Text → ingredient id (lower case, no accents, synonyms). Unknown → null. */
function recognize(text) {
  const n = norm(text);
  if (!n) return null;
  if (ALIAS.has(n)) return ALIAS.get(n);
  const words = n.split(' ');
  for (let i = words.length - 1; i >= 0; i--) if (ALIAS.has(words[i])) return ALIAS.get(words[i]);
  return null;
}

const svg = (p, sw = 1.9, fill = 'none') => `<svg viewBox="0 0 24 24" width="22" height="22" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const HEART = '<path d="M12 20.3l-1.3-1.2C5.9 14.8 3 12.1 3 8.6 3 5.9 5.1 3.8 7.7 3.8c1.6 0 3.2.8 4.3 2.1 1.1-1.3 2.7-2.1 4.3-2.1 2.6 0 4.7 2.1 4.7 4.8 0 3.5-2.9 6.2-7.7 10.5z"/>';
const ICON = {
  home:   svg('<path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>'),
  fridge: svg('<rect x="5" y="2.5" width="14" height="19" rx="2.6"/><path d="M5 10h14M9 5.6v2M9 13v3.2"/>'),
  book:   svg('<path d="M12 6.6C10 5 7 4.5 3.5 5v13.2c3.5-.5 6.5 0 8.5 1.6 2-1.6 5-2.1 8.5-1.6V5C17 4.5 14 5 12 6.6z"/><path d="M12 6.6v13.2"/>'),
  heart:  svg(HEART),
  heartFill: svg(HEART, 1.9, 'currentColor'),
  bolt:   svg('<path d="M13.5 2.5L4.5 13.5H11l-1 8 9-11h-6.5z"/>'),
  calc:   svg('<rect x="5" y="2.5" width="14" height="19" rx="2.6"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.6 13.2h.01M12 13.2h.01M15.4 13.2h.01M8.6 16.8h.01M12 16.8h.01M15.4 16.8h.01" stroke-width="2.6"/>'),
  user:   svg('<circle cx="12" cy="8.3" r="3.8"/><path d="M4.5 20.5c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/>'),
  target: svg('<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', 2.1),
  clock:  svg('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5V12l3 2"/>'),
  hat:    svg('<path d="M7 15.5a4 4 0 1 1 1.6-7.6 3.8 3.8 0 0 1 6.8 0A4 4 0 1 1 17 15.5V20H7z"/><path d="M7 17h10"/>'),
  x:      svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 2.2),
  arrow:  svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.2),
  chev:   svg('<path d="M9 6l6 6-6 6"/>', 2.2),
  back:   svg('<path d="M19 12H5M11 6l-6 6 6 6"/>', 2.2),
  dice:   svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/>'),
  tick:   svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  info:   svg('<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5M12 7.8h.01"/>', 2),
  alert:  svg('<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.2M12 17h.01"/>', 2),
  bulb:   svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  camera: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>'),
  trash:  svg('<path d="M5 7h14M10 7V4.8h4V7M7 7l1 12.2h8L17 7"/>'),
  leaf:   svg('<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19l8-8"/>', 2),
};
const LEAF = c => `<svg class="leaf ${c}" viewBox="0 0 44 26" aria-hidden="true"><path d="M2 13C11 1 31 1 42 13C31 25 11 25 2 13Z" fill="#4E8A38"/><path d="M5 13H39" stroke="#7DB25C" stroke-width="1.6" fill="none"/></svg>`;
const NAV = [
  { id:'home',       short:'Home',        long:'Home',                    tab:'Home',       icon:'home' },
  { id:'kitchen',    short:'Kitchen',     long:'What’s in your kitchen?', tab:'Kitchen',    icon:'fridge' },
  { id:'recipes',    short:'Recipes',     long:'Recipes',                 tab:'Recipes',    icon:'book' },
  { id:'favorites',  short:'Favorites',   long:'Favorite recipes',        tab:'Favorites',  icon:'heart' },
  { id:'quick',      short:'Quick meals', long:'Quick meals',             tab:'Quick',      icon:'bolt' },
  { id:'calculator', short:'Calculator',  long:'Calculator',              tab:'Calculator', icon:'calc' },
];
const VIEWS = ['home', 'kitchen', 'results', 'recipes', 'favorites', 'quick', 'calculator', 'account'];
const QUICK_BTNS = [['eggs','🥚'],['butter','🧈'],['milk','🥛'],['cheese','🧀'],['ham','🥩'],['bread','🍞'],['spinach','🥬'],['onion','🧅']];
const QUICK_TIMES = [5, 15, 30];

/* =====================================================================
   Dish pictures: drawn on demand, one at a time, then cached
   ===================================================================== */
const dishURL = {}, dishWait = {}, dishQueue = [];
let dishBusy = false;
function dishKey(id, cut) { return id + (cut ? ':cut' : ''); }
function requestDish(id, cut) {
  const k = dishKey(id, cut);
  if (!dishWait[k]) dishWait[k] = new Promise(res => { dishQueue.push({ id, cut, res }); pumpDishes(); });
  return dishWait[k];
}
function pumpDishes() {
  if (dishBusy || !dishQueue.length) return;
  dishBusy = true;
  setTimeout(() => {
    const job = dishQueue.shift();
    const type = job.cut ? 'image/png' : 'image/jpeg', bg = job.cut ? null : TAN;
    let url = '';
    for (const px of job.cut ? [560, 360] : [640, 400]) {
      try { url = DishArt.render(job.id, px, bg, type, 0.86); if (url && url.length > 100) break; } catch (e) { url = ''; if (window.console) console.warn('Dish drawing failed', job.id, px, e); }
    }
    dishURL[dishKey(job.id, job.cut)] = url;
    job.res(url);
    dishBusy = false;
    pumpDishes();
  }, 0);
}
/** <img> for a recipe: the real photo if there is one, otherwise the drawing. */
function dishImg(id, { cut = false, cls = '', alt = '' } = {}) {
  const r = recipeById(id), src = r && photoSrc(r);
  if (src && !cut) return `<img class="photo ${cls}" src="${esc(src)}" alt="${esc(photoAlt(r))}" loading="lazy" decoding="async">`;
  return `<img class="dish ${cls}" data-dish="${id}"${cut ? ' data-cut="1"' : ''} alt="${esc(alt)}">`;
}
/** Fills every drawing placeholder: straight away when it’s already drawn, otherwise when it’s ready. */
function hydrate(root = document) {
  $$('img[data-dish]', root).forEach(img => {
    if (img.classList.contains('ready')) return;
    const id = img.dataset.dish, cut = img.dataset.cut === '1', k = dishKey(id, cut);
    const show = url => { if (url) { img.src = url; img.classList.add('ready'); } else img.classList.add('failed'); };
    if (dishURL[k] !== undefined) show(dishURL[k]); else requestDish(id, cut).then(show);
  });
}

/* =====================================================================
   App state (+ localStorage for settings, favourites and photos)
   ===================================================================== */
const KEY = 'cookbook-v2', PHOTO_KEY = 'cookbook-photos-v2';
const state = {
  view: 'home',
  kitchen: [],
  sugg: { items:[], active:-1 },
  flashKey: null,
  findMsg: '',
  diets: new Set(),
  favorites: [],
  detail: null,             // { id, servings, addons:Set, origin:{}, steps:Set, from }
  form: Object.assign({}, EMPTY_FORM),
  meals: 3,
  photos: {},
  photoMsg: '',
  search: '',
  mealFilter: 'all',
  quickMax: 15,
  accountTab: 'login',
  accountEmail: '',
  accountMsg: '',
};
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ form:state.form, meals:state.meals, diets:[...state.diets], favorites:state.favorites, quickMax:state.quickMax })); } catch (e) { /* works without storage */ }
}
function migrateOld() {
  try {
    const o = JSON.parse(localStorage.getItem('cookbook-prototyp-v1') || 'null');
    if (!o || typeof o !== 'object') return null;
    const f = o.form || {};
    const pick = (v, m, d) => (typeof v === 'string' && m[v]) ? m[v] : d;
    return {
      form: {
        sex: pick(f.pohlavi, { muz:'male', zena:'female' }, ''),
        age: typeof f.vek === 'string' ? f.vek : '', height: typeof f.vyska === 'string' ? f.vyska : '', weight: typeof f.vaha === 'string' ? f.vaha : '',
        activity: pick(f.aktivita, { sedava:'sedentary', lehka:'light', stredni:'moderate', vysoka:'high', 'velmi-vysoka':'very-high' }, 'moderate'),
        goal: pick(f.cil, { zhubnout:'lose', udrzet:'maintain', pribrat:'gain', svaly:'muscle' }, 'maintain'),
        style: pick(f.styl, { vyvazena:'balanced', vysokoproteinova:'high-protein', 'low-carb':'low-carb', keto:'keto', vegetarianska:'vegetarian' }, 'balanced'),
      },
      meals: o.jidla,
      diets: (Array.isArray(o.diety) ? o.diety : []).map(x => ({ vegetarianske:'vegetarian', veganske:'vegan', bezlepkove:'gluten-free', 'bohate-na-bilkoviny':'high-protein', nizkokaloricke:'low-calorie', 'low-carb':'low-carb', keto:'keto' })[x]).filter(Boolean),
    };
  } catch (e) { return null; }
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ignore */ }
  if (!d) d = migrateOld();
  if (d && typeof d === 'object') {
    if (d.form && typeof d.form === 'object') Object.keys(EMPTY_FORM).forEach(k => { if (typeof d.form[k] === 'string') state.form[k] = d.form[k]; });
    if (d.meals === 3 || d.meals === 4) state.meals = d.meals;
    if (Array.isArray(d.diets)) d.diets.forEach(x => { if (DIETS.indexOf(x) >= 0) state.diets.add(x); });
    if (Array.isArray(d.favorites)) d.favorites.forEach(x => { if (recipeById(x) && state.favorites.indexOf(x) < 0) state.favorites.push(x); });
    if (QUICK_TIMES.indexOf(d.quickMax) >= 0) state.quickMax = d.quickMax;
  }
  try {
    let p = JSON.parse(localStorage.getItem(PHOTO_KEY) || 'null');
    if (!p) { const old = JSON.parse(localStorage.getItem('cookbook-fotky-v1') || 'null'); if (old && old['michana-vajicka']) p = { 'scrambled-eggs': old['michana-vajicka'] }; }
    if (p && typeof p === 'object') Object.keys(p).forEach(k => { if (recipeById(k) && typeof p[k] === 'string' && p[k].indexOf('data:image/') === 0) state.photos[k] = p[k]; });
  } catch (e) { /* ignore */ }
}
function savePhotos() { try { localStorage.setItem(PHOTO_KEY, JSON.stringify(state.photos)); return true; } catch (e) { return false; } }
const photoSrc = r => state.photos[r.id] || (r.photo && r.photo.src) || null;
const photoAlt = r => (r.photo && r.photo.alt) || r.name;
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const max = 1400, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
function announce(msg) { const l = $('#live'); if (!l) return; l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); }
const isFav = id => state.favorites.indexOf(id) >= 0;

/* =====================================================================
   Logic: nutrition, diet tags and matching
   ===================================================================== */
const keyOf = it => it.id || ('x:' + norm(it.label));
function addItem(text) {
  const label = String(text).replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
  if (!norm(label)) return false;
  const it = { label, id: recognize(label) };
  const exist = state.kitchen.find(x => keyOf(x) === keyOf(it));
  if (exist) { state.flashKey = keyOf(exist); return false; }
  state.kitchen.push(it);
  return true;
}
function haveSet() { return new Set([...state.kitchen.map(i => i.id).filter(Boolean), ...PANTRY]); }
const isVegStyle = () => state.form.style === 'vegetarian';

/** Nutrition of one serving: the recipe’s ingredients plus the selected add-ons. */
function nutrition(r, sel) {
  const n = { kcal:0, p:0, c:0, f:0, flags:new Set() };
  const addFood = x => {
    const v = FOOD[x.food || x.ing], g = x.g || 0;
    if (!v || !g) return;
    n.kcal += v[0] * g / 100; n.p += v[1] * g / 100; n.c += v[2] * g / 100; n.f += v[3] * g / 100;
    v.slice(4).forEach(fl => n.flags.add(fl));
  };
  r.ingredients.forEach(addFood);
  r.addons.forEach(a => { if (sel.has(a.id)) addFood(a); });
  return n;
}
function recipeTags(r, sel) { const n = nutrition(r, sel); return DIETS.filter(t => TAG_RULES[t](n, n.flags)); }
const isMeaty = a => { const v = FOOD[a.food || a.ing] || []; return v.indexOf('meat') >= 4 || v.indexOf('fish') >= 4; };
/** Does the base version of the recipe fit every selected diet? */
function fitsDiets(r, diets) { const t = recipeTags(r, new Set()); return [...diets].every(d => t.indexOf(d) >= 0); }
/** Clash between an add-on and the diets the recipe fits. hide = never fits; otherwise it can’t be added on top of what’s ticked. */
function addonConflict(r, sel, a, diets) {
  if (!diets.size) return null;
  const base = recipeTags(r, new Set());
  const relevant = [...diets].filter(d => base.indexOf(d) >= 0);
  if (!relevant.length) return null;
  const alone = recipeTags(r, new Set([a.id]));
  const never = relevant.filter(d => alone.indexOf(d) < 0);
  if (never.length) return { hide: true, reasons: never.map(d => TAGS[d].toLowerCase()) };
  if (!sel.has(a.id)) {
    const withSel = recipeTags(r, new Set([...sel, a.id]));
    const now = relevant.filter(d => withSel.indexOf(d) < 0);
    if (now.length) return { hide: false, reasons: now.map(d => REASON[d] || 'it would no longer be ' + TAGS[d].toLowerCase()) };
  }
  return null;
}
function pickAddons(r, candidates, start, veg) {
  const sel = new Set(start);
  r.addons.forEach(a => {
    if (!candidates.has(a.id) || sel.has(a.id) || (veg && isMeaty(a))) return;
    if (addonConflict(r, sel, a, state.diets)) return;
    sel.add(a.id);
  });
  return sel;
}
/** null when a required ingredient is missing. Otherwise match %, what is missing and what else you’ll use. */
function match(r, have) {
  let total = 0, got = 0;
  const missing = [];
  for (const x of r.ingredients) {
    if (x.role === 'required') {
      total += x.w;
      if (!have.has(x.ing)) return null;
      got += x.w;
    } else if (x.role === 'swap' || x.role === 'core') {
      total += x.w;
      const opts = [x.ing, ...(x.swaps || []).map(s => s.ing)];
      if (opts.some(o => have.has(o))) got += x.w;
      else missing.push(opts.map(ingName).join(' or '));
    }
  }
  const veg = isVegStyle();
  const alsoUse = [
    ...r.ingredients.filter(x => x.role === 'optional' && have.has(x.ing)).map(x => ingName(x.ing)),
    ...r.addons.filter(a => have.has(a.ing) && !(veg && isMeaty(a)) && !addonConflict(r, new Set(), a, state.diets)).map(a => a.short),
  ];
  return { pct: Math.round(got / total * 100), missing, alsoUse: [...new Set(alsoUse)] };
}
function recommendation(r, p) {
  const add = new Set(), drop = new Set(), adv = r.advice || {};
  const g = adv.goal && adv.goal[p.goal], s = adv.style && adv.style[p.style];
  [g, s].forEach(x => { if (!x) return; (x.add || []).forEach(a => add.add(a)); (x.drop || []).forEach(a => drop.add(a)); });
  drop.forEach(a => add.delete(a));
  const allowed = pickAddons(r, add, new Set(), p.style === 'vegetarian');
  return { add: [...allowed], drop: [...drop].filter(a => r.addons.some(x => x.id === a)) };
}
function recText(r, rec) {
  const find = id => r.addons.find(a => a.id === id);
  return [...rec.add.map(id => '+ ' + find(id).short), ...rec.drop.map(id => find(id).without)].join(', ');
}
const tagHtml = t => state.diets.has(t) ? `<li class="tag on">${ICON.tick}${TAGS[t]}</li>` : `<li class="tag">${TAGS[t]}</li>`;
const mealText = r => r.meals.map(m => MEALS[m]).join(' · ');
function shortIngredients(r) {
  const names = r.ingredients.filter(x => x.role !== 'pantry').map(x => (x.name || ingName(x.ing)).replace(/\s*\(.*?\)/g, '').toLowerCase());
  return [...new Set(names)].join(', ');
}
function macrosHtml(n) {
  return `<dl class="macros"><div><dt>Calories</dt><dd>${fmt(n.kcal)}</dd></div><div><dt>Protein</dt><dd>${fmt(n.p)}g</dd></div><div><dt>Carbs</dt><dd>${fmt(n.c)}g</dd></div><div><dt>Fat</dt><dd>${fmt(n.f)}g</dd></div></dl>`;
}

/* =====================================================================
   Logic: calorie calculator
   ===================================================================== */
const LIMITS = {
  age:    [15, 100, 'Enter an age between 15 and 100.'],
  height: [120, 230, 'Enter your height in centimetres, from 120 to 230.'],
  weight: [35, 250, 'Enter your weight in kilograms, from 35 to 250.'],
};
const toNum = v => { const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : NaN; };
function fieldError(k) {
  const v = state.form[k];
  if (v === '') return '';
  const n = toNum(v), [a, b, msg] = LIMITS[k];
  return (isNaN(n) || n < a || n > b || !/^\s*\d+([.,]\d+)?\s*$/.test(v)) ? msg : '';
}
function profile() {
  const f = state.form;
  if (f.sex !== 'male' && f.sex !== 'female') return null;
  for (const k of ['age', 'height', 'weight']) if (f[k] === '' || fieldError(k)) return null;
  return { sex:f.sex, age:toNum(f.age), height:toNum(f.height), weight:toNum(f.weight), activity:f.activity, goal:f.goal, style:f.style };
}
function compute(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const act = ACTIVITY.find(a => a.id === p.activity) || ACTIVITY[2];
  const goal = GOALS.find(g => g.id === p.goal) || GOALS[1];
  const style = STYLES.find(s => s.id === p.style) || STYLES[0];
  const tdee = bmr * act.k;
  const raw = tdee + goal.adj;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const minimum = Math.max(bmr, floor);
  const clamped = raw < minimum;
  const target = Math.round(clamped ? minimum : raw);
  let pr, cb, ft, note = '';
  switch (p.style) {
    case 'high-protein':
      pr = 2 * p.weight; ft = 0.25 * target / 9; cb = (target - pr * 4 - ft * 9) / 4;
      if (cb < 0) { cb = 0; note = 'Protein and fat already cover your whole daily target, so there’s nothing left for carbs.'; }
      break;
    case 'low-carb': pr = .30 * target / 4; cb = .20 * target / 4; ft = .50 * target / 9; break;
    case 'keto':     pr = .25 * target / 4; cb = .05 * target / 4; ft = .70 * target / 9; break;
    default:         pr = .25 * target / 4; cb = .45 * target / 4; ft = .30 * target / 9;
  }
  return { bmr:Math.round(bmr), tdee:Math.round(tdee), raw:Math.round(raw), floor, reason: bmr >= floor ? 'bmr' : 'floor',
           clamped, kcal:target, p:Math.round(pr), c:Math.round(cb), f:Math.round(ft), act, goal, style, note };
}
const kText = k => '×' + k;

/* =====================================================================
   Navigation
   ===================================================================== */
function setHash(token, push) {
  try {
    if (location.hash === '#' + token) return;
    if (push) history.pushState(null, '', '#' + token); else history.replaceState(null, '', '#' + token);
  } catch (e) { /* ignore */ }
}
function go(view, opts = {}) {
  if (view === 'recipe' && !state.detail) view = 'recipes';
  if (view === 'results' && !state.kitchen.length) view = 'kitchen';
  if (VIEWS.indexOf(view) < 0 && view !== 'recipe') view = 'home';
  state.view = view;
  if (view !== 'kitchen') state.findMsg = '';
  if (view !== 'account') state.accountMsg = '';
  render();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  setHash(view === 'recipe' ? state.detail.id : view, opts.push !== false);
  if (opts.focus !== false) { const h = $('#app h1'); if (h) { try { h.focus({ preventScroll:true }); } catch (e) { h.focus(); } } }
}
function openRecipe(id, { source = 'kitchen', from = 'recipes', push = true } = {}) {
  const r = recipeById(id);
  if (!r) return;
  const have = haveSet(), veg = isVegStyle(), p = profile();
  const fromGoal = source === 'goal' && p;
  const candidates = fromGoal
    ? new Set(recommendation(r, p).add)
    : new Set(state.kitchen.length ? r.addons.filter(a => have.has(a.ing)).map(a => a.id) : []);
  const addons = new Set(), origin = {};
  pickAddons(r, candidates, new Set(), veg).forEach(a => { addons.add(a); origin[a] = fromGoal ? 'goal' : 'kitchen'; });
  state.detail = { id, servings: r.servings, addons, origin, steps: new Set(), from };
  state.photoMsg = '';
  go('recipe', { push });
}
function sectionOf(v) {
  if (v === 'results') return 'kitchen';
  if (v === 'recipe') {
    const f = state.detail && state.detail.from;
    if (f === 'results') return 'kitchen';
    return NAV.some(n => n.id === f) ? f : 'recipes';
  }
  return v;
}
function updateNav() {
  const sec = sectionOf(state.view);
  $$('[data-navlink]').forEach(a => { if (a.dataset.navlink === sec) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const lb = $('#login-btn');
  if (state.view === 'account') lb.setAttribute('aria-current', 'page'); else lb.removeAttribute('aria-current');
}
function initNav() {
  $('#topnav').innerHTML = NAV.map(n => `<a href="#${n.id}" data-nav="${n.id}" data-navlink="${n.id}">${n.short === n.long ? n.short : `<span class="l-short">${n.short}</span><span class="l-long">${n.long}</span>`}</a>`).join('');
  $('#tabbar').innerHTML = NAV.map(n => `<li><a class="tab" href="#${n.id}" data-nav="${n.id}" data-navlink="${n.id}"><span class="ico">${ICON[n.icon]}</span><span class="tab-l">${n.tab}</span></a></li>`).join('');
  $('#login-btn').innerHTML = `${ICON.user}<span class="lb-txt">Log in</span>`;
  $$('.brand-mark').forEach(m => { m.innerHTML = ICON.leaf; });
}
function route() {
  const h = (location.hash || '').slice(1);
  if (recipeById(h)) {
    if (!(state.view === 'recipe' && state.detail && state.detail.id === h)) openRecipe(h, { from: 'recipes', push: false });
  } else {
    const v = VIEWS.indexOf(h) >= 0 ? h : 'home';
    if (state.view !== v) go(v, { push: false });
  }
}

/* =====================================================================
   Rendering
   ===================================================================== */
function render() {
  const app = $('#app'), v = state.view;
  const views = { home:viewHome, kitchen:viewKitchen, results:viewResults, recipes:viewRecipes, favorites:viewFavorites, quick:viewQuick, calculator:viewCalculator, account:viewAccount, recipe:viewRecipe };
  const html = (views[v] || viewHome)();
  app.innerHTML = v === 'home' ? html : `<div class="wrap page">${html}</div>`;
  app.dataset.view = v;
  updateNav();
  if (v === 'kitchen') { renderChips(); renderDietChips(); }
  if (v === 'recipes') { renderDietChips(); renderRecipeList(); }
  if (v === 'calculator') renderCalcOutput();
  hydrate(app);
}
function rerender() {
  const id = document.activeElement && document.activeElement.id;
  const old = state.view === 'recipe' ? $('#app .detail') : null;
  if (old && state.detail && old.dataset.recipe === state.detail.id) {
    const tpl = document.createElement('template');
    tpl.innerHTML = viewRecipe();
    ['#d-tags', '#d-macros', '#d-diet', '.d-grid'].forEach(sel => { const a = old.querySelector(sel), b = tpl.content.querySelector(sel); if (a && b) a.parentNode.replaceChild(b, a); });
  } else {
    render();
  }
  if (id) { const el = document.getElementById(id); if (el) { try { el.focus({ preventScroll:true }); } catch (e) { el.focus(); } } }
}

/* ---------- favourites & toast ---------- */
function favButton(id, pill) {
  const on = isFav(id);
  return `<button class="${pill ? 'fav-pill' : 'fav'}" type="button" data-fav="${id}"${pill ? ' data-pill="1"' : ''} aria-pressed="${on}" aria-label="Save to favorites">${on ? ICON.heartFill : ICON.heart}${pill ? `<span>${on ? 'Saved' : 'Save'}</span>` : ''}</button>`;
}
function syncFav(id) {
  $$(`[data-fav="${id}"]`).forEach(b => {
    const tmp = document.createElement('div');
    tmp.innerHTML = favButton(id, b.dataset.pill === '1');
    const nb = tmp.firstElementChild;
    b.setAttribute('aria-pressed', nb.getAttribute('aria-pressed'));
    b.innerHTML = nb.innerHTML;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  });
}
function toggleFav(id) {
  const r = recipeById(id);
  if (!r) return;
  const idx = state.favorites.indexOf(id);
  if (idx >= 0) state.favorites.splice(idx, 1); else state.favorites.push(id);
  save();
  if (state.view === 'favorites') {
    render();
    const h = $('#app h1'); if (h) { try { h.focus({ preventScroll:true }); } catch (e) { h.focus(); } }
  } else {
    syncFav(id);
  }
  if (idx >= 0) showToast(`${r.name} removed from favorites.`, { label:'Undo', act:'undo-fav', id, index: idx });
  else showToast(`${r.name} saved to favorites.`, state.view === 'favorites' ? null : { label:'View', act:'go-favorites' });
}
let toastTimer = null;
function showToast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" data-act="${action.act}"${action.id ? ` data-id="${action.id}"` : ''}${action.index != null ? ` data-index="${action.index}"` : ''}>${action.label}</button>` : ''}`;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}
function hideToast() {
  const t = $('#toast');
  t.classList.remove('show');
  setTimeout(() => { if (!t.classList.contains('show')) t.hidden = true; }, 220);
}

/* ---------- recipe card ---------- */
function dietNote(r) {
  if (!state.diets.size) return '';
  if (!fitsDiets(r, state.diets)) {
    const miss = [...state.diets].filter(d => !fitsDiets(r, new Set([d]))).map(d => TAGS[d].toLowerCase());
    return `<p class="diet-miss">Not ${esc(listText(miss))}.</p>`;
  }
  const hidden = r.addons.filter(a => (addonConflict(r, new Set(), a, state.diets) || {}).hide).map(a => a.without);
  return `<p class="diet-fit">Fits your diet${hidden.length ? ', ' + esc(hidden.join(', ')) : ''}.</p>`;
}
function card(r, m) {
  const n = nutrition(r, new Set());
  const tags = recipeTags(r, new Set()).map(tagHtml).join('');
  const badges = [];
  if (m) badges.push(`<span class="rb match${m.pct === 100 ? ' full' : ''}">${m.pct}% match</span>`);
  else if (POPULAR.indexOf(r.id) >= 0) badges.push('<span class="rb">Popular</span>');
  if (r.minutes <= 15) badges.push(`<span class="rb">${r.minutes} min</span>`);
  let status = '';
  if (m) {
    status = m.missing.length ? `<p class="missing"><b>Missing:</b> ${esc(m.missing.join(', '))}</p>` : `<p class="have">You have everything you need.</p>`;
    if (m.alsoUse.length) status += `<p class="using">You’ll also use: <b>${esc(m.alsoUse.join(', '))}</b></p>`;
  }
  return `
  <article class="rcard">
    <div class="rcard-art">${dishImg(r.id)}${badges.length ? `<div class="rbadges">${badges.join('')}</div>` : ''}</div>
    ${favButton(r.id)}
    <div class="rcard-body">
      <p class="meal-line">${mealText(r)} · ${r.minutes}${NB}min · ${DIFFICULTY[r.difficulty]}</p>
      <h2><a href="#${r.id}" data-open="${r.id}">${esc(r.name)}</a></h2>
      <p class="rdesc">${esc(shortIngredients(r))}</p>
      ${macrosHtml(n)}
      ${tags ? `<ul class="tags" aria-label="Diets">${tags}</ul>` : ''}
      ${status}
      ${dietNote(r)}
    </div>
  </article>`;
}
const dietSummary = () => state.diets.size ? `<span>· Diet:</span>${[...state.diets].map(d => `<span class="mini diet">${TAGS[d]}</span>`).join('')}` : '';
function renderDietChips() {
  $$('[data-diet-box]').forEach(box => {
    if (box.children.length) { $$('[data-diet]', box).forEach(b => b.setAttribute('aria-pressed', String(state.diets.has(b.dataset.diet)))); return; }
    box.innerHTML = DIETS.map(d => `<button type="button" class="qbtn diet" data-diet="${d}" aria-pressed="${state.diets.has(d)}">${TAGS[d]}<span class="tick">${ICON.tick}</span></button>`).join('');
  });
}
function emptyPanel(title, text, actions, art = '_plate') {
  return `<div class="panel empty">
    <div class="empty-art">${dishImg(art)}</div>
    <h2>${title}</h2>
    <p>${text}</p>
    <div class="actions">${actions}</div>
  </div>`;
}

/* ---------- home ---------- */
function viewHome() {
  const p = profile(), v = p && compute(p);
  const goalSub = v ? `${kcal(v.kcal)} a day · ${esc(v.goal.name.toLowerCase())}` : 'Work out your daily calories';
  const popular = POPULAR.map(recipeById).filter(Boolean);
  const band = v
    ? `<h2>Your day: ${kcal(v.kcal)}</h2><p>That’s about ${kcal(v.kcal / state.meals)} a meal across ${state.meals} meals. Every recipe shows how much of your day one serving covers.</p>
       <div class="band-stats"><span><b>${fmt(v.p)}${NB}g</b>protein</span><span><b>${fmt(v.c)}${NB}g</b>carbs</span><span><b>${fmt(v.f)}${NB}g</b>fat</span></div>
       <a class="btn btn-primary" href="#calculator" data-nav="calculator">Update my goal ${ICON.arrow}</a>`
    : `<h2>Know what’s on your plate</h2><p>Tell us your height, weight and goal. We’ll work out your daily calories and show how each recipe fits into your day.</p>
       <a class="btn btn-primary" href="#calculator" data-nav="calculator">Work out my calories ${ICON.arrow}</a>`;
  return `
  <section class="hero" aria-labelledby="h-home">
    <div class="hero-in">
      <div class="disc" aria-hidden="true"></div>
      ${HERO_DISHES.map((id, i) => dishImg(id, { cut: true, cls: 'hb hb' + (i + 1) })).join('')}
      ${LEAF('l1')}${LEAF('l2')}${LEAF('l3')}${LEAF('l4')}
      <div class="hero-copy">
        <p class="eyebrow">Cookbook</p>
        <h1 id="h-home" tabindex="-1">What are we cooking today?</h1>
        <p class="lede">Tell us what’s in your kitchen and we’ll find a recipe. Set your goal and see how each one fits your day.</p>
        <div class="hero-actions">
          <a class="hbtn hbtn-primary" href="#kitchen" data-nav="kitchen"><span class="hbtn-txt"><small>Don’t know?</small><b>What’s in your kitchen?</b></span>${ICON.arrow}</a>
          <a class="hbtn hbtn-outline" href="#calculator" data-nav="calculator"><span class="hbtn-txt"><b>My goal</b><small>${goalSub}</small></span>${ICON.arrow}</a>
        </div>
        <a class="hero-login" href="#account" data-nav="account">${ICON.user}Log in or sign up</a>
      </div>
    </div>
  </section>
  <section class="wrap section" aria-labelledby="h-ways">
    <div class="center-head"><p class="eyebrow">How it works</p><h2 id="h-ways">Three ways to find your next meal</h2></div>
    <div class="ways">
      <div class="way"><span class="way-ico">${ICON.fridge}</span><h3>Cook from your fridge</h3><p>Type what you have. We match it against every recipe and tell you exactly what’s missing.</p><a class="btn btn-outline btn-pill-sm" href="#kitchen" data-nav="kitchen">What’s in your kitchen? ${ICON.chev}</a></div>
      <div class="way"><span class="way-ico">${ICON.bolt}</span><h3>Short on time</h3><p>Breakfasts in five minutes, dinners in thirty. Pick the time you’ve got and see what fits.</p><a class="btn btn-outline btn-pill-sm" href="#quick" data-nav="quick">Quick meals ${ICON.chev}</a></div>
      <div class="way"><span class="way-ico">${ICON.target}</span><h3>Eat for your goal</h3><p>Losing weight, building muscle or just eating well. See calories and macros for every serving.</p><a class="btn btn-outline btn-pill-sm" href="#calculator" data-nav="calculator">Calculator ${ICON.chev}</a></div>
    </div>
  </section>
  <section class="wrap section" style="padding-top:0" aria-labelledby="h-pop">
    <div class="section-head"><h2 id="h-pop">Popular right now</h2><a class="btn btn-ghost" href="#recipes" data-nav="recipes">All ${RECIPES.length} recipes ${ICON.arrow}</a></div>
    <div class="grid">${popular.map(r => card(r)).join('')}</div>
  </section>
  <section class="wrap section" style="padding-top:0" aria-label="Calorie calculator">
    <div class="band">
      <div class="band-copy">${band}</div>
      <div class="band-art">${dishImg('chicken-caesar', { cut: true })}</div>
    </div>
  </section>`;
}

/* ---------- kitchen ---------- */
function viewKitchen() {
  const p = profile(), v = p && compute(p);
  const teaser = v
    ? `<b>Your daily target: ${kcal(v.kcal)}</b><small>${esc(v.goal.name)} · ${esc(v.style.name.toLowerCase())} diet. Tap to change.</small>`
    : `<b>Calorie calculator</b><small>Work out your daily intake and see how a recipe fits into your day.</small>`;
  return `
  <section class="kitchen" aria-labelledby="h-kitchen">
    <div>
      <p class="eyebrow">What’s in your kitchen?</p>
      <h1 id="h-kitchen" tabindex="-1">Not sure what to cook? Tell us what’s in your fridge.</h1>
    </div>
    <div class="fridge">
      <label class="field-label" for="ing-input">What you have</label>
      <div class="sugg-wrap">
        <div class="chipbox" id="chipbox">
          <ul class="chips" id="chips" aria-label="Ingredients in your kitchen"></ul>
          <input id="ing-input" class="chip-input" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="enter"
            placeholder="e.g. eggs, butter, cheese" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugg" aria-describedby="ing-hint">
        </div>
        <ul id="sugg" class="sugg" role="listbox" aria-label="Suggested ingredients" hidden></ul>
      </div>
      <p class="hint" id="ing-hint">Press Enter or type a comma after each one. We assume you always have salt, pepper and water.</p>
      <div class="quick">
        <p class="quick-label" id="quick-label">Often in the fridge</p>
        <div class="quick-list" id="quick" role="group" aria-labelledby="quick-label"></div>
      </div>
      <div class="quick">
        <p class="quick-label" id="diet-label">Diet</p>
        <div class="quick-list" data-diet-box role="group" aria-labelledby="diet-label"></div>
        <p class="diet-hint">We’ll only show recipes that fit. You can pick more than one.</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary btn-lg" type="button" data-act="find">Find a recipe</button>
        <button class="btn btn-secondary btn-lg" type="button" data-act="surprise">${ICON.dice}Surprise me</button>
      </div>
      <p class="inline-msg" id="find-msg" role="status">${esc(state.findMsg)}</p>
    </div>
    <a class="calc-teaser" href="#calculator" data-nav="calculator">
      <span class="ct-ico">${ICON.calc}</span>
      <span class="ct-txt">${teaser}</span>
      <span class="ct-arrow">${ICON.arrow}</span>
    </a>
    <div class="soon-row"><span class="soon">Soon</span><span class="item">Snap your fridge</span><span class="item">Shopping list</span><span class="item">AI recipes</span></div>
  </section>`;
}
function renderChips() {
  const ul = $('#chips');
  if (!ul) return;
  ul.innerHTML = state.kitchen.map((it, i) => {
    const hint = it.id && norm(it.label) !== ING[it.id].nameN ? `<small>= ${esc(ingName(it.id))}</small>` : '';
    const flash = state.flashKey === keyOf(it) ? ' flash' : '';
    return `<li class="chip${it.id ? '' : ' unknown'}${flash}"${it.id ? '' : ' title="We don’t know this one yet"'}><span>${esc(it.label)}</span>${hint}<button type="button" data-remove="${i}" aria-label="Remove ${esc(it.label)}">${ICON.x}</button></li>`;
  }).join('');
  state.flashKey = null;
  const q = $('#quick');
  if (q) {
    const ids = new Set(state.kitchen.map(i => i.id));
    if (q.children.length) { $$('[data-quick]', q).forEach(b => b.setAttribute('aria-pressed', String(ids.has(b.dataset.quick)))); return; }
    q.innerHTML = QUICK_BTNS.map(([id, em]) => `<button type="button" class="qbtn" data-quick="${id}" aria-pressed="${ids.has(id)}"><span class="em" aria-hidden="true">${em}</span>${esc(ingName(id))}<span class="tick">${ICON.tick}</span></button>`).join('');
  }
}
function suggestions(q) {
  const n = norm(q);
  if (!n) return [];
  const have = new Set(state.kitchen.map(i => i.id).filter(Boolean));
  const out = [], seen = new Set();
  const passes = [
    s => (s.nameN.indexOf(n) === 0 ? s.name : null),
    s => { const i = s.aliasesN.findIndex(x => x.indexOf(n) === 0); return i >= 0 ? s.aliases[i] : null; },
    s => { const i = s.aliasesN.findIndex(x => x.indexOf(n) >= 0); return i >= 0 ? s.aliases[i] : null; },
  ];
  for (const pass of passes) {
    for (const s of INGREDIENTS) {
      if (have.has(s.id) || seen.has(s.id)) continue;
      const hit = pass(s);
      if (!hit) continue;
      const note = [];
      if (norm(hit) !== s.nameN) note.push('= ' + s.name);
      if (s.pantry) note.push('always in stock');
      else if (!IN_RECIPES.has(s.id)) note.push('no recipe yet');
      out.push({ id:s.id, label:hit, hint:note.join(' · ') });
      seen.add(s.id);
      if (out.length >= 6) return out;
    }
  }
  return out;
}
function updateSuggestions(q) {
  const ul = $('#sugg'), inp = $('#ing-input');
  if (!ul || !inp) return;
  const items = suggestions(q);
  state.sugg = { items, active:-1 };
  if (!items.length) { closeSuggestions(); return; }
  ul.innerHTML = items.map((it, i) => `<li role="option" id="sugg-${i}" data-sugg="${i}" aria-selected="false"><span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</li>`).join('');
  ul.hidden = false;
  inp.setAttribute('aria-expanded', 'true');
  inp.removeAttribute('aria-activedescendant');
}
function closeSuggestions() {
  const ul = $('#sugg'), inp = $('#ing-input');
  if (ul) { ul.hidden = true; ul.innerHTML = ''; }
  if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
  state.sugg = { items:[], active:-1 };
}
function setActive(i) {
  state.sugg.active = i;
  $$('#sugg li').forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
  $('#ing-input').setAttribute('aria-activedescendant', 'sugg-' + i);
}
function pickSuggestion(i) {
  const it = state.sugg.items[i], inp = $('#ing-input');
  if (!it || !inp) return;
  addItem(it.label);
  inp.value = '';
  renderChips();
  closeSuggestions();
  setFindMsg('');
  inp.focus();
}
function commitPending() {
  const inp = $('#ing-input');
  if (!inp || !inp.value.trim()) return;
  inp.value.split(/[,;]/).forEach(addItem);
  inp.value = '';
  renderChips();
  closeSuggestions();
}
function setFindMsg(msg) { state.findMsg = msg; const el = $('#find-msg'); if (el) el.textContent = msg; }

/* ---------- kitchen results ---------- */
function viewResults() {
  const have = haveSet();
  const all = RECIPES.map(r => ({ r, m: match(r, have) })).filter(x => x.m).sort((a, b) => b.m.pct - a.m.pct || a.r.minutes - b.r.minutes);
  const shown = all.filter(x => fitsDiets(x.r, state.diets));
  const searched = [...new Map(state.kitchen.map(i => [keyOf(i), i])).values()]
    .map(i => `<span class="mini${i.id ? '' : ' unknown'}">${esc(i.id ? ingName(i.id) : i.label)}</span>`).join('');
  let body;
  if (shown.length) body = `<p class="count">${shown.length} ${plural(shown.length, 'recipe', 'recipes')}, best match first</p><div class="grid">${shown.map(x => card(x.r, x.m)).join('')}</div>`;
  else if (all.length) {
    const diets = [...state.diets].map(d => TAGS[d].toLowerCase()), n = all.length;
    body = emptyPanel('Nothing here fits your diet yet.', `${n === 1 ? '1 recipe matches' : n + ' recipes match'} your ingredients, but ${n === 1 ? 'it isn’t' : 'none of them is'} ${esc(listText(diets))}. More recipes are on the way.`,
      `<button class="btn btn-primary" type="button" data-act="clear-diets">Clear diet filter</button><button class="btn btn-secondary" type="button" data-nav="kitchen">Edit my kitchen</button>`);
  } else {
    const starters = [...new Set(RECIPES.map(r => { const x = r.ingredients.find(i => i.role === 'required'); return x ? ingName(x.ing) : null; }).filter(Boolean))];
    body = emptyPanel('We can’t cook anything with that yet.', `Every recipe in the cookbook starts with one of these: ${esc(listText(starters, 'or'))}. Add one of them and try again.`,
      `<button class="btn btn-primary" type="button" data-nav="kitchen">Edit my kitchen</button><button class="btn btn-secondary" type="button" data-nav="recipes">Browse all recipes</button>`);
  }
  return `
  <section aria-labelledby="h-res">
    <header class="page-head">
      <p class="eyebrow">What’s in your kitchen?</p>
      <h1 id="h-res" tabindex="-1">${shown.length ? 'Here’s what you can cook' : 'Nothing to cook yet'}</h1>
      <div class="search-sum">Searching for: ${searched}${dietSummary()}<button class="btn btn-ghost" type="button" data-nav="kitchen">Edit</button></div>
    </header>
    ${body}
  </section>`;
}

/* ---------- recipes (database) ---------- */
const searchText = r => r._s || (r._s = norm([r.name, r.description, ...r.ingredients.map(x => (x.name || '') + ' ' + ingName(x.ing)), ...r.addons.map(a => a.name)].join(' ')));
function filteredRecipes() {
  const q = norm(state.search);
  return RECIPES.filter(r => (state.mealFilter === 'all' || r.meals.indexOf(state.mealFilter) >= 0) && fitsDiets(r, state.diets) && (!q || searchText(r).indexOf(q) >= 0));
}
function viewRecipes() {
  const meal = [['all','All']].concat(Object.keys(MEALS).map(k => [k, MEALS[k]]))
    .map(([k, l]) => `<label><input type="radio" name="meal-filter" id="meal-${k}" value="${k}" ${state.mealFilter === k ? 'checked' : ''}><span>${l}</span></label>`).join('');
  return `
  <section aria-labelledby="h-recipes">
    <header class="page-head">
      <p class="eyebrow">Recipes</p>
      <h1 id="h-recipes" tabindex="-1">Fresh, simple, made at home.</h1>
      <p class="lede">Every recipe in the cookbook, with calories and macros per serving. Filter by meal or diet, or search by name or ingredient.</p>
    </header>
    <div class="filters">
      <label class="search" for="recipe-search">${ICON.search}<span class="sr">Search recipes</span>
        <input id="recipe-search" type="search" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" placeholder="Search recipes or ingredients" value="${esc(state.search)}">
      </label>
      <div class="filter-row"><span class="filter-label" id="meal-label">Meal</span>
        <div class="scroll-row"><div class="seg" role="radiogroup" aria-labelledby="meal-label">${meal}</div></div>
      </div>
      <div class="filter-row"><span class="filter-label" id="rdiet-label">Diet</span>
        <div class="scroll-row" data-diet-box role="group" aria-labelledby="rdiet-label"></div>
      </div>
    </div>
    <p class="count" id="recipe-count" role="status"></p>
    <div id="recipe-list"></div>
  </section>`;
}
function renderRecipeList() {
  const box = $('#recipe-list');
  if (!box) return;
  const list = filteredRecipes();
  box.innerHTML = list.length
    ? `<div class="grid">${list.map(r => card(r)).join('')}</div>`
    : emptyPanel('No recipes match these filters.', 'Try another meal, fewer diets or a different search.', `<button class="btn btn-primary" type="button" data-act="clear-filters">Clear filters</button>`, '_bowl');
  $('#recipe-count').textContent = list.length === RECIPES.length ? `Showing all ${RECIPES.length} recipes` : `Showing ${list.length} of ${RECIPES.length} recipes`;
  hydrate(box);
}

/* ---------- favourites ---------- */
function viewFavorites() {
  const list = state.favorites.slice().reverse().map(recipeById).filter(Boolean);
  const body = list.length
    ? `<p class="count">${list.length} ${plural(list.length, 'recipe', 'recipes')} saved</p><div class="grid">${list.map(r => card(r)).join('')}</div>`
    : emptyPanel('No favorites yet.', 'Tap the heart on any recipe and it’ll be saved here, ready for next time.', `<button class="btn btn-primary" type="button" data-nav="recipes">Browse recipes</button>`);
  return `
  <section aria-labelledby="h-fav">
    <header class="page-head">
      <p class="eyebrow">Favorites</p>
      <h1 id="h-fav" tabindex="-1">Favorite recipes</h1>
      <p class="lede">Recipes you’ve saved with the heart. Tap it again to remove one.</p>
    </header>
    ${body}
  </section>`;
}

/* ---------- quick meals ---------- */
function viewQuick() {
  const max = state.quickMax;
  const list = RECIPES.filter(r => r.minutes <= max && fitsDiets(r, state.diets)).sort((a, b) => a.minutes - b.minutes);
  const pick = QUICK_TIMES.map(t => `<label class="qm"><input type="radio" name="quick-max" id="quick-${t}" value="${t}" ${max === t ? 'checked' : ''}><span><b>${t}</b>minutes</span></label>`).join('');
  const diet = state.diets.size ? `<div class="diet-line">Only showing recipes for your diet:${[...state.diets].map(d => `<span class="mini diet">${TAGS[d]}</span>`).join('')}<button class="btn btn-ghost" type="button" data-act="clear-diets">Clear</button></div>` : '';
  const body = list.length
    ? `<p class="count" role="status">${list.length} ${plural(list.length, 'recipe', 'recipes')} ready in ${max}${NB}minutes or less</p><div class="grid">${list.map(r => card(r)).join('')}</div>`
    : emptyPanel(`Nothing ready in ${max}${NB}minutes${state.diets.size ? ' for your diet' : ''} yet.`, `Pick a longer time${state.diets.size ? ' or clear your diet filter' : ''}.`,
        `${max < 30 ? `<button class="btn btn-primary" type="button" data-act="quick-30">Show 30-minute meals</button>` : ''}${state.diets.size ? `<button class="btn btn-secondary" type="button" data-act="clear-diets">Clear diet filter</button>` : ''}`);
  return `
  <section aria-labelledby="h-quick">
    <header class="page-head">
      <p class="eyebrow">Quick meals</p>
      <h1 id="h-quick" tabindex="-1">Short on time?</h1>
      <p class="lede">Pick how long you’ve got and we’ll show what’s ready in time.</p>
    </header>
    <div class="qm-pick" role="radiogroup" aria-label="Time you have">${pick}</div>
    ${diet}
    <div id="quick-list">${body}</div>
  </section>`;
}

/* ---------- recipe detail ---------- */
function amountText(x, k) {
  const unit = x.unit || 'g', qty = x.qty != null ? x.qty : (x.unit ? null : x.g);
  if (qty == null || (!x.g && !x.qty)) return x.name ? cap(x.name) : cap(ingName(x.ing));
  const q = qty * k;
  if (unit === 'pcs') return `${qtyText(q)} ${q > 1 ? x.forms[1] : x.forms[0]}`;
  return `${qtyText(q)}${NB}${unit} ${x.name || ingName(x.ing)}`;
}
function ingStatus(x, have) {
  if (x.role === 'pantry') return { cls:'pantry', txt:'pantry' };
  if (have.has(x.ing)) return { cls:'ok', txt:'you have it' };
  if (x.role === 'swap') {
    const alt = (x.swaps || []).find(s => have.has(s.ing));
    if (alt) return { cls:'ok', txt:'you have ' + ingName(alt.ing) };
    return { cls:'miss', txt:'missing' };
  }
  if (x.role === 'core') return { cls:'miss', txt:'missing' };
  return x.role === 'optional' ? { cls:'opt', txt:'optional' } : { cls:'miss', txt:'missing' };
}
const ROLE = { required:'must have', core:'recommended', swap:'can swap', optional:'optional', pantry:'pantry' };
function ingredientRows(r, k, have, hasKitchen) {
  return r.ingredients.map(x => {
    let main;
    const sub = [];
    const isNote = x.g && x.g < 2 && !x.qty;   // pinches and garnishes
    if (x.role === 'swap') {
      const alt = x.swaps[0];
      const useAlt = hasKitchen && !have.has(x.ing) && have.has(alt.ing);
      if (useAlt) { main = amountText(alt, k); sub.push('instead of ' + amountText(x, k)); }
      else { main = amountText(x, k); sub.push('or ' + amountText(alt, k)); }
    } else {
      main = isNote || x.role === 'pantry' || (x.note && x.g <= 3 && !x.qty) ? (x.name ? cap(x.name) : cap(ingName(x.ing))) : amountText(x, k);
      if (x.equiv) sub.push((x.equiv.unit === 'g' ? 'about ' : '') + nf1.format(x.equiv.qty * k) + NB + x.equiv.unit);
      if (x.note) sub.push(x.note);
    }
    sub.push(ROLE[x.role]);
    const st = hasKitchen ? ingStatus(x, have) : null;
    return `<li class="ing"><span class="ing-txt"><b>${esc(main)}</b><small>${esc(sub.join(' · '))}</small></span>${st ? `<span class="pill ${st.cls}">${esc(st.txt)}</span>` : ''}</li>`;
  }).join('');
}
function nutritionBlock(r, d, n1) {
  const s = d.servings, base = nutrition(r, new Set());
  const pK = n1.p * 4, cK = n1.c * 4, fK = n1.f * 9, sum = pK + cK + fK || 1;
  const share = x => Math.round(x / sum * 100);
  const extra = n1.kcal - base.kcal;
  const tiles = s > 1
    ? `<div class="kcal-tile"><span>Per serving</span><b id="kcal-serving">${fmt(n1.kcal)}</b><small>kcal</small></div>
       <div class="kcal-tile hl"><span>Total · ${s} servings</span><b id="kcal-total">${fmt(n1.kcal * s)}</b><small>kcal</small></div>`
    : `<div class="kcal-tile hl"><span>Per serving</span><b id="kcal-serving">${fmt(n1.kcal)}</b><small>kcal</small></div>`;
  const row = (cls, name, g, e) => `<tr><td><span class="dot ${cls}"></span>${name}</td><td>${grams(g)}</td>${s > 1 ? `<td>${grams(g * s)}</td>` : ''}<td class="pct">${pct(share(e))}</td></tr>`;
  return `
    <div class="panel-head"><h2 id="h-nutr">Nutrition</h2><span class="sub">approx.</span></div>
    <div class="kcal-row">${tiles}</div>
    <p class="kcal-break">Base ${kcal(base.kcal)}${Math.round(extra) ? ` + add-ons ${kcal(extra)}` : ', no add-ons'} per serving</p>
    <div class="mbar" role="img" aria-label="Energy split: protein ${share(pK)}%, carbs ${share(cK)}%, fat ${share(fK)}%">
      <span class="mb-p" style="width:${pK / sum * 100}%"></span><span class="mb-c" style="width:${cK / sum * 100}%"></span><span class="mb-f" style="width:${fK / sum * 100}%"></span>
    </div>
    <div class="tbl"><table class="mtab">
      <thead><tr><th scope="col"><span class="sr">Nutrient</span></th><th scope="col">Per serving</th>${s > 1 ? '<th scope="col">Total</th>' : ''}<th scope="col">Energy</th></tr></thead>
      <tbody>${row('p', 'Protein', n1.p, pK)}${row('c', 'Carbs', n1.c, cK)}${row('f', 'Fat', n1.f, fK)}</tbody>
    </table></div>`;
}
function goalBlock(r, d, n1) {
  const p = profile();
  if (!p) {
    return `<div class="goal-empty">
      <h2 id="h-goal">How it fits your goal</h2>
      <p>Add your age, height, weight and goal in the calculator. Then you’ll see how much of your daily calories and protein one serving covers.</p>
      <a class="btn btn-primary" href="#calculator" data-nav="calculator">Work out your daily intake</a>
    </div>`;
  }
  const v = compute(p);
  const pk = Math.round(n1.kcal / v.kcal * 100);
  const pp = v.p ? Math.round(n1.p / v.p * 100) : 0;
  const rec = recommendation(r, p);
  const sel = d.addons;
  const done = rec.add.every(a => sel.has(a)) && rec.drop.every(a => !sel.has(a));
  let reco;
  if (!rec.add.length && !rec.drop.length) {
    reco = `<div class="reco"><p>The basic version suits your goal to <b>${esc(v.goal.name.toLowerCase())}</b>. Add whatever you like.</p></div>`;
  } else {
    reco = `<div class="reco"><p>Recommended for your goal: <b>${esc(recText(r, rec))}</b></p>${done
      ? `<p class="ok">You’re set up as recommended.</p>`
      : `<button class="btn btn-primary" type="button" data-act="use-rec">Use recommendation</button>`}</div>`;
  }
  return `
    <h2 id="h-goal">How it fits your goal</h2>
    <p class="goal-sum">Goal: <b>${esc(v.goal.name.toLowerCase())}</b> · ${esc(v.style.name.toLowerCase())} diet · <b>${kcal(v.kcal)}</b> a day</p>
    <div class="cover">
      <div class="cover-row"><span>Energy from 1 serving</span><b>${pk}%</b></div>
      <div class="meter"><span style="width:${Math.min(pk, 100)}%"></span></div>
      <small>${fmt(n1.kcal)} of ${kcal(v.kcal)} daily target</small>
    </div>
    <div class="cover">
      <div class="cover-row"><span>Protein from 1 serving</span><b>${pp}%</b></div>
      <div class="meter p"><span style="width:${Math.min(pp, 100)}%"></span></div>
      <small>${nf1.format(n1.p)} of ${grams(v.p)} a day</small>
    </div>
    <p class="meal-note">With ${state.meals} meals a day, one meal averages ${kcal(v.kcal / state.meals)}.</p>
    ${reco}
    <a class="btn btn-ghost" href="#calculator" data-nav="calculator">Edit details in the calculator</a>`;
}
function photoBlock(r) {
  const src = photoSrc(r), own = !!state.photos[r.id];
  return `<div class="d-media">
    <figure class="d-photo">${dishImg(r.id, { alt: src ? photoAlt(r) : 'Illustration of ' + r.name })}${src ? '' : '<span class="ph-note">Illustration</span>'}
      <div class="photo-actions">
        <input class="sr" type="file" id="photo-input" accept="image/*">
        <label class="photo-btn" for="photo-input">${ICON.camera}${src ? 'Change photo' : 'Add a photo'}</label>
        ${own ? `<button class="photo-btn icon" type="button" data-act="remove-photo" aria-label="Remove photo">${ICON.trash}</button>` : ''}
      </div>
    </figure>
    <p class="photo-msg" id="photo-msg" role="status">${esc(state.photoMsg)}</p>
  </div>`;
}
const BACK = { home:'Back to home', kitchen:'Back to your kitchen', results:'Back to results', recipes:'Back to recipes', favorites:'Back to favorites', quick:'Back to quick meals', calculator:'Back to the calculator' };
function viewRecipe() {
  const d = state.detail, r = recipeById(d.id);
  const k = d.servings / r.servings;
  const have = haveSet(), hasKitchen = state.kitchen.length > 0, veg = isVegStyle();
  if (veg) r.addons.forEach(a => { if (isMeaty(a)) { d.addons.delete(a.id); delete d.origin[a.id]; } });
  r.addons.forEach(a => { const c = addonConflict(r, d.addons, a, state.diets); if (c && c.hide) { d.addons.delete(a.id); delete d.origin[a.id]; } });
  const clash = {};
  r.addons.forEach(a => { const c = addonConflict(r, d.addons, a, state.diets); if (c) clash[a.id] = c; });
  const n1 = nutrition(r, d.addons);
  const baseTags = recipeTags(r, new Set());
  const tags = recipeTags(r, d.addons).map(tagHtml).join('');
  const notFit = state.diets.size && !fitsDiets(r, state.diets)
    ? [...state.diets].filter(x => !fitsDiets(r, new Set([x]))).map(x => TAGS[x].toLowerCase()) : [];
  const servingSeg = [1, 2, 3, 4].map(n => `<label><input type="radio" name="servings" id="servings-${n}" value="${n}" ${d.servings === n ? 'checked' : ''}><span>${n}</span></label>`).join('');
  const visible = r.addons.filter(a => !(veg && isMeaty(a)) && !(clash[a.id] && clash[a.id].hide));
  const hiddenVeg = r.addons.filter(a => veg && isMeaty(a));
  const hiddenDiet = r.addons.filter(a => !(veg && isMeaty(a)) && clash[a.id] && clash[a.id].hide);
  const addons = visible.map(a => {
    const on = d.addons.has(a.id);
    const src = on && d.origin[a.id] ? `<span class="badge ${d.origin[a.id]}">${d.origin[a.id] === 'goal' ? 'for your goal' : 'from your kitchen'}</span>` : '';
    const off = !on && clash[a.id];
    const lost = baseTags.filter(t => recipeTags(r, new Set([a.id])).indexOf(t) < 0);
    const note = off
      ? `<span class="add-note">Can’t add right now: ${esc(off.reasons.join(', '))}.</span>`
      : lost.length ? `<span class="add-note">Removes: ${lost.map(t => TAGS[t].toLowerCase()).join(', ')}</span>` : '';
    const amt = a.unit === 'pcs' ? `${qtyText(a.qty * k)} ${a.qty * k > 1 ? a.forms[1] : a.forms[0]}` : a.unit ? `${qtyText(a.qty * k)}${NB}${a.unit}` : `${nf1.format(a.g * k)}${NB}g`;
    const ak = nutrition({ ingredients: [], addons: [a] }, new Set([a.id])).kcal;
    return `<label class="add-row${off ? ' off' : ''}${on ? ' is-on' : ''}" for="add-${a.id}">
      <input class="check" type="checkbox" id="add-${a.id}" data-addon="${a.id}" ${on ? 'checked' : ''}${off ? ' disabled' : ''}>
      <span class="add-main"><span class="add-name">${esc(a.name)}</span><span class="add-amt">${amt}</span>${src}</span>
      <span class="add-kcal">+${kcal(ak)}</span>
      ${note}
    </label>`;
  }).join('');
  const doneN = d.steps.size, total = r.steps.length;
  const steps = r.steps.map((t, i) => `<li><label class="step${d.steps.has(i) ? ' is-on' : ''}" for="step-${i}"><input class="check" type="checkbox" id="step-${i}" data-step="${i}" ${d.steps.has(i) ? 'checked' : ''}><span class="step-n">${i + 1}</span><span class="step-t">${esc(t)}</span></label></li>`).join('');
  return `
  <section class="detail" aria-labelledby="h-detail" data-recipe="${r.id}">
    <a class="back" href="#${d.from}" data-act="back">${ICON.back}${BACK[d.from] || 'Back'}</a>
    <header class="d-hero">
      ${photoBlock(r)}
      <div class="d-head">
        <p class="eyebrow">${mealText(r)}</p>
        <h1 id="h-detail" tabindex="-1">${esc(r.name)}</h1>
        <p class="lede">${esc(r.description)}</p>
        <ul class="meta"><li>${ICON.clock}About ${r.minutes}${NB}min</li><li>${ICON.hat}${DIFFICULTY[r.difficulty]}</li><li>Per serving</li></ul>
        <div id="d-macros">${macrosHtml(n1)}</div>
        <ul class="tags" id="d-tags" aria-label="Diets">${tags}</ul>
        <p class="diet-miss" id="d-diet"${notFit.length ? '' : ' hidden'}>${notFit.length ? `Doesn’t fit your diet: ${esc(listText(notFit))}.` : ''}</p>
        ${favButton(r.id, true)}
      </div>
    </header>
    <div class="d-grid">
      <div class="d-main">
        <section class="panel p-ing" aria-labelledby="h-ing">
          <div class="panel-head">
            <h2 id="h-ing">Ingredients</h2>
            <div class="seg" role="radiogroup" aria-label="Servings">${servingSeg}</div>
          </div>
          <p class="sub" style="margin-bottom:8px">For ${d.servings} ${plural(d.servings, 'serving', 'servings')}</p>
          <ul class="ing-list">${ingredientRows(r, k, have, hasKitchen)}</ul>
          ${hasKitchen ? `<button class="soon-inline" type="button" disabled>Add missing items to a shopping list <span class="soon">Soon</span></button>` : ''}
        </section>
        ${r.addons.length ? `<section class="panel p-add" aria-labelledby="h-add">
          <h2 id="h-add">Add-ons</h2>
          <p class="sub">Tick what you’d like to add. Calories, macros and diet tags update straight away. Calories are per serving.</p>
          <div class="add-list">${addons}</div>
          ${hiddenVeg.length ? `<p class="hidden-note">Hidden for your vegetarian eating style: ${hiddenVeg.map(a => a.short).join(', ')}.</p>` : ''}
          ${hiddenDiet.length ? `<p class="hidden-note">Hidden for your diet: ${hiddenDiet.map(a => `${esc(a.name.toLowerCase())} (${clash[a.id].reasons.join(', ')})`).join(', ')}.</p>` : ''}
        </section>` : ''}
        <section class="panel p-steps" aria-labelledby="h-steps">
          <div class="steps-head">
            <h2 id="h-steps">Method</h2>
            <div class="progress"><span>${doneN} of ${total} done</span><div class="meter" aria-hidden="true"><span style="width:${doneN / total * 100}%"></span></div></div>
          </div>
          <ol class="steps">${steps}</ol>
          ${r.tip ? `<div class="tip">${ICON.bulb}<p><b>Tip:</b> ${esc(r.tip)}</p></div>` : ''}
        </section>
      </div>
      <div class="d-side">
        <section class="panel p-nutr" aria-labelledby="h-nutr">${nutritionBlock(r, d, n1)}</section>
        <section class="panel goal p-goal" aria-labelledby="h-goal">${goalBlock(r, d, n1)}</section>
      </div>
    </div>
  </section>`;
}

/* ---------- calculator ---------- */
function viewCalculator() {
  const f = state.form;
  const field = (k, label, unit, ph, mode) => `
    <div class="field" id="f-${k}">
      <label for="in-${k}">${label}</label>
      <div class="inp"><input id="in-${k}" data-field="${k}" type="text" inputmode="${mode}" autocomplete="off" autocorrect="off" enterkeyhint="next" value="${esc(f[k])}" placeholder="${ph}" aria-describedby="err-${k}"><span>${unit}</span></div>
      <p class="err-msg" id="err-${k}"></p>
    </div>`;
  const opt = (name, id, title, desc, right) => `
    <label class="opt${f[name] === id ? ' is-on' : ''}" for="r-${name}-${id}">
      <input type="radio" name="${name}" id="r-${name}-${id}" value="${id}" ${f[name] === id ? 'checked' : ''}>
      <span class="radio" aria-hidden="true"></span>
      <span class="opt-txt"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</span>
      ${right ? `<span class="opt-k">${right}</span>` : ''}
    </label>`;
  const adj = a => a === 0 ? '±0' + NB + 'kcal' : (a > 0 ? '+' : '−') + Math.abs(a) + NB + 'kcal';
  return `
  <section class="calc" aria-labelledby="h-calc">
    <header class="page-head">
      <p class="eyebrow">Calculator</p>
      <h1 id="h-calc" tabindex="-1">How much should you eat a day?</h1>
      <p class="lede">We use the Mifflin–St Jeor formula to work out your basal metabolic rate, how much you burn in a day and a target that matches your goal.</p>
      <button class="calc-jump" id="calc-jump" type="button" data-act="to-result" hidden></button>
    </header>
    <div class="calc-grid">
      <form class="panel calc-form" id="calc-form" novalidate>
        <fieldset class="fs">
          <legend>Sex</legend>
          <div class="seg seg-wide">
            <label><input type="radio" name="sex" id="r-sex-male" value="male" ${f.sex === 'male' ? 'checked' : ''}><span>Male</span></label>
            <label><input type="radio" name="sex" id="r-sex-female" value="female" ${f.sex === 'female' ? 'checked' : ''}><span>Female</span></label>
          </div>
        </fieldset>
        <div class="num-grid">
          ${field('age', 'Age', 'years', '30', 'numeric')}
          ${field('height', 'Height', 'cm', '175', 'numeric')}
          ${field('weight', 'Weight', 'kg', '72', 'decimal')}
        </div>
        <fieldset class="fs"><legend>Activity level</legend><div class="opts">${ACTIVITY.map(a => opt('activity', a.id, a.name, a.desc, kText(a.k))).join('')}</div></fieldset>
        <fieldset class="fs"><legend>Goal</legend><div class="opts opts-2">${GOALS.map(g => opt('goal', g.id, g.name, adj(g.adj), '')).join('')}</div></fieldset>
        <fieldset class="fs"><legend>Eating style</legend><div class="opts">${STYLES.map(s => opt('style', s.id, s.name, s.desc, '')).join('')}</div></fieldset>
        <div class="form-foot">
          <button type="button" class="btn btn-secondary" data-act="sample">Fill in an example</button>
          <button type="button" class="btn btn-ghost" data-act="clear-form">Clear my details</button>
        </div>
      </form>
      <div class="calc-out" id="calc-out"></div>
    </div>
  </section>`;
}
function renderCalcOutput() {
  ['age', 'height', 'weight'].forEach(k => {
    const box = $('#f-' + k);
    if (!box) return;
    const msg = fieldError(k);
    box.classList.toggle('err', !!msg);
    $('#err-' + k).textContent = msg;
    $('#in-' + k).setAttribute('aria-invalid', msg ? 'true' : 'false');
  });
  const out = $('#calc-out');
  if (!out) return;
  const p = profile();
  const jump = $('#calc-jump');
  if (jump) { jump.hidden = !p; if (p) jump.innerHTML = `Daily target ${kcal(compute(p).kcal)} · see result ${ICON.arrow}`; }
  const disclaimer = `<p class="disclaimer">${ICON.info}<span>This is an estimate and doesn’t replace advice from a doctor or dietitian.</span></p>`;
  if (!p) {
    const f = state.form, missing = [];
    if (!f.sex) missing.push('sex');
    if (f.age === '' || fieldError('age')) missing.push('age');
    if (f.height === '' || fieldError('height')) missing.push('height');
    if (f.weight === '' || fieldError('weight')) missing.push('weight');
    out.innerHTML = `<div class="panel out out-empty">
      <h2>Your daily intake</h2>
      <p>Add your ${listText(missing)}. The result appears as soon as everything’s filled in.</p>
      <button class="btn btn-secondary" type="button" data-act="sample">Fill in an example</button>
      ${disclaimer}
    </div>`;
    return;
  }
  const v = compute(p);
  const pK = v.p * 4, cK = v.c * 4, fK = v.f * 9, sum = pK + cK + fK || 1;
  const pp = pK / sum * 100, cp = cK / sum * 100;
  const share = x => Math.round(x / sum * 100);
  const a = v.goal.adj;
  const how = a === 0 ? 'Same as TDEE, to maintain weight' : `TDEE ${a > 0 ? '+' : '−'} ${Math.abs(a)}${NB}kcal, to ${v.goal.name.toLowerCase()}`;
  let warn = '';
  if (v.clamped) {
    const what = v.reason === 'bmr'
      ? `your basal metabolic rate (${kcal(v.bmr)})`
      : `${kcal(v.floor)}, the safe minimum for ${p.sex === 'male' ? 'men' : 'women'}`;
    warn = `<div class="warn" role="note">${ICON.alert}<p><b>We raised your target to a safe minimum.</b> Based on your details you’d get ${kcal(v.raw)} a day. That’s less than ${what}, and eating that little can harm your body. We’re using ${kcal(v.kcal)} instead.${p.goal === 'lose' ? ' You’ll lose weight more slowly, but safely.' : ''}</p></div>`;
  }
  const r = recipeById(CTA_RECIPE);
  const rec = recommendation(r, p);
  const recT = recText(r, rec) || 'the basic version';
  const meals = SPLIT[state.meals].map(([n, s]) => `<tr><td>${n}</td><td class="pct">${Math.round(s * 100)}%</td><td>${kcal(v.kcal * s)}</td><td>${fmt(v.p * s)}${NB}g protein</td></tr>`).join('');
  out.innerHTML = `<div class="panel out">
    <h2>Your daily intake</h2>
    <div class="stats">
      <div class="stat"><span>BMR</span><b id="out-bmr">${fmt(v.bmr)}</b><small>kcal, basal metabolic rate</small></div>
      <div class="stat"><span>TDEE</span><b id="out-tdee">${fmt(v.tdee)}</b><small>kcal burned a day at activity ${kText(v.act.k)}</small></div>
    </div>
    <div class="target"><span>Daily target</span><b id="out-target">${fmt(v.kcal)}<small>kcal</small></b><small>${esc(how)}</small></div>
    ${warn}
    <h3>Macros · ${esc(v.style.name.toLowerCase())}</h3>
    <div class="donut-wrap">
      <div class="donut" role="img" aria-label="Protein ${share(pK)}%, carbs ${share(cK)}%, fat ${share(fK)}%" style="background:conic-gradient(var(--c-p) 0 ${pp}%, var(--c-c) ${pp}% ${pp + cp}%, var(--c-f) ${pp + cp}% 100%)"><div><b>${fmt(v.kcal)}</b><small>kcal</small></div></div>
      <div class="tbl"><table class="mtab">
        <thead><tr><th scope="col"><span class="sr">Nutrient</span></th><th scope="col">A day</th><th scope="col">Energy</th></tr></thead>
        <tbody>
          <tr><td><span class="dot p"></span>Protein</td><td>${fmt(v.p)}${NB}g</td><td class="pct">${pct(share(pK))}</td></tr>
          <tr><td><span class="dot c"></span>Carbs</td><td>${fmt(v.c)}${NB}g</td><td class="pct">${pct(share(cK))}</td></tr>
          <tr><td><span class="dot f"></span>Fat</td><td>${fmt(v.f)}${NB}g</td><td class="pct">${pct(share(fK))}</td></tr>
        </tbody>
      </table></div>
    </div>
    ${v.note ? `<p class="sub">${esc(v.note)}</p>` : ''}
    <div class="meals-head">
      <h3>Split into meals</h3>
      <div class="seg" role="radiogroup" aria-label="Meals a day">
        <label><input type="radio" name="meals" id="meals-3" value="3" ${state.meals === 3 ? 'checked' : ''}><span>3 meals</span></label>
        <label><input type="radio" name="meals" id="meals-4" value="4" ${state.meals === 4 ? 'checked' : ''}><span>4 meals</span></label>
      </div>
    </div>
    <div class="tbl"><table class="meals"><tbody>${meals}</tbody></table></div>
    <div class="cta">
      <button class="btn btn-primary btn-lg" type="button" data-act="what-to-eat">What should I eat?</button>
      <p>${esc(r.name)}: <b>${esc(recT)}</b></p>
    </div>
    ${disclaimer}
  </div>`;
}
function scrollToResult() {
  const out = $('#calc-out');
  if (!out) return;
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { out.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); } catch (e) { out.scrollIntoView(); }
}

/* ---------- account ---------- */
function viewAccount() {
  const signup = state.accountTab === 'signup';
  const field = (id, label, type, auto, ph, val) => `
    <div class="acc-field" id="af-${id}">
      <label for="acc-${id}">${label}</label>
      <input id="acc-${id}" name="${id}" type="${type}" autocomplete="${auto}" ${type === 'email' ? 'inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false"' : ''} placeholder="${ph}" value="${esc(val || '')}" aria-describedby="ae-${id}">
      <p class="err-msg" id="ae-${id}"></p>
    </div>`;
  return `
  <section class="account" aria-labelledby="h-acc">
    <header class="page-head">
      <p class="eyebrow">Account</p>
      <h1 id="h-acc" tabindex="-1">Log in or sign up</h1>
      <p class="lede">With an account, your favorites and goal will follow you to every device.</p>
    </header>
    <div class="panel acc-panel">
      <div class="seg seg-wide" role="radiogroup" aria-label="Log in or sign up">
        <label><input type="radio" name="acc-tab" id="acc-tab-login" value="login" ${signup ? '' : 'checked'}><span>Log in</span></label>
        <label><input type="radio" name="acc-tab" id="acc-tab-signup" value="signup" ${signup ? 'checked' : ''}><span>Sign up</span></label>
      </div>
      <form class="acc-form" id="acc-form" novalidate>
        ${signup ? field('name', 'Name', 'text', 'name', 'Your name', '') : ''}
        ${field('email', 'Email', 'email', 'email', 'you@example.com', state.accountEmail)}
        ${field('password', 'Password', 'password', signup ? 'new-password' : 'current-password', signup ? 'At least 8 characters' : '', '')}
        <button class="btn btn-primary btn-lg" type="submit">${signup ? 'Create account' : 'Log in'}</button>
        <p class="acc-msg" id="acc-msg" role="status">${esc(state.accountMsg)}</p>
      </form>
      <p class="acc-note"><span class="soon">Soon</span><span>Accounts aren’t live in this prototype yet. Until then, your favorites and goal are saved in this browser.</span></p>
    </div>
  </section>`;
}
function submitAccount(form) {
  const signup = state.accountTab === 'signup';
  const val = id => { const el = $('#acc-' + id, form); return el ? el.value.trim() : ''; };
  const errors = {};
  if (signup && !val('name')) errors.name = 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'))) errors.email = 'Enter an email address like name@example.com.';
  const pw = $('#acc-password', form).value;
  if (!pw) errors.password = 'Enter your password.';
  else if (signup && pw.length < 8) errors.password = 'Use at least 8 characters.';
  ['name', 'email', 'password'].forEach(id => {
    const box = $('#af-' + id, form);
    if (!box) return;
    box.classList.toggle('err', !!errors[id]);
    $('#ae-' + id, form).textContent = errors[id] || '';
    $('#acc-' + id, form).setAttribute('aria-invalid', errors[id] ? 'true' : 'false');
  });
  const first = ['name', 'email', 'password'].find(id => errors[id]);
  if (first) { $('#acc-' + first, form).focus(); state.accountMsg = ''; $('#acc-msg').textContent = ''; return; }
  $('#acc-password', form).value = '';
  state.accountMsg = 'Accounts aren’t live yet, so nothing was sent. Your favorites and goal stay saved on this device.';
  $('#acc-msg').textContent = state.accountMsg;
}

/* =====================================================================
   Events
   ===================================================================== */
document.addEventListener('mousedown', e => {
  if (e.target.closest('[data-sugg]')) e.preventDefault();
  const box = e.target.closest('#chipbox');
  if (box && !e.target.closest('button') && e.target.id !== 'ing-input') { e.preventDefault(); $('#ing-input').focus(); }
});

document.addEventListener('click', e => {
  const t = e.target;
  const fav = t.closest('[data-fav]');
  if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav); return; }
  const nav = t.closest('[data-nav]');
  if (nav) { e.preventDefault(); hideToast(); go(nav.dataset.nav); return; }
  const open = t.closest('[data-open]');
  if (open) { e.preventDefault(); hideToast(); openRecipe(open.dataset.open, { from: state.view }); return; }
  const rm = t.closest('[data-remove]');
  if (rm) {
    const it = state.kitchen[+rm.dataset.remove];
    if (it) { state.kitchen.splice(+rm.dataset.remove, 1); renderChips(); setFindMsg(''); announce('Removed: ' + it.label); }
    const inp = $('#ing-input'); if (inp) inp.focus();
    return;
  }
  const dt = t.closest('[data-diet]');
  if (dt) {
    if (state.view === 'kitchen') commitPending();
    const id = dt.dataset.diet;
    if (state.diets.has(id)) { state.diets.delete(id); announce('Diet removed: ' + TAGS[id]); }
    else { state.diets.add(id); announce('Diet added: ' + TAGS[id]); }
    save();
    renderDietChips();
    setFindMsg('');
    if (state.view === 'recipes') renderRecipeList();
    return;
  }
  const q = t.closest('[data-quick]');
  if (q) {
    commitPending();
    const id = q.dataset.quick;
    const idx = state.kitchen.findIndex(i => i.id === id);
    if (idx >= 0) { state.kitchen.splice(idx, 1); announce('Removed: ' + ingName(id)); }
    else { state.kitchen.push({ label: ingName(id), id }); announce('Added: ' + ingName(id)); }
    setFindMsg('');
    renderChips();
    return;
  }
  const sg = t.closest('[data-sugg]');
  if (sg) { pickSuggestion(+sg.dataset.sugg); return; }

  const act = t.closest('[data-act]');
  if (!act) return;
  switch (act.dataset.act) {
    case 'find':
      commitPending();
      if (!state.kitchen.length) { setFindMsg('Add at least one ingredient, or try Surprise me.'); $('#ing-input').focus(); return; }
      go('results');
      break;
    case 'surprise': {
      commitPending();
      const options = RECIPES.filter(r => fitsDiets(r, state.diets));
      if (!options.length) { setFindMsg('No recipe fits your diet yet. Try changing it.'); return; }
      openRecipe(options[Math.floor(Math.random() * options.length)].id, { from: 'kitchen' });
      break;
    }
    case 'clear-diets':
      state.diets.clear(); save(); render(); announce('Diet filter cleared.');
      break;
    case 'clear-filters':
      state.diets.clear(); state.search = ''; state.mealFilter = 'all'; save(); render(); announce('Filters cleared.');
      break;
    case 'quick-30':
      state.quickMax = 30; save(); render();
      break;
    case 'back':
      e.preventDefault();
      go(state.detail ? state.detail.from : 'recipes');
      break;
    case 'use-rec': {
      const p = profile(), d = state.detail, r = recipeById(d.id);
      if (!p) return;
      const rec = recommendation(r, p);
      rec.drop.forEach(a => { d.addons.delete(a); delete d.origin[a]; });
      pickAddons(r, new Set(rec.add), d.addons, isVegStyle()).forEach(a => { if (!d.addons.has(a)) { d.addons.add(a); d.origin[a] = 'goal'; } });
      rerender();
      announce('Recommendation applied. A serving now has ' + kcal(nutrition(r, d.addons).kcal) + '.');
      break;
    }
    case 'remove-photo':
      if (state.detail) {
        delete state.photos[state.detail.id];
        savePhotos();
        state.photoMsg = 'Photo removed.';
        render();
        announce(state.photoMsg);
      }
      break;
    case 'what-to-eat':
      if (profile()) openRecipe(CTA_RECIPE, { source: 'goal', from: 'calculator' });
      break;
    case 'sample':
      state.form = Object.assign({}, SAMPLE);
      save();
      go('calculator', { keepScroll: true, focus: false, push: false });
      if (window.matchMedia && window.matchMedia('(max-width: 959px)').matches) scrollToResult();
      announce('Example filled in: male, 30, 180 cm, 80 kg.');
      break;
    case 'clear-form':
      state.form = Object.assign({}, EMPTY_FORM);
      save();
      go('calculator', { keepScroll: true, focus: false, push: false });
      announce('Your details are cleared.');
      break;
    case 'to-result':
      scrollToResult();
      break;
    case 'undo-fav': {
      const id = act.dataset.id, index = +act.dataset.index;
      if (id && !isFav(id)) { state.favorites.splice(Math.min(index, state.favorites.length), 0, id); save(); }
      hideToast();
      if (state.view === 'favorites') render(); else syncFav(id);
      announce('Saved to favorites again.');
      break;
    }
    case 'go-favorites':
      hideToast();
      go('favorites');
      break;
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'photo-input' && state.detail) {
    const file = t.files && t.files[0];
    if (!file) return;
    const id = state.detail.id;
    shrinkPhoto(file).then(data => {
      state.photos[id] = data;
      state.photoMsg = savePhotos()
        ? 'Photo added. You’ll see it on the recipe card too.'
        : 'Photo added for this visit only. There’s no room left in the browser to keep it.';
    }).catch(() => {
      state.photoMsg = 'We couldn’t open that photo. Try a JPG or PNG.';
    }).then(() => {
      if (state.view === 'recipe') render();
      announce(state.photoMsg);
    });
    return;
  }
  if (t.name === 'servings' && state.detail) {
    state.detail.servings = +t.value;
    rerender();
    const r = recipeById(state.detail.id);
    announce(`${t.value} ${plural(+t.value, 'serving', 'servings')}, ${kcal(nutrition(r, state.detail.addons).kcal * state.detail.servings)} in total.`);
    return;
  }
  if (t.dataset.addon && state.detail) {
    const d = state.detail, id = t.dataset.addon, r = recipeById(d.id);
    if (t.checked) d.addons.add(id); else d.addons.delete(id);
    delete d.origin[id];
    rerender();
    const a = r.addons.find(x => x.id === id);
    announce(`${t.checked ? 'Added' : 'Removed'}: ${a.short}. A serving has ${kcal(nutrition(r, d.addons).kcal)}.`);
    return;
  }
  if ('step' in t.dataset && state.detail) {
    const i = +t.dataset.step;
    if (t.checked) state.detail.steps.add(i); else state.detail.steps.delete(i);
    rerender();
    return;
  }
  if (t.name === 'meal-filter') { state.mealFilter = t.value; renderRecipeList(); return; }
  if (t.name === 'quick-max') { state.quickMax = +t.value; save(); render(); const el = $('#quick-' + t.value); if (el) el.focus(); return; }
  if (t.name === 'acc-tab') {
    const em = $('#acc-email'); if (em) state.accountEmail = em.value;
    state.accountTab = t.value; state.accountMsg = '';
    render();
    const el = $('#acc-tab-' + t.value); if (el) el.focus();
    return;
  }
  if (t.name === 'meals') { state.meals = +t.value; save(); renderCalcOutput(); const el = $('#meals-' + t.value); if (el) el.focus(); return; }
  if (['sex', 'activity', 'goal', 'style'].indexOf(t.name) >= 0) {
    state.form[t.name] = t.value; save();
    $$(`input[name="${t.name}"]`).forEach(i => { const l = i.closest('.opt'); if (l) l.classList.toggle('is-on', i.checked); });
    renderCalcOutput();
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'ing-input') {
    const v = t.value;
    if (/[,;]/.test(v)) {
      const parts = v.split(/[,;]/);
      const last = parts.pop();
      parts.forEach(addItem);
      t.value = last.replace(/^\s+/, '');
      renderChips();
    }
    setFindMsg('');
    updateSuggestions(t.value);
    return;
  }
  if (t.id === 'recipe-search') { state.search = t.value; renderRecipeList(); return; }
  if (t.id === 'acc-email') { state.accountEmail = t.value; return; }
  if (t.dataset.field) { state.form[t.dataset.field] = t.value.trim(); save(); renderCalcOutput(); }
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'recipe-search' && e.key === 'Enter') { e.preventDefault(); t.blur(); return; }
  if (t.id !== 'ing-input') return;
  const s = state.sugg, open = !$('#sugg').hidden && s.items.length > 0;
  if (e.key === 'ArrowDown' && open) { e.preventDefault(); setActive((s.active + 1) % s.items.length); }
  else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive((s.active - 1 + s.items.length) % s.items.length); }
  else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (open && s.active >= 0) pickSuggestion(s.active); else commitPending(); }
  else if (e.key === 'Escape') { closeSuggestions(); }
  else if (e.key === 'Backspace' && t.value === '' && state.kitchen.length) {
    const it = state.kitchen.pop(); renderChips(); announce('Removed: ' + it.label);
  }
});

const TYPING = '#ing-input, [data-field], #recipe-search, .acc-field input';
let typingTimer = null;
document.addEventListener('focusin', e => {
  if (e.target.matches && e.target.matches(TYPING)) { clearTimeout(typingTimer); document.body.classList.add('typing'); }
});
document.addEventListener('focusout', e => {
  const t = e.target;
  if (t.matches && t.matches(TYPING)) {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { const a = document.activeElement; if (!(a && a.matches && a.matches(TYPING))) document.body.classList.remove('typing'); }, 150);
  }
  if (t.id !== 'ing-input') return;
  // Wait for the tap: on iPhone the field loses focus before the tap on a suggestion or button lands.
  setTimeout(() => {
    const inp = $('#ing-input');
    if (!inp || document.activeElement === inp) return;
    closeSuggestions();
    commitPending();
  }, 200);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'acc-form') submitAccount(e.target);
});
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);

/* =====================================================================
   Start
   ===================================================================== */
load();
initNav();
const start = (location.hash || '').slice(1);
if (recipeById(start)) openRecipe(start, { from: 'recipes', push: false });
else { state.view = VIEWS.indexOf(start) >= 0 && start !== 'results' ? start : 'home'; render(); setHash(state.view, false); }

// for tests and for adding recipes from the console
window.Cookbook = { RECIPES, INGREDIENTS, FOOD, recognize, match, compute, nutrition, recipeTags, state };
