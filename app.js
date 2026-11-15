import { decifra } from "./decifra.mjs";

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const ORDINE_SEMAFORO = { rosso: 0, giallo: 1, verde: 2, grigio: 3 };
const ETICHETTA_SEMAFORO = { verde: "In linea", giallo: "Da guardare", rosso: "Fuori piano", grigio: "Senza dati" };
const $ = (s, el = document) => el.querySelector(s);
const migliaia = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");  // "1.811" anche a 4 cifre
const euro = (x) => (x == null ? "—" : migliaia(x) + " €");
const perc = (x) => (x == null ? "—" : x.toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const somma = (o) => (o ? Object.values(o).reduce((a, b) => a + (b || 0), 0) : 0);
let DATI = null;

$("#form-password").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#errore-password");
  err.hidden = true;
  $("#apri").disabled = true;
  $("#apri").textContent = "Apro…";
  try {
    const pacchetto = await (await fetch("data.enc", { cache: "no-store" })).json();
    DATI = JSON.parse(await decifra(pacchetto, $("#password").value));
    $("#password").value = "";
    $("#blocco").hidden = true;
    $("#contenuto").hidden = false;
    disegna();
  } catch {
    err.textContent = "Password errata o dati non leggibili.";
    err.hidden = false;
  } finally {
    $("#apri").disabled = false;
    $("#apri").textContent = "Apri";
  }
});
window.addEventListener("hashchange", () => DATI && disegna());

function disegna() {
  const nome = decodeURIComponent((location.hash.match(/^#s=(.+)$/) || [])[1] || "");
  if (nome && DATI.strutture[nome]) scheda(nome); else panoramica();
  window.scrollTo(0, 0);
}

function testata(titolo) {
  const avvisi = DATI.avvisi.length ? `<ul class="avvisi">${DATI.avvisi.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "";
  return `<header class="testata"><h1>${esc(titolo)}${DATI.demo ? '<span class="demo">DEMO</span>' : ""}</h1>
    <p>Aggiornata al ${esc(DATI.generato_il)} · mesi chiusi: ${DATI.mesi_chiusi.length ? DATI.mesi_chiusi.map((m) => MESI[+m.slice(5) - 1]).join(", ") : "nessuno"}</p></header>${avvisi}`;
}

function kpi(voci) {
  return `<div class="kpi">${voci.map(([t, v, n]) => `<div><span>${t}</span><strong class="num">${v}</strong>${n ? `<small>${n}</small>` : ""}</div>`).join("")}</div>`;
}

function panoramica() {
  const r = Object.entries(DATI.roster);
  const tot = (k) => r.reduce((a, [, x]) => a + (x[k] || 0), 0);
  const approvato = tot("annuo_approvato"), speso = tot("speso");
  r.sort((a, b) => ORDINE_SEMAFORO[a[1].semaforo] - ORDINE_SEMAFORO[b[1].semaforo] || a[0].localeCompare(b[0]));
  const righe = r.map(([n, x]) => `<tr class="riga" data-nome="${esc(n)}" tabindex="0">
      <td><button class="nome-struttura" data-nome="${esc(n)}">${esc(n)}</button></td>
      <td data-etichetta="Stato"><span class="semaforo ${x.semaforo}">${ETICHETTA_SEMAFORO[x.semaforo]}</span></td>
      <td class="dx num" data-etichetta="Speso / budget"><div class="cella-speso">${euro(x.speso)} <span class="etichetta-na">/ ${euro(x.annuo_approvato)}</span>
        <div class="barra" aria-hidden="true"><i style="--w:${Math.min(x.perc_speso, 100)}%"></i></div></div></td>
      <td class="dx num" data-etichetta="% speso · residuo">${perc(x.perc_speso)} · ${perc(x.perc_residuo)}</td>
      <td class="dx num" data-etichetta="Scarto sul piano">${x.scarto_pct == null ? "—" : (x.scarto_pct > 0 ? "+" : "") + perc(x.scarto_pct)}</td>
      <td class="dx num" data-etichetta="Proiezione dicembre">${euro(x.proiezione)}</td>
      <td class="dx num" data-etichetta="Canali non attivi">${x.non_attivi_euro ? euro(x.non_attivi_euro) : "—"}</td>
    </tr>`).join("");
  $("#contenuto").innerHTML = testata("Spesa ADV 2027") + kpi([
    ["Budget approvato", euro(approvato)],
    ["Speso finora", euro(speso), perc(approvato ? (speso / approvato) * 100 : 0) + " del budget"],
    ["Proiezione a dicembre", euro(tot("proiezione"))],
    ["Su canali non attivi", euro(tot("non_attivi_euro")), "stanziati, non spendibili"],
    ["Persi per cause tecniche", euro(tot("euro_persi_tecnici")), "dal diario"],
  ]) + `<section class="card"><h2>Strutture</h2>
    <table class="roster"><thead><tr><th>Struttura</th><th>Stato</th><th class="dx">Speso / budget</th><th class="dx">% speso · residuo</th>
    <th class="dx">Scarto sul piano</th><th class="dx">Proiezione dic.</th><th class="dx">Canali non attivi</th></tr></thead>
    <tbody>${righe}</tbody></table>
    <p class="vuoto">Stato: scarto tra speso e piano spendibile dei mesi chiusi · in linea entro ±10%, da guardare fino a ±25%, oltre fuori piano. Un mese conta solo quando la spesa di tutti i canali è stata letta per intero.</p></section>` + nonAttribuito();
  requestAnimationFrame(() => document.querySelectorAll(".barra i").forEach((i) => (i.style.width = i.style.getPropertyValue("--w"))));
  document.querySelectorAll("tr.riga").forEach((tr) => {
    const vai = () => (location.hash = "s=" + encodeURIComponent(tr.dataset.nome));
    tr.addEventListener("click", vai);
    tr.addEventListener("keydown", (e) => e.key === "Enter" && vai());
  });
}

function nonAttribuito() {
  const righe = [];
  for (const [mese, canali] of Object.entries(DATI.non_attribuito || {}))
    for (const [canale, lista] of Object.entries(canali || {}))
      for (const r of lista || []) righe.push(`<li><b>${esc(r.campaign_name || "campagna senza nome")}</b> · ${euro(+r.spend)}
        <small>${MESI[+mese.slice(5) - 1]} ${mese.slice(0, 4)} · ${canale === "meta" ? "Meta" : "TikTok"} · account ${esc(r.account || r.advertiser_id || "")}</small></li>`);
  if (!righe.length) return "";
  return `<section class="card"><h2>Spesa non attribuita</h2><p class="vuoto">Campagne di account condivisi senza il nome di una struttura: non sono contate in nessuna struttura.</p><ul class="elenco">${righe.join("")}</ul></section>`;
}

function scheda(nome) {
  const r = DATI.roster[nome], s = DATI.strutture[nome];
  const lista = (voci, vuoto) => (voci.length ? `<ul class="elenco">${voci.join("")}</ul>` : `<p class="vuoto">${vuoto}</p>`);
  const diario = s.diario.map((v) => `<li><span class="pill">${esc(v.categoria)}</span> <b>${esc(v.piattaforma)}</b> · ${esc(v.descrizione)}
      <small>dal ${esc(v.dal)}${v.al ? " al " + esc(v.al) : " · aperta"}${v.soluzione ? " · " + esc(v.soluzione) : ""}${v.euro_non_spesi ? " · " + euro(v.euro_non_spesi) + " non spesi" : ""}</small></li>`);
  const na = s.non_attivi.map((x) => `<li><b>${x.canale === "meta" ? "Meta" : "TikTok"}</b> previsto e non attivo · ${euro(x.euro)}
      <small>mesi ${x.mesi.map((m) => MESI[m - 1]).join(", ")}</small></li>`);
  const ped = s.ped_del_mese.map((p) => `<li>${esc(p.nome)} <span class="pill">${esc(p.esito)}</span></li>`);
  const a = s.account;
  const account = a ? `<p class="vuoto">Meta: stato ${a.account_status === 1 ? "attivo" : esc(a.account_status)} · speso a vita ${euro((+a.amount_spent || 0) / 100)}${+a.spend_cap ? " · limite " + euro(+a.spend_cap / 100) : ""}</p>` : `<p class="vuoto">Nessun dato account.</p>`;
  const t = s.target;
  const target = t ? `<p class="vuoto">${esc(t.obiettivo)} · età ${esc(t.eta)} · ${esc(t.target)}${t.interessi ? " · " + esc(t.interessi) : ""}</p>` : `<p class="vuoto">Nessun target nel piano.</p>`;
  $("#contenuto").innerHTML = `<button class="indietro" onclick="location.hash=''">← Tutte le strutture</button>` + testata(nome) + kpi([
    ["Stato", `<span class="semaforo ${r.semaforo}">${ETICHETTA_SEMAFORO[r.semaforo]}</span>`, r.scarto_pct == null ? "" : `scarto ${r.scarto_pct > 0 ? "+" : ""}${perc(r.scarto_pct)}`],
    ["Budget approvato", euro(r.annuo_approvato), `livello ${esc(s.livello)}`],
    ["Speso finora", euro(r.speso), `${perc(r.perc_speso)} speso · ${perc(r.perc_residuo)} residuo`],
    ["Proiezione a dicembre", euro(r.proiezione)],
    ["Persi per cause tecniche", euro(r.euro_persi_tecnici)],
  ]) + `<div class="griglia-2">
      <section class="card"><h2>Piano e speso per mese</h2>
        <div class="legenda"><span><i style="background:var(--series-1)"></i>Speso Meta</span>${s.mesi.some((m) => m.spendibile.tiktok || m.speso?.tiktok) ? '<span><i style="background:var(--series-2)"></i>Speso TikTok</span>' : ""}<span><i class="piano"></i>Piano spendibile</span></div>
        ${graficoMesi(s.mesi)}
        <details><summary>Tabella</summary>${tabella(s.mesi)}</details></section>
      <section class="card"><h2>Andamento da gennaio</h2>
        <div class="legenda"><span><i style="background:var(--series-1)"></i>Speso cumulato</span><span><i class="piano"></i>Piano cumulato</span></div>
        ${graficoCumulato(s.mesi)}</section>
    </div>
    <div class="griglia-2">
      <section class="card"><h2>Diario</h2>${lista(diario, "Nessun problema annotato.")}</section>
      <section class="card"><h2>Canali previsti non attivi</h2>${lista(na, "Nessuno: tutti i canali previsti sono attivi.")}
        <h3 style="margin-top:16px">PED del mese</h3>${lista(ped, "Nessun PED del mese passato dalla task.")}
        <h3 style="margin-top:16px">Account</h3>${account}<h3 style="margin-top:16px">Target</h3>${target}</section>
    </div>`;
  collegaTooltip();
}

function tabella(mesi) {
  return `<table class="tabella-dati"><thead><tr><th>Mese</th><th>Piano</th><th>Spendibile</th><th>Speso Meta</th><th>Speso TikTok</th><th>Stato</th></tr></thead><tbody>${mesi.map((m, i) => `<tr><td>${MESI[i]}</td><td class="num">${euro(somma(m.piano))}</td><td class="num">${euro(somma(m.spendibile))}</td><td class="num">${m.speso ? euro(m.speso.meta) : "—"}</td><td class="num">${m.speso ? euro(m.speso.tiktok) : "—"}</td><td>${m.stato.replace("_", " ")}</td></tr>`).join("")}</tbody></table>`;
}

function scalaY(max, h) {
  const passo = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000].find((p) => (max || 1) / p <= 5) || 100000;
  const top = Math.max(passo, Math.ceil((max || 1) / passo) * passo);
  return { top, tacche: Array.from({ length: Math.round(top / passo) + 1 }, (_, i) => i * passo), y: (v) => h - (v / top) * h };
}

function graficoMesi(mesi) {
  const W = 640, H = 220, L = 46, B = 24, w = W - L - 8, h = H - B - 8, slot = w / 12, bw = Math.min(26, slot * 0.55);
  const max = Math.max(...mesi.map((m) => Math.max(somma(m.spendibile), somma(m.speso))));
  const s = scalaY(max, h);
  let svg = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Piano e speso per mese">`;
  s.tacche.forEach((t) => (svg += `<line class="griglia" x1="${L}" x2="${W - 8}" y1="${8 + s.y(t)}" y2="${8 + s.y(t)}"/><text class="asse" x="${L - 6}" y="${12 + s.y(t)}" text-anchor="end">${t >= 1000 ? t / 1000 + "k" : t}</text>`));
  mesi.forEach((m, i) => {
    const cx = L + slot * i + slot / 2, x = cx - bw / 2;
    const meta = m.speso?.meta || 0, tt = m.speso?.tiktok || 0, piano = somma(m.spendibile);
    if (m.speso) {
      const yMeta = 8 + s.y(meta), yTot = 8 + s.y(meta + tt);
      if (meta) svg += barraArrotondata(x, yMeta, bw, 8 + h - yMeta, "barra-meta", !tt);
      if (tt) svg += barraArrotondata(x, yTot, bw, yMeta - yTot - (meta ? 2 : 0), "barra-tiktok", true);
    }
    if (piano) svg += `<line class="segno-piano" x1="${x - 4}" x2="${x + bw + 4}" y1="${8 + s.y(piano)}" y2="${8 + s.y(piano)}"/>`;
    svg += `<text class="asse" x="${cx}" y="${H - 6}" text-anchor="middle">${MESI[i]}</text>`;
    const mancanti = m.speso ? ["meta", "tiktok"].filter((c) => m.spendibile[c] && m.speso[c] == null) : [];
    const testo = `<b>${MESI[i]} 2027</b>Piano spendibile ${euro(piano)}<br>${m.speso ? `Speso ${euro(meta + tt)} (Meta ${euro(meta)}, TikTok ${euro(tt)})` : "Spesa non ancora raccolta"}${mancanti.length ? `<br><i>${mancanti.join(", ")} non letto</i>` : m.stato === "parziale" ? "<br><i>dati parziali</i>" : ""}`;
    svg += `<rect class="bersaglio" x="${L + slot * i}" y="8" width="${slot}" height="${h}" data-tip="${esc(testo)}"/>`;
  });
  return svg + "</svg>";
}

function barraArrotondata(x, y, w, h, cls, arrotonda) {
  if (h <= 0) return "";
  const r = arrotonda ? Math.min(4, h) : 0;
  return `<path class="${cls}" d="M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z"/>`;
}

function graficoCumulato(mesi) {
  const W = 640, H = 220, L = 52, B = 24, w = W - L - 16, h = H - B - 8, dx = w / 11;
  let cp = 0, cs = 0;
  const piano = mesi.map((m) => (cp += somma(m.spendibile)));
  const speso = mesi.map((m) => (m.speso ? (cs += somma(m.speso)) : null));
  const s = scalaY(Math.max(...piano, ...speso.filter((v) => v != null)), h);
  const px = (i) => L + dx * i, py = (v) => 8 + s.y(v);
  let svg = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Speso e piano cumulati">`;
  s.tacche.forEach((t) => (svg += `<line class="griglia" x1="${L}" x2="${W - 16}" y1="${py(t)}" y2="${py(t)}"/><text class="asse" x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${t >= 1000 ? t / 1000 + "k" : t}</text>`));
  MESI.forEach((m, i) => (svg += `<text class="asse" x="${px(i)}" y="${H - 6}" text-anchor="middle">${m}</text>`));
  svg += `<polyline class="linea-piano" points="${piano.map((v, i) => `${px(i)},${py(v)}`).join(" ")}"/>`;
  const pts = speso.map((v, i) => (v == null ? null : `${px(i)},${py(v)}`)).filter(Boolean);
  if (pts.length) {
    svg += `<polyline class="linea-speso" points="${pts.join(" ")}"/>`;
    const ultimo = speso.reduce((a, v, i) => (v == null ? a : i), -1);
    svg += `<circle class="punto" cx="${px(ultimo)}" cy="${py(speso[ultimo])}" r="5"/>`;
    svg += `<text class="etichetta-diretta" x="${px(ultimo) + 8}" y="${py(speso[ultimo]) - 8}">${euro(speso[ultimo])}</text>`;
  }
  mesi.forEach((m, i) => {
    const testo = `<b>${MESI[i]} 2027 · da gennaio</b>Piano ${euro(piano[i])}<br>${speso[i] == null ? "Spesa non ancora raccolta" : "Speso " + euro(speso[i])}`;
    svg += `<rect class="bersaglio" x="${px(i) - dx / 2}" y="8" width="${dx}" height="${h}" data-tip="${esc(testo)}" data-x="${px(i)}"/>`;
  });
  return svg + `<line class="crosshair" x1="0" x2="0" y1="8" y2="${8 + h}" hidden/></svg>`;
}

function collegaTooltip() {
  const tip = $("#tooltip");
  document.querySelectorAll(".bersaglio").forEach((r) => {
    const mostra = (e) => {
      tip.innerHTML = r.dataset.tip;
      tip.hidden = false;
      const x = (e.clientX ?? r.getBoundingClientRect().x) + 14, y = (e.clientY ?? r.getBoundingClientRect().y) + 14;
      tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 8) + "px";
      tip.style.top = Math.min(y, window.innerHeight - tip.offsetHeight - 8) + "px";
      const ch = r.ownerSVGElement.querySelector(".crosshair");
      if (ch && r.dataset.x) { ch.setAttribute("x1", r.dataset.x); ch.setAttribute("x2", r.dataset.x); ch.hidden = false; ch.removeAttribute("hidden"); }
    };
    r.addEventListener("mousemove", mostra);
    r.addEventListener("click", mostra);
    r.addEventListener("mouseleave", () => {
      tip.hidden = true;
      const ch = r.ownerSVGElement.querySelector(".crosshair");
      if (ch) ch.setAttribute("hidden", "");
    });
  });
}
