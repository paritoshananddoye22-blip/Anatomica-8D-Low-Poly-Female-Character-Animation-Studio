/**
 * PARTS 04–25 — UNIVERSAL EIGHT-DIRECTION SYSTEM & COMPLETE ANIMATION CATALOG
 */

export type DirectionId = 'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D06' | 'D07' | 'D08';

export interface DirectionSpec {
  id: DirectionId;
  label: string;
  shortLabel: string;
  /** Angle in radians relative to character local forward (+Z). Positive = right (-X), Negative = left (+X) */
  angleRad: number;
  angleDeg: number;
  /** Unit vector [dx, dz] in character local space (+Z is forward, -X is character right, +X is character left) */
  vectorXZ: [number, number];
  biomechanicsNote: string;
}

export const EIGHT_DIRECTIONS: DirectionSpec[] = [
  {
    id: 'D01',
    label: 'Forward',
    shortLabel: 'FWD',
    angleDeg: 0,
    angleRad: 0,
    vectorXZ: [0, 1],
    biomechanicsNote: 'Sagittal stride with counter-balanced pelvic-thoracic axial twist and heel-to-toe roll.',
  },
  {
    id: 'D02',
    label: 'Forward-Right',
    shortLabel: 'FWD-R',
    angleDeg: 45,
    angleRad: Math.PI / 4,
    vectorXZ: [-Math.SQRT1_2, Math.SQRT1_2],
    biomechanicsNote: 'Oblique 45° right lead with pelvis angled 28° right and counter-rotated chest/head.',
  },
  {
    id: 'D03',
    label: 'Right',
    shortLabel: 'RIGHT',
    angleDeg: 90,
    angleRad: Math.PI / 2,
    vectorXZ: [-1, 0],
    biomechanicsNote: 'Pure coronal lateral abduction-adduction step toward right with controlled arm balance.',
  },
  {
    id: 'D04',
    label: 'Backward-Right',
    shortLabel: 'BWD-R',
    angleDeg: 135,
    angleRad: (3 * Math.PI) / 4,
    vectorXZ: [-Math.SQRT1_2, -Math.SQRT1_2],
    biomechanicsNote: 'Diagonal posterior-right retreat with hip extension lead and toe-first ground contact.',
  },
  {
    id: 'D05',
    label: 'Backward',
    shortLabel: 'BWD',
    angleDeg: 180,
    angleRad: Math.PI,
    vectorXZ: [0, -1],
    biomechanicsNote: 'Posterior sagittal reach with controlled gluteal extension and zero unnatural spine twisting.',
  },
  {
    id: 'D06',
    label: 'Backward-Left',
    shortLabel: 'BWD-L',
    angleDeg: 225,
    angleRad: -(3 * Math.PI) / 4,
    vectorXZ: [Math.SQRT1_2, -Math.SQRT1_2],
    biomechanicsNote: 'Diagonal posterior-left retreat with balanced hip rotation and forefoot reach.',
  },
  {
    id: 'D07',
    label: 'Left',
    shortLabel: 'LEFT',
    angleDeg: 270,
    angleRad: -Math.PI / 2,
    vectorXZ: [1, 0],
    biomechanicsNote: 'Pure coronal lateral abduction-adduction step toward left with stable center of mass.',
  },
  {
    id: 'D08',
    label: 'Forward-Left',
    shortLabel: 'FWD-L',
    angleDeg: 315,
    angleRad: -Math.PI / 4,
    vectorXZ: [Math.SQRT1_2, Math.SQRT1_2],
    biomechanicsNote: 'Oblique 45° left lead with pelvis angled 28° left and forward-stabilized gaze.',
  },
];

export const DIRECTION_BY_ID: Record<DirectionId, DirectionSpec> = EIGHT_DIRECTIONS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<DirectionId, DirectionSpec>
);

export type AnimationPartId =
  | 'PART_05_WALK'
  | 'PART_06_FAST_WALK'
  | 'PART_07_RUN'
  | 'PART_08_SPRINT'
  | 'PART_09_CROUCH'
  | 'PART_10_STEALTH'
  | 'PART_11_JUMP'
  | 'PART_12_DODGE'
  | 'PART_13_STRAFE'
  | 'PART_14_TURN'
  | 'PART_15_COMBAT_MOVE'
  | 'PART_16_MELEE'
  | 'PART_17_HIT_REACT'
  | 'PART_18_FALL_RECOVER'
  | 'PART_19_INJURED'
  | 'PART_20_FATIGUE'
  | 'PART_21_TRANSITION'
  | 'PART_22_HUMAN_IDLE'
  | 'PART_23_INTERACTION'
  | 'PART_24_CARRYING'
  | 'PART_25_TRAVERSAL';

export type SynthesisArchetype =
  | 'locomotion_walk'
  | 'locomotion_fast_walk'
  | 'locomotion_run'
  | 'locomotion_sprint'
  | 'locomotion_crouch'
  | 'locomotion_crouch_run'
  | 'locomotion_stealth'
  | 'jump_directional'
  | 'jump_specialized'
  | 'dodge_evade'
  | 'roll_directional'
  | 'slide_directional'
  | 'strafe_combat'
  | 'turn_in_place'
  | 'combat_locomotion'
  | 'combat_stationary'
  | 'melee_action'
  | 'hit_reaction'
  | 'fall_sequence'
  | 'recovery_getup'
  | 'injured_locomotion'
  | 'fatigue_locomotion'
  | 'fatigue_stationary'
  | 'state_transition'
  | 'human_idle'
  | 'interaction_action'
  | 'carry_locomotion'
  | 'carry_stationary'
  | 'climb_traversal';

export interface AnimationClipMeta {
  id: string;
  name: string;
  partId: AnimationPartId;
  partNumber: string;
  partTitle: string;
  subGroup: string;
  direction?: DirectionId;
  duration: number;
  loop: boolean;
  speedMetersPerSec: number;
  archetype: SynthesisArchetype;
  variantKey?: string;
  handSide?: 'left' | 'right' | 'both';
  legSide?: 'left' | 'right';
  turnAngleDeg?: number;
  intensity?: 'light' | 'medium' | 'heavy';
  description: string;
}

export interface AnimationPartCategory {
  id: AnimationPartId;
  partNumber: string;
  title: string;
  shortTitle: string;
  supportsEightDirections: boolean;
  description: string;
}

export const ANIMATION_PART_CATEGORIES: AnimationPartCategory[] = [
  {
    id: 'PART_05_WALK',
    partNumber: 'Part 05',
    title: 'Eight-Directional Walking Library',
    shortTitle: '05 · Walk (8D)',
    supportsEightDirections: true,
    description: 'Natural walking cycles (WLK_D01–D08) with alternating foot contacts and pelvic rotation.',
  },
  {
    id: 'PART_06_FAST_WALK',
    partNumber: 'Part 06',
    title: 'Eight-Directional Fast Walk Library',
    shortTitle: '06 · Fast Walk (8D)',
    supportsEightDirections: true,
    description: 'Brisk, purposeful stride mechanics (FWLK_D01–D08) with higher step cadence and forward inclination.',
  },
  {
    id: 'PART_07_RUN',
    partNumber: 'Part 07',
    title: 'Eight-Directional Running Library',
    shortTitle: '07 · Run (8D)',
    supportsEightDirections: true,
    description: 'Athletic running cycles (RUN_D01–D08) with airborne phase, knee lift, and unique diagonal biomechanics.',
  },
  {
    id: 'PART_08_SPRINT',
    partNumber: 'Part 08',
    title: 'Eight-Directional Sprint Library',
    shortTitle: '08 · Sprint (8D)',
    supportsEightDirections: true,
    description: 'High-velocity sprint animations (SPR_D01–D08) with powerful leg drive and dynamic arm pumping.',
  },
  {
    id: 'PART_09_CROUCH',
    partNumber: 'Part 09',
    title: 'Eight-Directional Crouching & Crouch-Run Library',
    shortTitle: '09 · Crouch & Crouch-Run (8D)',
    supportsEightDirections: true,
    description: 'Low-center-of-gravity crouch walk (CRW_D01–D08), crouch run (CRUN_D01–D08), crouch idle, and crouch/crouch-run to stand transitions.',
  },
  {
    id: 'PART_10_STEALTH',
    partNumber: 'Part 10',
    title: 'Eight-Directional Stealth Library',
    shortTitle: '10 · Stealth (8D)',
    supportsEightDirections: true,
    description: 'Quiet, careful foot-placement stealth movement (STL_D01–D08) plus look, start/stop, and transitions.',
  },
  {
    id: 'PART_11_JUMP',
    partNumber: 'Part 11',
    title: 'Eight-Directional Jumping, Running Jump & Landing',
    shortTitle: '11 · Jump & Land (8D)',
    supportsEightDirections: true,
    description: 'Bilateral 6-phase directional jumps (JUMP_D01–D08), 8D jump while running (JUMP_RUN_D01–D08), run-to-jump, and jump-to-run landing transitions.',
  },
  {
    id: 'PART_12_DODGE',
    partNumber: 'Part 12',
    title: 'Eight-Directional Dodge, Roll & Slide System',
    shortTitle: '12 · Dodge, Roll & Slide (8D)',
    supportsEightDirections: true,
    description: 'Eight-directional dodges (DDG_D01–D08), tactical rolls (ROLL_D01–D08), ground slides (SLIDE_D01–D08), and locomotion transitions.',
  },
  {
    id: 'PART_13_STRAFE',
    partNumber: 'Part 13',
    title: 'Eight-Directional Strafe System',
    shortTitle: '13 · Strafe (8D)',
    supportsEightDirections: true,
    description: 'Combat and aiming strafe library (STR_D01–D08) across 7 tactical speeds and upper-body aim locks.',
  },
  {
    id: 'PART_14_TURN',
    partNumber: 'Part 14',
    title: 'Eight-Directional Turning System',
    shortTitle: '14 · Turn In-Place',
    supportsEightDirections: true,
    description: 'Pivot turn animations (±45°, ±90°, ±135°, ±180°) across Idle, Walk, Run, Sprint, Crouch, Stealth, and Combat.',
  },
  {
    id: 'PART_15_COMBAT_MOVE',
    partNumber: 'Part 15',
    title: 'Eight-Directional Combat Movement',
    shortTitle: '15 · Combat Move (8D)',
    supportsEightDirections: true,
    description: 'Unarmed tactical combat locomotion (walk, run, retreat, guarded, cautious, rapid) and combat stances.',
  },
  {
    id: 'PART_16_MELEE',
    partNumber: 'Part 16',
    title: 'Eight-Directional Melee Actions',
    shortTitle: '16 · Melee Combat (8D)',
    supportsEightDirections: true,
    description: 'Directional punches, combinations, blocks, parries, pushes, shoves, kicks, counters, and recoveries.',
  },
  {
    id: 'PART_17_HIT_REACT',
    partNumber: 'Part 17',
    title: 'Eight-Directional Hit Reactions',
    shortTitle: '17 · Hit Reactions (8D)',
    supportsEightDirections: true,
    description: 'Directional impact reactions (HIT_D01–D08), intensity tiers, staggers, and 7 anatomical impact zones.',
  },
  {
    id: 'PART_18_FALL_RECOVER',
    partNumber: 'Part 18',
    title: 'Eight-Directional Falling & Recovery',
    shortTitle: '18 · Fall & Recovery (8D)',
    supportsEightDirections: true,
    description: 'Directional knockdown falls (FALL_D01–D08), energy variants, and prone/supine/seated/kneeling get-ups.',
  },
  {
    id: 'PART_19_INJURED',
    partNumber: 'Part 19',
    title: 'Eight-Directional Injured Locomotion',
    shortTitle: '19 · Injured Gait (8D)',
    supportsEightDirections: true,
    description: 'Asymmetric injured walk, run, crouch walk, left/right leg limping, and exhausted directional movement.',
  },
  {
    id: 'PART_20_FATIGUE',
    partNumber: 'Part 20',
    title: 'Eight-Directional Exhaustion & Fatigue',
    shortTitle: '20 · Fatigue & Breath (8D)',
    supportsEightDirections: true,
    description: 'Fatigued directional locomotion plus light/medium/heavy fatigue idles, hands-on-knees, and sit/stand recovery.',
  },
  {
    id: 'PART_21_TRANSITION',
    partNumber: 'Part 21',
    title: 'Eight-Directional State Transitions',
    shortTitle: '21 · Transitions (8D)',
    supportsEightDirections: true,
    description: 'Seamless acceleration, deceleration, and posture transitions across all major movement states.',
  },
  {
    id: 'PART_22_HUMAN_IDLE',
    partNumber: 'Part 22',
    title: 'Stationary Human Idle & Behavioral Library',
    shortTitle: '22 · Human Idles (43)',
    supportsEightDirections: false,
    description: '43 natural idles, weight shifts, head/gaze tracks, emotional/behavioral reactions, and body stretches.',
  },
  {
    id: 'PART_23_INTERACTION',
    partNumber: 'Part 23',
    title: 'Eight-Directional Object Interactions',
    shortTitle: '23 · Interactions (8D)',
    supportsEightDirections: true,
    description: 'Directional approach, reach, bend, kneel, pick up, place, door open/close, push, pull, carry, and drop.',
  },
  {
    id: 'PART_24_CARRYING',
    partNumber: 'Part 24',
    title: 'Eight-Directional Carrying System',
    shortTitle: '24 · Carrying (8D)',
    supportsEightDirections: true,
    description: 'Carrying walk, fast walk, run, retreat, strafe, and crouch across light, medium, and heavy loads.',
  },
  {
    id: 'PART_25_TRAVERSAL',
    partNumber: 'Part 25',
    title: 'Eight-Directional Climbing & Traversal',
    shortTitle: '25 · Climb & Vault (8D)',
    supportsEightDirections: true,
    description: 'Obstacle traversal, step-overs, low vaults, platform climbs, ladder ascent/descent, rope climb, and hang.',
  },
];

function buildCatalog(): AnimationClipMeta[] {
  const clips: AnimationClipMeta[] = [];

  const add8DirSet = (
    partId: AnimationPartId,
    partNumber: string,
    partTitle: string,
    subGroup: string,
    prefix: string,
    duration: number,
    loop: boolean,
    speed: number,
    archetype: SynthesisArchetype,
    descBuilder: (dir: DirectionSpec) => string,
    extra?: Partial<AnimationClipMeta>
  ) => {
    for (const dir of EIGHT_DIRECTIONS) {
      clips.push({
        id: `${prefix}_${dir.id}`,
        name: `${prefix}_${dir.id} — ${dir.label} ${subGroup}`,
        partId,
        partNumber,
        partTitle,
        subGroup,
        direction: dir.id,
        duration,
        loop,
        speedMetersPerSec: speed,
        archetype,
        description: descBuilder(dir),
        ...extra,
      });
    }
  };

  // ============================================================================
  // PART 05 — WALKING LIBRARY (8 clips)
  // ============================================================================
  add8DirSet(
    'PART_05_WALK',
    'Part 05',
    'Eight-Directional Walking Library',
    'Standard Walk',
    'WLK',
    1.1,
    true,
    1.45,
    'locomotion_walk',
    (d) => `${d.label} walk cycle with alternating heel-toe contact and balanced pelvis rotation. ${d.biomechanicsNote}`
  );

  // ============================================================================
  // PART 06 — FAST WALK LIBRARY (8 clips)
  // ============================================================================
  add8DirSet(
    'PART_06_FAST_WALK',
    'Part 06',
    'Eight-Directional Fast Walk Library',
    'Fast Walk',
    'FWLK',
    0.86,
    true,
    2.1,
    'locomotion_fast_walk',
    (d) => `Purposeful ${d.label.toLowerCase()} fast walk with increased step frequency, active arm swing, and 6° torso lean.`
  );

  // ============================================================================
  // PART 07 — RUNNING LIBRARY (8 clips)
  // ============================================================================
  add8DirSet(
    'PART_07_RUN',
    'Part 07',
    'Eight-Directional Running Library',
    'Standard Run',
    'RUN',
    0.72,
    true,
    3.8,
    'locomotion_run',
    (d) => `Athletic ${d.label.toLowerCase()} run with increased knee drive, elbow flexion, and genuine directional leg trajectory.`
  );

  // ============================================================================
  // PART 08 — SPRINT LIBRARY (8 clips)
  // ============================================================================
  add8DirSet(
    'PART_08_SPRINT',
    'Part 08',
    'Eight-Directional Sprint Library',
    'High-Speed Sprint',
    'SPR',
    0.56,
    true,
    5.8,
    'locomotion_sprint',
    (d) => `High-power ${d.label.toLowerCase()} sprint with maximum hip extension, strong knee drive, and dynamic arm pumping.`
  );

  // ============================================================================
  // PART 09 — CROUCH WALK, CROUCH RUN, CROUCH IDLE & TRANSITIONS (45 clips)
  // ============================================================================
  add8DirSet(
    'PART_09_CROUCH',
    'Part 09',
    'Eight-Directional Crouching & Crouch-Run Library',
    'Crouch Walk',
    'CRW',
    1.18,
    true,
    0.98,
    'locomotion_crouch',
    (d) => `Lowered center-of-gravity ${d.label.toLowerCase()} crouch walk with flexed hips/knees, grounded feet, and stabilized head gaze.`
  );
  add8DirSet(
    'PART_09_CROUCH',
    'Part 09',
    'Eight-Directional Crouching & Crouch-Run Library',
    'Crouch Run',
    'CRUN',
    0.78,
    true,
    2.35,
    'locomotion_crouch_run',
    (d) => `Rapid ${d.label.toLowerCase()} crouch-running gait with bent knees, lowered hips, forward torso lean, coordinated arm balance, and grounded foot contact.`,
    { variantKey: 'CRUN' }
  );
  add8DirSet(
    'PART_09_CROUCH',
    'Part 09',
    'Eight-Directional Crouching & Crouch-Run Library',
    'Crouch Idle (8D)',
    'CRW_IDLE',
    2.4,
    true,
    0.0,
    'locomotion_crouch',
    (d) => `Stationary ${d.label.toLowerCase()}-oriented crouch idle with lowered hips, bent knees, planted feet, and natural breathing.`,
    { variantKey: 'CRW_IDLE' }
  );
  add8DirSet(
    'PART_09_CROUCH',
    'Part 09',
    'Eight-Directional Crouching & Crouch-Run Library',
    'Crouch to Stand Transition (8D)',
    'CRW_TO_STAND',
    0.68,
    false,
    0.0,
    'locomotion_crouch',
    (d) => `Smooth ${d.label.toLowerCase()}-aligned crouch-to-stand transition extending knees and hips with firmly grounded feet.`,
    { variantKey: 'CRW_TRANS_OUT' }
  );
  add8DirSet(
    'PART_09_CROUCH',
    'Part 09',
    'Eight-Directional Crouching & Crouch-Run Library',
    'Crouch-Run to Stand Transition (8D)',
    'CRUN_TO_STAND',
    0.74,
    false,
    1.35,
    'locomotion_crouch_run',
    (d) => `Decelerating from ${d.label.toLowerCase()} crouch-run and smoothly rising to an upright standing posture without foot sliding.`,
    { variantKey: 'TR_CRUN_STAND' }
  );
  const crouchExtras: Array<[string, string, number, boolean, string]> = [
    ['CRW_IDLE', 'Crouch Stationary Idle', 2.4, true, 'Balanced low crouch idle with flexed knees, planted feet, and alert forward gaze.'],
    ['CRW_BREATHE', 'Crouch Deep Breathing', 2.2, true, 'Stationary crouch with rhythmic thoracic ribcage expansion.'],
    ['CRW_TRANS_IN', 'Stand to Crouch Transition', 0.65, false, 'Smooth hip/knee flexion lowering center of mass from standing to crouch.'],
    ['CRW_TRANS_OUT', 'Crouch to Stand Transition', 0.65, false, 'Controlled quadriceps/gluteal extension rising from crouch to stand.'],
    ['TR_CRUN_STAND', 'Crouch-Run to Stand Transition', 0.74, false, 'Smooth braking and hip/knee extension from crouch-run into upright standing idle.'],
  ];
  for (const [id, label, dur, loop, desc] of crouchExtras) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_09_CROUCH',
      partNumber: 'Part 09',
      partTitle: 'Eight-Directional Crouching & Crouch-Run Library',
      subGroup: 'Crouch Stationary & Transitions',
      direction: 'D01',
      duration: dur,
      loop,
      speedMetersPerSec: id === 'TR_CRUN_STAND' ? 1.35 : 0,
      archetype: id === 'TR_CRUN_STAND' ? 'locomotion_crouch_run' : 'locomotion_crouch',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 10 — STEALTH LIBRARY (17 clips)
  // ============================================================================
  add8DirSet(
    'PART_10_STEALTH',
    'Part 10',
    'Eight-Directional Stealth Library',
    'Stealth Creep',
    'STL',
    1.35,
    true,
    0.85,
    'locomotion_stealth',
    (d) => `Quiet ${d.label.toLowerCase()} stealth step with minimal vertical bounce, guarded arms, and careful forefoot placement.`
  );
  const stealthExtras: Array<[string, string, number, boolean, string]> = [
    ['STL_IDLE', 'Stealth Idle', 2.6, true, 'Low-profile stealth stance with quiet weight distribution.'],
    ['STL_BREATHE', 'Stealth Controlled Breathing', 2.4, true, 'Subtle, quiet chest breathing in stealth readiness.'],
    ['STL_LOOK_L', 'Stealth Peer Left', 1.8, false, 'Careful cervical/thoracic scan toward the left corner.'],
    ['STL_LOOK_R', 'Stealth Peer Right', 1.8, false, 'Careful cervical/thoracic scan toward the right corner.'],
    ['STL_START', 'Stealth Step Initiation', 0.6, false, 'Cautious weight transfer initiating stealth locomotion.'],
    ['STL_STOP', 'Stealth Quiet Stop', 0.6, false, 'Controlled arrest of momentum settling into stealth idle.'],
    ['STL_TO_WLK', 'Stealth to Normal Walk', 0.7, false, 'Rising from stealth posture into natural walking gait.'],
    ['STL_TO_CRW', 'Stealth to Deep Crouch', 0.65, false, 'Lowering further from stealth stance into full deep crouch.'],
    ['STL_RECOVER', 'Stealth Balance Recovery', 0.8, false, 'Quiet ankle/hip stabilization returning to stealth equilibrium.'],
  ];
  for (const [id, label, dur, loop, desc] of stealthExtras) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_10_STEALTH',
      partNumber: 'Part 10',
      partTitle: 'Eight-Directional Stealth Library',
      subGroup: 'Stealth Stationary & Transitions',
      duration: dur,
      loop,
      speedMetersPerSec: 0,
      archetype: 'locomotion_stealth',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 11 — JUMPING SYSTEM (47 clips)
  // ============================================================================
  add8DirSet(
    'PART_11_JUMP',
    'Part 11',
    'Eight-Directional Jumping, Running Jump & Landing',
    'Directional Jump',
    'JUMP',
    1.22,
    false,
    2.6,
    'jump_directional',
    (d) => `6-phase ${d.label.toLowerCase()} jump: grounded anticipation squat, simultaneous bilateral takeoff, parabolic airborne arc, pre-landing extension, bent-knee landing absorption, and smooth recovery.`
  );
  add8DirSet(
    'PART_11_JUMP',
    'Part 11',
    'Eight-Directional Jumping, Running Jump & Landing',
    'Jump While Running (8D)',
    'JUMP_RUN',
    1.08,
    true,
    3.8,
    'jump_specialized',
    (d) => `Continuous ${d.label.toLowerCase()} jump while running: active running stride into dynamic takeoff, parabolic flight posture, bent-knee landing absorption, and seamless continuation into run.`,
    { variantKey: 'JUMP_WHILE_RUN' }
  );
  add8DirSet(
    'PART_11_JUMP',
    'Part 11',
    'Eight-Directional Jumping, Running Jump & Landing',
    'Running to Jump Transition (8D)',
    'TR_RUN_JUMP',
    0.72,
    false,
    3.6,
    'jump_specialized',
    (d) => `${d.label} running-to-jump transition converting horizontal running momentum into crouch anticipation and upward takeoff launch.`,
    { variantKey: 'TR_RUN_JUMP' }
  );
  add8DirSet(
    'PART_11_JUMP',
    'Part 11',
    'Eight-Directional Jumping, Running Jump & Landing',
    'Jump to Running Landing Transition (8D)',
    'TR_JUMP_RUN',
    0.76,
    false,
    3.5,
    'jump_specialized',
    (d) => `${d.label} jump-to-running landing transition: descending from airborne posture into bent-knee impact absorption and smooth acceleration into running stride.`,
    { variantKey: 'TR_JUMP_RUN' }
  );
  const jumpVariants: Array<[string, string, number, number, DirectionId | undefined, string]> = [
    ['JUMP_STAND_VERT', 'Standing Vertical Jump', 1.2, 0.0, 'D01', 'Pure vertical counter-movement jump with simultaneous bilateral takeoff, parabolic flight, and bent-knee landing.'],
    ['JUMP_FWD', 'Dedicated Forward Jump', 1.2, 2.8, 'D01', 'Forward momentum jump clearing horizontal gap with simultaneous two-foot takeoff and landing.'],
    ['JUMP_BWD', 'Dedicated Backward Jump', 1.15, 2.1, 'D05', 'Backward evasive jump with simultaneous forefoot push-off and balanced bent-knee landing.'],
    ['JUMP_SIDE_L', 'Side Jump Left', 1.1, 2.2, 'D07', 'Lateral left broad jump with bilateral hip abduction drive.'],
    ['JUMP_SIDE_R', 'Side Jump Right', 1.1, 2.2, 'D03', 'Lateral right broad jump with bilateral hip abduction drive.'],
    ['JUMP_RUN', 'Jump While Running (Forward)', 1.08, 3.8, 'D01', 'Dynamic jump while running with airborne stride posture and smooth transition back into running cycle.'],
    ['JUMP_SPRINT', 'Sprint Long-Arc Jump', 1.12, 5.2, 'D01', 'High-velocity sprint takeoff with extended flight parabola and cushioned landing into sprint.'],
    ['JUMP_HOP_SHORT', 'Short Hop', 0.78, 1.4, 'D01', 'Quick low-amplitude bilateral hop over minor ground hazard.'],
    ['JUMP_LONG', 'Athletic Broad Long Jump', 1.32, 4.0, 'D01', 'Maximum horizontal extension jump with forward leg reach and deep knee absorption on landing.'],
    ['JUMP_HIGH', 'Maximum High Jump', 1.36, 1.0, 'D01', 'Deep squat preload and explosive vertical reach jump with clean parabolic apex.'],
    ['JUMP_OBSTACLE_LOW', 'Low Obstacle Hurdle Jump', 1.04, 3.4, 'D01', 'Bilateral knee tuck clearing waist-high obstacle with cushioned landing.'],
    ['LAND_SMALL', 'Landing from Small Height', 0.68, 0.0, 'D01', 'Light ankle/knee flexion absorbing a 0.5m drop and recovering smoothly to idle.'],
    ['LAND_MED', 'Landing from Medium Height', 0.86, 0.0, 'D01', 'Moderate hip/knee/ankle flexion absorbing a 1.5m drop with natural arm balance.'],
    ['LAND_HEAVY', 'Heavy Impact Landing', 1.18, 0.0, 'D01', 'Deep squat compression absorbing high drop and extending smoothly back to standing idle.'],
    ['LAND_SOFT', 'Stealth Soft Landing', 0.82, 0.0, 'D01', 'Controlled forefoot-to-heel silent landing absorbing kinetic energy smoothly.'],
  ];
  for (const [id, label, dur, spd, dir, desc] of jumpVariants) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_11_JUMP',
      partNumber: 'Part 11',
      partTitle: 'Eight-Directional Jumping, Running Jump & Landing',
      subGroup: 'Specialized Jumps & Landings',
      direction: dir,
      duration: dur,
      loop: false,
      speedMetersPerSec: spd,
      archetype: 'jump_specialized',
      variantKey: id === 'JUMP_RUN' ? 'JUMP_WHILE_RUN' : id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 12 — DODGE, ROLL AND SLIDE SYSTEM (91 clips)
  // ============================================================================
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Directional Dodge',
    'DDG',
    0.78,
    false,
    3.6,
    'dodge_evade',
    (d) => `Rapid ${d.label.toLowerCase()} evasive weight transfer with low body lean, leg compression, and grounded recovery.`
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Eight-Directional Roll (8D)',
    'ROLL',
    0.98,
    false,
    3.8,
    'roll_directional',
    (d) => `Anatomically accurate ${d.label.toLowerCase()} tactical roll (ROLL_${d.id}) with eccentric dive weight transfer, tucked 360° ground rotation, and smooth recovery to idle.`,
    { variantKey: 'ROLL_STD' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Roll to Idle Transition (8D)',
    'ROLL_TO_IDLE',
    1.04,
    false,
    3.2,
    'roll_directional',
    (d) => `${d.label} tactical roll decelerating through shin-to-foot weight transfer into balanced standing idle.`,
    { variantKey: 'ROLL_TO_IDLE' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Roll to Run Transition (8D)',
    'ROLL_TO_RUN',
    0.94,
    false,
    4.2,
    'roll_directional',
    (d) => `Continuous ${d.label.toLowerCase()} roll surging out of ground rotation directly into full running locomotion stride.`,
    { variantKey: 'ROLL_TO_RUN' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Run to Roll Transition (8D)',
    'RUN_TO_ROLL',
    0.96,
    false,
    4.1,
    'roll_directional',
    (d) => `Diving from ${d.label.toLowerCase()} running stride into a tucked 360° shoulder roll with smooth locomotion exit.`,
    { variantKey: 'RUN_TO_ROLL' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Landing into Roll (8D)',
    'LAND_ROLL',
    1.02,
    false,
    3.6,
    'roll_directional',
    (d) => `High-impact ${d.label.toLowerCase()} drop landing converting vertical momentum into a parkour breakfall roll.`,
    { variantKey: 'LAND_ROLL' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Eight-Directional Slide (8D)',
    'SLIDE',
    0.96,
    false,
    4.4,
    'slide_directional',
    (d) => `Low-profile ${d.label.toLowerCase()} tactical ground slide (SLIDE_${d.id}) with extended lead leg, tucked figure-4 trail leg, reclined torso balance, and grounded recovery.`,
    { variantKey: 'SLIDE_STD' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Run to Slide Transition (8D)',
    'RUN_TO_SLIDE',
    0.92,
    false,
    4.6,
    'slide_directional',
    (d) => `High-speed ${d.label.toLowerCase()} run dropping rapidly onto the outer hip and shin into a ground slide.`,
    { variantKey: 'RUN_TO_SLIDE' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Slide to Run Transition (8D)',
    'SLIDE_TO_RUN',
    0.94,
    false,
    4.3,
    'slide_directional',
    (d) => `Driving off the tucked trail leg out of a ${d.label.toLowerCase()} slide directly back into running locomotion.`,
    { variantKey: 'SLIDE_TO_RUN' }
  );
  add8DirSet(
    'PART_12_DODGE',
    'Part 12',
    'Eight-Directional Dodge, Roll & Slide System',
    'Slide to Crouch Transition (8D)',
    'SLIDE_TO_CROUCH',
    0.88,
    false,
    3.2,
    'slide_directional',
    (d) => `Braking at the end of a ${d.label.toLowerCase()} slide and gathering both feet into a low tactical crouch.`,
    { variantKey: 'SLIDE_TO_CROUCH' }
  );
  const dodgeVariants: Array<[string, string, number, DirectionId, string]> = [
    ['DDG_SHORT', 'Short Micro-Dodge', 0.55, 'D03', 'Compact slip step evading close-range strike without losing footing.'],
    ['DDG_LONG', 'Long Lunge Dodge', 0.92, 'D07', 'Wide lateral-diagonal burst creating maximum separation distance.'],
    ['DDG_SIDESTEP_QUICK', 'Quick Sidestep', 0.58, 'D03', 'Crisp boxing-style lateral sidestep with guard raised.'],
    ['DDG_SIDESTEP_EMERG', 'Emergency Sidestep', 0.72, 'D07', 'High-urgency evasive torso drop and lateral push-off.'],
    ['DDG_EVADE_BWD', 'Backward Evasive Step', 0.65, 'D05', 'Rapid rear step pulling head and chest out of strike range.'],
    ['DDG_EVADE_FWD', 'Forward Slip Step', 0.65, 'D01', 'Aggressive duck-and-slip forward step closing inside guard.'],
    ['DDG_EVADE_L', 'Left Evasive Step', 0.64, 'D07', 'Dedicated left evasive pivot step.'],
    ['DDG_EVADE_R', 'Right Evasive Step', 0.64, 'D03', 'Dedicated right evasive pivot step.'],
    ['DDG_RECOVER', 'Dodge Equilibrium Recovery', 0.6, 'D01', 'Stabilizing stance from wide dodge back to neutral readiness.'],
    ['DDG_TO_RUN', 'Dodge into Run Transition', 0.75, 'D01', 'Chaining dodge momentum directly into forward running stride.'],
    ['DDG_TO_CRW', 'Dodge into Crouch Transition', 0.7, 'D05', 'Settling low dodge compression directly into tactical crouch.'],
  ];
  for (const [id, label, dur, dir, desc] of dodgeVariants) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_12_DODGE',
      partNumber: 'Part 12',
      partTitle: 'Eight-Directional Dodge, Roll & Slide System',
      subGroup: 'Evasion Variations & Transitions',
      direction: dir,
      duration: dur,
      loop: false,
      speedMetersPerSec: 3.2,
      archetype: 'dodge_evade',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 13 — EIGHT-DIRECTIONAL STRAFE SYSTEM (56 clips: 7 modes x 8 directions)
  // ============================================================================
  add8DirSet(
    'PART_13_STRAFE',
    'Part 13',
    'Eight-Directional Strafe System',
    'Normal Strafe',
    'STR',
    0.95,
    true,
    1.8,
    'strafe_combat',
    (d) => `Primary ${d.label.toLowerCase()} strafe (STR_${d.id}) keeping upper body locked on forward target while lower body tracks ${d.label.toLowerCase()}.`,
    { variantKey: 'STR_NORM' }
  );
  const strafeModes: Array<[string, string, number, number]> = [
    ['STR_FAST', 'Fast Strafe', 0.72, 2.7],
    ['STR_SLOW', 'Slow Precision Strafe', 1.25, 1.1],
    ['STR_CMB', 'Combat Strafe', 0.88, 2.0],
    ['STR_AIM', 'Aiming Upper-Body Lock Strafe', 0.96, 1.65],
    ['STR_DEF', 'Defensive Low-Guard Strafe', 0.98, 1.55],
    ['STR_GRD', 'Guarded High-Cover Strafe', 1.0, 1.5],
  ];
  for (const [prefix, subGroup, dur, spd] of strafeModes) {
    add8DirSet(
      'PART_13_STRAFE',
      'Part 13',
      'Eight-Directional Strafe System',
      subGroup,
      prefix,
      dur,
      true,
      spd,
      'strafe_combat',
      (d) => `${subGroup} in ${d.label.toLowerCase()} direction with independent upper-body aim orientation.`,
      { variantKey: prefix }
    );
  }

  // ============================================================================
  // PART 14 — EIGHT-DIRECTIONAL TURNING SYSTEM (56 clips: 8 angles x 7 stances)
  // ============================================================================
  const turnAngles: Array<[string, string, number, DirectionId]> = [
    ['L45', 'Turn 45° Left', -45, 'D08'],
    ['R45', 'Turn 45° Right', 45, 'D02'],
    ['L90', 'Turn 90° Left', -90, 'D07'],
    ['R90', 'Turn 90° Right', 90, 'D03'],
    ['L135', 'Turn 135° Left', -135, 'D06'],
    ['R135', 'Turn 135° Right', 135, 'D04'],
    ['L180', 'Turn 180° Left', -180, 'D05'],
    ['R180', 'Turn 180° Right', 180, 'D05'],
  ];
  const turnStances: Array<[string, string, number]> = [
    ['IDLE', 'From Idle', 0.75],
    ['WLK', 'From Walking', 0.68],
    ['RUN', 'From Running', 0.58],
    ['SPR', 'From Sprinting', 0.54],
    ['CRW', 'From Crouching', 0.82],
    ['STL', 'From Stealth', 0.85],
    ['CMB', 'From Combat Stance', 0.64],
  ];
  for (const [stanceKey, stanceLabel, baseDur] of turnStances) {
    for (const [angKey, angLabel, deg, dir] of turnAngles) {
      const id = `TURN_${stanceKey}_${angKey}`;
      clips.push({
        id,
        name: `${id} — ${angLabel} (${stanceLabel})`,
        partId: 'PART_14_TURN',
        partNumber: 'Part 14',
        partTitle: 'Eight-Directional Turning System',
        subGroup: `Turns ${stanceLabel}`,
        direction: dir,
        duration: baseDur * (Math.abs(deg) > 90 ? 1.2 : 1.0),
        loop: false,
        speedMetersPerSec: 0,
        archetype: 'turn_in_place',
        variantKey: stanceKey,
        turnAngleDeg: deg,
        description: `${angLabel} ${stanceLabel.toLowerCase()} with authentic lead-foot ball pivot and trail-foot step-plant (zero foot sliding).`,
      });
    }
  }

  // ============================================================================
  // PART 15 — EIGHT-DIRECTIONAL COMBAT MOVEMENT (73 clips)
  // ============================================================================
  const combatMoveSets: Array<[string, string, number, number]> = [
    ['CMB_WLK', 'Combat Walk', 0.95, 1.55],
    ['CMB_RUN', 'Combat Run', 0.68, 3.5],
    ['CMB_RET', 'Combat Retreat', 0.92, 1.65],
    ['CMB_STR', 'Combat Strafe', 0.86, 1.9],
    ['CMB_GRD', 'Guarded Movement', 1.0, 1.35],
    ['CMB_DEF', 'Defensive Movement', 0.98, 1.4],
    ['CMB_CAUT', 'Cautious Advance', 1.12, 1.15],
    ['CMB_RAPD', 'Rapid Advance', 0.64, 3.9],
  ];
  for (const [prefix, subGroup, dur, spd] of combatMoveSets) {
    add8DirSet(
      'PART_15_COMBAT_MOVE',
      'Part 15',
      'Eight-Directional Combat Movement',
      subGroup,
      prefix,
      dur,
      true,
      spd,
      'combat_locomotion',
      (d) => `Unarmed ${subGroup.toLowerCase()} toward ${d.label.toLowerCase()} with balanced boxer footwork and chin-tucked guard.`,
      { variantKey: prefix }
    );
  }
  const combatStationary: Array<[string, string, number, boolean, string]> = [
    ['CMB_IDLE', 'Combat Ready Idle', 1.8, true, 'Balanced martial readiness stance with active weight rhythm and raised forearms.'],
    ['CMB_BREATHE', 'Combat Heavy Breathing', 1.6, true, 'High-alert combat breathing with shoulder and ribcage expansion.'],
    ['CMB_GUARD_UP', 'Raise Guard Up', 0.5, false, 'Snap forearms and fists up to protect jawline and temples.'],
    ['CMB_GUARD_DOWN', 'Lower Guard Down', 0.55, false, 'Relax arms from high guard down to waist-level readiness.'],
    ['CMB_STANCE_READY', 'Orthodox Ready Stance', 2.0, true, 'Orthodox left-foot-lead fighting stance with responsive knee bounce.'],
    ['CMB_STANCE_RELAX', 'Relaxed Combat Stance', 2.2, true, 'Low-energy open-guard stance maintaining distance awareness.'],
    ['CMB_STANCE_DEF', 'Defensive Shell Stance', 2.0, true, 'Tight elbows-in, chin-down defensive shell posture.'],
    ['CMB_BALANCE_REC', 'Combat Balance Recovery', 0.7, false, 'Quick widening of base to recover equilibrium after impact.'],
    ['CMB_STANCE_TRANS', 'Stance Switch (Orthodox/Southpaw)', 0.65, false, 'Smooth hop-pivot switching lead foot and guard side.'],
  ];
  for (const [id, label, dur, loop, desc] of combatStationary) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_15_COMBAT_MOVE',
      partNumber: 'Part 15',
      partTitle: 'Eight-Directional Combat Movement',
      subGroup: 'Stationary Combat Stances',
      duration: dur,
      loop,
      speedMetersPerSec: 0,
      archetype: 'combat_stationary',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 16 — EIGHT-DIRECTIONAL MELEE ACTIONS (80 clips)
  // ============================================================================
  const meleeSets: Array<[string, string, number, 'left' | 'right' | 'both']> = [
    ['MLE_PUNCH_L', 'Left Jab / Hook Punch', 0.62, 'left'],
    ['MLE_PUNCH_R', 'Right Cross Punch', 0.68, 'right'],
    ['MLE_COMBO', 'Two-Hit Punch Combination', 0.95, 'both'],
    ['MLE_BLOCK', 'High Forearm Defensive Block', 0.58, 'both'],
    ['MLE_PARRY', 'Inside Deflection Parry', 0.56, 'left'],
    ['MLE_PUSH', 'Two-Hand Tactical Push', 0.74, 'both'],
    ['MLE_SHOVE', 'Shoulder & Palm Shove', 0.78, 'right'],
    ['MLE_KICK', 'Front / Oblique Snap Kick', 0.82, 'right'],
    ['MLE_COUNTER', 'Slip & Counter Strike', 0.86, 'right'],
    ['MLE_RECOVER', 'Melee Follow-Through Recovery', 0.64, 'both'],
  ];
  for (const [prefix, subGroup, dur, hand] of meleeSets) {
    add8DirSet(
      'PART_16_MELEE',
      'Part 16',
      'Eight-Directional Melee Actions',
      subGroup,
      prefix,
      dur,
      false,
      0.8,
      'melee_action',
      (d) => `Anatomically grounded ${subGroup.toLowerCase()} directed toward ${d.label} (${d.id}) with kinetic chain transfer from ankle, hip, spine, and scapula.`,
      { variantKey: prefix, handSide: hand }
    );
  }

  // ============================================================================
  // PART 17 — EIGHT-DIRECTIONAL HIT REACTION LIBRARY (49 clips)
  // ============================================================================
  add8DirSet(
    'PART_17_HIT_REACT',
    'Part 17',
    'Eight-Directional Hit Reactions',
    'Standard Hit Reaction',
    'HIT',
    0.72,
    false,
    0.6,
    'hit_reaction',
    (d) => `Directional impact reaction from ${d.label} (${d.id}) with realistic momentum transfer and cervical/thoracic recoil.`,
    { intensity: 'medium', variantKey: 'HIT_STD' }
  );
  add8DirSet(
    'PART_17_HIT_REACT',
    'Part 17',
    'Eight-Directional Hit Reactions',
    'Light Impact Reaction',
    'HIT_LGT',
    0.52,
    false,
    0.2,
    'hit_reaction',
    (d) => `Light flinch reaction from ${d.label} (${d.id}) without breaking foot stance.`,
    { intensity: 'light', variantKey: 'HIT_LGT' }
  );
  add8DirSet(
    'PART_17_HIT_REACT',
    'Part 17',
    'Eight-Directional Hit Reactions',
    'Heavy Impact Reaction',
    'HIT_HVY',
    0.95,
    false,
    1.2,
    'hit_reaction',
    (d) => `Heavy blow recoil from ${d.label} (${d.id}) forcing compensatory recovery step.`,
    { intensity: 'heavy', variantKey: 'HIT_HVY' }
  );
  add8DirSet(
    'PART_17_HIT_REACT',
    'Part 17',
    'Eight-Directional Hit Reactions',
    'Directional Stagger',
    'HIT_STG',
    1.15,
    false,
    1.6,
    'hit_reaction',
    (d) => `Multi-step directional stagger toward ${d.label} (${d.id}) fighting to regain balance.`,
    { intensity: 'heavy', variantKey: 'HIT_STG' }
  );
  const hitZones: Array<[string, string, number, string]> = [
    ['HIT_UNBALANCE', 'Loss of Balance Wobble', 1.2, 'Severe equilibrium disruption with windmill arm stabilization.'],
    ['HIT_RECOVER', 'Post-Hit Stance Recovery', 0.7, 'Shaking off impact and re-establishing guard posture.'],
    ['HIT_ZONE_HEAD', 'Head Impact Recoil', 0.68, 'Sharp cervical extension and head snap with protective hand raise.'],
    ['HIT_ZONE_TORSO_UP', 'Upper Torso / Sternum Impact', 0.74, 'Thoracic compression and shoulder recoil from chest impact.'],
    ['HIT_ZONE_TORSO_LOW', 'Lower Torso / Gut Impact', 0.85, 'Visceral abdominal fold and knee buckle from solar plexus impact.'],
    ['HIT_ZONE_ARM_L', 'Left Arm Impact', 0.62, 'Left shoulder posterior twist and forearm numbness shake.'],
    ['HIT_ZONE_ARM_R', 'Right Arm Impact', 0.62, 'Right shoulder posterior twist and forearm recoil.'],
    ['HIT_ZONE_LEG_L', 'Left Leg Sweep / Low Kick Impact', 0.78, 'Left knee buckle and momentary weight shift onto right leg.'],
    ['HIT_ZONE_LEG_R', 'Right Leg Sweep / Low Kick Impact', 0.78, 'Right knee buckle and momentary weight shift onto left leg.'],
  ];
  for (const [id, label, dur, desc] of hitZones) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_17_HIT_REACT',
      partNumber: 'Part 17',
      partTitle: 'Eight-Directional Hit Reactions',
      subGroup: 'Anatomical Impact Zones & Recovery',
      direction: 'D01',
      duration: dur,
      loop: false,
      speedMetersPerSec: 0.3,
      archetype: 'hit_reaction',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 18 — EIGHT-DIRECTIONAL FALLING AND RECOVERY (28 clips)
  // ============================================================================
  add8DirSet(
    'PART_18_FALL_RECOVER',
    'Part 18',
    'Eight-Directional Falling & Recovery',
    'Directional Fall',
    'FALL',
    1.35,
    false,
    1.5,
    'fall_sequence',
    (d) => `Anatomically realistic ${d.label.toLowerCase()} collapse (FALL_${d.id}) with progressive knee buckle, hip drop, and protective arm absorption.`
  );
  const fallAndRecoveries: Array<[string, string, string, number, SynthesisArchetype, string]> = [
    ['FALL_CTRL', 'Controlled Breakfall', 'Fall Energy Variants', 1.2, 'fall_sequence', 'Tactical breakfall tucking chin and dispersing impact across forearms/back.'],
    ['FALL_UNCTRL', 'Uncontrolled Ragdoll-Style Collapse', 'Fall Energy Variants', 1.45, 'fall_sequence', 'Sudden loss of muscular support collapsing vertically and forward.'],
    ['FALL_LOW_NRG', 'Low-Energy Exhaustion Slump', 'Fall Energy Variants', 1.5, 'fall_sequence', 'Slow drop to knees and side from stamina depletion.'],
    ['FALL_HIGH_NRG', 'High-Energy Knockback Fall', 'Fall Energy Variants', 1.3, 'fall_sequence', 'High-momentum knockdown sliding across ground plane.'],
    ['REC_GETUP_FRONT', 'Get Up from Front (Prone)', 'Recovery Library', 1.6, 'recovery_getup', 'Push-up from prone position, drawing one knee under pelvis and rising to stand.'],
    ['REC_GETUP_BACK', 'Get Up from Back (Supine)', 'Recovery Library', 1.65, 'recovery_getup', 'Sit up from supine, plant one hand behind hip, sweep leg under, and stand.'],
    ['REC_GETUP_LEFT', 'Get Up from Left Side', 'Recovery Library', 1.5, 'recovery_getup', 'Lateral elbow prop on left side transitioning through side-kneel to stand.'],
    ['REC_GETUP_RIGHT', 'Get Up from Right Side', 'Recovery Library', 1.5, 'recovery_getup', 'Lateral elbow prop on right side transitioning through side-kneel to stand.'],
    ['REC_KNEEL', 'Kneeling Recovery to Stand', 'Recovery Library', 1.1, 'recovery_getup', 'Drive off lead foot from one-knee posture back to standing equilibrium.'],
    ['REC_SEATED', 'Seated Recovery to Stand', 'Recovery Library', 1.35, 'recovery_getup', 'Tuck heels under hips from seated floor posture and extend up.'],
    ['REC_PRONE', 'Prone Stabilization to Ready', 'Recovery Library', 1.55, 'recovery_getup', 'Full prone floor recovery checking surroundings while rising.'],
    ['REC_SUPINE', 'Supine Stabilization to Ready', 'Recovery Library', 1.6, 'recovery_getup', 'Full supine floor roll and rise to balanced stance.'],
  ];
  for (const [id, label, subGroup, dur, arch, desc] of fallAndRecoveries) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_18_FALL_RECOVER',
      partNumber: 'Part 18',
      partTitle: 'Eight-Directional Falling & Recovery',
      subGroup,
      direction: 'D01',
      duration: dur,
      loop: false,
      speedMetersPerSec: 0.4,
      archetype: arch,
      variantKey: id,
      description: desc,
    });
  }
  add8DirSet(
    'PART_18_FALL_RECOVER',
    'Part 18',
    'Eight-Directional Falling & Recovery',
    'Directional Get-Up Transition',
    'REC_DIR',
    1.45,
    false,
    1.1,
    'recovery_getup',
    (d) => `Rising from ground directly into ${d.label.toLowerCase()} movement vector (${d.id}).`,
    { variantKey: 'REC_DIR' }
  );

  // ============================================================================
  // PART 19 — EIGHT-DIRECTIONAL INJURED LOCOMOTION (48 clips)
  // ============================================================================
  add8DirSet(
    'PART_19_INJURED',
    'Part 19',
    'Eight-Directional Injured Locomotion',
    'Injured Walk',
    'INJ_WLK',
    1.35,
    true,
    0.95,
    'injured_locomotion',
    (d) => `Guarded ${d.label.toLowerCase()} injured walk with shortened stride, torso lean, and protective hand near ribs.`,
    { variantKey: 'INJ_WLK', legSide: 'left' }
  );
  add8DirSet(
    'PART_19_INJURED',
    'Part 19',
    'Eight-Directional Injured Locomotion',
    'Injured Run',
    'INJ_RUN',
    0.92,
    true,
    2.4,
    'injured_locomotion',
    (d) => `Hurried asymmetric ${d.label.toLowerCase()} injured run favoring uninjured leg with strained upper body.`,
    { variantKey: 'INJ_RUN', legSide: 'left' }
  );
  add8DirSet(
    'PART_19_INJURED',
    'Part 19',
    'Eight-Directional Injured Locomotion',
    'Injured Crouch Walk',
    'INJ_CRW',
    1.45,
    true,
    0.72,
    'injured_locomotion',
    (d) => `Low ${d.label.toLowerCase()} injured crouch walk with asymmetric hip drop and careful weight unloading.`,
    { variantKey: 'INJ_CRW', legSide: 'left' }
  );
  add8DirSet(
    'PART_19_INJURED',
    'Part 19',
    'Eight-Directional Injured Locomotion',
    'Left-Leg Limp',
    'LIMP_L',
    1.4,
    true,
    0.88,
    'injured_locomotion',
    (d) => `Pronounced left-leg antalgic limp toward ${d.label.toLowerCase()} with shortened left stance time.`,
    { variantKey: 'LIMP_L', legSide: 'left' }
  );
  add8DirSet(
    'PART_19_INJURED',
    'Part 19',
    'Eight-Directional Injured Locomotion',
    'Right-Leg Limp',
    'LIMP_R',
    1.4,
    true,
    0.88,
    'injured_locomotion',
    (d) => `Pronounced right-leg antalgic limp toward ${d.label.toLowerCase()} with shortened right stance time.`,
    { variantKey: 'LIMP_R', legSide: 'right' }
  );
  add8DirSet(
    'PART_19_INJURED',
    'Part 19',
    'Eight-Directional Injured Locomotion',
    'Exhausted Stagger Gait',
    'EXH',
    1.5,
    true,
    0.82,
    'injured_locomotion',
    (d) => `Depleted ${d.label.toLowerCase()} movement with rounded shoulders, heavy head droop, and dragging recovery foot.`,
    { variantKey: 'EXH' }
  );

  // ============================================================================
  // PART 20 — EIGHT-DIRECTIONAL EXHAUSTION AND FATIGUE (55 clips)
  // ============================================================================
  const fatigueLocomotionSets: Array<[string, string, number, number]> = [
    ['FAT_WLK', 'Fatigued Walking', 1.32, 1.05],
    ['FAT_RUN', 'Fatigued Running', 0.88, 2.6],
    ['FAT_CRW', 'Fatigued Crouching', 1.4, 0.78],
    ['FAT_RET', 'Exhausted Retreat', 1.36, 0.95],
    ['FAT_SIDE', 'Exhausted Side Movement', 1.34, 0.92],
    ['FAT_BRTH', 'Heavy Breathing Locomotion', 1.25, 1.15],
  ];
  for (const [prefix, subGroup, dur, spd] of fatigueLocomotionSets) {
    add8DirSet(
      'PART_20_FATIGUE',
      'Part 20',
      'Eight-Directional Exhaustion & Fatigue',
      subGroup,
      prefix,
      dur,
      true,
      spd,
      'fatigue_locomotion',
      (d) => `${subGroup} toward ${d.label.toLowerCase()} with labored thoracic heave and reduced vertical lift.`,
      { variantKey: prefix }
    );
  }
  const fatigueStationary: Array<[string, string, number, boolean, string]> = [
    ['FAT_IDLE_LIGHT', 'Light Fatigue Idle', 2.2, true, 'Elevated breathing rate with slight shoulder drop after exertion.'],
    ['FAT_IDLE_MED', 'Medium Fatigue Idle', 2.0, true, 'Noticeable chest heave, forward spine inclination, and loose arms.'],
    ['FAT_IDLE_HEAVY', 'Heavy Fatigue Idle', 1.8, true, 'Deep labored respiration with head bowed and knees slightly bent.'],
    ['FAT_CATCH_BREATH', 'Catching Breath', 2.6, true, 'Hands resting on hips while expanding ribcage to recover oxygen.'],
    ['FAT_HANDS_KNEES', 'Hands-on-Knees Recovery', 2.8, true, 'Bent at waist bracing both palms on knees while breathing heavily.'],
    ['FAT_SIT_DOWN', 'Sitting Down from Exhaustion', 1.7, false, 'Controlled descent lowering hips onto ground to rest.'],
    ['FAT_STAND_UP', 'Standing Up After Exhaustion', 1.8, false, 'Pushing off thigh with palm to rise back to standing posture.'],
  ];
  for (const [id, label, dur, loop, desc] of fatigueStationary) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_20_FATIGUE',
      partNumber: 'Part 20',
      partTitle: 'Eight-Directional Exhaustion & Fatigue',
      subGroup: 'Stationary Fatigue & Recovery',
      duration: dur,
      loop,
      speedMetersPerSec: 0,
      archetype: 'fatigue_stationary',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 21 — EIGHT-DIRECTIONAL TRANSITION ANIMATIONS (54 clips)
  // ============================================================================
  add8DirSet(
    'PART_21_TRANSITION',
    'Part 21',
    'Eight-Directional State Transitions',
    'Idle to Walk Start (8D)',
    'TR_IDLE_WLK',
    0.65,
    false,
    1.2,
    'state_transition',
    (d) => `Smooth weight shift and initial step from standing idle into ${d.label.toLowerCase()} walk (${d.id}).`,
    { variantKey: 'TR_IDLE_WLK' }
  );
  add8DirSet(
    'PART_21_TRANSITION',
    'Part 21',
    'Eight-Directional State Transitions',
    'Idle to Run Start (8D)',
    'TR_IDLE_RUN',
    0.62,
    false,
    2.8,
    'state_transition',
    (d) => `Dynamic lean and push-off from idle into ${d.label.toLowerCase()} run (${d.id}).`,
    { variantKey: 'TR_IDLE_RUN' }
  );
  add8DirSet(
    'PART_21_TRANSITION',
    'Part 21',
    'Eight-Directional State Transitions',
    'Walk to Idle Stop (8D)',
    'TR_WLK_IDLE',
    0.65,
    false,
    0.7,
    'state_transition',
    (d) => `Deceleration plant and trail-foot alignment from ${d.label.toLowerCase()} walk into clean idle.`,
    { variantKey: 'TR_WLK_IDLE' }
  );
  add8DirSet(
    'PART_21_TRANSITION',
    'Part 21',
    'Eight-Directional State Transitions',
    'Run to Idle Stop (8D)',
    'TR_RUN_IDLE',
    0.78,
    false,
    1.6,
    'state_transition',
    (d) => `Two-step braking absorption from ${d.label.toLowerCase()} run settling smoothly into idle without sliding.`,
    { variantKey: 'TR_RUN_IDLE' }
  );
  add8DirSet(
    'PART_21_TRANSITION',
    'Part 21',
    'Eight-Directional State Transitions',
    'Crouch to Stand Transition (8D)',
    'TR_CRW_STAND',
    0.68,
    false,
    0.0,
    'state_transition',
    (d) => `Smooth ${d.label.toLowerCase()} crouch-to-stand transition extending hips and knees with grounded feet.`,
    { variantKey: 'TR_CRW_STAND' }
  );
  add8DirSet(
    'PART_21_TRANSITION',
    'Part 21',
    'Eight-Directional State Transitions',
    'Crouch-Run to Stand Transition (8D)',
    'TR_CRUN_STAND',
    0.74,
    false,
    1.35,
    'state_transition',
    (d) => `Decelerating from ${d.label.toLowerCase()} crouch-run and extending knees/hips into upright standing idle without foot sliding.`,
    { variantKey: 'TR_CRUN_STAND' }
  );
  const stateTransitions: Array<[string, string, number, number, string]> = [
    ['TR_IDLE_SPR', 'Idle to Sprint Burst', 0.6, 4.2, 'Explosive forward torso drop and drive phase from standstill to sprint.'],
    ['TR_WLK_RUN', 'Walk to Run Acceleration', 0.58, 2.6, 'Cadence and stride expansion blending walk cycle into run.'],
    ['TR_RUN_SPR', 'Run to Sprint Acceleration', 0.55, 4.8, 'Lowering chest angle and maximizing knee lift into full sprint.'],
    ['TR_SPR_RUN', 'Sprint to Run Deceleration', 0.62, 4.4, 'Rising torso posture and moderating stride from sprint to run.'],
    ['TR_RUN_WLK', 'Run to Walk Downshift', 0.65, 2.4, 'Absorbing flight phase into grounded heel-toe walking gait.'],
    ['TR_SPR_IDLE', 'Sprint to Hard Stop Idle', 0.92, 2.5, 'Multi-step athletic deceleration with lowered hips to arrest sprint momentum.'],
    ['TR_WLK_CRW', 'Walk to Crouch Walk', 0.6, 1.2, 'Flexing hips and knees mid-stride to enter crouch locomotion.'],
    ['TR_RUN_CRW', 'Run to Tactical Crouch', 0.68, 2.0, 'Rapid drop of center of mass from run into low crouch walk.'],
    ['TR_RUN_CRUN', 'Run to Crouch-Run Transition', 0.62, 3.0, 'Lowering hips and bending knees mid-run into low-profile crouch-run.'],
    ['TR_CRUN_RUN', 'Crouch-Run to Upright Run Transition', 0.62, 3.1, 'Extending hips and torso upward from crouch-run into full running stride.'],
    ['TR_CRW_WLK', 'Crouch to Normal Walk', 0.62, 1.2, 'Extending legs mid-stride from crouch back to upright walk.'],
    ['TR_CRW_RUN', 'Crouch to Explosive Run', 0.6, 2.8, 'Driving out of low crouch posture directly into running stride.'],
    ['TR_STL_WLK', 'Stealth to Normal Walk', 0.6, 1.15, 'Relaxing stealth tension into natural upright walking cycle.'],
    ['TR_WLK_STL', 'Normal Walk to Stealth', 0.62, 1.1, 'Lowering center of gravity and quieting step into stealth creep.'],
    ['TR_RUN_JUMP', 'Running to Jump Transition', 0.72, 3.6, 'Converting horizontal running momentum into crouch preload and explosive upward jump takeoff.'],
    ['TR_SPR_JUMP', 'Sprint to Long Jump Takeoff', 0.62, 5.0, 'High-speed takeoff conversion from sprint stride.'],
    ['TR_JUMP_LAND', 'Airborne to Ground Landing', 0.68, 1.2, 'Pre-landing leg extension and progressive ankle/knee/hip absorption into idle.'],
    ['TR_LAND_RUN', 'Jump to Running Landing Transition', 0.76, 3.5, 'Landing from airborne jump with bent knees and smoothly accelerating into running stride.'],
    ['TR_DDG_RUN', 'Dodge into Sprint/Run', 0.62, 3.4, 'Converting lateral/diagonal dodge recovery into forward run.'],
    ['TR_DDG_IDLE', 'Dodge into Neutral Idle', 0.64, 0.8, 'Absorbing lateral dodge momentum and re-centering into idle.'],
    ['TR_ROLL_IDLE', 'Roll to Standing Idle Transition', 1.04, 3.2, 'Recovering smoothly from ground roll weight transfer into standing idle.'],
    ['TR_ROLL_RUN', 'Roll into Running Stride Transition', 0.94, 4.2, 'Rising out of tactical roll directly into active running cycle.'],
    ['TR_RUN_ROLL', 'Running Dive into Roll Transition', 0.96, 4.1, 'Transferring forward running momentum into a tucked 360° ground roll.'],
    ['TR_RUN_SLIDE', 'Running Drop into Tactical Slide', 0.92, 4.6, 'Dropping center of gravity from full run into a low ground slide.'],
    ['TR_SLIDE_RUN', 'Slide Recovery into Run Transition', 0.94, 4.3, 'Driving off trail leg from ground slide back into upright run.'],
    ['TR_SLIDE_CRW', 'Slide into Tactical Crouch Transition', 0.88, 3.2, 'Decelerating from ground slide into balanced low crouch stance.'],
    ['TR_CMB_IDLE', 'Combat Stance to Relaxed Idle', 0.65, 0.0, 'Lowering guard and squaring hips into calm human standing idle.'],
    ['TR_IDLE_CMB', 'Relaxed Idle to Combat Stance', 0.55, 0.0, 'Stepping back with right foot and raising hands into combat readiness.'],
    ['TR_CRW_STL', 'Crouch to Stealth Creep', 0.58, 0.85, 'Adjusting deep crouch into balanced stealth locomotion posture.'],
    ['TR_STL_IDLE', 'Stealth Creep to Upright Idle', 0.68, 0.4, 'Rising smoothly from quiet stealth stance to upright idle.'],
  ];
  for (const [id, label, dur, spd, desc] of stateTransitions) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_21_TRANSITION',
      partNumber: 'Part 21',
      partTitle: 'Eight-Directional State Transitions',
      subGroup: 'Cross-State Transitions',
      direction: 'D01',
      duration: dur,
      loop: false,
      speedMetersPerSec: spd,
      archetype: 'state_transition',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 22 — ADDITIONAL HUMAN IDLE ANIMATIONS (43 clips)
  // ============================================================================
  const naturalIdles: Array<[string, string, number, string]> = [
    ['IDL_NEUTRAL', 'Neutral Standing Idle', 3.2, 'Balanced anatomical standing posture with subtle micro-sway and breathing.'],
    ['IDL_RELAXED', 'Relaxed Natural Idle', 3.6, 'Easy contrapposto standing posture with relaxed shoulders and arms.'],
    ['IDL_BREATHING', 'Calm Standing Breathing', 3.0, 'Visible thoracic and clavicular respiratory rhythm.'],
    ['IDL_WEIGHT_SHIFT', 'Subtle Bilateral Weight Shift', 3.8, 'Slow natural transfer of center of mass between left and right hips.'],
    ['IDL_SHIFT_LEFT', 'Weight Shift onto Left Leg', 3.2, 'Settling hip weight onto left leg with right knee slightly relaxed.'],
    ['IDL_SHIFT_RIGHT', 'Weight Shift onto Right Leg', 3.2, 'Settling hip weight onto right leg with left knee slightly relaxed.'],
    ['IDL_POSTURE_CORR', 'Slight Posture Correction', 2.4, 'Straightening lumbar/thoracic spine and drawing shoulders back.'],
    ['IDL_BLINK_NOD', 'Natural Micro-Nod & Gaze Settle', 2.2, 'Subtle cranial micro-adjustment accompanying natural blink cadence.'],
    ['IDL_HEAD_MOVE', 'Gentle Head Scan', 3.0, 'Calm, organic head orientation changes maintaining lifelike presence.'],
    ['IDL_LOOK_FWD', 'Focused Forward Gaze', 2.5, 'Attentive forward head and chest alignment.'],
    ['IDL_LOOK_UP', 'Looking Upward', 2.6, 'Cervical and upper thoracic extension gazing toward sky/ceiling.'],
    ['IDL_LOOK_DOWN', 'Looking Downward', 2.6, 'Cervical flexion inspecting ground directly ahead.'],
    ['IDL_LOOK_LEFT', 'Looking Left', 2.6, 'Natural 55° left head turn with slight shoulder follow.'],
    ['IDL_LOOK_RIGHT', 'Looking Right', 2.6, 'Natural 55° right head turn with slight shoulder follow.'],
    ['IDL_LOOK_SHOULDER', 'Looking Over Shoulder', 2.8, 'Combined neck and upper-spine rotation checking behind character.'],
    ['IDL_RELAX_SHOULDER', 'Shoulder Drop Relaxation', 2.5, 'Inhaling and releasing trapezius tension downward.'],
    ['IDL_RELAX_ARM', 'Arm Shakeout Relaxation', 2.6, 'Loosening upper arms and forearms at sides.'],
    ['IDL_RELAX_HAND', 'Hand & Wrist Relaxation', 2.4, 'Gentle wrist rotation and finger uncurling.'],
    ['IDL_NECK_STRETCH', 'Gentle Neck Tilt Stretch', 3.0, 'Lateral cervical tilt stretching sternocleidomastoid and trapezius.'],
  ];
  for (const [id, label, dur, desc] of naturalIdles) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_22_HUMAN_IDLE',
      partNumber: 'Part 22',
      partTitle: 'Stationary Human Idle & Behavioral Library',
      subGroup: 'Natural Idles (19)',
      duration: dur,
      loop: true,
      speedMetersPerSec: 0,
      archetype: 'human_idle',
      variantKey: id,
      description: desc,
    });
  }

  const behavioralIdles: Array<[string, string, number, string]> = [
    ['BHV_CHECK_SURR', 'Checking Surroundings', 3.4, 'Scanning left and right horizon with alert head and chest rotation.'],
    ['BHV_LOOK_GROUND', 'Looking at the Ground', 2.8, 'Tilting head and upper spine forward to examine floor details.'],
    ['BHV_THINKING', 'Thinking Pose (Hand to Chin)', 3.2, 'Shifting weight onto right hip while raising right hand thoughtfully to chin.'],
    ['BHV_CONFUSED', 'Confused Reaction', 2.6, 'Lateral head tilt with slight palms-up forearm gesture.'],
    ['BHV_CURIOUS', 'Curious Forward Lean', 2.6, 'Inquisitive forward neck/chest lean inspecting an object of interest.'],
    ['BHV_SURPRISE', 'Slight Surprise Reaction', 2.0, 'Quick backward upper-torso recoil and hand raise to chest.'],
    ['BHV_FRUSTRATION', 'Mild Frustration Sigh', 2.6, 'Exhaling with dropped shoulders and brief head shake.'],
    ['BHV_HAPPY', 'Happy Uplifted Reaction', 2.4, 'Buoyant chest lift, warm head nod, and lively arm gesture.'],
    ['BHV_SAD', 'Sad Downcast Posture', 3.2, 'Lowered gaze, rounded upper back, and protective forearm cross.'],
    ['BHV_NERVOUS', 'Nervous Weight Shift & Glance', 2.8, 'Restless weight transfers and quick glances left and right.'],
    ['BHV_RELIEVED', 'Relieved Exhale & Hand to Chest', 2.8, 'Deep chest exhale placing palm over sternum in relief.'],
    ['BHV_LISTENING', 'Attentive Listening Tilt', 3.0, 'Slight head turn angling ear forward while remaining still.'],
    ['BHV_WAITING', 'Patient Waiting Stance', 3.4, 'Hands clasped lightly in front with slow contrapposto rhythm.'],
    ['BHV_IMPATIENT', 'Impatient Waiting (Foot Tap)', 2.4, 'Arms folded/hands on hips with rhythmic right forefoot tap.'],
  ];
  for (const [id, label, dur, desc] of behavioralIdles) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_22_HUMAN_IDLE',
      partNumber: 'Part 22',
      partTitle: 'Stationary Human Idle & Behavioral Library',
      subGroup: 'Human Behavioral Idles (14)',
      duration: dur,
      loop: true,
      speedMetersPerSec: 0,
      archetype: 'human_idle',
      variantKey: id,
      description: desc,
    });
  }

  const bodyAdjustments: Array<[string, string, number, string]> = [
    ['ADJ_POSTURE', 'Adjusting Standing Posture', 2.5, 'Resetting stance width and aligning spine vertically.'],
    ['ADJ_STRETCH_ARMS', 'Overhead Arm Stretch', 3.0, 'Raising both arms overhead to lengthen latissimus and deltoids.'],
    ['ADJ_STRETCH_SHLDR', 'Rolling Shoulders Back', 2.6, 'Circular scapular and clavicular rolls releasing shoulder tension.'],
    ['ADJ_STRETCH_NECK', 'Side-to-Side Neck Stretch', 3.0, 'Full left and right cervical lateral flexion stretch.'],
    ['ADJ_STRETCH_BACK', 'Thoracic Back Extension Stretch', 3.0, 'Hands on lower back arching chest gently upward.'],
    ['ADJ_STRETCH_LEGS', 'Quadriceps & Calf Leg Stretch', 3.2, 'Flexing knee and ankle to stretch lower-limb musculature.'],
    ['ADJ_FLEX_FINGERS', 'Flexing Fingers', 2.2, 'Raising hands slightly to flex and extend finger joints.'],
    ['ADJ_OPEN_CLOSE_HAND', 'Opening and Closing Hands', 2.2, 'Rhythmic grip clench and release in both hands.'],
    ['ADJ_CLOTHING', 'Adjusting Athletic Top & Waistband', 2.6, 'Natural hand reach to smooth hem and shoulder strap.'],
    ['ADJ_BRUSH_HAIR', 'Brushing Hair Away from Face', 2.5, 'Graceful left hand sweep past temple and ear toward back of head.'],
  ];
  for (const [id, label, dur, desc] of bodyAdjustments) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_22_HUMAN_IDLE',
      partNumber: 'Part 22',
      partTitle: 'Stationary Human Idle & Behavioral Library',
      subGroup: 'Body Adjustments (10)',
      duration: dur,
      loop: true,
      speedMetersPerSec: 0,
      archetype: 'human_idle',
      variantKey: id,
      description: desc,
    });
  }

  // ============================================================================
  // PART 23 — EIGHT-DIRECTIONAL INTERACTION ANIMATIONS (58 clips)
  // ============================================================================
  add8DirSet(
    'PART_23_INTERACTION',
    'Part 23',
    'Eight-Directional Object Interactions',
    'Approach Object (8D)',
    'INT_APPR',
    1.1,
    false,
    1.25,
    'interaction_action',
    (d) => `Controlled ${d.label.toLowerCase()} approach toward interaction target with gaze lock and decelerating stride.`,
    { variantKey: 'INT_APPR' }
  );
  add8DirSet(
    'PART_23_INTERACTION',
    'Part 23',
    'Eight-Directional Object Interactions',
    'Walk to Interaction Point (8D)',
    'INT_WLK_TO',
    1.05,
    true,
    1.35,
    'interaction_action',
    (d) => `Purposeful ${d.label.toLowerCase()} walk aligning body with interaction station.`,
    { variantKey: 'INT_WLK_TO' }
  );
  add8DirSet(
    'PART_23_INTERACTION',
    'Part 23',
    'Eight-Directional Object Interactions',
    'Directional Reach (8D)',
    'INT_REACH',
    1.15,
    false,
    0.0,
    'interaction_action',
    (d) => `Reaching toward ${d.label.toLowerCase()} (${d.id}) with coordinated scapular protraction and torso weight shift.`,
    { variantKey: 'INT_REACH', handSide: 'right' }
  );
  add8DirSet(
    'PART_23_INTERACTION',
    'Part 23',
    'Eight-Directional Object Interactions',
    'Push Object (8D)',
    'INT_PUSH',
    1.25,
    true,
    0.65,
    'interaction_action',
    (d) => `Two-handed ${d.label.toLowerCase()} heavy object push driving through legs and core.`,
    { variantKey: 'INT_PUSH', handSide: 'both' }
  );
  add8DirSet(
    'PART_23_INTERACTION',
    'Part 23',
    'Eight-Directional Object Interactions',
    'Pull Object (8D)',
    'INT_PULL',
    1.25,
    true,
    0.65,
    'interaction_action',
    (d) => `Two-handed ${d.label.toLowerCase()} object pull leaning weight backward with strong latissimus engagement.`,
    { variantKey: 'INT_PULL', handSide: 'both' }
  );
  const stationaryInteractions: Array<[string, string, number, 'left' | 'right' | 'both', string]> = [
    ['INT_STOP_AT', 'Stopping Precisely at Object', 0.75, 'both', 'Final alignment step squaring shoulders in front of interactive prop.'],
    ['INT_REACH_FWD_L', 'Reach Forward (Left Hand)', 1.1, 'left', 'Extending left arm forward at chest height with balanced counter-rotation.'],
    ['INT_REACH_FWD_R', 'Reach Forward (Right Hand)', 1.1, 'right', 'Extending right arm forward at chest height with balanced counter-rotation.'],
    ['INT_REACH_SIDE_L', 'Reach Sideways Left', 1.15, 'left', 'Lateral left reach with weight shift onto left leg.'],
    ['INT_REACH_SIDE_R', 'Reach Sideways Right', 1.15, 'right', 'Lateral right reach with weight shift onto right leg.'],
    ['INT_BEND_DOWN', 'Bending Down (Hip Hinge & Squat)', 1.35, 'both', 'Anatomical hip-hinge and knee bend reaching low toward floor.'],
    ['INT_KNEEL', 'Kneeling Down to Inspect', 1.5, 'both', 'Lowering onto right knee for ground-level interaction.'],
    ['INT_PICKUP_L', 'Pick Up Object (Left Hand)', 1.4, 'left', 'Squatting down to grasp and lift item with left hand.'],
    ['INT_PICKUP_R', 'Pick Up Object (Right Hand)', 1.4, 'right', 'Squatting down to grasp and lift item with right hand.'],
    ['INT_PICKUP_BOTH', 'Pick Up Crate (Both Hands)', 1.55, 'both', 'Deep squat lifting medium object with both hands close to center of mass.'],
    ['INT_PLACE_L', 'Place Object (Left Hand)', 1.3, 'left', 'Carefully setting object onto surface with left hand.'],
    ['INT_PLACE_R', 'Place Object (Right Hand)', 1.3, 'right', 'Carefully setting object onto surface with right hand.'],
    ['INT_DOOR_OPEN_L', 'Open Door (Left Hand Pull)', 1.35, 'left', 'Reaching for handle with left hand, unlatching, and pulling door open.'],
    ['INT_DOOR_OPEN_R', 'Open Door (Right Hand Push)', 1.35, 'right', 'Reaching for handle with right hand and pushing door inward.'],
    ['INT_DOOR_CLOSE', 'Close Door Behind', 1.25, 'right', 'Drawing door shut until latch clicks.'],
    ['INT_CARRY_HOLD', 'Stationary Object Carry Hold', 2.0, 'both', 'Holding object securely at waist/chest level with engaged biceps.'],
    ['INT_DROP', 'Release & Drop Object', 0.9, 'both', 'Opening grip and stepping back slightly as object drops.'],
    ['INT_ACTIVATE_PANEL', 'Operate Console / Switch', 1.2, 'right', 'Raising right hand to press or toggle wall-mounted control.'],
  ];
  for (const [id, label, dur, hand, desc] of stationaryInteractions) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_23_INTERACTION',
      partNumber: 'Part 23',
      partTitle: 'Eight-Directional Object Interactions',
      subGroup: 'Stationary Left/Right Hand Interactions',
      direction: 'D01',
      duration: dur,
      loop: false,
      speedMetersPerSec: 0,
      archetype: 'interaction_action',
      variantKey: id,
      handSide: hand,
      description: desc,
    });
  }

  // ============================================================================
  // PART 24 — EIGHT-DIRECTIONAL CARRYING SYSTEM (57 clips)
  // ============================================================================
  const carrySets: Array<[string, string, number, number]> = [
    ['CRY_WLK', 'Carry Walk', 1.15, 1.25],
    ['CRY_FWLK', 'Carry Fast Walk', 0.92, 1.75],
    ['CRY_RUN', 'Carry Run', 0.78, 2.9],
    ['CRY_RET', 'Carry Retreat', 1.18, 1.1],
    ['CRY_STR', 'Carry Strafe', 1.05, 1.35],
    ['CRY_CRW', 'Carry Crouch Walk', 1.3, 0.8],
  ];
  for (const [prefix, subGroup, dur, spd] of carrySets) {
    add8DirSet(
      'PART_24_CARRYING',
      'Part 24',
      'Eight-Directional Carrying System',
      subGroup,
      prefix,
      dur,
      true,
      spd,
      'carry_locomotion',
      (d) => `${subGroup} toward ${d.label.toLowerCase()} (${d.id}) with upper-body load stabilization and modified pelvis counterbalance.`,
      { variantKey: prefix, handSide: 'both' }
    );
  }
  const carryVariants: Array<[string, string, number, boolean, 'left' | 'right' | 'both', 'light' | 'medium' | 'heavy', string]> = [
    ['CRY_LIGHT', 'Light Object Carry Walk', 1.1, true, 'both', 'light', 'Upright posture carrying a light parcel with minimal gait alteration.'],
    ['CRY_MED', 'Medium Object Carry Walk', 1.18, true, 'both', 'medium', 'Slightly widened base and slight lumbar counter-extension supporting medium weight.'],
    ['CRY_HEAVY', 'Heavy Object Carry Walk', 1.38, true, 'both', 'heavy', 'Shortened, grounded steps with bent knees and backward torso counter-lean for heavy load.'],
    ['CRY_TWO_HAND', 'Two-Handed Crate Carry Idle', 2.2, true, 'both', 'medium', 'Both forearms flexed at 90° supporting box in front of abdomen.'],
    ['CRY_ONE_HAND_L', 'One-Handed Carry (Left Hand)', 1.15, true, 'left', 'light', 'Carrying case/object in left hand with right shoulder subtle counterbalance tilt.'],
    ['CRY_ONE_HAND_R', 'One-Handed Carry (Right Hand)', 1.15, true, 'right', 'light', 'Carrying case/object in right hand with left shoulder subtle counterbalance tilt.'],
    ['CRY_PICKUP_HEAVY', 'Pick Up Heavy Object', 1.8, false, 'both', 'heavy', 'Wide-stance deep squat engaging legs and back to hoist heavy load.'],
    ['CRY_PUTDOWN', 'Put Down Carried Object', 1.5, false, 'both', 'medium', 'Controlled squat lowering carried load smoothly onto ground.'],
    ['CRY_ADJUST_GRIP', 'Adjusting Object Grip', 1.2, false, 'both', 'medium', 'Slight upward hip hitch and hand re-grip to secure carried load.'],
  ];
  for (const [id, label, dur, loop, hand, weight, desc] of carryVariants) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_24_CARRYING',
      partNumber: 'Part 24',
      partTitle: 'Eight-Directional Carrying System',
      subGroup: 'Weight & Grip Variations',
      direction: 'D01',
      duration: dur,
      loop,
      speedMetersPerSec: loop ? 1.1 : 0,
      archetype: 'carry_stationary',
      variantKey: id,
      handSide: hand,
      intensity: weight,
      description: desc,
    });
  }

  // ============================================================================
  // PART 25 — EIGHT-DIRECTIONAL CLIMBING AND TRAVERSAL (19 clips)
  // ============================================================================
  add8DirSet(
    'PART_25_TRAVERSAL',
    'Part 25',
    'Eight-Directional Climbing & Traversal',
    'Directional Obstacle Traversal (8D)',
    'TRV_OBST',
    1.15,
    false,
    2.1,
    'climb_traversal',
    (d) => `High-knee ${d.label.toLowerCase()} obstacle negotiation (${d.id}) with active hand balance and stabilized landing.`,
    { variantKey: 'TRV_OBST' }
  );
  const traversals: Array<[string, string, number, boolean, number, string]> = [
    ['TRV_OBST_SIDE_L', 'Sideways Obstacle Traversal (Left)', 1.2, false, 1.6, 'Lateral left step-over clearing low barrier with high knee abduction.'],
    ['TRV_OBST_SIDE_R', 'Sideways Obstacle Traversal (Right)', 1.2, false, 1.6, 'Lateral right step-over clearing low barrier with high knee abduction.'],
    ['TRV_LOW_CROSS', 'Low Obstacle Crossing', 1.1, false, 1.8, 'Smooth stride adjustment stepping cleanly across low debris.'],
    ['TRV_STEP_OVER', 'Deliberate Step Over Obstacle', 1.15, false, 1.4, 'High lead-knee lift followed by trail-leg clearance over knee-high barrier.'],
    ['TRV_VAULT_LOW', 'Athletic One-Hand Low Vault', 1.05, false, 3.4, 'Planting left palm on barrier while swinging legs laterally over obstacle.'],
    ['TRV_CLIMB_UP_PLAT', 'Climb Onto Elevated Platform', 1.65, false, 1.2, 'High foot plant, two-hand mantle press, and knee drive onto waist/chest ledge.'],
    ['TRV_CLIMB_DOWN_PLAT', 'Climb Down From Platform', 1.55, false, 1.0, 'Crouching at ledge edge, stepping down with trail leg, and absorbing drop.'],
    ['TRV_LADDER_UP', 'Ladder Climbing (Ascent Loop)', 1.2, true, 0.85, 'Alternating hand-over-hand rung grip and foot step ascending vertical ladder.'],
    ['TRV_LADDER_DOWN', 'Ladder Descending (Descent Loop)', 1.2, true, 0.85, 'Controlled downward rung descent with synchronized hand-foot alternation.'],
    ['TRV_ROPE_UP', 'Rope Climbing (Ascent Loop)', 1.35, true, 0.7, 'Upper-body pull and foot-lock pinch ascending vertical rope.'],
    ['TRV_ROPE_DOWN', 'Rope Descending (Descent Loop)', 1.25, true, 0.8, 'Controlled hand-over-hand descent down vertical rope.'],
    ['TRV_HANG_IDLE', 'Ledge / Overhead Hanging Idle', 2.4, true, 0.0, 'Full overhead two-hand hang with engaged scapulae and subtle leg sway.'],
  ];
  for (const [id, label, dur, loop, spd, desc] of traversals) {
    clips.push({
      id,
      name: `${id} — ${label}`,
      partId: 'PART_25_TRAVERSAL',
      partNumber: 'Part 25',
      partTitle: 'Eight-Directional Climbing & Traversal',
      subGroup: 'Vaults, Ledges, Ladders & Ropes',
      direction: 'D01',
      duration: dur,
      loop,
      speedMetersPerSec: spd,
      archetype: 'climb_traversal',
      variantKey: id,
      description: desc,
    });
  }

  return clips;
}

export const ANIMATION_CATALOG: AnimationClipMeta[] = buildCatalog();

export const ANIMATION_CLIP_BY_ID: Record<string, AnimationClipMeta> = ANIMATION_CATALOG.reduce(
  (acc, clip) => {
    acc[clip.id] = clip;
    return acc;
  },
  {} as Record<string, AnimationClipMeta>
);

export function getClipsByPart(partId: AnimationPartId): AnimationClipMeta[] {
  return ANIMATION_CATALOG.filter((c) => c.partId === partId);
}
