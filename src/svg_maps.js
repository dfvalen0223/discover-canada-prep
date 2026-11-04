// Interactive SVG Map of Canada & SVG System of Government Diagram Renderer
// Used both for Dynamic Visual Exam Callouts ([?]) and Interactive Study Mini-Games

window.SVGVisuals = {
  // Province/Territory stylized interactive map geometry (viewBox 0 0 860 540)
  provincesGeo: [
    {
      id: "YT",
      name: "Yukon",
      capital: "Whitehorse",
      region: "Northern Territories",
      color: "#c5ba8a",
      path: "M 92,165 L 158,95 L 166,228 L 88,195 Z",
      labelX: 132, labelY: 168, capX: 122, capY: 192
    },
    {
      id: "NT",
      name: "Northwest Territories",
      capital: "Yellowknife",
      region: "Northern Territories",
      color: "#b7ab78",
      path: "M 158,95 L 258,118 L 288,200 L 274,254 L 166,228 Z",
      labelX: 218, labelY: 185, capX: 228, capY: 222
    },
    {
      id: "NU",
      name: "Nunavut",
      capital: "Iqaluit",
      region: "Northern Territories",
      color: "#d1c79a",
      path: "M 258,118 L 395,55 L 495,120 L 535,195 L 448,225 L 395,210 L 368,262 L 274,254 L 288,200 Z",
      labelX: 382, labelY: 162, capX: 502, capY: 192
    },
    {
      id: "BC",
      name: "British Columbia",
      capital: "Victoria",
      region: "West Coast",
      color: "#123e7c",
      path: "M 88,195 L 166,228 L 195,240 L 172,368 L 95,342 L 78,275 Z",
      labelX: 135, labelY: 292, capX: 102, capY: 345
    },
    {
      id: "AB",
      name: "Alberta",
      capital: "Edmonton",
      region: "Prairie Provinces",
      color: "#8b1d20",
      path: "M 195,240 L 252,250 L 235,382 L 172,368 Z",
      labelX: 212, labelY: 312, capX: 210, capY: 334
    },
    {
      id: "SK",
      name: "Saskatchewan",
      capital: "Regina",
      region: "Prairie Provinces",
      color: "#7a1619",
      path: "M 252,250 L 310,258 L 302,394 L 235,382 Z",
      labelX: 274, labelY: 325, capX: 276, capY: 368
    },
    {
      id: "MB",
      name: "Manitoba",
      capital: "Winnipeg",
      region: "Prairie Provinces",
      color: "#962427",
      path: "M 310,258 L 368,262 L 398,295 L 362,402 L 302,394 Z",
      labelX: 344, labelY: 332, capX: 342, capY: 382
    },
    {
      id: "ON",
      name: "Ontario",
      capital: "Toronto",
      region: "Central Canada",
      color: "#2b568c",
      path: "M 398,295 L 448,325 L 492,350 L 538,415 L 478,468 L 452,430 L 362,402 Z",
      labelX: 446, labelY: 382, capX: 502, capY: 442
    },
    {
      id: "QC",
      name: "Quebec",
      capital: "Québec City",
      region: "Central Canada",
      color: "#3665a0",
      path: "M 492,228 L 585,222 L 642,298 L 585,365 L 538,415 L 492,350 Z",
      labelX: 558, labelY: 312, capX: 582, capY: 368
    },
    {
      id: "NL",
      name: "Newfoundland & Labrador",
      capital: "St. John's",
      region: "Atlantic Provinces",
      color: "#e67e22",
      path: "M 585,222 L 675,265 L 728,312 L 692,345 L 642,298 Z",
      labelX: 682, labelY: 275, capX: 722, capY: 322
    },
    {
      id: "NB",
      name: "New Brunswick",
      capital: "Fredericton",
      region: "Atlantic Provinces",
      color: "#d35400",
      path: "M 595,365 L 638,362 L 635,402 L 598,398 Z",
      labelX: 616, labelY: 382, capX: 614, capY: 390
    },
    {
      id: "PE",
      name: "Prince Edward Island",
      capital: "Charlottetown",
      region: "Atlantic Provinces",
      color: "#f39c12",
      path: "M 642,350 L 672,348 L 670,364 L 642,364 Z",
      labelX: 656, labelY: 342, capX: 656, capY: 356
    },
    {
      id: "NS",
      name: "Nova Scotia",
      capital: "Halifax",
      region: "Atlantic Provinces",
      color: "#e67e22",
      path: "M 642,374 L 688,368 L 682,415 L 638,412 Z",
      labelX: 668, labelY: 396, capX: 665, capY: 404
    }
  ],

  /**
   * Renders an interactive or exam-callout SVG Map of Canada
   * @param {Object} opts - { highlightId, hideLabelsForHighlight, interactive, selectedId, completedIds }
   */
  renderCanadaMapSVG(opts = {}) {
    const {
      highlightId = null,
      hideLabelsForHighlight = false,
      interactive = false,
      selectedId = null,
      completedIds = []
    } = opts;

    const pathsHtml = this.provincesGeo.map(p => {
      const isHighlighted = highlightId === p.id;
      const isSelected = selectedId === p.id;
      const isCompleted = completedIds.includes(p.id);

      let fill = p.color;
      let stroke = "#ffffff";
      let strokeWidth = 2;

      if (isHighlighted) {
        fill = "#f59e0b";
        stroke = "#fef08a";
        strokeWidth = 3.5;
      } else if (isSelected) {
        fill = "#ef4444";
        stroke = "#ffffff";
        strokeWidth = 3.5;
      } else if (isCompleted) {
        fill = "#10b981";
      }

      const showQuestionMark = isHighlighted && hideLabelsForHighlight;
      const labelText = showQuestionMark ? "[ ? ]" : p.id;

      return `
        <g class="svg-province-group ${interactive ? 'clickable-province' : ''} ${isHighlighted ? 'pulsing-highlight' : ''}"
           data-prov-id="${p.id}"
           style="cursor: ${interactive ? 'pointer' : 'default'};">
          <path d="${p.path}"
                fill="${fill}"
                stroke="${stroke}"
                stroke-width="${strokeWidth}"
                stroke-linejoin="round"
                opacity="${highlightId && !isHighlighted ? '0.68' : '0.96'}" />
          <circle cx="${p.capX}" cy="${p.capY}" r="3.5" fill="#ffffff" stroke="#111827" stroke-width="1.2" />
          <rect x="${p.labelX - (showQuestionMark ? 24 : 16)}"
                y="${p.labelY - 11}"
                width="${showQuestionMark ? 48 : 32}"
                height="20"
                rx="5"
                fill="${showQuestionMark ? '#dc2626' : 'rgba(15, 23, 42, 0.82)'}"
                stroke="${showQuestionMark ? '#fef08a' : 'rgba(255,255,255,0.4)'}"
                stroke-width="${showQuestionMark ? 2 : 1}" />
          <text x="${p.labelX}"
                y="${p.labelY + 3}"
                text-anchor="middle"
                fill="#ffffff"
                font-family="-apple-system, BlinkMacSystemFont, sans-serif"
                font-size="${showQuestionMark ? '12' : '10.5'}"
                font-weight="800">${labelText}</text>
        </g>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 800 490" class="canada-interactive-svg" role="img" aria-label="Interactive Map of Canada">
        <defs>
          <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#dbeafe" />
            <stop offset="100%" stop-color="#bfdbfe" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="800" height="490" rx="12" fill="url(#oceanGrad)" />
        <!-- Ocean Labels -->
        <text x="48" y="255" fill="#1e40af" font-size="11" font-weight="700" opacity="0.75" text-anchor="middle">PACIFIC</text>
        <text x="48" y="269" fill="#1e40af" font-size="11" font-weight="700" opacity="0.75" text-anchor="middle">OCEAN</text>
        <text x="315" y="42" fill="#1e40af" font-size="12" font-weight="700" opacity="0.75" text-anchor="middle">ARCTIC OCEAN</text>
        <text x="735" y="415" fill="#1e40af" font-size="11" font-weight="700" opacity="0.75" text-anchor="middle">ATLANTIC</text>
        <text x="735" y="429" fill="#1e40af" font-size="11" font-weight="700" opacity="0.75" text-anchor="middle">OCEAN</text>
        <text x="438" y="275" fill="#1e3a8a" font-size="10" font-style="italic" font-weight="600" opacity="0.8" text-anchor="middle">Hudson Bay</text>
        <text x="275" y="438" fill="#475569" font-size="11" font-weight="700" opacity="0.75" text-anchor="middle">UNITED STATES OF AMERICA</text>

        ${pathsHtml}

        <!-- National Capital Ottawa Star -->
        <g transform="translate(524, 412)">
          <circle cx="0" cy="0" r="7" fill="#dc2626" stroke="#fef08a" stroke-width="1.8" />
          <text x="0" y="3.5" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900">★</text>
          <text x="11" y="4" fill="#0f172a" font-size="10.5" font-weight="800">Ottawa (National Capital)</text>
        </g>
      </svg>
    `;
  },

  /**
   * Renders an interactive or exam-callout SVG of Canada's System of Government
   */
  renderGovChartSVG(opts = {}) {
    const { highlightBranch = null } = opts;
    const isExec = highlightBranch === "executive";
    const isJud = highlightBranch === "judiciary";

    return `
      <svg viewBox="0 0 680 360" class="gov-chart-svg" role="img" aria-label="Canada's System of Government Diagram">
        <rect x="0" y="0" width="680" height="360" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
        <text x="340" y="28" text-anchor="middle" fill="#7f1d1d" font-size="15" font-weight="800">CANADA'S SYSTEM OF GOVERNMENT (Interactive Diagram)</text>

        <!-- Executive Branch Box -->
        <g>
          <rect x="24" y="95" width="145" height="125" rx="8"
                fill="${isExec ? '#fef3c7' : '#e2e8f0'}"
                stroke="${isExec ? '#d97706' : '#64748b'}"
                stroke-width="${isExec ? '3' : '1.5'}" />
          <text x="96" y="122" text-anchor="middle" fill="#1e3a8a" font-size="13" font-weight="800">
            ${isExec ? '[ ? ] Branch' : 'Executive Branch'}
          </text>
          <text x="96" y="152" text-anchor="middle" fill="#0f172a" font-size="11.5" font-weight="700">Prime Minister</text>
          <text x="96" y="168" text-anchor="middle" fill="#0f172a" font-size="11.5" font-weight="700">and Cabinet</text>
          <text x="96" y="192" text-anchor="middle" fill="#475569" font-size="10">+ Sovereign (GG)</text>
        </g>

        <!-- Parliament Center Stack -->
        <g>
          <rect x="205" y="45" width="270" height="30" rx="6" fill="#7f1d1d" />
          <text x="340" y="65" text-anchor="middle" fill="#ffffff" font-size="13.5" font-weight="800">PARLIAMENT</text>

          <rect x="205" y="80" width="270" height="46" rx="6" fill="#1e40af" />
          <text x="340" y="98" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="800">1. Sovereign (Queen or King)</text>
          <text x="340" y="115" text-anchor="middle" fill="#dbeafe" font-size="10.5">Represented by the Governor General</text>

          <rect x="205" y="132" width="270" height="46" rx="6" fill="#1d4ed8" />
          <text x="340" y="150" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="800">2. Senate</text>
          <text x="340" y="167" text-anchor="middle" fill="#dbeafe" font-size="10.5">Appointed on Prime Minister's recommendation</text>

          <rect x="205" y="184" width="270" height="54" rx="6" fill="#2563eb" />
          <text x="340" y="202" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="800">3. House of Commons</text>
          <text x="340" y="218" text-anchor="middle" fill="#dbeafe" font-size="10.5">Elected by Voters (Gov't &amp; Opposition MPs)</text>
        </g>

        <!-- Legislative Branch Box -->
        <g>
          <rect x="510" y="95" width="145" height="125" rx="8" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" />
          <text x="582" y="135" text-anchor="middle" fill="#0369a1" font-size="13" font-weight="800">Legislative</text>
          <text x="582" y="153" text-anchor="middle" fill="#0369a1" font-size="13" font-weight="800">Branch</text>
          <text x="582" y="180" text-anchor="middle" fill="#334155" font-size="10.5">Passes Federal Laws</text>
        </g>

        <!-- Judiciary Bottom Stack -->
        <g>
          <rect x="205" y="252" width="270" height="28" rx="6"
                fill="${isJud ? '#d97706' : '#7f1d1d'}" />
          <text x="340" y="271" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="800">
            ${isJud ? '[ ? ] — Highest Court (9 Judges)' : 'JUDICIARY — Supreme Court of Canada (9 Judges)'}
          </text>
          <rect x="205" y="285" width="130" height="42" rx="6" fill="#e2e8f0" stroke="#94a3b8" />
          <text x="270" y="305" text-anchor="middle" fill="#1e293b" font-size="11" font-weight="700">Federal Court</text>
          <text x="270" y="319" text-anchor="middle" fill="#475569" font-size="10">of Canada</text>

          <rect x="345" y="285" width="130" height="42" rx="6" fill="#e2e8f0" stroke="#94a3b8" />
          <text x="410" y="305" text-anchor="middle" fill="#1e293b" font-size="11" font-weight="700">Provincial</text>
          <text x="410" y="319" text-anchor="middle" fill="#475569" font-size="10">Courts</text>
        </g>
      </svg>
    `;
  }
};
