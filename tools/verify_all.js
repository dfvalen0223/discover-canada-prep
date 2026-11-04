// Comprehensive End-to-End Automated Verification Suite for Discover Canada Prep
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = "/Users/danielvalencia/.gemini/antigravity/scratch/discover-canada-mac-app";

global.window = {
  location: { protocol: "https:", origin: "https://dfvalen0223.github.io", pathname: "/discover-canada-prep/", search: "?key=canada-2026-vip-7x9k2m", hash: "" },
  history: { replaceState() {} }
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

require(path.join(ROOT, "src/data/study_content.js"));
require(path.join(ROOT, "src/data/questions.js"));
require(path.join(ROOT, "src/svg_maps.js"));
require(path.join(ROOT, "src/engine.js"));
require(path.join(ROOT, "src/gamification.js"));
require(path.join(ROOT, "src/auth.js"));

console.log("=== 1. Verifying Question Bank Integrity & Asset References ===");
const qBank = window.QUESTION_BANK;
assert(qBank.length >= 130, `Expected >=130 concepts, got ${qBank.length}`);

const seenIds = new Set();
const chaptersCovered = new Set();

qBank.forEach((q, idx) => {
  assert(q.id && !seenIds.has(q.id), `Duplicate or missing ID at index ${idx}: ${q.id}`);
  seenIds.add(q.id);
  chaptersCovered.add(q.chapter);
  assert(Array.isArray(q.stems) && q.stems.length >= 3, `Question ${q.id} must have >=3 stems`);
  q.stems.forEach(s => assert(typeof s === "string" && s.length > 15, `Invalid stem in ${q.id}`));
  assert(typeof q.answer === "string" && q.answer.length > 0, `Invalid answer in ${q.id}`);
  assert(Array.isArray(q.distractors) && q.distractors.length >= 5, `Question ${q.id} must have >=5 distractors`);
  q.distractors.forEach(d => {
    assert(d !== q.answer, `Distractor equals answer in ${q.id}`);
  });
  if (q.visualAsset) {
    const diskPath = path.resolve(path.join(ROOT, "src"), q.visualAsset);
    assert(fs.existsSync(diskPath), `Missing visual asset on disk for ${q.id}: ${diskPath}`);
    const stat = fs.statSync(diskPath);
    assert(stat.size > 5000, `Visual asset too small for ${q.id}: ${stat.size} bytes`);
  }
});

assert.strictEqual(chaptersCovered.size, 11, "All 11 chapters must be covered in QUESTION_BANK");
console.log(`✅ Verified ${qBank.length} unique concepts, ${qBank.reduce((s, x) => s + x.stems.length, 0)} English stems, across all ${chaptersCovered.size} chapters.`);

console.log("=== 2. Verifying All 68 Rendered PDF Pages & Original PDFs ===");
for (let p = 1; p <= 68; p++) {
  const pStr = String(p).padStart(2, "0");
  const pFile = path.join(ROOT, `assets/pdf_pages/page_${pStr}.jpg`);
  assert(fs.existsSync(pFile) && fs.statSync(pFile).size > 10000, `Missing or invalid PDF page image: ${pFile}`);
}
assert(fs.existsSync(path.join(ROOT, "assets/pdfs/discover-canada-illustrated.pdf")), "Missing Illustrated PDF");
assert(fs.existsSync(path.join(ROOT, "assets/pdfs/discover-canada-large-print.pdf")), "Missing Large Print PDF");
console.log("✅ Verified all 68 Illustrated PDF page images and both original PDFs.");

console.log("=== 3. Verifying Adaptive Exam Engine, 15/20 Pass Criterion, Stem Rotation & Weakness Vault ===");
window.AdaptiveEngine.resetAllProgress();

// Exam 1: Deliberately fail with 12/20 to populate Mistake Vault (8 mistakes)
const exam1 = window.AdaptiveEngine.generateExam({ mode: "adaptive", questionCount: 20 });
assert.strictEqual(exam1.questions.length, 20);
assert.strictEqual(exam1.passMark, 15);
const exam1Chs = new Set(exam1.questions.map(q => q.chapter));
assert.strictEqual(exam1Chs.size, 11, "Every 20-question adaptive exam must cover all 11 chapters");
assert(exam1.questions.filter(q => q.isVisual).length >= 5, "Must include at least 5 visual map/chart questions");

const ans1 = {};
const missedIds = [];
exam1.questions.forEach((q, i) => {
  if (i < 12) {
    ans1[q.number] = q.options.find(o => o.isCorrect).letter;
  } else {
    ans1[q.number] = q.options.find(o => !o.isCorrect).letter;
    missedIds.push(q.questionId);
  }
});
const sub1 = window.AdaptiveEngine.submitExamResult(exam1, ans1, 900);
assert.strictEqual(sub1.record.score, 12);
assert.strictEqual(sub1.record.passed, false, "12/20 must fail (threshold is 15/20)");
assert.strictEqual(window.AdaptiveEngine.getState().mistakeVault.length, 8, "8 missed questions must enter Mistake Vault");

// Exam 2: Standard Adaptive Exam -> verify anti-memorization cooldown (minimal/zero overlap with Exam 1)
const exam2 = window.AdaptiveEngine.generateExam({ mode: "adaptive", questionCount: 20 });
const exam1Set = new Set(exam1.questions.map(q => q.questionId));
const overlap12 = exam2.questions.filter(q => exam1Set.has(q.questionId)).length;
assert(overlap12 <= 2, `Expected anti-memorization cooldown to keep overlap <= 2, got ${overlap12}`);

// Exam 3: Targeted Weakness Reinforcement Exam -> verify it pulls all 8 Mistake Vault items AND rotates their stems!
const exam3 = window.AdaptiveEngine.generateExam({ mode: "weakness", questionCount: 20 });
const exam3Ids = new Set(exam3.questions.map(q => q.questionId));
const recoveredMistakes = missedIds.filter(id => exam3Ids.has(id));
assert.strictEqual(recoveredMistakes.length, 8, "Weakness exam must target all 8 items in Mistake Vault");

// Verify stem rotation: every re-tested concept from Exam 1 must now be on Stem Variant >= 2 (not Variant 1!)
exam3.questions.forEach(q => {
  if (missedIds.includes(q.questionId)) {
    assert(q.stemVariantIndex >= 2, `Expected rotated stem variant >=2 for ${q.questionId}, got ${q.stemVariantIndex}`);
  }
});

// Answer all 20 correctly in Exam 3 (1st consecutive correct for the 8 mistakes) and again in another weakness exam (2nd consecutive correct)
const ans3 = {};
exam3.questions.forEach(q => { ans3[q.number] = q.options.find(o => o.isCorrect).letter; });
const sub3 = window.AdaptiveEngine.submitExamResult(exam3, ans3, 720);
assert.strictEqual(sub3.record.score, 20);
assert.strictEqual(sub3.record.passed, true);

// Clear mistakes on 2nd consecutive correct
missedIds.forEach(id => window.AdaptiveEngine.recordQuestionAttempt(id, true, 5000));
assert.strictEqual(window.AdaptiveEngine.getState().mistakeVault.length, 0, "Mistake Vault must clear after 2 consecutive correct answers");

// Verify JSON Portability Export & Import
const exportedJson = window.AdaptiveEngine.exportPortableJSON();
window.AdaptiveEngine.resetAllProgress();
assert.strictEqual(window.AdaptiveEngine.getState().examHistory.length, 0);
window.AdaptiveEngine.importPortableJSON(exportedJson);
assert.strictEqual(window.AdaptiveEngine.getState().examHistory.length, 2, "Imported state must restore exam history");

console.log("=== 4. Verifying 'Longest Answer = Correct Answer' Trick Mode (100% Accuracy when picking longest text) ===");
const trickExam = window.AdaptiveEngine.generateExam({ mode: "adaptive", questionCount: 20, optionLengthMode: "longest_correct" });
const trickAnswers = {};
trickExam.questions.forEach(q => {
  // User's trick: always pick the option with the most text!
  const longestOpt = q.options.slice().sort((a, b) => b.text.length - a.text.length)[0];
  assert.strictEqual(longestOpt.isCorrect, true, `Longest option must be correct in Trick Mode for ${q.questionId}`);
  trickAnswers[q.number] = longestOpt.letter;
});
const trickResult = window.AdaptiveEngine.submitExamResult(trickExam, trickAnswers, 600);
assert.strictEqual(trickResult.record.score, 20, "Picking the longest option in Trick Mode must score 20/20 (100%)");
console.log("✅ Verified 'Longest Option = Correct' Trick Mode scores 20/20 (100%) on every exam!");

console.log("=== 5. Verifying Username & Password Login (daniel1130 & mildrentoro) ===");
const s1 = window.AuthGate.signInWithPassword("daniel1130", "felipe1130");
assert.strictEqual(s1.username, "daniel1130");
const s2 = window.AuthGate.signInWithPassword("mildrentoro", "viviana6703");
assert.strictEqual(s2.username, "mildrentoro");
console.log("✅ Verified daniel1130 & mildrentoro Username/Password Login!");

console.log("✅ All Adaptive Engine, Stem Rotation, Trick Mode, AuthGate & Mac Portability tests PASSED!");
