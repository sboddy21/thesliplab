async function loadParkDimensions() {
  const mount =
    document.querySelector("[data-park-dimensions]") ||
    document.querySelector("#park-dimensions") ||
    document.querySelector(".park-dimensions");

  if (!mount) return;

  let parks = [];

  try {
    const res = await fetch("./data/park_dimensions.json");
    parks = await res.json();
  } catch (err) {
    mount.innerHTML = "<div class='slip-park-error'>Park dimensions could not load.</div>";
    return;
  }

  function renderPark(park) {
    mount.innerHTML = `
      <section class="slip-park-card">
        <div class="slip-park-head">
          <div>
            <div class="slip-kicker">PARK DIMENSIONS</div>
            <h2>${park.park}</h2>
            <p>${park.team}</p>
          </div>
          <select id="slipParkSelect">
            ${parks.map(p => `<option value="${p.park}" ${p.park === park.park ? "selected" : ""}>${p.park}</option>`).join("")}
          </select>
        </div>

        <div class="slip-field-wrap">
          <svg class="slip-field-svg" viewBox="0 0 600 430" role="img" aria-label="Baseball park dimension overlay">
            <path d="M300 395 L75 170 Q300 35 525 170 Z" class="slip-outfield"/>
            <path d="M300 395 L220 315 L300 235 L380 315 Z" class="slip-infield"/>
            <circle cx="300" cy="395" r="7" class="slip-base"/>
            <circle cx="220" cy="315" r="6" class="slip-base"/>
            <circle cx="300" cy="235" r="6" class="slip-base"/>
            <circle cx="380" cy="315" r="6" class="slip-base"/>

            <text x="80" y="178" class="slip-dim-label">LF ${park.left}'</text>
            <text x="145" y="105" class="slip-dim-label">LC ${park.leftCenter}'</text>
            <text x="278" y="68" class="slip-dim-label">CF ${park.center}'</text>
            <text x="408" y="105" class="slip-dim-label">RC ${park.rightCenter}'</text>
            <text x="485" y="178" class="slip-dim-label">RF ${park.right}'</text>

            <line x1="300" y1="395" x2="75" y2="170" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="160" y2="95" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="300" y2="55" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="440" y2="95" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="525" y2="170" class="slip-dim-line"/>
          </svg>
        </div>

        <div class="slip-park-grid">
          <div><span>Left</span><strong>${park.left}'</strong></div>
          <div><span>Left Center</span><strong>${park.leftCenter}'</strong></div>
          <div><span>Center</span><strong>${park.center}'</strong></div>
          <div><span>Right Center</span><strong>${park.rightCenter}'</strong></div>
          <div><span>Right</span><strong>${park.right}'</strong></div>
        </div>
      </section>
    `;

    document.querySelector("#slipParkSelect").addEventListener("change", e => {
      const next = parks.find(p => p.park === e.target.value);
      if (next) renderPark(next);
    });
  }

  renderPark(parks[0]);
}

document.addEventListener("DOMContentLoaded", loadParkDimensions);