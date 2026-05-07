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

    // Floating ☰ button is redundant on workout tab (HUD has its own)
    const floatBtn = document.getElementById('floating-menu-btn');
    if (floatBtn) floatBtn.style.display = tabId === 'workout' ? 'none' : 'flex';

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

function addExercise(wIdx) {
    const name = prompt('Exercise name:')?.trim();
    if (!name) return;
    const unit = prompt('Unit?\n1 = reps\n2 = seconds\n3 = minutes\n4 = meters\nEnter 1-4:');
    let selectedUnit;
    switch (unit?.trim()) {
        case '1': selectedUnit = 'reps';    break;
        case '2': selectedUnit = 'seconds'; break;
        case '3': selectedUnit = 'minutes'; break;
        case '4': selectedUnit = 'meters';  break;
        default:  selectedUnit = 'reps'; alert("Defaulting to reps.");
    }
    const defaults = { reps:'10', seconds:'30', minutes:'3', meters:'400' };
    const targetValue = parseInt(prompt(`Target ${selectedUnit}:`, defaults[selectedUnit])) || parseInt(defaults[selectedUnit]);
    const sets = parseInt(prompt('Number of sets:', '3')) || 3;
    workoutPlan[wIdx].exercises.push({ name, sets, target: targetValue, unit: selectedUnit, weights: [] });
    savePlan(); loadPlan();
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
    const list = document.getElementById('exercise-list');
    if (currentExerciseIndex === 0 && currentSet === 1 && lapsedTime === 0) {
        const btn = document.createElement('button');
        btn.id        = 'start-workout-btn';
        btn.className = 'start-workout-btn';
        btn.textContent = '▶ Start Workout';
        btn.onclick = startWorkout;
        list.prepend(btn);
    }
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

    list.innerHTML = `
        <h3>${escHtml(ex.name)} – Set ${currentSet}/${ex.sets}</h3>
        <p>${goalText}</p>
        <label>Weight (kg/lb):
            <input type="number" step="0.5" id="weight-input" value="${ex.weights[currentSet-1] || ''}">
        </label>
        <button onclick="nextSet()">Next Set / Done</button>
    `;
}

function nextSet() {
    const ex = currentWorkout[currentExerciseIndex];
    ex.weights[currentSet-1] = parseFloat(document.getElementById('weight-input')?.value) || 0;
    if (currentSet < ex.sets) { currentSet++; } else { currentExerciseIndex++; currentSet = 1; }
    renderExercise();
    // Auto-start Active phase after each set
    startActivePhase();
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

function resetTimerDisplay() {
    timerPhase = 'idle';
    timerRemaining = selectedActiveDuration;
    updateHudTimer();
}

function updateHudTimer() {
    const el    = document.getElementById('timer');
    const label = document.getElementById('timer-phase-label');
    el.textContent = formatTime(timerRemaining);

    // Phase colours
    el.className = 'hud-time';
    if (timerPhase === 'active') {
        el.classList.add('timer-active');
        if (label) { label.textContent = '🔥 Active'; label.className = 'hud-label timer-label-active'; }
    } else if (timerPhase === 'rest') {
        el.classList.add('timer-rest');
        if (timerRemaining <= 10) el.classList.add('low');
        if (label) { label.textContent = '😮‍💨 Rest'; label.className = 'hud-label timer-label-rest'; }
    } else {
        if (label) { label.textContent = '🔥 Active'; label.className = 'hud-label'; }
    }
}

function startActivePhase() {
    stopTimer();
    timerPhase     = 'active';
    timerRemaining = selectedActiveDuration;
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            startRestPhase();
        }
    }, 1000);
}

function startRestPhase() {
    timerPhase     = 'rest';
    timerRemaining = selectedRestDuration;
    updateHudTimer();
    timerInterval = setInterval(() => {
        timerRemaining--;
        updateHudTimer();
        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            timerPhase = 'idle';
            timerRemaining = selectedActiveDuration;
            updateHudTimer();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerPhase    = 'idle';
}

// ── Timer settings side drawer ────────────────────────────────────

function openTimerDrawer() {
    // Sync steppers with current values
    document.getElementById('active-duration-val').textContent = selectedActiveDuration;
    document.getElementById('rest-duration-val').textContent   = selectedRestDuration;
    document.getElementById('timer-settings-overlay').classList.add('open');
    document.getElementById('timer-settings-drawer').classList.add('open');
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
    // If idle, update the display to reflect new active duration
    if (timerPhase === 'idle') {
        timerRemaining = selectedActiveDuration;
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
