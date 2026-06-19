const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Stockage JSON simple (pas de SQLite, compatible partout)
const DATA_FILE = process.env.DATA_FILE || '/tmp/suivi_st_data.json';

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) {}
  return { chantiers: [], fiches: [], budget: [], depenses: [], aleas: [] };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── CHANTIERS ──────────────────────────────────────────────
app.get('/api/chantiers', (req, res) => {
  const data = readData();
  res.json(data.chantiers.sort((a,b) => b.created_at > a.created_at ? 1 : -1));
});

app.post('/api/chantiers', (req, res) => {
  const data = readData();
  const c = { ...req.body, created_at: new Date().toISOString() };
  data.chantiers.push(c);
  writeData(data);
  res.json({ ok: true });
});

app.delete('/api/chantiers/:id', (req, res) => {
  const data = readData();
  const id = req.params.id;
  const fiches = data.fiches.filter(f => f.chantier_id === id);
  const ficheIds = fiches.map(f => f.id);
  data.chantiers = data.chantiers.filter(c => c.id !== id);
  data.fiches = data.fiches.filter(f => f.chantier_id !== id);
  data.budget = data.budget.filter(r => !ficheIds.includes(r.fiche_id));
  data.depenses = data.depenses.filter(r => !ficheIds.includes(r.fiche_id));
  data.aleas = data.aleas.filter(r => !ficheIds.includes(r.fiche_id));
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/chantiers/:id/gestion', (req, res) => {
  const data = readData();
  const c = data.chantiers.find(x => x.id === req.params.id);
  if (c) c.gestion_date = req.body.gestion_date;
  writeData(data);
  res.json({ ok: true });
});

// ── FICHES ST ──────────────────────────────────────────────
app.get('/api/chantiers/:id/fiches', (req, res) => {
  const data = readData();
  const fiches = data.fiches.filter(f => f.chantier_id === req.params.id);
  fiches.forEach(f => {
    f.budget   = data.budget.filter(r => r.fiche_id === f.id).sort((a,b) => a.ordre - b.ordre);
    f.depenses = data.depenses.filter(r => r.fiche_id === f.id).sort((a,b) => a.ordre - b.ordre);
    f.aleas    = data.aleas.filter(r => r.fiche_id === f.id).sort((a,b) => a.ordre - b.ordre);
  });
  res.json(fiches.sort((a,b) => a.created_at > b.created_at ? 1 : -1));
});

app.post('/api/fiches', (req, res) => {
  const data = readData();
  const { id, chantier_id, nom, lot, dgd, budget, depenses } = req.body;
  data.fiches.push({ id, chantier_id, nom, lot, dgd, fdc_m1: 0, created_at: new Date().toISOString() });
  (budget || []).forEach((r, i) => {
    data.budget.push({ id: uid(), fiche_id: id, desig: r.desig||'', bp0: r.bp0||0, sup: r.sup||0, transf: r.transf||0, ordre: i });
  });
  (depenses || []).forEach((r, i) => {
    data.depenses.push({ id: uid(), fiche_id: id, qui: r.qui||'', desig: r.desig||'', pm: r.pm||0, marche: r.marche||0, av: r.av||0, nav: r.nav||'', rad: r.rad||0, ordre: i });
  });
  writeData(data);
  res.json({ ok: true });
});

app.delete('/api/fiches/:id', (req, res) => {
  const data = readData();
  const id = req.params.id;
  data.fiches = data.fiches.filter(f => f.id !== id);
  data.budget = data.budget.filter(r => r.fiche_id !== id);
  data.depenses = data.depenses.filter(r => r.fiche_id !== id);
  data.aleas = data.aleas.filter(r => r.fiche_id !== id);
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/fiches/:id/dgd', (req, res) => {
  const data = readData();
  const f = data.fiches.find(x => x.id === req.params.id);
  if (f) f.dgd = req.body.dgd;
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/fiches/:id/fdcm1', (req, res) => {
  const data = readData();
  const f = data.fiches.find(x => x.id === req.params.id);
  if (f) f.fdc_m1 = req.body.fdc_m1;
  writeData(data);
  res.json({ ok: true });
});

// ── BUDGET ─────────────────────────────────────────────────
app.post('/api/fiches/:id/budget', (req, res) => {
  const data = readData();
  const count = data.budget.filter(r => r.fiche_id === req.params.id).length;
  data.budget.push({ id: uid(), fiche_id: req.params.id, desig: '', bp0: 0, sup: 0, transf: 0, ordre: count });
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/budget/:id', (req, res) => {
  const data = readData();
  const r = data.budget.find(x => x.id === req.params.id);
  if (r) Object.assign(r, req.body);
  writeData(data);
  res.json({ ok: true });
});

app.delete('/api/budget/:id', (req, res) => {
  const data = readData();
  data.budget = data.budget.filter(r => r.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ── DÉPENSES ───────────────────────────────────────────────
app.post('/api/fiches/:id/dep', (req, res) => {
  const data = readData();
  const count = data.depenses.filter(r => r.fiche_id === req.params.id).length;
  data.depenses.push({ id: uid(), fiche_id: req.params.id, qui: '', desig: '', pm: 0, marche: 0, av: 0, nav: '', rad: 0, ordre: count });
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/dep/:id', (req, res) => {
  const data = readData();
  const r = data.depenses.find(x => x.id === req.params.id);
  if (r) Object.assign(r, req.body);
  writeData(data);
  res.json({ ok: true });
});

app.delete('/api/dep/:id', (req, res) => {
  const data = readData();
  data.depenses = data.depenses.filter(r => r.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ── ALÉAS ──────────────────────────────────────────────────
app.post('/api/fiches/:id/aleas', (req, res) => {
  const data = readData();
  const count = data.aleas.filter(r => r.fiche_id === req.params.id).length;
  data.aleas.push({ id: uid(), fiche_id: req.params.id, desig: '', risque: 0, opport: 0, ordre: count });
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/aleas/:id', (req, res) => {
  const data = readData();
  const r = data.aleas.find(x => x.id === req.params.id);
  if (r) Object.assign(r, req.body);
  writeData(data);
  res.json({ ok: true });
});

app.delete('/api/aleas/:id', (req, res) => {
  const data = readData();
  data.aleas = data.aleas.filter(r => r.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Suivi ST Floriot démarré sur port ${PORT}`));
