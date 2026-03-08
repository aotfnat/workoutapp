// app.js
let weeklyPlan = JSON.parse(localStorage.getItem('weeklyPlan')) || {};
let progressLogs = JSON.parse(localStorage.getItem('progressLogs')) || [];
let currentWorkout = [];
let currentExerciseIndex = 0;
let currentSet = 1;
let restTimerInterval;
let lapsedTimerInterval;
let lapsedTime = 0;

function showSection(section) {
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
    document.getElementById(`${section}-section`).style.display = 'block';
    if (section === 'plan') loadPlan();
    if (section === 'workout') loadDayOptions();
    if (section === 'progress') loadProgress();
}

function loadPlan() {
    const planDiv = document.getElementById('weekly-plan');
    planDiv.innerHTML = '';
    Object.keys(weeklyPlan).forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerHTML = `<h3>${day}</h3>`;
        weeklyPlan[day].forEach((ex, idx) => {
            dayDiv.innerHTML += `
                <div class="exercise">
                    <input type="text" value="${ex.name}" onchange="updateExercise('${day}', ${idx}, 'name', this.value)">
                    Sets: <input type="number" value="${ex.sets}" onchange="updateExercise('${day}', ${idx}, 'sets', this.value)">
                    Reps: <input type="number" value="${ex.reps}" onchange="updateExercise('${day}', ${idx}, 'reps', this.value)">
                    <button onclick="removeExercise('${day}', ${idx})">Remove</button>
                </div>
            `;
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
    const name = prompt('Exercise name:');
    const sets = prompt('Sets:', 3);
    const reps = prompt('Reps:', 10);
    weeklyPlan[day].push({ name, sets: parseInt(sets), reps: parseInt(reps), weights: [] });
    loadPlan();
}

function updateExercise(day, idx, field, value) {
    if (field === 'sets' || field === 'reps') value = parseInt(value);
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
    list.innerHTML = `
        <h3>${ex.name} - Set ${currentSet}/${ex.sets}</h3>
        <p>Reps: ${ex.reps}</p>
        <label>Weight: <input type="number" id="weight-input" value="${ex.weights[currentSet-1]}"></label>
        <button onclick="nextSet()">Next Set</button>
    `;
}

function nextSet() {
    const ex = currentWorkout[currentExerciseIndex];
    ex.weights[currentSet-1] = parseFloat(document.getElementById('weight-input').value) || 0;
    if (currentSet < ex.sets) {
        currentSet++;
    } else {
        currentExerciseIndex++;
        currentSet = 1;
    }
    startRestTimer();
    renderExercise();
}

function startRestTimer() {
    let time = 60; // 60 seconds rest
    document.getElementById('timer').textContent = `Rest Timer: ${formatTime(time)}`;
    clearInterval(restTimerInterval);
    restTimerInterval = setInterval(() => {
        time--;
        document.getElementById('timer').textContent = `Rest Timer: ${formatTime(time)}`;
        if (time <= 0) clearInterval(restTimerInterval);
    }, 1000);
}

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
    showSection('progress');
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

// Initial load
showSection('plan');