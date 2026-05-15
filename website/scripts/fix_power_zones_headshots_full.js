import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const jsPath = path.join(ROOT, "power-zones.js");
const cssPath = path.join(ROOT, "power-zones.css");

let js = fs.readFileSync(jsPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!js.includes("function safeInitials")) {
  js = js.replace(
    "function initials(name) {",
    `function safeInitials(name) {
  return String(name || "TSL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "TSL";
}

function getHeadshotUrl(player) {
  const id = player?.mlbam || player?.player_id || player?.id || "";
  if (!id) return "";
  return "https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/" + id + "/headshot/67/current";
}

function renderPlayerPhoto(player, size = "card") {
  const url = getHeadshotUrl(player);
  const fallback = safeInitials(player?.player);

  if (!url) {
    return '<div class="tsl-player-photo-fallback ' + size + '">' + fallback + '</div>';
  }

  return '<div class="tsl-player-photo-wrap ' + size + '">' +
    '<img class="tsl-player-photo" src="' + url + '" alt="' + String(player?.player || "Player").replaceAll('"', "") + '" loading="lazy" onerror="this.remove(); this.parentElement.innerHTML=\\'<div class=&quot;tsl-player-photo-fallback ' + size + '&quot;>' + fallback + '</div>\\';" />' +
  '</div>';
}

function initials(name) {`
  );
}

if (!js.includes("mlbam: pick(merged")) {
  js = js.replace(
    `player: nameOf(merged),`,
    `player: nameOf(merged),
    mlbam: pick(merged, ["mlbam", "player_id", "id", "person_id"]),`
  );
}

js = js.replace(
  /<div class="card-head">\s*<div>\s*<div class="player-name" data-id="\$\{player\.id\}">\$\{player\.player\}<\/div>\s*<div class="card-sub">\$\{player\.team\} \$\{player\.handedness \? "• " \+ player\.handedness : ""\} \$\{player\.lineup \? "• #" \+ player\.lineup \+ " Spot" : ""\}<\/div>\s*<\/div>\s*<div class="grade-pill \$\{gradeClass\(player\.grade\)\}">\$\{player\.grade\}<\/div>\s*<\/div>/,
  `<div class="card-head">
        <div class="card-player-main">
          \${renderPlayerPhoto(player, "card")}
          <div>
            <div class="player-name" data-id="\${player.id}">\${player.player}</div>
            <div class="card-sub">\${player.team} \${player.handedness ? "• " + player.handedness : ""} \${player.lineup ? "• #" + player.lineup + " Spot" : ""}</div>
          </div>
        </div>
        <div class="grade-pill \${gradeClass(player.grade)}">\${player.grade}</div>
      </div>`
);

js = js.replace(
  /document\.getElementById\("modalInitials"\)\.textContent = initials\(p\.player\);/g,
  `const modalAvatar = document.getElementById("modalInitials");
  if (modalAvatar) {
    modalAvatar.outerHTML = renderPlayerPhoto(p, "modal");
  }`
);

js = js.replace(
  /document\.getElementById\("modalInitials"\)\.outerHTML = playerAvatar\(p, "modal"\);/g,
  `const modalAvatar = document.getElementById("modalInitials");
  if (modalAvatar) {
    modalAvatar.outerHTML = renderPlayerPhoto(p, "modal");
  }`
);

js = js.replace(
  /function renderModal\(\) \{[\s\S]*?const p = activePlayer;\s*if \(!p\) return;/,
  `function renderModal() {
  const p = activePlayer;
  if (!p) return;

  const existingPhoto = document.querySelector(".modal-top .tsl-player-photo-wrap, .modal-top .tsl-player-photo-fallback");
  if (existingPhoto) {
    existingPhoto.outerHTML = '<div class="avatar" id="modalInitials">TSL</div>';
  }`
);

css += `

.card-player-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tsl-player-photo-wrap,
.tsl-player-photo-fallback {
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background:
    radial-gradient(circle at top, rgba(0,255,136,.25), rgba(255,255,255,.05)),
    #111722;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.tsl-player-photo-wrap.card,
.tsl-player-photo-fallback.card {
  width: 48px;
  height: 48px;
}

.tsl-player-photo-wrap.modal,
.tsl-player-photo-fallback.modal {
  width: 70px;
  height: 70px;
}

.tsl-player-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.tsl-player-photo-fallback {
  color: #00170c;
  background: linear-gradient(135deg, var(--green), var(--blue));
  font-weight: 950;
}

.tsl-player-photo-fallback.card {
  font-size: 15px;
}

.tsl-player-photo-fallback.modal {
  font-size: 20px;
}

.modal-top .tsl-player-photo-wrap,
.modal-top .tsl-player-photo-fallback {
  margin-right: 0;
}
`;

fs.writeFileSync(jsPath, js);
fs.writeFileSync(cssPath, css);

console.log("POWER ZONES HEADSHOTS FULL FIX COMPLETE");
console.log("Updated: power-zones.js");
console.log("Updated: power-zones.css");
