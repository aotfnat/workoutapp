// exercise-library.js
// Version 9.9
// SOC: added libraryUpdateCustomNotes() so custom exercise notes can be edited from the UI
// ─────────────────────────────────────────────────────────────────────────────
// Common exercise library with biomechanical defaults.
//
// Fields per entry:
//   name          – Display name
//   category      – 'upper' | 'lower' | 'core' | 'cardio' | 'full'
//   type          – 'isotonic' | 'isometric'
//   bodyWeightPct – Fraction of body weight that acts as the load (0–1)
//                   e.g. push-up ≈ 0.64 means ~64% of body weight is lifted
//   heightPct     – Fraction of body height traveled per rep (isotonic repetitive only)
//                   e.g. squat ≈ 0.50 means each rep travels half your standing height
//                   null for distance-based or isometric exercises
//   unit          – Default active-period unit: 'reps' | 'seconds' | 'meters'
//   notes         – Brief biomechanical note shown to the user
//
// To add a new exercise: append an object to EXERCISE_LIBRARY following the
// same structure. The app will pick it up automatically on next load.
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_LIBRARY = [

    // ── UPPER BODY ──────────────────────────────────────────────────────────
    {
        name: 'Push-Up',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.64,
        heightPct: 0.30,
        unit: 'reps',
        notes: '~64% BW lifted; ~30% height per rep range of motion'
    },
    {
        name: 'Pull-Up',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.30,
        unit: 'reps',
        notes: '~100% BW lifted; ~30% height per rep ROM'
    },
    {
        name: 'Chin-Up',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.30,
        unit: 'reps',
        notes: 'Same loading as pull-up; supinated grip'
    },
    {
        name: 'Dip',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.75,
        heightPct: 0.20,
        unit: 'reps',
        notes: '~75% BW; ~20% height per rep ROM (elbow dip depth)'
    },
    {
        name: 'Pike Push-Up',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.70,
        heightPct: 0.25,
        unit: 'reps',
        notes: 'More shoulder-dominant than push-up; ~70% BW'
    },
    {
        name: 'Diamond Push-Up',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.64,
        heightPct: 0.28,
        unit: 'reps',
        notes: 'Same BW load as push-up; tricep-dominant'
    },
    {
        name: 'Inverted Row',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.70,
        heightPct: 0.20,
        unit: 'reps',
        notes: '~70% BW; horizontal pulling ROM ~20% height'
    },
    {
        name: 'Bicep Curl',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.30,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight only; ~30% height ROM'
    },
    {
        name: 'Tricep Extension',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.28,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight only'
    },
    {
        name: 'Overhead Press',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.38,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; ~38% height ROM (shoulder to lockout)'
    },
    {
        name: 'Lateral Raise',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.18,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; short arc ROM'
    },
    {
        name: 'Bent-Over Row',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.20,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; ~20% height ROM'
    },
    {
        name: 'Chest Fly',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.22,
        unit: 'reps',
        notes: 'BW load = 0; dumbbell/cable fly; arc ROM'
    },

    // ── LOWER BODY ──────────────────────────────────────────────────────────
    {
        name: 'Squat',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.50,
        unit: 'reps',
        notes: '~100% BW; ~50% height per rep ROM (hip to standing)'
    },
    {
        name: 'Goblet Squat',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.50,
        unit: 'reps',
        notes: 'Same as squat; added weight held at chest'
    },
    {
        name: 'Bulgarian Split Squat',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 0.85,
        heightPct: 0.40,
        unit: 'reps',
        notes: '~85% BW on working leg; ~40% height ROM'
    },
    {
        name: 'Lunge',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.40,
        unit: 'reps',
        notes: '~100% BW; ~40% height ROM per rep (knee to standing)'
    },
    {
        name: 'Step-Up',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.20,
        unit: 'reps',
        notes: '~100% BW; distance = step height (~20% of body height)'
    },
    {
        name: 'Deadlift',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 0.05,
        heightPct: 0.50,
        unit: 'reps',
        notes: 'BW load = 5%; uses added weight; ~50% height ROM (floor to hip)'
    },
    {
        name: 'Romanian Deadlift',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.40,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; hip hinge ~40% height ROM'
    },
    {
        name: 'Leg Press',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.40,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight (machine load)'
    },
    {
        name: 'Calf Raise',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.05,
        unit: 'reps',
        notes: '~100% BW; very short ROM ~5% height'
    },
    {
        name: 'Hip Thrust',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.18,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; ~18% height ROM'
    },
    {
        name: 'Glute Bridge',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 0.50,
        heightPct: 0.15,
        unit: 'reps',
        notes: '~50% BW; ~15% height ROM from floor'
    },
    {
        name: 'Box Jump',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.25,
        unit: 'reps',
        notes: '~100% BW; vertical displacement - divide the jump height by your height x 100% to get height %'
    },
    {
        name: 'Jump Squat',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.55,
        unit: 'reps',
        notes: '~100% BW; full squat + jump, ~55% height total ROM'
    },

    // ── CORE ────────────────────────────────────────────────────────────────
    {
        name: 'Plank',
        category: 'core',
        type: 'isometric',
        bodyWeightPct: 0.64,
        heightPct: null,
        unit: 'seconds',
        notes: '~64% BW held isometrically; no displacement (Tension Load)'
    },
    {
        name: 'Side Plank',
        category: 'core',
        type: 'isometric',
        bodyWeightPct: 0.55,
        heightPct: null,
        unit: 'seconds',
        notes: '~55% BW held laterally; Tension Load'
    },
    {
        name: 'Dead Bug Hold',
        category: 'core',
        type: 'isometric',
        bodyWeightPct: 0.30,
        heightPct: null,
        unit: 'seconds',
        notes: '~30% BW anti-extension hold; Tension Load'
    },
    {
        name: 'Hollow Body Hold',
        category: 'core',
        type: 'isometric',
        bodyWeightPct: 0.50,
        heightPct: null,
        unit: 'seconds',
        notes: '~50% BW; gymnastics isometric; Tension Load'
    },
    {
        name: 'Crunch',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.20,
        heightPct: 0.10,
        unit: 'reps',
        notes: '~20% BW; short ROM ~10% height'
    },
    {
        name: 'Sit-Up',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.35,
        heightPct: 0.20,
        unit: 'reps',
        notes: '~35% BW; ~20% height ROM'
    },
    {
        name: 'Leg Raise',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.20,
        heightPct: 0.22,
        unit: 'reps',
        notes: '~20% BW; arc ROM ~22% height'
    },
    {
        name: 'Russian Twist',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.20,
        heightPct: 0.10,
        unit: 'reps',
        notes: '~20% BW; rotational; short ROM'
    },
    {
        name: 'Mountain Climber',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.64,
        heightPct: 0.15,
        unit: 'reps',
        notes: '~64% BW (push-up position); ~15% height knee drive ROM'
    },
    {
        name: 'Ab Wheel Rollout',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.60,
        heightPct: 0.35,
        unit: 'reps',
        notes: '~60% BW; ~35% height ROM extended'
    },

    // ── FULL BODY ────────────────────────────────────────────────────────────
    {
        name: 'Burpee',
        category: 'full',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.90,
        unit: 'reps',
        notes: '~100% BW; full floor-to-jump ROM ~90% height'
    },
    {
        name: 'Thruster',
        category: 'full',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.88,
        unit: 'reps',
        notes: 'BW = ~100%; squat + press ~88% height ROM'
    },
    {
        name: 'Kettlebell Swing',
        category: 'full',
        type: 'isotonic',
        bodyWeightPct: 0.05,
        heightPct: 0.50,
        unit: 'reps',
        notes: 'BW = 5%; uses added weight; hip hinge arc ~50% height'
    },
    {
        name: 'Clean',
        category: 'full',
        type: 'isotonic',
        bodyWeightPct: 0.05,
        heightPct: 0.60,
        unit: 'reps',
        notes: 'BW = 5% for power cleans, increase to 100% if doing full squat cleans; uses added weight; ~60% height pull ROM'
    },
    {
        name: 'Snatch',
        category: 'full',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.95,
        unit: 'reps',
        notes: 'BW = 5% for power snatches, increase to 100% if doing full squat snatches; uses added weight; floor to overhead ~95% height'
    },

    // ── CARDIO ──────────────────────────────────────────────────────────────
    {
        name: 'Running',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: null,
        unit: 'meters',
        notes: '~100% BW; uses distance (meters) for Work calculation'
    },
    {
        name: 'Walking',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: null,
        unit: 'meters',
        notes: '~100% BW; uses distance (meters)'
    },
    {
        name: 'Cycling',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 0.80,
        heightPct: null,
        unit: 'meters',
        notes: '~80% BW effective load; uses distance (meters)'
    },
    {
        name: 'Rowing (Erg)',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: null,
        unit: 'meters',
        notes: 'BW = 0; uses added resistance + distance (meters)'
    },
    {
        name: 'Jump Rope',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.05,
        unit: 'reps',
        notes: '~100% BW; very short hop ROM ~5% height per jump'
    },
    {
        name: 'Jumping Jack',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.08,
        unit: 'reps',
        notes: '~100% BW; lateral jump ~8% height ROM'
    },
    {
        name: 'High Knees',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.12,
        unit: 'reps',
        notes: '~100% BW; knee lift ~12% height ROM per rep'
    },
    {
        name: 'Box Step (Cardio)',
        category: 'cardio',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.20,
        unit: 'reps',
        notes: '~100% BW; Divide step height by your height x 100% to get height %'
    },

    // ── UPPER BODY (additional) ──────────────────────────────────────────────
    {
        name: 'Decline Push-Up',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.70,
        heightPct: 0.30,
        unit: 'reps',
        notes: '~70% BW lifted (feet elevated shifts load forward); ~30% height ROM'
    },
    {
        name: 'Bench Press',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.25,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; ~25% height ROM (bar to chest and back)'
    },
    {
        name: 'Incline Bench Press',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.25,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; incline angle shifts load to upper chest'
    },
    {
        name: 'Decline Bench Press',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.22,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; shorter ROM than flat bench ~22% height'
    },
    {
        name: 'Shoulder Press',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.38,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; same ROM as Overhead Press; seated or standing'
    },
    {
        name: 'Push Press',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.05,
        heightPct: 0.55,
        unit: 'reps',
        notes: 'BW = 5% (leg drive contribution); uses added weight; ~55% height ROM floor-to-lockout'
    },
    {
        name: 'Face Pull',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.15,
        unit: 'reps',
        notes: 'BW load = 0; cable/band; ~15% height ROM horizontal pull to face'
    },
    {
        name: 'Reverse Fly',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.18,
        unit: 'reps',
        notes: 'BW load = 0; dumbbell/cable; ~18% height arc ROM; rear delt focus'
    },
    {
        name: 'Back Fly',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.18,
        unit: 'reps',
        notes: 'BW load = 0; same movement as Reverse Fly; rear delt / upper back'
    },
    {
        name: 'Lateral Shoulder Raise',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.18,
        unit: 'reps',
        notes: 'BW load = 0; uses added weight; same arc ROM as Lateral Raise'
    },
    {
        name: 'Shoulder T',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.20,
        unit: 'reps',
        notes: 'BW load = 0; band/cable T-raise targeting rear delts and traps; ~20% height arc'
    },
    {
        name: 'Shoulder W',
        category: 'upper',
        type: 'isotonic',
        bodyWeightPct: 0.00,
        heightPct: 0.18,
        unit: 'reps',
        notes: 'BW load = 0; band/cable W-raise; external rotation focus; ~18% height arc'
    },

    // ── LOWER BODY (additional) ──────────────────────────────────────────────
    {
        name: 'Front Squat',
        category: 'lower',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.50,
        unit: 'reps',
        notes: '~100% BW; bar racked on front of shoulders; ~50% height ROM, same as back squat'
    },

    // ── CORE (additional) ────────────────────────────────────────────────────
    {
        name: 'Dead Bug',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.30,
        heightPct: 0.20,
        unit: 'reps',
        notes: '~30% BW moving limb load; ~20% height ROM per rep (arm/leg extension)'
    },
    {
        name: 'Torso Twist',
        category: 'core',
        type: 'isotonic',
        bodyWeightPct: 0.20,
        heightPct: 0.12,
        unit: 'reps',
        notes: '~20% BW; rotational core; ~12% height arc ROM per rep'
    },

    // ── MOBILITY / WARMUP ────────────────────────────────────────────────────
    {
        name: 'Leg Swing',
        category: 'mobility',
        type: 'isotonic',
        bodyWeightPct: 0.30,
        heightPct: 0.35,
        unit: 'reps',
        notes: '~30% BW (single leg in swing); ~35% height arc per swing; dynamic hip mobility'
    },
    {
        name: 'Dynamic Arm Swing',
        category: 'mobility',
        type: 'isotonic',
        bodyWeightPct: 0.05,
        heightPct: 0.25,
        unit: 'reps',
        notes: '~5% BW (arm weight); ~25% height arc; dynamic shoulder warm-up'
    },
    {
        name: 'Wall Ball Shot',
        category: 'full',
        type: 'isotonic',
        bodyWeightPct: 1.00,
        heightPct: 0.90,
        unit: 'reps',
        notes: '~100% BW; squat + overhead throw; ~90% height ROM floor-to-release'
    }
];

// ── Custom exercise storage ───────────────────────────────────────────────────
// Custom exercises are stored in localStorage under the key 'customExercises'.
// They have the same structure as EXERCISE_LIBRARY entries, plus a `custom: true` flag.

function loadCustomExercises() {
    try {
        return JSON.parse(localStorage.getItem('customExercises') || '[]');
    } catch(e) { return []; }
}

function saveCustomExercises(list) {
    localStorage.setItem('customExercises', JSON.stringify(list));
}

/**
 * Return the full combined library (built-in + custom), sorted alphabetically.
 * Custom exercises have a `custom: true` flag.
 */
function libraryGetAll() {
    const custom = loadCustomExercises();
    return [...EXERCISE_LIBRARY, ...custom].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Add or update a custom exercise.
 * If an entry with the same name (case-insensitive) already exists in the custom list, it is replaced.
 * Built-in exercises cannot be overwritten.
 */
function libraryAddCustom(entry) {
    const custom = loadCustomExercises();
    const idx = custom.findIndex(e => e.name.toLowerCase() === entry.name.trim().toLowerCase());
    const newEntry = { ...entry, name: entry.name.trim(), custom: true };
    if (idx >= 0) {
        custom[idx] = newEntry;
    } else {
        custom.push(newEntry);
    }
    saveCustomExercises(custom);
    return newEntry;
}

/**
 * Delete a custom exercise by name (case-insensitive).
 * Returns true if deleted, false if not found or is a built-in entry.
 */
function libraryDeleteCustom(name) {
    const q = name.trim().toLowerCase();
    const custom = loadCustomExercises();
    const idx = custom.findIndex(e => e.name.toLowerCase() === q);
    if (idx < 0) return false;
    custom.splice(idx, 1);
    saveCustomExercises(custom);
    return true;
}

/**
 * Update just the notes field of an existing custom exercise by name (case-insensitive).
 * Returns true if updated, false if not found. Built-in library entries cannot be
 * edited this way — their notes are fixed biomechanical references.
 */
function libraryUpdateCustomNotes(name, notes) {
    const q = name.trim().toLowerCase();
    const custom = loadCustomExercises();
    const idx = custom.findIndex(e => e.name.toLowerCase() === q);
    if (idx < 0) return false;
    custom[idx] = { ...custom[idx], notes };
    saveCustomExercises(custom);
    return true;
}

// ── Library lookup helpers ────────────────────────────────────────────────────

/**
 * Find an exercise by name (case-insensitive) in combined library.
 * Returns the library entry or null.
 */
function libraryFind(name) {
    const q = name.trim().toLowerCase();
    return libraryGetAll().find(e => e.name.toLowerCase() === q) || null;
}

/**
 * Return all exercises in a given category from the combined library.
 * category: 'upper' | 'lower' | 'core' | 'cardio' | 'full' | 'mobility' | 'custom' | 'all'
 */
function libraryByCategory(category) {
    const all = libraryGetAll();
    if (category === 'all')    return all;
    if (category === 'custom') return all.filter(e => e.custom);
    return all.filter(e => e.category === category);
}

/**
 * Search the combined library by partial name match, optionally filtered by category.
 * Returns an array of matching entries.
 */
function librarySearch(query, category) {
    const q = query.trim().toLowerCase();
    let pool = (category && category !== 'all') ? libraryByCategory(category) : libraryGetAll();
    if (!q) return pool;

    const matches = pool.filter(e => e.name.toLowerCase().includes(q));

    // Rank: 1 = exact match, 2 = name starts with query, 3 = a word starts with query, 4 = contains anywhere
    function rank(e) {
        const name = e.name.toLowerCase();
        if (name === q) return 1;
        if (name.startsWith(q)) return 2;
        if (name.split(/[\s\-]+/).some(word => word.startsWith(q))) return 3;
        return 4;
    }

    return matches.sort((a, b) => {
        const rd = rank(a) - rank(b);
        if (rd !== 0) return rd;
        return a.name.localeCompare(b.name);
    });
}
