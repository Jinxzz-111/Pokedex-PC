// server.js - CRUD routes for the collection + online lookup via PokeAPI
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const POKEAPI = "https://pokeapi.co/api/v2";
const MAX_TEAM = 6;

const VALID_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];
const STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

// type effectiveness helpers (cached so we don't call PokeAPI twice for the same type)
const typeCache = {};
async function getTypeRelations(typeName) {
  if (!typeCache[typeName]) {
    const r = await axios.get(POKEAPI + "/type/" + typeName);
    typeCache[typeName] = r.data.damage_relations;
  }
  return typeCache[typeName];
}

async function getMultipliers(types) {
  const result = {};
  for (const t of types) {
    const rel = await getTypeRelations(t);
    rel.double_damage_from.forEach((x) => {
      result[x.name] = (result[x.name] ?? 1) * 2;
    });
    rel.half_damage_from.forEach((x) => {
      result[x.name] = (result[x.name] ?? 1) * 0.5;
    });
    rel.no_damage_from.forEach((x) => {
      result[x.name] = (result[x.name] ?? 1) * 0;
    });
  }
  return result;
}

// ONLINE LOOKUP: search PokeAPI by name or number
app.get("/api/lookup", async (req, res) => {
  try {
    const name = String(req.query.name || "").toLowerCase().trim();
    if (!name) return res.status(400).json({ error: "Enter a name or number" });

    const r = await axios.get(POKEAPI + "/pokemon/" + encodeURIComponent(name));
    const p = r.data;
    res.json({
      pokemonId: p.id,
      name: p.name,
      types: p.types.map((t) => t.type.name),
      sprite: p.sprites.front_default,
      stats: Object.fromEntries(p.stats.map((s) => [s.stat.name, s.base_stat])),
    });
  } catch (err) {
    res.status(404).json({ error: "Pokemon not found" });
  }
});

// READ: collection, with optional search / filter / sort
app.get("/api/pokemon", (req, res) => {
  let list = db.read();
  const { q, type, favorite, sort } = req.query;

  if (q) {
    const term = q.toLowerCase();
    list = list.filter((p) =>
      (p.name + " " + (p.nickname || "")).toLowerCase().includes(term)
    );
  }
  if (type) list = list.filter((p) => p.types.includes(type));
  if (favorite === "true") list = list.filter((p) => p.favorite);

  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "level") list.sort((a, b) => b.level - a.level);
  else if (sort === "type") list.sort((a, b) => a.types[0].localeCompare(b.types[0]));

  res.json(list);
});

// CREATE: catch a searched Pokemon, or add a custom one
app.post("/api/pokemon", (req, res) => {
  const { name, types, sprite, stats, pokemonId } = req.body;
  if (!name || !Array.isArray(types) || types.length === 0) {
    return res.status(400).json({ error: "Name and types are required" });
  }

  if (!pokemonId) {
    if (String(name).trim().length > 30) {
      return res.status(400).json({ error: "Name must be 30 characters or less" });
    }
    if (types.length > 2 || !types.every((t) => VALID_TYPES.includes(t))) {
      return res.status(400).json({ error: "Pick one or two valid types" });
    }
    const okStats =
      stats &&
      STAT_KEYS.every((k) => Number.isInteger(stats[k]) && stats[k] >= 1 && stats[k] <= 255);
    if (!okStats) {
      return res.status(400).json({ error: "Each stat must be a whole number from 1 to 255" });
    }
  }

  const list = db.read();
  const entry = {
    id: Date.now(),
    pokemonId: pokemonId || null,
    name,
    types,
    sprite: sprite || "",
    stats: stats || {},
    nickname: req.body.nickname || "",
    level: 1,
    notes: req.body.notes || "",
    favorite: false,
    inTeam: false,
  };
  list.push(entry);
  db.write(list);
  res.json(entry);
});

// UPDATE: nickname, level, notes, favorite, team
app.put("/api/pokemon/:id", (req, res) => {
  const list = db.read();
  const p = list.find((x) => x.id == req.params.id);
  if (!p) return res.status(404).json({ error: "Pokemon not found" });

  if (req.body.level !== undefined) {
    const level = Number(req.body.level);
    if (!Number.isInteger(level) || level < 1 || level > 100) {
      return res.status(400).json({ error: "Level must be 1 to 100" });
    }
    req.body.level = level;
  }

  if (req.body.inTeam === true && !p.inTeam) {
    const teamSize = list.filter((x) => x.inTeam).length;
    if (teamSize >= MAX_TEAM) {
      return res.status(400).json({ error: "Team is full (max " + MAX_TEAM + ")" });
    }
  }

  const allowed = ["nickname", "level", "notes", "favorite", "inTeam"];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) p[key] = req.body[key];
  });

  db.write(list);
  res.json(p);
});

// DELETE: release a Pokemon
app.delete("/api/pokemon/:id", (req, res) => {
  const list = db.read().filter((p) => p.id != req.params.id);
  db.write(list);
  res.json({ message: "Pokemon released" });
});

// team's combined stats + shared type weaknesses
app.get("/api/team/summary", async (req, res) => {
  try {
    const team = db.read().filter((p) => p.inTeam);
    const totalStats = {};
    const weakCount = {};

    for (const p of team) {
      for (const stat in p.stats) {
        totalStats[stat] = (totalStats[stat] || 0) + p.stats[stat];
      }
      const multipliers = await getMultipliers(p.types);
      for (const type in multipliers) {
        if (multipliers[type] > 1) weakCount[type] = (weakCount[type] || 0) + 1;
      }
    }

    res.json({ size: team.length, max: MAX_TEAM, totalStats, weakCount });
  } catch (err) {
    res.status(500).json({ error: "Could not load team summary" });
  }
});

// type chart for one Pokemon in the collection
app.get("/api/effectiveness/:id", async (req, res) => {
  try {
    const p = db.read().find((x) => x.id == req.params.id);
    if (!p) return res.status(404).json({ error: "Pokemon not found" });

    const multipliers = await getMultipliers(p.types);
    const weakTo = [];
    const resists = [];
    const immuneTo = [];
    for (const type in multipliers) {
      if (multipliers[type] === 0) immuneTo.push(type);
      else if (multipliers[type] > 1) weakTo.push({ type, x: multipliers[type] });
      else if (multipliers[type] < 1) resists.push({ type, x: multipliers[type] });
    }
    res.json({ name: p.name, types: p.types, weakTo, resists, immuneTo });
  } catch (err) {
    res.status(500).json({ error: "Could not load type data" });
  }
});

// compare two Pokemon from the collection
app.get("/api/compare", (req, res) => {
  const list = db.read();
  const a = list.find((p) => p.id == req.query.a);
  const b = list.find((p) => p.id == req.query.b);
  if (!a || !b) return res.status(404).json({ error: "Pick two valid Pokemon" });
  res.json({ a, b });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "No such route: " + req.method + " " + req.originalUrl });
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error: " + err.message });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
