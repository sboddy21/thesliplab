import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

const ROOT = process.cwd();

const FILES = [
  {
    input: "hits_board.csv",
    output: "exports/styled_hits_board.xlsx",
    type: "hits"
  },
  {
    input: "tb_board.csv",
    output: "exports/styled_tb_board.xlsx",
    type: "tb"
  },
  {
    input: "hr_sweep_board_all_games.csv",
    output: "exports/styled_hr_board.xlsx",
    type: "hr"
  },
  {
    input: "exports/parlay_builder.csv",
    output: "exports/styled_parlay_builder.xlsx",
    type: "parlay"
  }
];

const COLORS = {
  green: "FF00C851",
  yellow: "FFFFD500",
  orange: "FFFF8800",
  red: "FFFF4444",
  blue: "FF4DA3FF",
  purple: "FFB388FF",
  gray: "FFEAEAEA",
  darkGray: "FF666666",
  black: "FF111111",
  white: "FFFFFFFF",
  text: "FF000000",
  border: "FFDDDDDD"
};

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

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase();
}

function getColumnIndex(headers, names) {
  const wanted = Array.isArray(names) ? names : [names];

  return (
    headers.findIndex(header => {
      const normalized = normalizeHeader(header);
      return wanted.some(name => normalized === normalizeHeader(name));
    }) + 1
  );
}

function getTierColor(tier) {
  const t = String(tier || "").trim().toUpperCase();

  if (t === "ANCHOR" || t === "SAFEST") return COLORS.green;
  if (t === "SAFE" || t === "VALUE") return COLORS.yellow;
  if (t === "LEVERAGE") return COLORS.orange;
  if (t === "LOTTO" || t === "PASS") return COLORS.red;

  return null;
}

function getScoreColor(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  if (n >= 95) return COLORS.green;
  if (n >= 80) return COLORS.yellow;
  if (n >= 60) return COLORS.orange;
  return COLORS.red;
}

function getTbColor(type, value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  if (type === "two") {
    if (n >= 75) return COLORS.green;
    if (n >= 60) return COLORS.yellow;
    if (n >= 45) return COLORS.orange;
    return COLORS.red;
  }

  if (type === "three") {
    if (n >= 55) return COLORS.green;
    if (n >= 40) return COLORS.yellow;
    if (n >= 25) return COLORS.orange;
    return COLORS.red;
  }

  if (type === "four") {
    if (n >= 35) return COLORS.green;
    if (n >= 25) return COLORS.yellow;
    if (n >= 15) return COLORS.orange;
    return COLORS.red;
  }

  return null;
}

function getCategoryColor(category) {
  const c = String(category || "").trim().toLowerCase();

  if (c === "safe") return COLORS.green;
  if (c === "balanced") return COLORS.yellow;
  if (c === "upside") return COLORS.orange;
  if (c === "lotto") return COLORS.red;
  if (c === "positive_ev") return COLORS.blue;

  return COLORS.gray;
}

function getPropColor(prop) {
  const p = String(prop || "").trim().toUpperCase();

  if (p === "1+ HIT") return COLORS.green;
  if (p === "2+ TB") return COLORS.blue;
  if (p === "3+ TB") return COLORS.purple;
  if (p === "4+ TB") return COLORS.orange;
  if (p === "HR") return COLORS.red;

  return COLORS.gray;
}

function isModelOnlyValue(value) {
  const v = String(value || "").trim().toUpperCase();
  return v === "MODEL_ONLY" || v === "MODEL ONLY" || v.includes("MODEL ONLY");
}

function styleCell(cell, color, bold = false, fontColor = COLORS.text) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color }
  };

  cell.font = {
    bold,
    color: { argb: fontColor }
  };
}

function styleModelOnlyCell(cell) {
  styleCell(cell, COLORS.darkGray, true, COLORS.white);

  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true
  };
}

function styleHeader(sheet) {
  const headerRow = sheet.getRow(1);

  headerRow.font = {
    bold: true,
    color: { argb: COLORS.white }
  };

  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.black }
  };

  headerRow.height = 24;

  headerRow.eachCell(cell => {
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true
    };
  });
}

function styleBorders(sheet) {
  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } }
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true
      };
    });
  });
}

function applyTierColors(sheet, headers) {
  const tierColumns = headers
    .map((h, i) => ({
      header: normalizeHeader(h),
      index: i + 1
    }))
    .filter(col => col.header === "tier");

  tierColumns.forEach(({ index }) => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cell = row.getCell(index);
      const color = getTierColor(cell.value);

      if (color) {
        styleCell(cell, color, true);
      }
    });
  });
}

function applyTbColumnColors(sheet, headers) {
  const columns = [
    {
      scoreHeaders: ["two_tb_score", "two", "2_tb_score"],
      tierHeader: "two_tb_tier",
      confidenceHeader: "two_tb_confidence",
      type: "two"
    },
    {
      scoreHeaders: ["three_tb_score", "three", "3_tb_score"],
      tierHeader: "three_tb_tier",
      confidenceHeader: "three_tb_confidence",
      type: "three"
    },
    {
      scoreHeaders: ["four_tb_score", "four", "4_tb_score"],
      tierHeader: "four_tb_tier",
      confidenceHeader: "four_tb_confidence",
      type: "four"
    }
  ];

  columns.forEach(config => {
    const scoreIndex = getColumnIndex(headers, config.scoreHeaders);
    const tierIndex = getColumnIndex(headers, config.tierHeader);
    const confidenceIndex = getColumnIndex(headers, config.confidenceHeader);

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      if (scoreIndex > 0) {
        const scoreCell = row.getCell(scoreIndex);
        const scoreColor = getTbColor(config.type, scoreCell.value);

        if (scoreColor) {
          styleCell(scoreCell, scoreColor, true);
        }
      }

      if (tierIndex > 0) {
        const tierCell = row.getCell(tierIndex);
        const tierColor = getTierColor(tierCell.value);

        if (tierColor) {
          styleCell(tierCell, tierColor, true);
        }
      }

      if (confidenceIndex > 0) {
        const confidenceCell = row.getCell(confidenceIndex);
        const confidenceColor = getTierColor(confidenceCell.value);

        if (confidenceColor) {
          styleCell(confidenceCell, confidenceColor, true);
        }
      }
    });
  });
}

function applyParlayColors(sheet, headers) {
  const categoryIndex = getColumnIndex(headers, "category");
  const propIndex = getColumnIndex(headers, "prop");
  const scoreIndex = getColumnIndex(headers, "score");
  const comboScoreIndex = getColumnIndex(headers, "combo_score");
  const evRankIndex = getColumnIndex(headers, "ev_rank");
  const comboEvRankIndex = getColumnIndex(headers, "combo_ev_rank");
  const formScoreIndex = getColumnIndex(headers, "form_score");
  const formTagIndex = getColumnIndex(headers, "form_tag");
  const lineSourceIndex = getColumnIndex(headers, "line_source");
  const lineLabelIndex = getColumnIndex(headers, "line_label");
  const bestBookIndex = getColumnIndex(headers, "best_book");
  const bestOddsIndex = getColumnIndex(headers, "best_odds");
  const evIndex = getColumnIndex(headers, "ev");
  const edgeIndex = getColumnIndex(headers, "edge");

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const lineSource = lineSourceIndex > 0 ? row.getCell(lineSourceIndex).value : "";
    const lineLabel = lineLabelIndex > 0 ? row.getCell(lineLabelIndex).value : "";
    const bestBook = bestBookIndex > 0 ? row.getCell(bestBookIndex).value : "";

    const modelOnly =
      isModelOnlyValue(lineSource) ||
      isModelOnlyValue(lineLabel) ||
      isModelOnlyValue(bestBook);

    if (categoryIndex > 0) {
      const cell = row.getCell(categoryIndex);
      styleCell(cell, getCategoryColor(cell.value), true);
    }

    if (propIndex > 0) {
      const cell = row.getCell(propIndex);
      styleCell(cell, getPropColor(cell.value), true);
    }

    if (scoreIndex > 0) {
      const cell = row.getCell(scoreIndex);
      const color = getScoreColor(cell.value);

      if (color) styleCell(cell, color, true);
    }

    if (comboScoreIndex > 0) {
      const cell = row.getCell(comboScoreIndex);
      const color = getScoreColor(cell.value);

      if (color) styleCell(cell, color, true);
    }

    if (evRankIndex > 0) {
      const cell = row.getCell(evRankIndex);
      const color = getScoreColor(cell.value);

      if (color) styleCell(cell, color, true);
    }

    if (comboEvRankIndex > 0) {
      const cell = row.getCell(comboEvRankIndex);
      const color = getScoreColor(cell.value);

      if (color) styleCell(cell, color, true);
    }

    if (formScoreIndex > 0) {
      const cell = row.getCell(formScoreIndex);
      const color = getScoreColor(cell.value);

      if (color) styleCell(cell, color, true);
    }

    if (formTagIndex > 0) {
      const cell = row.getCell(formTagIndex);
      const tag = String(cell.value || "").toUpperCase();

      if (tag === "HEATER") styleCell(cell, COLORS.green, true);
      if (tag === "STRONG") styleCell(cell, COLORS.yellow, true);
      if (tag === "STABLE") styleCell(cell, COLORS.blue, true);
      if (tag === "COLD") styleCell(cell, COLORS.orange, true);
      if (tag === "SLUMP") styleCell(cell, COLORS.red, true);
    }

    if (modelOnly) {
      if (lineSourceIndex > 0) {
        row.getCell(lineSourceIndex).value = "MODEL_ONLY";
        styleModelOnlyCell(row.getCell(lineSourceIndex));
      }

      if (lineLabelIndex > 0) {
        row.getCell(lineLabelIndex).value = "Model only, no book line";
        styleModelOnlyCell(row.getCell(lineLabelIndex));
      }

      if (bestBookIndex > 0) {
        row.getCell(bestBookIndex).value = "MODEL ONLY";
        styleModelOnlyCell(row.getCell(bestBookIndex));
      }

      if (bestOddsIndex > 0) {
        row.getCell(bestOddsIndex).value = "";
      }

      if (evIndex > 0) {
        row.getCell(evIndex).value = "";
      }

      if (edgeIndex > 0) {
        row.getCell(edgeIndex).value = "";
      }
    }
  });
}

function autoSizeColumns(sheet, headers) {
  headers.forEach((header, i) => {
    const column = sheet.getColumn(i + 1);
    let max = String(header || "").length;

    column.eachCell(cell => {
      const len = String(cell.value || "").length;
      if (len > max) max = len;
    });

    column.width = Math.min(Math.max(max + 3, 14), 46);
  });
}

function getExcelColumnLetter(colNumber) {
  let letter = "";
  let n = colNumber;

  while (n > 0) {
    const mod = (n - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    n = Math.floor((n - mod) / 26);
  }

  return letter;
}

async function exportWorkbook(file) {
  const rows = parseCsv(path.join(ROOT, file.input));

  if (!rows.length) {
    console.log("No rows found:", file.input);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Board");

  const headers = Object.keys(rows[0]);

  sheet.columns = headers.map(h => ({
    header: h,
    key: h,
    width: 20
  }));

  rows.forEach(row => {
    sheet.addRow(row);
  });

  styleHeader(sheet);

  if (file.type === "tb") {
    applyTbColumnColors(sheet, headers);
  } else if (file.type === "parlay") {
    applyParlayColors(sheet, headers);
  } else {
    applyTierColors(sheet, headers);
  }

  styleBorders(sheet);
  autoSizeColumns(sheet, headers);

  sheet.views = [
    {
      state: "frozen",
      ySplit: 1
    }
  ];

  sheet.autoFilter = {
    from: "A1",
    to: `${getExcelColumnLetter(headers.length)}1`
  };

  const outPath = path.join(ROOT, file.output);

  fs.mkdirSync(path.dirname(outPath), {
    recursive: true
  });

  await workbook.xlsx.writeFile(outPath);

  console.log("Saved:", outPath);
}

async function main() {
  for (const file of FILES) {
    await exportWorkbook(file);
  }

  console.log("Done.");
}

main();