// Intelligent Adaptive Exam Engine, SM-2 Spaced Repetition, Leitner Mastery & Analytics
// Designed for Discover Canada Portable Mac App

window.AdaptiveEngine = (function () {
  const BASE_STORAGE_KEY = "discover_canada_adaptive_state_v1";
  let activeStorageKey = BASE_STORAGE_KEY;

  function setActiveUserScope(userKey) {
    if (!userKey) {
      activeStorageKey = BASE_STORAGE_KEY;
    } else {
      const sanitized = String(userKey).toLowerCase().replace(/[^a-z0-9_@.-]/g, "_");
      activeStorageKey = `${BASE_STORAGE_KEY}_${sanitized}`;
    }
    state = loadState();
    return state;
  }

  function createDefaultState() {
    return {
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      profile: {
        name: "Future Canadian Citizen",
        xp: 0,
        streakDays: 1,
        lastActiveDate: new Date().toISOString().slice(0, 10),
        bestCombo: 0,
        currentCombo: 0,
        flashcardsReviewed: 0,
        mapChallengesCompleted: 0,
        blitzHighScore: 0,
        unlockedAchievements: []
      },
      // Per-question mastery state keyed by question.id
      itemMastery: {},
      // Per-chapter aggregate stats keyed by chapter.id (ch1..ch11)
      chapterStats: {},
      // Array of completed exam records (most recent first)
      examHistory: [],
      // IDs of questions included in the most recent exam (for anti-repeat cooldown)
      lastExamQuestionIds: [],
      // Set/list of question IDs currently in the Mistake Vault (answered wrong & not yet cleared by 2 consecutive correct answers)
      mistakeVault: []
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(activeStorageKey) || localStorage.getItem(BASE_STORAGE_KEY);
      if (!raw) return initChapterStats(createDefaultState());
      const parsed = JSON.parse(raw);
      return initChapterStats( Object.assign(createDefaultState(), parsed) );
    } catch (e) {
      console.warn("Failed to load saved state, initializing default:", e);
      return initChapterStats(createDefaultState());
    }
  }

  function initChapterStats(st) {
    if (!st.chapterStats) st.chapterStats = {};
    (window.STUDY_CHAPTERS || []).forEach(ch => {
      if (!st.chapterStats[ch.id]) {
        st.chapterStats[ch.id] = {
          attempts: 0,
          correct: 0,
          totalTimeMs: 0,
          lastTestedAt: null
        };
      }
    });
    // Update daily streak if active on a new day
    const today = new Date().toISOString().slice(0, 10);
    if (st.profile && st.profile.lastActiveDate !== today) {
      const last = new Date(st.profile.lastActiveDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        st.profile.streakDays = (st.profile.streakDays || 1) + 1;
      } else if (diffDays > 1) {
        st.profile.streakDays = 1;
      }
      st.profile.lastActiveDate = today;
    }
    return st;
  }

  function saveState() {
    state.lastUpdatedAt = new Date().toISOString();
    try {
      localStorage.setItem(activeStorageKey, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  }

  function getState() {
    return state;
  }

  function resetAllProgress() {
    state = initChapterStats(createDefaultState());
    saveState();
    return state;
  }

  function exportPortableJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importPortableJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object" || !parsed.profile) {
      throw new Error("Invalid Discover Canada progress file format.");
    }
    state = initChapterStats(Object.assign(createDefaultState(), parsed));
    saveState();
    return state;
  }

  function getItemRecord(questionId) {
    if (!state.itemMastery[questionId]) {
      state.itemMastery[questionId] = {
        seen: 0,
        correct: 0,
        wrong: 0,
        consecutiveCorrect: 0,
        leitnerBox: 0, // 0 = Unseen, 1 = Weak/Missed, 2 = Learning, 3 = Reviewing, 4 = Mastered
        easinessFactor: 2.5,
        intervalDays: 0,
        nextReviewDue: 0,
        lastStemIndex: -1,
        avgResponseMs: 0,
        lastSeenAt: 0
      };
    }
    return state.itemMastery[questionId];
  }

  // Fisher-Yates shuffle
  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Computes the adaptive selection priority weight for a question concept
   */
  function computeAdaptiveWeight(q, mode = "adaptive") {
    const rec = getItemRecord(q.id);
    const chStat = state.chapterStats[q.chapter] || { attempts: 0, correct: 0 };
    const chAcc = chStat.attempts > 0 ? chStat.correct / chStat.attempts : 0.65;
    const now = Date.now();

    let weight = 10.0;
    const reasons = [];

    // 1. Leitner Box & Mistake Vault targeting
    if (state.mistakeVault.includes(q.id) || rec.leitnerBox === 1) {
      weight *= 3.8;
      reasons.push("Weakness Reinforcement (Missed Previously)");
    } else if (rec.seen === 0) {
      weight *= (mode === "weakness" ? 1.6 : 2.6);
      reasons.push("New Syllabus Concept Discovery");
    } else if (rec.leitnerBox === 2) {
      weight *= 1.9;
      reasons.push("Consolidating Concept (Leitner Box 2)");
    } else if (rec.leitnerBox === 3) {
      weight *= 1.1;
    } else if (rec.leitnerBox >= 4) {
      weight *= 0.42; // Mastered items appear much less frequently
    }

    // 2. SM-2 Spaced Repetition Due Check
    if (rec.seen > 0 && rec.nextReviewDue > 0 && now >= rec.nextReviewDue) {
      weight *= 1.85;
      if (!reasons.length) reasons.push("Spaced Repetition Review Due (SM-2)");
    }

    // 3. Chapter Weakness Prioritization (< 75% passing threshold)
    if (chStat.attempts >= 2 && chAcc < 0.75) {
      const deficitBoost = 1.5 + (0.75 - chAcc) * 2.2;
      weight *= deficitBoost;
      reasons.push("Weak Chapter Target (<75% Accuracy)");
    } else if (chStat.attempts === 0) {
      weight *= 1.45;
      reasons.push("Untested Chapter Coverage");
    }

    // 4. Slow Response Latency Boost (hesitation > 20 seconds on previous attempt)
    if (rec.avgResponseMs > 20000 && rec.seen > 0) {
      weight *= 1.35;
      reasons.push("High Response Time Hesitation");
    }

    // 5. Anti-Memorization Cooldown: strongly penalize items asked in the immediately preceding exam
    if (state.lastExamQuestionIds.includes(q.id) && mode !== "mistake_vault") {
      weight *= 0.12;
    }

    // Add slight stochastic jitter (+/- 15%) so every generated exam feels organic
    weight *= (0.85 + Math.random() * 0.30);

    return {
      weight,
      primaryReason: reasons[0] || "Balanced Official Syllabus Sampling"
    };
  }

  /**
   * Weighted random pick from a pool of candidates
   */
  function pickWeightedCandidate(candidates, excludedIds, mode) {
    const eligible = candidates.filter(q => !excludedIds.has(q.id));
    if (eligible.length === 0) return null;

    const scored = eligible.map(q => {
      const { weight, primaryReason } = computeAdaptiveWeight(q, mode);
      return { q, weight, primaryReason };
    });

    const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of scored) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return scored[scored.length - 1];
  }

  /**
   * Materializes a concrete multiple-choice question instance from a concept item:
   * - Rotates the question stem (`stems`) so repeated concepts use a different wording
   * - Samples 3 random distractors from the 5-6 distractor pool
   * - Supports `optionLengthMode`:
   *   * "longest_correct" (Default): Uses `conceptItem.answerExtended` so the correct answer ALWAYS has the most text (100% trick-enabled!)
   *   * "balanced_ircc": Uses concise `conceptItem.answer` matching distractor lengths
   * - Shuffles the 4 options (A, B, C, D) so option position cannot be memorized
   */
  function materializeQuestionInstance(conceptItem, primaryReason, indexNumber, optionLengthMode = "longest_correct") {
    const rec = getItemRecord(conceptItem.id);
    const stemCount = conceptItem.stems.length;

    // Rotate stem index to avoid repeating the same question phrasing
    const nextStemIndex = (rec.lastStemIndex + 1) % stemCount;
    rec.lastStemIndex = nextStemIndex;

    const questionText = conceptItem.stems[nextStemIndex];
    const sampledDistractors = shuffle(conceptItem.distractors).slice(0, 3);
    const chosenCorrectText = (optionLengthMode === "longest_correct" && conceptItem.answerExtended)
      ? conceptItem.answerExtended
      : conceptItem.answer;

    const rawOptions = shuffle([
      { text: chosenCorrectText, isCorrect: true },
      ...sampledDistractors.map(d => ({ text: d, isCorrect: false }))
    ]);

    const letters = ["A", "B", "C", "D"];
    const options = rawOptions.map((opt, idx) => ({
      letter: letters[idx],
      text: opt.text,
      isCorrect: opt.isCorrect
    }));

    const chapterObj = (window.STUDY_CHAPTERS || []).find(c => c.id === conceptItem.chapter);

    return {
      instanceId: `${conceptItem.id}_${Date.now()}_${indexNumber}`,
      questionId: conceptItem.id,
      number: indexNumber,
      chapter: conceptItem.chapter,
      chapterTitle: chapterObj ? chapterObj.shortTitle : conceptItem.chapter,
      chapterIcon: chapterObj ? chapterObj.icon : "🍁",
      topic: conceptItem.topic,
      difficulty: conceptItem.difficulty,
      isVisual: !!conceptItem.isVisual,
      visualAsset: conceptItem.visualAsset || null,
      visualCaption: conceptItem.visualCaption || null,
      svgCallout: conceptItem.svgCallout || null,
      stemVariantIndex: nextStemIndex + 1,
      stemTotalVariants: stemCount,
      questionText,
      options,
      correctAnswer: chosenCorrectText,
      optionLengthMode,
      explanation: conceptItem.explanation,
      refIllustrated: conceptItem.refIllustrated,
      refLargePrint: conceptItem.refLargePrint,
      adaptiveReason: primaryReason,
      leitnerBoxBefore: rec.leitnerBox
    };
  }

  /**
   * Generates a 20-question exam with:
   * - Stratified coverage across ALL 11 chapters of Discover Canada
   * - Guaranteed visual/map/chart/diagram questions (at least 5 per 20-question exam)
   * - Intelligent adaptive targeting of weak areas, due SM-2 items, and unseen concepts
   * - Dynamic stem rotation and option shuffling
   * - Configurable `optionLengthMode` ("longest_correct" for Longest-Text Trick vs "balanced_ircc")
   */
  function generateExam(options = {}) {
    const {
      mode = "adaptive", // "adaptive" | "weakness" | "visual_focus" | "chapter"
      chapterFilter = null,
      questionCount = 20,
      optionLengthMode = "longest_correct", // "longest_correct" | "balanced_ircc"
      durationMinutes = 30 // 30 minutes Official IRCC Online Test default
    } = options;

    const allQuestions = window.QUESTION_BANK || [];
    const selectedIds = new Set();
    const chosenItems = [];

    if (mode === "chapter" && chapterFilter) {
      const chPool = allQuestions.filter(q => q.chapter === chapterFilter);
      const count = Math.min(questionCount, chPool.length);
      for (let i = 0; i < count; i++) {
        const picked = pickWeightedCandidate(chPool, selectedIds, mode);
        if (picked) {
          selectedIds.add(picked.q.id);
          chosenItems.push(picked);
        }
      }
    } else if (mode === "weakness") {
      // Prioritize Mistake Vault items and weak chapters first, while still including visual questions
      const vaultPool = allQuestions.filter(q => state.mistakeVault.includes(q.id) || getItemRecord(q.id).leitnerBox === 1);
      while (chosenItems.length < Math.min(10, vaultPool.length)) {
        const picked = pickWeightedCandidate(vaultPool, selectedIds, "mistake_vault");
        if (!picked) break;
        selectedIds.add(picked.q.id);
        chosenItems.push({
          q: picked.q,
          primaryReason: "Targeted Mistake Vault / Weak Concept"
        });
      }
      // Ensure at least 5 visual/map/chart items
      const visualPool = allQuestions.filter(q => q.isVisual);
      while (chosenItems.filter(x => x.q.isVisual).length < 5 && chosenItems.length < questionCount) {
        const picked = pickWeightedCandidate(visualPool, selectedIds, mode);
        if (!picked) break;
        selectedIds.add(picked.q.id);
        chosenItems.push({
          q: picked.q,
          primaryReason: "Visual Map / Chart Reinforcement"
        });
      }
      // Fill remaining up to 20 using adaptive weights across all chapters
      while (chosenItems.length < questionCount) {
        const picked = pickWeightedCandidate(allQuestions, selectedIds, mode);
        if (!picked) break;
        selectedIds.add(picked.q.id);
        chosenItems.push(picked);
      }
    } else {
      // Standard Official Adaptive 20-Question Exam:
      // Step 1: Guarantee 1 question from EACH of the 11 chapters of Discover Canada (11 questions)
      const chapters = (window.STUDY_CHAPTERS || []).map(c => c.id);
      shuffle(chapters).forEach(chId => {
        if (chosenItems.length >= questionCount) return;
        const chPool = allQuestions.filter(q => q.chapter === chId);
        const picked = pickWeightedCandidate(chPool, selectedIds, mode);
        if (picked) {
          selectedIds.add(picked.q.id);
          chosenItems.push(picked);
        }
      });

      // Step 2: Guarantee at least 5 Visual / Map / Chart / Graphic questions from the PDFs
      const targetVisualCount = mode === "visual_focus" ? 12 : 5;
      const visualPool = allQuestions.filter(q => q.isVisual);
      while (chosenItems.filter(x => x.q.isVisual).length < targetVisualCount && chosenItems.length < questionCount) {
        const picked = pickWeightedCandidate(visualPool, selectedIds, mode);
        if (!picked) break;
        selectedIds.add(picked.q.id);
        chosenItems.push({
          q: picked.q,
          primaryReason: picked.primaryReason.includes("Weak")
            ? picked.primaryReason
            : "Official Map / Chart / Graphic Assessment"
        });
      }

      // Step 3: Fill the remaining slots up to 20 using the full Adaptive Weighting Engine
      // (prioritizing weak chapters, Mistake Vault items, SM-2 due items, and core high-yield chapters ch4, ch6, ch11)
      while (chosenItems.length < questionCount) {
        const picked = pickWeightedCandidate(allQuestions, selectedIds, mode);
        if (!picked) break;
        selectedIds.add(picked.q.id);
        chosenItems.push(picked);
      }
    }

    // Shuffle the order of the 20 chosen questions so chapter order isn't predictable
    const finalOrder = shuffle(chosenItems);
    const questions = finalOrder.map((item, idx) =>
      materializeQuestionInstance(item.q, item.primaryReason, idx + 1, optionLengthMode)
    );

    saveState();
    return {
      examId: "exam_" + Date.now(),
      mode,
      optionLengthMode,
      createdAt: new Date().toISOString(),
      totalQuestions: questions.length,
      passMark: Math.ceil(questions.length * 0.75), // 15 out of 20
      durationSeconds: (durationMinutes || 30) * 60, // 30 minutes official IRCC Online Test limit
      questions
    };
  }

  /**
   * Updates SM-2 Spaced Repetition & Leitner Box for a single question response
   */
  function recordQuestionAttempt(questionId, isCorrect, responseTimeMs = 8000) {
    const qObj = (window.QUESTION_BANK || []).find(x => x.id === questionId);
    if (!qObj) return null;

    const rec = getItemRecord(questionId);
    rec.seen += 1;
    rec.lastSeenAt = Date.now();
    rec.avgResponseMs = rec.seen === 1
      ? responseTimeMs
      : Math.round(rec.avgResponseMs * 0.65 + responseTimeMs * 0.35);

    // Update Chapter Stats
    const chStat = state.chapterStats[qObj.chapter];
    if (chStat) {
      chStat.attempts += 1;
      if (isCorrect) chStat.correct += 1;
      chStat.totalTimeMs += responseTimeMs;
      chStat.lastTestedAt = new Date().toISOString();
    }

    // SM-2 quality rating (0..5)
    let quality = 1;
    if (isCorrect) {
      rec.correct += 1;
      rec.consecutiveCorrect += 1;
      quality = responseTimeMs < 10000 ? 5 : responseTimeMs < 22000 ? 4 : 3;

      // Advance Leitner Box (1 -> 2 -> 3 -> 4)
      if (rec.leitnerBox === 0) {
        rec.leitnerBox = quality >= 4 ? 3 : 2;
      } else {
        rec.leitnerBox = Math.min(4, rec.leitnerBox + 1);
      }

      // Remove from Mistake Vault once answered correctly at least twice in a row (or moved to Box >= 3)
      if (rec.consecutiveCorrect >= 2 || rec.leitnerBox >= 3) {
        state.mistakeVault = state.mistakeVault.filter(id => id !== questionId);
      }

      // Combo tracking
      state.profile.currentCombo = (state.profile.currentCombo || 0) + 1;
      if (state.profile.currentCombo > (state.profile.bestCombo || 0)) {
        state.profile.bestCombo = state.profile.currentCombo;
      }
    } else {
      rec.wrong += 1;
      rec.consecutiveCorrect = 0;
      rec.leitnerBox = 1; // Drop to Box 1 (Immediate Weakness Reinforcement)
      quality = 1;

      if (!state.mistakeVault.includes(questionId)) {
        state.mistakeVault.push(questionId);
      }
      state.profile.currentCombo = 0;
    }

    // SM-2 Easiness Factor & Interval calculation
    const ef = rec.easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    rec.easinessFactor = Math.max(1.3, Math.min(2.8, ef));

    if (!isCorrect) {
      rec.intervalDays = 0.25; // Review again within 6 hours / next session
    } else if (rec.consecutiveCorrect === 1) {
      rec.intervalDays = 1;
    } else if (rec.consecutiveCorrect === 2) {
      rec.intervalDays = 3;
    } else {
      rec.intervalDays = Math.round(rec.intervalDays * rec.easinessFactor);
    }
    rec.nextReviewDue = Date.now() + rec.intervalDays * 24 * 60 * 60 * 1000;

    saveState();
    return rec;
  }

  /**
   * Finalizes and grades a 20-question exam, records analytics, awards XP, and checks achievements
   */
  function submitExamResult(exam, userAnswers, elapsedSeconds) {
    let correctCount = 0;
    let visualCorrect = 0;
    let visualTotal = 0;
    const chapterBreakdown = {};
    const detailedResults = [];

    exam.questions.forEach(qInst => {
      const selectedLetter = userAnswers[qInst.number] || null;
      const chosenOpt = qInst.options.find(o => o.letter === selectedLetter);
      const isCorrect = !!(chosenOpt && chosenOpt.isCorrect);
      const perQuestionMs = Math.round((elapsedSeconds * 1000) / exam.questions.length);

      recordQuestionAttempt(qInst.questionId, isCorrect, perQuestionMs);

      if (isCorrect) correctCount += 1;
      if (qInst.isVisual) {
        visualTotal += 1;
        if (isCorrect) visualCorrect += 1;
      }

      if (!chapterBreakdown[qInst.chapter]) {
        chapterBreakdown[qInst.chapter] = {
          chapter: qInst.chapter,
          title: qInst.chapterTitle,
          icon: qInst.chapterIcon,
          total: 0,
          correct: 0
        };
      }
      chapterBreakdown[qInst.chapter].total += 1;
      if (isCorrect) chapterBreakdown[qInst.chapter].correct += 1;

      detailedResults.push({
        number: qInst.number,
        questionId: qInst.questionId,
        chapter: qInst.chapter,
        chapterTitle: qInst.chapterTitle,
        topic: qInst.topic,
        isVisual: qInst.isVisual,
        visualAsset: qInst.visualAsset,
        visualCaption: qInst.visualCaption,
        svgCallout: qInst.svgCallout,
        questionText: qInst.questionText,
        selectedLetter,
        selectedText: chosenOpt ? chosenOpt.text : "No Answer Selected",
        correctAnswer: qInst.correctAnswer,
        isCorrect,
        explanation: qInst.explanation,
        refIllustrated: qInst.refIllustrated,
        refLargePrint: qInst.refLargePrint,
        adaptiveReason: qInst.adaptiveReason
      });
    });

    const passed = correctCount >= exam.passMark;
    const percentage = Math.round((correctCount / exam.totalQuestions) * 100);

    // Calculate XP earned
    let xpEarned = correctCount * 15;
    if (passed) xpEarned += 120;
    if (correctCount === exam.totalQuestions) xpEarned += 200;
    if (exam.mode === "weakness") xpEarned += 60;
    addXP(xpEarned);

    const record = {
      examId: exam.examId,
      mode: exam.mode,
      completedAt: new Date().toISOString(),
      score: correctCount,
      total: exam.totalQuestions,
      passMark: exam.passMark,
      passed,
      percentage,
      visualCorrect,
      visualTotal,
      elapsedSeconds,
      xpEarned,
      chapterBreakdown: Object.values(chapterBreakdown),
      detailedResults
    };

    state.lastExamQuestionIds = exam.questions.map(q => q.questionId);
    state.examHistory.unshift(record);
    if (state.examHistory.length > 50) {
      state.examHistory = state.examHistory.slice(0, 50);
    }

    const newlyUnlocked = checkAchievements(record);
    saveState();

    return {
      record,
      newlyUnlocked
    };
  }

  function addXP(amount) {
    state.profile.xp = (state.profile.xp || 0) + amount;
    saveState();
    return state.profile.xp;
  }

  function getCurrentRank() {
    const xp = state.profile.xp || 0;
    const ranks = window.CITIZENSHIP_RANKS || [];
    let current = ranks[0];
    let next = null;
    for (let i = 0; i < ranks.length; i++) {
      if (xp >= ranks[i].minXP) {
        current = ranks[i];
        next = ranks[i + 1] || null;
      }
    }
    const progressPct = next
      ? Math.min(100, Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100))
      : 100;
    return { current, next, xp, progressPct };
  }

  function checkAchievements(latestExamRecord = null) {
    const catalog = window.ACHIEVEMENTS_CATALOG || [];
    const unlocked = state.profile.unlockedAchievements || [];
    const newlyUnlocked = [];

    function unlock(id) {
      if (!unlocked.includes(id)) {
        unlocked.push(id);
        const item = catalog.find(a => a.id === id);
        if (item) {
          state.profile.xp += item.xpReward;
          newlyUnlocked.push(item);
        }
      }
    }

    if (state.examHistory.length >= 1) unlock("first_exam");
    if (state.examHistory.some(e => e.passed && e.total >= 20)) unlock("pass_exam");
    if (state.examHistory.some(e => e.score === 20 && e.total === 20)) unlock("perfect_20");
    if (state.examHistory.filter(e => e.passed && e.total >= 20).length >= 3) unlock("exam_veteran");
    if (latestExamRecord && latestExamRecord.mode === "weakness") unlock("weakness_crusher");

    // Visual master check
    const visualCorrectCount = Object.entries(state.itemMastery).reduce((sum, [qId, rec]) => {
      const q = (window.QUESTION_BANK || []).find(x => x.id === qId);
      return sum + (q && q.isVisual ? rec.correct : 0);
    }, 0);
    if (visualCorrectCount >= 15) unlock("visual_master");

    // All 11 chapters attempted
    const chaptersTested = Object.values(state.chapterStats).filter(c => c.attempts > 0).length;
    if (chaptersTested >= 11) unlock("all_chapters");

    // Combos & study activities
    if ((state.profile.bestCombo || 0) >= 5) unlock("streak_5");
    if ((state.profile.bestCombo || 0) >= 10) unlock("streak_10");
    if ((state.profile.flashcardsReviewed || 0) >= 25) unlock("flashcard_25");
    if ((state.profile.mapChallengesCompleted || 0) >= 1) unlock("map_challenge");
    if ((state.profile.blitzHighScore || 0) >= 10) unlock("blitz_champion");

    state.profile.unlockedAchievements = unlocked;
    return newlyUnlocked;
  }

  /**
   * Computes comprehensive Analytics, Official Readiness Score, Chapter Mastery & Weak Area Diagnostics
   */
  function getAnalyticsReport() {
    const allQuestions = window.QUESTION_BANK || [];
    const chapters = window.STUDY_CHAPTERS || [];

    const totalConcepts = allQuestions.length;
    const seenConcepts = Object.values(state.itemMastery).filter(r => r.seen > 0).length;
    const masteredConcepts = Object.values(state.itemMastery).filter(r => r.leitnerBox >= 3).length;
    const syllabusCoveragePct = Math.round((seenConcepts / totalConcepts) * 100);

    // Chapter-by-chapter analysis
    const chapterReports = chapters.map(ch => {
      const st = state.chapterStats[ch.id] || { attempts: 0, correct: 0, totalTimeMs: 0 };
      const chQuestions = allQuestions.filter(q => q.chapter === ch.id);
      const seenInCh = chQuestions.filter(q => (state.itemMastery[q.id] && state.itemMastery[q.id].seen > 0)).length;
      const accuracy = st.attempts > 0 ? Math.round((st.correct / st.attempts) * 100) : null;

      let status = "untested"; // "mastered" (>=80%), "passing" (75-79%), "weak" (<75%), "untested"
      if (st.attempts > 0) {
        if (accuracy >= 80) status = "mastered";
        else if (accuracy >= 75) status = "passing";
        else status = "weak";
      }

      return {
        id: ch.id,
        number: ch.number,
        title: ch.title,
        shortTitle: ch.shortTitle,
        icon: ch.icon,
        color: ch.color,
        pagesIllustrated: ch.pagesIllustrated,
        pagesLargePrint: ch.pagesLargePrint,
        attempts: st.attempts,
        correct: st.correct,
        accuracy,
        seenCount: seenInCh,
        totalCount: chQuestions.length,
        coveragePct: Math.round((seenInCh / chQuestions.length) * 100),
        status
      };
    });

    // Identify Weak Areas (chapters < 75% accuracy or untested, plus specific weak topics)
    const weakChapters = chapterReports
      .filter(c => c.status === "weak")
      .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));

    const untestedChapters = chapterReports.filter(c => c.status === "untested");

    // Mistake Vault detailed items
    const mistakeItems = state.mistakeVault
      .map(id => {
        const q = allQuestions.find(x => x.id === id);
        if (!q) return null;
        const rec = getItemRecord(id);
        const ch = chapters.find(c => c.id === q.chapter);
        return {
          id: q.id,
          chapter: q.chapter,
          chapterTitle: ch ? ch.shortTitle : q.chapter,
          topic: q.topic,
          questionText: q.stems[0],
          answer: q.answer,
          explanation: q.explanation,
          refIllustrated: q.refIllustrated,
          refLargePrint: q.refLargePrint,
          wrongCount: rec.wrong,
          seenCount: rec.seen
        };
      })
      .filter(Boolean);

    // Visual vs Text Accuracy
    let visAttempts = 0, visCorrect = 0, txtAttempts = 0, txtCorrect = 0;
    allQuestions.forEach(q => {
      const rec = state.itemMastery[q.id];
      if (rec && rec.seen > 0) {
        if (q.isVisual) {
          visAttempts += rec.seen;
          visCorrect += rec.correct;
        } else {
          txtAttempts += rec.seen;
          txtCorrect += rec.correct;
        }
      }
    });

    const visualAccuracy = visAttempts > 0 ? Math.round((visCorrect / visAttempts) * 100) : null;
    const textAccuracy = txtAttempts > 0 ? Math.round((txtCorrect / txtAttempts) * 100) : null;

    // Overall Exam Readiness Score (0..100%)
    const recentExams = state.examHistory.slice(0, 5);
    const avgRecentExamPct = recentExams.length > 0
      ? recentExams.reduce((s, e) => s + e.percentage, 0) / recentExams.length
      : 0;

    let readinessScore = 0;
    if (state.examHistory.length === 0 && seenConcepts === 0) {
      readinessScore = 0;
    } else {
      const examComponent = avgRecentExamPct * 0.55;
      const coverageComponent = syllabusCoveragePct * 0.25;
      const masteryComponent = Math.round((masteredConcepts / totalConcepts) * 100) * 0.20;
      readinessScore = Math.min(100, Math.round(examComponent + coverageComponent + masteryComponent));
    }

    let readinessVerdict = "Begin Your First Practice Exam";
    let readinessColor = "#64748b";
    if (readinessScore >= 82 && recentExams.filter(e => e.passed).length >= 2) {
      readinessVerdict = "Oath-Ready! High Pass Probability (>92%)";
      readinessColor = "#059669";
    } else if (readinessScore >= 68 || (recentExams[0] && recentExams[0].passed)) {
      readinessVerdict = "On Track to Pass (15+/20) — Reinforce Weak Chapters";
      readinessColor = "#0284c7";
    } else if (readinessScore > 0) {
      readinessVerdict = "Building Foundation — Focus on Highlighted Weak Areas";
      readinessColor = "#d97706";
    }

    return {
      readinessScore,
      readinessVerdict,
      readinessColor,
      totalExamsTaken: state.examHistory.length,
      examsPassed: state.examHistory.filter(e => e.passed).length,
      avgExamScoreOutOf20: recentExams.length > 0
        ? (recentExams.reduce((s, e) => s + (e.score / e.total) * 20, 0) / recentExams.length).toFixed(1)
        : "—",
      totalConcepts,
      seenConcepts,
      masteredConcepts,
      syllabusCoveragePct,
      visualAccuracy,
      textAccuracy,
      chapterReports,
      weakChapters,
      untestedChapters,
      mistakeItems,
      examHistory: state.examHistory
    };
  }

  return {
    setActiveUserScope,
    getState,
    saveState,
    resetAllProgress,
    exportPortableJSON,
    importPortableJSON,
    getItemRecord,
    generateExam,
    recordQuestionAttempt,
    submitExamResult,
    addXP,
    getCurrentRank,
    checkAchievements,
    getAnalyticsReport,
    shuffle
  };
})();
