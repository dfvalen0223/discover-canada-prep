// Gamified Study Section Controller:
// 1. Web Audio Sound FX & English Text-to-Speech (TTS)
// 2. Mode 1: Canada Expedition Trail (11 Chapters + Chapter Boss Quizzes)
// 3. Mode 2: 3D Spaced-Repetition Flashcards (SM-2 / Leitner Boxes)
// 4. Mode 3: Interactive Map of Canada & Civics Diagram Challenge
// 5. Mode 4: 60-Second "Maple Blitz" Rapid-Fire Arcade Mode
// 6. Mode 5: Official Discover Canada Visual Study Guide & Atlas Explorer (All 68 Pages + 16 Figures)

window.GamifiedStudy = (function () {
  let soundEnabled = true;
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === "correct") {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.08, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.19);
        });
      } else if (type === "wrong") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.linearRampToValueAtTime(135, now + 0.22);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "fanfare") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.09);
          gain.gain.setValueAtTime(0.10, now + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.09);
          osc.stop(now + i * 0.09 + 0.34);
        });
      } else if (type === "flip") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  function speakEnglish(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-CA";
      utter.rate = 0.98;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // Ignore TTS errors
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
  }

  function isSoundEnabled() {
    return soundEnabled;
  }

  // Visual Figures Atlas metadata for the Visual Study Explorer
  const VISUAL_FIGURES_ATLAS = [
    {
      id: "fig_map_canada",
      title: "Official Map of Canada (10 Provinces, 3 Territories, 3 Oceans & Ottawa)",
      chapter: "ch11",
      page: 45,
      asset: "../assets/figures/map_canada_full.jpg",
      keyPoints: [
        "Second largest country on earth (10 million sq. km); bordered by Pacific (west), Atlantic (east), Arctic (north), and U.S.A. (south).",
        "National Capital: Ottawa (chosen in 1857 by Queen Victoria).",
        "Five Regions: Atlantic (orange), Central Canada (blue), Prairies (crimson), West Coast (dark navy), Northern Territories (tan)."
      ]
    },
    {
      id: "fig_table_regions_capitals",
      title: "Table of Regions, Provinces/Territories & Capital Cities",
      chapter: "ch11",
      page: 45,
      asset: "../assets/figures/table_regions_capitals.jpg",
      keyPoints: [
        "Atlantic: NL (St. John's), PEI (Charlottetown), NS (Halifax), NB (Fredericton).",
        "Central: QC (Québec City), ON (Toronto). Prairies: MB (Winnipeg), SK (Regina), AB (Edmonton).",
        "West Coast: BC (Victoria). North: NU (Iqaluit), NT (Yellowknife), YT (Whitehorse)."
      ]
    },
    {
      id: "fig_system_of_government",
      title: "Canada's System of Government Diagram",
      chapter: "ch6",
      page: 29,
      asset: "../assets/figures/chart_system_of_government.jpg",
      keyPoints: [
        "Parliament (Legislative Branch) has 3 parts: Sovereign (Governor General), Senate (appointed on PM's recommendation until age 75), and House of Commons (elected by voters).",
        "Executive Branch: Sovereign (Governor General), Prime Minister, and Cabinet.",
        "Judiciary: Supreme Court of Canada (9 judges appointed by the Governor General), Federal Court, and Provincial Courts."
      ]
    },
    {
      id: "fig_bill_becomes_law",
      title: "How a Bill Becomes Law — The 7-Step Legislative Process",
      chapter: "ch6",
      page: 29,
      asset: "../assets/figures/chart_bill_becomes_law.jpg",
      keyPoints: [
        "Step 1 First Reading (printed) → Step 2 Second Reading (debate principle) → Step 3 Committee Stage (study clause by clause).",
        "Step 4 Report Stage (amendments) → Step 5 Third Reading (debate & vote) → Step 6 Senate (similar process) → Step 7 Royal Assent (Governor General)."
      ]
    },
    {
      id: "fig_levels_of_government",
      title: "Federal, Provincial/Territorial & Municipal Responsibilities Table",
      chapter: "ch6",
      page: 33,
      asset: "../assets/figures/table_levels_of_government.jpg",
      keyPoints: [
        "Federal (MPs): National Defence, Foreign Policy, International Trade, Aboriginal Affairs, Citizenship, Criminal Justice.",
        "Provincial/Territorial (MLAs, MNAs, MPPs, MHAs): Education, Health Care, Natural Resources, Property & Civil Rights, Highways.",
        "Shared (Federal + Provincial): Immigration, Agriculture, and Environment.",
        "Municipal (Mayor/Reeve, Councillors/Aldermen): Recycling, Snow Removal, Firefighting, Local Policing, Transit & Emergency Services."
      ]
    },
    {
      id: "fig_voting_procedures",
      title: "Voting Procedures During a Federal Election Period",
      chapter: "ch7",
      page: 32,
      asset: "../assets/figures/chart_voting_procedures.jpg",
      keyPoints: [
        "Voter Information Card confirms your name on the National Register of Electors and states when and where to vote.",
        "Canadian law guarantees a secret ballot — mark an 'X' in the circle next to your chosen candidate.",
        "Advance polls and special ballots are available if you cannot vote on election day."
      ]
    },
    {
      id: "fig_expansion_dominion",
      title: "Expansion of the Dominion Timeline (1867–1999) & Sir John A. Macdonald",
      chapter: "ch4",
      page: 19,
      asset: "../assets/figures/chart_expansion_dominion.jpg",
      keyPoints: [
        "1867: Ontario, Quebec, Nova Scotia, New Brunswick. 1870: Manitoba, NWT. 1871: British Columbia. 1873: PEI.",
        "1880: Arctic Islands to NWT. 1898: Yukon. 1905: Alberta, Saskatchewan. 1949: Newfoundland & Labrador. 1999: Nunavut."
      ]
    },
    {
      id: "fig_public_holidays",
      title: "National Public Holidays and Other Important Dates Table",
      chapter: "ch9",
      page: 41,
      asset: "../assets/figures/table_public_holidays.jpg",
      keyPoints: [
        "Jan 11: Sir John A. Macdonald Day | April 9: Vimy Day | Monday preceding May 25: Victoria Day.",
        "June 24: Fête nationale (Quebec) | July 1: Canada Day | 1st Mon Sept: Labour Day | 2nd Mon Oct: Thanksgiving.",
        "Nov 11: Remembrance Day | Nov 20: Sir Wilfrid Laurier Day | Dec 25: Christmas | Dec 26: Boxing Day."
      ]
    },
    {
      id: "fig_canadian_symbols",
      title: "Canadian Symbols: Crown, Mace, 1965 Flag, Red Ensign & Snowbirds",
      chapter: "ch9",
      page: 38,
      asset: "../assets/figures/visual_canadian_symbols.jpg",
      keyPoints: [
        "New red-white-red Canadian flag raised first time in 1965; Red Ensign served for 100 years prior.",
        "Motto: 'A mari usque ad mare' ('from sea to sea'). Snowbirds (431 Air Demonstration Squadron)."
      ]
    },
    {
      id: "fig_war_of_1812",
      title: "The War of 1812: Sir Isaac Brock, Chief Tecumseh & HMS Shannon",
      chapter: "ch4",
      page: 17,
      asset: "../assets/figures/visual_war_of_1812.jpg",
      keyPoints: [
        "The fight for Canada (1812–1814) ensured Canada would remain independent of the United States.",
        "Heroes: Maj.-Gen. Sir Isaac Brock, Shawnee Chief Tecumseh, Charles de Salaberry, and Laura Secord."
      ]
    },
    {
      id: "fig_cpr_railway",
      title: "Canadian Pacific Railway (CPR): The Last Spike (Nov 7, 1885)",
      chapter: "ch4",
      page: 20,
      asset: "../assets/figures/visual_cpr_railway.jpg",
      keyPoints: [
        "Donald Smith (Lord Strathcona) drove the Last Spike on November 7, 1885.",
        "Built by European and Chinese labour; Ottawa apologized in 2006 for the discriminatory Chinese Head Tax."
      ]
    },
    {
      id: "fig_dday_juno",
      title: "World War II: D-Day Invasion at Juno Beach (June 6, 1944)",
      chapter: "ch4",
      page: 23,
      asset: "../assets/figures/visual_dday_juno_beach.jpg",
      keyPoints: [
        "15,000 Canadian troops stormed and captured Juno Beach on June 6, 1944 (1 in 10 Allied soldiers on D-Day was Canadian).",
        "Over 1 million Canadians and Newfoundlanders served in WWII; 44,000 were killed."
      ]
    },
    {
      id: "fig_scales_of_justice",
      title: "The Justice System: Blindfolded Lady Justice & Presumption of Innocence",
      chapter: "ch8",
      page: 36,
      asset: "../assets/figures/visual_scales_of_justice.jpg",
      keyPoints: [
        "Founded on the presumption of innocence in criminal matters (innocent until proven guilty).",
        "Lady Justice is blindfolded because Canadian law is impartial and blind to all considerations other than the facts."
      ]
    },
    {
      id: "fig_sports_and_science",
      title: "Canadian Sports Champions & Scientific Pioneers",
      chapter: "ch5",
      page: 26,
      asset: "../assets/figures/visual_sports_and_science.jpg",
      keyPoints: [
        "Terry Fox ('Marathon of Hope', 1980), Rick Hansen (1985), Wayne Gretzky, Donovan Bailey, Chantal Petitclerc, Catriona Le May Doan, Paul Henderson (1972).",
        "Sir Frederick Banting & Charles Best (insulin), Sir Sandford Fleming (time zones), Dr. John A. Hopps (pacemaker), Canadarm."
      ]
    },
    {
      id: "fig_confederation_bridge",
      title: "The Confederation Bridge (Prince Edward Island to New Brunswick)",
      chapter: "ch11",
      page: 56,
      asset: "../assets/figures/visual_confederation_bridge.jpg",
      keyPoints: [
        "Connects Prince Edward Island (smallest province, birthplace of Confederation) to mainland New Brunswick.",
        "One of the longest multi-span bridges in the world."
      ]
    },
    {
      id: "fig_mount_logan",
      title: "Mount Logan in the Yukon Territory — Highest Mountain in Canada",
      chapter: "ch11",
      page: 50,
      asset: "../assets/figures/visual_mount_logan.jpg",
      keyPoints: [
        "Located in the Yukon Territory (Kluane National Park); highest mountain in Canada.",
        "Named in honour of Sir William Logan, a world-famous geologist born in Montreal in 1798."
      ]
    }
  ];

  return {
    playTone,
    speakEnglish,
    toggleSound,
    isSoundEnabled,
    VISUAL_FIGURES_ATLAS
  };
})();
