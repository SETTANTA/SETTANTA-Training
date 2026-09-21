/* SETTANTA Training · V3
   Carichi, RIR, ultima seduta, progressione (doppia progressione) e timer automatico.
   Tutto resta sul telefono (localStorage); il backup si esporta da Impostazioni. */
"use strict";

const VERSION = "3.0.0";
const BLOCK_WEEKS = 6;

/* ---------- Scheda ----------
   E(nome, muscolo, serie, rip min, rip max, recupero s, incremento kg, opzioni)
   inc = salto di carico quando chiudi il range (0 = corpo libero)
   assist = macchina assistita: progredire vuol dire TOGLIERE kg
   unit = "sec" per gli esercizi a tempo */
const E = (name, muscle, sets, lo, hi, rest, inc, o = {}) => ({ name, muscle, sets, lo, hi, rest, inc, unit: o.unit || "rip", assist: !!o.assist });

const PLAN = {
  lun: { short: "LUN", title: "Push", focus: "Petto · Spalle · Tricipiti", ex: [
    E("Panca piana bilanciere", "Petto", 3, 6, 8, 150, 2.5),
    E("Panca inclinata manubri", "Petto", 3, 8, 10, 120, 2),
    E("Shoulder press manubri", "Spalle", 3, 8, 10, 120, 2),
    E("Alzate laterali", "Spalle", 3, 12, 15, 75, 1),
    E("Pushdown al cavo", "Tricipiti", 3, 10, 12, 75, 2.5),
    E("Estensioni tricipiti sopra testa", "Tricipiti", 2, 10, 12, 75, 2.5),
  ]},
  mar: { short: "MAR", title: "Pull", focus: "Schiena · Deltoidi posteriori · Bicipiti", ex: [
    E("Trazioni assistite", "Schiena", 3, 6, 10, 150, 2.5, { assist: true }),
    E("Lat machine", "Schiena", 3, 8, 12, 120, 2.5),
    E("Pulley / rematore", "Schiena", 3, 8, 12, 120, 2.5),
    E("Reverse fly", "Deltoidi posteriori", 3, 12, 15, 75, 1),
    E("Curl alternato manubri", "Bicipiti", 3, 8, 12, 75, 1),
    E("Curl al cavo con barra", "Bicipiti", 2, 10, 12, 75, 2.5),
  ]},
  mer: { short: "MER", title: "Riposo", focus: "Recupero", ex: [] },
  gio: { short: "GIO", title: "Upper + Gambe A", focus: "Petto · Gambe · Spalle · Addome", ex: [
    E("Chest press", "Petto", 3, 8, 12, 120, 2.5),
    E("Croci cavi / manubri", "Petto", 2, 10, 15, 75, 1),
    E("Leg press", "Gambe", 3, 8, 12, 150, 5),
    E("Leg curl", "Gambe", 3, 10, 12, 90, 2.5),
    E("Alzate laterali", "Spalle", 3, 12, 15, 75, 1),
    E("Crunch al cavo", "Addome", 3, 10, 15, 60, 2.5),
  ]},
  ven: { short: "VEN", title: "Upper + Gambe B", focus: "Schiena · Gambe · Braccia", ex: [
    E("Lat machine presa neutra", "Schiena", 3, 8, 12, 120, 2.5),
    E("Rematore / pulley", "Schiena", 3, 8, 12, 120, 2.5),
    E("Romanian deadlift", "Gambe", 3, 8, 10, 150, 2.5),
    E("Leg extension", "Gambe", 3, 10, 15, 90, 2.5),
    E("Calf raise", "Polpacci", 3, 12, 15, 75, 2.5),
    E("Curl al cavo", "Bicipiti", 2, 10, 12, 75, 2.5),
    E("Pushdown", "Tricipiti", 2, 10, 12, 75, 2.5),
  ]},
  sab: { short: "SAB", title: "Spalle + Addome + Corsa", focus: "Spalle · Core · Aerobico", extra: "🏃 Corsa facile · 25–35 minuti a ritmo conversazionale", ex: [
    E("Shoulder press", "Spalle", 3, 8, 10, 120, 2),
    E("Alzate laterali", "Spalle", 4, 12, 15, 75, 1),
    E("Reverse fly", "Deltoidi posteriori", 3, 12, 15, 75, 1),
    E("Plank", "Addome", 3, 30, 60, 60, 0, { unit: "sec" }),
    E("Leg raise", "Addome", 3, 8, 12, 60, 0),
  ]},
  dom: { short: "DOM", title: "Riposo", focus: "Recupero", ex: [] },
};
const ORDER = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const ALL_EX = {};
ORDER.forEach(d => PLAN[d].ex.forEach(e => { ALL_EX[e.name] = e; }));

/* RIR bersaglio per settimana del blocco */
function rirTarget(week) {
  if (week <= 2) return { txt: "2–3", min: 2 };
  if (week <= 4) return { txt: "~2", min: 2 };
  if (week <= BLOCK_WEEKS) return { txt: "1–2", min: 1 };
  return { txt: "3–4", min: 3, deload: true };
}

/* ---------- Archivio ---------- */
const K = { settings: "st3.settings", history: "st3.history", day: "st3.day", timer: "st3.timer", draft: d => "st3.draft." + d };
function load(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast("Memoria piena: esporta un backup"); } }
function drop(key) { try { localStorage.removeItem(key); } catch {} }

/* ---------- Date e numeri ---------- */
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayIso = () => iso(new Date());
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const todayKey = () => ORDER[(new Date().getDay() + 6) % 7];
const nf = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, useGrouping: "always" });
const num = v => nf.format(v);
const toNum = s => { if (s === "" || s == null) return null; const n = parseFloat(String(s).replace(",", ".")); return isFinite(n) ? n : null; };
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
const fmtRest = s => Math.floor(s / 60) + ":" + pad(s % 60);
const dayLabel = s => parseIso(s).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const e1rm = (kg, reps) => (kg && reps ? kg * (1 + reps / 30) : 0);

/* ---------- Stato ---------- */
let settings = load(K.settings, null);
if (!settings || !settings.blockStart) { settings = { blockStart: iso(mondayOf(new Date())) }; save(K.settings, settings); }
let history = load(K.history, []);
let day = load(K.day, null) || todayKey();
let view = "oggi";
let summaryId = null;

function weekNow() {
  const days = Math.floor((mondayOf(new Date()) - parseIso(settings.blockStart)) / 864e5);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/* Bozza della seduta in corso, una per giorno della scheda */
function getDraft(d) {
  const dr = load(K.draft(d), null);
  return dr && dr.sets ? dr : { date: todayIso(), sets: {} };
}
function putDraft(d, dr) { save(K.draft(d), dr); }
function draftSet(dr, name, i) {
  dr.sets[name] = dr.sets[name] || [];
  dr.sets[name][i] = dr.sets[name][i] || { kg: "", reps: "", rir: "", done: false };
  return dr.sets[name][i];
}
const draftHasWork = dr => Object.values(dr.sets).some(a => (a || []).some(s => s && s.done));

/* Ultima seduta in cui compare l'esercizio */
function lastFor(name, beforeId) {
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i];
    if (beforeId && s.id === beforeId) continue;
    const ex = s.ex.find(x => x.name === name);
    if (ex && ex.sets.length) return { session: s, sets: ex.sets };
  }
  return null;
}
function bestE1rm(name, beforeId) {
  let best = 0;
  for (const s of history) {
    if (beforeId && s.id === beforeId) break;
    const ex = s.ex.find(x => x.name === name);
    if (ex) ex.sets.forEach(t => { best = Math.max(best, e1rm(t.kg, t.reps)); });
  }
  return best;
}

/* ---------- Progressione ----------
   Doppia progressione: resti sullo stesso carico finché TUTTE le serie arrivano
   in cima al range, poi sali di un gradino e riparti dal fondo del range. */
function suggest(ex, week) {
  const tgt = rirTarget(week);
  const last = lastFor(ex.name);
  const unit = ex.unit === "sec" ? "sec" : "rip";
  const res = { kind: "new", kg: null, reps: [], text: "" };
  if (!last) {
    res.text = ex.inc ? `Primo giro: scegli un carico che ti lasci ${tgt.txt} RIR` : `Primo giro: ${ex.lo}–${ex.hi} ${unit}, ${tgt.txt} RIR`;
    return res;
  }
  const sets = last.sets.filter(s => s.reps);
  const kg = sets.length ? (sets[0].kg || null) : null;
  const reps = sets.map(s => s.reps);
  const rirs = sets.map(s => s.rir).filter(v => v != null && v !== "");
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const allTop = sets.length >= ex.sets && reps.every(r => r >= ex.hi);
  const lowCount = reps.filter(r => r < ex.lo).length;
  const tooHard = avgRir != null && avgRir < tgt.min - 1;

  if (tgt.deload) {
    res.kind = "hold";
    res.kg = kg != null && ex.inc ? roundTo(ex.assist ? kg * 1.1 : kg * 0.9, ex.inc) : kg;
    res.reps = sets.map(() => ex.lo);
    res.text = `Scarico: ${res.kg != null ? num(res.kg) + " kg, " : ""}serie comode, lontano dal cedimento`;
    return res;
  }

  if (allTop) {
    res.kind = "up";
    res.reps = sets.map(() => ex.lo);
    if (!ex.inc) { res.text = `↑ Range chiuso: rendilo più duro (zavorra o variante) · riparti da ${ex.lo} ${unit}`; res.kg = kg; return res; }
    const step = ex.inc * (avgRir != null && avgRir >= tgt.min + 2 ? 2 : 1);
    res.kg = kg != null ? Math.max(0, ex.assist ? kg - step : kg + step) : null;
    res.text = ex.assist
      ? `↑ Togli assistenza: ${num(res.kg)} kg · riparti da ${ex.lo} rip`
      : `↑ Sali a ${num(res.kg)} kg · riparti da ${ex.lo} rip`;
    return res;
  }
  if (lowCount >= Math.ceil(sets.length / 2) && ex.inc && kg != null) {
    res.kind = "down";
    res.kg = Math.max(0, ex.assist ? kg + ex.inc : kg - ex.inc);
    res.reps = sets.map(() => ex.lo);
    res.text = `↓ Scala a ${num(res.kg)} kg: eri sotto le ${ex.lo} ${unit}`;
    return res;
  }
  res.kind = "hold";
  res.kg = kg;
  res.reps = sets.map(r => Math.min(ex.hi, r.reps + 1));
  res.text = (kg != null && ex.inc ? `= Resta a ${num(kg)} kg` : "= Stesso esercizio") + ` · +1 ${unit} per serie, fino a ${ex.hi}`;
  if (tooHard) res.text += " · ultima volta troppo vicino al cedimento";
  return res;
}
function roundTo(v, step) { return Math.round(v / step) * step; }

/* ---------- Render ---------- */
const $ = s => document.querySelector(s);
const viewEl = $("#view");

function renderHeader() {
  const w = weekNow(), t = rirTarget(w);
  const b = $("#weekBadge");
  b.classList.toggle("over", w > BLOCK_WEEKS);
  b.innerHTML = w > BLOCK_WEEKS ? `<b>SCARICO</b>blocco finito` : `<b>SETT ${w}/${BLOCK_WEEKS}</b>${t.txt} RIR`;
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x.dataset.view === view));
}

function render() {
  renderHeader();
  if (view === "storico") return renderHistory();
  if (view === "impostazioni") return renderSettings();
  renderToday();
}

function doneThisWeek(d) {
  const mon = iso(mondayOf(new Date()));
  return history.some(s => s.day === d && s.date >= mon);
}

function renderToday() {
  const p = PLAN[day], week = weekNow(), tgt = rirTarget(week);
  let h = `<div class="days">` + ORDER.map(k => `<button type="button" class="day ${k === day ? "active" : ""} ${k === todayKey() ? "today" : ""} ${doneThisWeek(k) ? "done" : ""}" data-day="${k}">${PLAN[k].short}<small>${PLAN[k].title.split(" ")[0]}</small></button>`).join("") + `</div>`;

  if (summaryId) { viewEl.innerHTML = h + summaryHtml(summaryId); return; }

  const dr = getDraft(day);
  if (dr.date !== todayIso() && draftHasWork(dr)) {
    h += `<div class="banner">Hai una seduta di <b>${esc(p.title)}</b> del ${dayLabel(dr.date)} non chiusa.
      <div class="row"><button type="button" class="btn small" data-act="save-old">Salvala nello storico</button><button type="button" class="btn small ghost" data-act="drop-old">Scarta</button></div></div>`;
  } else if (dr.date !== todayIso()) {
    drop(K.draft(day));
  }

  const total = p.ex.reduce((a, e) => a + Math.max(e.sets, (dr.sets[e.name] || []).length), 0);
  const done = p.ex.reduce((a, e) => a + (dr.sets[e.name] || []).filter(s => s && s.done).length, 0);

  h += `<div class="card"><div class="top"><div><div class="title">${esc(p.title)}</div><div class="meta">${esc(p.focus)}</div></div></div>`;
  if (!p.ex.length) {
    h += `<div class="rest">🛌 Recupero</div><div class="notes">Passeggiata tranquilla facoltativa. Dormi bene e mangia le proteine: si cresce oggi.</div></div>`;
    viewEl.innerHTML = h; return;
  }
  h += `<div class="progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div><div class="progress-txt"><span>${done}/${total} serie</span><span>target ${tgt.txt} RIR</span></div>`;

  p.ex.forEach((ex, i) => {
    const sug = suggest(ex, week);
    const last = lastFor(ex.name);
    const n = Math.max(ex.sets, (dr.sets[ex.name] || []).length);
    const unit = ex.unit === "sec" ? "sec" : "rip";
    h += `<section class="ex" data-ex="${i}">
      <div class="exhead"><div class="exname"><button type="button" data-open="${esc(ex.name)}">${i + 1}. ${esc(ex.name)} ›</button></div><div class="tag">${esc(ex.muscle)}</div></div>
      <div class="rx">${ex.sets}×${ex.lo}–${ex.hi} ${unit === "sec" ? "sec " : ""}· recupero ${fmtRest(ex.rest)}${ex.assist ? " · kg = assistenza" : ""}</div>`;
    if (last) h += `<div class="last"><span>Ultima · ${dayLabel(last.session.date)}:</span> ${setsLine(last.sets, ex)}</div>`;
    h += `<div class="hint ${sug.kind}">${esc(sug.text)}</div>
      <div class="sets"><div class="sethead"><span></span><span>KG</span><span>${unit.toUpperCase()}</span><span>RIR</span><span></span></div>`;
    for (let s = 0; s < n; s++) {
      const v = (dr.sets[ex.name] || [])[s] || {};
      const phKg = sug.kg != null ? num(sug.kg) : (ex.inc ? "" : "—");
      const phReps = sug.reps[s] != null ? sug.reps[s] : (last && last.sets[s] ? last.sets[s].reps : "");
      h += `<div class="set ${v.done ? "done" : ""}" data-s="${s}">
        <div class="n">${s + 1}</div>
        <input inputmode="decimal" enterkeyhint="next" autocomplete="off" data-f="kg" value="${esc(v.kg ?? "")}" placeholder="${esc(phKg)}" aria-label="Chili serie ${s + 1}">
        <input inputmode="numeric" enterkeyhint="next" autocomplete="off" data-f="reps" value="${esc(v.reps ?? "")}" placeholder="${esc(phReps || ex.lo + "–" + ex.hi)}" aria-label="${unit} serie ${s + 1}">
        <select data-f="rir" aria-label="RIR serie ${s + 1}">${["", "0", "1", "2", "3", "4", "5"].map(o => `<option value="${o}" ${String(v.rir ?? "") === o ? "selected" : ""}>${o === "" ? "–" : o === "5" ? "5+" : o}</option>`).join("")}</select>
        <button type="button" class="ok" data-act="tick" aria-label="Serie fatta">✓</button>
      </div>`;
    }
    h += `</div><button type="button" class="addset" data-act="addset">+ serie</button></section>`;
  });
  if (p.extra) h += `<div class="extra"><div class="exname">${esc(p.extra)}</div></div>`;
  h += `<button type="button" class="btn lime block" data-act="finish">Completa allenamento ✓</button></div>
    <div class="card notes"><b>Come si progredisce.</b> Resta sullo stesso carico finché <i>tutte</i> le serie arrivano al numero alto del range, poi sali di un gradino e riparti dal basso. RIR = ripetizioni che avevi ancora in canna. Settimane 1–2: 2–3 RIR · 3–4: ~2 RIR · 5–6: 1–2 RIR, poi una settimana di scarico.</div>`;
  viewEl.innerHTML = h;
}

function setsLine(sets, ex) {
  const u = ex && ex.unit === "sec" ? "″" : "";
  return sets.map(s => `${s.kg ? num(s.kg) + "×" : ""}${s.reps}${u}${s.rir != null && s.rir !== "" ? `<span> @${s.rir}</span>` : ""}`).join(" · ");
}

/* ---------- Chiusura seduta ---------- */
function buildSession(d, dr) {
  const p = PLAN[d];
  const ex = [];
  p.ex.forEach(e => {
    const sets = (dr.sets[e.name] || []).filter(s => s && s.done && toNum(s.reps)).map(s => ({ kg: toNum(s.kg) || 0, reps: toNum(s.reps), rir: toNum(s.rir) }));
    if (sets.length) ex.push({ name: e.name, muscle: e.muscle, sets });
  });
  const w = Math.max(1, Math.floor((mondayOf(parseIso(dr.date)) - parseIso(settings.blockStart)) / 864e5 / 7) + 1);
  return { id: Date.now().toString(36), day: d, title: p.title, date: dr.date, week: w, finishedAt: new Date().toISOString(), ex };
}
function finish(d, dr) {
  const s = buildSession(d, dr);
  if (!s.ex.length) { toast("Nessuna serie segnata con ✓"); return false; }
  history.push(s);
  history.sort((a, b) => (a.date + a.finishedAt).localeCompare(b.date + b.finishedAt));
  save(K.history, history);
  drop(K.draft(d));
  stopTimer();
  releaseWake();
  return s;
}
function summaryHtml(id) {
  const s = history.find(x => x.id === id);
  if (!s) { summaryId = null; return ""; }
  let sets = 0, vol = 0;
  const prs = [];
  s.ex.forEach(x => {
    sets += x.sets.length;
    x.sets.forEach(t => { vol += (t.kg || 0) * t.reps; });
    const prev = bestE1rm(x.name, s.id);
    const now = Math.max(...x.sets.map(t => e1rm(t.kg, t.reps)));
    if (now && prev && now > prev + 0.01) prs.push(`${esc(x.name)} · ${num(Math.round(now * 10) / 10)} kg stimati (+${num(Math.round((now - prev) * 10) / 10)})`);
  });
  return `<div class="card"><div class="title">Fatto ✓</div><div class="meta">${esc(s.title)} · ${dayLabel(s.date)} · settimana ${s.week}</div>
    <div class="stats"><div class="stat"><b>${sets}</b><span>serie</span></div><div class="stat"><b>${num(Math.round(vol))}</b><span>kg sollevati</span></div><div class="stat"><b>${prs.length}</b><span>record</span></div></div>
    ${prs.length ? `<ul class="prlist">${prs.map(p => `<li>🏆 ${p}</li>`).join("")}</ul>` : ""}
    <button type="button" class="btn block" data-act="close-summary">Chiudi</button></div>`;
}

/* ---------- Storico ---------- */
function renderHistory() {
  let h = `<div class="h2">ESERCIZI</div><div class="card">`;
  const names = Object.keys(ALL_EX).filter(n => history.some(s => s.ex.some(x => x.name === n)));
  if (!names.length) h += `<div class="empty">Ancora niente: chiudi il primo allenamento e qui vedi i progressi di ogni esercizio.</div>`;
  names.forEach(n => {
    const pts = seriesFor(n);
    const lastPt = pts[pts.length - 1], first = pts[0];
    const delta = lastPt && first && lastPt.v && first.v ? lastPt.v - first.v : 0;
    h += `<button type="button" class="exrow" data-open="${esc(n)}"><div><div class="nm">${esc(n)}</div><div class="sb">${pts.length} ${pts.length === 1 ? "seduta" : "sedute"} · ${esc(ALL_EX[n].muscle)}</div></div>
      ${sparkSvg(pts.map(p => p.v || p.reps))}
      <div class="v">${lastPt && lastPt.v ? num(Math.round(lastPt.v)) + " kg" : lastPt ? lastPt.reps + (ALL_EX[n].unit === "sec" ? "″" : " rip") : ""}${delta > 0.5 ? `<small>+${num(Math.round(delta))}</small>` : ""}</div></button>`;
  });
  h += `</div><div class="h2">SEDUTE</div><div class="card">`;
  if (!history.length) h += `<div class="empty">Nessuna seduta salvata.</div>`;
  [...history].reverse().forEach(s => {
    const n = s.ex.reduce((a, x) => a + x.sets.length, 0);
    const vol = s.ex.reduce((a, x) => a + x.sets.reduce((b, t) => b + (t.kg || 0) * t.reps, 0), 0);
    h += `<details class="sess"><summary><div><div class="d">${esc(s.title)}</div><div class="m">${dayLabel(s.date)} · sett. ${s.week}</div></div><div class="m">${n} serie<br>${num(Math.round(vol))} kg</div></summary>
      <table>${s.ex.map(x => `<tr><td>${esc(x.name)}</td><td>${setsLine(x.sets, ALL_EX[x.name])}</td></tr>`).join("")}</table>
      <div class="btnrow"><button type="button" class="btn small ghost" data-del="${s.id}">Elimina seduta</button></div></details>`;
  });
  h += `</div>`;
  viewEl.innerHTML = h;
}
/* un punto per seduta: il miglior 1RM stimato (o le ripetizioni, se a corpo libero) */
function seriesFor(name) {
  const out = [];
  history.forEach(s => {
    const ex = s.ex.find(x => x.name === name);
    if (!ex) return;
    const best = ex.sets.reduce((b, t) => (e1rm(t.kg, t.reps) > e1rm(b.kg, b.reps) || (!t.kg && t.reps > b.reps) ? t : b), ex.sets[0]);
    out.push({ date: s.date, v: e1rm(best.kg, best.reps) || 0, reps: best.reps, sets: ex.sets, week: s.week });
  });
  return out;
}
function sparkSvg(vals, w = 90, hgt = 28) {
  if (vals.length < 2 || vals.every(v => !v)) return `<svg class="spark" viewBox="0 0 ${w} ${hgt}"></svg>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (w - 4) + 2},${hgt - 3 - ((v - mn) / r) * (hgt - 6)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${hgt}"><polyline points="${pts}" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function openExercise(name) {
  const ex = ALL_EX[name]; if (!ex) return;
  const pts = seriesFor(name);
  const loaded = pts.some(p => p.v);
  const vals = pts.map(p => (loaded ? p.v : p.reps));
  let chart = "";
  if (vals.length >= 2) {
    const W = 320, H = 150, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
    const xy = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 24) + 12, H - 22 - ((v - mn) / r) * (H - 44)]);
    chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="12" x2="${W - 12}" y1="${H - 22}" y2="${H - 22}" stroke="#e4e1dc"/>
      <polyline points="${xy.map(p => p.join(",")).join(" ")}" fill="none" stroke="#111" stroke-width="2" stroke-linejoin="round"/>
      ${xy.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#111"/>`).join("")}
      <text x="12" y="14" font-size="10" fill="#7a7772">${loaded ? "1RM stimato" : "ripetizioni"} · max ${num(Math.round(mx))}${loaded ? " kg" : ""}</text></svg>`;
  }
  const sug = suggest(ex, weekNow());
  const bg = document.createElement("div");
  bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(name)}"><div class="top"><div><div class="title">${esc(name)}</div><div class="meta">${esc(ex.muscle)} · ${ex.sets}×${ex.lo}–${ex.hi} · +${num(ex.inc)} kg a gradino</div></div><button type="button" class="btn small ghost" data-close>Chiudi</button></div>
    <div class="hint ${sug.kind}">${esc(sug.text)}</div>
    ${chart || `<div class="empty">Il grafico compare dalla seconda seduta.</div>`}
    <table style="width:100%;border-collapse:collapse;font-size:13px">${[...pts].reverse().map(p => `<tr><td style="padding:7px 0;border-top:1px solid #f0ede8">${dayLabel(p.date)}<br><span style="color:#7a7772;font-size:11px">sett. ${p.week}</span></td><td style="padding:7px 0;border-top:1px solid #f0ede8;text-align:right">${setsLine(p.sets, ex)}</td></tr>`).join("")}</table></div>`;
  bg.addEventListener("click", ev => { if (ev.target === bg || ev.target.closest("[data-close]")) bg.remove(); });
  document.body.appendChild(bg);
}

/* ---------- Impostazioni ---------- */
function renderSettings() {
  const w = weekNow();
  viewEl.innerHTML = `<div class="card">
    <div class="field"><label for="bs">Inizio blocco<small>Settimana ${w} di ${BLOCK_WEEKS} · decide il RIR bersaglio</small></label><input id="bs" type="date" value="${settings.blockStart}"></div>
    <div class="field"><label>Nuovo blocco<small>Riparte da settimana 1 da questo lunedì. Lo storico resta.</small></label><button type="button" class="btn small" data-act="newblock">Ricomincia</button></div>
  </div>
  <div class="h2">BACKUP</div>
  <div class="card"><div class="notes">I dati stanno solo su questo telefono. Esporta ogni tanto il file e tienilo su iCloud Drive: se cambi telefono lo reimporti.</div>
    <div class="btnrow"><button type="button" class="btn small" data-act="export">Esporta backup</button><button type="button" class="btn small ghost" data-act="import">Importa backup</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden></div>
  <div class="h2">APP</div>
  <div class="card"><div class="notes">SETTANTA Training ${VERSION} · ${history.length} sedute salvate.<br>Il timer suona a fine recupero se il telefono non è in silenzioso; lo schermo resta acceso mentre ti alleni.</div>
    <div class="btnrow"><button type="button" class="btn small ghost" data-act="wipe">Cancella tutto</button></div></div>`;
  $("#bs").addEventListener("change", e => { if (e.target.value) { settings.blockStart = iso(mondayOf(parseIso(e.target.value))); save(K.settings, settings); render(); } });
  $("#importFile").addEventListener("change", importBackup);
}
async function exportBackup() {
  const data = { app: "settanta-training", version: VERSION, exportedAt: new Date().toISOString(), settings, history };
  const name = `settanta-training-${todayIso()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  try {
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function importBackup(ev) {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.app !== "settanta-training" || !Array.isArray(d.history)) throw new Error();
      const ids = new Set(history.map(s => s.id));
      const nuove = d.history.filter(s => !ids.has(s.id));
      if (!confirm(`Nel file ci sono ${d.history.length} sedute, ${nuove.length} nuove. Le aggiungo?`)) return;
      history = history.concat(nuove).sort((a, b) => (a.date + a.finishedAt).localeCompare(b.date + b.finishedAt));
      save(K.history, history);
      if (d.settings && d.settings.blockStart) { settings = d.settings; save(K.settings, settings); }
      toast(`${nuove.length} sedute importate`); render();
    } catch { toast("File non valido"); }
  };
  r.readAsText(f);
}

/* ---------- Timer di recupero (parte da solo quando spunti una serie) ---------- */
const T = { end: 0, total: 0, next: "", iv: null, hideAt: 0, warned: 0 };
function startRest(sec, next) {
  T.total = sec; T.end = Date.now() + sec * 1000; T.next = next; T.hideAt = 0; T.warned = 0;
  save(K.timer, { end: T.end, total: T.total, next: T.next });
  const el = $("#timer"); el.classList.add("show"); el.classList.remove("go");
  clearInterval(T.iv); T.iv = setInterval(tick, 250); tick();
}
function tick() {
  const el = $("#timer");
  const left = (T.end - Date.now()) / 1000;
  if (left > 0) {
    $("#timerLabel").textContent = "RECUPERO";
    $("#timerTime").textContent = fmtTime(left);
    $("#timerNext").textContent = T.next ? "Poi: " + T.next : "";
    $("#timerFill").style.width = Math.min(100, 100 - (left / T.total) * 100) + "%";
    const s = Math.ceil(left);
    if (s <= 3 && s !== T.warned) { T.warned = s; beep(660, 0.08); }
    return;
  }
  if (!el.classList.contains("go")) {
    el.classList.add("go");
    $("#timerLabel").textContent = "RECUPERO FINITO";
    $("#timerTime").textContent = "VAI ▶";
    $("#timerFill").style.width = "100%";
    beep(990, 0.25); setTimeout(() => beep(990, 0.25), 320);
    try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch {}
    T.hideAt = Date.now() + 15000;
  }
  if (T.hideAt && Date.now() > T.hideAt) stopTimer();
}
function stopTimer() { clearInterval(T.iv); T.iv = null; T.end = 0; drop(K.timer); $("#timer").classList.remove("show", "go"); }
function restoreTimer() {
  const t = load(K.timer, null);
  if (t && t.end > Date.now() - 15000) { T.total = t.total; T.end = t.end; T.next = t.next; $("#timer").classList.add("show"); clearInterval(T.iv); T.iv = setInterval(tick, 250); tick(); }
  else drop(K.timer);
}

let actx = null;
function unlockAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch {}
}
function beep(freq, dur) {
  if (!actx || document.hidden) return;
  try {
    const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime;
    o.frequency.value = freq; o.type = "sine";
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch {}
}

/* Schermo acceso durante la seduta */
let wake = null;
async function holdWake() { try { if (!wake && "wakeLock" in navigator) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch {} }
function releaseWake() { try { wake && wake.release(); } catch {} wake = null; }

/* ---------- Eventi ---------- */
document.querySelector(".tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-view]"); if (!b) return;
  view = b.dataset.view; render(); window.scrollTo(0, 0);
});
$("#weekBadge").addEventListener("click", () => { view = "impostazioni"; render(); });
$("#timer").addEventListener("click", e => {
  const b = e.target.closest("button[data-t]"); if (!b) return;
  if (b.dataset.t === "stop") return stopTimer();
  if (!T.end) return;
  const d = Number(b.dataset.t);
  if ($("#timer").classList.contains("go")) { startRest(Math.max(5, d), T.next); return; }
  T.end = Math.max(Date.now() + 1000, T.end + d * 1000); T.total = Math.max(T.total + d, 1);
  save(K.timer, { end: T.end, total: T.total, next: T.next }); tick();
});

viewEl.addEventListener("click", e => {
  const t = e.target;
  const dayBtn = t.closest("[data-day]");
  if (dayBtn) { day = dayBtn.dataset.day; save(K.day, day); summaryId = null; render(); return; }
  const open = t.closest("[data-open]");
  if (open) { openExercise(open.dataset.open); return; }
  const del = t.closest("[data-del]");
  if (del) {
    if (confirm("Elimino questa seduta dallo storico?")) { history = history.filter(s => s.id !== del.dataset.del); save(K.history, history); render(); }
    return;
  }
  const act = t.closest("[data-act]"); if (!act) return;
  const a = act.dataset.act;

  if (a === "tick") return tickSet(act);
  if (a === "addset") {
    const i = Number(act.closest(".ex").dataset.ex), ex = PLAN[day].ex[i], dr = getDraft(day);
    const n = Math.max(ex.sets, (dr.sets[ex.name] || []).length);
    draftSet(dr, ex.name, n); if (dr.date !== todayIso()) dr.date = todayIso(); putDraft(day, dr); render(); return;
  }
  if (a === "finish") {
    const dr = getDraft(day);
    if (!draftHasWork(dr)) { toast("Spunta ✓ almeno una serie"); return; }
    const s = finish(day, dr); if (s) { summaryId = s.id; render(); window.scrollTo(0, 0); }
    return;
  }
  if (a === "close-summary") { summaryId = null; render(); return; }
  if (a === "save-old") { const s = finish(day, getDraft(day)); if (s) { toast("Seduta salvata"); render(); } return; }
  if (a === "drop-old") { if (confirm("Scarto la seduta non chiusa?")) { drop(K.draft(day)); render(); } return; }
  if (a === "newblock") { if (confirm("Nuovo blocco da questa settimana?")) { settings.blockStart = iso(mondayOf(new Date())); save(K.settings, settings); render(); } return; }
  if (a === "export") return exportBackup();
  if (a === "import") return $("#importFile").click();
  if (a === "wipe") {
    if (confirm("Cancello TUTTI i dati (storico compreso)?") && confirm("Sicuro? Senza backup non si recuperano.")) {
      Object.keys(localStorage).filter(k => k.startsWith("st3.")).forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  }
});

/* salvataggio dei campi mentre scrivi, senza ridisegnare (il fuoco resta dov'è) */
viewEl.addEventListener("input", e => {
  const f = e.target.dataset.f; if (!f) return;
  const row = e.target.closest(".set"), exEl = e.target.closest(".ex");
  const ex = PLAN[day].ex[Number(exEl.dataset.ex)], dr = getDraft(day);
  if (dr.date !== todayIso() && !draftHasWork(dr)) dr.date = todayIso();
  draftSet(dr, ex.name, Number(row.dataset.s))[f] = e.target.value.trim();
  putDraft(day, dr);
});
viewEl.addEventListener("change", e => { if (e.target.dataset.f === "rir") e.target.dispatchEvent(new Event("input", { bubbles: true })); });

function tickSet(btn) {
  unlockAudio();
  const row = btn.closest(".set"), exEl = btn.closest(".ex");
  const i = Number(exEl.dataset.ex), s = Number(row.dataset.s);
  const plan = PLAN[day], ex = plan.ex[i], dr = getDraft(day);
  if (dr.date !== todayIso() && !draftHasWork(dr)) dr.date = todayIso();
  const v = draftSet(dr, ex.name, s);
  if (v.done) { v.done = false; putDraft(day, dr); render(); return; }

  /* campi vuoti: prende il valore suggerito (il grigio nel campo) */
  const kgIn = row.querySelector('[data-f="kg"]'), repIn = row.querySelector('[data-f="reps"]');
  if (!v.kg && toNum(kgIn.placeholder) != null) v.kg = kgIn.placeholder;
  if (!v.reps && toNum(repIn.placeholder) != null && !/–/.test(repIn.placeholder)) v.reps = repIn.placeholder;
  if (ex.inc && !toNum(v.kg)) { putDraft(day, dr); kgIn.focus(); toast("Scrivi i kg"); return; }
  if (!toNum(v.reps)) { putDraft(day, dr); repIn.focus(); toast(ex.unit === "sec" ? "Scrivi i secondi" : "Scrivi le ripetizioni"); return; }
  v.done = true;

  /* la serie dopo eredita i kg, se è ancora vuota */
  const n = Math.max(ex.sets, dr.sets[ex.name].length);
  if (s + 1 < n) { const nx = draftSet(dr, ex.name, s + 1); if (!nx.kg && !nx.done) nx.kg = v.kg; }
  putDraft(day, dr);
  holdWake();

  /* timer automatico: recupero dell'esercizio, con la prossima cosa da fare */
  let next = "";
  if (s + 1 < n) next = `${ex.name} · serie ${s + 1 + 1}`;
  else if (plan.ex[i + 1]) next = plan.ex[i + 1].name;
  const allDone = plan.ex.every(e => { const a = dr.sets[e.name] || []; return a.length >= e.sets && a.every(x => x && x.done); });
  if (allDone) { stopTimer(); toast("Ultima serie fatta 💪 Chiudi l'allenamento"); }
  else startRest(ex.rest, next);
  render();
}

/* ---------- Avviso breve ---------- */
let toastEl = null, toastT = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.style.cssText = "position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 14px);transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;font-weight:600;z-index:60;box-shadow:0 8px 24px #0004;transition:opacity .2s;max-width:90vw;text-align:center";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg; toastEl.style.opacity = "1";
  clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = "0"; }, 2200);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (T.end) tick();
  if (view === "oggi" && !summaryId && Object.keys(getDraft(day).sets).length && getDraft(day).date === todayIso()) holdWake();
});

/* pulizia della V2: le spunte senza carichi non servono più */
try { Object.keys(localStorage).filter(k => /^(done_|finished_)/.test(k) || k === "day").forEach(k => localStorage.removeItem(k)); } catch {}

render();
restoreTimer();

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
