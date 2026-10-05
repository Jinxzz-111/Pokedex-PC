// common.js - shared helpers used by index.html and edit.html

const TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

const TYPE_COLORS = {
  normal: "#a8a77a", fire: "#ee8130", water: "#6390f0", electric: "#f7d02c",
  grass: "#7ac74c", ice: "#96d9d6", fighting: "#c22e28", poison: "#a33ea1",
  ground: "#e2bf65", flying: "#a98ff3", psychic: "#f95587", bug: "#a6b91a",
  rock: "#b6a136", ghost: "#735797", dragon: "#6f35fc", dark: "#705746",
  steel: "#b7b7ce", fairy: "#d685ad",
};

const STATS = [
  ["hp", "HP"],
  ["attack", "Attack"],
  ["defense", "Defense"],
  ["special-attack", "Sp. Atk"],
  ["special-defense", "Sp. Def"],
  ["speed", "Speed"],
];

function $(id) {
  return document.getElementById(id);
}

function pretty(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

let messageTimer = null;
function showMessage(text, isError) {
  const box = $("message");
  box.textContent = text;
  box.className = "message " + (isError ? "error" : "ok");
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    box.textContent = "";
    box.className = "message";
  }, 5000);
}

// fetch + JSON, throws on a non-OK response
async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function send(method, url, body) {
  return api(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function typeChip(type) {
  const chip = el("span", null, "chip");
  const dot = el("span", null, "dot");
  dot.style.background = TYPE_COLORS[type] || "#888888";
  chip.appendChild(dot);
  chip.appendChild(document.createTextNode(pretty(type)));
  return chip;
}

function makeSprite(p) {
  if (p.sprite) {
    const img = document.createElement("img");
    img.src = p.sprite;
    img.alt = "";
    img.className = "sprite";
    return img;
  }
  return el("div", p.name.charAt(0).toUpperCase(), "sprite sprite-empty");
}
