const TYPE_COLORS = {
  normal: "#a8a878", fire: "#f08030", water: "#6890f0", electric: "#f8d030",
  grass: "#78c850", ice: "#98d8d8", fighting: "#c03028", poison: "#a040a0",
  ground: "#e0c068", flying: "#a890f0", psychic: "#f85888", bug: "#a8b820",
  rock: "#b8a038", ghost: "#705898", dragon: "#7038f8", dark: "#705848",
  steel: "#b8b8d0", fairy: "#ee99ac",
};

let pokemonList = [];
let selectedId = null;
let view = "box";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const DEFAULT_CUSTOM_SPRITE = "Substitute.png";
function spriteSrc(p) {
  return p.sprite || DEFAULT_CUSTOM_SPRITE;
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed (HTTP " + res.status + " on " + path + ")");
  return data;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.add("hidden"), 2200);
}

// ---------- Data loading ----------
async function loadList() {
  pokemonList = await api("/api/pokemon");
  render();
  loadTeamSummary();
}

async function loadTeamSummary() {
  try {
    const s = await api("/api/team/summary");
    const weakEntries = Object.entries(s.weakCount || {}).filter(([, n]) => n >= 2);
    const weakHtml = weakEntries.length
      ? weakEntries.map(([t, n]) => `<span class="weak-chip">${t} x${n}</span>`).join(" ")
      : `<span style="opacity:.7">no shared weaknesses</span>`;
    $("bottomBar").innerHTML = `
      <strong>PARTY ${s.size}/${s.max}</strong>
      <span>HP ${s.totalStats.hp ?? 0} · ATK ${s.totalStats.attack ?? 0} · DEF ${s.totalStats.defense ?? 0}</span>
      <span>Team weak to: ${weakHtml}</span>
    `;
  } catch {
    $("bottomBar").innerHTML = "";
  }
}

// ---------- Rendering: box / party ----------
function render() {
  $("boxNav").classList.toggle("hidden", view === "party");
  $("viewToggleBtn").textContent = view === "box" ? "PARTY POKéMON" : "BOX";
  $("addBtn").classList.toggle("hidden", view === "party");
  $("customBtn").classList.toggle("hidden", view === "party");

  const grid = $("boxGrid");
  grid.className = view === "box" ? "box-grid" : "party-list";
  grid.innerHTML = "";

  if (view === "box") {
    const boxed = pokemonList
      .filter((p) => !p.inTeam)
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    if (!boxed.length) {
      grid.innerHTML = `<div class="empty-box-msg">Box is empty. Use CLOSE BOX / ADD POKéMON to deposit one!</div>`;
    }
    boxed.forEach((p) => {
      const tile = document.createElement("div");
      tile.className =
        "mon-tile" + (p.id === selectedId ? " selected" : "") + (p.favorite ? " favorite" : "");
      tile.innerHTML = `<img src="${esc(spriteSrc(p))}" alt="${esc(p.name)}" />${
        p.favorite ? '<span class="fav-badge">★</span>' : ""
      }`;
      tile.onclick = () => selectPokemon(p.id);
      grid.appendChild(tile);
    });
  } else {
    const team = pokemonList.filter((p) => p.inTeam);
    team.forEach((p) => {
      const row = document.createElement("div");
      row.className =
        "party-row" + (p.id === selectedId ? " selected" : "") + (p.favorite ? " favorite" : "");
      row.innerHTML = `
        <img src="${esc(spriteSrc(p))}" alt="${esc(p.name)}" />
        <span class="p-name">${esc((p.nickname || p.name).toUpperCase())}${
        p.favorite ? ' <span class="party-fav-badge">★</span>' : ""
      }</span>
        <span class="p-lvl">Lv${p.level}</span>
      `;
      row.onclick = () => selectPokemon(p.id);
      grid.appendChild(row);
    });
    for (let i = team.length; i < 6; i++) {
      const slot = document.createElement("div");
      slot.className = "party-empty-slot";
      slot.textContent = "— empty slot —";
      grid.appendChild(slot);
    }
  }
}

const STAT_ORDER = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

// stat formula (perfect IVs, 0 EVs, neutral nature) so stats grow with level
function calcStatAtLevel(base, level, isHp) {
  const IV = 31, EV = 0;
  const core = Math.floor(((2 * base + IV + Math.floor(EV / 4)) * level) / 100);
  return isHp ? core + level + 10 : core + 5;
}

function statsBlockHtml(baseStats, level) {
  return STAT_ORDER.filter((s) => baseStats[s] !== undefined)
    .map((s) => {
      const val = calcStatAtLevel(baseStats[s], level, s === "hp");
      const pct = Math.min(100, Math.round((val / 400) * 100));
      return `<div class="stat-row"><span>${s}</span><span>${val}</span></div>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>`;
    })
    .join("");
}

// ---------- Selecting a Pokémon: data panel + actions ----------
async function selectPokemon(id) {
  selectedId = id;
  render();
  const p = pokemonList.find((x) => x.id === id);
  if (!p) return;

  $("dataSprite").src = spriteSrc(p);
  $("dataSprite").classList.remove("hidden-sprite");

  const typeChips = p.types
    .map((t) => `<span class="type-chip" style="background:${TYPE_COLORS[t] || "#888"}">${t}</span>`)
    .join("");

  $("dataInfo").innerHTML = `
    <div class="mon-name">${esc((p.nickname || p.name).toUpperCase())}</div>
    <div class="mon-sub">${p.pokemonId ? "#" + p.pokemonId : "CUSTOM"} ${esc(p.name)}</div>
    <div id="hwRow" class="hw-row">
      <span class="hw-chip">Height <b>…</b></span>
      <span class="hw-chip">Weight <b>…</b></span>
    </div>
    <div>${typeChips}</div>
    <div id="statsBlock">${statsBlockHtml(p.stats, p.level)}</div>
    <div class="field-row">
      <label>Nickname</label>
      <input type="text" id="fNickname" value="${esc(p.nickname)}" placeholder="${esc(p.name)}" />
    </div>
    <div class="field-row">
      <label>Level</label>
      <div class="level-input-wrap">
        <input type="number" id="fLevel" min="1" max="100" value="${p.level}" />
        <span class="fav-star ${p.favorite ? "active" : ""}" id="fFavorite" title="Favorite">★</span>
      </div>
    </div>
    <div class="field-row">
      <label>Notes</label>
      <textarea id="fNotes" placeholder="Add a note...">${esc(p.notes)}</textarea>
    </div>
    <div id="effBlock" class="eff-block"><div class="eff-loading">Checking type matchups…</div></div>
  `;

  $("fFavorite").onclick = () => {
    $("fFavorite").classList.toggle("active");
  };

  // Recompute the stat bars live as the level field changes, before Save is even clicked.
  $("fLevel").addEventListener("input", () => {
    let lvl = Number($("fLevel").value);
    if (!Number.isFinite(lvl)) return;
    lvl = Math.max(1, Math.min(100, lvl));
    $("statsBlock").innerHTML = statsBlockHtml(p.stats, lvl);
  });

  renderActions(p);
  loadEffectiveness(p.id);
  loadHeightWeight(p.pokemonId);
}

// A single type pill, e.g. "rock ×4".
function effChip(text) {
  return `<span class="eff-chip">${text}</span>`;
}

// builds the "Weak to / Resists / Immune to" panel
function effectivenessHtml(eff) {
  const weak = eff.weakTo || [];
  const resist = eff.resists || [];

  const immune = (eff.immuneTo || []).map((x) => (typeof x === "string" ? x : x.type));

  if (!weak.length && !resist.length && !immune.length) {
    return `<div class="eff-panel"><div class="eff-empty">No notable type matchups.</div></div>`;
  }

  const row = (cls, label, chipsHtml) =>
    chipsHtml
      ? `<div class="eff-row ${cls}">
           <div class="eff-label">${label}</div>
           <div class="eff-chips">${chipsHtml}</div>
         </div>`
      : "";

  return `<div class="eff-panel">
    ${row("eff-weak", "Weak to", weak.map((w) => effChip(`${w.type} ×${w.x}`)).join(""))}
    ${row("eff-resist", "Resists", resist.map((r) => effChip(`${r.type} ×${r.x}`)).join(""))}
    ${row("eff-immune", "Immune", immune.map((t) => effChip(`${t} ×0`)).join(""))}
  </div>`;
}

async function loadEffectiveness(id) {
  const target = $("effBlock");
  if (!target) return;
  try {
    const eff = await api("/api/effectiveness/" + id);
    target.innerHTML = effectivenessHtml(eff);
  } catch {

    target.innerHTML = "";
  }
}

// ---------- PokéAPI detail (height/weight/moves), cached by pokemonId ----------
const pokeApiCache = new Map();

function prettyMoveName(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function getPokeApiDetail(pokemonId) {
  if (pokeApiCache.has(pokemonId)) return pokeApiCache.get(pokemonId);

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
  if (!res.ok) throw new Error("Could not reach PokéAPI");
  const data = await res.json();

  const movesByMethod = { "level-up": [], machine: [], egg: [], tutor: [], other: [] };
  data.moves.forEach((m) => {

    const vg = m.version_group_details[m.version_group_details.length - 1];
    const method = vg ? vg.move_learn_method.name : "other";
    const level = vg ? vg.level_learned_at : 0;
    (movesByMethod[method] || movesByMethod.other).push({ name: m.move.name, level });
  });
  movesByMethod["level-up"].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  ["machine", "egg", "tutor", "other"].forEach((k) =>
    movesByMethod[k].sort((a, b) => a.name.localeCompare(b.name))
  );

  const detail = {
    heightM: data.height / 10,
    weightKg: data.weight / 10,
    movesByMethod,
  };
  pokeApiCache.set(pokemonId, detail);
  return detail;
}

async function loadHeightWeight(pokemonId) {
  const row = $("hwRow");
  if (!row) return;
  if (!pokemonId) {
    row.innerHTML = `<span class="hw-chip">Custom Pokémon</span>`;
    return;
  }
  try {
    const detail = await getPokeApiDetail(pokemonId);
    row.innerHTML = `
      <span class="hw-chip">Height <b>${detail.heightM.toFixed(1)} m</b></span>
      <span class="hw-chip">Weight <b>${detail.weightKg.toFixed(1)} kg</b></span>
    `;
  } catch {
    row.innerHTML = ""; // quietly drop it if PokéAPI is unreachable
  }
}

// ---------- Moves modal ----------
async function openMoves(p) {
  $("movesTitle").textContent = `${(p.nickname || p.name).toUpperCase()} — MOVES`;
  $("movesBody").innerHTML = `<div class="eff-loading">Loading moves…</div>`;
  $("movesModal").classList.remove("hidden");
  if (!p.pokemonId) {
    $("movesBody").innerHTML = `<div class="eff-empty">Custom Pokémon have no move data.</div>`;
    return;
  }
  try {
    const detail = await getPokeApiDetail(p.pokemonId);
    $("movesBody").innerHTML = movesHtml(detail.movesByMethod);
  } catch (e) {
    $("movesBody").innerHTML = `<span style="color:#a02020">${e.message}</span>`;
  }
}

function movesHtml(byMethod) {
  const section = (title, arr, showLevel) => {
    if (!arr.length) return "";
    const items = arr
      .map(
        (m) =>
          `<li><span>${prettyMoveName(m.name)}</span>${
            showLevel && m.level ? `<span class="move-lvl">Lv ${m.level}</span>` : ""
          }</li>`
      )
      .join("");
    return `<div class="moves-section"><h4>${title} (${arr.length})</h4><ul class="moves-list">${items}</ul></div>`;
  };

  const html =
    section("Level-up", byMethod["level-up"], true) +
    section("TM / HM", byMethod.machine, false) +
    section("Egg Moves", byMethod.egg, false) +
    section("Tutor", byMethod.tutor, false) +
    section("Other", byMethod.other, false);

  return html || `<div class="eff-empty">No move data found for this Pokémon.</div>`;
}

$("closeMovesModal").onclick = () => $("movesModal").classList.add("hidden");

function renderActions(p) {
  const tray = $("actionTray");
  tray.innerHTML = "";

  const saveBtn = document.createElement("button");
  saveBtn.className = "pill-btn pill-blue small";
  saveBtn.textContent = "SAVE";
  saveBtn.onclick = () => saveEdits(p.id);
  tray.appendChild(saveBtn);

  const teamBtn = document.createElement("button");
  teamBtn.className = "pill-btn small " + (p.inTeam ? "pill-grey" : "pill-green");
  teamBtn.textContent = p.inTeam ? "WITHDRAW FROM PARTY" : "ADD TO PARTY";
  teamBtn.onclick = () => toggleTeam(p);
  tray.appendChild(teamBtn);

  const compareBtn = document.createElement("button");
  compareBtn.className = "pill-btn pill-gold small";
  compareBtn.textContent = "COMPARE";
  compareBtn.onclick = () => openCompare(p.id);
  tray.appendChild(compareBtn);

  const movesBtn = document.createElement("button");
  movesBtn.className = "pill-btn pill-purple small";
  movesBtn.textContent = "MOVES";
  movesBtn.onclick = () => openMoves(p);
  tray.appendChild(movesBtn);

  const releaseBtn = document.createElement("button");
  releaseBtn.className = "pill-btn pill-red small";
  releaseBtn.textContent = "RELEASE";
  releaseBtn.onclick = () => releasePokemon(p.id);
  tray.appendChild(releaseBtn);
}

async function saveEdits(id) {
  const nickname = $("fNickname").value.trim();
  const level = Number($("fLevel").value);
  const notes = $("fNotes").value;
  const favorite = $("fFavorite").classList.contains("active");
  try {
    await api("/api/pokemon/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, level, notes, favorite }),
    });
    toast("Saved!");
    await loadList();
    selectPokemon(id);
  } catch (e) {
    toast(e.message);
  }
}

async function toggleTeam(p) {
  try {
    await api("/api/pokemon/" + p.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inTeam: !p.inTeam }),
    });
    toast(p.inTeam ? `${p.name} withdrawn` : `${p.name} added to party!`);
    await loadList();
    selectPokemon(p.id);
  } catch (e) {
    toast(e.message);
  }
}

async function releasePokemon(id) {
  if (!confirm("Release this Pokémon? This cannot be undone.")) return;
  try {
    await api("/api/pokemon/" + id, { method: "DELETE" });
    toast("Pokémon released.");
    selectedId = null;
    $("dataSprite").classList.add("hidden-sprite");
    $("dataInfo").innerHTML = `<p class="placeholder-text">Select a Pokémon</p>`;
    $("actionTray").innerHTML = "";
    await loadList();
  } catch (e) {
    toast(e.message);
  }
}

// ---------- View toggle / box nav ----------
$("viewToggleBtn").onclick = () => {
  view = view === "box" ? "party" : "box";
  render();
};
$("prevBox").onclick = () => toast("Only Box 1 exists right now!");
$("nextBox").onclick = () => toast("Only Box 1 exists right now!");

const savedBoxName = localStorage.getItem("boxName");
if (savedBoxName) $("boxLabel").value = savedBoxName;

$("boxLabel").addEventListener("change", () => {
  const val = $("boxLabel").value.trim() || "Box 1";
  $("boxLabel").value = val;
  localStorage.setItem("boxName", val);
});
$("boxLabel").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("boxLabel").blur();
});

let lookupData = null;
let allPokemonNames = [];
let namesLoading = null;

async function ensureNameList() {
  if (allPokemonNames.length || namesLoading) return namesLoading;
  namesLoading = fetch("https://pokeapi.co/api/v2/pokemon?limit=2000")
    .then((r) => r.json())
    .then((data) => {
      allPokemonNames = data.results.map((r) => r.name);
    })
    .catch(() => {
      allPokemonNames = [];
    });
  return namesLoading;
}

function showSuggestions(matches, query) {
  const box = $("suggestBox");
  if (!query) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  if (!matches.length) {
    box.innerHTML = `<div class="suggest-empty">No matches</div>`;
    box.classList.remove("hidden");
    return;
  }
  box.innerHTML = matches
    .slice(0, 8)
    .map((n) => `<div class="suggest-item" data-name="${n}">${n}</div>`)
    .join("");
  box.classList.remove("hidden");
  box.querySelectorAll(".suggest-item").forEach((el) => {
    el.onclick = () => {
      $("lookupInput").value = el.dataset.name;
      box.classList.add("hidden");
      $("lookupBtn").click();
    };
  });
}

$("lookupInput").addEventListener("input", async () => {
  const query = $("lookupInput").value.trim().toLowerCase();
  if (!query) return showSuggestions([], "");
  await ensureNameList();
  const starts = allPokemonNames.filter((n) => n.startsWith(query));
  const contains = allPokemonNames.filter((n) => !n.startsWith(query) && n.includes(query));
  showSuggestions([...starts, ...contains], query);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrap")) $("suggestBox").classList.add("hidden");
});

$("addBtn").onclick = () => {
  $("addModal").classList.remove("hidden");
  $("lookupInput").value = "";
  $("lookupResult").innerHTML = "";
  $("catchBtn").classList.add("hidden");
  $("suggestBox").classList.add("hidden");
  lookupData = null;
  ensureNameList(); // warm the cache as soon as the modal opens
};
$("closeAddModal").onclick = () => $("addModal").classList.add("hidden");

$("lookupBtn").onclick = async () => {
  const name = $("lookupInput").value.trim();
  if (!name) return;
  $("suggestBox").classList.add("hidden");
  $("lookupResult").innerHTML = "Searching...";
  try {
    const data = await api("/api/lookup?name=" + encodeURIComponent(name));
    lookupData = data;
    $("lookupResult").innerHTML = `
      <div class="lookup-mon">
        <img src="${data.sprite}" alt="${data.name}" />
        <div>
          <div><b>${data.name}</b> (#${data.pokemonId})</div>
          <div>${data.types.join(" / ")}</div>
        </div>
      </div>
    `;
    $("catchBtn").classList.remove("hidden");
  } catch (e) {
    lookupData = null;
    $("catchBtn").classList.add("hidden");
    $("lookupResult").innerHTML = `<span style="color:#a02020">${e.message}</span>`;
  }
};

$("catchBtn").onclick = async () => {
  if (!lookupData) return;
  try {
    const entry = await api("/api/pokemon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lookupData),
    });
    toast(`${entry.name} was deposited in the box!`);
    $("addModal").classList.add("hidden");
    view = "box";
    await loadList();
    selectPokemon(entry.id);
  } catch (e) {
    toast(e.message);
  }
};

// ---------- Create custom Pokémon modal ----------
// Build the type dropdowns and the six stat inputs once.
(function buildCustomForm() {
  const types = Object.keys(TYPE_COLORS);
  const opt = (t) => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`;
  $("customType1").innerHTML = types.map(opt).join("");
  $("customType2").innerHTML = `<option value="">— none —</option>` + types.map(opt).join("");
  $("customStats").innerHTML = STAT_ORDER.map(
    (s) => `<div><label for="cs-${s}">${s}</label><input id="cs-${s}" type="number" min="1" max="255" value="50" /></div>`
  ).join("");
})();

$("customBtn").onclick = () => {
  $("customName").value = "";
  $("customNickname").value = "";
  $("customType1").selectedIndex = 0;
  $("customType2").value = "";
  STAT_ORDER.forEach((s) => ($("cs-" + s).value = 50));
  $("customModal").classList.remove("hidden");
  $("customName").focus();
};
$("closeCustomModal").onclick = () => $("customModal").classList.add("hidden");

$("createCustomBtn").onclick = async () => {
  const name = $("customName").value.trim();
  if (!name) return toast("Give your Pokémon a name");

  const types = [$("customType1").value];
  const t2 = $("customType2").value;
  if (t2 && t2 !== types[0]) types.push(t2);

  const stats = {};
  for (const s of STAT_ORDER) {
    const v = Number($("cs-" + s).value);
    if (!Number.isInteger(v) || v < 1 || v > 255) return toast(`${s} must be a whole number from 1 to 255`);
    stats[s] = v;
  }

  try {
    const entry = await api("/api/pokemon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, types, stats,
        sprite: "",
        pokemonId: null,
        nickname: $("customNickname").value.trim(),
      }),
    });
    toast(`${entry.name} was created and deposited in the box!`);
    $("customModal").classList.add("hidden");
    view = "box";
    await loadList();
    selectPokemon(entry.id);
  } catch (e) {
    toast(e.message);
  }
};

function openCompare(presetId) {
  const selA = $("compareA");
  const selB = $("compareB");
  const opts = pokemonList
    .map((p) => `<option value="${p.id}">${esc(p.nickname || p.name)}</option>`)
    .join("");
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  if (presetId) selA.value = presetId;
  const other = pokemonList.find((p) => p.id !== presetId);
  if (other) selB.value = other.id;
  $("compareResult").innerHTML = "";
  $("compareModal").classList.remove("hidden");
}
$("closeCompareModal").onclick = () => $("compareModal").classList.add("hidden");

$("doCompareBtn").onclick = async () => {
  const a = $("compareA").value;
  const b = $("compareB").value;
  if (!a || !b || a === b) return toast("Pick two different Pokémon");
  try {
    const { a: pa, b: pb } = await api(`/api/compare?a=${a}&b=${b}`);
    const col = (p, other) => `
      <div class="compare-col">
        <h4>${esc((p.nickname || p.name).toUpperCase())} <small>(Lv${p.level})</small></h4>
        ${STAT_ORDER
          .map((s) => {
            const v = calcStatAtLevel(p.stats[s] ?? 0, p.level, s === "hp");
            const ov = calcStatAtLevel(other.stats[s] ?? 0, other.level, s === "hp");
            return `<div class="compare-stat ${v > ov ? "win" : ""}">${s}: ${v}</div>`;
          })
          .join("")}
      </div>
    `;
    $("compareResult").innerHTML = `<div class="compare-grid">${col(pa, pb)}${col(pb, pa)}</div>`;
  } catch (e) {
    toast(e.message);
  }
};

loadList();
