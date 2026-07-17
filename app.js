// app.js
//Version 9.8.1
//SOC: Restored Timed isotonic auto-sequencing


// ── Schema version guard ─────────────────────────────────────────
// Bump SCHEMA_VERSION whenever the data model changes in a breaking way.
const SCHEMA_VERSION = '5';  // Phase 4: Work/Power calculation stored in log, two-chart progress tab
const storedVersion  = localStorage.getItem('schemaVersion');
if (storedVersion !== SCHEMA_VERSION) {
    localStorage.removeItem('workoutPlan');
    localStorage.removeItem('currentWorkoutIndex');
    localStorage.removeItem('progressLogs');
    localStorage.setItem('schemaVersion', SCHEMA_VERSION);
}

// ── Data ────────────────────────────────────────────────────────
let workoutPlan         = JSON.parse(localStorage.getItem('workoutPlan'))      || [];
let currentWorkoutIndex = parseInt(localStorage.getItem('currentWorkoutIndex')) || 0;
let progressLogs        = JSON.parse(localStorage.getItem('progressLogs'))      || [];
if (currentWorkoutIndex >= workoutPlan.length) currentWorkoutIndex = 0;

// User Settings
let userSettings = JSON.parse(localStorage.getItem('userSettings'))
    || {
        weight:     '',
        height:     '',
        weightUnit: 'lb',
        heightUnit: 'in'
    };
if (!userSettings.heightUnit) userSettings.heightUnit = 'in';

// ── Body-weight helpers ──────────────────────────────────────────
function getUserWeightInWorkingUnit() {
    const w = parseFloat(userSettings.weight);
    if (!w) return null;
    return w;
}

function getBodyWeightForce(ex) {
    const bw = getUserWeightInWorkingUnit();
    if (bw === null || ex.bodyWeightPct === undefined) return null;
    return bw * ex.bodyWeightPct;
}

function formatBodyWeightForce(ex) {
    const force = getBodyWeightForce(ex);
    if (force === null) return '<span style="color:#ff9f0a">⚠ Enter weight in Settings</span>';
    return `${force.toFixed(1)} ${userSettings.weightUnit}`;
}

function getUserHeightInches() {
    const h = parseFloat(userSettings.height);
    if (!h) return null;
    if (userSettings.heightUnit === 'cm') return h / 2.54;
    return h;
}

// ── Work / Power / Tension Load calculation helpers ───────────────
//
// Unit system:
//   Metric  (kg + cm):  force in Newtons (kg × 9.81), distance in metres  → Work in Joules
//   Imperial (lb + in): force in lbf,                 distance in feet     → Work in ft-lbf
//
// isometric: no mechanical work; returns Tension Load = force × duration (lbf·s or N·s)
//
// All functions that compute "work" return { workJ, powerW, tensionLoad, isIsometric }
// where exactly one of (workJ | tensionLoad) is non-null and powerW is null for isometric.

function isMetric() {
    return userSettings.weightUnit === 'kg';
}

// Returns force in N (metric) or lbf (imperial) from user body-weight + added weight.
function calcForce(ex, addedWeight) {
    const bw = getUserWeightInWorkingUnit() || 0;
    const rawForce = bw * (ex.bodyWeightPct || 0) + (addedWeight || 0);
    if (isMetric()) return rawForce * 9.81;   // kg → N
    return rawForce;                           // lb stays lbf
}

// Returns distance per rep in metres (metric) or feet (imperial).
function calcDistPerRep(ex) {
    const h = parseFloat(userSettings.height);
    if (!h || ex.heightPct === null || ex.heightPct === undefined) return null;
    if (isMetric()) {
        // height in cm → metres
        const heightM = (userSettings.heightUnit === 'cm') ? h / 100 : h * 0.0254;
        return heightM * (ex.heightPct || 0);
    } else {
        // height in inches → feet
        const heightIn = (userSettings.heightUnit === 'cm') ? h / 2.54 : h;
        return heightIn * (ex.heightPct || 0) / 12;
    }
}

// Returns distance in metres (metric) or feet (imperial) for distance exercises.
function calcDistMeters(ex, distInput) {
    const d = distInput || ex.distanceM || ex.target || 0;
    if (isMetric()) return d;              // stored in metres
    return d * 3.28084;                   // metres → feet for imperial display
}

// Main per-set calculation.
// Returns { workJ: number|null, powerW: number|null, tensionLoad: number|null }
// workJ / powerW are in J (metric) or ft-lbf (imperial).
// tensionLoad is in N·s (metric) or lbf·s (imperial).
function calcSetMetrics(ex, addedWeight, repsOrDist, setTimeSec) {
    const force = calcForce(ex, addedWeight);

    if (ex.type === 'isometric') {
        const dur = setTimeSec || ex.target || 0;
        return { workJ: null, powerW: null, tensionLoad: force * dur };
    }

    let dist = 0;
    if (ex.unit === 'meters') {
        dist = calcDistMeters(ex, repsOrDist);
    } else {
        // rep-based or timed-isotonic (repsOrDist = number of reps)
        const distPerRep = calcDistPerRep(ex);
        if (distPerRep === null) return { workJ: null, powerW: null, tensionLoad: null };
        dist = (repsOrDist || 0) * distPerRep;
    }

    const workJ = force * dist;
    const powerW = (setTimeSec && setTimeSec > 0) ? workJ / setTimeSec : null;
    return { workJ, powerW, tensionLoad: null };
}

// Convenience: calculate work from a completed exercise object (all sets summed).
// Returns { totalWork, totalPower, totalTensionLoad, isIsometric }
function calcExerciseTotals(ex) {
    let totalWork = 0, totalPower = 0, totalTension = 0;
    let powerCount = 0;
    const isIso = ex.type === 'isometric';

    for (let i = 0; i < (ex.sets || 0); i++) {
        const addedW    = (ex.weights     || [])[i] || 0;
        const setTimeSec = (ex.setTimes   || [])[i] || 0;
        let repsOrDist  = 0;
        if (!isIso) {
            if (ex.unit === 'reps')   repsOrDist = ex.target || 0;
            else if (ex.unit === 'meters') repsOrDist = ex.distanceM || ex.target || 0;
            else repsOrDist = (ex.userInputs || [])[i] || 0;
        }
        const m = calcSetMetrics(ex, addedW, repsOrDist, setTimeSec);
        if (isIso) {
            totalTension += m.tensionLoad || 0;
        } else {
            totalWork += m.workJ || 0;
            if (m.powerW !== null) { totalPower += m.powerW; powerCount++; }
        }
    }

    return {
        totalWork:    isIso ? null        : totalWork,
        totalPower:   isIso ? null        : (powerCount > 0 ? totalPower / powerCount : null),
        totalTension: isIso ? totalTension : null,
        isIsometric:  isIso
    };
}

// ── HUD running total (display only) ─────────────────────────────
// Keeps using the same calcSetMetrics so display matches stored values.
function calcSetWork(ex, addedWeight, repsOrDist, setTimeSec) {
    if (!ex || ex.phase !== 'work') return 0;
    const m = calcSetMetrics(ex, addedWeight, repsOrDist, setTimeSec);
    return m.workJ || m.tensionLoad || 0;
}

// Label for the work unit shown in the HUD
function workUnitLabel() {
    return isMetric() ? 'J' : 'ft-lbf';
}

// ── Workout state ─────────────────────────────────────────────────
let currentWorkout       = [];   // deep copy of exercises for this session
let currentExerciseIndex = 0;
let currentSet           = 1;
let lapsedTimerInterval  = null;
let lapsedTime           = 0;
let workoutStartTime     = null;
let workoutInProgress    = false;

// Per-set tracking (for power calculation in Phase 4)
// setStartTime: timestamp when the active period of this set began (count-up or countdown start)
let setStartTime         = null;
// setElapsedSec[exerciseIndex][setIndex] = seconds the active period took
// This gets stored on the exercise object as ex.setTimes[]
// ex.userInputs[setIndex] = reps or distance entered for timed-isotonic sets

// Running work total for the Work phase
let runningWorkTotal     = 0;

// Debounce guard — prevents an accidental double-tap on Next Set (or a
// rapid double-fire of the click event on mobile) from advancing two
// sets at once.
let lastNextSetTime      = 0;
const NEXT_SET_DEBOUNCE_MS = 500;

// ── In-progress workout persistence ──────────────────────────────
// Saved to localStorage on every nextSet() so data survives app eviction.
// Auto-completed silently if last activity was > 3 hours ago.
const AUTO_COMPLETE_MS = 3 * 60 * 60 * 1000; // 3 hours

function saveInProgressWorkout() {
    if (!workoutInProgress) return;
    const state = {
        workoutIndex:         currentWorkoutIndex,
        workoutName:          workoutPlan[currentWorkoutIndex]?.name || '',
        currentWorkout:       currentWorkout,
        currentExerciseIndex: currentExerciseIndex,
        currentSet:           currentSet,
        lapsedTime:           lapsedTime,
        workoutStartTime:     workoutStartTime,
        runningWorkTotal:     runningWorkTotal,
        lastActivityTime:     Date.now(),
        weightUnit:           userSettings.weightUnit
    };
    localStorage.setItem('inProgressWorkout', JSON.stringify(state));
}

function clearInProgressWorkout() {
    localStorage.removeItem('inProgressWorkout');
}

function restoreInProgressWorkout() {
    const raw = localStorage.getItem('inProgressWorkout');
    if (!raw) return false;
    let state;
    try { state = JSON.parse(raw); } catch(e) { clearInProgressWorkout(); return false; }

    // Auto-complete silently if last activity was more than 3 hours ago
    if (Date.now() - state.lastActivityTime > AUTO_COMPLETE_MS) {
        // Reconstruct enough state to complete the workout, then auto-complete
        currentWorkoutIndex  = state.workoutIndex;
        currentWorkout       = state.currentWorkout || [];
        currentExerciseIndex = Math.min(state.currentExerciseIndex, currentWorkout.length - 1);
        currentSet           = state.currentSet || 1;
        lapsedTime           = state.lapsedTime || 0;
        workoutStartTime     = state.workoutStartTime;
        runningWorkTotal     = state.runningWorkTotal || 0;
        workoutInProgress    = true;
        clearInProgressWorkout();
        completeWorkout(true); // silent — no confirm dialog
        return true;
    }

    // Restore full state
    currentWorkoutIndex  = state.workoutIndex;
    currentWorkout       = state.currentWorkout || [];
    currentExerciseIndex = Math.min(state.currentExerciseIndex, currentWorkout.length - 1);
    currentSet           = state.currentSet || 1;
    lapsedTime           = state.lapsedTime || 0;
    workoutStartTime     = state.workoutStartTime;
    runningWorkTotal     = state.runningWorkTotal || 0;
    workoutInProgress    = true;
    return true;
}

// ── Timer state machine ───────────────────────────────────────────
// timerMode: 'idle' | 'rest' | 'countdown' | 'countup' | 'paused-rest' | 'paused-countdown' | 'paused-countup' | 'waiting-input'
let timerMode           = 'idle';
let timerInterval       = null;
let timerRemaining      = 0;   // for countdown/rest: seconds left
let timerElapsed        = 0;   // for countup: seconds elapsed
let currentRestDuration = 0;   // full rest duration for the current rest phase (for reset)
let currentActiveDuration = 0; // full active countdown duration for the current active phase (for reset)

let soundEnabled = JSON.parse(localStorage.getItem('soundEnabled') ?? 'true');


// Plan tab — which workout cards are expanded (by wIdx)
let expandedCards = new Set();

// ── Navigation ───────────────────────────────────────────────────
let currentTab = 'calendar';

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`${tabId}-section`).classList.add('active');
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    currentTab = tabId;
    toggleMenu(false);

    if (tabId === 'calendar') loadCalendar();
    if (tabId === 'plan')     loadPlan();
    if (tabId === 'workout')  resumeWorkoutTab();
    if (tabId === 'progress') loadProgress();
    if (tabId === 'settings') loadSettings();
}

function toggleMenu(forceState) {
    const overlay = document.getElementById('menu-overlay');
    const drawer  = document.getElementById('menu-drawer');
    const isOpen  = drawer.classList.contains('open');
    const open    = forceState !== undefined ? forceState : !isOpen;
    overlay.classList.toggle('open', open);
    drawer.classList.toggle('open', open);
}

function initTabs() {}

// ── Persistence ──────────────────────────────────────────────────
function savePlan() {
    localStorage.setItem('workoutPlan', JSON.stringify(workoutPlan));
    localStorage.setItem('currentWorkoutIndex', String(currentWorkoutIndex));
}


// ── CALENDAR ─────────────────────────────────────────────────────
let calendarYear  = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

function loadCalendar() {
    renderCalendar(calendarYear, calendarMonth);
    loadAppVersion();
}

function loadAppVersion(attempt = 0) {
    const el = document.getElementById('app-version-label');
    if (!el) return;
    if (!('caches' in window)) {
        el.textContent = 'Version unavailable';
        return;
    }
    const MAX_ATTEMPTS = 6;
    caches.keys().then(keys => {
        // The active cache name is the one that matches our SW naming convention.
        // Right after an app update + reload, the old service worker's cache
        // delete (in its 'activate' handler) can still be finishing up, so more
        // than one 'fitness-app-' cache may briefly exist. Retry a few times
        // (rather than showing/keeping a possibly-stale name) so the label
        // settles on the correct version without needing a tab switch.
        const swCaches = keys.filter(k => k.startsWith('fitness-app-'));
        if (swCaches.length > 1 && attempt < MAX_ATTEMPTS) {
            setTimeout(() => loadAppVersion(attempt + 1), 400);
            return;
        }
        el.textContent = swCaches[0] || 'Version unavailable';
    }).catch(() => {
        el.textContent = 'Version unavailable';
    });
}

function renderCalendar(year, month) {
    const container = document.getElementById('calendar-view');

    const workedDays = new Set(
        progressLogs.map(log => log.date ? log.date.slice(0, 10) : null).filter(Boolean)
    );

    const today      = new Date();
    const firstDay   = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDow   = firstDay.getDay();

    const monthName = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

    let html = `
        <div class="cal-header">
            <button class="cal-nav" onclick="calNav(-1)">‹</button>
            <span class="cal-month-label">${monthName}</span>
            <button class="cal-nav" onclick="calNav(1)">›</button>
        </div>
        <div class="cal-grid">
            <div class="cal-dow">Su</div>
            <div class="cal-dow">Mo</div>
            <div class="cal-dow">Tu</div>
            <div class="cal-dow">We</div>
            <div class="cal-dow">Th</div>
            <div class="cal-dow">Fr</div>
            <div class="cal-dow">Sa</div>
    `;

    for (let i = 0; i < startDow; i++) {
        html += `<div class="cal-day cal-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday  = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const hasWorkout = workedDays.has(dateStr);
        let cls = 'cal-day';
        if (isToday)    cls += ' cal-today';
        if (hasWorkout) cls += ' cal-worked';
        html += `<div class="${cls}">${d}${hasWorkout ? '<span class="cal-dot"></span>' : ''}</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function calNav(dir) {
    calendarMonth += dir;
    if (calendarMonth > 11) { calendarMonth = 0;  calendarYear++; }
    if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
    renderCalendar(calendarYear, calendarMonth);
}

// ── PLAN TAB ─────────────────────────────────────────────────────

function loadPlan() {
    const container = document.getElementById('weekly-plan');
    container.innerHTML = '';

    if (workoutPlan.length === 0) {
        container.innerHTML = '<p class="plan-empty">No workouts yet. Tap "Add Workout" to get started.</p>';
        return;
    }

    workoutPlan.forEach((workout, wIdx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-wrapper';
        const delBtn = document.createElement('button');
        delBtn.className = 'swipe-delete-btn';
        delBtn.dataset.index = wIdx;
        delBtn.textContent = '🗑 Delete';

        const card = document.createElement('div');
        card.className = 'day workout-card';
        card.setAttribute('draggable', 'true');
        card.dataset.index = wIdx;

        const isNext     = wIdx === currentWorkoutIndex;
        const isExpanded = expandedCards.has(wIdx);
        if (isNext)     card.classList.add('next-workout');
        if (isExpanded) card.classList.add('expanded');

        card.innerHTML = `
            <div class="workout-card-header" onclick="toggleCard(${wIdx}, event)">
                <span class="drag-handle" title="Drag to reorder" onclick="event.stopPropagation()">⠿</span>
                ${isNext
                    ? `<button class="next-badge-btn" onclick="event.stopPropagation(); advanceToWorkout(${wIdx})">▶ Next</button>`
                    : `<button class="set-next-btn"   onclick="event.stopPropagation(); advanceToWorkout(${wIdx})">Set Next</button>`}
                <span class="workout-seq">#${wIdx + 1}</span>
                <input class="workout-name-input" type="text" value="${escHtml(workout.name)}"
                    onchange="updateWorkoutName(${wIdx}, this.value)"
                    onclick="event.stopPropagation()"
                    placeholder="Workout name">
                <span class="collapse-chevron">${isExpanded ? '▲' : '▼'}</span>
            </div>
            <div class="card-body" id="card-body-${wIdx}" style="display:${isExpanded ? 'block' : 'none'};">
                ${renderPhaseSection(workout, wIdx, 'warmup',   '🌡 Warmup')}
                ${renderPhaseSection(workout, wIdx, 'work',     '💪 Work')}
                ${renderPhaseSection(workout, wIdx, 'cooldown', '❄️ Cooldown')}
            </div>
        `;

        wrapper.appendChild(delBtn);
        wrapper.appendChild(card);
        container.appendChild(wrapper);
    });

    initDragAndDrop();
    initSwipeToDelete();
    initExerciseDragAndDrop();
}

// Render one phase section (Warmup / Work / Cooldown) inside a workout card
function renderPhaseSection(workout, wIdx, phase, label) {
    const phaseExercises = workout.exercises
        .map((ex, eIdx) => ({ ex, eIdx }))
        .filter(({ ex }) => (ex.phase || 'work') === phase);

    const exRows = phaseExercises.map(({ ex, eIdx }) =>
        renderExerciseRow(ex, wIdx, eIdx)
    ).join('');

    return `
        <div class="phase-section">
            <div class="phase-header">
                <span class="phase-label">${label}</span>
                <button class="phase-add-btn" onclick="addExercise(${wIdx}, '${phase}')">＋ Add</button>
            </div>
            <div class="phase-ex-list" id="phase-${wIdx}-${phase}" data-widx="${wIdx}" data-phase="${phase}">
                ${exRows || `<p class="phase-empty">No exercises yet</p>`}
            </div>
        </div>
    `;
}

// Render a compact exercise summary row in the plan card
function renderExerciseRow(ex, wIdx, eIdx) {
    const typeTag  = ex.type === 'isometric'
        ? '<span class="ex-tag ex-tag-iso">ISO</span>'
        : '<span class="ex-tag ex-tag-ton">TON</span>';

    const bwForce = getBodyWeightForce(ex);
    const bwText  = bwForce !== null
        ? `${bwForce.toFixed(1)} ${userSettings.weightUnit} BW`
        : '⚠ set weight';

    let targetText = '';
    const timedLogLabel = ex.timedInput === 'distance' ? 'dist' : (ex.timedInput === 'none' ? 'no log' : 'reps');
    if (ex.type === 'isometric') {
        targetText = `${ex.target}s × ${ex.sets} sets`;
    } else if (ex.unit === 'reps') {
        targetText = `${ex.target} reps × ${ex.sets} sets`;
    } else if (ex.unit === 'meters') {
        targetText = `${ex.target}m × ${ex.sets} sets`;
    } else if (ex.unit === 'seconds') {
        targetText = ex.timedInput === 'none'
            ? `${ex.target}s, no logging × ${ex.sets} sets`
            : `${ex.target}s, log ${timedLogLabel} × ${ex.sets} sets`;
    } else if (ex.unit === 'minutes') {
        targetText = ex.timedInput === 'none'
            ? `${ex.target}min, no logging × ${ex.sets} sets`
            : `${ex.target}min, log ${timedLogLabel} × ${ex.sets} sets`;
    }

    const isTimedNoneIso = ex.type !== 'isometric'
        && (ex.unit === 'seconds' || ex.unit === 'minutes')
        && ex.timedInput === 'none';
    const autoSeqText = ((ex.type === 'isometric' || isTimedNoneIso) && ex.autoSequence) ? ' · ⚡ Auto-seq' : '';
    const restText = `Ex rest: ${ex.exerciseRestSec ?? 90}s${autoSeqText} · Set rest: ${ex.setRestSec ?? 60}s`;

    return `
        <div class="plan-ex-row" id="plan-ex-${wIdx}-${eIdx}" draggable="true"
            data-widx="${wIdx}" data-eidx="${eIdx}" data-phase="${ex.phase || 'work'}">
            <div class="plan-ex-main">
                <span class="ex-drag-handle" title="Drag to reorder">⠿</span>
                ${typeTag}
                <span class="plan-ex-name">${escHtml(ex.name)}</span>
                <button class="icon-btn plan-ex-edit-btn" onclick="editExercise(${wIdx}, ${eIdx})" title="Edit">✏️</button>
                <button class="icon-btn danger" onclick="removeExercise(${wIdx}, ${eIdx})" title="Remove">✕</button>
            </div>
            <div class="plan-ex-detail">${targetText} · ${bwText}</div>
            <div class="plan-ex-rest">${restText}</div>
        </div>
    `;
}

// ── Swipe-to-delete workout cards ────────────────────────────────
function initSwipeToDelete() {
    document.querySelectorAll('.workout-card').forEach(card => {
        const wrapper = card.closest('.swipe-wrapper');
        let startX = 0, startY = 0, currentX = 0;
        let swiping = false;
        const threshold = 80;

        card.addEventListener('touchstart', e => {
            // If this touch is (or becomes) an exercise reorder drag, don't
            // arm the card swipe at all.
            if (exerciseReorderTouchActive) { swiping = false; return; }
            startX  = e.touches[0].clientX;
            startY  = e.touches[0].clientY;
            currentX = 0;
            swiping = false;
            card.style.transition = 'none';
        }, { passive: true });

        card.addEventListener('touchmove', e => {
            // An exercise row drag (handled by onExTouchStart/onExTouchMove)
            // is in progress — never let the card's own swipe-to-delete
            // logic engage on top of it, even if it was armed a moment
            // earlier from stale start coordinates.
            if (exerciseReorderTouchActive) { swiping = false; return; }
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (!swiping && Math.abs(dy) > Math.abs(dx)) return;
            if (dx > 0) return;
            swiping = true;
            e.preventDefault();
            currentX = Math.max(dx, -140);
            card.style.transform = `translateX(${currentX}px)`;
            // Reveal the delete button proportionally as the card slides,
            // so it slides in alongside the card rather than appearing late.
            wrapper?.classList.toggle('swipe-revealed', currentX < -8);
        }, { passive: false });

        card.addEventListener('touchend', () => {
            if (exerciseReorderTouchActive) return;
            card.style.transition = 'transform 0.25s ease';
            if (currentX < -threshold) {
                card.style.transform = 'translateX(-100px)';
                card.classList.add('swipe-open');
                wrapper?.classList.add('swipe-revealed');
            } else {
                card.style.transform = 'translateX(0)';
                card.classList.remove('swipe-open');
                wrapper?.classList.remove('swipe-revealed');
            }
        });
    });

    document.querySelectorAll('.swipe-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const wIdx = parseInt(btn.dataset.index);
            removeWorkout(wIdx);
        });
    });
}

document.addEventListener('touchstart', e => {
    document.querySelectorAll('.workout-card.swipe-open').forEach(card => {
        if (!card.contains(e.target)) {
            card.style.transition = 'transform 0.25s ease';
            card.style.transform  = 'translateX(0)';
            card.classList.remove('swipe-open');
            card.closest('.swipe-wrapper')?.classList.remove('swipe-revealed');
        }
    });
}, { passive: true });


function toggleCard(wIdx, event) {
    if (expandedCards.has(wIdx)) {
        expandedCards.delete(wIdx);
    } else {
        expandedCards.add(wIdx);
    }
    loadPlan();
}

function advanceToWorkout(wIdx) {
    currentWorkoutIndex = (wIdx + 1) % workoutPlan.length;
    savePlan();
    loadPlan();
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addWorkout() {
    const name = prompt('Workout name (e.g. "Push Day", "Cardio"):')?.trim();
    if (!name) return;
    workoutPlan.push({ name, exercises: [] });
    expandedCards.add(workoutPlan.length - 1);
    savePlan(); loadPlan();
}

function updateWorkoutName(wIdx, value) {
    workoutPlan[wIdx].name = value.trim() || `Workout ${wIdx + 1}`;
    savePlan();
}

function removeWorkout(wIdx) {
    if (!confirm(`Remove "${workoutPlan[wIdx].name}"?`)) return;
    workoutPlan.splice(wIdx, 1);
    if (currentWorkoutIndex >= workoutPlan.length) currentWorkoutIndex = 0;
    savePlan(); loadPlan();
}

// ── Exercise form modal (Phase 2) ────────────────────────────────
let _exModal = {};

function exModalOpen() {
    document.getElementById('ex-modal-overlay').classList.add('open');
    document.getElementById('ex-modal').classList.add('open');
}
function exModalClose() {
    document.getElementById('ex-modal-overlay').classList.remove('open');
    document.getElementById('ex-modal').classList.remove('open');
    _exModal = {};
}
function exModalCancel() { exModalClose(); }

function exModalSetTitle(t) {
    document.getElementById('ex-modal-title').textContent = t;
}
function exModalSetBody(html) {
    document.getElementById('ex-modal-body').innerHTML = html;
}

function addExercise(wIdx, phase) {
    _exModal = { wIdx, phase: phase || 'work', editIdx: null };
    const defaults = {
        name: '', type: 'isotonic', phase: phase || 'work',
        bodyWeightPct: 0, heightPct: null, distanceM: null,
        unit: 'reps', target: 10, timedInput: 'reps',
        sets: 3, setRestSec: 60, exerciseRestSec: 90,
        autoSequence: false
    };
    openExerciseForm('Add Exercise', defaults);
}

function editExercise(wIdx, eIdx) {
    _exModal = { wIdx, phase: null, editIdx: eIdx };
    const ex = workoutPlan[wIdx].exercises[eIdx];
    openExerciseForm('Edit Exercise', ex);
}

function openExerciseForm(title, ex) {
    exModalSetTitle(title);

    const isoChecked  = ex.type === 'isometric' ? 'checked' : '';
    const tonChecked  = ex.type !== 'isometric' ? 'checked' : '';

    const phases = [
        { val: 'warmup',   label: '🌡 Warmup' },
        { val: 'work',     label: '💪 Work' },
        { val: 'cooldown', label: '❄️ Cooldown' }
    ];
    const phaseOpts = phases.map(p =>
        `<option value="${p.val}" ${(ex.phase || 'work') === p.val ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const unitOpts = ex.type === 'isometric'
        ? `<option value="seconds" selected>Seconds</option>`
        : `
            <option value="reps"    ${ex.unit === 'reps'    ? 'selected' : ''}>Reps</option>
            <option value="seconds" ${ex.unit === 'seconds' ? 'selected' : ''}>Seconds (timed set)</option>
            <option value="minutes" ${ex.unit === 'minutes' ? 'selected' : ''}>Minutes (timed set)</option>
            <option value="meters"  ${ex.unit === 'meters'  ? 'selected' : ''}>Meters (distance)</option>
          `;

    const isTimedSet = ex.type !== 'isometric' && (ex.unit === 'seconds' || ex.unit === 'minutes');
    const timedVis   = isTimedSet ? '' : 'display:none';
    const currentPhase     = ex.phase || 'work';
    const timedInputVal    = ex.timedInput || 'reps';
    const timedRepsChecked = (timedInputVal === 'reps')     ? 'checked' : '';
    const timedDistChecked = (timedInputVal === 'distance') ? 'checked' : '';
    const timedNoneChecked = (timedInputVal === 'none')     ? 'checked' : '';
    // "No logging" is only offered for Warmup/Cooldown timed-isotonic exercises —
    // the Work phase always needs reps/distance to compute Work/Power.
    const noneOptVis = currentPhase !== 'work' ? '' : 'display:none';
    const showAutoSeq = ex.type === 'isometric'
        || (isTimedSet && currentPhase !== 'work' && timedInputVal === 'none');

    const isDistanceBased = ex.unit === 'meters';
    const heightVis = (ex.type !== 'isometric' && !isDistanceBased) ? '' : 'display:none';
    const distanceVis = isDistanceBased ? '' : 'display:none';

    const bwForce = getBodyWeightForce(ex);
    const bwPreview = bwForce !== null
        ? `${bwForce.toFixed(1)} ${userSettings.weightUnit}`
        : '(enter weight in Settings)';

    exModalSetBody(`
        <div class="ex-form">
            <div class="ex-form-section">
                <label class="ex-form-label">Exercise name / library search</label>
                <div class="ex-form-row" style="gap:6px;margin-bottom:6px;">
                    <input id="ef-name" class="ex-text-input" type="text"
                        placeholder="Type to search…"
                        value="${escHtml(ex.name)}" autocomplete="off"
                        oninput="exFormLibrarySearch(this.value)" style="flex:1;min-width:0;">
                    <select id="ef-cat-filter" class="ex-form-select" style="flex:0 0 100px;"
                        onchange="exFormLibrarySearch(document.getElementById('ef-name').value)">
                        <option value="all">All</option>
                        <option value="upper">Upper</option>
                        <option value="lower">Lower</option>
                        <option value="core">Core</option>
                        <option value="cardio">Cardio</option>
                        <option value="full">Full Body</option>
                        <option value="mobility">Mobility</option>
                        <option value="custom">Custom ★</option>
                    </select>
                </div>
                <div id="ef-lib-results" class="ex-lib-results"></div>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label">Exercise type</label>
                <div class="ex-toggle-row">
                    <label class="ex-toggle-opt">
                        <input type="radio" name="ef-type" value="isotonic" ${tonChecked}
                            onchange="exFormTypeChanged()"> Isotonic
                    </label>
                    <label class="ex-toggle-opt">
                        <input type="radio" name="ef-type" value="isometric" ${isoChecked}
                            onchange="exFormTypeChanged()"> Isometric
                    </label>
                </div>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-phase">Phase</label>
                <select id="ef-phase" class="ex-form-select" onchange="exFormPhaseChanged()">${phaseOpts}</select>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-bwpct">
                    Body weight % <span class="ex-form-hint">(0–100)</span>
                </label>
                <div class="ex-form-row">
                    <input id="ef-bwpct" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="0" max="100" step="1"
                        value="${Math.round((ex.bodyWeightPct ?? 0) * 100)}"
                        oninput="exFormUpdateBWPreview()" onfocus="this.select()">
                    <span class="ex-form-unit">%</span>
                    <span id="ef-bw-preview" class="ex-bw-preview">= ${bwPreview}</span>
                </div>
            </div>
            <div id="ef-height-section" class="ex-form-section" style="${heightVis}">
                <label class="ex-form-label" for="ef-heightpct">
                    Height % per rep <span class="ex-form-hint">(0–100, e.g. squat ≈ 50)</span>
                </label>
                <div class="ex-form-row">
                    <input id="ef-heightpct" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="0" max="100" step="1"
                        value="${ex.heightPct !== null && ex.heightPct !== undefined ? Math.round(ex.heightPct * 100) : ''}"
                        onfocus="this.select()">
                    <span class="ex-form-unit">%</span>
                </div>
            </div>
            <div id="ef-distance-section" class="ex-form-section" style="${distanceVis}">
                <label class="ex-form-label" for="ef-distance">
                    Distance <span class="ex-form-hint">(meters)</span>
                </label>
                <div class="ex-form-row">
                    <input id="ef-distance" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="0" step="1"
                        value="${ex.distanceM ?? ''}"
                        onfocus="this.select()">
                    <span class="ex-form-unit">m</span>
                </div>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-unit">Active period measured in</label>
                <select id="ef-unit" class="ex-form-select" onchange="exFormUnitChanged()">${unitOpts}</select>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-target" id="ef-target-label">
                    Target <span class="ex-form-hint" id="ef-target-hint"></span>
                </label>
                <div class="ex-form-row">
                    <input id="ef-target" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="1" step="1" value="${ex.target ?? 10}" onfocus="this.select()">
                    <span id="ef-target-unit" class="ex-form-unit"></span>
                </div>
            </div>
            <div id="ef-timed-section" class="ex-form-section" style="${timedVis}">
                <label class="ex-form-label">During timed set, user will log</label>
                <div class="ex-toggle-row">
                    <label class="ex-toggle-opt">
                        <input type="radio" name="ef-timed-input" value="reps" ${timedRepsChecked}
                            onchange="exFormTimedInputChanged()"> Reps
                    </label>
                    <label class="ex-toggle-opt">
                        <input type="radio" name="ef-timed-input" value="distance" ${timedDistChecked}
                            onchange="exFormTimedInputChanged()"> Distance
                    </label>
                    <label class="ex-toggle-opt" id="ef-timed-none-opt" style="${noneOptVis}">
                        <input type="radio" name="ef-timed-input" value="none" ${timedNoneChecked}
                            onchange="exFormTimedInputChanged()"> None
                    </label>
                </div>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-sets">Number of sets</label>
                <div class="ex-form-row">
                    <input id="ef-sets" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="1" step="1" value="${ex.sets ?? 3}" onfocus="this.select()">
                    <span class="ex-form-unit">sets</span>
                </div>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-ex-rest">
                    Rest before this exercise <span class="ex-form-hint">(seconds)</span>
                </label>
                <div class="ex-form-row">
                    <input id="ef-ex-rest" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="0" step="5" value="${ex.exerciseRestSec ?? 90}" onfocus="this.select()">
                    <span class="ex-form-unit">s</span>
                </div>
            </div>
            <div class="ex-form-section">
                <label class="ex-form-label" for="ef-set-rest">
                    Rest between sets <span class="ex-form-hint">(seconds)</span>
                </label>
                <div class="ex-form-row">
                    <input id="ef-set-rest" class="ex-num-input" type="number"
                        inputmode="numeric" pattern="[0-9]*"
                        min="0" step="5" value="${ex.setRestSec ?? 60}" onfocus="this.select()">
                    <span class="ex-form-unit">s</span>
                </div>
            </div>
            <div id="ef-autoseq-section" class="ex-form-section" style="${showAutoSeq ? '' : 'display:none'}">
                <label class="ex-form-label">
                    Auto-sequence sets
                    <span class="ex-form-hint"> — when on, the next set starts automatically after rest ends (within this exercise only)</span>
                </label>
                <div class="ex-toggle-row">
                    <label class="ex-toggle-opt">
                        <input type="radio" name="ef-autoseq" value="off" ${ex.autoSequence ? '' : 'checked'}> Off
                    </label>
                    <label class="ex-toggle-opt">
                        <input type="radio" name="ef-autoseq" value="on" ${ex.autoSequence ? 'checked' : ''}> On
                    </label>
                </div>
            </div>
        </div>
    `);

    document.querySelector('.ex-modal-footer').innerHTML = `
        <button class="ex-modal-cancel" onclick="exModalCancel()">Cancel</button>
        <button class="ex-modal-next"   onclick="exFormSave()">Save ✓</button>
    `;

    exModalOpen();
    exFormUpdateTargetLabel();
    setTimeout(() => document.getElementById('ef-name')?.focus(), 120);
}

function exFormLibrarySearch(query) {
    const resultsEl = document.getElementById('ef-lib-results');
    if (!resultsEl) return;
    const q   = query.trim();
    const cat = document.getElementById('ef-cat-filter')?.value || 'all';
    // Show results when filtering by category even with no query, or when query exists
    if (!q && cat === 'all') { resultsEl.innerHTML = ''; return; }
    const matches = (typeof librarySearch === 'function') ? librarySearch(q, cat).slice(0, 8) : [];
    if (matches.length === 0) {
        resultsEl.innerHTML = `<p style="color:#636366;font-size:13px;margin:4px 0;">No matches. Fill in the fields manually or <button class="ex-modal-next" style="padding:4px 10px;font-size:13px;" onclick="saveCurrentAsCustom()">Save as Custom ★</button></p>`;
        return;
    }
    resultsEl.innerHTML = matches.map(m => {
        const customBadge = m.custom ? ' <span style="color:#ff9f0a;font-size:10px;">★ Custom</span>' : '';
        const deleteBtnHtml = m.custom
            ? `<button onclick="event.stopPropagation();deleteCustomLibraryEntry('${escHtml(m.name)}')" style="background:#ff453a;color:#fff;font-size:11px;padding:2px 7px;border:none;border-radius:6px;margin:0;cursor:pointer;flex-shrink:0;">✕</button>`
            : '';
        return `
        <div style="display:flex;align-items:center;gap:6px;">
            <button class="ex-lib-result-btn" style="flex:1;" onclick="exFormApplyLibraryEntry(${JSON.stringify(m).replace(/"/g, '&quot;')})">
                <span class="ex-lib-name">${escHtml(m.name)}${customBadge}</span>
                <span class="ex-lib-meta">${m.category} · BW ${Math.round(m.bodyWeightPct * 100)}%${m.heightPct !== null && m.heightPct !== undefined ? ` · H ${Math.round(m.heightPct * 100)}%` : ''}</span>
            </button>
            ${deleteBtnHtml}
        </div>`;
    }).join('');
}

function exFormApplyLibraryEntry(entry) {
    const nameEl = document.getElementById('ef-name');
    if (nameEl) nameEl.value = entry.name;
    const typeInputs = document.querySelectorAll('input[name="ef-type"]');
    typeInputs.forEach(inp => { inp.checked = inp.value === entry.type; });
    const bwEl = document.getElementById('ef-bwpct');
    if (bwEl) bwEl.value = Math.round((entry.bodyWeightPct ?? 0) * 100);
    const hEl = document.getElementById('ef-heightpct');
    if (hEl) hEl.value = entry.heightPct !== null && entry.heightPct !== undefined
        ? Math.round(entry.heightPct * 100) : '';
    const unitEl = document.getElementById('ef-unit');
    if (unitEl && entry.unit) unitEl.value = entry.unit;
    const resultsEl = document.getElementById('ef-lib-results');
    if (resultsEl) resultsEl.innerHTML = '';
    exFormBWPreviewUpdate();
    exFormUpdateTargetLabel();
    exFormTypeChanged();
}

// Save the current form values as a custom library entry
function saveCurrentAsCustom() {
    const name = document.getElementById('ef-name')?.value.trim();
    if (!name) { alert('Enter an exercise name first.'); return; }
    const typeVal  = document.querySelector('input[name="ef-type"]:checked')?.value || 'isotonic';
    const bwPct    = Math.min(Math.max((parseFloat(document.getElementById('ef-bwpct')?.value) || 0) / 100, 0), 1);
    const hPctRaw  = document.getElementById('ef-heightpct')?.value;
    const heightPct = (hPctRaw !== undefined && hPctRaw !== '') ? (parseFloat(hPctRaw) / 100 || null) : null;
    const unit     = typeVal === 'isometric' ? 'seconds' : (document.getElementById('ef-unit')?.value || 'reps');
    const catFilter = document.getElementById('ef-cat-filter')?.value;
    const category = (catFilter && catFilter !== 'all' && catFilter !== 'custom') ? catFilter : 'custom';
    const entry = {
        name, category, type: typeVal,
        bodyWeightPct: bwPct, heightPct,
        distanceM: null, unit,
        notes: 'Custom exercise'
    };
    libraryAddCustom(entry);
    alert(`✅ "${name}" saved to your custom library!`);
    exFormLibrarySearch(name);
}

// Delete a custom library entry (called from both Settings and search results)
function deleteCustomLibraryEntry(name) {
    if (!confirm(`Remove "${name}" from your custom library?`)) return;
    if (typeof libraryDeleteCustom === 'function') libraryDeleteCustom(name);
    renderCustomLibraryList();
    // Refresh search results if modal is open
    const resultsEl = document.getElementById('ef-lib-results');
    if (resultsEl) exFormLibrarySearch(document.getElementById('ef-name')?.value || '');
}

function exFormUpdateBWPreview() { exFormBWPreviewUpdate(); }

function exFormBWPreviewUpdate() {
    const pctEl = document.getElementById('ef-bwpct');
    const previewEl = document.getElementById('ef-bw-preview');
    if (!pctEl || !previewEl) return;
    const pct = parseFloat(pctEl.value) / 100 || 0;
    const bw  = getUserWeightInWorkingUnit();
    if (bw === null) {
        previewEl.textContent = '= (enter weight in Settings)';
    } else {
        previewEl.textContent = `= ${(bw * pct).toFixed(1)} ${userSettings.weightUnit}`;
    }
}

function exFormTypeChanged() {
    const typeVal = document.querySelector('input[name="ef-type"]:checked')?.value || 'isotonic';
    const unitEl  = document.getElementById('ef-unit');
    if (!unitEl) return;
    const autoSeqSec = document.getElementById('ef-autoseq-section');
    if (typeVal === 'isometric') {
        unitEl.innerHTML = `<option value="seconds" selected>Seconds</option>`;
        unitEl.disabled = true;
        const hSec = document.getElementById('ef-height-section');
        const dSec = document.getElementById('ef-distance-section');
        const tSec = document.getElementById('ef-timed-section');
        if (hSec) hSec.style.display = 'none';
        if (dSec) dSec.style.display = 'none';
        if (tSec) tSec.style.display = 'none';
        if (autoSeqSec) autoSeqSec.style.display = '';
    } else {
        unitEl.disabled = false;
        if (unitEl.options.length === 1 && unitEl.options[0].value === 'seconds') {
            unitEl.innerHTML = `
                <option value="reps" selected>Reps</option>
                <option value="seconds">Seconds (timed set)</option>
                <option value="minutes">Minutes (timed set)</option>
                <option value="meters">Meters (distance)</option>
            `;
        }
        if (autoSeqSec) autoSeqSec.style.display = 'none';
        exFormUnitChanged();
    }
    exFormUpdateTargetLabel();
    exFormRefreshTimedOptions();
}

function exFormUnitChanged() {
    const unitVal = document.getElementById('ef-unit')?.value || 'reps';
    const typeVal = document.querySelector('input[name="ef-type"]:checked')?.value || 'isotonic';
    const hSec    = document.getElementById('ef-height-section');
    const dSec    = document.getElementById('ef-distance-section');
    const tSec    = document.getElementById('ef-timed-section');
    if (typeVal === 'isometric') return;
    const isDistance = unitVal === 'meters';
    const isTimed    = unitVal === 'seconds' || unitVal === 'minutes';
    if (hSec) hSec.style.display = (!isDistance) ? '' : 'none';
    if (dSec) dSec.style.display = isDistance ? '' : 'none';
    if (tSec) tSec.style.display = isTimed ? '' : 'none';
    exFormUpdateTargetLabel();
    exFormRefreshAutoSeq();
}

// Called when the Phase select changes. "No logging" (for timed-isotonic
// exercises) is only valid in Warmup/Cooldown — the Work phase always
// needs reps/distance to compute Work/Power. Hide the option in Work,
// and fall back to "Reps" if it was selected.
function exFormRefreshTimedOptions() {
    const phaseVal = document.getElementById('ef-phase')?.value || 'work';
    const noneOpt  = document.getElementById('ef-timed-none-opt');
    if (noneOpt) noneOpt.style.display = (phaseVal !== 'work') ? '' : 'none';

    if (phaseVal === 'work') {
        const noneRadio = document.querySelector('input[name="ef-timed-input"][value="none"]');
        if (noneRadio && noneRadio.checked) {
            const repsRadio = document.querySelector('input[name="ef-timed-input"][value="reps"]');
            if (repsRadio) repsRadio.checked = true;
        }
    }
    exFormRefreshAutoSeq();
}

function exFormPhaseChanged() {
    exFormRefreshTimedOptions();
}

function exFormTimedInputChanged() {
    exFormRefreshAutoSeq();
}

// Auto-sequence is available for isometric exercises (always), and for
// timed-isotonic exercises in Warmup/Cooldown when "None" logging is chosen.
function exFormRefreshAutoSeq() {
    const autoSeqSec = document.getElementById('ef-autoseq-section');
    if (!autoSeqSec) return;
    const typeVal  = document.querySelector('input[name="ef-type"]:checked')?.value || 'isotonic';
    const phaseVal = document.getElementById('ef-phase')?.value || 'work';
    const unitVal  = document.getElementById('ef-unit')?.value || 'reps';
    const timedInputVal = document.querySelector('input[name="ef-timed-input"]:checked')?.value || 'reps';
    const isTimedSet = typeVal !== 'isometric' && (unitVal === 'seconds' || unitVal === 'minutes');
    const show = typeVal === 'isometric'
        || (isTimedSet && phaseVal !== 'work' && timedInputVal === 'none');
    autoSeqSec.style.display = show ? '' : 'none';
}

function exFormUpdateTargetLabel() {
    const unitVal  = document.getElementById('ef-unit')?.value || 'reps';
    const typeVal  = document.querySelector('input[name="ef-type"]:checked')?.value || 'isotonic';
    const hintEl   = document.getElementById('ef-target-hint');
    const unitText = document.getElementById('ef-target-unit');
    if (!hintEl || !unitText) return;
    if (typeVal === 'isometric' || unitVal === 'seconds') {
        hintEl.textContent = '(duration per set)';
        unitText.textContent = 'sec';
    } else if (unitVal === 'minutes') {
        hintEl.textContent = '(duration per set)';
        unitText.textContent = 'min';
    } else if (unitVal === 'meters') {
        hintEl.textContent = '(distance per set)';
        unitText.textContent = 'm';
    } else {
        hintEl.textContent = '(reps per set)';
        unitText.textContent = 'reps';
    }
}

function exFormSave() {
    const name = document.getElementById('ef-name')?.value.trim();
    if (!name) {
        document.getElementById('ef-name')?.focus();
        return;
    }
    const typeVal    = document.querySelector('input[name="ef-type"]:checked')?.value || 'isotonic';
    const phaseVal   = document.getElementById('ef-phase')?.value || _exModal.phase || 'work';
    const bwPctRaw   = parseFloat(document.getElementById('ef-bwpct')?.value) || 0;
    const bodyWeightPct = Math.min(Math.max(bwPctRaw / 100, 0), 1);
    const hPctEl  = document.getElementById('ef-heightpct');
    const heightPct = hPctEl && hPctEl.closest('.ex-form-section').style.display !== 'none'
        ? (parseFloat(hPctEl.value) / 100 || null)
        : null;
    const distEl   = document.getElementById('ef-distance');
    const distanceM = distEl && distEl.closest('.ex-form-section').style.display !== 'none'
        ? (parseFloat(distEl.value) || null)
        : null;
    const unit     = typeVal === 'isometric'
        ? 'seconds'
        : (document.getElementById('ef-unit')?.value || 'reps');
    const target   = parseInt(document.getElementById('ef-target')?.value) || 10;
    const timedInputEl = document.querySelector('input[name="ef-timed-input"]:checked');
    let timedInput   = timedInputEl ? timedInputEl.value : 'reps';
    // Safety net: "None" logging is only valid for Warmup/Cooldown timed-isotonic sets.
    if (timedInput === 'none' && (typeVal === 'isometric' || phaseVal === 'work')) timedInput = 'reps';
    const sets          = parseInt(document.getElementById('ef-sets')?.value) || 3;
    const setRestSec    = parseInt(document.getElementById('ef-set-rest')?.value) ?? 60;
    const exerciseRestSec = parseInt(document.getElementById('ef-ex-rest')?.value) ?? 90;
    // Auto-sequence is meaningful for isometric exercises (always), and for
    // timed-isotonic Warmup/Cooldown exercises where the user logs nothing.
    const isTimedSet  = typeVal !== 'isometric' && (unit === 'seconds' || unit === 'minutes');
    const autoSeqEl   = document.querySelector('input[name="ef-autoseq"]:checked');
    const autoSeqAllowed = typeVal === 'isometric'
        || (isTimedSet && phaseVal !== 'work' && timedInput === 'none');
    const autoSequence = autoSeqAllowed && autoSeqEl?.value === 'on';

    const exObj = {
        name, type: typeVal, phase: phaseVal,
        bodyWeightPct, heightPct, distanceM,
        unit, target, timedInput,
        sets, setRestSec, exerciseRestSec,
        autoSequence,
        weights: []
    };

    const { wIdx, editIdx } = _exModal;
    if (editIdx !== null && editIdx !== undefined) {
        const existing = workoutPlan[wIdx].exercises[editIdx];
        if (existing.weights && existing.weights.length === sets) {
            exObj.weights = existing.weights;
        }
        workoutPlan[wIdx].exercises[editIdx] = exObj;
    } else {
        workoutPlan[wIdx].exercises.push(exObj);
    }

    savePlan();
    exModalClose();
    loadPlan();
}

function updateExercise(wIdx, eIdx, field, value) {
    if (field === 'sets' || field === 'target') value = parseInt(value) || 0;
    workoutPlan[wIdx].exercises[eIdx][field] = value;
    savePlan();
}

function removeExercise(wIdx, eIdx) {
    workoutPlan[wIdx].exercises.splice(eIdx, 1);
    savePlan(); loadPlan();
}

// ── Drag-and-drop ────────────────────────────────────────────────
let dragSrcIndex = null;

function initDragAndDrop() {
    document.querySelectorAll('.workout-card').forEach(card => {
        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragover',  onDragOver);
        card.addEventListener('drop',      onDrop);
        card.addEventListener('dragend',   onDragEnd);
        const handle = card.querySelector('.drag-handle');
        if (handle) handle.addEventListener('touchstart', onTouchStart, { passive: true });
    });
}

function onDragStart(e) {
    dragSrcIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    this.closest('.swipe-wrapper')?.classList.add('drag-in-progress');
    e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.workout-card').forEach(c => c.classList.remove('drag-over'));
    this.classList.add('drag-over');
}
function onDrop(e) {
    e.stopPropagation();
    const targetIndex = parseInt(this.dataset.index);
    if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
    const moved = workoutPlan.splice(dragSrcIndex, 1)[0];
    workoutPlan.splice(targetIndex, 0, moved);
    if      (dragSrcIndex === currentWorkoutIndex)                                       currentWorkoutIndex = targetIndex;
    else if (dragSrcIndex < currentWorkoutIndex && targetIndex >= currentWorkoutIndex)   currentWorkoutIndex--;
    else if (dragSrcIndex > currentWorkoutIndex && targetIndex <= currentWorkoutIndex)   currentWorkoutIndex++;
    savePlan(); loadPlan();
}
function onDragEnd() {
    document.querySelectorAll('.workout-card').forEach(c => c.classList.remove('dragging','drag-over'));
    document.querySelectorAll('.swipe-wrapper').forEach(w => w.classList.remove('drag-in-progress'));
    dragSrcIndex = null;
}

let touchDragCard = null, touchClone = null, touchOffsetY = 0;

function onTouchStart(e) {
    const handle = e.currentTarget;
    touchDragCard = handle.closest('.workout-card');
    dragSrcIndex  = parseInt(touchDragCard.dataset.index);
    // If this card (or any other) was mid-swipe, close it before dragging —
    // avoids dragging a card that's still offset to the left.
    document.querySelectorAll('.workout-card.swipe-open').forEach(c => {
        c.style.transition = 'transform 0.25s ease';
        c.style.transform  = 'translateX(0)';
        c.classList.remove('swipe-open');
        c.closest('.swipe-wrapper')?.classList.remove('swipe-revealed');
    });
    const rect = touchDragCard.getBoundingClientRect();
    touchOffsetY = e.touches[0].clientY - rect.top;
    touchClone = touchDragCard.cloneNode(true);
    touchClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;opacity:0.85;z-index:9999;pointer-events:none;border:2px solid #30d158;border-radius:14px;background:#2c2c2e;`;
    document.body.appendChild(touchClone);
    touchDragCard.classList.add('dragging');
    touchDragCard.closest('.swipe-wrapper')?.classList.add('drag-in-progress');
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend',  onTouchEnd);
}
function onTouchMove(e) {
    e.preventDefault();
    touchClone.style.top = (e.touches[0].clientY - touchOffsetY) + 'px';
    touchClone.style.display = 'none';
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    touchClone.style.display = '';
    const hovered = el?.closest('.workout-card');
    document.querySelectorAll('.workout-card').forEach(c => c.classList.remove('drag-over'));
    if (hovered && hovered !== touchDragCard) hovered.classList.add('drag-over');
}
function onTouchEnd() {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend',  onTouchEnd);
    if (touchClone) { touchClone.remove(); touchClone = null; }
    const overCard = document.querySelector('.workout-card.drag-over');
    if (overCard) {
        const targetIndex = parseInt(overCard.dataset.index);
        if (dragSrcIndex !== targetIndex) {
            const moved = workoutPlan.splice(dragSrcIndex, 1)[0];
            workoutPlan.splice(targetIndex, 0, moved);
            if      (dragSrcIndex === currentWorkoutIndex)                                       currentWorkoutIndex = targetIndex;
            else if (dragSrcIndex < currentWorkoutIndex && targetIndex >= currentWorkoutIndex)   currentWorkoutIndex--;
            else if (dragSrcIndex > currentWorkoutIndex && targetIndex <= currentWorkoutIndex)   currentWorkoutIndex++;
            savePlan();
        }
    }
    document.querySelectorAll('.workout-card').forEach(c => c.classList.remove('dragging','drag-over'));
    document.querySelectorAll('.swipe-wrapper').forEach(w => w.classList.remove('drag-in-progress'));
    touchDragCard = null; dragSrcIndex = null;
    loadPlan();
}

// ── Exercise reorder (drag-and-drop within a phase section) ──────
// Exercises live in a single flat array per workout (workout.exercises),
// with `phase` marking which section they belong to. Each rendered row
// carries its TRUE index into that flat array (data-eidx), so reordering
// just needs to remove from the source true-index and reinsert at the
// target true-index — the array itself defines display + export + workout
// order, so no separate "order" field is needed.
let exDragSrcWIdx  = null;
let exDragSrcEIdx  = null;
let exDragSrcPhase = null;
// True for the entire duration of a touch-based exercise reorder drag
// (from touchstart on the exercise drag handle to touchend). While true,
// the workout-card swipe-to-delete gesture (initSwipeToDelete) is fully
// suppressed so the two touch gestures never fight over the same drag.
let exerciseReorderTouchActive = false;

function initExerciseDragAndDrop() {
    document.querySelectorAll('.plan-ex-row').forEach(row => {
        row.addEventListener('dragstart', onExDragStart);
        row.addEventListener('dragover',  onExDragOver);
        row.addEventListener('drop',      onExDrop);
        row.addEventListener('dragend',   onExDragEnd);
        const handle = row.querySelector('.ex-drag-handle');
        if (handle) handle.addEventListener('touchstart', onExTouchStart, { passive: true });
    });
}

// Reorders a workout's exercises array: moves the exercise at fromEIdx to
// sit at the position currently occupied by toEIdx, WITHIN the same phase.
// Both indices are true indices into workout.exercises.
function reorderExercise(wIdx, fromEIdx, toEIdx, phase) {
    const exercises = workoutPlan[wIdx]?.exercises;
    if (!exercises) return;
    if (fromEIdx === toEIdx) return;
    const moving = exercises[fromEIdx];
    if (!moving || (moving.phase || 'work') !== phase) return;
    const target = exercises[toEIdx];
    if (!target || (target.phase || 'work') !== phase) return;

    exercises.splice(fromEIdx, 1);
    // After removing the source, the target's index shifts down by one
    // if it was after the source.
    const adjustedToIdx = fromEIdx < toEIdx ? toEIdx - 1 : toEIdx;
    exercises.splice(adjustedToIdx, 0, moving);

    savePlan();
    loadPlan();
}

function onExDragStart(e) {
    e.stopPropagation(); // don't trigger the workout-card drag
    exDragSrcWIdx  = parseInt(this.dataset.widx);
    exDragSrcEIdx  = parseInt(this.dataset.eidx);
    exDragSrcPhase = this.dataset.phase;
    this.classList.add('ex-dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function onExDragOver(e) {
    // Only allow drop within the same workout + phase
    if (parseInt(this.dataset.widx) !== exDragSrcWIdx || this.dataset.phase !== exDragSrcPhase) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.plan-ex-row').forEach(r => r.classList.remove('ex-drag-over'));
    this.classList.add('ex-drag-over');
}
function onExDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    const targetWIdx  = parseInt(this.dataset.widx);
    const targetEIdx  = parseInt(this.dataset.eidx);
    const targetPhase = this.dataset.phase;
    if (exDragSrcWIdx === null || targetWIdx !== exDragSrcWIdx || targetPhase !== exDragSrcPhase) return;
    reorderExercise(targetWIdx, exDragSrcEIdx, targetEIdx, targetPhase);
}
function onExDragEnd() {
    document.querySelectorAll('.plan-ex-row').forEach(r => r.classList.remove('ex-dragging', 'ex-drag-over'));
    exDragSrcWIdx = null; exDragSrcEIdx = null; exDragSrcPhase = null;
}

let exTouchDragRow = null, exTouchClone = null, exTouchOffsetY = 0;

function onExTouchStart(e) {
    e.stopPropagation();
    exerciseReorderTouchActive = true;
    const handle = e.currentTarget;
    exTouchDragRow = handle.closest('.plan-ex-row');
    exDragSrcWIdx  = parseInt(exTouchDragRow.dataset.widx);
    exDragSrcEIdx  = parseInt(exTouchDragRow.dataset.eidx);
    exDragSrcPhase = exTouchDragRow.dataset.phase;
    const rect = exTouchDragRow.getBoundingClientRect();
    exTouchOffsetY = e.touches[0].clientY - rect.top;
    exTouchClone = exTouchDragRow.cloneNode(true);
    exTouchClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;opacity:0.9;z-index:9999;pointer-events:none;border:2px solid #007aff;border-radius:10px;background:#fff;`;
    document.body.appendChild(exTouchClone);
    exTouchDragRow.classList.add('ex-dragging');
    document.addEventListener('touchmove', onExTouchMove, { passive: false });
    document.addEventListener('touchend',  onExTouchEnd);
}
function onExTouchMove(e) {
    e.preventDefault();
    exTouchClone.style.top = (e.touches[0].clientY - exTouchOffsetY) + 'px';
    exTouchClone.style.display = 'none';
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    exTouchClone.style.display = '';
    const hovered = el?.closest('.plan-ex-row');
    document.querySelectorAll('.plan-ex-row').forEach(r => r.classList.remove('ex-drag-over'));
    if (hovered && hovered !== exTouchDragRow
        && parseInt(hovered.dataset.widx) === exDragSrcWIdx
        && hovered.dataset.phase === exDragSrcPhase) {
        hovered.classList.add('ex-drag-over');
    }
}
function onExTouchEnd() {
    document.removeEventListener('touchmove', onExTouchMove);
    document.removeEventListener('touchend',  onExTouchEnd);
    if (exTouchClone) { exTouchClone.remove(); exTouchClone = null; }
    const overRow = document.querySelector('.plan-ex-row.ex-drag-over');
    if (overRow) {
        const targetWIdx  = parseInt(overRow.dataset.widx);
        const targetEIdx  = parseInt(overRow.dataset.eidx);
        const targetPhase = overRow.dataset.phase;
        if (targetWIdx === exDragSrcWIdx && targetPhase === exDragSrcPhase) {
            reorderExercise(targetWIdx, exDragSrcEIdx, targetEIdx, targetPhase);
        }
    }
    document.querySelectorAll('.plan-ex-row').forEach(r => r.classList.remove('ex-dragging', 'ex-drag-over'));
    exTouchDragRow = null; exDragSrcWIdx = null; exDragSrcEIdx = null; exDragSrcPhase = null;
    exerciseReorderTouchActive = false;
}

// ── Previous accomplishment lookup ───────────────────────────────
function getPreviousAccomplishment(exName, setIndex) {
    const woName = workoutPlan[currentWorkoutIndex]?.name;
    for (let i = progressLogs.length - 1; i >= 0; i--) {
        const log = progressLogs[i];
        if (log.workoutName !== woName) continue;
        const found = log.exercises.find(e => e.name === exName);
        if (!found) continue;
        const weight = found.weights?.[setIndex];
        const hasWeight = weight !== undefined && weight !== null && weight !== 0;
        const unitLabel = { reps:'reps', seconds:'sec', minutes:'min', meters:'m' }[found.unit] || 'reps';
        const date = new Date(log.date).toLocaleDateString();
        const wu   = log.weightUnit || userSettings.weightUnit;

        // Timed isotonic sets (seconds/minutes): show what was logged after the timer ended (reps or distance)
        let accomplished = null, accomplishedLabel = '';
        if (found.type !== 'isometric' && (found.unit === 'seconds' || found.unit === 'minutes')) {
            const val = found.userInputs?.[setIndex];
            if (val !== undefined && val !== null && val !== 0) {
                accomplished = val;
                accomplishedLabel = found.timedInput === 'distance'
                    ? (wu === 'lb' ? 'ft' : 'm')
                    : 'reps';
            }
        }

        // Rep/distance-based sets (reps/meters): show how long the set took
        let setTimeSec = null;
        if (found.type !== 'isometric' && (found.unit === 'reps' || found.unit === 'meters')) {
            const t = found.setTimes?.[setIndex];
            if (t !== undefined && t !== null && t > 0) setTimeSec = t;
        }

        return {
            date,
            target: found.target,
            unit:   found.unit,
            unitLabel,
            weight:     hasWeight ? weight : null,
            weightUnit: wu,
            accomplished,
            accomplishedLabel,
            setTimeSec
        };
    }
    return null;
}

// ── WORKOUT TAB ───────────────────────────────────────────────────

function loadWorkoutTab() {
    if (workoutPlan.length === 0) {
        document.getElementById('exercise-list').innerHTML =
            '<p style="color:#636366;text-align:center;padding:24px 0;">No workouts in your plan yet. Open the menu and go to Plan.</p>';
        return;
    }
    const wo = workoutPlan[currentWorkoutIndex];
    const phaseOrder = { warmup: 0, work: 1, cooldown: 2 };
    currentWorkout = JSON.parse(JSON.stringify(wo.exercises));
    currentWorkout.sort((a, b) =>
        (phaseOrder[a.phase || 'work'] ?? 1) - (phaseOrder[b.phase || 'work'] ?? 1)
    );
    currentWorkout.forEach(ex => {
        ex.weights    = new Array(ex.sets).fill(0);
        ex.setTimes   = new Array(ex.sets).fill(0);  // seconds per active period
        ex.userInputs = new Array(ex.sets).fill(0);  // reps/dist logged for timed-isotonic
    });
    currentExerciseIndex = 0;
    currentSet           = 1;
    lapsedTime           = 0;
    workoutStartTime     = null;
    workoutInProgress    = false;
    runningWorkTotal     = 0;
    document.getElementById('lapsed-time').textContent = formatTime(0);
    updateWorkTotalDisplay();
    clearInterval(lapsedTimerInterval);
    stopExerciseTimer();
    renderExercise();
    showStartButton();
    updateHudPhaseLabel();
}

function resumeWorkoutTab() {
    if (!workoutInProgress) {
        loadWorkoutTab();
        return;
    }
    syncElapsedDisplay();
    renderExercise();
    updateHudTimerDisplay();
    updateHudPhaseLabel();
}

function showStartButton() {
    resumeAudioContext();
    document.getElementById('start-workout-btn')?.remove();
    const list = document.getElementById('exercise-list');
    const btn = document.createElement('button');
    btn.id        = 'start-workout-btn';
    btn.className = 'start-workout-btn';
    btn.textContent = '▶ Start Workout';
    btn.onclick = startWorkout;
    list.prepend(btn);
}

function startWorkout() {
    const btn = document.getElementById('start-workout-btn');
    if (btn) btn.remove();
    workoutStartTime  = Date.now();
    workoutInProgress = true;
    runningWorkTotal  = 0;
    updateWorkTotalDisplay();
    renderExercise();
    startElapsedClock();
    // Start with the exercise rest of the first exercise, then go into its active period
    startExerciseRestThenActive();
}

function startElapsedClock() {
    clearInterval(lapsedTimerInterval);
    lapsedTimerInterval = setInterval(syncElapsedDisplay, 1000);
}

function syncElapsedDisplay() {
    if (!workoutStartTime) return;
    lapsedTime = Math.floor((Date.now() - workoutStartTime) / 1000);
    const el = document.getElementById('lapsed-time');
    if (el) el.textContent = formatTime(lapsedTime);
}

// ── HUD helpers ───────────────────────────────────────────────────

function updateHudPhaseLabel() {
    const el = document.getElementById('hud-workout-phase');
    if (!el) return;
    if (currentExerciseIndex >= currentWorkout.length || currentWorkout.length === 0) {
        el.textContent = '';
        return;
    }
    const ex = currentWorkout[currentExerciseIndex];
    const map = { warmup: '🌡 Warmup', work: '💪 Work', cooldown: '❄️ Cooldown' };
    el.textContent = map[ex.phase || 'work'] || '';
}

function updateWorkTotalDisplay() {
    const el = document.getElementById('hud-work-total');
    if (!el) return;
    if (runningWorkTotal <= 0) {
        el.textContent = '';
        return;
    }
    el.textContent = `Work: ${runningWorkTotal.toFixed(0)} ${workUnitLabel()}`;
}

// ── Per-exercise timer (Phase 3 complete rewrite) ─────────────────
// Timer state: timerMode = 'idle'|'rest'|'countdown'|'countup'|'paused-rest'|
//              'paused-countdown'|'paused-countup'|'waiting-input'

function stopExerciseTimer() {
    clearInterval(timerInterval);
    timerInterval  = null;
    timerMode      = 'idle';
    timerRemaining = 0;
    timerElapsed   = 0;
    setStartTime   = null;
    updateHudTimerDisplay();
    updatePauseResumeBtn();
}

function updateHudTimerDisplay() {
    const timerEl = document.getElementById('timer');
    const labelEl = document.getElementById('timer-phase-label');
    if (!timerEl) return;

    timerEl.className = 'hud-time';

    if (timerMode === 'rest' || timerMode === 'paused-rest') {
        timerEl.textContent = formatTime(timerRemaining);
        timerEl.classList.add('timer-rest');
        if (timerRemaining <= 10 && timerMode === 'rest') timerEl.classList.add('low');
        if (timerMode === 'paused-rest') timerEl.classList.add('paused');
        if (labelEl) { labelEl.textContent = '😮‍💨 Rest'; labelEl.className = 'hud-label timer-label-rest'; }
    } else if (timerMode === 'countdown' || timerMode === 'paused-countdown') {
        timerEl.textContent = formatTime(timerRemaining);
        timerEl.classList.add('timer-active');
        if (timerMode === 'paused-countdown') timerEl.classList.add('paused');
        if (labelEl) { labelEl.textContent = '🔥 Active'; labelEl.className = 'hud-label timer-label-active'; }
    } else if (timerMode === 'countup' || timerMode === 'paused-countup') {
        timerEl.textContent = formatTime(timerElapsed);
        timerEl.classList.add('timer-active');
        if (timerMode === 'paused-countup') timerEl.classList.add('paused');
        if (labelEl) { labelEl.textContent = '🔥 Active'; labelEl.className = 'hud-label timer-label-active'; }
    } else if (timerMode === 'waiting-input') {
        timerEl.textContent = '✏️';
        timerEl.classList.add('timer-active');
        if (labelEl) { labelEl.textContent = '📝 Log set'; labelEl.className = 'hud-label timer-label-active'; }
    } else {
        // idle
        timerEl.textContent = '--:--';
        if (labelEl) { labelEl.textContent = '⏱ Timer'; labelEl.className = 'hud-label'; }
    }

    updatePauseResumeBtn();
}

function updatePauseResumeBtn() {
    const btn     = document.getElementById('pause-resume-btn');
    const skipBtn = document.getElementById('skip-rest-btn');
    if (!btn) return;
    const isPaused  = timerMode === 'paused-rest' || timerMode === 'paused-countdown' || timerMode === 'paused-countup';
    const isRunning = timerMode === 'rest' || timerMode === 'countdown' || timerMode === 'countup';
    const isRest    = timerMode === 'rest' || timerMode === 'paused-rest';
    if (isRunning) {
        btn.textContent  = '⏸';
        btn.style.display = 'block';
    } else if (isPaused) {
        btn.textContent  = '▶';
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
    if (skipBtn) skipBtn.style.display = isRest ? 'block' : 'none';
}

function pauseResumeTimer() {
    if (timerMode === 'rest') {
        clearInterval(timerInterval);
        timerInterval = null;
        timerMode = 'paused-rest';
    } else if (timerMode === 'countdown') {
        clearInterval(timerInterval);
        timerInterval = null;
        timerMode = 'paused-countdown';
    } else if (timerMode === 'countup') {
        clearInterval(timerInterval);
        timerInterval = null;
        timerMode = 'paused-countup';
    } else if (timerMode === 'paused-rest') {
        timerMode = 'rest';
        runRestTimer(timerRemaining);
        return;
    } else if (timerMode === 'paused-countdown') {
        timerMode = 'countdown';
        playWhistle();
        runCountdownTimer(timerRemaining);
        return;
    } else if (timerMode === 'paused-countup') {
        timerMode = 'countup';
        playWhistle();
        resumeCountupTimer();
        return;
    }
    updateHudTimerDisplay();
}

// Skip rest to 3 seconds remaining
function skipToEndOfRest() {
    if (timerMode !== 'rest' && timerMode !== 'paused-rest') return;
    if (timerRemaining <= 3) return; // already nearly done
    timerRemaining = 3;
    // The running interval only beeps on its own 1-second tick, which would
    // otherwise skip the "3" beep entirely (it jumps straight from whatever
    // the remaining time was to 3, then ticks down to 2 on its next cycle).
    // Play the 3-second beep immediately so the user hears all three (3,2,1).
    playBeep();
    // If paused, resume from 3s; if already running the interval will
    // pick up timerRemaining naturally on its next tick
    if (timerMode === 'paused-rest') {
        clearInterval(timerInterval);
        timerInterval = null;
        timerMode = 'rest';
        currentRestDuration = 3;
        updateHudTimerDisplay();
        timerInterval = setInterval(() => {
            timerRemaining--;
            updateHudTimerDisplay();
            if (timerRemaining <= 3 && timerRemaining > 0) playBeep();
            if (timerRemaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                playWhistle();
                startActiveTimer();
            }
        }, 1000);
    } else {
        // Already running — just update display; interval will count down from 3
        updateHudTimerDisplay();
    }
}


function runRestTimer(durationSec) {
    clearInterval(timerInterval);
    timerMode           = 'rest';
    timerRemaining      = durationSec;
    currentRestDuration = durationSec;   // remember full duration for reset
    updateHudTimerDisplay();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimerDisplay();
        if (timerRemaining <= 3 && timerRemaining > 0) playBeep();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            playWhistle();
            startActiveTimer();
        }
    }, 1000);
}

// ── Start rest before first set of this exercise, then active ─────
function startExerciseRestThenActive() {
    if (currentExerciseIndex >= currentWorkout.length) return;
    const ex = currentWorkout[currentExerciseIndex];
    const restSec = ex.exerciseRestSec ?? 90;
    if (restSec > 0) {
        runRestTimer(restSec);
    } else {
        startActiveTimer();
    }
}

// ── Start rest between sets, then active ──────────────────────────
function startSetRestThenActive() {
    if (currentExerciseIndex >= currentWorkout.length) return;
    const ex = currentWorkout[currentExerciseIndex];
    const restSec = ex.setRestSec ?? 60;
    if (restSec > 0) {
        runRestTimer(restSec);
    } else {
        startActiveTimer();
    }
}

// ── Start the active period based on exercise type ─────────────────
function startActiveTimer() {
    if (currentExerciseIndex >= currentWorkout.length) return;
    const ex = currentWorkout[currentExerciseIndex];
    setStartTime = Date.now();

    if (ex.type === 'isometric') {
        // Countdown for isometric (always seconds)
        runCountdownTimer(ex.target);
    } else if (ex.unit === 'reps' || ex.unit === 'meters') {
        // Count-up: stops when user presses Next Set
        runCountupTimer();
    } else if (ex.unit === 'seconds') {
        // Timed isotonic: countdown seconds
        runCountdownTimer(ex.target);
    } else if (ex.unit === 'minutes') {
        // Timed isotonic: countdown minutes→seconds
        runCountdownTimer(ex.target * 60);
    } else {
        runCountupTimer();
    }
}

function runCountdownTimer(durationSec) {
    clearInterval(timerInterval);
    timerMode             = 'countdown';
    timerRemaining        = durationSec;
    currentActiveDuration = durationSec;   // remember full duration for reset
    updateHudTimerDisplay();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimerDisplay();
        if (timerRemaining <= 3 && timerRemaining > 0) playBeep();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            playBuzzer();
            onCountdownComplete();
        }
    }, 1000);
}

function runCountupTimer() {
    // Fresh start: reset elapsed to zero, then run
    timerElapsed = 0;
    resumeCountupTimer();
}

function resumeCountupTimer() {
    // Resume from current timerElapsed without resetting it
    clearInterval(timerInterval);
    timerMode = 'countup';
    currentActiveDuration = 0; // countup has no fixed duration
    updateHudTimerDisplay();
    timerInterval = setInterval(() => {
        timerElapsed++;
        updateHudTimerDisplay();
    }, 1000);
}

// Called when a countdown finishes (isometric or timed-isotonic)
function onCountdownComplete() {
    const ex = currentWorkout[currentExerciseIndex];
    const setIdx = currentSet - 1;

    // Preserve any weight the user prefilled during rest before re-rendering
    const enteredWeight = parseFloat(document.getElementById('weight-input')?.value);
    if (!isNaN(enteredWeight)) ex.weights[setIdx] = enteredWeight;

    // Record set time
    const setTimeSec = setStartTime ? Math.round((Date.now() - setStartTime) / 1000) : (ex.target || 0);
    ex.setTimes[setIdx] = setTimeSec;
    setStartTime = null;

    // Timed-isotonic sets where the user logs nothing (Warmup/Cooldown only)
    // can also auto-sequence, same as isometric.
    const isTimedNoneIso = ex.type !== 'isometric'
        && (ex.unit === 'seconds' || ex.unit === 'minutes')
        && ex.timedInput === 'none';

    if ((ex.type === 'isometric' || isTimedNoneIso) && ex.autoSequence && currentSet < ex.sets) {
        // Auto-sequence: skip waiting-input and go straight into next set's
        // rest-then-active cycle. nextSet() will increment currentSet and
        // call startSetRestThenActive() — but it also tries to read DOM
        // inputs for weight, so we must render first so weight-input exists.
        timerMode = 'idle';
        renderExercise();
        nextSet();
    } else if (ex.type === 'isometric') {
        timerMode = 'waiting-input';
        updateHudTimerDisplay();
        renderExercise();
    } else {
        // Timed isotonic: need user to log reps/distance (or, if "None" is
        // set, just confirm and tap Next Set — handled in renderExercise())
        timerMode = 'waiting-input';
        updateHudTimerDisplay();
        renderExercise();
    }
}

// ── Next Set button handler ───────────────────────────────────────
function nextSet() {
    // Guard against accidental double-tap / double-fired click advancing two sets
    const now = Date.now();
    if (now - lastNextSetTime < NEXT_SET_DEBOUNCE_MS) return;
    lastNextSetTime = now;

    const ex = currentWorkout[currentExerciseIndex];
    const setIdx = currentSet - 1;

    // Save added weight
    ex.weights[setIdx] = parseFloat(document.getElementById('weight-input')?.value) || 0;

    // For count-up exercises, record the elapsed time now
    if (timerMode === 'countup' || timerMode === 'paused-countup') {
        const setTimeSec = setStartTime ? Math.round((Date.now() - setStartTime) / 1000) : timerElapsed;
        ex.setTimes[setIdx] = setTimeSec;
        setStartTime = null;
    }

    // For timed-isotonic (waiting-input), save the reps/distance the user entered
    // — skipped entirely when "None" logging is selected (no input field is shown)
    if (ex.type !== 'isometric' && (ex.unit === 'seconds' || ex.unit === 'minutes') && ex.timedInput !== 'none') {
        const inputVal = parseFloat(document.getElementById('timed-user-input')?.value) || 0;
        ex.userInputs[setIdx] = inputVal;
    }

    // Accumulate work total (Work phase only)
    if (ex.phase === 'work') {
        const addedW    = ex.weights[setIdx];
        const setTimeSec = ex.setTimes[setIdx];
        let repsOrDist  = 0;
        if (ex.type === 'isometric') {
            repsOrDist = 0;
        } else if (ex.unit === 'reps') {
            repsOrDist = ex.target; // reps per set from plan
        } else if (ex.unit === 'meters') {
            repsOrDist = ex.distanceM || ex.target;
        } else {
            repsOrDist = ex.userInputs[setIdx];
        }
        runningWorkTotal += calcSetWork(ex, addedW, repsOrDist, setTimeSec);
        updateWorkTotalDisplay();
    }

    clearInterval(timerInterval);
    timerInterval = null;
    timerMode     = 'idle';   // clear waiting-input before re-rendering so banners don't persist

    // Advance to next set or exercise
    if (currentSet < ex.sets) {
        currentSet++;
        saveInProgressWorkout();
        renderExercise();
        startSetRestThenActive();
    } else {
        // End of this exercise — move to next
        currentExerciseIndex++;
        currentSet = 1;
        if (currentExerciseIndex >= currentWorkout.length) {
            // Workout complete — trigger completion
            stopExerciseTimer();
            renderExercise();
            updateHudPhaseLabel();
            return;
        }
        saveInProgressWorkout();
        renderExercise();
        updateHudPhaseLabel();
        startExerciseRestThenActive();
    }
}

function prevSet() {
    if (currentExerciseIndex === 0 && currentSet === 1) {
        // Cancel workout
        lapsedTime        = 0;
        workoutStartTime  = null;
        workoutInProgress = false;
        runningWorkTotal  = 0;
        clearInProgressWorkout();
        clearInterval(lapsedTimerInterval);
        stopExerciseTimer();
        document.getElementById('lapsed-time').textContent = formatTime(0);
        updateWorkTotalDisplay();
        renderExercise();
        showStartButton();
        updateHudPhaseLabel();
        return;
    }
    clearInterval(timerInterval);
    timerInterval = null;
    setStartTime  = null;

    if (currentSet > 1) {
        currentSet--;
        // Between sets of the same exercise — rest duration is setRestSec
        const restSec = currentWorkout[currentExerciseIndex].setRestSec ?? 60;
        timerRemaining      = restSec;
        currentRestDuration = restSec;
    } else {
        currentExerciseIndex--;
        currentSet = currentWorkout[currentExerciseIndex].sets;
        // Returning to a mid-exercise set — use setRestSec (exerciseRestSec only precedes set 1)
        const restSec = currentSet === 1
            ? (currentWorkout[currentExerciseIndex].exerciseRestSec ?? 90)
            : (currentWorkout[currentExerciseIndex].setRestSec ?? 60);
        timerRemaining      = restSec;
        currentRestDuration = restSec;
    }

    timerMode = 'paused-rest';
    updateHudTimerDisplay();
    updateHudPhaseLabel();
    renderExercise();
}

// ── Exercise card renderer ────────────────────────────────────────
function renderExercise() {
    const list = document.getElementById('exercise-list');
    list.innerHTML = '';

    if (currentExerciseIndex >= currentWorkout.length) {
        list.innerHTML = '<p class="workout-complete">Workout Complete! 🎉</p>';
        clearInterval(lapsedTimerInterval);
        return;
    }

    const ex = currentWorkout[currentExerciseIndex];
    const setIdx = currentSet - 1;

    const isFirst   = currentExerciseIndex === 0 && currentSet === 1;
    const isLastSet = currentExerciseIndex === currentWorkout.length - 1 && currentSet === ex.sets;

    // Goal line
    let goalText = '';
    if (ex.type === 'isometric') {
        goalText = `Tension Load: ${ex.target}s hold`;
    } else if (ex.unit === 'reps') {
        goalText = `Target: ${ex.target} reps`;
    } else if (ex.unit === 'seconds') {
        goalText = ex.timedInput === 'none'
            ? `Timed set: ${ex.target}s — no logging`
            : `Timed set: ${ex.target}s — log ${ex.timedInput === 'distance' ? 'distance' : 'reps'} after`;
    } else if (ex.unit === 'minutes') {
        goalText = ex.timedInput === 'none'
            ? `Timed set: ${ex.target} min — no logging`
            : `Timed set: ${ex.target} min — log ${ex.timedInput === 'distance' ? 'distance' : 'reps'} after`;
    } else if (ex.unit === 'meters') {
        goalText = `Distance: ${ex.distanceM || ex.target}m`;
    }

    // Phase badge
    const phaseBadgeMap = { warmup: '🌡 Warmup', work: '💪 Work', cooldown: '❄️ Cooldown' };
    const phaseBadge = phaseBadgeMap[ex.phase || 'work'] || '';

    // Timed-isotonic input (shown in waiting-input mode) — not shown when
    // "None" logging is selected, since there's nothing to log
    const isTimedIsotonic = ex.type !== 'isometric' && (ex.unit === 'seconds' || ex.unit === 'minutes');
    const needsTimedInput = timerMode === 'waiting-input' && isTimedIsotonic && ex.timedInput !== 'none';
    const needsTimedNoneConfirm = timerMode === 'waiting-input' && isTimedIsotonic && ex.timedInput === 'none';
    const timedInputLabel = ex.timedInput === 'distance'
        ? `Distance completed (${userSettings.weightUnit === 'lb' ? 'ft' : 'm'})`
        : 'Reps completed';

    const timedInputHTML = needsTimedInput
        ? `<div class="timed-input-block">
               <p class="timed-input-label">⏱ Set complete! Log your ${ex.timedInput === 'distance' ? 'distance' : 'reps'}:</p>
               <label>${timedInputLabel}:
                   <input type="number" id="timed-user-input" class="timed-user-input"
                       inputmode="numeric" pattern="[0-9]*"
                       step="1" min="0"
                       value="${ex.userInputs[setIdx] || ''}" placeholder="0" onfocus="this.select()">
               </label>
           </div>`
        : '';

    // Timed-isotonic with "None" logging: just confirm weight and tap next
    const timedNoneWaitingHTML = needsTimedNoneConfirm
        ? `<p class="timed-input-label">✅ Set complete! Update added weight, then tap Next Set.</p>`
        : '';

    // Isometric waiting-input: just confirm weight and tap next
    const isoWaitingHTML = (timerMode === 'waiting-input' && ex.type === 'isometric')
        ? `<p class="timed-input-label">✅ Hold complete! Update added weight, then tap Next Set.</p>`
        : '';

    // Previous accomplishment
    const prev = getPreviousAccomplishment(ex.name, setIdx);
    const prevHTML = prev
        ? `<div class="prev-accomplishment">
               <span class="prev-label">Last time (${prev.date})</span>
               <span class="prev-stats">
                   Target: ${prev.target} ${prev.unitLabel}
                   ${prev.weight !== null ? ` · Added: ${prev.weight} ${prev.weightUnit}` : ''}
                   ${prev.accomplished !== null ? ` · Logged: ${prev.accomplished} ${prev.accomplishedLabel}` : ''}
                   ${prev.setTimeSec !== null ? ` · Time: ${formatTime(prev.setTimeSec)}` : ''}
               </span>
           </div>`
        : `<div class="prev-accomplishment prev-none">No previous data for this set</div>`;

    // For countup exercises, Next Set also stops the timer — label changes
    const isCountup = timerMode === 'countup' || timerMode === 'paused-countup';
    const nextLabel = isCountup ? 'Done — Next Set →' : 'Next Set →';

    list.innerHTML = `
        <h3>${escHtml(ex.name)}</h3>
        <p class="goal-set-line">Set <span class="set-counter-num">${currentSet}/${ex.sets}</span> — ${goalText}</p>
        <p class="weight-inline">Body weight load: ${formatBodyWeightForce(ex)} &nbsp;—&nbsp; Added weight (${userSettings.weightUnit}): <input type="number" step="0.5" id="weight-input" value="${ex.weights[setIdx] || ''}" class="weight-inline-input"></p>
        ${timedInputHTML}
        <div class="set-btn-row">
            <button class="back-set-btn" onclick="prevSet()">${isFirst ? '✕' : '‹'}</button>
            ${isLastSet
                ? `<button class="complete-btn" onclick="completeWorkout()" ${!workoutInProgress ? 'disabled' : ''}>✅ Complete Workout</button>`
                : `<button class="next-set-btn" onclick="nextSet()" ${!workoutInProgress ? 'disabled' : ''}>${nextLabel}</button>`
            }
        </div>
        ${prevHTML}
    `;

    // Auto-focus timed input if shown
    if (needsTimedInput) {
        setTimeout(() => document.getElementById('timed-user-input')?.focus(), 120);
    }
}

function completeWorkout(silent = false) {
    const wo = workoutPlan[currentWorkoutIndex];
    if (!silent && !confirm(`Complete "${wo.name}"?\n\nThis will log your workout and advance to the next one.`)) return;

    // Capture last set data
    const lastEx = currentWorkout[currentExerciseIndex];
    if (lastEx) {
        const setIdx = currentSet - 1;
        lastEx.weights[setIdx] = parseFloat(document.getElementById('weight-input')?.value) || 0;

        // If countup was running, stop it and record time
        if (timerMode === 'countup' || timerMode === 'paused-countup') {
            const setTimeSec = setStartTime ? Math.round((Date.now() - setStartTime) / 1000) : timerElapsed;
            lastEx.setTimes[setIdx] = setTimeSec;
        }
        if (lastEx.type !== 'isometric' && (lastEx.unit === 'seconds' || lastEx.unit === 'minutes') && lastEx.timedInput !== 'none') {
            lastEx.userInputs[setIdx] = parseFloat(document.getElementById('timed-user-input')?.value) || 0;
        }

        // Final work accumulation for last set
        if (lastEx.phase === 'work') {
            const addedW     = lastEx.weights[setIdx];
            const setTimeSec = lastEx.setTimes[setIdx];
            let repsOrDist   = lastEx.type === 'isometric' ? 0
                : lastEx.unit === 'reps'   ? lastEx.target
                : lastEx.unit === 'meters' ? (lastEx.distanceM || lastEx.target)
                : lastEx.userInputs[setIdx];
            runningWorkTotal += calcSetWork(lastEx, addedW, repsOrDist, setTimeSec);
        }
    }

    syncElapsedDisplay();
    clearInProgressWorkout();

    // ── Phase 4: calculate per-exercise Work/Power and store in log ──
    // Only Work-phase exercises count toward workout totals.
    let workoutTotalWork   = 0;
    let workoutTotalPower  = 0;
    let workoutPowerCount  = 0;

    const loggedExercises = currentWorkout.map(ex => {
        const totals = calcExerciseTotals(ex);
        // Accumulate workout totals (Work phase only)
        if (ex.phase === 'work' && !totals.isIsometric) {
            workoutTotalWork  += totals.totalWork  || 0;
            if (totals.totalPower !== null) {
                workoutTotalPower += totals.totalPower;
                workoutPowerCount++;
            }
        }
        return {
            ...ex,
            totalWork:    totals.totalWork,
            totalPower:   totals.totalPower,
            totalTension: totals.totalTension,
            isIsometric:  totals.isIsometric
        };
    });

    progressLogs.push({
        date:             new Date(workoutStartTime || Date.now()).toISOString(),
        workoutName:      wo.name,
        workoutIndex:     currentWorkoutIndex,
        exercises:        loggedExercises,
        duration:         lapsedTime,
        weightUnit:       userSettings.weightUnit,
        heightUnit:       userSettings.heightUnit,
        workoutTotalWork: workoutTotalWork,
        workoutTotalPower: workoutPowerCount > 0 ? workoutTotalPower / workoutPowerCount : null
    });
    localStorage.setItem('progressLogs', JSON.stringify(progressLogs));

    clearInterval(lapsedTimerInterval);
    workoutStartTime  = null;
    workoutInProgress = false;
    runningWorkTotal  = 0;
    stopExerciseTimer();
    currentWorkoutIndex = (currentWorkoutIndex + 1) % workoutPlan.length;
    savePlan();
    switchTab('progress');
}

// ── Timer drawer (simplified for Phase 3) ────────────────────────
function openTimerDrawer() {
    updateSoundUI();
    document.getElementById('timer-settings-overlay').classList.add('open');
    document.getElementById('timer-settings-drawer').classList.add('open');
}

function closeTimerDrawer() {
    document.getElementById('timer-settings-overlay').classList.remove('open');
    document.getElementById('timer-settings-drawer').classList.remove('open');
}

function resetTimerFromDrawer() {
    clearInterval(timerInterval);
    timerInterval = null;
    setStartTime  = null;

    // Determine what state we're in and reset to its starting value, staying paused
    if (timerMode === 'rest' || timerMode === 'paused-rest') {
        timerRemaining = currentRestDuration;
        timerMode      = 'paused-rest';
    } else if (timerMode === 'countdown' || timerMode === 'paused-countdown') {
        timerRemaining = currentActiveDuration;
        timerMode      = 'paused-countdown';
    } else if (timerMode === 'countup' || timerMode === 'paused-countup') {
        timerElapsed = 0;
        timerMode    = 'paused-countup';
    } else {
        // idle / waiting-input — nothing meaningful to reset to; stay idle
        timerMode = 'idle';
    }

    updateHudTimerDisplay();
    closeTimerDrawer();
}


// ── CSV download helper ───────────────────────────────────────────
// iOS Safari in standalone PWA mode silently ignores a.click() on
// programmatically-created anchors. The workaround is to use a
// base64 data URL assigned to window.location.href — this works in
// standalone mode and in mobile Safari, and falls back gracefully
// in Chrome/Firefox where Blob URLs are fine.
function triggerCSVDownload(csvContent, filename) {
    try {
        // Preferred: Blob URL + visible anchor dispatched as a real click event
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.style.position = 'fixed';
        a.style.opacity  = '0';
        document.body.appendChild(a);
        a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);
    } catch (e) {
        // Fallback: data URL via window.location (no custom filename but always works)
        const encoded = encodeURIComponent(csvContent);
        window.location.href = 'data:text/csv;charset=utf-8,' + encoded;
    }
}

// ── CSV BACKUP & RESTORE ──────────────────────────────────────────
const CSV_HEADER = 'workout_index,workout_name,exercise_name,type,phase,sets,target,unit,bodyWeightPct,heightPct,distanceM,setRestSec,exerciseRestSec,timedInput,autoSequence';

function csvEscape(val) {
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function exportPlanCSV() {
    if (workoutPlan.length === 0) {
        alert('Nothing to export — your plan is empty.');
        return;
    }
    const rows = [CSV_HEADER];
    workoutPlan.forEach((wo, wIdx) => {
        if (wo.exercises.length === 0) {
            rows.push([csvEscape(wIdx), csvEscape(wo.name), '', '', '', '', '', '', '', '', '', '', '', '', ''].join(','));
        } else {
            wo.exercises.forEach(ex => {
                rows.push([
                    csvEscape(wIdx),
                    csvEscape(wo.name),
                    csvEscape(ex.name),
                    csvEscape(ex.type            || 'isotonic'),
                    csvEscape(ex.phase           || 'work'),
                    csvEscape(ex.sets),
                    csvEscape(ex.target),
                    csvEscape(ex.unit),
                    csvEscape(ex.bodyWeightPct   ?? 0),
                    csvEscape(ex.heightPct       ?? ''),
                    csvEscape(ex.distanceM       ?? ''),
                    csvEscape(ex.setRestSec      ?? 60),
                    csvEscape(ex.exerciseRestSec ?? 90),
                    csvEscape(ex.timedInput      || 'reps'),
                    csvEscape(ex.autoSequence    ? 'true' : 'false')
                ].join(','));
            });
        }
    });
    const csvContent = rows.join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerCSVDownload(csvContent, `workout-plan-${dateStr}.csv`);
}

function importPlanCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text  = e.target.result;
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) { alert('Import failed: empty file.'); return; }
            const header = lines[0].trim().toLowerCase();
            if (!header.startsWith('workout_index,workout_name')) {
                alert("Import failed: unexpected header.\nExpected: " + CSV_HEADER);
                return;
            }
            const parsed = {};
            lines.slice(1).forEach(line => {
                const cols = parseCSVLine(line);
                if (cols.length < 2) return;
                const wIdx            = cols[0].trim();
                const wName           = cols[1].trim();
                const exName          = (cols[2]  || '').trim();
                const type            = (cols[3]  || 'isotonic').trim() || 'isotonic';
                const phase           = (cols[4]  || 'work').trim()     || 'work';
                const sets            = parseInt(cols[5])   || 3;
                const target          = parseInt(cols[6])   || 10;
                const unit            = (cols[7]  || 'reps').trim()     || 'reps';
                const bodyWeightPct   = parseFloat(cols[8]) || 0;
                const heightPct       = cols[9]?.trim()  !== '' ? parseFloat(cols[9])  : null;
                const distanceM       = cols[10]?.trim() !== '' ? parseFloat(cols[10]) : null;
                const setRestSec      = parseInt(cols[11]) || 60;
                const exerciseRestSec = parseInt(cols[12]) || 90;
                const timedInput      = (cols[13]?.trim() || 'reps') || 'reps';
                const autoSequence    = (cols[14]?.trim() || 'false') === 'true';
                if (!parsed[wIdx]) parsed[wIdx] = { name: wName, exercises: [] };
                if (exName) {
                    parsed[wIdx].exercises.push({
                        name: exName, type, phase,
                        bodyWeightPct, heightPct, distanceM,
                        setRestSec, exerciseRestSec,
                        sets, target, unit, timedInput,
                        autoSequence, weights: []
                    });
                }
            });
            const importedPlan = Object.values(parsed);
            if (importedPlan.length === 0) { alert('Import failed: no workout data found.'); return; }
            const action = workoutPlan.length === 0 ? null
                : confirm(`Import ${importedPlan.length} workout(s)?\nThis will REPLACE your current plan.`);
            if (workoutPlan.length > 0 && !action) return;
            workoutPlan = importedPlan;
            currentWorkoutIndex = 0;
            savePlan(); loadPlan();
            alert(`✅ Imported ${importedPlan.length} workout(s) successfully!`);
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch   = line[i];
        const next = line[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') { current += '"'; i++; }
            else if (ch === '"')            { inQuotes = false; }
            else                            { current += ch; }
        } else {
            if      (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(current); current = ''; }
            else                 { current += ch; }
        }
    }
    result.push(current);
    return result;
}

// ── APP UPDATE ────────────────────────────────────────────────────
let swRegistration = null;

function setUpdateStatus(msg, isError = false) {
    const el = document.getElementById('update-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ff453a' : '#30d158';
}

function checkForUpdate() {
    if (!('serviceWorker' in navigator)) {
        setUpdateStatus('Service workers not supported in this browser.', true);
        return;
    }
    if (!swRegistration) {
        setUpdateStatus('Service worker not registered yet — try again.', true);
        return;
    }
    setUpdateStatus('Checking for update…');
    swRegistration.update().then(() => {
        const waiting    = swRegistration.waiting;
        const installing = swRegistration.installing;
        if (waiting) {
            activateWaitingSW(waiting);
        } else if (installing) {
            setUpdateStatus('Downloading update…');
            installing.addEventListener('statechange', () => {
                if (installing.state === 'installed') activateWaitingSW(swRegistration.waiting);
            });
        } else {
            setUpdateStatus('✓ Already up to date.');
            setTimeout(() => setUpdateStatus(''), 3000);
        }
    }).catch(err => setUpdateStatus('Update check failed: ' + err.message, true));
}

function activateWaitingSW(sw) {
    if (!sw) return;
    setUpdateStatus('Installing update…');
    sw.postMessage({ action: 'skipWaiting' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateStatus('Update ready — reloading…');
        window.location.reload();
    });
}

// ── SOUNDS ───────────────────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS suspends the AudioContext when another app takes the audio session.
    // Resume it immediately so sounds work after switching back from e.g. a podcast app.
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}

// Resume the AudioContext whenever the app returns to the foreground.
// iOS does not do this automatically, so sounds would stay silent without this.
function resumeAudioContext() {
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
}

function playWhistle() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
    } catch(e) {}
}

function playBuzzer() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        [0, 0.18].forEach(offset => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime + offset);
            osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + offset + 0.14);
            gain.gain.setValueAtTime(0.5, ctx.currentTime + offset);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + 0.14);
            osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.14);
        });
    } catch(e) {}
}

function playBeep() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
    updateSoundUI();
}

function updateSoundUI() {
    const btn = document.getElementById('sound-toggle-btn');
    if (!btn) return;
    btn.textContent = soundEnabled ? '🔔 Sound On' : '🔕 Sound Off';
    btn.className   = 'ts-order-toggle ' + (soundEnabled ? 'sound-on' : 'sound-off');
}

// ── PROGRESS CSV BACKUP & RESTORE ────────────────────────────────
const PROGRESS_CSV_HEADER = 'date,workout_name,duration_seconds,weight_unit,height_unit,workout_total_work,workout_total_power,exercise_name,type,phase,sets,target,unit,bodyWeightPct,heightPct,weights,timedInput,user_inputs,set_times,total_work,total_power,total_tension';

function exportProgressCSV() {
    if (progressLogs.length === 0) {
        alert('Nothing to export — no workouts have been logged yet.');
        return;
    }
    const rows = [PROGRESS_CSV_HEADER];
    progressLogs.forEach(log => {
        const date    = csvEscape(log.date || '');
        const woName  = csvEscape(log.workoutName || log.day || '');
        const dur     = csvEscape(log.duration || 0);
        const wu      = csvEscape(log.weightUnit || userSettings.weightUnit);
        const hu      = csvEscape(log.heightUnit || userSettings.heightUnit || 'in');
        const wkWork  = csvEscape(log.workoutTotalWork  ?? '');
        const wkPower = csvEscape(log.workoutTotalPower ?? '');
        if (!log.exercises || log.exercises.length === 0) {
            rows.push([date, woName, dur, wu, hu, wkWork, wkPower, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].join(','));
        } else {
            log.exercises.forEach(ex => {
                const weights    = Array.isArray(ex.weights)    ? ex.weights.join('|')    : '';
                const userInputs = Array.isArray(ex.userInputs) ? ex.userInputs.join('|') : '';
                const setTimes   = Array.isArray(ex.setTimes)   ? ex.setTimes.join('|')   : '';
                rows.push([
                    date, woName, dur, wu, hu, wkWork, wkPower,
                    csvEscape(ex.name),
                    csvEscape(ex.type          || 'isotonic'),
                    csvEscape(ex.phase         || 'work'),
                    csvEscape(ex.sets),
                    csvEscape(ex.target),
                    csvEscape(ex.unit || 'reps'),
                    csvEscape(ex.bodyWeightPct ?? 0),
                    csvEscape(ex.heightPct     ?? ''),
                    csvEscape(weights),
                    csvEscape(ex.timedInput    || 'reps'),
                    csvEscape(userInputs),
                    csvEscape(setTimes),
                    csvEscape(ex.totalWork     ?? ''),
                    csvEscape(ex.totalPower    ?? ''),
                    csvEscape(ex.totalTension  ?? '')
                ].join(','));
            });
        }
    });
    const csvContent = rows.join('\n');
    const dateStr  = new Date().toISOString().slice(0, 10);
    triggerCSVDownload(csvContent, `progress-log-${dateStr}.csv`);
}

function importProgressCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text  = e.target.result;
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) { alert('Import failed: empty file.'); return; }
            const header = lines[0].trim().toLowerCase();
            if (!header.startsWith('date,workout_name,duration_seconds')) {
                alert("Import failed: unexpected header.\nExpected: " + PROGRESS_CSV_HEADER);
                return;
            }
            // Detect format: old (14 cols), new (20 cols), or latest (21/22 cols with user_inputs / set_times)
            const isNewFormat    = header.includes('workout_total_work');
            const hasUserInputs  = header.includes('user_inputs');
            const hasSetTimes    = header.includes('set_times');
            const logMap = {}, logOrder = [];
            lines.slice(1).forEach(line => {
                const cols = parseCSVLine(line);
                let ci = 0;
                const date       = cols[ci++]?.trim() || '';
                const woName     = cols[ci++]?.trim() || '';
                const duration   = parseInt(cols[ci++]) || 0;
                const weightUnit = cols[ci++]?.trim() || userSettings.weightUnit;
                let heightUnit   = userSettings.heightUnit || 'in';
                let workoutTotalWork  = null;
                let workoutTotalPower = null;
                if (isNewFormat) {
                    heightUnit        = cols[ci++]?.trim() || heightUnit;
                    const ww = cols[ci++]?.trim(); workoutTotalWork  = ww  !== '' ? parseFloat(ww)  : null;
                    const wp = cols[ci++]?.trim(); workoutTotalPower = wp  !== '' ? parseFloat(wp)  : null;
                }
                const exName        = cols[ci++]?.trim() || '';
                const type          = cols[ci++]?.trim() || 'isotonic';
                const phase         = cols[ci++]?.trim() || 'work';
                const sets          = parseInt(cols[ci++]) || 0;
                const target        = parseInt(cols[ci++]) || 0;
                const unit          = cols[ci++]?.trim() || 'reps';
                const bodyWeightPct = parseFloat(cols[ci++]) || 0;
                const hpRaw = cols[ci++]?.trim(); const heightPct = hpRaw !== '' ? parseFloat(hpRaw) : null;
                const weightsRaw    = cols[ci++]?.trim() || '';
                const weights       = weightsRaw ? weightsRaw.split('|').map(Number) : [];
                const timedInput    = cols[ci++]?.trim() || 'reps';
                const userInputsRaw = hasUserInputs ? (cols[ci++]?.trim() || '') : '';
                const userInputs    = userInputsRaw ? userInputsRaw.split('|').map(Number) : [];
                const setTimesRaw   = hasSetTimes ? (cols[ci++]?.trim() || '') : '';
                const setTimes      = setTimesRaw ? setTimesRaw.split('|').map(Number) : [];
                let totalWork = null, totalPower = null, totalTension = null;
                if (isNewFormat) {
                    const tw = cols[ci++]?.trim(); totalWork    = tw !== '' ? parseFloat(tw) : null;
                    const tp = cols[ci++]?.trim(); totalPower   = tp !== '' ? parseFloat(tp) : null;
                    const tt = cols[ci++]?.trim(); totalTension = tt !== '' ? parseFloat(tt) : null;
                }
                const key = date + '||' + woName;
                if (!logMap[key]) {
                    logMap[key] = { date, workoutName: woName, duration, weightUnit, heightUnit,
                        workoutTotalWork, workoutTotalPower, exercises: [] };
                    logOrder.push(key);
                }
                if (exName) {
                    logMap[key].exercises.push({
                        name: exName, type, phase,
                        bodyWeightPct, heightPct,
                        sets, target, unit, timedInput, weights, userInputs, setTimes,
                        totalWork, totalPower, totalTension,
                        isIsometric: type === 'isometric'
                    });
                }
            });
            const imported = logOrder.map(k => logMap[k]);
            if (imported.length === 0) { alert('Import failed: no log entries found.'); return; }
            const action = progressLogs.length === 0 ? null
                : confirm(`Import ${imported.length} session(s)?\nThis will REPLACE your current progress log.`);
            if (progressLogs.length > 0 && !action) return;
            progressLogs = imported;
            localStorage.setItem('progressLogs', JSON.stringify(progressLogs));
            loadProgress();
            alert(`✅ Imported ${imported.length} session(s) successfully!`);
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ── PROGRESS TAB ─────────────────────────────────────────────────
let chartWorkout  = null;  // Chart.js instance for workout chart
let chartExercise = null;  // Chart.js instance for exercise chart

// Chart.js's built-in responsive handling relies on a window 'resize' event,
// but iOS Safari's orientation change frequently fires 'resize' before the
// layout has actually settled into the new orientation's dimensions (or,
// in standalone PWA mode, sometimes not at all). That leaves the progress
// charts sized for the previous orientation until the tab is revisited.
// Explicitly resize both charts a moment after orientation changes so they
// pick up the new container dimensions.
function resizeProgressCharts() {
    if (chartWorkout)  chartWorkout.resize();
    if (chartExercise) chartExercise.resize();
}

window.addEventListener('orientationchange', () => {
    setTimeout(resizeProgressCharts, 300);
});

// Fallback for browsers/WebViews that don't reliably fire 'orientationchange'
// — the (orientation: portrait) media query flips on every rotation too.
if (window.matchMedia) {
    const orientationQuery = window.matchMedia('(orientation: portrait)');
    const onOrientationQueryChange = () => setTimeout(resizeProgressCharts, 300);
    if (orientationQuery.addEventListener) {
        orientationQuery.addEventListener('change', onOrientationQueryChange);
    } else if (orientationQuery.addListener) {
        orientationQuery.addListener(onOrientationQueryChange); // older Safari
    }
}

function loadProgress() {
    renderProgressLog();
    renderProgressCharts();
}

function renderProgressLog() {
    const logDiv = document.getElementById('progress-log');
    logDiv.innerHTML = '';
    [...progressLogs].reverse().forEach(log => {
        const wu = log.weightUnit || userSettings.weightUnit;
        const unit = isMetric() ? 'J' : 'ft-lbf';
        const workLine = log.workoutTotalWork != null
            ? `<p class="prog-work-summary">💪 Work: <strong>${log.workoutTotalWork.toFixed(0)} ${unit}</strong>${log.workoutTotalPower != null ? `&nbsp;&nbsp;⚡ Power: <strong>${log.workoutTotalPower.toFixed(1)} ${unit}/s</strong>` : ''}</p>`
            : '';
        logDiv.innerHTML += `
            <div>
                <h4>${new Date(log.date).toLocaleDateString()} – ${escHtml(log.workoutName || log.day || '')} – ${formatTime(log.duration)}</h4>
                ${workLine}
                ${(log.exercises || []).filter(ex => ex.phase === 'work').map(ex => {
                    const wval = ex.isIsometric
                        ? (ex.totalTension != null ? `Tension: ${ex.totalTension.toFixed(0)} ${unit}·s` : '')
                        : (ex.totalWork    != null ? `Work: ${ex.totalWork.toFixed(0)} ${unit}` + (ex.totalPower != null ? ` · Power: ${ex.totalPower.toFixed(1)} ${unit}/s` : '') : '');
                    return `<p>${escHtml(ex.name)}: ${wval || ex.weights.join(', ') + ' ' + wu}</p>`;
                }).join('')}
            </div>`;
    });
}

// Build list of unique workout names from logs
function getWorkoutNames() {
    const seen = new Set();
    const names = [];
    progressLogs.forEach(log => {
        const n = log.workoutName || log.day || '';
        if (n && !seen.has(n)) { seen.add(n); names.push(n); }
    });
    return names;
}

// Build list of unique exercise names that appear in Work phase
function getWorkExerciseNames() {
    const seen = new Set();
    const names = [];
    progressLogs.forEach(log => {
        (log.exercises || []).forEach(ex => {
            if ((ex.phase || 'work') === 'work' && !seen.has(ex.name)) {
                seen.add(ex.name); names.push(ex.name);
            }
        });
    });
    return names;
}

function renderProgressCharts() {
    const container = document.getElementById('progress-charts-container');
    if (!container) return;

    const workoutNames  = getWorkoutNames();
    const exerciseNames = getWorkExerciseNames();

    // Default selections — workout chart defaults to "Total", exercise chart to first exercise of last workout
    const lastExName   = (() => {
        if (progressLogs.length === 0) return '';
        const lastLog = progressLogs[progressLogs.length - 1];
        const firstWorkEx = (lastLog.exercises || []).find(ex => (ex.phase || 'work') === 'work');
        return firstWorkEx ? firstWorkEx.name : (exerciseNames[0] || '');
    })();

    const woSel  = document.getElementById('prog-workout-select')?.value  || '__total__';
    const exSel  = document.getElementById('prog-exercise-select')?.value || lastExName;

    container.innerHTML = `
        <div class="prog-chart-block">
            <div class="prog-chart-header">
                <span class="prog-chart-title">📊 Workout: Work &amp; Power over Time</span>
                <select id="prog-workout-select" class="prog-select" onchange="renderProgressCharts()">
                    <option value="__total__" ${woSel === '__total__' ? 'selected' : ''}>All Workouts (Total)</option>
                    ${workoutNames.map(n => `<option value="${escHtml(n)}" ${n === woSel ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}
                    ${workoutNames.length === 0 ? '<option disabled>No workouts logged</option>' : ''}
                </select>
            </div>
            <div class="prog-chart-wrap">
                <canvas id="chart-workout" height="220"></canvas>
            </div>
        </div>
        <div class="prog-chart-block">
            <div class="prog-chart-header">
                <span class="prog-chart-title">🏋️ Exercise: Work &amp; Power over Time</span>
                <select id="prog-exercise-select" class="prog-select" onchange="renderProgressCharts()">
                    ${exerciseNames.map(n => `<option value="${escHtml(n)}" ${n === exSel ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}
                    ${exerciseNames.length === 0 ? '<option>No exercises logged</option>' : ''}
                </select>
            </div>
            <div class="prog-chart-wrap">
                <canvas id="chart-exercise" height="220"></canvas>
            </div>
        </div>
    `;

    renderWorkoutChart(woSel);
    renderExerciseChart(exSel);
}

function renderWorkoutChart(workoutName) {
    const canvas = document.getElementById('chart-workout');
    if (!canvas) return;

    const unit = isMetric() ? 'J' : 'ft-lbf';
    let labels, workData, powerData;

    let workoutNamesForTooltip = [];
    if (workoutName === '__total__') {
        // All workouts chronologically — each log entry is one data point
        const filtered = progressLogs.filter(log => log.workoutTotalWork != null);
        labels    = filtered.map(log => fmtDate(log.date));
        workData  = filtered.map(log => +(log.workoutTotalWork || 0).toFixed(1));
        powerData = filtered.map(log => log.workoutTotalPower != null ? +(log.workoutTotalPower).toFixed(2) : null);
        workoutNamesForTooltip = filtered.map(log => log.workoutName || log.day || '');
    } else {
        const filtered = progressLogs.filter(log =>
            (log.workoutName || log.day || '') === workoutName &&
            log.workoutTotalWork != null
        );
        labels    = filtered.map(log => fmtDate(log.date));
        workData  = filtered.map(log => +(log.workoutTotalWork || 0).toFixed(1));
        powerData = filtered.map(log => log.workoutTotalPower != null ? +(log.workoutTotalPower).toFixed(2) : null);
    }

    if (chartWorkout) chartWorkout.destroy();
    chartWorkout = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: `Total Work (${unit})`,
                    data: workData,
                    borderColor: '#30d158',
                    backgroundColor: 'rgba(48,209,88,0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.3,
                    yAxisID: 'yWork',
                    fill: true
                },
                {
                    label: `Avg Power (${unit}/s)`,
                    data: powerData,
                    borderColor: '#ff9f0a',
                    backgroundColor: 'rgba(255,159,10,0.08)',
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.3,
                    yAxisID: 'yPower',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#1c1c1e', font: { size: 12 } } },
                tooltip: { callbacks: {
                    title: ctx => {
                        const idx = ctx[0]?.dataIndex;
                        const dateLabel = ctx[0]?.label || '';
                        if (workoutNamesForTooltip.length && idx != null) {
                            return `${dateLabel} \u2014 ${workoutNamesForTooltip[idx]}`;
                        }
                        return dateLabel;
                    },
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '\u2014'}`
                }}
            },
            scales: {
                x:      { ticks: { color: '#636366', font: { size: 10 }, maxRotation: 45 }, grid: { color: '#e5e5ea' } },
                yWork:  { type: 'linear', position: 'left',  beginAtZero: true, ticks: { color: '#30d158' }, grid: { color: '#e5e5ea' }, title: { display: true, text: `Work (${unit})`, color: '#30d158' } },
                yPower: { type: 'linear', position: 'right', beginAtZero: true, ticks: { color: '#ff9f0a' }, grid: { drawOnChartArea: false }, title: { display: true, text: `Power (${unit}/s)`, color: '#ff9f0a' } }
            }
        }
    });
}

function renderExerciseChart(exerciseName) {
    const canvas = document.getElementById('chart-exercise');
    if (!canvas) return;

    // Gather per-exercise data points from all logs
    const points = [];
    progressLogs.forEach(log => {
        const ex = (log.exercises || []).find(e =>
            e.name === exerciseName && (e.phase || 'work') === 'work'
        );
        if (!ex) return;
        points.push({ date: fmtDate(log.date), ex });
    });

    const labels    = points.map(p => p.date);
    const isIso     = points.length > 0 && points[0].ex.isIsometric;
    const unit      = isMetric() ? 'J' : 'ft-lbf';

    const workData  = points.map(p =>
        isIso
            ? (p.ex.totalTension != null ? +p.ex.totalTension.toFixed(1) : null)
            : (p.ex.totalWork    != null ? +p.ex.totalWork.toFixed(1)    : null)
    );
    const powerData = isIso ? null : points.map(p =>
        p.ex.totalPower != null ? +p.ex.totalPower.toFixed(2) : null
    );

    const workLabel  = isIso ? `Tension Load (${unit}·s)` : `Total Work (${unit})`;
    const powerLabel = `Avg Power (${unit}/s)`;

    const datasets = [
        {
            label: workLabel,
            data: workData,
            borderColor: '#0a84ff',
            backgroundColor: 'rgba(10,132,255,0.1)',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'yWork',
            fill: true,
            spanGaps: true
        }
    ];

    const scales = {
        x:     { ticks: { color: '#636366', font: { size: 10 }, maxRotation: 45 }, grid: { color: '#e5e5ea' } },
        yWork: { type: 'linear', position: 'left', beginAtZero: true, ticks: { color: '#0a84ff' }, grid: { color: '#e5e5ea' }, title: { display: true, text: workLabel, color: '#0a84ff' } }
    };

    if (!isIso && powerData) {
        datasets.push({
            label: powerLabel,
            data: powerData,
            borderColor: '#ff453a',
            backgroundColor: 'rgba(255,69,58,0.08)',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'yPower',
            spanGaps: true
        });
        scales.yPower = { type: 'linear', position: 'right', beginAtZero: true, ticks: { color: '#ff453a' }, grid: { drawOnChartArea: false }, title: { display: true, text: powerLabel, color: '#ff453a' } };
    }

    if (chartExercise) chartExercise.destroy();
    chartExercise = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#1c1c1e', font: { size: 12 } } },
                tooltip: { callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '—'}`
                }}
            },
            scales
        }
    });
}

function getRandomColor() {
    return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')}`;
}

function formatTime(s) {
    const sec = Math.max(0, Math.round(s));
    return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
}

// Format a date string as M/D/YY (e.g. 6/23/26)
function fmtDate(isoStr) {
    const d = new Date(isoStr);
    const yy = String(d.getFullYear()).slice(-2);
    return `${d.getMonth() + 1}/${d.getDate()}/${yy}`;
}

// ── Settings TAB ─────────────────────────────────────────────────
function loadSettings() {
    document.getElementById('user-weight').value = userSettings.weight;
    document.getElementById('user-height').value = userSettings.height;
    document.getElementById('weight-unit').value = userSettings.weightUnit;
    const huEl = document.getElementById('height-unit');
    if (huEl) huEl.value = userSettings.heightUnit || 'in';
    updateSettingsWeightLabel();
    updateSettingsHeightLabel();
    renderCustomLibraryList();
}

// Render the list of existing custom exercises in the Settings panel
function renderCustomLibraryList() {
    const listEl = document.getElementById('custom-library-list');
    if (!listEl) return;
    const custom = (typeof loadCustomExercises === 'function') ? loadCustomExercises() : [];
    if (custom.length === 0) {
        listEl.innerHTML = '<p style="font-size:13px;color:#aeaeb2;font-style:italic;">No custom exercises yet.</p>';
        return;
    }
    listEl.innerHTML = `
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#8e8e93;margin:0 0 8px;">Your Custom Exercises</p>
        ${custom.map(e => `
            <div style="display:flex;align-items:center;justify-content:space-between;background:#f2f2f7;border-radius:10px;padding:10px 12px;margin-bottom:6px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:#1c1c1e;">${escHtml(e.name)}</span>
                    <span style="font-size:12px;color:#636366;margin-left:6px;">${e.category} · BW ${Math.round((e.bodyWeightPct||0)*100)}%${e.heightPct != null ? ` · H ${Math.round(e.heightPct*100)}%` : ''}</span>
                </div>
                <button onclick="deleteCustomLibraryEntry('${escHtml(e.name)}')" style="background:#ff453a;color:#fff;font-size:12px;padding:4px 10px;border:none;border-radius:8px;margin:0;cursor:pointer;">✕</button>
            </div>
        `).join('')}
    `;
}

// Save a custom exercise from the Settings panel form
function saveCustomLibraryFromSettings() {
    const name = document.getElementById('cl-name')?.value.trim();
    if (!name) { alert('Enter an exercise name.'); return; }
    const cat      = document.getElementById('cl-cat')?.value   || 'custom';
    const type     = document.getElementById('cl-type')?.value  || 'isotonic';
    const bwRaw    = parseFloat(document.getElementById('cl-bwpct')?.value);
    const hRaw     = document.getElementById('cl-hpct')?.value;
    const unit     = document.getElementById('cl-unit')?.value  || 'reps';
    const bwPct    = isNaN(bwRaw) ? 0 : Math.min(Math.max(bwRaw / 100, 0), 1);
    const hPct     = (hRaw !== '' && hRaw !== undefined && !isNaN(parseFloat(hRaw))) ? parseFloat(hRaw) / 100 : null;

    libraryAddCustom({ name, category: cat, type, bodyWeightPct: bwPct, heightPct: hPct, distanceM: null, unit, notes: 'Custom exercise' });
    // Clear form
    document.getElementById('cl-name').value  = '';
    document.getElementById('cl-bwpct').value = '0';
    document.getElementById('cl-hpct').value  = '';
    alert(`✅ "${name}" added to your custom library!`);
    renderCustomLibraryList();
}

function updateSettingsWeightLabel() {
    const unit = document.getElementById('weight-unit')?.value || userSettings.weightUnit;
    const lbl  = document.getElementById('weight-unit-label');
    if (lbl) lbl.textContent = unit === 'kg' ? 'kg' : 'lb';
}

function updateSettingsHeightLabel() {
    const unit = document.getElementById('height-unit')?.value || userSettings.heightUnit;
    const lbl  = document.getElementById('height-unit-label');
    if (lbl) lbl.textContent = unit === 'cm' ? 'cm' : 'in';
}

function saveSettings() {
    const weightVal  = parseFloat(document.getElementById('user-weight').value);
    const heightVal  = parseFloat(document.getElementById('user-height').value);
    const weightUnit = document.getElementById('weight-unit').value;
    const heightUnit = (document.getElementById('height-unit')?.value) || 'in';
    if (weightVal && weightVal <= 0) { alert('Please enter a positive body weight.'); return; }
    if (heightVal && heightVal <= 0) { alert('Please enter a positive height.'); return; }

    // Auto-convert the entered values if the unit changed, so the number stays correct
    // (e.g. user has 180 lb stored, switches dropdown to kg → convert to ~81.6 automatically)
    const prevWeightUnit = userSettings.weightUnit;
    const prevHeightUnit = userSettings.heightUnit;

    let newWeight = weightVal || '';
    let newHeight = heightVal || '';

    if (newWeight !== '' && weightUnit !== prevWeightUnit) {
        if (weightUnit === 'kg' && prevWeightUnit === 'lb') {
            newWeight = +(newWeight * 0.453592).toFixed(1);
        } else if (weightUnit === 'lb' && prevWeightUnit === 'kg') {
            newWeight = +(newWeight * 2.20462).toFixed(1);
        }
    }

    if (newHeight !== '' && heightUnit !== prevHeightUnit) {
        if (heightUnit === 'cm' && prevHeightUnit === 'in') {
            newHeight = +(newHeight * 2.54).toFixed(1);
        } else if (heightUnit === 'in' && prevHeightUnit === 'cm') {
            newHeight = +(newHeight / 2.54).toFixed(1);
        }
    }

    userSettings.weight     = newWeight;
    userSettings.height     = newHeight;
    userSettings.weightUnit = weightUnit;
    userSettings.heightUnit = heightUnit;
    localStorage.setItem('userSettings', JSON.stringify(userSettings));

    // Update input fields to show converted values
    if (newWeight !== '') document.getElementById('user-weight').value = newWeight;
    if (newHeight !== '') document.getElementById('user-height').value = newHeight;

    if (workoutInProgress) renderExercise();
    loadProgress();
    alert('Settings saved!');
}

// ── BOOT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Check for an interrupted workout before rendering any tab
    const wasRestored = restoreInProgressWorkout();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Resume Web Audio API context if iOS suspended it while another app played audio
            resumeAudioContext();
            // Re-check auto-complete each time app comes to foreground
            const raw = localStorage.getItem('inProgressWorkout');
            if (raw && !workoutInProgress) {
                restoreInProgressWorkout();
            } else if (raw && workoutInProgress) {
                // Already in progress — check if 3-hour threshold has now been crossed
                try {
                    const state = JSON.parse(raw);
                    if (Date.now() - state.lastActivityTime > AUTO_COMPLETE_MS) {
                        clearInProgressWorkout();
                        completeWorkout(true);
                        return;
                    }
                } catch(e) { clearInProgressWorkout(); }
            }
            if (workoutInProgress) {
                syncElapsedDisplay();
                startElapsedClock();
            }
        }
    });

    switchTab('calendar');
    // If a workout was restored, navigate straight to the workout tab
    if (wasRestored && workoutInProgress) switchTab('workout');
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
            swRegistration = reg;
            if (reg.waiting) setUpdateStatus('Update available — tap "Check for App Update" to apply.');
            reg.addEventListener('updatefound', () => {
                const newSW = reg.installing;
                newSW.addEventListener('statechange', () => {
                    if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                        setUpdateStatus('Update available — tap "Check for App Update" to apply.');
                    }
                });
            });
        })
        .catch(err => console.warn('Service Worker registration failed:', err));
}
