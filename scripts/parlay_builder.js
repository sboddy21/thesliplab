import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUTS = {
  hits: "hits_board.csv",
  tb: "tb_board.csv",
  hr: "hr_sweep_board_all_games.csv"
};

const OUTPUTS = {
  csv: "exports/parlay_builder.csv",
  json: "exports/parlay_builder.json",
  x: "exports/parlay_x_export.txt"
};

const MODEL_ONLY_LABEL = "Model only, no book line";

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());

  return lines.map(line => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });

    return row;
  });
}

function csvEscape(value) {
  const str = String(value ?? "");

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function clean(value) {
  return String(value || "").trim();
}

function norm(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\bjr\b/g, "")
    .replace(/\bsr\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value, fallback = 0) {
  const n = Number(String(value || "").replace("+", ""));
  return Number.isFinite(n) ? n : fallback;
}

function get(row, keys, fallback = "") {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }

  return fallback;
}

function round(value) {
  return Number(value.toFixed(2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lineupBoost(lineup) {
  const n = num(lineup, 99);

  if (n >= 1 && n <= 2) return 4;
  if (n >= 3 && n <= 5) return 5;
  if (n >= 6 && n <= 7) return 1.5;
  if (n >= 8 && n <= 9) return -5;

  return 0;
}

function formTagBoost(tag) {
  const t = clean(tag).toUpperCase();

  if (t === "HEATER") return 3;
  if (t === "STRONG") return 2;
  if (t === "STABLE") return 1;
  if (t === "COLD") return -4;
  if (t === "SLUMP") return -8;

  return 0;
}

function tierBoost(tier) {
  const t = clean(tier).toUpperCase();

  if (t === "ANCHOR" || t === "SAFEST") return 4;
  if (t === "SAFE") return 3;
  if (t === "VALUE") return 2;
  if (t === "LEVERAGE") return 1;
  if (t === "LOTTO") return -2;
  if (t === "PASS") return -25;

  return 0;
}

function confidenceBoost(confidence) {
  const c = clean(confidence).toUpperCase();

  if (c === "A") return 4;
  if (c === "B") return 3;
  if (c === "C") return 1;
  if (c === "D") return -6;
  if (c === "F") return -12;
  if (c === "PASS") return -25;

  return 0;
}

function isModelOnly(play) {
  return clean(play.line_source).toUpperCase() === "MODEL_ONLY";
}

function evBoost(ev) {
  const n = num(ev, -999);

  if (n === -999) return 0;

  if (n >= 150) return 12;
  if (n >= 100) return 10;
  if (n >= 60) return 8;
  if (n >= 30) return 6;
  if (n >= 15) return 4;
  if (n >= 5) return 2;
  if (n >= 0) return 1;
  if (n <= -25) return -12;
  if (n <= -10) return -7;

  return -3;
}

function edgeBoost(edge) {
  const n = num(edge, -999);

  if (n === -999) return 0;

  if (n >= 40) return 8;
  if (n >= 25) return 6;
  if (n >= 15) return 4;
  if (n >= 7) return 2;
  if (n >= 0) return 1;
  if (n <= -15) return -8;

  return -3;
}

function hasLine(play) {
  if (isModelOnly(play)) return false;

  return clean(play.best_odds) !== "" && clean(play.best_book) !== "";
}

function isPositiveEv(play) {
  if (isModelOnly(play)) return false;

  return num(play.ev, -999) >= 0;
}

function normalizedModelScore(play) {
  const raw = num(play.score);

  if (play.prop === "HR") return clamp(raw * 0.38, 0, 90);
  if (play.prop === "4+ TB") return clamp(raw * 0.68, 0, 88);
  if (play.prop === "3+ TB") return clamp(raw * 0.78, 0, 95);
  if (play.prop === "2+ TB") return clamp(raw * 0.9, 0, 100);
  if (play.prop === "1+ Hit") return clamp(raw * 0.9, 0, 100);

  return clamp(raw, 0, 100);
}

function rankPlay(play) {
  const model = normalizedModelScore(play);
  const form = num(play.form_score, 50);

  let rank =
    model * 0.68 +
    evBoost(play.ev) +
    edgeBoost(play.edge) +
    formTagBoost(play.form_tag) +
    tierBoost(play.tier) +
    confidenceBoost(play.confidence) +
    lineupBoost(play.lineup);

  if (form >= 95) rank += 2;
  else if (form >= 85) rank += 1;
  else if (form <= 45) rank -= 5;

  if (hasLine(play) && isPositiveEv(play)) rank += 3;
  if (hasLine(play) && !isPositiveEv(play)) rank -= 8;

  if (!hasLine(play) && !isModelOnly(play)) rank -= 4;

  return round(rank);
}

function makeBase(row, source) {
  return {
    name: clean(get(row, ["name", "player", "batter"])),
    team: clean(get(row, ["team", "team_abbr"])),
    game: clean(get(row, ["game"])),
    opponent: clean(get(row, ["opponent", "opp", "opposing_team"])),
    pitcher: clean(get(row, ["pitcher", "opposing_pitcher"])),
    lineup: get(row, ["lineup", "lineup_spot", "batting_order"]),
    weather: clean(get(row, ["weather"])),
    wind: clean(get(row, ["wind"])),
    form_score: get(row, ["form_score"], ""),
    form_tag: clean(get(row, ["form_tag"], "")),
    source
  };
}

function buildHitPlays(rows) {
  return rows
    .map(row => {
      const base = makeBase(row, "HITS");
      if (!base.name) return null;

      const score = num(get(row, ["hits_score", "score", "hit_score", "model_score"]));

      const play = {
        ...base,
        prop: "1+ Hit",
        score,
        normalized_score: "",
        raw_score: score,
        tier: clean(get(row, ["tier"])),
        confidence: clean(get(row, ["confidence"])),
        best_odds: clean(get(row, ["best_odds"])),
        best_book: clean(get(row, ["best_book"])),
        market_average_odds: clean(get(row, ["market_average_odds"])),
        all_books: clean(get(row, ["all_books"])),
        implied_probability: clean(get(row, ["implied_probability"])),
        model_probability: clean(get(row, ["model_probability"])),
        edge: clean(get(row, ["edge"])),
        ev: clean(get(row, ["ev"])),
        line_source: clean(get(row, ["line_source"])),
        line_label: clean(get(row, ["line_label"], "")),
        risk: "safe"
      };

      play.normalized_score = round(normalizedModelScore(play));
      play.ev_rank = rankPlay(play);

      return play;
    })
    .filter(Boolean);
}

function buildTbPlays(rows) {
  const plays = [];

  rows.forEach(row => {
    const base = makeBase(row, "TB");
    if (!base.name) return;

    const twoScore = num(get(row, ["two_tb_score", "two", "2_tb_score"]));
    const threeScore = num(get(row, ["three_tb_score", "three", "3_tb_score"]));
    const fourScore = num(get(row, ["four_tb_score", "four", "4_tb_score"]));

    if (twoScore > 0) {
      const play = {
        ...base,
        prop: "2+ TB",
        score: twoScore,
        normalized_score: "",
        raw_score: twoScore,
        tier: clean(get(row, ["two_tb_tier", "tier"])),
        confidence: clean(get(row, ["two_tb_confidence", "confidence"])),
        best_odds: clean(get(row, ["two_best_odds", "best_ev_odds"])),
        best_book: clean(get(row, ["two_best_book", "best_ev_book"])),
        market_average_odds: "",
        all_books: clean(get(row, ["best_ev_all_books"])),
        implied_probability: clean(get(row, ["two_implied_probability"])),
        model_probability: clean(get(row, ["two_model_probability"])),
        edge: clean(get(row, ["two_edge"])),
        ev: clean(get(row, ["two_ev"])),
        line_source: clean(get(row, ["line_source"])),
        line_label: "Sportsbook line available",
        risk: "safe"
      };

      play.normalized_score = round(normalizedModelScore(play));
      play.ev_rank = rankPlay(play);
      plays.push(play);
    }

    if (threeScore > 0) {
      const play = {
        ...base,
        prop: "3+ TB",
        score: threeScore,
        normalized_score: "",
        raw_score: threeScore,
        tier: clean(get(row, ["three_tb_tier", "tier"])),
        confidence: clean(get(row, ["three_tb_confidence", "confidence"])),
        best_odds: "",
        best_book: "MODEL ONLY",
        market_average_odds: "",
        all_books: "",
        implied_probability: "",
        model_probability: clean(get(row, ["three_model_probability"])),
        edge: "",
        ev: "",
        line_source: "MODEL_ONLY",
        line_label: MODEL_ONLY_LABEL,
        risk: "balanced"
      };

      play.normalized_score = round(normalizedModelScore(play));
      play.ev_rank = rankPlay(play);
      plays.push(play);
    }

    if (fourScore > 0) {
      const play = {
        ...base,
        prop: "4+ TB",
        score: fourScore,
        normalized_score: "",
        raw_score: fourScore,
        tier: clean(get(row, ["four_tb_tier", "tier"])),
        confidence: clean(get(row, ["four_tb_confidence", "confidence"])),
        best_odds: "",
        best_book: "MODEL ONLY",
        market_average_odds: "",
        all_books: "",
        implied_probability: "",
        model_probability: clean(get(row, ["four_model_probability"])),
        edge: "",
        ev: "",
        line_source: "MODEL_ONLY",
        line_label: MODEL_ONLY_LABEL,
        risk: "lotto"
      };

      play.normalized_score = round(normalizedModelScore(play));
      play.ev_rank = rankPlay(play);
      plays.push(play);
    }
  });

  return plays;
}

function buildHrPlays(rows) {
  return rows
    .map(row => {
      const base = makeBase(row, "HR");
      if (!base.name) return null;

      const score = num(get(row, ["model_score", "score", "hr_score", "rank_score"]));

      const play = {
        ...base,
        prop: "HR",
        score,
        normalized_score: "",
        raw_score: score,
        tier: clean(get(row, ["tier"])),
        confidence: clean(get(row, ["confidence"])),
        best_odds: clean(get(row, ["best_odds"])),
        best_book: clean(get(row, ["best_book"])),
        market_average_odds: clean(get(row, ["market_average_odds"])),
        all_books: clean(get(row, ["all_books"])),
        implied_probability: clean(get(row, ["implied_probability"])),
        model_probability: clean(get(row, ["model_probability"])),
        edge: clean(get(row, ["edge"])),
        ev: clean(get(row, ["ev"])),
        line_source: clean(get(row, ["line_source"])),
        line_label: clean(get(row, ["line_label"], "")),
        risk: "lotto"
      };

      play.normalized_score = round(normalizedModelScore(play));
      play.ev_rank = rankPlay(play);

      return play;
    })
    .filter(Boolean);
}

function samePlayer(a, b) {
  return norm(a.name) === norm(b.name);
}

function sameTeam(a, b) {
  if (!norm(a.team) || !norm(b.team)) return false;
  return norm(a.team) === norm(b.team);
}

function sameGame(a, b) {
  if (a.game && b.game && norm(a.game) === norm(b.game)) return true;

  const aTeam = norm(a.team);
  const bTeam = norm(b.team);
  const aOpp = norm(a.opponent);
  const bOpp = norm(b.opponent);

  return aTeam === bTeam || aTeam === bOpp || aOpp === bTeam || aOpp === bOpp;
}

function isPass(play) {
  return (
    clean(play.tier).toUpperCase() === "PASS" ||
    clean(play.confidence).toUpperCase() === "PASS"
  );
}

function fails(combo, play, settings) {
  if (combo.some(p => samePlayer(p, play))) return true;
  if (settings.noPass && isPass(play)) return true;
  if (settings.requireLine && !hasLine(play)) return true;

  if (settings.requirePositiveEv && hasLine(play) && !isPositiveEv(play)) {
    return true;
  }

  if (settings.requireLineup && num(play.lineup, 99) > settings.maxLineupSpot) {
    return true;
  }

  if (settings.allowedProps && !settings.allowedProps.includes(play.prop)) {
    return true;
  }

  if (settings.blockUnknownTeam && clean(play.team).toUpperCase() === "UNKNOWN") {
    return true;
  }

  if (settings.blockSlumps && clean(play.form_tag).toUpperCase() === "SLUMP") {
    return true;
  }

  if (settings.maxHr !== undefined) {
    const hrCount = combo.filter(p => p.prop === "HR").length;
    if (play.prop === "HR" && hrCount >= settings.maxHr) return true;
  }

  const sameTeamCount = combo.filter(p => sameTeam(p, play)).length;
  const sameGameCount = combo.filter(p => sameGame(p, play)).length;

  if (sameTeamCount >= settings.maxSameTeam) return true;
  if (sameGameCount >= settings.maxSameGame) return true;

  return false;
}

function sortByEvRank(a, b) {
  if (b.ev_rank !== a.ev_rank) return b.ev_rank - a.ev_rank;

  if (num(b.ev, -999) !== num(a.ev, -999)) {
    return num(b.ev, -999) - num(a.ev, -999);
  }

  if (num(b.edge, -999) !== num(a.edge, -999)) {
    return num(b.edge, -999) - num(a.edge, -999);
  }

  return num(b.normalized_score) - num(a.normalized_score);
}

function buildCombo(pool, size, settings) {
  const sorted = pool
    .filter(play => play.ev_rank >= settings.minRank)
    .sort(sortByEvRank);

  const combo = [];

  if (settings.forceOneFromProps) {
    const forced = sorted.find(play => {
      return settings.forceOneFromProps.includes(play.prop) && !fails(combo, play, settings);
    });

    if (forced) combo.push(forced);
  }

  for (const play of sorted) {
    if (combo.length >= size) break;
    if (fails(combo, play, settings)) continue;

    combo.push(play);
  }

  if (combo.length < size && settings.allowFallback) {
    const fallback = pool.sort(sortByEvRank);

    for (const play of fallback) {
      if (combo.length >= size) break;
      if (combo.some(p => samePlayer(p, play))) continue;
      if (settings.noPass && isPass(play)) continue;
      if (settings.allowedProps && !settings.allowedProps.includes(play.prop)) continue;

      if (settings.maxHr !== undefined) {
        const hrCount = combo.filter(p => p.prop === "HR").length;
        if (play.prop === "HR" && hrCount >= settings.maxHr) continue;
      }

      combo.push(play);
    }
  }

  return combo.slice(0, size);
}

function buildSafeSlip(hitPlays, tbPlays) {
  const combo = [];

  const strictSettings = {
    maxSameTeam: 1,
    maxSameGame: 1,
    maxHr: 0,
    noPass: true,
    requireLine: true,
    requirePositiveEv: true,
    requireLineup: true,
    maxLineupSpot: 7,
    blockUnknownTeam: true,
    blockSlumps: true,
    allowedProps: ["1+ Hit", "2+ TB"]
  };

  const relaxedEvSettings = {
    ...strictSettings,
    requirePositiveEv: false
  };

  const relaxedGameSettings = {
    ...relaxedEvSettings,
    maxSameGame: 2
  };

  const relaxedFinalSettings = {
    ...relaxedGameSettings,
    maxSameTeam: 2,
    requireLine: false,
    blockSlumps: false
  };

  const hit =
    hitPlays.sort(sortByEvRank).find(play => !fails(combo, play, strictSettings)) ||
    hitPlays.sort(sortByEvRank).find(play => !fails(combo, play, relaxedEvSettings)) ||
    hitPlays.sort(sortByEvRank).find(play => !fails(combo, play, relaxedFinalSettings));

  if (hit) combo.push(hit);

  const tbPools = [
    {
      pool: tbPlays.filter(play => play.prop === "2+ TB").sort(sortByEvRank),
      settings: strictSettings
    },
    {
      pool: tbPlays.filter(play => play.prop === "2+ TB").sort(sortByEvRank),
      settings: relaxedEvSettings
    },
    {
      pool: tbPlays.filter(play => play.prop === "2+ TB").sort(sortByEvRank),
      settings: relaxedGameSettings
    },
    {
      pool: tbPlays.filter(play => play.prop === "2+ TB").sort(sortByEvRank),
      settings: relaxedFinalSettings
    }
  ];

  for (const group of tbPools) {
    if (combo.length >= 2) break;

    const tb = group.pool.find(play => !fails(combo, play, group.settings));

    if (tb) {
      combo.push(tb);
      break;
    }
  }

  return combo.slice(0, 2);
}

function average(combo, key) {
  if (!combo.length) return 0;

  const values = combo
    .map(play => num(play[key], NaN))
    .filter(value => Number.isFinite(value));

  if (!values.length) return 0;

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildCombos(hitPlays, tbPlays, hrPlays) {
  const balancedPool = [...hitPlays, ...tbPlays].filter(play => {
    return ["1+ Hit", "2+ TB", "3+ TB"].includes(play.prop);
  });

  const upsidePool = [...tbPlays, ...hrPlays].filter(play => {
    return ["2+ TB", "3+ TB", "HR"].includes(play.prop);
  });

  const positiveEvPool = [...hitPlays, ...tbPlays, ...hrPlays].filter(play => {
    return ["1+ Hit", "2+ TB", "HR"].includes(play.prop);
  });

  const lottoPool = [...tbPlays, ...hrPlays].filter(play => {
    return ["4+ TB", "HR"].includes(play.prop);
  });

  const combos = [
    {
      name: "Safest 2 Man",
      category: "safe",
      plays: buildSafeSlip(hitPlays, tbPlays)
    },
    {
      name: "Balanced 3 Man",
      category: "balanced",
      plays: buildCombo(balancedPool, 3, {
        minRank: 45,
        maxSameTeam: 1,
        maxSameGame: 2,
        maxHr: 0,
        noPass: true,
        requireLine: false,
        requirePositiveEv: false,
        requireLineup: true,
        maxLineupSpot: 7,
        blockUnknownTeam: true,
        blockSlumps: true,
        allowFallback: true,
        forceOneFromProps: ["3+ TB"],
        allowedProps: ["1+ Hit", "2+ TB", "3+ TB"]
      })
    },
    {
      name: "Upside 4 Man",
      category: "upside",
      plays: buildCombo(upsidePool, 4, {
        minRank: 40,
        maxSameTeam: 2,
        maxSameGame: 2,
        maxHr: 1,
        noPass: true,
        requireLine: false,
        requirePositiveEv: false,
        requireLineup: false,
        maxLineupSpot: 9,
        blockUnknownTeam: false,
        blockSlumps: false,
        allowFallback: true,
        forceOneFromProps: ["3+ TB"],
        allowedProps: ["2+ TB", "3+ TB", "HR"]
      })
    },
    {
      name: "Positive EV 3 Man",
      category: "positive_ev",
      plays: buildCombo(positiveEvPool, 3, {
        minRank: 40,
        maxSameTeam: 1,
        maxSameGame: 2,
        maxHr: 1,
        noPass: true,
        requireLine: true,
        requirePositiveEv: true,
        requireLineup: false,
        maxLineupSpot: 9,
        blockUnknownTeam: true,
        blockSlumps: true,
        allowFallback: true,
        allowedProps: ["1+ Hit", "2+ TB", "HR"]
      })
    },
    {
      name: "Lotto 3 Man",
      category: "lotto",
      plays: buildCombo(lottoPool, 3, {
        minRank: 25,
        maxSameTeam: 1,
        maxSameGame: 2,
        maxHr: 2,
        noPass: true,
        requireLine: false,
        requirePositiveEv: false,
        requireLineup: false,
        maxLineupSpot: 9,
        blockUnknownTeam: false,
        blockSlumps: false,
        allowFallback: true,
        forceOneFromProps: ["HR"],
        allowedProps: ["4+ TB", "HR"]
      })
    }
  ];

  return combos.map(combo => ({
    ...combo,
    combo_score: average(combo.plays, "normalized_score"),
    combo_raw_score: average(combo.plays, "score"),
    combo_ev_rank: average(combo.plays, "ev_rank"),
    combo_ev: average(combo.plays, "ev"),
    combo_edge: average(combo.plays, "edge"),
    legs: combo.plays.length
  }));
}

function getDisplayOdds(play) {
  if (isModelOnly(play)) return MODEL_ONLY_LABEL;

  if (play.best_odds && play.best_book) {
    return `${play.best_odds} ${play.best_book}`;
  }

  return "No line";
}

function getDisplayEv(play) {
  if (isModelOnly(play)) return "N/A";
  return play.ev || "N/A";
}

function getDisplayEdge(play) {
  if (isModelOnly(play)) return "N/A";
  return play.edge || "N/A";
}

function writeCsv(combos) {
  const rows = [];

  combos.forEach(combo => {
    combo.plays.forEach((play, index) => {
      rows.push({
        slip: combo.name,
        category: combo.category,
        combo_score: combo.combo_score,
        combo_raw_score: combo.combo_raw_score,
        combo_ev_rank: combo.combo_ev_rank,
        combo_ev: combo.combo_ev,
        combo_edge: combo.combo_edge,
        total_legs: combo.legs,
        leg: index + 1,
        name: play.name,
        team: play.team,
        prop: play.prop,
        score: play.score,
        normalized_score: play.normalized_score,
        ev_rank: play.ev_rank,
        raw_score: play.raw_score,
        form_score: play.form_score,
        form_tag: play.form_tag,
        tier: play.tier,
        confidence: play.confidence,
        lineup: play.lineup,
        best_odds: play.best_odds,
        best_book: play.best_book,
        market_average_odds: play.market_average_odds,
        implied_probability: play.implied_probability,
        model_probability: play.model_probability,
        edge: play.edge,
        ev: play.ev,
        line_source: play.line_source,
        line_label: play.line_label,
        all_books: play.all_books,
        source: play.source,
        game: play.game,
        pitcher: play.pitcher,
        weather: play.weather,
        wind: play.wind
      });
    });
  });

  const headers = [
    "slip",
    "category",
    "combo_score",
    "combo_raw_score",
    "combo_ev_rank",
    "combo_ev",
    "combo_edge",
    "total_legs",
    "leg",
    "name",
    "team",
    "prop",
    "score",
    "normalized_score",
    "ev_rank",
    "raw_score",
    "form_score",
    "form_tag",
    "tier",
    "confidence",
    "lineup",
    "best_odds",
    "best_book",
    "market_average_odds",
    "implied_probability",
    "model_probability",
    "edge",
    "ev",
    "line_source",
    "line_label",
    "all_books",
    "source",
    "game",
    "pitcher",
    "weather",
    "wind"
  ];

  const text = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ].join("\n");

  fs.mkdirSync(path.join(ROOT, "exports"), {
    recursive: true
  });

  fs.writeFileSync(path.join(ROOT, OUTPUTS.csv), text);
}

function writeJson(combos) {
  fs.writeFileSync(path.join(ROOT, OUTPUTS.json), JSON.stringify(combos, null, 2));
}

function writeX(combos) {
  const lines = [];

  lines.push("THE SLIP LAB MLB PARLAY BOARD");
  lines.push("");
  lines.push("EV weighted. HR normalized. Best lines included.");
  lines.push("3+ TB and 4+ TB are model only until book lines are available.");
  lines.push("");

  combos.forEach(combo => {
    lines.push(combo.name);
    lines.push(
      `Score: ${combo.combo_score} | EV Rank: ${combo.combo_ev_rank} | Avg EV: ${combo.combo_ev}%`
    );
    lines.push("");

    combo.plays.forEach(play => {
      const odds = getDisplayOdds(play);

      lines.push(`${play.name} ${play.team} ${play.prop}`);
      lines.push(
        `Model: ${play.normalized_score} | EV: ${getDisplayEv(play)}% | Edge: ${getDisplayEdge(play)}% | ${odds}`
      );
      lines.push("");
    });

    lines.push("");
  });

  lines.push("Tail responsibly. Nothing is guaranteed.");
  lines.push("LIKE | REPOST | COMMENT LOCKED");

  fs.writeFileSync(path.join(ROOT, OUTPUTS.x), lines.join("\n"));
}

function printCombo(combo) {
  console.log("");
  console.log(
    `${combo.name} | Score: ${combo.combo_score} | EV Rank: ${combo.combo_ev_rank} | Avg EV: ${combo.combo_ev}% | Legs: ${combo.legs}`
  );

  combo.plays.forEach(play => {
    const odds = getDisplayOdds(play);

    console.log(
      `${play.name} | ${play.team} | ${play.prop} | Model: ${play.normalized_score} | Raw: ${play.score} | EV Rank: ${play.ev_rank} | EV: ${getDisplayEv(play)}% | Edge: ${getDisplayEdge(play)}% | ${odds}`
    );
  });
}

function main() {
  const hitRows = parseCsv(path.join(ROOT, INPUTS.hits));
  const tbRows = parseCsv(path.join(ROOT, INPUTS.tb));
  const hrRows = parseCsv(path.join(ROOT, INPUTS.hr));

  const hitPlays = buildHitPlays(hitRows);
  const tbPlays = buildTbPlays(tbRows);
  const hrPlays = buildHrPlays(hrRows);

  const combos = buildCombos(hitPlays, tbPlays, hrPlays);

  writeCsv(combos);
  writeJson(combos);
  writeX(combos);

  console.log("");
  console.log("EV WEIGHTED PARLAY BUILDER COMPLETE");
  console.log("Hits plays:", hitPlays.length);
  console.log("TB plays:", tbPlays.length);
  console.log("HR plays:", hrPlays.length);
  console.log("Saved:", path.join(ROOT, OUTPUTS.csv));
  console.log("Saved:", path.join(ROOT, OUTPUTS.json));
  console.log("Saved:", path.join(ROOT, OUTPUTS.x));

  combos.forEach(printCombo);
}

main();