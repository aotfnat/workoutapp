// exercise-library.js
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
    }
];

// ── Library lookup helpers ────────────────────────────────────────────────────

/**
 * Find an exercise by name (case-insensitive).
 * Returns the library entry or null.
 */
function libraryFind(name) {
    const q = name.trim().toLowerCase();
    return EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === q) || null;
}

/**
 * Return all exercises in a given category.
 * category: 'upper' | 'lower' | 'core' | 'cardio' | 'full' | 'all'
 */
function libraryByCategory(category) {
    if (category === 'all') return EXERCISE_LIBRARY;
    return EXERCISE_LIBRARY.filter(e => e.category === category);
}

/**
 * Search the library by partial name match.
 * Returns an array of matching entries.
 */
function librarySearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) return EXERCISE_LIBRARY;
    return EXERCISE_LIBRARY.filter(e => e.name.toLowerCase().includes(q));
}
