const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const F = {
  profiles: path.join(DIR, 'profiles.json'),
  cooldowns: path.join(DIR, 'cooldowns.json'),
  testers: path.join(DIR, 'testers.json'),
  results: path.join(DIR, 'results.json'),
  queue: path.join(DIR, 'queue.json'),
  runtime: path.join(DIR, 'runtime.json')
};

function load(f) { try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : {}; } catch(e){ return {}; } }
function save(f, d) { try { fs.writeFileSync(f, JSON.stringify(d, null, 2)); } catch(e){} }

module.exports = {
  // PROFILES
  getProfile: id => load(F.profiles)[id] || null,
  setProfile: (id, d) => { const a = load(F.profiles); a[id] = { ...(a[id]||{}), ...d }; save(F.profiles, a); },
  getAllProfiles: () => load(F.profiles),
  deleteProfile: id => { const a = load(F.profiles); delete a[id]; save(F.profiles, a); },

  // COOLDOWNS
  getCooldown: (uid, gm) => load(F.cooldowns)[uid+':'+gm] || 0,
  setCooldown: (uid, gm, ts) => { const a = load(F.cooldowns); a[uid+':'+gm] = ts; save(F.cooldowns, a); },
  resetCooldown: (uid, gm) => { const a = load(F.cooldowns); delete a[uid+':'+gm]; save(F.cooldowns, a); },
  getCooldownsByUser: uid => {
    const a = load(F.cooldowns); const o = {};
    for (const k of Object.keys(a)) if (k.startsWith(uid+':')) o[k.split(':')[1]] = a[k];
    return o;
  },

  // TESTERS
  isTester: id => !!load(F.testers)[id],
  addTester: (id, d) => { const a = load(F.testers); a[id] = { ...d, addedAt: Date.now() }; save(F.testers, a); },
  removeTester: id => { const a = load(F.testers); delete a[id]; save(F.testers, a); },
  getAllTesters: () => load(F.testers),

  // RESULTS
  addResult: d => {
    const r = load(F.results);
    const id = Date.now() + '_' + Math.random().toString(36).slice(2,8);
    r[id] = { ...d, id, timestamp: Date.now() };
    save(F.results, r); return id;
  },
  getUserResults: uid => Object.values(load(F.results)).filter(x => x.playerId === uid),

  // QUEUE
  getQueue: gm => load(F.queue)[gm] || [],
  addToQueue: (gm, e) => {
    const q = load(F.queue); if (!q[gm]) q[gm] = [];
    if (!q[gm].some(x => x.userId === e.userId)) q[gm].push(e);
    save(F.queue, q); return q[gm];
  },
  removeFromQueue: (gm, uid) => {
    const q = load(F.queue); if (!q[gm]) q[gm] = [];
    q[gm] = q[gm].filter(x => x.userId !== uid);
    save(F.queue, q); return q[gm];
  },

  // RUNTIME
  getRuntime: (k, d) => { const c = load(F.runtime); return c[k] !== undefined ? c[k] : d; },
  setRuntime: (k, v) => { const c = load(F.runtime); c[k] = v; save(F.runtime, c); },
  getQueueMessages: () => load(F.runtime).queueMessages || {},
  setQueueMessage: (gm, msgId, chId) => {
    const c = load(F.runtime); if (!c.queueMessages) c.queueMessages = {};
    c.queueMessages[gm] = { msgId, chId }; save(F.runtime, c);
  }
};
