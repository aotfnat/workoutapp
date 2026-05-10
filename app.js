// app.js

// ── Data ────────────────────────────────────────────────────────
let workoutPlan         = JSON.parse(localStorage.getItem('workoutPlan'))      || [];
let currentWorkoutIndex = parseInt(localStorage.getItem('currentWorkoutIndex')) || 0;
let progressLogs        = JSON.parse(localStorage.getItem('progressLogs'))      || [];
if (currentWorkoutIndex >= workoutPlan.length) currentWorkoutIndex = 0;

// Active workout state
let currentWorkout       = [];
let currentExerciseIndex = 0;
let currentSet           = 1;
let lapsedTimerInterval  = null;
let lapsedTime           = 0;      // seconds elapsed (kept in sync for logging)
let workoutStartTime     = null;   // wall-clock ms when workout started (Date.now())
let workoutInProgress    = false;  // true once Start Workout is tapped

// ── Active/Rest timer state ───────────────────────────────────────
// Phase: 'active' | 'rest' | 'idle'
let timerPhase          = 'idle';
let timerInterval       = null;
let timerRemaining      = 0;
let selectedActiveDuration = 40;   // seconds
let selectedRestDuration   = 20;   // seconds
let timerOrder = 'active-first';   // 'active-first' | 'rest-first'

// Chart
let chartInstance = null;

// ── Navigation ───────────────────────────────────────────────────
let currentTab = 'calendar';

function switchTab(tabId) {
    // Do NOT clear the lapsed timer when leaving — let it keep running
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`${tabId}-section`).classList.add('active');
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    currentTab = tabId;
    toggleMenu(false);

    if (tabId === 'plan')     loadPlan();
    if (tabId === 'workout')  resumeWorkoutTab();
    if (tabId === 'progress') loadProgress();
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
function savePlanWithAlert() { savePlan(); alert('Plan saved!'); }

// ── PLAN TAB ─────────────────────────────────────────────────────

function loadPlan() {
    const container = document.getElementById('weekly-plan');
    container.innerHTML = '';

    if (workoutPlan.length === 0) {
        container.innerHTML = '<p class="plan-empty">No workouts yet. Tap "Add Workout" to get started.</p>';
        return;
    }

    workoutPlan.forEach((workout, wIdx) => {
        const card = document.createElement('div');
        card.className = 'day workout-card';
        card.setAttribute('draggable', 'true');
        card.dataset.index = wIdx;

        const isNext = wIdx === currentWorkoutIndex;
        if (isNext) card.classList.add('next-workout');

        card.innerHTML = `
            <div class="workout-card-header">
                <span class="drag-handle" title="Drag to reorder">⠿</span>
                <span class="workout-seq">#${wIdx + 1}</span>
                <input class="workout-name-input" type="text" value="${escHtml(workout.name)}"
                    onchange="updateWorkoutName(${wIdx}, this.value)" placeholder="Workout name">
                ${isNext
                    ? `<button class="next-badge-btn" onclick="advanceToWorkout(${wIdx})">▶ Next</button>`
                    : `<button class="set-next-btn"  onclick="advanceToWorkout(${wIdx})">Set Next</button>`}
                <button class="icon-btn danger" onclick="removeWorkout(${wIdx})" title="Remove">✕</button>
            </div>
            <div class="exercise-list" id="ex-list-${wIdx}"></div>
            <div class="card-actions">
                <button onclick="addExercise(${wIdx})">＋ Add Exercise</button>
            </div>
        `;

        const exList = card.querySelector(`#ex-list-${wIdx}`);
        workout.exercises.forEach((ex, eIdx) => {
            const unitLabel = { reps:'reps', seconds:'sec', minutes:'min', meters:'m' }[ex.unit] || 'reps';
            const row = document.createElement('div');
            row.className = 'exercise';
            row.innerHTML = `
                <input type="text" value="${escHtml(ex.name)}"
                    onchange="updateExercise(${wIdx}, ${eIdx}, 'name', this.value)" placeholder="Exercise">
                <label>Sets <input type="number" min="1" value="${ex.sets}"
                    onchange="updateExercise(${wIdx}, ${eIdx}, 'sets', this.value)"></label>
                <label>Target <input type="number" min="1" value="${ex.target}"
                    onchange="updateExercise(${wIdx}, ${eIdx}, 'target', this.value)"> ${unitLabel}</label>
                <button class="icon-btn danger" onclick="removeExercise(${wIdx}, ${eIdx})" title="Remove">✕</button>
            `;
            exList.appendChild(row);
        });

        container.appendChild(card);
    });

    initDragAndDrop();
}

// Advance the "next" pointer to the workout AFTER wIdx (wraps)
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

// ── Exercise entry modal ─────────────────────────────────────────
// Step flow: name → unit → target → sets → save
// Each step renders inside #ex-modal-body

let _exModal = {};   // working state across steps

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

// ── Step 1: Name ─────────────────────────────────────────────────
function addExercise(wIdx) {
    _exModal = { wIdx };
    exModalSetTitle('Exercise Name');
    exModalSetBody(`
        <input id="ex-name-input" class="ex-text-input" type="text"
               placeholder="e.g. Bench Press" autocomplete="off">
    `);
    exModalOpen();
    // Render a Next button in footer
    document.querySelector('.ex-modal-footer').innerHTML = `
        <button class="ex-modal-cancel" onclick="exModalCancel()">Cancel</button>
        <button class="ex-modal-next"   onclick="exModalStep2()">Next →</button>
    `;
    setTimeout(() => document.getElementById('ex-name-input')?.focus(), 120);
}

function exModalStep2() {
    const name = document.getElementById('ex-name-input')?.value.trim();
    if (!name) { document.getElementById('ex-name-input').focus(); return; }
    _exModal.name = name;

    // ── Step 2: Unit ─────────────────────────────────────────────
    exModalSetTitle('Unit');
    exModalSetBody(`
        <div class="ex-btn-grid ex-btn-grid-2">
            <button class="ex-choice-btn" onclick="exModalStep3('reps')">🔢 Reps</button>
            <button class="ex-choice-btn" onclick="exModalStep3('seconds')">⏱ Seconds</button>
            <button class="ex-choice-btn" onclick="exModalStep3('minutes')">⏱ Minutes</button>
            <button class="ex-choice-btn" onclick="exModalStep3('meters')">📏 Meters</button>
        </div>
    `);
    document.querySelector('.ex-modal-footer').innerHTML = `
        <button class="ex-modal-cancel" onclick="exModalCancel()">Cancel</button>
        <button class="ex-modal-back"   onclick="addExercise(_exModal.wIdx); _exModal.name = '${escHtml(name)}'" style="display:none"></button>
    `;
}

function exModalStep3(unit) {
    _exModal.unit = unit;

    // ── Step 3: Target quantity ───────────────────────────────────
    const presets = {
        reps:    [8, 10, 12, 15, 20],
        seconds: [10, 20, 30, 45, 60],
        minutes: [1, 2, 3, 5, 10],
        meters:  [400, 500, 800, 1600, 2400]
    };
    const unitLabel = { reps:'Reps', seconds:'Seconds', minutes:'Minutes', meters:'Meters' }[unit];
    const vals = presets[unit];

    exModalSetTitle(`Target — ${unitLabel}`);
    exModalSetBody(`
        <div class="ex-btn-grid ex-btn-grid-3">
            ${vals.map(v => `<button class="ex-choice-btn" onclick="exModalStep4(${v})">${v}</button>`).join('')}
            <button class="ex-choice-btn ex-manual-btn" onclick="exModalManualTarget()">✏️ Manual</button>
        </div>
        <div id="ex-manual-target-row" style="display:none; margin-top:14px;">
            <input id="ex-target-input" class="ex-num-input" type="number"
                   inputmode="numeric" pattern="[0-9]*" min="1" placeholder="Enter number">
            <button class="ex-modal-next" onclick="exModalStep4FromInput()">Next →</button>
        </div>
    `);
    document.querySelector('.ex-modal-footer').innerHTML = `
        <button class="ex-modal-cancel" onclick="exModalCancel()">Cancel</button>
    `;
}

function exModalManualTarget() {
    const row = document.getElementById('ex-manual-target-row');
    row.style.display = 'flex';
    document.getElementById('ex-target-input').focus();
}

function exModalStep4FromInput() {
    const val = parseInt(document.getElementById('ex-target-input')?.value);
    if (!val || val < 1) { document.getElementById('ex-target-input').focus(); return; }
    exModalStep4(val);
}

function exModalStep4(target) {
    _exModal.target = target;

    // ── Step 4: Sets ─────────────────────────────────────────────
    exModalSetTitle('Number of Sets');
    exModalSetBody(`
        <div class="ex-btn-grid ex-btn-grid-3">
            ${[1,2,3,4,5].map(v => `<button class="ex-choice-btn" onclick="exModalSave(${v})">${v}</button>`).join('')}
            <button class="ex-choice-btn ex-manual-btn" onclick="exModalManualSets()">✏️ Manual</button>
        </div>
        <div id="ex-manual-sets-row" style="display:none; margin-top:14px;">
            <input id="ex-sets-input" class="ex-num-input" type="number"
                   inputmode="numeric" pattern="[0-9]*" min="1" placeholder="Enter sets">
            <button class="ex-modal-next" onclick="exModalSaveFromInput()">Save ✓</button>
        </div>
    `);
    document.querySelector('.ex-modal-footer').innerHTML = `
        <button class="ex-modal-cancel" onclick="exModalCancel()">Cancel</button>
    `;
}

function exModalManualSets() {
    const row = document.getElementById('ex-manual-sets-row');
    row.style.display = 'flex';
    document.getElementById('ex-sets-input').focus();
}

function exModalSaveFromInput() {
    const val = parseInt(document.getElementById('ex-sets-input')?.value);
    if (!val || val < 1) { document.getElementById('ex-sets-input').focus(); return; }
    exModalSave(val);
}

function exModalSave(sets) {
    const { wIdx, name, unit, target } = _exModal;
    workoutPlan[wIdx].exercises.push({ name, sets, target, unit, weights: [] });
    savePlan();
    exModalClose();
    loadPlan();
}

function addExercise(wIdx) {
    _exModal = { wIdx };
    exModalSetTitle('Exercise Name');
    exModalSetBody(`
        <input id="ex-name-input" class="ex-text-input" type="text"
               placeholder="e.g. Bench Press" autocomplete="off">
    `);
    exModalOpen();
    document.querySelector('.ex-modal-footer').innerHTML = `
        <button class="ex-modal-cancel" onclick="exModalCancel()">Cancel</button>
        <button class="ex-modal-next"   onclick="exModalStep2()">Next →</button>
    `;
    setTimeout(() => document.getElementById('ex-name-input')?.focus(), 120);
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
    dragSrcIndex = null;
}

let touchDragCard = null, touchClone = null, touchOffsetY = 0;

function onTouchStart(e) {
    const handle = e.currentTarget;
    touchDragCard = handle.closest('.workout-card');
    dragSrcIndex  = parseInt(touchDragCard.dataset.index);
    const rect = touchDragCard.getBoundingClientRect();
    touchOffsetY = e.touches[0].clientY - rect.top;
    touchClone = touchDragCard.cloneNode(true);
    touchClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;opacity:0.85;z-index:9999;pointer-events:none;border:2px solid #30d158;border-radius:14px;background:#2c2c2e;`;
    document.body.appendChild(touchClone);
    touchDragCard.classList.add('dragging');
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
    touchDragCard = null; dragSrcIndex = null;
    loadPlan();
}

// ── WORKOUT TAB ───────────────────────────────────────────────────

// Called on first visit or after completing/resetting a workout
function loadWorkoutTab() {
    if (workoutPlan.length === 0) {
        document.getElementById('exercise-list').innerHTML =
            '<p style="color:#636366;text-align:center;padding:24px 0;">No workouts in your plan yet. Open the menu and go to Plan.</p>';
        return;
    }
    const wo = workoutPlan[currentWorkoutIndex];
    currentWorkout = JSON.parse(JSON.stringify(wo.exercises));
    currentWorkout.forEach(ex => ex.weights = new Array(ex.sets).fill(0));
    currentExerciseIndex = 0;
    currentSet        = 1;
    lapsedTime        = 0;
    workoutStartTime  = null;
    workoutInProgress = false;
    document.getElementById('lapsed-time').textContent = formatTime(0);
    clearInterval(lapsedTimerInterval);
    stopTimer();
    resetTimerDisplay();
    renderExercise();
    showStartButton();
}

// Called every time the user navigates back to the workout tab
function resumeWorkoutTab() {
    if (!workoutInProgress) {
        // No workout started yet — fresh load
        loadWorkoutTab();
        return;
    }
    // Workout is running — just re-sync the display, don't reset anything
    syncElapsedDisplay();
    renderExercise();
    updateHudTimer();
}

function showStartButton() {
    // Remove any existing button first to avoid duplicates
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
    startElapsedClock();
}

// Start (or restart) the display-update interval using wall-clock time
function startElapsedClock() {
    clearInterval(lapsedTimerInterval);
    lapsedTimerInterval = setInterval(syncElapsedDisplay, 1000);
}

// Compute elapsed from wall clock — accurate after backgrounding
function syncElapsedDisplay() {
    if (!workoutStartTime) return;
    lapsedTime = Math.floor((Date.now() - workoutStartTime) / 1000);
    const el = document.getElementById('lapsed-time');
    if (el) el.textContent = formatTime(lapsedTime);
}

function renderExercise() {
    const list = document.getElementById('exercise-list');
    list.innerHTML = '';

    if (currentExerciseIndex >= currentWorkout.length) {
        list.innerHTML = '<p class="workout-complete">Workout Complete! 🎉</p>';
        clearInterval(lapsedTimerInterval);
        return;
    }

    const ex = currentWorkout[currentExerciseIndex];
    const goalLabels = { reps:`Reps: ${ex.target}`, seconds:`Time: ${ex.target}s`,
                         minutes:`Time: ${ex.target} min`, meters:`Distance: ${ex.target}m` };
    const goalText = goalLabels[ex.unit] || `Target: ${ex.target}`;

    const isFirst = currentExerciseIndex === 0 && currentSet === 1;

    list.innerHTML = `
        <h3>${escHtml(ex.name)} – Set ${currentSet}/${ex.sets}</h3>
        <p class="goal-text">${goalText}</p>
        <label>Weight (kg/lb):
            <input type="number" step="0.5" id="weight-input" value="${ex.weights[currentSet-1] || ''}">
        </label>
        <div class="set-btn-row">
            <button class="back-set-btn" onclick="prevSet()">${isFirst ? '✕' : '‹'}</button>
            <button class="next-set-btn" onclick="nextSet()">Next Set / Done</button>
        </div>
    `;
}

function nextSet() {
    const ex = currentWorkout[currentExerciseIndex];
    ex.weights[currentSet-1] = parseFloat(document.getElementById('weight-input')?.value) || 0;
    if (currentSet < ex.sets) { currentSet++; } else { currentExerciseIndex++; currentSet = 1; }
    renderExercise();
    // Auto-start fresh Active phase after each set
    startFreshActivePhase();
}

function prevSet() {
    // At the very first set of the first exercise — cancel the workout
    if (currentExerciseIndex === 0 && currentSet === 1) {
        lapsedTime        = 0;   // zero before clearing interval to block any stale tick
        workoutStartTime  = null;
        workoutInProgress = false;
        clearInterval(lapsedTimerInterval);
        stopTimer();
        resetTimerDisplay();
        document.getElementById('lapsed-time').textContent = formatTime(0);
        renderExercise();
        showStartButton();
        return;
    }
    // Go back one set, or to the last set of the previous exercise
    if (currentSet > 1) {
        currentSet--;
    } else {
        currentExerciseIndex--;
        currentSet = currentWorkout[currentExerciseIndex].sets;
    }
    renderExercise();
}

function completeWorkout() {
    syncElapsedDisplay(); // ensure lapsedTime is accurate before logging
    const wo = workoutPlan[currentWorkoutIndex];
    progressLogs.push({
        date: new Date().toISOString(),
        workoutName: wo.name,
        workoutIndex: currentWorkoutIndex,
        exercises: currentWorkout,
        duration: lapsedTime
    });
    localStorage.setItem('progressLogs', JSON.stringify(progressLogs));
    clearInterval(lapsedTimerInterval);
    workoutStartTime  = null;
    workoutInProgress = false;
    stopTimer();
    currentWorkoutIndex = (currentWorkoutIndex + 1) % workoutPlan.length;
    savePlan();
    alert(`"${wo.name}" logged! Next up: "${workoutPlan[currentWorkoutIndex].name}"`);
    loadWorkoutTab();
}

// ── ACTIVE / REST TIMER ───────────────────────────────────────────
//
// timerPhase values:
//   'idle'          – not started / fully reset
//   'active'        – active countdown running
//   'rest'          – rest countdown running
//   'paused-active' – active countdown paused mid-way
//   'paused-rest'   – rest countdown paused mid-way
//
// timerRemaining always holds the current seconds left so resuming is exact.

function resetTimerDisplay() {
    clearInterval(timerInterval);
    timerInterval  = null;
    timerPhase     = 'idle';
    timerRemaining = selectedActiveDuration;
    updateHudTimer();
}

function updateHudTimer() {
    const el    = document.getElementById('timer');
    const label = document.getElementById('timer-phase-label');
    if (!el) return;
    el.textContent = formatTime(timerRemaining);
    updateComboBtn();

    el.className = 'hud-time';
    if (timerPhase === 'active' || timerPhase === 'paused-active') {
        el.classList.add('timer-active');
        if (timerPhase === 'paused-active') el.classList.add('paused');
        if (label) { label.textContent = '🔥 Active'; label.className = 'hud-label timer-label-active'; }
    } else if (timerPhase === 'rest' || timerPhase === 'paused-rest') {
        el.classList.add('timer-rest');
        if (timerRemaining <= 10) el.classList.add('low');
        if (timerPhase === 'paused-rest') el.classList.add('paused');
        if (label) { label.textContent = '😮‍💨 Rest'; label.className = 'hud-label timer-label-rest'; }
    } else {
        // idle
        if (label) { label.textContent = '🔥 Active'; label.className = 'hud-label'; }
    }
}

// Always start fresh from the full duration, respecting timerOrder
function startFreshActivePhase() {
    clearInterval(timerInterval);
    timerInterval  = null;
    timerPhase     = 'idle';
    if (timerOrder === 'rest-first') {
        timerRemaining = selectedRestDuration;
        startRestPhaseFirst();
    } else {
        timerRemaining = selectedActiveDuration;
        startActivePhase();
    }
}

// Rest-first variant: runs rest then active
function startRestPhaseFirst() {
    timerPhase     = 'rest';
    timerRemaining = selectedRestDuration;
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            startActivePhaseFromZero();
        }
    }, 1000);
}

// Active phase that follows rest (rest-first order)
function startActivePhaseFromZero() {
    timerPhase     = 'active';
    timerRemaining = selectedActiveDuration;
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval  = null;
            timerPhase     = 'idle';
            timerRemaining = selectedRestDuration;
            updateHudTimer();
        }
    }, 1000);
}

// Start active phase — resets to full duration always (use resumeTimer to resume)
function startActivePhase() {
    clearInterval(timerInterval);
    timerRemaining = selectedActiveDuration;
    timerPhase = 'active';
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            startRestPhaseFromZero();
        }
    }, 1000);
}

// Always starts rest from full rest duration (auto-transition from active)
function startRestPhaseFromZero() {
    timerPhase     = 'rest';
    timerRemaining = selectedRestDuration;
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval  = null;
            timerPhase     = 'idle';
            timerRemaining = selectedActiveDuration;
            updateHudTimer();
        }
    }, 1000);
}

// Resume from wherever timerRemaining currently is (used by portrait ▶ and combo ▶)
function resumeTimer() {
    clearInterval(timerInterval);
    const phase = timerPhase === 'paused-active' ? 'active' : 'rest';
    timerPhase = phase;
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            if (timerOrder === 'active-first') {
                // active → rest → idle
                if (phase === 'active') {
                    startRestPhaseFromZero();
                } else {
                    timerPhase     = 'idle';
                    timerRemaining = selectedActiveDuration;
                    updateHudTimer();
                }
            } else {
                // rest → active → idle
                if (phase === 'rest') {
                    startActivePhaseFromZero();
                } else {
                    timerPhase     = 'idle';
                    timerRemaining = selectedRestDuration;
                    updateHudTimer();
                }
            }
        }
    }, 1000);
}

// Pause — preserve phase and remaining time
function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    if (timerPhase === 'active') timerPhase = 'paused-active';
    if (timerPhase === 'rest')   timerPhase = 'paused-rest';
    updateComboBtn();
    updateHudTimer();
}

// Legacy stopTimer used elsewhere — now just pauses
function stopTimer() {
    pauseTimer();
}

// ── Timer settings side drawer ────────────────────────────────────

function openTimerDrawer() {
    document.getElementById('active-duration-val').textContent = selectedActiveDuration;
    document.getElementById('rest-duration-val').textContent   = selectedRestDuration;
    updateTimerOrderUI();
    document.getElementById('timer-settings-overlay').classList.add('open');
    document.getElementById('timer-settings-drawer').classList.add('open');
}

function toggleTimerOrder() {
    timerOrder = timerOrder === 'active-first' ? 'rest-first' : 'active-first';
    updateTimerOrderUI();
    // Reset display so HUD shows the correct first-phase label
    if (timerPhase === 'idle') {
        timerRemaining = timerOrder === 'active-first' ? selectedActiveDuration : selectedRestDuration;
        updateHudTimer();
    }
}

function updateTimerOrderUI() {
    const label  = document.getElementById('timer-order-label');
    const toggle = document.getElementById('timer-order-toggle');
    if (!label || !toggle) return;
    if (timerOrder === 'active-first') {
        label.textContent = '🔥 Active → 😮‍💨 Rest';
        toggle.classList.remove('order-rest-first');
        toggle.classList.add('order-active-first');
    } else {
        label.textContent = '😮‍💨 Rest → 🔥 Active';
        toggle.classList.remove('order-active-first');
        toggle.classList.add('order-rest-first');
    }
}

function closeTimerDrawer() {
    document.getElementById('timer-settings-overlay').classList.remove('open');
    document.getElementById('timer-settings-drawer').classList.remove('open');
}

function stepDuration(type, delta) {
    const STEP = 5, MIN = 5, MAX = 600;
    if (type === 'active') {
        selectedActiveDuration = Math.min(MAX, Math.max(MIN, selectedActiveDuration + delta));
        document.getElementById('active-duration-val').textContent = selectedActiveDuration;
    } else {
        selectedRestDuration = Math.min(MAX, Math.max(MIN, selectedRestDuration + delta));
        document.getElementById('rest-duration-val').textContent = selectedRestDuration;
    }
    // If idle, update display to reflect the first-phase duration
    if (timerPhase === 'idle') {
        timerRemaining = timerOrder === 'active-first' ? selectedActiveDuration : selectedRestDuration;
        updateHudTimer();
    }
}


// ── CSV BACKUP & RESTORE ──────────────────────────────────────────

// CSV columns: workout_index, workout_name, exercise_name, sets, target, unit
const CSV_HEADER = 'workout_index,workout_name,exercise_name,sets,target,unit';

function csvEscape(val) {
    // Wrap in quotes if value contains comma, quote, or newline
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
            // Export the workout shell even if it has no exercises
            rows.push([csvEscape(wIdx), csvEscape(wo.name), '', '', '', ''].join(','));
        } else {
            wo.exercises.forEach(ex => {
                rows.push([
                    csvEscape(wIdx),
                    csvEscape(wo.name),
                    csvEscape(ex.name),
                    csvEscape(ex.sets),
                    csvEscape(ex.target),
                    csvEscape(ex.unit)
                ].join(','));
            });
        }
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);

    // Build a filename with today's date
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `workout-plan-${dateStr}.csv`;

    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function importPlanCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset the input so the same file can be re-imported if needed
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text  = e.target.result;
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

            if (lines.length < 2) {
                alert('Import failed: the file appears to be empty or has no data rows.');
                return;
            }

            // Validate header
            const header = lines[0].trim().toLowerCase();
            if (!header.startsWith('workout_index,workout_name')) {
                alert("Import failed: this doesn't look like a workout plan CSV.\nExpected header: " + CSV_HEADER);
                return;
            }

            // Parse rows
            const parsed = {};  // keyed by workout_index → { name, exercises[] }
            const dataLines = lines.slice(1);

            for (let i = 0; i < dataLines.length; i++) {
                const cols = parseCSVLine(dataLines[i]);
                if (cols.length < 2) continue;

                const wIdx      = cols[0].trim();
                const wName     = cols[1].trim();
                const exName    = (cols[2] || '').trim();
                const sets      = parseInt(cols[3]) || 3;
                const target    = parseInt(cols[4]) || 10;
                const unit      = (cols[5] || 'reps').trim() || 'reps';

                if (!parsed[wIdx]) {
                    parsed[wIdx] = { name: wName, exercises: [] };
                }
                if (exName) {
                    parsed[wIdx].exercises.push({ name: exName, sets, target, unit, weights: [] });
                }
            }

            const importedPlan = Object.values(parsed);
            if (importedPlan.length === 0) {
                alert('Import failed: no valid workout data found in the file.');
                return;
            }

            // Confirm before overwriting
            const action = workoutPlan.length === 0
                ? null   // nothing to overwrite — skip confirm
                : confirm(
                    `Import ${importedPlan.length} workout(s) from "${file.name}"?\n\n` +
                    `This will REPLACE your current plan (${workoutPlan.length} workout(s)).\n\n` +
                    'Tap OK to replace, or Cancel to abort.'
                  );

            if (workoutPlan.length > 0 && !action) return;

            workoutPlan = importedPlan;
            currentWorkoutIndex = 0;
            savePlan();
            loadPlan();
            alert(`✅ Imported ${importedPlan.length} workout(s) successfully!`);

        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Minimal RFC 4180 CSV line parser (handles quoted fields with commas/newlines)
function parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch   = line[i];
        const next = line[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') { current += '"'; i++; }   // escaped quote
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


// Portrait ▶ Start: resume if paused, fresh start if idle
function portraitStart() {
    const paused = timerPhase === 'paused-active' || timerPhase === 'paused-rest';
    if (paused) {
        resumeTimer();
    } else {
        startActivePhase();   // idle or completed — fresh start
    }
}

// ── Landscape combo button ────────────────────────────────────────
// idle      → ▶ orange  → tap → start fresh active phase
// running   → ⏹ red     → tap → pause, preserve remaining
// paused    → ↺ grey    → tap → reset to programmed start time

function updateComboBtn() {
    const btn = document.getElementById('hud-combo-btn');
    if (!btn) return;
    const running = timerInterval !== null;
    const paused  = timerPhase === 'paused-active' || timerPhase === 'paused-rest';

    if (timerPhase === 'idle') {
        btn.textContent = '▶';
        btn.className   = 'combo-start';
    } else if (running) {
        btn.textContent = '⏹';
        btn.className   = 'combo-stop';
    } else if (paused) {
        btn.textContent = '↺';
        btn.className   = 'combo-reset';
    } else {
        btn.textContent = '▶';
        btn.className   = 'combo-start';
    }
}

function hudComboAction() {
    const running = timerInterval !== null;
    const paused  = timerPhase === 'paused-active' || timerPhase === 'paused-rest';

    if (timerPhase === 'idle') {
        startActivePhase();          // fresh start
    } else if (running) {
        pauseTimer();                // pause, keep remaining
    } else if (paused) {
        resetTimerDisplay();         // reset to programmed start time
    }
}



// ── APP UPDATE ────────────────────────────────────────────────────
// Asks the service worker to check for a new version.
// localStorage (plan + progress) is never touched — only cached files refresh.

let swRegistration = null;   // set during boot

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

    // Ask the SW to re-fetch its own script and compare
    swRegistration.update().then(() => {
        const waiting  = swRegistration.waiting;
        const installing = swRegistration.installing;

        if (waiting) {
            // A new SW is already waiting — activate it now
            activateWaitingSW(waiting);
        } else if (installing) {
            // A new SW is currently installing — wait for it to finish
            setUpdateStatus('Downloading update…');
            installing.addEventListener('statechange', () => {
                if (installing.state === 'installed') {
                    activateWaitingSW(swRegistration.waiting);
                }
            });
        } else {
            setUpdateStatus('✓ Already up to date.');
            setTimeout(() => setUpdateStatus(''), 3000);
        }
    }).catch(err => {
        setUpdateStatus('Update check failed: ' + err.message, true);
    });
}

function activateWaitingSW(sw) {
    if (!sw) return;
    setUpdateStatus('Installing update…');
    // Tell the waiting SW to skip waiting and take control
    sw.postMessage({ action: 'skipWaiting' });
    // Reload once the new SW has claimed this client
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateStatus('Update ready — reloading…');
        window.location.reload();
    });
}

// ── PROGRESS CSV BACKUP & RESTORE ────────────────────────────────
// Columns: date, workout_name, duration_seconds, exercise_name, sets, target, unit, weights
// weights is pipe-separated (e.g. "10|10|12") since it's an array per set

const PROGRESS_CSV_HEADER = 'date,workout_name,duration_seconds,exercise_name,sets,target,unit,weights';

function exportProgressCSV() {
    if (progressLogs.length === 0) {
        alert('Nothing to export — no workouts have been logged yet.');
        return;
    }

    const rows = [PROGRESS_CSV_HEADER];
    progressLogs.forEach(log => {
        const date     = csvEscape(log.date || '');
        const woName   = csvEscape(log.workoutName || log.day || '');
        const duration = csvEscape(log.duration || 0);

        if (!log.exercises || log.exercises.length === 0) {
            // Log with no exercises — still export the session row
            rows.push([date, woName, duration, '', '', '', '', ''].join(','));
        } else {
            log.exercises.forEach(ex => {
                const weights = Array.isArray(ex.weights) ? ex.weights.join('|') : '';
                rows.push([
                    date,
                    woName,
                    duration,
                    csvEscape(ex.name),
                    csvEscape(ex.sets),
                    csvEscape(ex.target),
                    csvEscape(ex.unit || 'reps'),
                    csvEscape(weights)
                ].join(','));
            });
        }
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `progress-log-${dateStr}.csv`;

    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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

            if (lines.length < 2) {
                alert('Import failed: the file appears to be empty or has no data rows.');
                return;
            }

            const header = lines[0].trim().toLowerCase();
            if (!header.startsWith('date,workout_name')) {
                alert("Import failed: this doesn't look like a progress log CSV.\nExpected header: " + PROGRESS_CSV_HEADER);
                return;
            }

            // Group rows back into log entries keyed by date+workout_name
            const logMap = {};   // key: "date||workout_name"
            const logOrder = []; // preserve insertion order

            lines.slice(1).forEach(line => {
                const cols       = parseCSVLine(line);
                const date       = cols[0]?.trim() || '';
                const woName     = cols[1]?.trim() || '';
                const duration   = parseInt(cols[2]) || 0;
                const exName     = cols[3]?.trim() || '';
                const sets       = parseInt(cols[4]) || 0;
                const target     = parseInt(cols[5]) || 0;
                const unit       = cols[6]?.trim() || 'reps';
                const weightsRaw = cols[7]?.trim() || '';
                const weights    = weightsRaw ? weightsRaw.split('|').map(Number) : [];

                const key = date + '||' + woName;
                if (!logMap[key]) {
                    logMap[key] = { date, workoutName: woName, duration, exercises: [] };
                    logOrder.push(key);
                }
                if (exName) {
                    logMap[key].exercises.push({ name: exName, sets, target, unit, weights });
                }
            });

            const imported = logOrder.map(k => logMap[k]);
            if (imported.length === 0) {
                alert('Import failed: no valid log entries found in the file.');
                return;
            }

            const action = progressLogs.length === 0
                ? null
                : confirm(
                    `Import ${imported.length} session(s) from "${file.name}"?\n\n` +
                    `This will REPLACE your current progress log (${progressLogs.length} session(s)).\n\n` +
                    'Tap OK to replace, or Cancel to abort.'
                  );

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

function loadProgress() {
    const logDiv = document.getElementById('progress-log');
    logDiv.innerHTML = '';
    progressLogs.forEach(log => {
        logDiv.innerHTML += `
            <div>
                <h4>${new Date(log.date).toLocaleDateString()} – ${log.workoutName || log.day || ''} – ${formatTime(log.duration)}</h4>
                ${log.exercises.map(ex => `<p>${escHtml(ex.name)}: ${ex.weights.join(', ')} kg</p>`).join('')}
            </div>`;
    });
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('progress-chart').getContext('2d');
    const data = {};
    progressLogs.forEach(log => {
        log.exercises.forEach(ex => {
            if (!data[ex.name]) data[ex.name] = [];
            const avg = ex.weights.length ? ex.weights.reduce((a,b)=>a+b,0)/ex.weights.length : 0;
            data[ex.name].push({ date: log.date, avg });
        });
    });
    const datasets = Object.keys(data).map(name => ({
        label: name,
        data:  data[name].map(d => ({ x: d.date, y: d.avg })),
        borderColor: getRandomColor(), fill: false
    }));
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line', data: { datasets },
        options: { scales: { x: { type:'time', time:{ unit:'day' } }, y: { beginAtZero:true } } }
    });
}

function getRandomColor() {
    return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')}`;
}

function formatTime(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// ── BOOT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // When the app comes back to the foreground, resync the elapsed display
    // immediately (the interval may have been throttled while backgrounded)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && workoutInProgress) {
            syncElapsedDisplay();
            // Restart the display interval in case it was killed
            startElapsedClock();
        }
    });

    resetTimerDisplay();
    switchTab('calendar');
});

// ── Service worker registration (outside DOMContentLoaded is fine) ──
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
            swRegistration = reg;

            // If a new SW is already waiting when we load, surface it
            if (reg.waiting) {
                setUpdateStatus('Update available — tap "Check for App Update" to apply.');
            }

            // Listen for a SW that finishes installing after page load
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
