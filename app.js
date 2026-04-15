// app.js
let weeklyPlan = JSON.parse(localStorage.getItem('weeklyPlan')) || {};
let progressLogs = JSON.parse(localStorage.getItem('progressLogs')) || [];
let currentWorkout = [];
let currentExerciseIndex = 0;
let currentSet = 1;
let lapsedTimerInterval;
let lapsedTime = 0;
let restTimeRemaining = 60;      // current countdown in seconds
let restTimerRunning = false;
let restTimerInterval = null;
let selectedRestDuration = 60;   // default

// Tab system
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active from all buttons and contents
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Activate selected tab
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-section`).classList.add('active');

            // Load content when switching tabs
            if (tabId === 'plan') loadPlan();
            if (tabId === 'workout') loadDayOptions();
            if (tabId === 'progress') loadProgress();
            // Calendar tab can be expanded later
        });
    });
}

function loadSimpleCalendar() {
    const today = new Date();
    document.getElementById('today-date').textContent = today.toLocaleDateString();
    // You can build a full mini calendar here later
}

function loadPlan() {
    const planDiv = document.getElementById('weekly-plan');
    planDiv.innerHTML = '';
    Object.keys(weeklyPlan).forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerHTML = `<h3>${day}</h3>`;
        weeklyPlan[day].forEach((ex, idx) => {
          const unitLabel = {
            reps:    'reps',
            seconds: 'seconds',
            minutes: 'min',
            meters:  'm'
          }[ex.unit] || 'reps';

          dayDiv.innerHTML += `
            <div class="exercise">
              <input type="text" value="${ex.name}" onchange="updateExercise('${day}', ${idx}, 'name', this.value)">
            
              Sets: <input type="number" min="1" value="${ex.sets}" onchange="updateExercise('${day}', ${idx}, 'sets', this.value)">
            
              Target: <input type="number" min="1" value="${ex.target}" onchange="updateExercise('${day}', ${idx}, 'target', this.value)">
            ${unitLabel}
            
              <button onclick="removeExercise('${day}', ${idx})">Remove</button>
            </div>
    `     ;
        });
        dayDiv.innerHTML += `<button onclick="addExercise('${day}')">Add Exercise</button>
                              <button onclick="removeDay('${day}')">Remove Day</button>`;
        planDiv.appendChild(dayDiv);
    });
}

function addDay() {
    const day = prompt('Enter day name (e.g., Monday):');
    if (day && !weeklyPlan[day]) {
        weeklyPlan[day] = [];
        loadPlan();
    }
}

function addExercise(day) {
    const name = prompt('Exercise name:')?.trim();
    if (!name) return;

    const unit = prompt(
        'Unit for this exercise?\n' +
        '1 = reps\n' +
        '2 = seconds\n' +
        '3 = minutes\n' +
        '4 = meters\n' +
        'Enter number (1-4):'
    );

    let selectedUnit;
    switch (unit?.trim()) {
        case '1': selectedUnit = 'reps';    break;
        case '2': selectedUnit = 'seconds'; break;
        case '3': selectedUnit = 'minutes'; break;
        case '4': selectedUnit = 'meters';  break;
        default:
            alert("Invalid choice → defaulting to 'reps'");
            selectedUnit = 'reps';
    }

    let targetValue;
    if (selectedUnit === 'reps') {
        targetValue = parseInt(prompt('Target reps:', '10')) || 10;
    } else if (selectedUnit === 'seconds') {
        targetValue = parseInt(prompt('Target seconds:', '30')) || 30;
    } else if (selectedUnit === 'minutes') {
        targetValue = parseInt(prompt('Target minutes:', '3')) || 3;
    } else { // meters
        targetValue = parseInt(prompt('Target meters:', '400')) || 400;
    }

    // For reps we usually also ask sets — others can still have sets too (e.g. 3×30s planks)
    const sets = parseInt(prompt('Number of sets:', '3')) || 3;

    weeklyPlan[day].push({
        name,
        sets,
        target: targetValue,          // renamed from "reps"
        unit: selectedUnit,
        weights: []                   // still useful for weighted exercises
    });

    loadPlan();
    savePlan(); // optional: auto-save after adding
}

function updateExercise(day, idx, field, value) {
    if (field === 'sets' || field === 'target') {
        value = parseInt(value) || 0;
    }
    weeklyPlan[day][idx][field] = value;
}

function removeExercise(day, idx) {
    weeklyPlan[day].splice(idx, 1);
    loadPlan();
}

function removeDay(day) {
    delete weeklyPlan[day];
    loadPlan();
}

function savePlan() {
    localStorage.setItem('weeklyPlan', JSON.stringify(weeklyPlan));
    alert('Plan saved!');
}

function loadDayOptions() {
    const select = document.getElementById('day-select');
    select.innerHTML = '';
    Object.keys(weeklyPlan).forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day;
        select.appendChild(option);
    });
    loadDayWorkout();
}

function loadDayWorkout() {
    const day = document.getElementById('day-select').value;
    currentWorkout = JSON.parse(JSON.stringify(weeklyPlan[day] || [])); // Deep copy
    currentWorkout.forEach(ex => ex.weights = new Array(ex.sets).fill(0));
    currentExerciseIndex = 0;
    currentSet = 1;
    lapsedTime = 0;
    clearInterval(lapsedTimerInterval);
    lapsedTimerInterval = setInterval(() => {
        lapsedTime++;
        document.getElementById('lapsed-time').textContent = `Lapsed Time: ${formatTime(lapsedTime)}`;
    }, 1000);
    renderExercise();
}

function renderExercise() {
    const list = document.getElementById('exercise-list');
    list.innerHTML = '';

    if (currentExerciseIndex >= currentWorkout.length) {
        list.innerHTML = '<p>Workout Complete!</p>';
        clearInterval(lapsedTimerInterval);
        return;
    }

    const ex = currentWorkout[currentExerciseIndex];

    let goalText = '';
    if (ex.unit === 'reps') {
        goalText = `Reps: ${ex.target}`;
    } else if (ex.unit === 'seconds') {
        goalText = `Time: ${ex.target} seconds`;
    } else if (ex.unit === 'minutes') {
        goalText = `Time: ${ex.target} min`;
    } else if (ex.unit === 'meters') {
        goalText = `Distance: ${ex.target} m`;
    } else {
        goalText = `Target: ${ex.target}`;
    }

    list.innerHTML = `
        <h3>${ex.name} – Set ${currentSet}/${ex.sets}</h3>
        <p>${goalText}</p>
        <label>Weight (kg/lb): <input type="number" step="0.5" id="weight-input" value="${ex.weights[currentSet-1] || ''}"></label>
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
    prepareNextRest();          // ← added
    // startRestTimer();        // ← if you want auto-start
}

// Call this inside renderExercise() or after nextSet()
function prepareNextRest() {
    resetRestTimer();           // reset to selected duration
    // Optionally auto-start:
    // startRestTimer();
}


// ────────────────────────────────────────────────
// Timer control functions
// ────────────────────────────────────────────────

function updateTimerDisplay() {
    document.getElementById('timer').textContent = formatTime(restTimeRemaining);
}

function startRestTimer() {
    if (restTimerRunning) return;

    // Read selected duration
    const select = document.getElementById('rest-duration-select');
    const customInput = document.getElementById('custom-rest-seconds');

    if (select.value === 'custom') {
        const customVal = parseInt(customInput.value);
        if (isNaN(customVal) || customVal < 10) {
            alert("Please enter a valid number (10–300 seconds)");
            return;
        }
        selectedRestDuration = customVal;
    } else {
        selectedRestDuration = parseInt(select.value);
    }

    restTimeRemaining = selectedRestDuration;
    updateTimerDisplay();

    restTimerRunning = true;
    document.getElementById('timer-start').disabled = true;
    document.getElementById('timer-stop').disabled = false;

    restTimerInterval = setInterval(() => {
        restTimeRemaining--;
        updateTimerDisplay();

        if (restTimeRemaining <= 0) {
            clearInterval(restTimerInterval);
            restTimerRunning = false;
            document.getElementById('timer-start').disabled = false;
            document.getElementById('timer-stop').disabled = true;
            // Optional: play sound or vibrate
            // new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-clock-beep-988.mp3').play();
        }
    }, 1000);
}

function stopRestTimer() {
    if (!restTimerRunning) return;
    clearInterval(restTimerInterval);
    restTimerRunning = false;
    document.getElementById('timer-start').disabled = false;
    document.getElementById('timer-stop').disabled = true;
}

function resetRestTimer() {
    stopRestTimer();
    restTimeRemaining = selectedRestDuration;
    updateTimerDisplay();
}

// Show/hide custom input
document.getElementById('rest-duration-select').addEventListener('change', function() {
    const customInput = document.getElementById('custom-rest-seconds');
    customInput.style.display = this.value === 'custom' ? 'inline' : 'none';
    if (this.value !== 'custom') {
        selectedRestDuration = parseInt(this.value);
        resetRestTimer();
    }
});

// Update when custom value changes
document.getElementById('custom-rest-seconds').addEventListener('change', function() {
    const val = parseInt(this.value);
    if (!isNaN(val) && val >= 10 && val <= 300) {
        selectedRestDuration = val;
        resetRestTimer();
    }
});

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function completeWorkout() {
    const day = document.getElementById('day-select').value;
    progressLogs.push({
        date: new Date().toISOString(),
        day,
        exercises: currentWorkout,
        duration: lapsedTime
    });
    localStorage.setItem('progressLogs', JSON.stringify(progressLogs));
    alert('Workout completed and logged!');
}

function loadProgress() {
    const logDiv = document.getElementById('progress-log');
    logDiv.innerHTML = '';
    progressLogs.forEach((log, idx) => {
        logDiv.innerHTML += `
            <div>
                <h4>${log.date} - ${log.day} - Duration: ${formatTime(log.duration)}</h4>
                ${log.exercises.map(ex => `<p>${ex.name}: Weights - ${ex.weights.join(', ')}</p>`).join('')}
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
            const avgWeight = ex.weights.reduce((a, b) => a + b, 0) / ex.weights.length;
            data[ex.name].push({ date: log.date, avg: avgWeight });
        });
    });

    const datasets = Object.keys(data).map(name => ({
        label: name,
        data: data[name].map(d => ({ x: d.date, y: d.avg })),
        borderColor: getRandomColor(),
        fill: false
    }));

    new Chart(ctx, {
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
    return `#${Math.floor(Math.random()*16777215).toString(16)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    
    // Start on Plan tab
    document.querySelector('[data-tab="plan"]').click();
});
