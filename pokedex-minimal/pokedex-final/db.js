// db.js - reads and writes the collection to pokedex.json
const fs = require("fs");
const FILE = "pokedex.json";

if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");

exports.read = () => JSON.parse(fs.readFileSync(FILE));
exports.write = (list) => fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
