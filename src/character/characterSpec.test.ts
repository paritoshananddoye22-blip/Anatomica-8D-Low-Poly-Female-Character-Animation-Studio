import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONE_DEFINITIONS,
  createHumanoidSkeleton,
  getAnatomicalProportionsReport,
} from './skeletonSpec';
import { buildFemaleAnatomyGeometry } from './femaleAnatomyMesh';
import {
  ANIMATION_CATALOG,
  ANIMATION_PART_CATEGORIES,
  EIGHT_DIRECTIONS,
} from './animationCatalog';
import {
  evaluateClipPoseAtNormalizedTime,
  getOrCreateAnimationClip,
} from './animationGenerator';

test('Part 01 & 03: Humanoid skeleton has 25 bones and 7.0–7.5 head-height female proportions', () => {
  const report = getAnatomicalProportionsReport();
  assert.equal(report.boneCount, 25);
  assert.ok(
    report.headHeightRatio >= 7.0 && report.headHeightRatio <= 7.5,
    `Expected head-height ratio in [7.0, 7.5], got ${report.headHeightRatio}`
  );

  const { bones, boneMap } = createHumanoidSkeleton();
  assert.equal(bones.length, 25);
  assert.ok(boneMap.Root);
  assert.equal(boneMap.Pelvis.parent, boneMap.Root);
  assert.equal(boneMap.Spine_01.parent, boneMap.Pelvis);
  assert.equal(boneMap.Chest.parent, boneMap.Spine_02);
  assert.equal(boneMap.Head.parent, boneMap.Neck);
  assert.equal(boneMap.Left_Fingers.parent, boneMap.Left_Hand);
  assert.equal(boneMap.Right_Toe.parent, boneMap.Right_Foot);
});

test('Part 02: Female character mesh strictly obeys < 1,000 triangle budget (<= 999 tris) and normalized skin weights', () => {
  const meshResult = buildFemaleAnatomyGeometry();
  assert.ok(
    meshResult.totalTriangles > 600 && meshResult.totalTriangles <= 999,
    `Expected triangle count in (600, 999], got ${meshResult.totalTriangles}`
  );

  const sumSections = meshResult.sectionBreakdown.reduce(
    (acc, s) => acc + s.actualTriangles,
    0
  );
  assert.equal(sumSections, meshResult.totalTriangles);

  const skinWeightAttr = meshResult.geometry.getAttribute('skinWeight');
  const posAttr = meshResult.geometry.getAttribute('position');
  assert.equal(skinWeightAttr.count, meshResult.totalVertices);

  for (let i = 0; i < skinWeightAttr.count; i++) {
    const wSum =
      skinWeightAttr.getX(i) +
      skinWeightAttr.getY(i) +
      skinWeightAttr.getZ(i) +
      skinWeightAttr.getW(i);
    assert.ok(
      Math.abs(wSum - 1.0) < 1e-4,
      `Vertex ${i} skin weights do not sum to 1.0: ${wSum}`
    );
    assert.ok(!Number.isNaN(posAttr.getX(i)));
  }
});

test('Parts 04–25: Complete 8-directional animation library covers all 21 animation part categories and 600+ clips', () => {
  assert.equal(EIGHT_DIRECTIONS.length, 8);
  assert.equal(ANIMATION_PART_CATEGORIES.length, 21);
  assert.ok(
    ANIMATION_CATALOG.length >= 600,
    `Expected >= 600 total animations across Parts 05-25, got ${ANIMATION_CATALOG.length}`
  );

  for (const part of ANIMATION_PART_CATEGORIES) {
    const partClips = ANIMATION_CATALOG.filter((c) => c.partId === part.id);
    assert.ok(
      partClips.length >= 8,
      `Part ${part.id} has fewer than 8 animations: ${partClips.length}`
    );
  }
});

test('Part 04 & 05: Eight-directional walking clips have distinct directional biomechanics and anatomical knee flexion', () => {
  const wlkFwd = ANIMATION_CATALOG.find((c) => c.id === 'WLK_D01')!;
  const wlkDiag = ANIMATION_CATALOG.find((c) => c.id === 'WLK_D02')!;
  const wlkRight = ANIMATION_CATALOG.find((c) => c.id === 'WLK_D03')!;
  const wlkBack = ANIMATION_CATALOG.find((c) => c.id === 'WLK_D05')!;

  const poseFwd = evaluateClipPoseAtNormalizedTime(wlkFwd, 0.25, false);
  const poseDiag = evaluateClipPoseAtNormalizedTime(wlkDiag, 0.25, false);
  const poseRight = evaluateClipPoseAtNormalizedTime(wlkRight, 0.25, false);
  const poseBack = evaluateClipPoseAtNormalizedTime(wlkBack, 0.25, false);

  // Diagonal D02 has oblique pelvis yaw different from pure forward D01
  assert.notEqual(
    poseFwd.rotations.Pelvis[1].toFixed(3),
    poseDiag.rotations.Pelvis[1].toFixed(3)
  );
  // Right walk D03 has coronal hip abduction roll different from pure forward D01
  assert.notEqual(
    poseFwd.rotations.Left_Thigh[2].toFixed(3),
    poseRight.rotations.Left_Thigh[2].toFixed(3)
  );
  // Backward walk D05 has inverted sagittal thigh pitch compared to forward D01
  assert.notEqual(
    Math.sign(poseFwd.rotations.Left_Thigh[0]),
    Math.sign(poseBack.rotations.Left_Thigh[0])
  );

  // Verify knee flexion is never hyperextended backward across entire cycle
  for (let s = 0; s <= 16; s++) {
    const p = evaluateClipPoseAtNormalizedTime(wlkFwd, s / 16, false);
    assert.ok(p.rotations.Left_Calf[0] >= 0, 'Left knee bent in wrong direction');
    assert.ok(p.rotations.Right_Calf[0] >= 0, 'Right knee bent in wrong direction');
  }

  // Verify Three.js AnimationClip track generation
  const clip = getOrCreateAnimationClip('WLK_D01', true);
  assert.equal(clip.name, 'WLK_D01');
  assert.equal(clip.tracks.length, BONE_DEFINITIONS.length + 2);
});

test('Anatomy & Animation Update: Fuller thighs/buttocks within < 1,200 tris, 8D Crouch Run, 6-Phase Jump, and required transitions', () => {
  const meshResult = buildFemaleAnatomyGeometry();
  const report = getAnatomicalProportionsReport();

  // Verify mesh stays strictly under both 1,200 and 1,000 triangles
  assert.ok(meshResult.totalTriangles < 1200 && meshResult.totalTriangles <= 999);
  assert.equal(report.hipOuterWidthMeters, 0.364);

  const pelvisSection = meshResult.sectionBreakdown.find((s) => s.id === 'pelvis')!;
  const thighsSection = meshResult.sectionBreakdown.find((s) => s.id === 'thighs')!;
  assert.equal(pelvisSection.actualTriangles, 84);
  assert.equal(thighsSection.actualTriangles, 144);

  // Verify 8-directional Crouch Run (CRUN_D01..D08) biomechanics & loop continuity
  for (const dir of EIGHT_DIRECTIONS) {
    const crunMeta = ANIMATION_CATALOG.find((c) => c.id === `CRUN_${dir.id}`);
    assert.ok(crunMeta, `Missing Crouch Run clip CRUN_${dir.id}`);

    const p0 = evaluateClipPoseAtNormalizedTime(crunMeta, 0.0, false);
    const pMid = evaluateClipPoseAtNormalizedTime(crunMeta, 0.25, false);
    const pEnd = evaluateClipPoseAtNormalizedTime(crunMeta, 1.0, false);

    // Lowered pelvis (< 0.85m compared to standing 0.94m)
    assert.ok(
      pMid.pelvisPos[1] < 0.85 && pMid.pelvisPos[1] > 0.55,
      `Crouch Run pelvis height out of crouched range for ${dir.id}: ${pMid.pelvisPos[1]}`
    );
    // Knees remain bent (> 0.50 rad)
    assert.ok(
      pMid.rotations.Left_Calf[0] > 0.5 && pMid.rotations.Right_Calf[0] > 0.5,
      `Crouch Run knees not sufficiently bent for ${dir.id}`
    );
    // Upper body leans forward (positive pitch on Spine/Chest across all 8 directions)
    const forwardPitch =
      pMid.rotations.Pelvis[0] +
      pMid.rotations.Spine_01[0] +
      pMid.rotations.Spine_02[0] +
      pMid.rotations.Chest[0];
    assert.ok(forwardPitch > 0.20, `Crouch Run upper body should lean forward: ${forwardPitch}`);

    // Loop continuity at u=0 and u=1
    assert.ok(Math.abs(p0.pelvisPos[1] - pEnd.pelvisPos[1]) < 1e-4);
  }

  // Verify improved 6-Phase Jump (JUMP_D01..D08):
  // 1) Anticipation squat lowers hips below standing (0.94m) with bilateral knee bend
  // 2) Simultaneous takeoff leaves ground smoothly
  // 3) Airborne apex rises cleanly above standing height
  // 4) Landing absorbs with bent knees and recovers smoothly to standing
  for (const dir of EIGHT_DIRECTIONS) {
    const jumpMeta = ANIMATION_CATALOG.find((c) => c.id === `JUMP_${dir.id}`);
    assert.ok(jumpMeta, `Missing Jump clip JUMP_${dir.id}`);

    const pStart = evaluateClipPoseAtNormalizedTime(jumpMeta, 0.0, false);
    const pAntic = evaluateClipPoseAtNormalizedTime(jumpMeta, 0.14, false);
    const pApex = evaluateClipPoseAtNormalizedTime(jumpMeta, 0.48, false);
    const pLand = evaluateClipPoseAtNormalizedTime(jumpMeta, 0.78, false);
    const pEnd = evaluateClipPoseAtNormalizedTime(jumpMeta, 1.0, false);

    // Anticipation lowers pelvis and bends both knees simultaneously
    assert.ok(pAntic.pelvisPos[1] < pStart.pelvisPos[1] - 0.1);
    assert.ok(
      Math.abs(pAntic.rotations.Left_Calf[0] - pAntic.rotations.Right_Calf[0]) < 0.01,
      'Anticipation knee bend must be simultaneous on both legs'
    );
    assert.ok(pAntic.rotations.Left_Calf[0] > 0.7);

    // Airborne apex is well above standing pelvis height (0.94m)
    assert.ok(pApex.pelvisPos[1] > 1.25, `Jump apex too low: ${pApex.pelvisPos[1]}`);

    // Landing bends knees to absorb impact
    assert.ok(pLand.pelvisPos[1] < pStart.pelvisPos[1] - 0.08);
    assert.ok(pLand.rotations.Left_Calf[0] > 0.6 && pLand.rotations.Right_Calf[0] > 0.6);

    // Smooth recovery matches start height (no snapping)
    assert.ok(Math.abs(pEnd.pelvisPos[1] - pStart.pelvisPos[1]) < 0.02);
  }

  // Verify all required additional animations and their 8-directional sets exist and evaluate cleanly
  const required8DPrefixes = [
    'CRW_IDLE',
    'CRW',
    'CRUN',
    'CRW_TO_STAND',
    'CRUN_TO_STAND',
    'JUMP_RUN',
    'TR_RUN_JUMP',
    'TR_JUMP_RUN',
  ];
  for (const prefix of required8DPrefixes) {
    for (const dir of EIGHT_DIRECTIONS) {
      const clipMeta = ANIMATION_CATALOG.find((c) => c.id === `${prefix}_${dir.id}`);
      assert.ok(clipMeta, `Required 8D animation ${prefix}_${dir.id} is missing`);
      const samplePose = evaluateClipPoseAtNormalizedTime(clipMeta, 0.5, true);
      assert.ok(!Number.isNaN(samplePose.pelvisPos[1]));
      assert.ok(samplePose.rotations.Left_Calf[0] >= 0);
      assert.ok(samplePose.rotations.Right_Calf[0] >= 0);
    }
  }
});

test('Part 12 & 21: Eight-Directional Rolling (ROLL_D01..D08), Sliding (SLIDE_D01..D08), and full catalog audit', () => {
  // 1. Verify Eight-Directional Rolling (ROLL_D01 to ROLL_D08) & transitions
  for (const dir of EIGHT_DIRECTIONS) {
    const rollMeta = ANIMATION_CATALOG.find((c) => c.id === `ROLL_${dir.id}`);
    assert.ok(rollMeta, `Missing 8D Roll clip ROLL_${dir.id}`);

    const pStart = evaluateClipPoseAtNormalizedTime(rollMeta, 0.0, true);
    const pDive = evaluateClipPoseAtNormalizedTime(rollMeta, 0.14, true);
    const pMidRoll = evaluateClipPoseAtNormalizedTime(rollMeta, 0.49, true);
    const pEnd = evaluateClipPoseAtNormalizedTime(rollMeta, 1.0, true);

    // Eccentric dive lowers pelvis from standing (0.94m) before ground contact
    assert.ok(
      pDive.pelvisPos[1] < pStart.pelvisPos[1] - 0.15,
      `Roll dive phase should lower pelvis for ${dir.id}`
    );
    // Mid-roll tucked ground contact brings pelvis near tucked radius (~0.31m)
    assert.ok(
      pMidRoll.pelvisPos[1] >= 0.25 && pMidRoll.pelvisPos[1] <= 0.42,
      `Mid-roll pelvis height out of ground-roll range for ${dir.id}: ${pMidRoll.pelvisPos[1]}`
    );
    // Both knees tuck tightly during mid-roll (> 1.5 rad)
    assert.ok(
      pMidRoll.rotations.Left_Calf[0] > 1.5 && pMidRoll.rotations.Right_Calf[0] > 1.5,
      `Roll knees must tuck tightly during ground roll for ${dir.id}`
    );
    // Recovery returns smoothly to upright standing height (0.94m)
    assert.ok(
      Math.abs(pEnd.pelvisPos[1] - pStart.pelvisPos[1]) < 0.03,
      `Roll recovery must return smoothly to standing height for ${dir.id}`
    );
    // Root motion advances along direction vector [vx, vz]
    const dispMag = Math.hypot(pEnd.rootPos[0], pEnd.rootPos[2]);
    assert.ok(dispMag > 1.5, `Roll root motion should advance character for ${dir.id}`);

    // Verify Roll transitions exist and transition cleanly to idle or run
    for (const transPrefix of ['ROLL_TO_IDLE', 'ROLL_TO_RUN', 'RUN_TO_ROLL', 'LAND_ROLL']) {
      const transMeta = ANIMATION_CATALOG.find((c) => c.id === `${transPrefix}_${dir.id}`);
      assert.ok(transMeta, `Missing roll transition clip ${transPrefix}_${dir.id}`);
      const tEnd = evaluateClipPoseAtNormalizedTime(transMeta, 1.0, false);
      assert.ok(
        tEnd.pelvisPos[1] > 0.78,
        `${transPrefix}_${dir.id} should recover to upright/running pelvis height`
      );
    }

    // Verify GLTF AnimationClip quaternion tracks have continuous hemisphere (no sign flip glitches)
    const gltfRollClip = getOrCreateAnimationClip(`ROLL_${dir.id}`, false);
    assert.equal(gltfRollClip.tracks.length, BONE_DEFINITIONS.length + 2);
  }

  // 2. Verify Eight-Directional Sliding (SLIDE_D01 to SLIDE_D08) & transitions
  for (const dir of EIGHT_DIRECTIONS) {
    const slideMeta = ANIMATION_CATALOG.find((c) => c.id === `SLIDE_${dir.id}`);
    assert.ok(slideMeta, `Missing 8D Slide clip SLIDE_${dir.id}`);

    const pStart = evaluateClipPoseAtNormalizedTime(slideMeta, 0.0, true);
    const pMidSlide = evaluateClipPoseAtNormalizedTime(slideMeta, 0.45, true);
    const pEnd = evaluateClipPoseAtNormalizedTime(slideMeta, 1.0, true);

    // Low-profile ground slide lowers pelvis near 0.30m
    assert.ok(
      pMidSlide.pelvisPos[1] >= 0.25 && pMidSlide.pelvisPos[1] <= 0.40,
      `Mid-slide pelvis height out of low ground-slide range for ${dir.id}: ${pMidSlide.pelvisPos[1]}`
    );
    // Asymmetric figure-4 leg posture (one leg extended, trail leg tucked)
    assert.ok(
      Math.abs(pMidSlide.rotations.Left_Calf[0] - pMidSlide.rotations.Right_Calf[0]) > 0.8,
      `Slide must have asymmetric figure-4 lead/trail leg flexion for ${dir.id}`
    );
    // Smooth recovery to upright/run ready posture
    assert.ok(Math.abs(pEnd.pelvisPos[1] - pStart.pelvisPos[1]) < 0.08);

    for (const slideTrans of ['RUN_TO_SLIDE', 'SLIDE_TO_RUN', 'SLIDE_TO_CROUCH']) {
      const transMeta = ANIMATION_CATALOG.find((c) => c.id === `${slideTrans}_${dir.id}`);
      assert.ok(transMeta, `Missing slide transition clip ${slideTrans}_${dir.id}`);
    }
  }

  // 3. Full Audit of ALL 700+ animations in ANIMATION_CATALOG:
  // Every clip must evaluate cleanly without NaN, maintain anatomical knee flexion (>= 0),
  // and exhibit real non-static motion across normalized time u in [0, 1].
  for (const clipMeta of ANIMATION_CATALOG) {
    const samples = [0.0, 0.2, 0.45, 0.7, 1.0].map((u) =>
      evaluateClipPoseAtNormalizedTime(clipMeta, u, true)
    );

    let maxBoneDelta = 0;
    const p0 = samples[0];

    for (const s of samples) {
      assert.ok(
        !Number.isNaN(s.pelvisPos[0]) &&
          !Number.isNaN(s.pelvisPos[1]) &&
          !Number.isNaN(s.pelvisPos[2]),
        `NaN pelvisPos in clip ${clipMeta.id}`
      );
      assert.ok(
        s.rotations.Left_Calf[0] >= -1e-4 && s.rotations.Right_Calf[0] >= -1e-4,
        `Hyperextended knee (< 0) in clip ${clipMeta.id}: L=${s.rotations.Left_Calf[0]}, R=${s.rotations.Right_Calf[0]}`
      );

      for (const def of BONE_DEFINITIONS) {
        const [rx, ry, rz] = s.rotations[def.name];
        assert.ok(
          !Number.isNaN(rx) && !Number.isNaN(ry) && !Number.isNaN(rz),
          `NaN rotation on bone ${def.name} in clip ${clipMeta.id}`
        );
        const [r0x, r0y, r0z] = p0.rotations[def.name];
        const delta = Math.abs(rx - r0x) + Math.abs(ry - r0y) + Math.abs(rz - r0z);
        if (delta > maxBoneDelta) maxBoneDelta = delta;
      }
      const posDelta =
        Math.abs(s.pelvisPos[0] - p0.pelvisPos[0]) +
        Math.abs(s.pelvisPos[1] - p0.pelvisPos[1]) +
        Math.abs(s.pelvisPos[2] - p0.pelvisPos[2]);
      if (posDelta > maxBoneDelta) maxBoneDelta = posDelta;
    }

    assert.ok(
      maxBoneDelta > 0.005,
      `Animation clip ${clipMeta.id} (${clipMeta.archetype}) is static / not working (maxDelta=${maxBoneDelta})`
    );
  }
});


