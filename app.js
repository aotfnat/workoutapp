// app.js

// ── Data ────────────────────────────────────────────────────────
// workoutPlan: ordered array of { name: string, exercises: [] }
// currentWorkoutIndex: which workout fires next (wraps on completion)
let workoutPlan         = JSON.parse(localStorage.getItem('workoutPlan'))         || [];
let currentWorkoutIndex = parseInt(localStorage.getItem('currentWorkoutIndex'))    || 0;
let progressLogs        = JSON.parse(localStorage.getItem('progressLogs'))         || [];

// Guard against stale index after plan edits shrink the array
if (currentWorkoutIndex >= workoutPlan.length) currentWorkoutIndex = 0;

// Active workout state
let currentWorkout       = [];
let currentExerciseIndex = 0;
let currentSet           = 1;
let lapsedTimerInterval;
let lapsedTime           = 0;

// Rest timer state
let restTimeRemaining  = 60;
let restTimerRunning   = false;
let restTimerInterval  = null;
let selectedRestDuration = 60;

// Chart
let chartInstance = null;

// ── Navigation ───────────────────────────────────────────────────
let currentTab = 'calendar';

function switchTab(tabId) {
    if (currentTab === 'workout') clearInterval(lapsedTimerInterval);

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`${tabId}-section`).classList.add('active');

    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    currentTab = tabId;
    toggleMenu(false);

    if (tabId === 'plan')    loadPlan();
    if (tabId === 'workout') loadWorkoutTab();
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

function initTabs() {} // legacy no-op

// ── Persistence helpers ──────────────────────────────────────────
function savePlan() {
    localStorage.setItem('workoutPlan', JSON.stringify(workoutPlan));
    localStorage.setItem('currentWorkoutIndex', String(currentWorkoutIndex));
}

function savePlanWithAlert() {
    savePlan();
    alert('Plan saved!');
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
        const card = document.createElement('div');
        card.className = 'day workout-card';
        card.setAttribute('draggable', 'true');
        card.dataset.index = wIdx;

        // Highlight which workout is next
        const isNext = wIdx === currentWorkoutIndex;
        if (isNext) card.classList.add('next-workout');

        card.innerHTML = `
            <div class="workout-card-header">
                <span class="drag-handle" title="Drag to reorder">⠿</span>
                <span class="workout-seq">#${wIdx + 1}</span>
                <input class="workout-name-input" type="text" value="${escHtml(workout.name)}"
                    onchange="updateWorkoutName(${wIdx}, this.value)" placeholder="Workout name">
                ${isNext ? '<span class="next-badge">▶ Next</span>' : ''}
                <button class="icon-btn danger" onclick="removeWorkout(${wIdx})" title="Remove workout">✕</button>
            </div>
            <div class="exercise-list" id="ex-list-${wIdx}"></div>
            <div class="card-actions">
                <button onclick="addExercise(${wIdx})">＋ Add Exercise</button>
            </div>
        `;

        // Render exercises inside the card
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

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Add / Edit / Remove ──────────────────────────────────────────

function addWorkout() {
    const name = prompt('Workout name (e.g. "Push Day", "Cardio"):')?.trim();
    if (!name) return;
    workoutPlan.push({ name, exercises: [] });
    savePlan();
    loadPlan();
}

function updateWorkoutName(wIdx, value) {
    workoutPlan[wIdx].name = value.trim() || `Workout ${wIdx + 1}`;
    savePlan();
}

function removeWorkout(wIdx) {
    if (!confirm(`Remove "${workoutPlan[wIdx].name}"?`)) return;
    workoutPlan.splice(wIdx, 1);
    // Keep currentWorkoutIndex valid
    if (currentWorkoutIndex >= workoutPlan.length) currentWorkoutIndex = 0;
    savePlan();
    loadPlan();
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
    savePlan();
    loadPlan();
}

function updateExercise(wIdx, eIdx, field, value) {
    if (field === 'sets' || field === 'target') value = parseInt(value) || 0;
    workoutPlan[wIdx].exercises[eIdx][field] = value;
    savePlan();
}

function removeExercise(wIdx, eIdx) {
    workoutPlan[wIdx].exercises.splice(eIdx, 1);
    savePlan();
    loadPlan();
}

// ── Drag-and-drop reordering ─────────────────────────────────────

let dragSrcIndex = null;

function initDragAndDrop() {
    const cards = document.querySelectorAll('.workout-card');

    cards.forEach(card => {
        // Desktop drag events
        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragover',  onDragOver);
        card.addEventListener('drop',      onDrop);
        card.addEventListener('dragend',   onDragEnd);

        // Touch events (mobile drag-and-drop shim)
        const handle = card.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('touchstart', onTouchStart, { passive: true });
        }
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

    // Reorder array
    const moved = workoutPlan.splice(dragSrcIndex, 1)[0];
    workoutPlan.splice(targetIndex, 0, moved);

    // Keep currentWorkoutIndex pointing at the same workout after reorder
    if (dragSrcIndex === currentWorkoutIndex) {
        currentWorkoutIndex = targetIndex;
    } else if (dragSrcIndex < currentWorkoutIndex && targetIndex >= currentWorkoutIndex) {
        currentWorkoutIndex--;
    } else if (dragSrcIndex > currentWorkoutIndex && targetIndex <= currentWorkoutIndex) {
        currentWorkoutIndex++;
    }

    savePlan();
    loadPlan();
}

function onDragEnd() {
    document.querySelectorAll('.workout-card').forEach(c => {
        c.classList.remove('dragging', 'drag-over');
    });
    dragSrcIndex = null;
}

// ── Touch drag shim (for mobile) ─────────────────────────────────
let touchDragCard = null;
let touchClone    = null;
let touchOffsetY  = 0;

function onTouchStart(e) {
    const handle = e.currentTarget;
    touchDragCard = handle.closest('.workout-card');
    dragSrcIndex  = parseInt(touchDragCard.dataset.index);

    const rect = touchDragCard.getBoundingClientRect();
    touchOffsetY = e.touches[0].clientY - rect.top;

    // Create a visual clone
    touchClone = touchDragCard.cloneNode(true);
    touchClone.style.cssText = `
        position: fixed; left: ${rect.left}px; top: ${rect.top}px;
        width: ${rect.width}px; opacity: 0.85; z-index: 9999;
        pointer-events: none; border: 2px solid #30d158;
        border-radius: 14px; background: #2c2c2e;
    `;
    document.body.appendChild(touchClone);
    touchDragCard.classList.add('dragging');

    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd);
}

function onTouchMove(e) {
    e.preventDefault();
    const y = e.touches[0].clientY - touchOffsetY;
    const x = parseFloat(touchClone.style.left);
    touchClone.style.top = y + 'px';

    // Find which card we're hovering over
    touchClone.style.display = 'none';
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    touchClone.style.display = '';
    const hoveredCard = el?.closest('.workout-card');

    document.querySelectorAll('.workout-card').forEach(c => c.classList.remove('drag-over'));
    if (hoveredCard && hoveredCard !== touchDragCard) hoveredCard.classList.add('drag-over');
}

function onTouchEnd(e) {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend',  onTouchEnd);

    if (touchClone) { touchClone.remove(); touchClone = null; }

    const overCard = document.querySelector('.workout-card.drag-over');
    if (overCard) {
        const targetIndex = parseInt(overCard.dataset.index);
        if (dragSrcIndex !== targetIndex) {
            const moved = workoutPlan.splice(dragSrcIndex, 1)[0];
            workoutPlan.splice(targetIndex, 0, moved);

            if (dragSrcIndex === currentWorkoutIndex) {
                currentWorkoutIndex = targetIndex;
            } else if (dragSrcIndex < currentWorkoutIndex && targetIndex >= currentWorkoutIndex) {
                currentWorkoutIndex--;
            } else if (dragSrcIndex > currentWorkoutIndex && targetIndex <= currentWorkoutIndex) {
                currentWorkoutIndex++;
            }
            savePlan();
        }
    }

    document.querySelectorAll('.workout-card').forEach(c => c.classList.remove('dragging', 'drag-over'));
    touchDragCard = null;
    dragSrcIndex  = null;
    loadPlan();
}

// ── WORKOUT TAB ───────────────────────────────────────────────────

function loadWorkoutTab() {
    if (workoutPlan.length === 0) {
        document.getElementById('workout-info').innerHTML =
            '<p>No workouts in your plan yet. Go to Plan to add some.</p>';
        document.getElementById('exercise-list').innerHTML = '';
        return;
    }

    renderWorkoutHeader();

    // Deep-copy the current workout's exercises
    const wo = workoutPlan[currentWorkoutIndex];
    currentWorkout = JSON.parse(JSON.stringify(wo.exercises));
    currentWorkout.forEach(ex => ex.weights = new Array(ex.sets).fill(0));
    currentExerciseIndex = 0;
    currentSet = 1;
    lapsedTime = 0;

    clearInterval(lapsedTimerInterval);
    lapsedTimerInterval = setInterval(() => {
        lapsedTime++;
        document.getElementById('lapsed-time').textContent = formatTime(lapsedTime);
    }, 1000);

    renderExercise();
}

function renderWorkoutHeader() {
    const total = workoutPlan.length;
    const wo    = workoutPlan[currentWorkoutIndex];
    document.getElementById('workout-info').innerHTML = `
        <div class="workout-info-row">
            <button class="nav-btn" onclick="nudgeWorkout(-1)" ${total <= 1 ? 'disabled' : ''}>‹</button>
            <div class="workout-info-text">
                <span class="workout-num">${currentWorkoutIndex + 1} / ${total}</span>
                <span class="workout-name-display">${escHtml(wo.name)}</span>
            </div>
            <button class="nav-btn" onclick="nudgeWorkout(1)" ${total <= 1 ? 'disabled' : ''}>›</button>
        </div>
    `;
}

// Manual prev/next nudge (doesn't advance the saved index)
function nudgeWorkout(dir) {
    const total = workoutPlan.length;
    currentWorkoutIndex = (currentWorkoutIndex + dir + total) % total;
    savePlan();
    loadWorkoutTab();
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

    if (currentSet < ex.sets) {
        currentSet++;
    } else {
        currentExerciseIndex++;
        currentSet = 1;
    }

    renderExercise();
    resetRestTimer();
}

function completeWorkout() {
    const wo = workoutPlan[currentWorkoutIndex];
    progressLogs.push({
        date:      new Date().toISOString(),
        workoutName: wo.name,
        workoutIndex: currentWorkoutIndex,
        exercises: currentWorkout,
        duration:  lapsedTime
    });
    localStorage.setItem('progressLogs', JSON.stringify(progressLogs));
    clearInterval(lapsedTimerInterval);

    // Advance to the next workout (wraps)
    currentWorkoutIndex = (currentWorkoutIndex + 1) % workoutPlan.length;
    savePlan();

    alert(`"${wo.name}" logged! Next up: "${workoutPlan[currentWorkoutIndex].name}"`);
    loadWorkoutTab();
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
            </div>
        `;
    });
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('progress-chart').getContext('2d');
    const data = {};
    progressLogs.forEach(log => {
        log.exercises.forEach(ex => {
            if (!data[ex.name]) data[ex.name] = [];
            const avg = ex.weights.length
                ? ex.weights.reduce((a, b) => a + b, 0) / ex.weights.length
                : 0;
            data[ex.name].push({ date: log.date, avg });
        });
    });

    const datasets = Object.keys(data).map(name => ({
        label: name,
        data:  data[name].map(d => ({ x: d.date, y: d.avg })),
        borderColor: getRandomColor(),
        fill: false
    }));

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            scales: {
                x: { type: 'time', time: { unit: 'day' } },
                y: { beginAtZero: true }
            }
        }
    });
}

function getRandomColor() {
    return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
}

// ── REST TIMER ───────────────────────────────────────────────────

function updateTimerDisplay() {
    const el = document.getElementById('timer');
    el.textContent = formatTime(restTimeRemaining);
    el.classList.toggle('running', restTimerRunning && restTimeRemaining > 10);
    el.classList.toggle('low',     restTimerRunning && restTimeRemaining <= 10);
}

function startRestTimer() {
    if (restTimerRunning) return;
    const select = document.getElementById('rest-duration-select');
    if (select.value === 'custom') {
        const v = parseInt(document.getElementById('custom-rest-seconds').value);
        if (isNaN(v) || v < 10) { alert("Enter a valid number (10–300s)"); return; }
        selectedRestDuration = v;
    } else {
        selectedRestDuration = parseInt(select.value);
    }
    restTimeRemaining = selectedRestDuration;
    updateTimerDisplay();
    restTimerRunning = true;
    document.getElementById('timer-start').disabled = true;
    document.getElementById('timer-stop').disabled  = false;
    restTimerInterval = setInterval(() => {
        restTimeRemaining--;
        updateTimerDisplay();
        if (restTimeRemaining <= 0) {
            clearInterval(restTimerInterval);
            restTimerRunning = false;
            document.getElementById('timer-start').disabled = false;
            document.getElementById('timer-stop').disabled  = true;
        }
    }, 1000);
}

function stopRestTimer() {
    if (!restTimerRunning) return;
    clearInterval(restTimerInterval);
    restTimerRunning = false;
    document.getElementById('timer-start').disabled = false;
    document.getElementById('timer-stop').disabled  = true;
    document.getElementById('timer').classList.remove('running', 'low');
}

function resetRestTimer() {
    stopRestTimer();
    restTimeRemaining = selectedRestDuration;
    updateTimerDisplay();
}

function formatTime(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// ── BOOT ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rest-duration-select').addEventListener('change', function() {
        const custom = document.getElementById('custom-rest-seconds');
        custom.style.display = this.value === 'custom' ? 'inline' : 'none';
        if (this.value !== 'custom') { selectedRestDuration = parseInt(this.value); resetRestTimer(); }
    });

    document.getElementById('custom-rest-seconds').addEventListener('change', function() {
        const v = parseInt(this.value);
        if (!isNaN(v) && v >= 10 && v <= 300) { selectedRestDuration = v; resetRestTimer(); }
    });

    updateTimerDisplay();
    switchTab('calendar');
});
