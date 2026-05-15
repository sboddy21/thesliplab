import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const jsPath = path.join(ROOT, "power-zones.js");
const cssPath = path.join(ROOT, "power-zones.css");

let js = fs.readFileSync(jsPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

js = js.replace(
`    player: nameOf(merged),`,
`    player: nameOf(merged),
    mlbam: pick(merged, ["mlbam", "player_id", "id", "person_id"]),`
);

js = js.replace(
`function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}`,
`function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function headshotUrl(player) {
  if (!player?.mlbam) return "";
  return "https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/" + player.mlbam + "/headshot/67/current";
}

function playerAvatar(player, size = "card") {
  const url = headshotUrl(player);
  const fallback = initials(player.player);

  if (!url) {
    return \`<div class="player-photo-fallback \${size}">\${fallback}</div>\`;
  }

  return \`
    <div class="player-photo-wrap \${size}">
      <img
        class="player-photo"
        src="\${url}"
        alt="\${player.player}"
        loading="lazy"
        onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'player-photo-fallback \${size}\\'>\${fallback}</div>';"
      />
    </div>
  \`;
}`
);

js = js.replace(
`      <div class="card-head">
        <div>
          <div class="player-name" data-id="\${player.id}">\${player.player}</div>
          <div class="card-sub">\${player.team} \${player.handedness ? "• " + player.handedness : ""} \${player.lineup ? "• #" + player.lineup + " Spot" : ""}</div>
        </div>
        <div class="grade-pill \${gradeClass(player.grade)}">\${player.grade}</div>
      </div>`,
`      <div class="card-head">
        <div class="card-player-main">
          \${playerAvatar(player, "card")}
          <div>
            <div class="player-name" data-id="\${player.id}">\${player.player}</div>
            <div class="card-sub">\${player.team} \${player.handedness ? "• " + player.handedness : ""} \${player.lineup ? "• #" + player.lineup + " Spot" : ""}</div>
          </div>
        </div>
        <div class="grade-pill \${gradeClass(player.grade)}">\${player.grade}</div>
      </div>`
);

js = js.replace(
`  document.getElementById("modalInitials").textContent = initials(p.player);`,
`  document.getElementById("modalInitials").outerHTML = playerAvatar(p, "modal");`
);

css += `

.card-player-main {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.player-photo-wrap,
.player-photo-fallback {
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background:
    radial-gradient(circle at top, rgba(0,255,136,.28), rgba(255,255,255,.05)),
    #111722;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.player-photo-wrap.card,
.player-photo-fallback.card {
  width: 48px;
  height: 48px;
}

.player-photo-wrap.modal,
.player-photo-fallback.modal {
  width: 68px;
  height: 68px;
}

.player-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.player-photo-fallback {
  color: #00170c;
  background: linear-gradient(135deg, var(--green), var(--blue));
  font-weight: 950;
}

.player-photo-fallback.card {
  font-size: 15px;
}

.player-photo-fallback.modal {
  font-size: 20px;
}

.modal-top .player-photo-wrap,
.modal-top .player-photo-fallback {
  margin-right: 0;
}
`;

fs.writeFileSync(jsPath, js);
fs.writeFileSync(cssPath, css);

console.log("POWER ZONES HEADSHOTS ADDED");
console.log("Updated: power-zones.js");
console.log("Updated: power-zones.css");
