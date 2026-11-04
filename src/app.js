// Main Application Controller — Discover Canada Prep (macOS Portable Studio)

(function () {
  // Active Exam Session State
  let currentExam = null;
  let currentQIndex = 0;
  let userAnswers = {}; // { [questionNumber]: "A"|"B"|"C"|"D" }
  let flaggedQuestions = new Set();
  let instantFeedbackEnabled = false;
  let examTimerInterval = null;
  let examRemainingSeconds = 45 * 60;
  let examStartTime = 0;

  // Gamified Study State
  let activeStudyMode = "trail";
  let fcDeck = [];
  let fcIndex = 0;
  let fcFilter = "all";
  let mapChallengeState = {
    active: false,
    round: 0,
    totalRounds: 10,
    score: 0,
    targets: [],
    selectedProvId: "ON",
    feedbackMsg: ""
  };
  let blitzState = {
    active: false,
    timerInterval: null,
    secondsLeft: 60,
    score: 0,
    combo: 0,
    currentQ: null
  };
  let currentPdfPage = 45; // Default to the famous Map & Capitals page (p. 45)
  let pdfExplorerSubmode = "atlas"; // "atlas" | "pages"

  // =========================================================================
  // INITIALIZATION & NAVIGATION
  // =========================================================================
  document.addEventListener("DOMContentLoaded", () => {
    window.onAuthSessionChanged = (session) => {
      refreshSidebarAndHeader();
      updateLaunchpadStats();
      renderStudyTrail();
      renderAnalyticsTab();
      renderPdfExplorerTab();
      renderProfileTab();
      if (session) {
        showToast(`👋 Bienvenido, <strong>${session.displayName || session.email}</strong>!`);
      }
    };
    if (window.AuthGate) {
      window.AuthGate.renderAuthOverlayIfNeeded();
    }
    bindGlobalEvents();
    refreshSidebarAndHeader();
    updateLaunchpadStats();
    renderStudyTrail();
    renderAnalyticsTab();
    renderPdfExplorerTab();
    renderProfileTab();
  });

  function showToast(msg) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3600);
  }

  function openLightbox(imgSrc, title, caption) {
    const modal = document.getElementById("lightbox-modal");
    document.getElementById("lightbox-img").src = imgSrc;
    document.getElementById("lightbox-title").textContent = title || "Study Guide Visual";
    document.getElementById("lightbox-caption").textContent = caption || "";
    modal.style.display = "flex";
  }

  function switchMainTab(tabId) {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === "tab-" + tabId);
    });

    const titles = {
      exam: [
        "20-Question Citizenship Practice Exam",
        "Independent Study Tool • English Multiple-Choice • Pass Criterion: 15 / 20 (75%) • Dynamic Anti-Memorization Engine"
      ],
      study: [
        "Gamified Study Lab & Interactive Challenges",
        "Earn XP, Climb Citizenship Ranks, Master 3D Flashcards, Interactive Maps & 60s Maple Blitz"
      ],
      analytics: [
        "Progress Tracking, Readiness Score & Weak Area Diagnostics",
        "Pinpoint chapters below 75% accuracy, inspect your Mistake Vault, and track exam history"
      ],
      pdf: [
        "Maps, Charts, Tables & 68-Page Illustrated PDF Explorer",
        "Inspect all 16 high-resolution study guide figures and browse both attached Discover Canada PDFs"
      ],
      profile: [
        "Citizenship Ranks, Achievements & Mac-to-Mac Portability",
        "Unlock 12 Citizenship Badges and export/import your progress file across any Mac"
      ]
    };

    if (titles[tabId]) {
      document.getElementById("topbar-title").textContent = titles[tabId][0];
      document.getElementById("topbar-subtitle").textContent = titles[tabId][1];
    }
    if (tabId !== "exam" || !currentExam) {
      document.body.classList.remove("exam-running");
    }

    refreshSidebarAndHeader();
    if (tabId === "analytics") renderAnalyticsTab();
    if (tabId === "pdf") renderPdfExplorerTab();
    if (tabId === "profile") renderProfileTab();
    if (tabId === "study") renderActiveStudySubmode();
  }

  function refreshSidebarAndHeader() {
    const rankInfo = window.AdaptiveEngine.getCurrentRank();
    const st = window.AdaptiveEngine.getState();
    const report = window.AdaptiveEngine.getAnalyticsReport();

    document.getElementById("ui-rank-icon").textContent = rankInfo.current.badge;
    document.getElementById("ui-rank-level").textContent = `LEVEL ${rankInfo.current.level}`;
    document.getElementById("ui-rank-title").textContent = rankInfo.current.title;
    document.getElementById("ui-xp-fill").style.width = `${rankInfo.progressPct}%`;
    document.getElementById("ui-xp-text").textContent = `${rankInfo.xp} XP`;
    document.getElementById("ui-xp-next").textContent = rankInfo.next
      ? `Next: ${rankInfo.next.minXP} XP`
      : "MAX RANK";

    document.getElementById("ui-streak-days").textContent = st.profile.streakDays || 1;
    document.getElementById("ui-best-combo").textContent = st.profile.bestCombo || 0;

    if (window.AuthGate) {
      const sess = window.AuthGate.getSession();
      const emailEl = document.getElementById("ui-active-user-email");
      if (emailEl) {
        emailEl.textContent = sess ? (sess.email || sess.username) : "Invitado Privado";
      }
    }

    document.getElementById("topbar-readiness-pct").textContent = `${report.readinessScore}%`;
    document.getElementById("topbar-readiness-dot").style.backgroundColor = report.readinessColor;

    const weakCount = report.weakChapters.length + report.mistakeItems.length;
    const weakBadge = document.getElementById("nav-badge-weak");
    if (weakCount > 0) {
      weakBadge.style.display = "inline-block";
      weakBadge.textContent = weakCount;
    } else {
      weakBadge.style.display = "none";
    }
  }

  function updateLaunchpadStats() {
    const qBank = window.QUESTION_BANK || [];
    const totalStems = qBank.reduce((s, x) => s + x.stems.length, 0);
    const visCount = qBank.filter(x => x.isVisual).length;
    const st = window.AdaptiveEngine.getState();

    document.getElementById("ui-bank-stats-text").textContent =
      `${qBank.length} study concepts • ${totalStems} rotating English question stems • ${visCount} visual map/chart items • Dynamic distractor sampling`;
    document.getElementById("ui-cooldown-count").textContent = (st.lastExamQuestionIds || []).length;
  }

  // =========================================================================
  // EXAM SIMULATOR LOGIC (20 QUESTIONS, PASS = 15/20)
  // =========================================================================
  function startNewExam(mode = "adaptive", chapterFilter = null, questionCount = 20) {
    instantFeedbackEnabled = document.getElementById("chk-instant-feedback").checked;
    const optionLengthModeEl = document.getElementById("sel-option-length-mode");
    const optionLengthMode = optionLengthModeEl ? optionLengthModeEl.value : "longest_correct";
    currentExam = window.AdaptiveEngine.generateExam({
      mode,
      chapterFilter,
      questionCount,
      optionLengthMode,
      durationMinutes: 30
    });
    currentQIndex = 0;
    userAnswers = {};
    flaggedQuestions = new Set();
    examRemainingSeconds = currentExam.durationSeconds;
    examStartTime = Date.now();

    switchMainTab("exam");
    document.body.classList.add("exam-running");
    document.getElementById("exam-launchpad").style.display = "none";
    document.getElementById("exam-results").style.display = "none";
    document.getElementById("exam-runner").style.display = "block";

    const modeLabels = {
      adaptive: "🍁 Adaptive 20-Question Practice Exam",
      weakness: "🎯 Targeted Weakness Reinforcement Exam",
      visual_focus: "🗺️ Visual Maps, Charts & Diagrams Exam",
      chapter: "⚔️ Chapter Boss Challenge Quiz"
    };
    document.getElementById("exam-active-mode-badge").textContent = modeLabels[mode] || "Practice Exam";
    document.getElementById("exam-q-total").textContent = currentExam.totalQuestions;
    document.getElementById("exam-answered-total").textContent = currentExam.totalQuestions;

    startExamTimer();
    renderActiveExamQuestion();
  }

  function startExamTimer() {
    if (examTimerInterval) clearInterval(examTimerInterval);
    updateTimerUI();
    examTimerInterval = setInterval(() => {
      examRemainingSeconds = Math.max(0, examRemainingSeconds - 1);
      updateTimerUI();
      if (examRemainingSeconds === 0) {
        clearInterval(examTimerInterval);
        finishAndGradeExam();
      }
    }, 1000);
  }

  function updateTimerUI() {
    const mins = String(Math.floor(examRemainingSeconds / 60)).padStart(2, "0");
    const secs = String(examRemainingSeconds % 60).padStart(2, "0");
    document.getElementById("exam-timer-display").textContent = `${mins}:${secs}`;
  }

  function renderQuestionStrip() {
    const strip = document.getElementById("exam-question-strip");
    strip.style.removeProperty("grid-template-columns");
    strip.classList.toggle("q-strip-10", currentExam.totalQuestions <= 10);
    strip.innerHTML = currentExam.questions.map((q, idx) => {
      const isCurr = idx === currentQIndex;
      const isAns = !!userAnswers[q.number];
      const isFlag = flaggedQuestions.has(q.number);
      return `
        <button class="q-dot-btn ${isCurr ? 'current' : ''} ${isAns ? 'answered' : ''} ${isFlag ? 'flagged' : ''}"
                data-q-idx="${idx}"
                title="Question ${q.number} (${q.chapterTitle})">
          ${q.number}
        </button>
      `;
    }).join("");

    strip.querySelectorAll(".q-dot-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentQIndex = parseInt(btn.dataset.qIdx, 10);
        renderActiveExamQuestion();
      });
    });
  }

  function renderActiveExamQuestion() {
    if (!currentExam) return;
    const q = currentExam.questions[currentQIndex];
    renderQuestionStrip();

    document.getElementById("exam-q-curr").textContent = q.number;
    document.getElementById("exam-q-chapter-pill").textContent =
      `${q.chapterIcon} ${q.chapterTitle} (Illustrated ${q.refIllustrated} / Large Print ${q.refLargePrint})`;
    document.getElementById("exam-q-reason-pill").textContent =
      `🧠 ${q.adaptiveReason} • Stem ${q.stemVariantIndex}/${q.stemTotalVariants}`;
    document.getElementById("exam-q-topic").textContent = q.topic + (q.isVisual ? " • [VISUAL MAP / CHART QUESTION]" : "");
    document.getElementById("exam-q-stem").textContent = q.questionText;

    // Visual Box rendering (PDF Figure + Interactive SVG Map/Chart Callout if present)
    const visBox = document.getElementById("exam-q-visual-box");
    const visContent = document.getElementById("exam-q-visual-content");
    if (q.isVisual && (q.visualAsset || q.svgCallout)) {
      visBox.style.display = "block";
      let html = "";
      if (q.svgCallout && q.svgCallout.type === "map") {
        html += window.SVGVisuals.renderCanadaMapSVG({
          highlightId: q.svgCallout.targetId,
          hideLabelsForHighlight: true
        });
      } else if (q.svgCallout && q.svgCallout.type === "gov_chart") {
        html += window.SVGVisuals.renderGovChartSVG({
          highlightBranch: q.svgCallout.targetId
        });
      }
      if (q.visualAsset) {
        html += `<img src="${q.visualAsset}" alt="${q.topic}" id="active-q-img" />`;
      }
      visContent.innerHTML = html;
      document.getElementById("exam-q-visual-caption").textContent =
        q.visualCaption || `Discover Canada Study Guide Figure (${q.refIllustrated})`;

      const imgEl = document.getElementById("active-q-img");
      if (imgEl) {
        imgEl.addEventListener("click", () => openLightbox(q.visualAsset, q.topic, q.visualCaption));
      }
    } else {
      visBox.style.display = "none";
      visContent.innerHTML = "";
    }

    // Options rendering
    const selectedLetter = userAnswers[q.number] || null;
    const showInstantReveal = instantFeedbackEnabled && !!selectedLetter;
    const optsContainer = document.getElementById("exam-options-list");

    optsContainer.innerHTML = q.options.map(opt => {
      let cls = "option-item";
      if (selectedLetter === opt.letter) cls += " selected";
      if (showInstantReveal) {
        if (opt.isCorrect) cls += " correct-reveal";
        else if (selectedLetter === opt.letter && !opt.isCorrect) cls += " wrong-reveal";
      }
      return `
        <button class="${cls}" data-letter="${opt.letter}" role="radio" aria-checked="${selectedLetter === opt.letter}">
          <span class="option-letter">${opt.letter}</span>
          <span class="option-text">${opt.text}</span>
        </button>
      `;
    }).join("");

    optsContainer.querySelectorAll(".option-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const letter = btn.dataset.letter;
        userAnswers[q.number] = letter;
        const chosenOpt = q.options.find(o => o.letter === letter);
        if (instantFeedbackEnabled && chosenOpt) {
          window.GamifiedStudy.playTone(chosenOpt.isCorrect ? "correct" : "wrong");
        } else {
          window.GamifiedStudy.playTone("flip");
        }
        renderActiveExamQuestion();
      });
    });

    // Instant Tutor Feedback box
    const fbBox = document.getElementById("exam-instant-feedback");
    if (showInstantReveal) {
      const chosenOpt = q.options.find(o => o.letter === selectedLetter);
      const isOk = chosenOpt && chosenOpt.isCorrect;
      fbBox.style.display = "block";
      fbBox.style.borderLeftColor = isOk ? "#059669" : "#dc2626";
      fbBox.innerHTML = `
        <div style="font-weight:800; color:${isOk ? '#059669' : '#dc2626'}; margin-bottom:4px;">
          ${isOk ? '✅ Correct!' : '❌ Needs Review — Correct Answer: ' + q.correctAnswer}
        </div>
        <div style="color:#334155; margin-bottom:6px;">${q.explanation}</div>
        <div style="font-size:12px; color:#64748b;">
          📖 Reference: <strong>Illustrated Guide ${q.refIllustrated}</strong> • <strong>Large Print Guide ${q.refLargePrint}</strong>
        </div>
      `;
    } else {
      fbBox.style.display = "none";
    }

    // Update Bottom Nav & Flag Button
    const answeredCount = Object.keys(userAnswers).length;
    document.getElementById("exam-answered-count").textContent = answeredCount;
    document.getElementById("btn-exam-prev").disabled = currentQIndex === 0;
    document.getElementById("btn-exam-flag").textContent = flaggedQuestions.has(q.number) ? "🚩 Flagged" : "🚩 Flag";

    const isLast = currentQIndex === currentExam.totalQuestions - 1;
    document.getElementById("btn-exam-next").style.display = isLast ? "none" : "inline-flex";
    document.getElementById("btn-exam-submit").style.display =
      (isLast || answeredCount === currentExam.totalQuestions) ? "inline-flex" : "none";
  }

  function finishAndGradeExam() {
    if (!currentExam) return;
    if (examTimerInterval) clearInterval(examTimerInterval);

    const elapsedSeconds = Math.max(5, Math.round((Date.now() - examStartTime) / 1000));
    const { record, newlyUnlocked } = window.AdaptiveEngine.submitExamResult(
      currentExam,
      userAnswers,
      elapsedSeconds
    );

    window.GamifiedStudy.playTone(record.passed ? "fanfare" : "wrong");

    if (newlyUnlocked && newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(ach => {
        showToast(`🏆 Achievement Unlocked: <strong>${ach.title}</strong> (+${ach.xpReward} XP)`);
      });
    }

    refreshSidebarAndHeader();
    updateLaunchpadStats();
    renderExamResultsView(record);
  }

  function renderExamResultsView(record) {
    document.body.classList.remove("exam-running");
    document.getElementById("exam-launchpad").style.display = "none";
    document.getElementById("exam-runner").style.display = "none";
    const resContainer = document.getElementById("exam-results");
    resContainer.style.display = "block";

    const mins = Math.floor(record.elapsedSeconds / 60);
    const secs = record.elapsedSeconds % 60;
    const missedCount = record.total - record.score;

    const chBarsHtml = record.chapterBreakdown.map(cb => {
      const pct = Math.round((cb.correct / cb.total) * 100);
      const color = pct >= 75 ? "#059669" : "#dc2626";
      return `
        <div class="chapter-bar-row">
          <div><strong>${cb.icon} ${cb.title}</strong></div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%; background:${color};"></div>
          </div>
          <div style="text-align:right; font-weight:800; color:${color};">${cb.correct}/${cb.total} (${pct}%)</div>
          <div style="text-align:right;">
            <button class="btn btn-outline btn-sm btn-jump-study-ch" data-ch="${cb.chapter}">Study Chapter</button>
          </div>
        </div>
      `;
    }).join("");

    const questionsReviewHtml = record.detailedResults.map(dr => `
      <div class="review-item ${dr.isCorrect ? 'correct' : 'wrong'}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:800; color:#475569;">
            Question ${dr.number} • ${dr.chapterTitle} • ${dr.topic} ${dr.isVisual ? '🗺️ [Visual]' : ''}
          </span>
          <span style="font-size:12px; font-weight:800; color:${dr.isCorrect ? '#059669' : '#dc2626'};">
            ${dr.isCorrect ? '✅ CORRECT' : '❌ INCORRECT (Added to Mistake Vault)'}
          </span>
        </div>
        <div style="font-size:15px; font-weight:800; margin-bottom:8px;">${dr.questionText}</div>
        ${dr.visualAsset ? `
          <div style="margin-bottom:10px;">
            <img src="${dr.visualAsset}" alt="${dr.topic}" style="max-height:150px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>
        ` : ''}
        <div style="font-size:13.5px; margin-bottom:4px;">
          <strong>Your Answer:</strong>
          <span style="color:${dr.isCorrect ? '#059669' : '#dc2626'}; font-weight:700;">
            ${dr.selectedLetter ? `${dr.selectedLetter}) ${dr.selectedText}` : 'No answer selected'}
          </span>
        </div>
        ${!dr.isCorrect ? `
          <div style="font-size:13.5px; margin-bottom:6px; color:#059669;">
            <strong>Correct Answer:</strong> <strong>${dr.correctAnswer}</strong>
          </div>
        ` : ''}
        <div style="font-size:13px; color:#334155; background:#f8fafc; padding:10px; border-radius:7px; margin-top:6px;">
          <strong>Study Guide Explanation:</strong> ${dr.explanation}
          <div style="margin-top:5px; font-size:11.5px; color:#64748b; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <span>📖 Illustrated Guide: <strong>${dr.refIllustrated}</strong> | Large Print Guide: <strong>${dr.refLargePrint}</strong> | Engine: <em>${dr.adaptiveReason}</em></span>
            <button class="btn-link btn-open-pdf-ref" data-ref="${dr.refIllustrated}">Open in PDF Guide →</button>
          </div>
        </div>
      </div>
    `).join("");

    resContainer.innerHTML = `
      <div class="results-banner ${record.passed ? 'pass' : 'fail'}">
        <div>
          <div style="font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; opacity:0.9;">
            ${record.passed ? '🎉 PASS CRITERION MET (15+ / 20)' : '⚠️ BELOW 15/20 PASS CRITERION — REINFORCEMENT RECOMMENDED'}
          </div>
          <h3 style="font-size:26px; font-weight:900; margin:4px 0 8px;">
            ${record.passed
              ? `Congratulations! You Passed with ${record.score} out of ${record.total} (${record.percentage}%)`
              : `You Scored ${record.score} out of ${record.total} (${record.percentage}%) — Need ${record.passMark}/${record.total} to Pass`}
          </h3>
          <p style="font-size:14px; opacity:0.95; max-width:650px;">
            Time: <strong>${mins}m ${secs}s</strong> • Visual Map/Chart Questions: <strong>${record.visualCorrect}/${record.visualTotal}</strong> • Experience Earned: <strong>+${record.xpEarned} XP</strong>
          </p>
          <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
            <button class="btn btn-outline" id="btn-res-new-exam">
              🔄 Take New Dynamic 20-Question Exam (Varied Questions)
            </button>
            ${missedCount > 0 ? `
              <button class="btn btn-amber" id="btn-res-weakness-exam">
                🎯 Reinforce Weak Areas (${missedCount} Missed Concepts Updated)
              </button>
            ` : ''}
            <button class="btn btn-secondary" id="btn-res-analytics">
              📊 View Full Progress &amp; Weak Areas
            </button>
          </div>
        </div>
        <div class="score-circle">
          <span class="big-score">${record.score}/${record.total}</span>
          <span class="pct-score">${record.percentage}%</span>
        </div>
      </div>

      <div class="section-card">
        <h3><span>📊 Performance by Book Section (This Exam)</span></h3>
        ${chBarsHtml}
      </div>

      <div class="section-card">
        <h3><span>🧐 Complete Question-by-Question Review &amp; PDF Citations</span></h3>
        ${questionsReviewHtml}
      </div>
    `;

    document.getElementById("btn-res-new-exam").addEventListener("click", () => startNewExam("adaptive"));
    const weakBtn = document.getElementById("btn-res-weakness-exam");
    if (weakBtn) weakBtn.addEventListener("click", () => startNewExam("weakness"));
    document.getElementById("btn-res-analytics").addEventListener("click", () => switchMainTab("analytics"));

    resContainer.querySelectorAll(".btn-jump-study-ch").forEach(btn => {
      btn.addEventListener("click", () => {
        switchMainTab("study");
        switchStudyMode("trail");
      });
    });

    resContainer.querySelectorAll(".btn-open-pdf-ref").forEach(btn => {
      btn.addEventListener("click", () => {
        const m = (btn.dataset.ref || "").match(/\d+/);
        if (m) currentPdfPage = Math.min(68, Math.max(1, parseInt(m[0], 10)));
        pdfExplorerSubmode = "pages";
        switchMainTab("pdf");
      });
    });
  }

  // =========================================================================
  // TAB 2: GAMIFIED STUDY LAB (4 MODES)
  // =========================================================================
  function switchStudyMode(mode) {
    activeStudyMode = mode;
    document.querySelectorAll(".study-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.studyMode === mode);
    });
    document.querySelectorAll(".study-mode-panel").forEach(p => {
      p.style.display = p.id === `study-panel-${mode}` ? "block" : "none";
    });
    renderActiveStudySubmode();
  }

  function renderActiveStudySubmode() {
    if (activeStudyMode === "trail") renderStudyTrail();
    if (activeStudyMode === "flashcards") renderFlashcardStudio();
    if (activeStudyMode === "mapgame") renderMapAndCivicsStudio();
    if (activeStudyMode === "blitz") renderMapleBlitzStudio();
  }

  // Mode 1: Canada Expedition Trail (11 Chapters)
  function renderStudyTrail() {
    const panel = document.getElementById("study-panel-trail");
    const report = window.AdaptiveEngine.getAnalyticsReport();

    const cardsHtml = (window.STUDY_CHAPTERS || []).map(ch => {
      const chRep = report.chapterReports.find(r => r.id === ch.id) || {};
      const accText = chRep.accuracy !== null ? `${chRep.accuracy}% Accuracy` : "Not Yet Tested";
      const statusColor = chRep.status === "mastered" ? "#059669"
        : chRep.status === "passing" ? "#0284c7"
        : chRep.status === "weak" ? "#dc2626" : "#64748b";

      return `
        <div class="chapter-trail-card">
          <div class="chapter-trail-top">
            <span class="chapter-num-badge" style="background:${ch.color};">
              ${ch.icon} CHAPTER ${ch.number}
            </span>
            <span style="font-size:12px; font-weight:800; color:${statusColor};">
              ${accText} • ${chRep.coveragePct || 0}% Seen
            </span>
          </div>
          <h4 style="font-size:16px; font-weight:800;">${ch.title}</h4>
          <div style="font-size:11.5px; color:#64748b;">
            📖 Illustrated Guide: <strong>${ch.pagesIllustrated}</strong> • Large Print: <strong>${ch.pagesLargePrint}</strong>
          </div>
          <p style="font-size:12.8px; color:#334155;">${ch.summary}</p>
          <details style="background:#f8fafc; padding:9px 12px; border-radius:8px; border:1px solid #e2e8f0;">
            <summary style="font-size:12.5px; font-weight:800; cursor:pointer; color:#1e3a8a;">
              📌 View All ${ch.keyTakeaways.length} High-Yield Exam Takeaways
            </summary>
            <ul class="takeaways-list" style="margin-top:8px;">
              ${ch.keyTakeaways.map(t => `<li>${t}</li>`).join("")}
            </ul>
            <blockquote style="margin-top:8px; font-size:11.5px; font-style:italic; color:#475569; border-left:3px solid ${ch.color}; padding-left:8px;">
              ${ch.quote}
            </blockquote>
          </details>
          <div style="display:flex; gap:8px; margin-top:auto; padding-top:6px;">
            <button class="btn btn-primary btn-sm btn-trail-quiz" data-ch="${ch.id}" style="flex:1;">
              ⚔️ Chapter Quiz (+XP)
            </button>
            <button class="btn btn-outline btn-sm btn-trail-flashcards" data-ch="${ch.id}">
              🧠 Flashcards
            </button>
            <button class="btn btn-outline btn-sm btn-trail-pdf" data-page="${ch.pdfStartPage}">
              📖 PDF p.${ch.pdfStartPage}
            </button>
          </div>
        </div>
      `;
    }).join("");

    panel.innerHTML = `
      <div class="section-card" style="background:linear-gradient(135deg, #1e293b, #0f172a); color:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="color:#fff; margin-bottom:4px;">🛶 The Trans-Canada Citizenship Expedition Trail (All 11 Chapters)</h3>
            <p style="font-size:13px; color:#cbd5e1;">
              Expand any chapter below to study every key date, law, symbol, and region, or launch a focused Chapter Boss Quiz to earn XP and raise your mastery above 75%.
            </p>
          </div>
          <div style="font-size:13px; background:rgba(255,255,255,0.1); padding:8px 14px; border-radius:8px;">
            Syllabus Explored: <strong>${report.seenConcepts} / ${report.totalConcepts} Concepts (${report.syllabusCoveragePct}%)</strong>
          </div>
        </div>
      </div>
      <div class="trail-grid">${cardsHtml}</div>
    `;

    panel.querySelectorAll(".btn-trail-quiz").forEach(btn => {
      btn.addEventListener("click", () => startNewExam("chapter", btn.dataset.ch, 10));
    });
    panel.querySelectorAll(".btn-trail-flashcards").forEach(btn => {
      btn.addEventListener("click", () => {
        fcFilter = btn.dataset.ch;
        fcIndex = 0;
        switchStudyMode("flashcards");
      });
    });
    panel.querySelectorAll(".btn-trail-pdf").forEach(btn => {
      btn.addEventListener("click", () => {
        currentPdfPage = parseInt(btn.dataset.page, 10) || 2;
        pdfExplorerSubmode = "pages";
        switchMainTab("pdf");
      });
    });
  }

  // Mode 2: 3D Spaced-Repetition Flashcards
  function buildFlashcardDeck() {
    const all = window.QUESTION_BANK || [];
    const st = window.AdaptiveEngine.getState();
    if (fcFilter === "weak") {
      fcDeck = all.filter(q => st.mistakeVault.includes(q.id) || (st.itemMastery[q.id] && st.itemMastery[q.id].leitnerBox === 1));
      if (fcDeck.length === 0) fcDeck = all.slice(0, 25);
    } else if (fcFilter === "visual") {
      fcDeck = all.filter(q => q.isVisual);
    } else if (fcFilter.startsWith("ch")) {
      fcDeck = all.filter(q => q.chapter === fcFilter);
    } else {
      fcDeck = all.slice();
    }
    if (fcIndex >= fcDeck.length) fcIndex = 0;
  }

  function renderFlashcardStudio() {
    buildFlashcardDeck();
    const panel = document.getElementById("study-panel-flashcards");
    const card = fcDeck[fcIndex] || window.QUESTION_BANK[0];
    const rec = window.AdaptiveEngine.getItemRecord(card.id);
    const chObj = (window.STUDY_CHAPTERS || []).find(c => c.id === card.chapter);

    const chOptions = (window.STUDY_CHAPTERS || []).map(c =>
      `<option value="${c.id}" ${fcFilter === c.id ? 'selected' : ''}>Chapter ${c.number}: ${c.shortTitle}</option>`
    ).join("");

    panel.innerHTML = `
      <div class="flashcard-stage">
        <div class="section-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; max-width:100%;">
            <strong>🧠 SM-2 Spaced-Repetition Deck:</strong>
            <select id="fc-filter-select" style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-weight:600; max-width:100%;">
              <option value="all" ${fcFilter === 'all' ? 'selected' : ''}>All 11 Chapters (${window.QUESTION_BANK.length} Cards)</option>
              <option value="weak" ${fcFilter === 'weak' ? 'selected' : ''}>🎯 Weak / Mistake Vault Cards</option>
              <option value="visual" ${fcFilter === 'visual' ? 'selected' : ''}>🗺️ Visual Map &amp; Chart Cards</option>
              ${chOptions}
            </select>
          </div>
          <div style="font-size:13px; font-weight:700; color:#475569;">
            Card <strong>${fcIndex + 1}</strong> of <strong>${fcDeck.length}</strong> • Leitner Box: <strong>${rec.leitnerBox || 'Unseen'} / 4</strong>
          </div>
        </div>

        <div class="flashcard-3d-wrap" id="fc-card-3d" title="Click to flip card">
          <div class="flashcard-3d-inner">
            <div class="flashcard-face flashcard-front">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="chapter-pill">${chObj ? chObj.icon + ' ' + chObj.shortTitle : card.chapter} • ${card.topic}</span>
                <span style="font-size:12px; color:#64748b; font-weight:700;">Click Card to Flip ↻</span>
              </div>
              <div style="my:auto;">
                <h3 style="font-size:20px; font-weight:800; color:#0f172a; line-height:1.4;">
                  ${card.stems[0]}
                </h3>
                ${card.visualAsset ? `
                  <div style="margin-top:10px; text-align:center;">
                    <img src="${card.visualAsset}" alt="${card.topic}" style="max-height:115px; border-radius:6px; border:1px solid #cbd5e1;" />
                  </div>
                ` : ''}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#64748b;">
                <span>PDF Ref: Illustrated ${card.refIllustrated} | Large Print ${card.refLargePrint}</span>
                <button class="btn btn-outline btn-sm" id="btn-fc-speak-q">🔊 Listen in English</button>
              </div>
            </div>

            <div class="flashcard-face flashcard-back">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; font-weight:800; color:#fde68a;">✅ STUDY GUIDE ANSWER &amp; EXPLANATION</span>
                <button class="btn btn-outline btn-sm" id="btn-fc-speak-a">🔊 Read Answer</button>
              </div>
              <div>
                <div style="font-size:18px; font-weight:900; color:#ffffff; margin-bottom:10px;">
                  ${card.answer}
                </div>
                <p style="font-size:13.2px; color:#e2e8f0; line-height:1.45;">
                  ${card.explanation}
                </p>
              </div>
              <div style="font-size:12px; color:#93c5fd;">
                Rate your recall below to schedule SM-2 review and earn XP!
              </div>
            </div>
          </div>
        </div>

        <div class="section-card" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-outline" id="btn-fc-prev">← Prev</button>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-danger" id="btn-fc-rate-again" title="Move to Leitner Box 1 for immediate reinforcement">
              🔴 Again (Need Practice)
            </button>
            <button class="btn btn-secondary" id="btn-fc-rate-good" title="Advance Leitner Box (+10 XP)">
              🔵 Good Recall (+10 XP)
            </button>
            <button class="btn btn-success" id="btn-fc-rate-easy" title="Mark Mastered in Leitner Box 4 (+15 XP)">
              🟢 Easy / Mastered (+15 XP)
            </button>
          </div>
          <button class="btn btn-outline" id="btn-fc-next">Next →</button>
        </div>
      </div>
    `;

    const wrapEl = document.getElementById("fc-card-3d");
    wrapEl.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      wrapEl.classList.toggle("flipped");
      window.GamifiedStudy.playTone("flip");
    });

    document.getElementById("fc-filter-select").addEventListener("change", (e) => {
      fcFilter = e.target.value;
      fcIndex = 0;
      renderFlashcardStudio();
    });

    document.getElementById("btn-fc-speak-q").addEventListener("click", (e) => {
      e.stopPropagation();
      window.GamifiedStudy.speakEnglish(card.stems[0]);
    });
    document.getElementById("btn-fc-speak-a").addEventListener("click", (e) => {
      e.stopPropagation();
      window.GamifiedStudy.speakEnglish(card.answer + ". " + card.explanation);
    });

    function handleRate(isCorrect, fastMs) {
      window.AdaptiveEngine.recordQuestionAttempt(card.id, isCorrect, fastMs);
      const st = window.AdaptiveEngine.getState();
      st.profile.flashcardsReviewed = (st.profile.flashcardsReviewed || 0) + 1;
      if (isCorrect) window.AdaptiveEngine.addXP(fastMs < 5000 ? 15 : 10);
      window.AdaptiveEngine.checkAchievements();
      window.AdaptiveEngine.saveState();
      window.GamifiedStudy.playTone(isCorrect ? "correct" : "wrong");
      refreshSidebarAndHeader();
      fcIndex = (fcIndex + 1) % fcDeck.length;
      renderFlashcardStudio();
    }

    document.getElementById("btn-fc-rate-again").addEventListener("click", () => handleRate(false, 25000));
    document.getElementById("btn-fc-rate-good").addEventListener("click", () => handleRate(true, 12000));
    document.getElementById("btn-fc-rate-easy").addEventListener("click", () => handleRate(true, 3000));
    document.getElementById("btn-fc-prev").addEventListener("click", () => {
      fcIndex = (fcIndex - 1 + fcDeck.length) % fcDeck.length;
      renderFlashcardStudio();
    });
    document.getElementById("btn-fc-next").addEventListener("click", () => {
      fcIndex = (fcIndex + 1) % fcDeck.length;
      renderFlashcardStudio();
    });
  }

  // Mode 3: Interactive Map of Canada & Civics Diagram Challenge
  function startMapChallengeGame() {
    const regions = window.AdaptiveEngine.shuffle(window.MAP_REGIONS_DATA || []);
    mapChallengeState = {
      active: true,
      round: 0,
      totalRounds: Math.min(10, regions.length),
      score: 0,
      targets: regions.slice(0, 10),
      selectedProvId: null,
      feedbackMsg: "Click the matching province or territory directly on the Map of Canada!"
    };
    renderMapAndCivicsStudio();
  }

  function renderMapAndCivicsStudio() {
    const panel = document.getElementById("study-panel-mapgame");
    const selectedData = (window.MAP_REGIONS_DATA || []).find(r => r.id === mapChallengeState.selectedProvId)
      || window.MAP_REGIONS_DATA[0];

    const currentTarget = mapChallengeState.active
      ? mapChallengeState.targets[mapChallengeState.round]
      : null;

    panel.innerHTML = `
      <div class="section-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="margin-bottom:2px;">🗺️ Interactive Map of Canada &amp; Civics Diagram Studio</h3>
          <p style="font-size:13px; color:#475569;">
            Click any province or territory on the map to inspect its capital, Confederation year, and exam facts — or start the <strong>10-Round Map Pinning Challenge</strong>!
          </p>
        </div>
        <button class="btn ${mapChallengeState.active ? 'btn-amber' : 'btn-primary'}" id="btn-start-map-game">
          ${mapChallengeState.active ? '🔄 Restart 10-Round Map Challenge' : '🎯 Start 10-Round Map Target Game (+150 XP)'}
        </button>
      </div>

      ${mapChallengeState.active && currentTarget ? `
        <div class="section-card" style="background:#eff6ff; border:2px solid #2563eb;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:800; color:#1d4ed8;">
              🎯 MAP CHALLENGE ROUND ${mapChallengeState.round + 1} OF ${mapChallengeState.totalRounds}
            </span>
            <span style="font-size:13px; font-weight:800; color:#059669;">
              Score: ${mapChallengeState.score} / ${mapChallengeState.round}
            </span>
          </div>
          <div style="font-size:16.5px; font-weight:800; color:#0f172a;">
            Click on the Map: Which province or territory has capital <u>${currentTarget.capital}</u> (joined Confederation in ${currentTarget.confederationYear})?
          </div>
          <div style="font-size:12.5px; color:#475569; margin-top:4px;">
            Clue: ${currentTarget.keyFacts[0]}
          </div>
          <div style="font-size:12.5px; font-weight:700; color:#b45309; margin-top:6px;">
            ${mapChallengeState.feedbackMsg}
          </div>
        </div>
      ` : ''}

      <div class="map-studio-layout">
        <div class="section-card">
          ${window.SVGVisuals.renderCanadaMapSVG({
            interactive: true,
            selectedId: mapChallengeState.selectedProvId
          })}
          <div style="margin-top:10px; display:flex; justify-content:space-between; font-size:12px; color:#64748b;">
            <span>Colors match the 5 Discover Canada regions: Atlantic, Central, Prairies, West Coast &amp; North</span>
            <button class="btn-link" id="btn-view-pdf-map-jpg">🔍 View Original PDF Map (p. 45)</button>
          </div>
        </div>

        <div class="section-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="chapter-num-badge" style="background:${selectedData.regionColor};">${selectedData.region}</span>
            <span style="font-size:12px; font-weight:800; color:#475569;">Confederation: ${selectedData.confederationYear}</span>
          </div>
          <h3 style="font-size:20px; margin-bottom:4px;">${selectedData.name} (${selectedData.id})</h3>
          <div style="font-size:14px; font-weight:800; color:#c8102e; margin-bottom:12px;">
            🏛️ Capital City: ${selectedData.capital}
          </div>
          <h4 style="font-size:12.5px; text-transform:uppercase; color:#64748b; margin-bottom:6px;">Key Study Facts:</h4>
          <ul class="takeaways-list" style="margin-bottom:14px;">
            ${selectedData.keyFacts.map(f => `<li>${f}</li>`).join("")}
          </ul>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:12px 0;" />
          <h4 style="font-size:13px; font-weight:800; margin-bottom:8px;">🏛️ Interactive System of Government Reference</h4>
          ${window.SVGVisuals.renderGovChartSVG()}
        </div>
      </div>
    `;

    document.getElementById("btn-start-map-game").addEventListener("click", startMapChallengeGame);
    document.getElementById("btn-view-pdf-map-jpg").addEventListener("click", () => {
      openLightbox("../assets/figures/map_canada_full.jpg", "Map of Canada (Page 45)", "10 Provinces, 3 Territories, 3 Oceans & Ottawa");
    });

    panel.querySelectorAll(".clickable-province").forEach(el => {
      el.addEventListener("click", () => {
        const clickedId = el.dataset.provId;
        mapChallengeState.selectedProvId = clickedId;

        if (mapChallengeState.active && currentTarget) {
          if (clickedId === currentTarget.id) {
            mapChallengeState.score += 1;
            window.GamifiedStudy.playTone("correct");
            mapChallengeState.feedbackMsg = `✅ Correct! ${currentTarget.name} — Capital: ${currentTarget.capital}`;
          } else {
            window.GamifiedStudy.playTone("wrong");
            const clickedObj = window.MAP_REGIONS_DATA.find(r => r.id === clickedId);
            mapChallengeState.feedbackMsg = `❌ You clicked ${clickedObj ? clickedObj.name : clickedId}. Look for ${currentTarget.name} (${currentTarget.id})!`;
          }

          mapChallengeState.round += 1;
          if (mapChallengeState.round >= mapChallengeState.totalRounds) {
            const finalScore = mapChallengeState.score;
            const total = mapChallengeState.totalRounds;
            mapChallengeState.active = false;
            const st = window.AdaptiveEngine.getState();
            st.profile.mapChallengesCompleted = (st.profile.mapChallengesCompleted || 0) + 1;
            window.AdaptiveEngine.addXP(finalScore * 15);
            window.AdaptiveEngine.checkAchievements();
            window.AdaptiveEngine.saveState();
            window.GamifiedStudy.playTone("fanfare");
            showToast(`🗺️ Map Challenge Complete! Score: <strong>${finalScore}/${total}</strong> (+${finalScore * 15} XP)`);
            refreshSidebarAndHeader();
          }
        } else {
          window.GamifiedStudy.playTone("flip");
        }
        renderMapAndCivicsStudio();
      });
    });
  }

  // Mode 4: 60-Second "Maple Blitz" Rapid-Fire Arcade
  function startMapleBlitz() {
    if (blitzState.timerInterval) clearInterval(blitzState.timerInterval);
    blitzState = {
      active: true,
      timerInterval: null,
      secondsLeft: 60,
      score: 0,
      combo: 0,
      currentQ: pickBlitzQuestion()
    };
    blitzState.timerInterval = setInterval(() => {
      blitzState.secondsLeft = Math.max(0, blitzState.secondsLeft - 1);
      const timerEl = document.getElementById("blitz-timer-val");
      if (timerEl) timerEl.textContent = `${blitzState.secondsLeft}s`;
      if (blitzState.secondsLeft === 0) {
        clearInterval(blitzState.timerInterval);
        blitzState.active = false;
        const st = window.AdaptiveEngine.getState();
        if (blitzState.score > (st.profile.blitzHighScore || 0)) {
          st.profile.blitzHighScore = blitzState.score;
        }
        window.AdaptiveEngine.addXP(blitzState.score * 10);
        window.AdaptiveEngine.checkAchievements();
        window.AdaptiveEngine.saveState();
        window.GamifiedStudy.playTone("fanfare");
        refreshSidebarAndHeader();
        renderMapleBlitzStudio();
      }
    }, 1000);
    renderMapleBlitzStudio();
  }

  function pickBlitzQuestion() {
    const pool = window.QUESTION_BANK || [];
    const concept = pool[Math.floor(Math.random() * pool.length)];
    const stem = concept.stems[Math.floor(Math.random() * concept.stems.length)];
    const distractors = window.AdaptiveEngine.shuffle(concept.distractors).slice(0, 3);
    const options = window.AdaptiveEngine.shuffle([
      { text: concept.answer, isCorrect: true },
      ...distractors.map(d => ({ text: d, isCorrect: false }))
    ]);
    return { concept, stem, options };
  }

  function renderMapleBlitzStudio() {
    const panel = document.getElementById("study-panel-blitz");
    const st = window.AdaptiveEngine.getState();

    if (!blitzState.active) {
      panel.innerHTML = `
        <div class="section-card" style="text-align:center; padding:42px 24px; max-width:680px; margin:0 auto;">
          <div style="font-size:48px; margin-bottom:10px;">⚡🍁</div>
          <h3 style="font-size:24px; justify-content:center; margin-bottom:8px;">60-Second Maple Blitz Challenge</h3>
          <p style="font-size:14px; color:#475569; max-width:520px; margin:0 auto 18px;">
            Test your instant recall across all 11 chapters of <em>Discover Canada</em>! Build consecutive answer combos (2x, 3x, 5x) before the 60-second clock runs out.
          </p>
          <div style="display:flex; justify-content:center; gap:18px; margin-bottom:22px;">
            <div class="spec-pill" style="background:#f1f5f9; color:#0f172a; font-weight:800;">
              🏆 Personal Best: ${st.profile.blitzHighScore || 0} pts
            </div>
            <div class="spec-pill" style="background:#fef3c7; color:#92400e; font-weight:800;">
              Last Round: ${blitzState.score} pts
            </div>
          </div>
          <button class="btn btn-primary btn-lg" id="btn-launch-blitz">
            ⚡ Launch 60-Second Maple Blitz Now
          </button>
        </div>
      `;
      document.getElementById("btn-launch-blitz").addEventListener("click", startMapleBlitz);
      return;
    }

    const q = blitzState.currentQ;
    panel.innerHTML = `
      <div class="section-card" style="max-width:760px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <span class="timer-pill">⏱️ <span id="blitz-timer-val">${blitzState.secondsLeft}s</span></span>
          <span style="font-size:15px; font-weight:900; color:#d97706;">🔥 Combo: ${blitzState.combo}x</span>
          <span style="font-size:16px; font-weight:900; color:#059669;">Score: ${blitzState.score}</span>
        </div>
        <div style="font-size:12px; font-weight:800; color:#c8102e; margin-bottom:6px;">${q.concept.topic}</div>
        <h3 style="font-size:18px; margin-bottom:16px;">${q.stem}</h3>
        <div class="options-list">
          ${q.options.map((opt, idx) => `
            <button class="option-item blitz-opt-btn" data-idx="${idx}">
              <span class="option-letter">${["A", "B", "C", "D"][idx]}</span>
              <span class="option-text">${opt.text}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    panel.querySelectorAll(".blitz-opt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const chosen = q.options[idx];
        window.AdaptiveEngine.recordQuestionAttempt(q.concept.id, chosen.isCorrect, 4000);
        if (chosen.isCorrect) {
          blitzState.combo += 1;
          blitzState.score += (blitzState.combo >= 5 ? 2 : 1);
          window.GamifiedStudy.playTone("correct");
        } else {
          blitzState.combo = 0;
          window.GamifiedStudy.playTone("wrong");
        }
        blitzState.currentQ = pickBlitzQuestion();
        renderMapleBlitzStudio();
      });
    });
  }

  // =========================================================================
  // TAB 3: PROGRESS ANALYTICS & WEAK AREAS DASHBOARD
  // =========================================================================
  function renderAnalyticsTab() {
    const container = document.getElementById("analytics-container");
    const report = window.AdaptiveEngine.getAnalyticsReport();

    const weakAreasHtml = (report.weakChapters.length === 0 && report.mistakeItems.length === 0)
      ? `<div style="padding:14px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; color:#065f46; font-weight:700;">
           ✅ No weak chapters (<75%) or unresolved mistakes in your Mistake Vault! Keep taking dynamic exams to reach 100% syllabus coverage.
         </div>`
      : `
        ${report.weakChapters.length > 0 ? `
          <div style="margin-bottom:14px;">
            <h4 style="font-size:13.5px; font-weight:800; color:#dc2626; margin-bottom:8px;">
              ⚠️ Chapters Below 75% Passing Threshold (Priority Reinforcement Recommended):
            </h4>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${report.weakChapters.map(wc => `
                <div style="background:#fef2f2; border:1px solid #fecaca; padding:8px 12px; border-radius:8px; display:flex; align-items:center; gap:10px;">
                  <span><strong>${wc.icon} ${wc.shortTitle}:</strong> <strong style="color:#dc2626;">${wc.accuracy}%</strong> (${wc.correct}/${wc.attempts})</span>
                  <button class="btn btn-primary btn-sm btn-analytics-quiz-ch" data-ch="${wc.id}">Quiz Chapter</button>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ''}

        ${report.mistakeItems.length > 0 ? `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h4 style="font-size:13.5px; font-weight:800; color:#b45309;">
                🎯 Mistake Vault (${report.mistakeItems.length} Concepts Missed — Cleared after 2 consecutive correct answers):
              </h4>
              <button class="btn btn-amber btn-sm" id="btn-analytics-launch-weakness">
                Launch 20-Question Weakness Exam
              </button>
            </div>
            ${report.mistakeItems.slice(0, 8).map(mi => `
              <div class="review-item wrong" style="padding:12px;">
                <div style="font-size:11.5px; font-weight:800; color:#991b1b;">
                  ${mi.chapterTitle} • ${mi.topic} (Illustrated ${mi.refIllustrated} / Large Print ${mi.refLargePrint})
                </div>
                <div style="font-size:14px; font-weight:800; margin:3px 0;">${mi.questionText}</div>
                <div style="font-size:13px; color:#059669;"><strong>Correct Answer:</strong> ${mi.answer}</div>
                <div style="font-size:12px; color:#475569; margin-top:3px;">${mi.explanation}</div>
              </div>
            `).join("")}
          </div>
        ` : ''}
      `;

    const chapterRowsHtml = report.chapterReports.map(cr => {
      const acc = cr.accuracy !== null ? cr.accuracy : 0;
      const barColor = cr.status === "mastered" ? "#059669"
        : cr.status === "passing" ? "#0284c7"
        : cr.status === "weak" ? "#dc2626" : "#94a3b8";
      const badgeLabel = cr.status === "mastered" ? "✅ Mastered"
        : cr.status === "passing" ? "🔵 Passing (75%+)"
        : cr.status === "weak" ? "⚠️ Reinforce (<75%)" : "⚪ Untested";

      return `
        <div class="chapter-bar-row">
          <div>
            <strong>${cr.icon} Ch.${cr.number}: ${cr.shortTitle}</strong>
            <div style="font-size:11px; color:#64748b;">Coverage: ${cr.seenCount}/${cr.totalCount} (${cr.coveragePct}%)</div>
          </div>
          <div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${acc}%; background:${barColor};"></div>
            </div>
          </div>
          <div style="text-align:right; font-weight:800; color:${barColor};">
            ${cr.accuracy !== null ? `${cr.accuracy}% (${cr.correct}/${cr.attempts})` : '—'}
          </div>
          <div style="text-align:right;">
            <button class="btn btn-outline btn-sm btn-analytics-quiz-ch" data-ch="${cr.id}">${badgeLabel}</button>
          </div>
        </div>
      `;
    }).join("");

    const historyHtml = report.examHistory.length === 0
      ? `<p style="font-size:13px; color:#64748b;">No exams completed yet. Take your first 20-question exam to see your score trend!</p>`
      : report.examHistory.slice(0, 12).map((ex, i) => `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:13px;">
            <div>
              <strong>Exam #${report.examHistory.length - i}</strong>
              <span style="color:#64748b; margin-left:8px;">${new Date(ex.completedAt).toLocaleString()} • Mode: ${ex.mode}</span>
            </div>
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:10px;">
              <span>Visuals: <strong>${ex.visualCorrect}/${ex.visualTotal}</strong></span>
              <span style="font-weight:900; padding:3px 10px; border-radius:99px; background:${ex.passed ? '#dcfce7' : '#fee2e2'}; color:${ex.passed ? '#166534' : '#991b1b'};">
                ${ex.score}/${ex.total} (${ex.percentage}%) — ${ex.passed ? 'PASSED' : 'NEEDS REVIEW'}
              </span>
            </div>
          </div>
        `).join("");

    container.innerHTML = `
      <div class="kpi-grid-4">
        <div class="kpi-card">
          <div class="kpi-label">Estimated Readiness Score</div>
          <div class="kpi-value" style="color:${report.readinessColor};">${report.readinessScore}%</div>
          <div class="kpi-sub">${report.readinessVerdict}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">20-Question Exams Passed</div>
          <div class="kpi-value">${report.examsPassed} / ${report.totalExamsTaken}</div>
          <div class="kpi-sub">Recent Avg: <strong>${report.avgExamScoreOutOf20} / 20</strong> (Pass = 15/20)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Book Syllabus Coverage</div>
          <div class="kpi-value">${report.syllabusCoveragePct}%</div>
          <div class="kpi-sub">${report.seenConcepts} of ${report.totalConcepts} Study Concepts Tested</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Maps &amp; Charts Accuracy</div>
          <div class="kpi-value">${report.visualAccuracy !== null ? report.visualAccuracy + '%' : '—'}</div>
          <div class="kpi-sub">Text Questions Accuracy: ${report.textAccuracy !== null ? report.textAccuracy + '%' : '—'}</div>
        </div>
      </div>

      <div class="section-card">
        <h3>
          <span>🎯 Intelligent Weak-Area Detector &amp; Mistake Vault</span>
          <button class="btn btn-primary btn-sm" id="btn-top-reinforce">Start 20-Question Targeted Exam</button>
        </h3>
        ${weakAreasHtml}
      </div>

      <div class="section-card">
        <h3><span>📚 Chapter-by-Chapter Mastery Breakdown (All 11 Sections of Discover Canada)</span></h3>
        ${chapterRowsHtml}
      </div>

      <div class="section-card">
        <h3><span>📈 Recent 20-Question Exam History</span></h3>
        ${historyHtml}
      </div>
    `;

    container.querySelectorAll(".btn-analytics-quiz-ch").forEach(btn => {
      btn.addEventListener("click", () => startNewExam("chapter", btn.dataset.ch, 10));
    });
    const topReinforce = document.getElementById("btn-top-reinforce");
    if (topReinforce) topReinforce.addEventListener("click", () => startNewExam("weakness"));
    const vaultBtn = document.getElementById("btn-analytics-launch-weakness");
    if (vaultBtn) vaultBtn.addEventListener("click", () => startNewExam("weakness"));
  }

  // =========================================================================
  // TAB 4: MAPS, CHARTS & 68-PAGE ILLUSTRATED PDF EXPLORER
  // =========================================================================
  function renderPdfExplorerTab() {
    const container = document.getElementById("pdf-explorer-container");
    const atlas = window.GamifiedStudy.VISUAL_FIGURES_ATLAS || [];

    const chJumpButtons = (window.STUDY_CHAPTERS || []).map(ch => `
      <button class="btn btn-outline btn-sm btn-pdf-ch-jump ${currentPdfPage >= ch.pdfStartPage && currentPdfPage <= ch.pdfEndPage ? 'selected' : ''}"
              data-page="${ch.pdfStartPage}">
        ${ch.icon} Ch.${ch.number} (p.${ch.pdfStartPage})
      </button>
    `).join("");

    let bodyHtml = "";
    if (pdfExplorerSubmode === "atlas") {
      bodyHtml = `
        <div class="trail-grid">
          ${atlas.map(fig => `
            <div class="chapter-trail-card">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="mode-tag mode-tag-blue">Illustrated Guide p. ${fig.page}</span>
                <button class="btn-link btn-atlas-open-page" data-page="${fig.page}">Open Full Page ${fig.page} →</button>
              </div>
              <h4 style="font-size:15px; font-weight:800;">${fig.title}</h4>
              <img src="${fig.asset}" alt="${fig.title}" class="atlas-thumb-img"
                   data-src="${fig.asset}" data-title="${fig.title}"
                   style="width:100%; height:180px; object-fit:contain; background:#f8fafc; border-radius:8px; border:1px solid #cbd5e1; cursor:zoom-in;" />
              <ul class="takeaways-list">
                ${fig.keyPoints.map(kp => `<li>${kp}</li>`).join("")}
              </ul>
            </div>
          `).join("")}
        </div>
      `;
    } else {
      const pageStr = String(currentPdfPage).padStart(2, "0");
      const pageImgSrc = `../assets/pdf_pages/page_${pageStr}.jpg`;
      bodyHtml = `
        <div class="section-card">
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
            ${chJumpButtons}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px; background:#f8fafc; padding:10px 14px; border-radius:8px;">
            <button class="btn btn-secondary btn-sm" id="btn-pdf-prev-page" ${currentPdfPage <= 1 ? 'disabled' : ''}>← Page ${currentPdfPage - 1}</button>
            <div style="display:flex; align-items:center; flex-wrap:wrap; justify-content:center; gap:10px;">
              <strong>Illustrated Study Guide — Page ${currentPdfPage} of 68</strong>
              <input type="range" id="pdf-page-slider" min="1" max="68" value="${currentPdfPage}" style="width:160px; max-width:100%;" />
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-pdf-next-page" ${currentPdfPage >= 68 ? 'disabled' : ''}>Page ${currentPdfPage + 1} →</button>
          </div>
          <div style="text-align:center; background:#0f172a; padding:16px; border-radius:12px;">
            <img src="${pageImgSrc}" alt="Discover Canada Page ${currentPdfPage}"
                 id="pdf-fullpage-img"
                 style="max-width:100%; max-height:74vh; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.4); cursor:zoom-in;" />
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="section-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; gap:8px;">
          <button class="btn ${pdfExplorerSubmode === 'atlas' ? 'btn-primary' : 'btn-outline'}" id="btn-submode-atlas">
            🗺️ 16 Visual Maps, Tables &amp; Charts Atlas
          </button>
          <button class="btn ${pdfExplorerSubmode === 'pages' ? 'btn-primary' : 'btn-outline'}" id="btn-submode-pages">
            📖 Browse All 68 Illustrated PDF Pages (p. ${currentPdfPage})
          </button>
        </div>
        <div style="display:flex; gap:8px;">
          <a class="btn btn-outline btn-sm" href="../assets/pdfs/discover-canada-illustrated.pdf" target="_blank" style="text-decoration:none;">
            📄 Illustrated PDF (68p)
          </a>
          <a class="btn btn-outline btn-sm" href="../assets/pdfs/discover-canada-large-print.pdf" target="_blank" style="text-decoration:none;">
            📄 Large Print PDF (129p)
          </a>
        </div>
      </div>
      ${bodyHtml}
    `;

    document.getElementById("btn-submode-atlas").addEventListener("click", () => {
      pdfExplorerSubmode = "atlas";
      renderPdfExplorerTab();
    });
    document.getElementById("btn-submode-pages").addEventListener("click", () => {
      pdfExplorerSubmode = "pages";
      renderPdfExplorerTab();
    });

    container.querySelectorAll(".atlas-thumb-img").forEach(img => {
      img.addEventListener("click", () => openLightbox(img.dataset.src, img.dataset.title, ""));
    });
    container.querySelectorAll(".btn-atlas-open-page").forEach(btn => {
      btn.addEventListener("click", () => {
        currentPdfPage = parseInt(btn.dataset.page, 10);
        pdfExplorerSubmode = "pages";
        renderPdfExplorerTab();
      });
    });
    container.querySelectorAll(".btn-pdf-ch-jump").forEach(btn => {
      btn.addEventListener("click", () => {
        currentPdfPage = parseInt(btn.dataset.page, 10);
        renderPdfExplorerTab();
      });
    });

    const prevBtn = document.getElementById("btn-pdf-prev-page");
    if (prevBtn) prevBtn.addEventListener("click", () => { currentPdfPage = Math.max(1, currentPdfPage - 1); renderPdfExplorerTab(); });
    const nextBtn = document.getElementById("btn-pdf-next-page");
    if (nextBtn) nextBtn.addEventListener("click", () => { currentPdfPage = Math.min(68, currentPdfPage + 1); renderPdfExplorerTab(); });
    const slider = document.getElementById("pdf-page-slider");
    if (slider) slider.addEventListener("input", (e) => { currentPdfPage = parseInt(e.target.value, 10); renderPdfExplorerTab(); });
    const fullImg = document.getElementById("pdf-fullpage-img");
    if (fullImg) fullImg.addEventListener("click", () => openLightbox(fullImg.src, `Discover Canada — Page ${currentPdfPage}`, ""));
  }

  // =========================================================================
  // TAB 5: ACHIEVEMENTS & MAC-TO-MAC PORTABILITY
  // =========================================================================
  function renderProfileTab() {
    const container = document.getElementById("profile-container");
    const st = window.AdaptiveEngine.getState();
    const rankInfo = window.AdaptiveEngine.getCurrentRank();
    const unlocked = st.profile.unlockedAchievements || [];

    const achievementsHtml = (window.ACHIEVEMENTS_CATALOG || []).map(ach => {
      const isUnl = unlocked.includes(ach.id);
      return `
        <div class="mode-card" style="opacity:${isUnl ? '1' : '0.58'}; border-color:${isUnl ? '#f59e0b' : '#e2e8f0'}; background:${isUnl ? '#fffbeb' : '#ffffff'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:28px;">${ach.icon}</span>
            <span class="mode-tag ${isUnl ? 'mode-tag-amber' : ''}">${isUnl ? '✅ UNLOCKED' : `🔒 +${ach.xpReward} XP`}</span>
          </div>
          <h4>${ach.title}</h4>
          <p style="margin-bottom:0;">${ach.desc}</p>
        </div>
      `;
    }).join("");

    const ranksHtml = (window.CITIZENSHIP_RANKS || []).map(r => {
      const reached = rankInfo.xp >= r.minXP;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; border-radius:8px; margin-bottom:6px; background:${reached ? '#ecfdf5' : '#f8fafc'}; border:1px solid ${reached ? '#a7f3d0' : '#e2e8f0'};">
          <div>
            <span style="font-size:18px; margin-right:8px;">${r.badge}</span>
            <strong>Level ${r.level}: ${r.title}</strong>
            <span style="font-size:12px; color:#64748b; margin-left:8px;">— ${r.desc}</span>
          </div>
          <span style="font-size:12px; font-weight:800; color:${reached ? '#059669' : '#64748b'};">
            ${r.minXP} XP ${reached ? '✅' : ''}
          </span>
        </div>
      `;
    }).join("");

    const session = window.AuthGate ? window.AuthGate.getSession() : null;
    const authCfg = window.AuthGate ? window.AuthGate.getConfig() : { secretInviteKey: "canada-2026-vip-7x9k2m" };
    const shareLink = window.AuthGate ? window.AuthGate.getShareablePrivateLink() : "";

    container.innerHTML = `
      <div class="section-card" style="border:2px solid #2563eb; background:linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);">
        <h3><span>🔒 Acceso Privado (GitHub Pages), Enlace Secreto y Usuario / Contraseña</span></h3>
        <p style="font-size:13.3px; color:#334155; margin-bottom:12px;">
          Esta herramienta de estudio independiente está protegida por <strong>Enlace Privado de Invitación</strong> + <strong>Usuario y Contraseña</strong>. Solamente las personas autorizadas pueden iniciar sesión y usar la aplicación:
        </p>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
          <input type="text" id="input-share-private-link" value="${shareLink}" readonly style="flex:1; min-width:260px; padding:9px 12px; border-radius:8px; border:1.5px solid #93c5fd; font-weight:700; font-size:12.5px; color:#1e3a8a; background:#ffffff;" />
          <button class="btn btn-primary" id="btn-profile-copy-link">
            🔗 Copiar Enlace Privado para Compartir
          </button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; font-size:12.5px; color:#475569; background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #cbd5e1;">
          <div>
            👤 Sesión Activa: <strong>${session ? (session.displayName + ' (' + session.username + ')') : 'Sin sesión'}</strong>
            • Clave de Enlace: <code>${authCfg.secretInviteKey}</code>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-profile-logout">
            🚪 Cerrar Sesión / Cambiar Usuario
          </button>
        </div>
      </div>

      <div class="section-card">
        <h3><span>💻 Mac-to-Mac Portability &amp; Backup Center</span></h3>
        <p style="font-size:13.5px; color:#475569; margin-bottom:14px;">
          This application is built as a standalone Universal macOS App Bundle (runs natively on both Apple Silicon M1/M2/M3/M4 and Intel Macs). To carry your complete adaptive learning profile, SM-2 spaced-repetition memory, and exam history to another Mac, export your progress JSON file or import an existing backup below:
        </p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-primary" id="btn-export-json">
            📤 Export Progress Backup (.json)
          </button>
          <label class="btn btn-secondary" style="cursor:pointer;">
            📥 Import Progress Backup (.json)
            <input type="file" id="input-import-json" accept=".json,application/json" style="display:none;" />
          </label>
          <button class="btn btn-danger" id="btn-reset-progress" style="margin-left:auto;">
            🗑️ Reset All Progress
          </button>
        </div>
      </div>

      <div class="section-card">
        <h3><span>👑 Citizenship Ranks Ladder (Current: ${rankInfo.xp} XP)</span></h3>
        ${ranksHtml}
      </div>

      <div class="section-card">
        <h3><span>🏆 Citizenship Badges &amp; Achievements (${unlocked.length} / ${(window.ACHIEVEMENTS_CATALOG || []).length} Unlocked)</span></h3>
        <div class="cards-grid-3">${achievementsHtml}</div>
      </div>
    `;

    document.getElementById("btn-export-json").addEventListener("click", triggerExportProgress);
    const copyLinkBtn = document.getElementById("btn-profile-copy-link");
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener("click", copyPrivateLinkToClipboard);
    }
    const profileLogoutBtn = document.getElementById("btn-profile-logout");
    if (profileLogoutBtn && window.AuthGate) {
      profileLogoutBtn.addEventListener("click", () => window.AuthGate.signOut());
    }
    document.getElementById("input-import-json").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          window.AdaptiveEngine.importPortableJSON(reader.result);
          refreshSidebarAndHeader();
          renderProfileTab();
          showToast("✅ Progress Backup Imported Successfully!");
        } catch (err) {
          showToast("❌ Invalid JSON backup file: " + err.message);
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("btn-reset-progress").addEventListener("click", () => {
      window.AdaptiveEngine.resetAllProgress();
      refreshSidebarAndHeader();
      updateLaunchpadStats();
      renderProfileTab();
      showToast("🔄 Progress has been reset to a fresh profile.");
    });
  }

  function copyPrivateLinkToClipboard() {
    if (!window.AuthGate) return;
    const link = window.AuthGate.getShareablePrivateLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        showToast(`🔗 Enlace Privado copiado: <strong>${link}</strong>`);
      }).catch(() => {
        showToast(`🔗 Enlace Privado: <strong>${link}</strong>`);
      });
    } else {
      showToast(`🔗 Enlace Privado: <strong>${link}</strong>`);
    }
  }

  function triggerExportProgress() {
    const json = window.AdaptiveEngine.exportPortableJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discover-canada-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("📤 Progress exported as portable JSON file!");
  }

  // =========================================================================
  // GLOBAL EVENT BINDINGS & KEYBOARD SHORTCUTS
  // =========================================================================
  function bindGlobalEvents() {
    // Mobile drawer toggle (Account / XP menu on screens <= 860px)
    const mobileToggleBtn = document.getElementById("btn-mobile-drawer-toggle");
    const mainSidebar = document.getElementById("main-sidebar");
    if (mobileToggleBtn && mainSidebar) {
      mobileToggleBtn.addEventListener("click", () => {
        const isOpen = mainSidebar.classList.toggle("mobile-drawer-open");
        mobileToggleBtn.textContent = isOpen ? "✕ Cerrar ▴" : "⚙️ Cuenta / XP ▾";
      });
    }

    // Sidebar tab navigation
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (mainSidebar && mainSidebar.classList.contains("mobile-drawer-open")) {
          mainSidebar.classList.remove("mobile-drawer-open");
          if (mobileToggleBtn) mobileToggleBtn.textContent = "⚙️ Cuenta / XP ▾";
        }
        switchMainTab(btn.dataset.tab);
      });
    });

    // Sound toggle & Quick export & Private Link / Logout
    document.getElementById("btn-toggle-sound").addEventListener("click", (e) => {
      const on = window.GamifiedStudy.toggleSound();
      e.currentTarget.textContent = on ? "🔊 Sound FX: ON" : "🔇 Sound FX: OFF";
    });
    document.getElementById("btn-quick-export").addEventListener("click", triggerExportProgress);
    const sideCopyBtn = document.getElementById("btn-copy-private-link");
    if (sideCopyBtn) sideCopyBtn.addEventListener("click", copyPrivateLinkToClipboard);
    const sideLogoutBtn = document.getElementById("btn-logout-user");
    if (sideLogoutBtn && window.AuthGate) {
      sideLogoutBtn.addEventListener("click", () => window.AuthGate.signOut());
    }

    // Topbar quick weakness exam
    document.getElementById("btn-start-quick-weakness").addEventListener("click", () => startNewExam("weakness"));

    // Exam launchpad buttons
    document.getElementById("btn-launch-standard-exam").addEventListener("click", () => startNewExam("adaptive"));
    document.querySelectorAll("[data-exam-mode]").forEach(btn => {
      btn.addEventListener("click", () => startNewExam(btn.dataset.examMode));
    });

    // Active Exam Runner controls
    document.getElementById("btn-exam-prev").addEventListener("click", () => {
      if (currentQIndex > 0) {
        currentQIndex -= 1;
        renderActiveExamQuestion();
      }
    });
    document.getElementById("btn-exam-next").addEventListener("click", () => {
      if (currentExam && currentQIndex < currentExam.totalQuestions - 1) {
        currentQIndex += 1;
        renderActiveExamQuestion();
      }
    });
    document.getElementById("btn-exam-submit").addEventListener("click", finishAndGradeExam);
    document.getElementById("btn-exam-abort").addEventListener("click", () => {
      if (examTimerInterval) clearInterval(examTimerInterval);
      currentExam = null;
      document.body.classList.remove("exam-running");
      document.getElementById("exam-runner").style.display = "none";
      document.getElementById("exam-launchpad").style.display = "block";
    });
    document.getElementById("btn-exam-flag").addEventListener("click", () => {
      if (!currentExam) return;
      const qNum = currentExam.questions[currentQIndex].number;
      if (flaggedQuestions.has(qNum)) flaggedQuestions.delete(qNum);
      else flaggedQuestions.add(qNum);
      renderActiveExamQuestion();
    });
    document.getElementById("btn-exam-speak").addEventListener("click", () => {
      if (!currentExam) return;
      const q = currentExam.questions[currentQIndex];
      const text = `${q.questionText} Option A: ${q.options[0].text}. Option B: ${q.options[1].text}. Option C: ${q.options[2].text}. Option D: ${q.options[3].text}.`;
      window.GamifiedStudy.speakEnglish(text);
    });
    document.getElementById("btn-zoom-exam-visual").addEventListener("click", () => {
      if (!currentExam) return;
      const q = currentExam.questions[currentQIndex];
      if (q.visualAsset) openLightbox(q.visualAsset, q.topic, q.visualCaption);
    });

    // Study mode tabs
    document.querySelectorAll(".study-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchStudyMode(btn.dataset.studyMode));
    });

    // Lightbox close
    document.getElementById("btn-close-lightbox").addEventListener("click", () => {
      document.getElementById("lightbox-modal").style.display = "none";
    });
    document.getElementById("lightbox-modal").addEventListener("click", (e) => {
      if (e.target.id === "lightbox-modal") {
        document.getElementById("lightbox-modal").style.display = "none";
      }
    });
  }
})();
