import * as THREE from 'three';
import {
  ANIMATION_CLIP_BY_ID,
  AnimationClipMeta,
  DIRECTION_BY_ID,
  DirectionId,
} from './animationCatalog';
import { BONE_DEFINITIONS, BoneName } from './skeletonSpec';

/**
 * Biomechanical Pose Dictionary: Euler [rx, ry, rz] in radians for each bone,
 * plus Pelvis local offset [px, py, pz] and Root displacement [rx, ry, rz].
 */
export interface PoseFrame {
  rootPos: [number, number, number];
  pelvisPos: [number, number, number];
  rotations: Record<BoneName, [number, number, number]>;
}

function createNeutralPose(): PoseFrame {
  const rotations = {} as Record<BoneName, [number, number, number]>;
  for (const def of BONE_DEFINITIONS) {
    rotations[def.name] = [0, 0, 0];
  }
  // Natural relaxed anatomical arm hang at sides (slight elbow bend & shoulder relaxation)
  rotations.Left_UpperArm = [-0.04, 0.0, -0.06];
  rotations.Right_UpperArm = [-0.04, 0.0, 0.06];
  rotations.Left_Forearm = [-0.16, 0.0, 0.0];
  rotations.Right_Forearm = [-0.16, 0.0, 0.0];
  return {
    rootPos: [0, 0, 0],
    pelvisPos: [0, 0.90, 0],
    rotations,
  };
}

interface GaitParameters {
  stridePitch: number;
  strideRoll: number;
  kneeLift: number;
  stanceKneeFlex: number;
  pelvisBounce: number;
  pelvisSway: number;
  pelvisTwist: number;
  torsoForwardLean: number;
  torsoSideLean: number;
  armSwingPitch: number;
  elbowBaseBend: number;
  elbowSwingAmp: number;
  crouchDrop: number;
  upperBodyAimLock: number; // 0 = natural twist, 1 = locked to forward target
  asymmetryLeft?: number;
  asymmetryRight?: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes the exact Pelvis Y height so that the supporting/stance foot sole rests cleanly
 * on the floor (y = 0.00m) given current hip and knee flexion angles.
 */
function computeGroundedPelvisY(
  pelvisPitch: number,
  leftThighPitch: number,
  leftThighRoll: number,
  leftKneeFlex: number,
  rightThighPitch: number,
  rightThighRoll: number,
  rightKneeFlex: number,
  leftSwingClearance = 0,
  rightSwingClearance = 0,
  flightOffset = 0
): number {
  const alphaL = pelvisPitch + leftThighPitch;
  const betaL = alphaL + leftKneeFlex;
  const reachL = Math.cos(leftThighRoll) * (0.39 * Math.cos(alphaL) + 0.39 * Math.cos(betaL));

  const alphaR = pelvisPitch + rightThighPitch;
  const betaR = alphaR + rightKneeFlex;
  const reachR = Math.cos(rightThighRoll) * (0.39 * Math.cos(alphaR) + 0.39 * Math.cos(betaR));

  const reqPelvisL = reachL - leftSwingClearance + 0.12;
  const reqPelvisR = reachR - rightSwingClearance + 0.12;
  return Math.max(0.34, Math.max(reqPelvisL, reqPelvisR) + flightOffset);
}

/**
 * Computes genuine 8-directional locomotion pose at normalized phase u in [0, 1).
 * Right-hand rule on our rig (+Y up, +Z forward, +X character left, -X character right):
 * - Downward limbs (Thigh, Calf, UpperArm, Forearm):
 *   rx < 0 = swing forward (+Z), rx > 0 = swing backward (-Z).
 *   Knee flexion (Calf.rx) is strictly >= 0 (bends backward).
 *   Elbow flexion (Forearm.rx) is strictly <= 0 (bends forward/upward).
 *   rz > 0 = swing toward +X (left), rz < 0 = swing toward -X (right).
 * - Upward spine/head (Pelvis, Spine_01, Spine_02, Chest, Neck, Head):
 *   rx > 0 = lean forward (+Z), rx < 0 = lean backward (-Z).
 *   ry < 0 = turn chest/head right (-X), ry > 0 = turn chest/head left (+X).
 *   rz < 0 = tilt torso left (+X), rz > 0 = tilt torso right (-X).
 */
function evaluateDirectionalGait(
  u: number,
  dirId: DirectionId,
  g: GaitParameters
): PoseFrame {
  const pose = createNeutralPose();
  const dir = DIRECTION_BY_ID[dirId];
  const [vx, vz] = dir.vectorXZ; // vx > 0 is left (+X), vx < 0 is right (-X), vz > 0 is forward (+Z)
  const phase = u * Math.PI * 2;
  const sinP = Math.sin(phase);
  const cosP = Math.cos(phase);
  const sin2P = Math.sin(phase * 2);
  const cos2P = Math.cos(phase * 2);

  const leftScale = g.asymmetryLeft ?? 1.0;
  const rightScale = g.asymmetryRight ?? 1.0;

  // Genuine oblique hip alignment for diagonal movement (D02, D04, D06, D08)
  // When moving forward-right (vx < 0, vz > 0), pelvis angles subtly into the diagonal while chest counter-rotates
  const diagonalFactor = vx * (vz >= 0 ? 1 : -0.65);
  const baseHipYaw = diagonalFactor * 0.36 * (1 - g.upperBodyAimLock * 0.35);
  const dynamicHipYaw = -sinP * g.pelvisTwist * (0.4 + 0.6 * Math.abs(vz));

  // Pelvis vertical double-bounce and lateral weight transfer
  const bounceY = -g.crouchDrop + Math.abs(sinP) * g.pelvisBounce - 0.012;
  const lateralShiftX = sinP * g.pelvisSway * (0.6 + 0.4 * Math.abs(vx));
  const asymDrop =
    leftScale < 0.9 && sinP > 0
      ? -0.035 * sinP
      : rightScale < 0.9 && sinP < 0
        ? 0.035 * sinP
        : 0;

  pose.pelvisPos = [lateralShiftX, 0.90 + bounceY + asymDrop, -g.crouchDrop * 0.25];

  // Pelvis & Spine counter-rotation
  const forwardTilt = g.torsoForwardLean * (vz >= -0.1 ? 1 : 0.45) + 0.03 * cos2P;
  const sideTilt = -vx * g.torsoSideLean + sinP * 0.035;

  pose.rotations.Pelvis = [
    forwardTilt * 0.35,
    baseHipYaw + dynamicHipYaw,
    sideTilt * 0.5,
  ];
  pose.rotations.Spine_01 = [
    forwardTilt * 0.35,
    -baseHipYaw * 0.45 - dynamicHipYaw * 0.5,
    -sideTilt * 0.3,
  ];
  pose.rotations.Spine_02 = [
    forwardTilt * 0.3,
    -baseHipYaw * 0.35 - dynamicHipYaw * 0.4,
    -sideTilt * 0.2,
  ];
  pose.rotations.Chest = [
    forwardTilt * 0.25 + 0.02 * sin2P,
    -baseHipYaw * 0.25 - dynamicHipYaw * 0.35,
    0,
  ];
  pose.rotations.Neck = [-forwardTilt * 0.45, baseHipYaw * 0.1, 0];
  pose.rotations.Head = [
    -forwardTilt * 0.45 - 0.015 * cos2P,
    dynamicHipYaw * 0.15,
    -sideTilt * 0.15,
  ];

  // Left Leg (sinP > 0 is Left swing forward/active, sinP < 0 is Left stance push-off)
  // Right Leg (opposite phase: -sinP)
  const leftSwing = sinP * leftScale;
  const rightSwing = -sinP * rightScale;

  // Lift profile peaks during swing phase: max(0, cos(phase - PI/4))
  const leftLift = Math.max(0, Math.sin(phase + Math.PI * 0.35)) * leftScale;
  const rightLift = Math.max(0, Math.sin(phase - Math.PI * 0.65)) * rightScale;

  // Base crouch hip & knee flexion
  const crouchHipFlex = -g.crouchDrop * 1.65;
  const crouchKneeFlex = g.crouchDrop * 2.85;

  // Sagittal component (vz) and Coronal lateral component (vx)
  // Remember: rx < 0 swings forward (+Z). In backward gait (vz < 0), during swing (lift > 0) the thigh extends backward (rx > 0)
  const dirZSign = Math.abs(vz) < 0.15 ? 0.22 : vz;
  const leftThighPitch =
    crouchHipFlex -
    leftSwing * g.stridePitch * dirZSign -
    leftLift * g.kneeLift * 0.38;
  const rightThighPitch =
    crouchHipFlex -
    rightSwing * g.stridePitch * dirZSign -
    rightLift * g.kneeLift * 0.38;

  // Lateral abduction/adduction for sideways (D03/D07) and diagonal (D02/D04/D06/D08) movement
  // Includes anti-clipping inner-thigh abduction bias so fuller thighs never intersect
  const baseAbduction = 0.038 + g.crouchDrop * 0.14;
  const rawLeftRoll =
    baseAbduction + leftSwing * g.strideRoll * vx + Math.max(0, vx) * leftLift * 0.16;
  const rawRightRoll =
    -baseAbduction + rightSwing * g.strideRoll * vx + Math.min(0, vx) * rightLift * 0.16;

  const leftThighRoll = Math.max(-0.07, rawLeftRoll);
  const rightThighRoll = Math.min(0.07, rawRightRoll);

  pose.rotations.Left_Thigh = [
    leftThighPitch,
    -baseHipYaw * 0.4,
    leftThighRoll,
  ];
  pose.rotations.Right_Thigh = [
    rightThighPitch,
    -baseHipYaw * 0.4,
    rightThighRoll,
  ];

  // Knee flexion (strictly positive rx >= 0)
  const leftKnee = Math.max(
    0.05,
    crouchKneeFlex + g.stanceKneeFlex * (1 - leftLift) + leftLift * g.kneeLift
  );
  const rightKnee = Math.max(
    0.05,
    crouchKneeFlex + g.stanceKneeFlex * (1 - rightLift) + rightLift * g.kneeLift
  );

  pose.rotations.Left_Calf = [leftKnee, 0, 0];
  pose.rotations.Right_Calf = [rightKnee, 0, 0];

  // Anchor Pelvis Y using exact leg kinematics so the stance foot stays grounded (y = 0.00m)
  const leftClearance = leftLift * g.kneeLift * 0.085;
  const rightClearance = rightLift * g.kneeLift * 0.085;
  const isAirborneGait = g.pelvisBounce >= 0.055 && g.crouchDrop < 0.08;
  const flightOffset = isAirborneGait
    ? Math.max(0, Math.abs(sinP) - 0.5) * g.pelvisBounce * 0.65
    : Math.abs(sinP) * g.pelvisBounce * 0.35;

  const groundedY = computeGroundedPelvisY(
    pose.rotations.Pelvis[0],
    leftThighPitch,
    leftThighRoll,
    leftKnee,
    rightThighPitch,
    rightThighRoll,
    rightKnee,
    leftClearance,
    rightClearance,
    flightOffset
  );
  pose.pelvisPos = [lateralShiftX, groundedY + asymDrop, -g.crouchDrop * 0.22];

  // Ankle & Toe articulation: compensates world calf pitch during stance so foot sole stays parallel to floor
  const leftWorldCalfPitch = pose.rotations.Pelvis[0] + leftThighPitch + leftKnee;
  const rightWorldCalfPitch = pose.rotations.Pelvis[0] + rightThighPitch + rightKnee;

  const leftAnklePitch =
    -leftWorldCalfPitch * (1 - leftLift * 0.35) -
    leftSwing * 0.16 * dirZSign +
    (leftLift > 0.25 ? -0.12 : 0.06);
  const rightAnklePitch =
    -rightWorldCalfPitch * (1 - rightLift * 0.35) -
    rightSwing * 0.16 * dirZSign +
    (rightLift > 0.25 ? -0.12 : 0.06);

  pose.rotations.Left_Foot = [leftAnklePitch, 0, -leftThighRoll * 0.45];
  pose.rotations.Right_Foot = [rightAnklePitch, 0, -rightThighRoll * 0.45];

  pose.rotations.Left_Toe = [Math.max(0, -leftSwing * 0.28), 0, 0];
  pose.rotations.Right_Toe = [Math.max(0, -rightSwing * 0.28), 0, 0];

  // Contralateral Arm Swing (Left arm swings forward when Right leg swings forward)
  const leftArmPhase = -sinP;
  const rightArmPhase = sinP;

  pose.rotations.Left_Clavicle = [0, -leftArmPhase * 0.06, 0.02 * sin2P];
  pose.rotations.Right_Clavicle = [0, -rightArmPhase * 0.06, -0.02 * sin2P];

  pose.rotations.Left_UpperArm = [
    -0.06 - leftArmPhase * g.armSwingPitch,
    0,
    -0.09 - Math.abs(vx) * 0.08,
  ];
  pose.rotations.Right_UpperArm = [
    -0.06 - rightArmPhase * g.armSwingPitch,
    0,
    0.09 + Math.abs(vx) * 0.08,
  ];

  pose.rotations.Left_Forearm = [
    -g.elbowBaseBend - Math.max(0, leftArmPhase) * g.elbowSwingAmp,
    0,
    0.04,
  ];
  pose.rotations.Right_Forearm = [
    -g.elbowBaseBend - Math.max(0, rightArmPhase) * g.elbowSwingAmp,
    0,
    -0.04,
  ];

  pose.rotations.Left_Hand = [-0.04, 0, 0.05];
  pose.rotations.Right_Hand = [-0.04, 0, -0.05];
  pose.rotations.Left_Fingers = [0, 0, 0.12];
  pose.rotations.Right_Fingers = [0, 0, -0.12];

  return pose;
}

/**
 * Evaluates a single frame at normalized time u in [0, 1] for any AnimationClipMeta.
 */
export function evaluateClipPoseAtNormalizedTime(
  meta: AnimationClipMeta,
  u: number,
  rootMotion: boolean
): PoseFrame {
  const dirId: DirectionId = meta.direction ?? 'D01';
  const dir = DIRECTION_BY_ID[dirId];
  const [vx, vz] = dir.vectorXZ;
  const arch = meta.archetype;
  const vKey = meta.variantKey ?? '';

  let pose = createNeutralPose();

  switch (arch) {
    case 'locomotion_walk': {
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: 0.44,
        strideRoll: 0.28,
        kneeLift: 0.56,
        stanceKneeFlex: 0.08,
        pelvisBounce: 0.026,
        pelvisSway: 0.022,
        pelvisTwist: 0.12,
        torsoForwardLean: 0.05,
        torsoSideLean: 0.04,
        armSwingPitch: 0.32,
        elbowBaseBend: 0.24,
        elbowSwingAmp: 0.22,
        crouchDrop: 0,
        upperBodyAimLock: 0,
      });
      break;
    }

    case 'locomotion_fast_walk': {
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: 0.56,
        strideRoll: 0.34,
        kneeLift: 0.72,
        stanceKneeFlex: 0.11,
        pelvisBounce: 0.036,
        pelvisSway: 0.026,
        pelvisTwist: 0.16,
        torsoForwardLean: 0.11,
        torsoSideLean: 0.06,
        armSwingPitch: 0.48,
        elbowBaseBend: 0.48,
        elbowSwingAmp: 0.34,
        crouchDrop: 0.015,
        upperBodyAimLock: 0,
      });
      break;
    }

    case 'locomotion_run': {
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: 0.78,
        strideRoll: 0.42,
        kneeLift: 1.12,
        stanceKneeFlex: 0.16,
        pelvisBounce: 0.062,
        pelvisSway: 0.024,
        pelvisTwist: 0.20,
        torsoForwardLean: 0.18,
        torsoSideLean: 0.09,
        armSwingPitch: 0.68,
        elbowBaseBend: 1.15,
        elbowSwingAmp: 0.42,
        crouchDrop: 0.03,
        upperBodyAimLock: 0,
      });
      break;
    }

    case 'locomotion_sprint': {
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: 1.02,
        strideRoll: 0.50,
        kneeLift: 1.42,
        stanceKneeFlex: 0.18,
        pelvisBounce: 0.075,
        pelvisSway: 0.028,
        pelvisTwist: 0.25,
        torsoForwardLean: 0.28,
        torsoSideLean: 0.12,
        armSwingPitch: 0.92,
        elbowBaseBend: 1.32,
        elbowSwingAmp: 0.52,
        crouchDrop: 0.045,
        upperBodyAimLock: 0,
      });
      break;
    }

    case 'locomotion_crouch': {
      if (vKey === 'CRW_IDLE' || vKey === 'CRW_BREATHE') {
        const br = Math.sin(u * Math.PI * 2) * (vKey === 'CRW_BREATHE' ? 0.045 : 0.022);
        const dirYaw = Math.atan2(-vx, vz) * 0.28;
        const pelvisPitch = 0.24;
        const leftThighPitch = -0.92;
        const rightThighPitch = -0.96;
        const leftKnee = 1.48;
        const rightKnee = 1.52;
        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          leftThighPitch,
          0.06,
          leftKnee,
          rightThighPitch,
          -0.06,
          rightKnee
        );
        pose.pelvisPos = [0.008 * Math.sin(u * Math.PI * 2), groundedY + br * 0.12, -0.05];
        pose.rotations.Pelvis = [pelvisPitch, 0.10 + dirYaw, 0];
        pose.rotations.Spine_01 = [0.18 + br * 0.5, -0.05 - dirYaw * 0.4, 0];
        pose.rotations.Spine_02 = [0.12 + br * 0.4, -dirYaw * 0.3, 0];
        pose.rotations.Chest = [0.10 + br * 0.5, -0.05 - dirYaw * 0.3, 0];
        pose.rotations.Neck = [-0.26, dirYaw * 0.4, 0];
        pose.rotations.Head = [-0.36, dirYaw * 0.6, 0];
        pose.rotations.Left_Thigh = [leftThighPitch, 0.06, 0.06];
        pose.rotations.Right_Thigh = [rightThighPitch, -0.06, -0.06];
        pose.rotations.Left_Calf = [leftKnee, 0, 0];
        pose.rotations.Right_Calf = [rightKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + leftThighPitch + leftKnee), 0, -0.04];
        pose.rotations.Right_Foot = [-(pelvisPitch + rightThighPitch + rightKnee), 0, 0.04];
        pose.rotations.Left_UpperArm = [-0.28 + br * 0.4, 0, -0.14];
        pose.rotations.Right_UpperArm = [-0.28 + br * 0.4, 0, 0.14];
        pose.rotations.Left_Forearm = [-0.88, 0, 0];
        pose.rotations.Right_Forearm = [-0.88, 0, 0];
      } else if (vKey === 'CRW_TRANS_IN' || vKey === 'CRW_TRANS_OUT') {
        const rawT = vKey === 'CRW_TRANS_IN' ? u : 1 - u;
        const t = smoothstep(0, 1, rawT);
        const dirYaw = Math.atan2(-vx, vz) * 0.25 * t;
        const pelvisPitch = t * 0.24;
        const thighPitch = -t * 0.92;
        const kneeFlex = 0.05 + t * 1.44;
        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          thighPitch,
          0.04 + t * 0.03,
          kneeFlex,
          thighPitch,
          -0.04 - t * 0.03,
          kneeFlex
        );
        pose.pelvisPos = [0, groundedY, -t * 0.05];
        pose.rotations.Pelvis = [pelvisPitch, dirYaw, 0];
        pose.rotations.Spine_01 = [t * 0.18, -dirYaw * 0.4, 0];
        pose.rotations.Spine_02 = [t * 0.12, -dirYaw * 0.3, 0];
        pose.rotations.Chest = [t * 0.10, -dirYaw * 0.3, 0];
        pose.rotations.Neck = [-t * 0.24, dirYaw * 0.4, 0];
        pose.rotations.Head = [-t * 0.34, dirYaw * 0.6, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.04 + t * 0.03];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.04 - t * 0.03];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, -0.03];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0.03];
        pose.rotations.Left_UpperArm = [-0.04 - t * 0.26, 0, -0.06 - t * 0.08];
        pose.rotations.Right_UpperArm = [-0.04 - t * 0.26, 0, 0.06 + t * 0.08];
        pose.rotations.Left_Forearm = [-0.16 - t * 0.72, 0, 0];
        pose.rotations.Right_Forearm = [-0.16 - t * 0.72, 0, 0];
      } else {
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.38,
          strideRoll: 0.26,
          kneeLift: 0.48,
          stanceKneeFlex: 0.38,
          pelvisBounce: 0.015,
          pelvisSway: 0.024,
          pelvisTwist: 0.09,
          torsoForwardLean: 0.38,
          torsoSideLean: 0.05,
          armSwingPitch: 0.26,
          elbowBaseBend: 0.86,
          elbowSwingAmp: 0.20,
          crouchDrop: 0.24,
          upperBodyAimLock: 0.3,
        });
      }
      break;
    }

    case 'locomotion_crouch_run': {
      if (vKey === 'TR_CRUN_STAND') {
        // Smooth deceleration from Crouch-Run into upright Standing Idle without foot sliding
        const crouchDecay = 1 - smoothstep(0.08, 0.92, u);
        const strideDecay = 1 - smoothstep(0.0, 0.72, u);
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.62 * strideDecay,
          strideRoll: 0.34 * strideDecay,
          kneeLift: 0.74 * strideDecay,
          stanceKneeFlex: 0.06 + 0.38 * crouchDecay,
          pelvisBounce: 0.022 * strideDecay,
          pelvisSway: 0.026 * strideDecay,
          pelvisTwist: 0.14 * strideDecay,
          torsoForwardLean: 0.46 * crouchDecay,
          torsoSideLean: 0.07 * strideDecay,
          armSwingPitch: 0.56 * strideDecay,
          elbowBaseBend: 0.16 + 0.92 * crouchDecay,
          elbowSwingAmp: 0.32 * strideDecay,
          crouchDrop: 0.22 * crouchDecay,
          upperBodyAimLock: 0.2 * crouchDecay,
        });
      } else {
        // Complete Eight-Directional Crouch Run (CRUN_D01–D08)
        // Bent knees, lowered hips, forward upper-body lean, natural alternating legs, coordinated arm balance, grounded feet
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.64,
          strideRoll: 0.35,
          kneeLift: 0.78,
          stanceKneeFlex: 0.42,
          pelvisBounce: 0.024,
          pelvisSway: 0.028,
          pelvisTwist: 0.15,
          torsoForwardLean: 0.46,
          torsoSideLean: 0.08,
          armSwingPitch: 0.58,
          elbowBaseBend: 1.08,
          elbowSwingAmp: 0.34,
          crouchDrop: 0.22,
          upperBodyAimLock: 0.25,
        });
      }
      break;
    }

    case 'locomotion_stealth': {
      if (vKey === 'STL_START' || vKey === 'STL_STOP') {
        const w = vKey === 'STL_START' ? smoothstep(0, 1, u) : 1 - smoothstep(0, 1, u);
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.32 * w,
          strideRoll: 0.20 * w,
          kneeLift: 0.48 * w,
          stanceKneeFlex: 0.22,
          pelvisBounce: 0.008 * w,
          pelvisSway: 0.018 * w,
          pelvisTwist: 0.09 * w,
          torsoForwardLean: 0.20 + 0.04 * w,
          torsoSideLean: 0.04 * w,
          armSwingPitch: 0.16 * w,
          elbowBaseBend: 0.92,
          elbowSwingAmp: 0.12 * w,
          crouchDrop: 0.14,
          upperBodyAimLock: 0.5,
        });
      } else if (vKey === 'STL_TO_WLK' || vKey === 'STL_TO_CRW') {
        const t = smoothstep(0, 1, u);
        const drop = vKey === 'STL_TO_WLK' ? 0.14 * (1 - t) : 0.14 + 0.10 * t;
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: vKey === 'STL_TO_WLK' ? 0.32 + 0.12 * t : 0.32 + 0.06 * t,
          strideRoll: 0.22,
          kneeLift: 0.48 + (vKey === 'STL_TO_WLK' ? 0.08 * t : 0),
          stanceKneeFlex: 0.22 * (1 - t) + (vKey === 'STL_TO_WLK' ? 0.08 * t : 0.38 * t),
          pelvisBounce: 0.008 + (vKey === 'STL_TO_WLK' ? 0.018 * t : 0.007 * t),
          pelvisSway: 0.020,
          pelvisTwist: 0.10,
          torsoForwardLean: 0.24 * (1 - t) + (vKey === 'STL_TO_WLK' ? 0.05 * t : 0.38 * t),
          torsoSideLean: 0.04,
          armSwingPitch: 0.16 + (vKey === 'STL_TO_WLK' ? 0.16 * t : 0.10 * t),
          elbowBaseBend: 0.92 * (1 - t) + (vKey === 'STL_TO_WLK' ? 0.24 * t : 0.86 * t),
          elbowSwingAmp: 0.14,
          crouchDrop: drop,
          upperBodyAimLock: 0.5 * (1 - t),
        });
      } else if (vKey) {
        const s = Math.sin(u * Math.PI * 2);
        const lookYaw =
          vKey === 'STL_LOOK_L'
            ? 0.58 * Math.sin(u * Math.PI)
            : vKey === 'STL_LOOK_R'
              ? -0.58 * Math.sin(u * Math.PI)
              : 0;
        const recSway = vKey === 'STL_RECOVER' ? Math.sin(u * Math.PI) * 0.16 : 0;
        const drop = 0.14 + Math.abs(recSway) * 0.25;
        const pelvisPitch = 0.16 + recSway * 0.3;
        const thighPitch = -drop * 3.2;
        const kneeFlex = drop * 5.8;
        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          thighPitch,
          0.05 + recSway * 0.2,
          kneeFlex,
          thighPitch,
          -0.05 + recSway * 0.2,
          kneeFlex
        );
        pose.pelvisPos = [recSway * 0.18, groundedY, -0.03];
        pose.rotations.Pelvis = [pelvisPitch, 0.14, -recSway * 0.35];
        pose.rotations.Spine_01 = [0.14, lookYaw * 0.3, recSway * 0.25];
        pose.rotations.Chest = [0.10 + 0.025 * s, lookYaw * 0.4, recSway * 0.2];
        pose.rotations.Head = [-0.26, lookYaw * 0.8, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.05 + recSway * 0.2];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.05 + recSway * 0.2];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Left_UpperArm = [-0.28 - Math.abs(recSway) * 0.4, 0, -0.18 - Math.abs(recSway) * 0.5];
        pose.rotations.Right_UpperArm = [-0.28 - Math.abs(recSway) * 0.4, 0, 0.18 + Math.abs(recSway) * 0.5];
        pose.rotations.Left_Forearm = [-0.95, 0, 0];
        pose.rotations.Right_Forearm = [-0.95, 0, 0];
      } else {
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.32,
          strideRoll: 0.20,
          kneeLift: 0.48,
          stanceKneeFlex: 0.22,
          pelvisBounce: 0.008,
          pelvisSway: 0.018,
          pelvisTwist: 0.09,
          torsoForwardLean: 0.24,
          torsoSideLean: 0.04,
          armSwingPitch: 0.16,
          elbowBaseBend: 0.92,
          elbowSwingAmp: 0.12,
          crouchDrop: 0.14,
          upperBodyAimLock: 0.5,
        });
      }
      break;
    }

    case 'jump_directional':
    case 'jump_specialized': {
      if (vKey === 'JUMP_WHILE_RUN') {
        // Continuous 8-Directional Jump While Running:
        // [0.00..0.20] Running approach stride + gather compression
        // [0.20..0.72] Parabolic airborne leap with athletic mid-air stride posture
        // [0.72..1.00] Bent-knee landing absorption smoothly transitioning back into running cycle
        const runPose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.78,
          strideRoll: 0.42,
          kneeLift: 1.12,
          stanceKneeFlex: 0.16,
          pelvisBounce: 0.062,
          pelvisSway: 0.024,
          pelvisTwist: 0.20,
          torsoForwardLean: 0.18,
          torsoSideLean: 0.09,
          armSwingPitch: 0.68,
          elbowBaseBend: 1.15,
          elbowSwingAmp: 0.42,
          crouchDrop: 0.03,
          upperBodyAimLock: 0,
        });

        if (u < 0.20) {
          const gather = Math.sin((u / 0.20) * Math.PI);
          pose = runPose;
          const extraKnee = gather * 0.45;
          const extraHip = -gather * 0.28;
          pose.rotations.Left_Thigh[0] += extraHip;
          pose.rotations.Right_Thigh[0] += extraHip;
          pose.rotations.Left_Calf[0] += extraKnee;
          pose.rotations.Right_Calf[0] += extraKnee;
          pose.rotations.Spine_01[0] += gather * 0.12;
          pose.pelvisPos[1] = computeGroundedPelvisY(
            pose.rotations.Pelvis[0],
            pose.rotations.Left_Thigh[0],
            pose.rotations.Left_Thigh[2],
            pose.rotations.Left_Calf[0],
            pose.rotations.Right_Thigh[0],
            pose.rotations.Right_Thigh[2],
            pose.rotations.Right_Calf[0]
          );
        } else if (u < 0.72) {
          const flightU = (u - 0.20) / 0.52;
          const parabola = 4 * flightU * (1 - flightU);
          const airBlend = Math.sin(flightU * Math.PI);
          pose = runPose;
          const pelvisPitch = 0.22 * (1 - 0.35 * flightU);
          const leftThighPitch = -0.68 * airBlend - 0.18 * (1 - airBlend);
          const rightThighPitch = -0.22 * airBlend - 0.28 * (1 - airBlend);
          const leftKnee = 0.22 + 0.92 * airBlend;
          const rightKnee = 0.25 + 0.85 * airBlend;
          const baseGroundedY = computeGroundedPelvisY(
            pelvisPitch,
            leftThighPitch,
            0.05 + vx * 0.15 * airBlend,
            leftKnee,
            rightThighPitch,
            -0.05 + vx * 0.15 * airBlend,
            rightKnee
          );
          pose.pelvisPos = [
            vx * parabola * 0.06,
            baseGroundedY + parabola * 0.38,
            vz * parabola * 0.08,
          ];
          pose.rotations.Pelvis = [pelvisPitch, -vx * 0.16 * airBlend, -vx * 0.10 * airBlend];
          pose.rotations.Spine_01 = [0.16 * airBlend, vx * 0.08 * airBlend, 0];
          pose.rotations.Chest = [0.10 * airBlend, vx * 0.08 * airBlend, 0];
          pose.rotations.Head = [-0.22 * airBlend, 0, 0];
          pose.rotations.Left_Thigh = [leftThighPitch, 0, 0.05 + vx * 0.15 * airBlend];
          pose.rotations.Right_Thigh = [rightThighPitch, 0, -0.05 + vx * 0.15 * airBlend];
          pose.rotations.Left_Calf = [leftKnee, 0, 0];
          pose.rotations.Right_Calf = [rightKnee, 0, 0];
          pose.rotations.Left_Foot = [-0.15 + 0.25 * (1 - flightU), 0, 0];
          pose.rotations.Right_Foot = [0.18 * airBlend, 0, 0];
          pose.rotations.Left_UpperArm = [-0.85 * airBlend - 0.2, 0, -0.18 - 0.12 * airBlend];
          pose.rotations.Right_UpperArm = [-0.55 * airBlend - 0.1, 0, 0.18 + 0.12 * airBlend];
          pose.rotations.Left_Forearm = [-0.95, 0, 0];
          pose.rotations.Right_Forearm = [-1.05, 0, 0];
        } else {
          // Bent-knee landing absorption (0.72..0.86) into smooth running stride (0.86..1.00)
          const landU = (u - 0.72) / 0.28;
          const absorb = Math.sin(Math.pow(landU, 0.7) * Math.PI) * (1 - smoothstep(0.65, 1.0, landU));
          pose = runPose;
          pose.rotations.Pelvis[0] += absorb * 0.18;
          pose.rotations.Spine_01[0] += absorb * 0.16;
          pose.rotations.Head[0] -= absorb * 0.24;
          pose.rotations.Left_Thigh[0] -= absorb * 0.52;
          pose.rotations.Right_Thigh[0] -= absorb * 0.52;
          pose.rotations.Left_Calf[0] += absorb * 0.88;
          pose.rotations.Right_Calf[0] += absorb * 0.88;
          pose.pelvisPos[1] = computeGroundedPelvisY(
            pose.rotations.Pelvis[0],
            pose.rotations.Left_Thigh[0],
            pose.rotations.Left_Thigh[2],
            pose.rotations.Left_Calf[0],
            pose.rotations.Right_Thigh[0],
            pose.rotations.Right_Thigh[2],
            pose.rotations.Right_Calf[0]
          );
          pose.rotations.Left_Foot[0] = -(pose.rotations.Pelvis[0] + pose.rotations.Left_Thigh[0] + pose.rotations.Left_Calf[0]);
          pose.rotations.Right_Foot[0] = -(pose.rotations.Pelvis[0] + pose.rotations.Right_Thigh[0] + pose.rotations.Right_Calf[0]);
        }
        break;
      }

      if (vKey === 'TR_RUN_JUMP') {
        // Running-to-Jump Transition: Running approach [0..0.42] -> Bilateral Squat Gather [0.42..0.72] -> Takeoff Launch [0.72..1.00]
        if (u < 0.45) {
          const runW = 1 - smoothstep(0.15, 0.45, u);
          const squatW = smoothstep(0.15, 0.45, u);
          const runPose = evaluateDirectionalGait(u * 1.5, dirId, {
            stridePitch: 0.72 * runW,
            strideRoll: 0.38 * runW,
            kneeLift: 0.95 * runW,
            stanceKneeFlex: 0.16 + squatW * 1.12,
            pelvisBounce: 0.04 * runW,
            pelvisSway: 0.02 * runW,
            pelvisTwist: 0.16 * runW,
            torsoForwardLean: 0.18 + squatW * 0.18,
            torsoSideLean: 0.06 * runW,
            armSwingPitch: 0.55 * runW,
            elbowBaseBend: 1.05 - squatW * 0.45,
            elbowSwingAmp: 0.30 * runW,
            crouchDrop: 0.04 + squatW * 0.18,
            upperBodyAimLock: 0,
          });
          pose = runPose;
          pose.rotations.Left_UpperArm[0] = -0.15 * runW + 0.48 * squatW;
          pose.rotations.Right_UpperArm[0] = -0.15 * runW + 0.48 * squatW;
        } else {
          const launchU = (u - 0.45) / 0.55;
          const pushExtend = smoothstep(0.0, 0.42, launchU);
          const airRise = smoothstep(0.32, 1.0, launchU);
          const pelvisPitch = 0.32 * (1 - pushExtend * 0.5);
          const hipFlex = -0.82 * (1 - pushExtend) - 0.54 * airRise;
          const kneeFlex = 1.32 * (1 - pushExtend) + 0.12 * pushExtend + 0.78 * airRise;
          const groundedY = computeGroundedPelvisY(
            pelvisPitch,
            hipFlex,
            0.05,
            kneeFlex,
            hipFlex,
            -0.05,
            kneeFlex
          );
          pose.pelvisPos = [
            vx * airRise * 0.06,
            groundedY + airRise * 0.34,
            vz * airRise * 0.08,
          ];
          pose.rotations.Pelvis = [pelvisPitch, 0, -vx * airRise * 0.10];
          pose.rotations.Spine_01 = [0.22 * (1 - pushExtend * 0.5), 0, 0];
          pose.rotations.Chest = [-0.14 * pushExtend, 0, 0];
          pose.rotations.Head = [-0.24 * (1 - pushExtend * 0.5), 0, 0];
          pose.rotations.Left_Thigh = [hipFlex - vz * airRise * 0.15, 0, 0.05 + vx * airRise * 0.14];
          pose.rotations.Right_Thigh = [hipFlex + vz * airRise * 0.10, 0, -0.05 + vx * airRise * 0.14];
          pose.rotations.Left_Calf = [kneeFlex, 0, 0];
          pose.rotations.Right_Calf = [kneeFlex, 0, 0];
          const ankleBase = -(pelvisPitch + hipFlex + kneeFlex);
          pose.rotations.Left_Foot = [ankleBase * (1 - pushExtend) + 0.36 * pushExtend, 0, 0];
          pose.rotations.Right_Foot = [ankleBase * (1 - pushExtend) + 0.36 * pushExtend, 0, 0];
          const armSwing = 0.48 * (1 - pushExtend) - 1.18 * pushExtend;
          pose.rotations.Left_UpperArm = [armSwing, 0, -0.14 - 0.14 * airRise];
          pose.rotations.Right_UpperArm = [armSwing, 0, 0.14 + 0.14 * airRise];
          pose.rotations.Left_Forearm = [-0.55 - 0.35 * pushExtend, 0, 0];
          pose.rotations.Right_Forearm = [-0.55 - 0.35 * pushExtend, 0, 0];
        }
        break;
      }

      if (vKey === 'TR_JUMP_RUN') {
        // Jump-to-Running Landing Transition: Airborne Descent [0..0.25] -> Bent-Knee Absorption [0.25..0.58] -> Run Acceleration [0.58..1.00]
        if (u < 0.58) {
          const isAir = u < 0.24;
          const airFactor = isAir ? 1 - smoothstep(0.0, 0.24, u) : 0;
          const absorbU = isAir ? 0 : (u - 0.24) / 0.34;
          const absorb = isAir ? 0 : Math.sin(absorbU * Math.PI);
          const pelvisPitch = 0.16 + absorb * 0.24;
          const hipFlex = -0.38 * airFactor - 0.78 * absorb - 0.18 * (1 - airFactor);
          const kneeFlex = 0.55 * airFactor + 1.28 * absorb + 0.22 * (1 - airFactor);
          const groundedY = computeGroundedPelvisY(
            pelvisPitch,
            hipFlex,
            0.05,
            kneeFlex,
            hipFlex,
            -0.05,
            kneeFlex
          );
          pose.pelvisPos = [
            vx * absorb * 0.04,
            groundedY + airFactor * 0.28,
            vz * absorb * 0.06,
          ];
          pose.rotations.Pelvis = [pelvisPitch, 0, -vx * absorb * 0.08];
          pose.rotations.Spine_01 = [0.14 + absorb * 0.18, 0, 0];
          pose.rotations.Chest = [0.08 + absorb * 0.12, 0, 0];
          pose.rotations.Head = [-0.20 - absorb * 0.22, 0, 0];
          pose.rotations.Left_Thigh = [hipFlex, 0, 0.05];
          pose.rotations.Right_Thigh = [hipFlex, 0, -0.05];
          pose.rotations.Left_Calf = [kneeFlex, 0, 0];
          pose.rotations.Right_Calf = [kneeFlex, 0, 0];
          const flatAnkle = -(pelvisPitch + hipFlex + kneeFlex);
          pose.rotations.Left_Foot = [isAir ? 0.22 : flatAnkle, 0, 0];
          pose.rotations.Right_Foot = [isAir ? 0.22 : flatAnkle, 0, 0];
          pose.rotations.Left_UpperArm = [-0.65 * airFactor - 0.45 * absorb - 0.12, 0, -0.18];
          pose.rotations.Right_UpperArm = [-0.65 * airFactor - 0.45 * absorb - 0.12, 0, 0.18];
          pose.rotations.Left_Forearm = [-0.85, 0, 0];
          pose.rotations.Right_Forearm = [-0.85, 0, 0];
        } else {
          const runPhase = (u - 0.58) / 0.42;
          const blendIn = smoothstep(0.0, 0.45, runPhase);
          pose = evaluateDirectionalGait(runPhase * 0.85, dirId, {
            stridePitch: 0.35 + 0.43 * blendIn,
            strideRoll: 0.22 + 0.20 * blendIn,
            kneeLift: 0.55 + 0.57 * blendIn,
            stanceKneeFlex: 0.42 * (1 - blendIn) + 0.16 * blendIn,
            pelvisBounce: 0.05 * blendIn,
            pelvisSway: 0.024,
            pelvisTwist: 0.18 * blendIn,
            torsoForwardLean: 0.26 * (1 - blendIn) + 0.18 * blendIn,
            torsoSideLean: 0.08 * blendIn,
            armSwingPitch: 0.65 * blendIn,
            elbowBaseBend: 1.12,
            elbowSwingAmp: 0.38 * blendIn,
            crouchDrop: 0.12 * (1 - blendIn) + 0.03 * blendIn,
            upperBodyAimLock: 0,
          });
        }
        break;
      }

      // Standard 6-Phase Bilateral Jump & Specialized Landings:
      // [0.00..0.24] Grounded Anticipation Squat + Simultaneous Bilateral Push-Off
      // [0.24..0.68] True Parabolic Airborne Arc (Both feet leave & travel together, zero floating)
      // [0.68..1.00] Simultaneous Grounded Landing with Bent Knees & Smooth Recovery to Neutral Idle
      const isLandingOnly = vKey.startsWith('LAND_');
      const jumpHeight =
        vKey === 'JUMP_HIGH'
          ? 0.54
          : vKey === 'JUMP_HOP_SHORT'
            ? 0.20
            : isLandingOnly
              ? 0.0
              : 0.38;

      let airborneHeight = 0;
      let hipFlex = -0.02;
      let kneeFlex = 0.06;
      let pelvisPitch = 0;
      let spinePitch = 0;
      let armPitch = -0.04;
      let armRoll = 0.08;
      let elbowBend = 0.20;
      let plantarFlex = 0;
      let dirTuck = 0;

      if (isLandingOnly) {
        const impactScale = vKey === 'LAND_HEAVY' ? 1.25 : vKey === 'LAND_MED' ? 0.95 : 0.65;
        if (u < 0.20) {
          const descent = 1 - smoothstep(0.0, 0.20, u);
          airborneHeight = descent * 0.22;
          hipFlex = -0.28 * (1 - descent);
          kneeFlex = 0.32 + 0.25 * (1 - descent);
          plantarFlex = 0.25 * descent;
          armPitch = -0.55 * descent - 0.20;
          elbowBend = 0.55;
        } else {
          const landU = (u - 0.20) / 0.80;
          const absorb = Math.sin(Math.pow(landU, 0.68) * Math.PI) * (1 - smoothstep(0.75, 1.0, landU));
          pelvisPitch = 0.24 * absorb * impactScale;
          spinePitch = 0.20 * absorb * impactScale;
          hipFlex = -0.02 - 0.82 * absorb * impactScale;
          kneeFlex = 0.06 + 1.32 * absorb * impactScale;
          armPitch = -0.04 - 0.52 * absorb * impactScale;
          armRoll = 0.08 + 0.14 * absorb;
          elbowBend = 0.20 + 0.58 * absorb;
        }
      } else if (u < 0.24) {
        // Phase 1 & 2: Anticipation Counter-Movement Squat (peaks at u = 0.14) -> Explosive Bilateral Push-Off (u = 0.14..0.24)
        const antU = u / 0.24;
        const squat = Math.sin(Math.pow(antU, 0.85) * Math.PI);
        const pushOff = smoothstep(0.58, 1.0, antU);

        pelvisPitch = 0.26 * squat * (1 - pushOff * 0.6);
        spinePitch = 0.22 * squat * (1 - pushOff * 0.6);
        hipFlex = -0.02 - 0.84 * squat + 0.12 * pushOff;
        kneeFlex = 0.06 + 1.38 * squat;
        plantarFlex = 0.38 * pushOff;

        // Arms swing backward during anticipation squat, then drive powerfully upward at takeoff
        armPitch = -0.04 + 0.56 * squat * (1 - pushOff) - 1.15 * pushOff;
        armRoll = 0.08 + 0.12 * squat;
        elbowBend = 0.20 + 0.55 * squat + 0.35 * pushOff;
      } else if (u < 0.68) {
        // Phase 3 & 4: Parabolic Airborne Arc (0.24..0.68) + Pre-Landing Leg Extension
        const flightU = (u - 0.24) / 0.44;
        // Exact quadratic gravity parabola: 0 at takeoff (0.24), 1.0 at apex (0.46), 0 at landing touchdown (0.68)
        const parabola = 4 * flightU * (1 - flightU);
        airborneHeight = parabola * jumpHeight;

        // Smooth airborne knee tuck peaking near apex, extending downward before landing
        const tuck = Math.sin(flightU * Math.PI);
        dirTuck = tuck;
        pelvisPitch = 0.12 * parabola + vz * 0.10 * tuck;
        spinePitch = 0.08 * parabola;
        hipFlex = -0.08 - 0.56 * tuck;
        kneeFlex = 0.14 + 0.92 * tuck;
        plantarFlex = 0.32 * (1 - flightU * 0.5) * tuck;

        armPitch = -1.15 * (1 - flightU * 0.55) * (0.35 + 0.65 * parabola) - 0.18;
        armRoll = 0.12 + 0.18 * parabola;
        elbowBend = 0.48 + 0.28 * parabola;
      } else {
        // Phase 5 & 6: Simultaneous Grounded Landing with Bent Knees (0.68..0.84) & Smooth Recovery to Neutral (0.84..1.00)
        const landU = (u - 0.68) / 0.32;
        const absorb = Math.sin(Math.pow(landU, 0.72) * Math.PI) * (1 - smoothstep(0.72, 1.0, landU));

        pelvisPitch = 0.24 * absorb;
        spinePitch = 0.18 * absorb;
        hipFlex = -0.02 - 0.78 * absorb;
        kneeFlex = 0.06 + 1.28 * absorb;
        plantarFlex = 0;

        armPitch = -0.04 - 0.48 * absorb;
        armRoll = 0.08 + 0.12 * absorb;
        elbowBend = 0.20 + 0.52 * absorb;
      }

      const leftThighPitch = hipFlex - vz * dirTuck * 0.14;
      const rightThighPitch = hipFlex - vz * dirTuck * 0.14;
      const leftThighRoll = 0.045 + vx * dirTuck * 0.14;
      const rightThighRoll = -0.045 + vx * dirTuck * 0.14;

      // During airborne flight, knee tucking lifts the feet upward toward the pelvis rather than pulling the pelvis CoM downward
      const stanceRefFactor = 1 - dirTuck * 0.88;
      const groundedPelvisY = computeGroundedPelvisY(
        pelvisPitch * stanceRefFactor,
        leftThighPitch * stanceRefFactor,
        leftThighRoll,
        kneeFlex * stanceRefFactor,
        rightThighPitch * stanceRefFactor,
        rightThighRoll,
        kneeFlex * stanceRefFactor
      );

      pose.pelvisPos = [
        vx * dirTuck * 0.05,
        groundedPelvisY + airborneHeight,
        vz * dirTuck * 0.05,
      ];
      pose.rotations.Pelvis = [pelvisPitch, 0, -vx * dirTuck * 0.08];
      pose.rotations.Spine_01 = [spinePitch * 0.6, 0, 0];
      pose.rotations.Spine_02 = [spinePitch * 0.4, 0, 0];
      pose.rotations.Chest = [spinePitch * 0.35, 0, 0];
      pose.rotations.Neck = [-(pelvisPitch + spinePitch) * 0.45, 0, 0];
      pose.rotations.Head = [-(pelvisPitch + spinePitch) * 0.55, 0, 0];

      // Both legs move symmetrically so both feet leave and touch the ground simultaneously
      pose.rotations.Left_Thigh = [leftThighPitch, 0, leftThighRoll];
      pose.rotations.Right_Thigh = [rightThighPitch, 0, rightThighRoll];
      pose.rotations.Left_Calf = [kneeFlex, 0, 0];
      pose.rotations.Right_Calf = [kneeFlex, 0, 0];

      const flatFootAngle = -(pelvisPitch + hipFlex + kneeFlex);
      pose.rotations.Left_Foot = [
        airborneHeight > 0.01 ? plantarFlex : flatFootAngle + plantarFlex,
        0,
        -leftThighRoll * 0.5,
      ];
      pose.rotations.Right_Foot = [
        airborneHeight > 0.01 ? plantarFlex : flatFootAngle + plantarFlex,
        0,
        -rightThighRoll * 0.5,
      ];
      pose.rotations.Left_Toe = [plantarFlex > 0.05 ? 0.24 * plantarFlex : 0, 0, 0];
      pose.rotations.Right_Toe = [plantarFlex > 0.05 ? 0.24 * plantarFlex : 0, 0, 0];

      pose.rotations.Left_UpperArm = [armPitch, 0, -armRoll];
      pose.rotations.Right_UpperArm = [armPitch, 0, armRoll];
      pose.rotations.Left_Forearm = [-elbowBend, 0, 0];
      pose.rotations.Right_Forearm = [-elbowBend, 0, 0];
      break;
    }

    case 'dodge_evade': {
      if (vKey === 'DDG_TO_RUN' && u > 0.55) {
        const blendRun = smoothstep(0.55, 1.0, u);
        const runPose = evaluateDirectionalGait((u - 0.55) * 1.6, dirId, {
          stridePitch: 0.78 * blendRun,
          strideRoll: 0.42 * blendRun,
          kneeLift: 1.12 * blendRun,
          stanceKneeFlex: 0.38 * (1 - blendRun) + 0.16 * blendRun,
          pelvisBounce: 0.062 * blendRun,
          pelvisSway: 0.024,
          pelvisTwist: 0.20 * blendRun,
          torsoForwardLean: 0.24,
          torsoSideLean: 0.09 * blendRun,
          armSwingPitch: 0.68 * blendRun,
          elbowBaseBend: 1.15,
          elbowSwingAmp: 0.42 * blendRun,
          crouchDrop: 0.14 * (1 - blendRun) + 0.03 * blendRun,
          upperBodyAimLock: 0,
        });
        pose = runPose;
        break;
      }

      // Rapid directional weight transfer burst peaking at u = 0.45 with grounded foot kinematics
      const endCrouch = vKey === 'DDG_TO_CRW' ? smoothstep(0.45, 1.0, u) : 0;
      const burst = Math.max(Math.sin(u * Math.PI), endCrouch * 0.78);
      const leanAmp =
        vKey === 'DDG_LONG' || vKey === 'DDG_SIDESTEP_EMERG'
          ? 0.36
          : vKey === 'DDG_SHORT' || vKey === 'DDG_SIDESTEP_QUICK'
            ? 0.18
            : 0.28;

      const pelvisPitch = vz * burst * leanAmp + endCrouch * 0.18;
      const leftThighPitch = -0.68 * burst - vz * burst * 0.28;
      const rightThighPitch = -0.68 * burst + vz * burst * 0.22;
      const leftThighRoll = 0.08 + vx * burst * 0.28;
      const rightThighRoll = -0.08 + vx * burst * 0.28;
      const kneeFlex = 0.08 + 1.24 * burst;

      const groundedY = computeGroundedPelvisY(
        pelvisPitch,
        leftThighPitch,
        leftThighRoll,
        kneeFlex,
        rightThighPitch,
        rightThighRoll,
        kneeFlex
      );

      pose.pelvisPos = [
        vx * burst * 0.26,
        groundedY,
        vz * burst * 0.26,
      ];
      pose.rotations.Pelvis = [pelvisPitch, -vx * burst * 0.24, -vx * burst * leanAmp * 0.75];
      pose.rotations.Spine_01 = [0.22 * burst, vx * burst * 0.15, -vx * burst * 0.12];
      pose.rotations.Chest = [0.18 * burst, vx * burst * 0.10, 0];
      pose.rotations.Head = [-0.32 * burst, 0, vx * burst * 0.18];

      pose.rotations.Left_Thigh = [leftThighPitch, 0, leftThighRoll];
      pose.rotations.Right_Thigh = [rightThighPitch, 0, rightThighRoll];
      pose.rotations.Left_Calf = [kneeFlex, 0, 0];
      pose.rotations.Right_Calf = [kneeFlex, 0, 0];
      pose.rotations.Left_Foot = [-(pelvisPitch + leftThighPitch + kneeFlex), 0, -leftThighRoll * 0.4];
      pose.rotations.Right_Foot = [-(pelvisPitch + rightThighPitch + kneeFlex), 0, -rightThighRoll * 0.4];

      // High protective guard during dodge
      pose.rotations.Left_UpperArm = [-0.55 * burst, 0.20 * burst, -0.22];
      pose.rotations.Right_UpperArm = [-0.55 * burst, -0.20 * burst, 0.22];
      pose.rotations.Left_Forearm = [-1.42 * burst - 0.20, 0, 0];
      pose.rotations.Right_Forearm = [-1.42 * burst - 0.20, 0, 0];
      break;
    }

    case 'roll_directional': {
      // ========================================================================
      // EIGHT-DIRECTIONAL ROLLING SYSTEM (ROLL_D01 to ROLL_D08 & Transitions)
      // Anatomically accurate 3-phase ground roll along any 8-direction vector:
      // 1) Entry Weight Transfer / Run-Dive / Drop-Landing [0.00..tRollStart]
      // 2) Full 360° (2*PI) Tucked Ground Rotation around horizontal axis [vz, 0, -vx] [tRollStart..tRollEnd]
      // 3) Shin-to-Foot Plant & Smooth Recovery to Idle or Running Stride [tRollEnd..1.00]
      // ========================================================================
      const isRunEntry = vKey === 'RUN_TO_ROLL' || vKey === 'TR_RUN_ROLL';
      const isLandEntry = vKey === 'LAND_ROLL';
      const isRunExit = vKey === 'ROLL_TO_RUN' || vKey === 'TR_ROLL_RUN' || isRunEntry;

      const tRollStart = isRunEntry ? 0.22 : isLandEntry ? 0.18 : 0.18;
      const tRollEnd = isRunExit ? 0.72 : 0.76;

      if (isRunEntry && u < tRollStart) {
        // Phase 1A: Running stride diving smoothly into tucked roll entry
        const diveT = smoothstep(0.0, tRollStart, u);
        const runPose = evaluateDirectionalGait((u / tRollStart) * 0.5, dirId, {
          stridePitch: 0.75 * (1 - diveT),
          strideRoll: 0.40 * (1 - diveT),
          kneeLift: 1.05 * (1 - diveT),
          stanceKneeFlex: 0.16 + diveT * 1.25,
          pelvisBounce: 0.04 * (1 - diveT),
          pelvisSway: 0.02 * (1 - diveT),
          pelvisTwist: 0.15 * (1 - diveT),
          torsoForwardLean: 0.22 + diveT * 0.45,
          torsoSideLean: 0.08 * (1 - diveT),
          armSwingPitch: 0.55 * (1 - diveT),
          elbowBaseBend: 1.10,
          elbowSwingAmp: 0.30 * (1 - diveT),
          crouchDrop: 0.04 + diveT * 0.28,
          upperBodyAimLock: 0,
        });
        pose = runPose;
        pose.rotations.Neck[0] = diveT * 0.38;
        pose.rotations.Head[0] = diveT * 0.42;
        pose.rotations.Left_UpperArm[0] = -0.35 - diveT * 0.95;
        pose.rotations.Right_UpperArm[0] = -0.35 - diveT * 0.95;
        break;
      }

      if (isRunExit && u > tRollEnd) {
        // Phase 3B: Surging out of the ground roll directly into active running locomotion
        const exitU = (u - tRollEnd) / (1 - tRollEnd);
        const runBlend = smoothstep(0.0, 1.0, exitU);
        pose = evaluateDirectionalGait(exitU * 0.5, dirId, {
          stridePitch: 0.32 + 0.46 * runBlend,
          strideRoll: 0.20 + 0.22 * runBlend,
          kneeLift: 0.48 + 0.64 * runBlend,
          stanceKneeFlex: 0.95 * (1 - runBlend) + 0.16 * runBlend,
          pelvisBounce: 0.058 * runBlend,
          pelvisSway: 0.024 * runBlend,
          pelvisTwist: 0.18 * runBlend,
          torsoForwardLean: 0.42 * (1 - runBlend) + 0.18 * runBlend,
          torsoSideLean: 0.08 * runBlend,
          armSwingPitch: 0.68 * runBlend,
          elbowBaseBend: 1.15,
          elbowSwingAmp: 0.40 * runBlend,
          crouchDrop: 0.26 * (1 - runBlend) + 0.03 * runBlend,
          upperBodyAimLock: 0,
        });
        break;
      }

      // Compute continuous roll progress rollU in [0, 1] and tuck envelope tuckEnv in [0, 1]
      let rollU = 0;
      let tuckEnv = 0;
      let dropAirHeight = 0;

      if (u < tRollStart) {
        const entryT = u / tRollStart;
        tuckEnv = smoothstep(0.0, 1.0, entryT);
        rollU = 0;
        if (isLandEntry) {
          dropAirHeight = (1 - smoothstep(0.0, 0.75, entryT)) * 0.28;
        }
      } else if (u <= tRollEnd) {
        const rawRoll = (u - tRollStart) / (tRollEnd - tRollStart);
        rollU = smoothstep(0.0, 1.0, rawRoll);
        // Full tuck throughout the 360° ground roll
        tuckEnv = 1.0;
      } else {
        const recT = (u - tRollEnd) / (1 - tRollEnd);
        rollU = 1.0;
        tuckEnv = 1.0 - smoothstep(0.0, 1.0, recT);
      }

      // Exact 360° (2*PI) rotation around the horizontal axis perpendicular to [vx, vz]:
      // Cross product of Up (0, 1, 0) x Direction (vx, 0, vz) = (vz, 0, -vx)
      const rollAngle = rollU * Math.PI * 2;
      const groundContactPhase = Math.sin(rollU * Math.PI);

      // Compute exact quaternion for the 360° pelvis rotation + subtle oblique shoulder line
      _rollAxis.set(vz, 0, -vx).normalize();
      _rollQuat.setFromAxisAngle(_rollAxis, rollAngle);

      // Before/after the 360° spin, add preparatory/recovery forward-directional lean
      const prepLeanPitch = vz * tuckEnv * (1 - groundContactPhase) * 0.34;
      const prepLeanRoll = -vx * tuckEnv * (1 - groundContactPhase) * 0.34;
      const obliqueYaw = Math.atan2(-vx, vz) * 0.22 * tuckEnv * (1 - groundContactPhase);
      _baseEuler.set(prepLeanPitch, obliqueYaw, prepLeanRoll, 'XYZ');
      _baseQuat.setFromEuler(_baseEuler);
      _rollQuat.multiply(_baseQuat);
      _rollEuler.setFromQuaternion(_rollQuat, 'XYZ');

      // Limb & Spine Tuck Angles:
      // Tightly curled thoracic/lumbar spine and chin-to-chest cervical flexion protect the head & neck
      const hipFlex = -0.02 - 1.36 * tuckEnv;
      const kneeFlex = 0.06 + 1.82 * tuckEnv;
      const spineCurl = 0.44 * tuckEnv;

      // Grounded pelvis height when feet are planted (entry & exit) vs rounded back contact radius during roll
      const plantedPelvisY = computeGroundedPelvisY(
        prepLeanPitch,
        hipFlex * (1 - groundContactPhase * 0.35),
        0.06,
        kneeFlex * (1 - groundContactPhase * 0.35),
        hipFlex * (1 - groundContactPhase * 0.35),
        -0.06,
        kneeFlex * (1 - groundContactPhase * 0.35)
      );
      // During mid-roll (groundContactPhase = 1), the rounded shoulders/back roll across y = 0.00m with pelvis at y = 0.31m
      const rollingPelvisY = THREE.MathUtils.lerp(plantedPelvisY, 0.31, groundContactPhase);

      // Progressive weight transfer displacement along [vx, vz] even in in-place preview
      const weightShiftDist = Math.sin(u * Math.PI) * 0.26;
      pose.pelvisPos = [
        vx * weightShiftDist,
        rollingPelvisY + dropAirHeight,
        vz * weightShiftDist,
      ];

      pose.rotations.Pelvis = [_rollEuler.x, _rollEuler.y, _rollEuler.z];
      pose.rotations.Spine_01 = [spineCurl, 0, 0];
      pose.rotations.Spine_02 = [spineCurl * 0.95, 0, 0];
      pose.rotations.Chest = [spineCurl * 0.85, 0, 0];
      pose.rotations.Neck = [0.42 * tuckEnv, 0, 0];
      pose.rotations.Head = [0.46 * tuckEnv, 0, 0];

      // Slight lead/trail leg offset during tuck & uncoil for natural shin-to-foot weight transfer
      const legAsym = Math.sin(rollU * Math.PI) * 0.14;
      pose.rotations.Left_Thigh = [hipFlex - legAsym, 0, 0.06 + 0.06 * tuckEnv];
      pose.rotations.Right_Thigh = [hipFlex + legAsym, 0, -0.06 - 0.06 * tuckEnv];
      pose.rotations.Left_Calf = [kneeFlex, 0, 0];
      pose.rotations.Right_Calf = [kneeFlex, 0, 0];

      const flatAnkle = -(prepLeanPitch + hipFlex + kneeFlex);
      const ankleAngle = THREE.MathUtils.lerp(flatAnkle, 0.15, groundContactPhase);
      pose.rotations.Left_Foot = [ankleAngle, 0, -0.04];
      pose.rotations.Right_Foot = [ankleAngle, 0, 0.04];

      // Arms reach to cushion shoulder entry, then tuck close to shins/chest to complete the roll
      const armReach = Math.sin(Math.min(1, u / 0.35) * Math.PI) * (1 - groundContactPhase * 0.5);
      pose.rotations.Left_Clavicle = [0.18 * tuckEnv, 0, 0.12 * tuckEnv];
      pose.rotations.Right_Clavicle = [0.18 * tuckEnv, 0, -0.12 * tuckEnv];
      pose.rotations.Left_UpperArm = [-0.04 - 1.18 * tuckEnv - 0.35 * armReach, 0.22 * tuckEnv, -0.14];
      pose.rotations.Right_UpperArm = [-0.04 - 1.18 * tuckEnv - 0.35 * armReach, -0.22 * tuckEnv, 0.14];
      pose.rotations.Left_Forearm = [-0.16 - 1.32 * tuckEnv, 0, 0.18 * tuckEnv];
      pose.rotations.Right_Forearm = [-0.16 - 1.32 * tuckEnv, 0, -0.18 * tuckEnv];
      break;
    }

    case 'slide_directional': {
      // ========================================================================
      // EIGHT-DIRECTIONAL SLIDING SYSTEM (SLIDE_D01 to SLIDE_D08 & Transitions)
      // Low-profile tactical ground slide:
      // 1) Approach / Rapid Center-of-Mass Drop [0.00..0.22]
      // 2) Figure-4 Ground Slide (extended lead leg, tucked trail leg, reclined torso) [0.22..0.72]
      // 3) Trail-Leg Drive Recovery to Stand, Run, or Crouch [0.72..1.00]
      // ========================================================================
      const isRunEntry = vKey === 'RUN_TO_SLIDE' || vKey === 'TR_RUN_SLIDE';
      const isRunExit = vKey === 'SLIDE_TO_RUN' || vKey === 'TR_SLIDE_RUN';
      const isCrouchExit = vKey === 'SLIDE_TO_CROUCH' || vKey === 'TR_SLIDE_CRW';

      if (isRunEntry && u < 0.20) {
        const dropT = smoothstep(0.0, 0.20, u);
        pose = evaluateDirectionalGait(u * 1.5, dirId, {
          stridePitch: 0.78 * (1 - dropT * 0.5),
          strideRoll: 0.42 * (1 - dropT * 0.5),
          kneeLift: 1.10 * (1 - dropT * 0.6),
          stanceKneeFlex: 0.16 + dropT * 0.85,
          pelvisBounce: 0.05 * (1 - dropT),
          pelvisSway: 0.02,
          pelvisTwist: 0.18,
          torsoForwardLean: 0.18 * (1 - dropT * 1.5),
          torsoSideLean: 0.08,
          armSwingPitch: 0.65 * (1 - dropT * 0.5),
          elbowBaseBend: 1.15,
          elbowSwingAmp: 0.35,
          crouchDrop: 0.04 + dropT * 0.32,
          upperBodyAimLock: 0,
        });
        break;
      }

      if (isRunExit && u > 0.74) {
        const runT = smoothstep(0.74, 1.0, u);
        pose = evaluateDirectionalGait((u - 0.74) * 1.6, dirId, {
          stridePitch: 0.36 + 0.42 * runT,
          strideRoll: 0.22 + 0.20 * runT,
          kneeLift: 0.52 + 0.60 * runT,
          stanceKneeFlex: 0.75 * (1 - runT) + 0.16 * runT,
          pelvisBounce: 0.055 * runT,
          pelvisSway: 0.024,
          pelvisTwist: 0.18 * runT,
          torsoForwardLean: 0.32 * (1 - runT) + 0.18 * runT,
          torsoSideLean: 0.08 * runT,
          armSwingPitch: 0.66 * runT,
          elbowBaseBend: 1.15,
          elbowSwingAmp: 0.40 * runT,
          crouchDrop: 0.24 * (1 - runT) + 0.03 * runT,
          upperBodyAimLock: 0,
        });
        break;
      }

      const entryEnv = smoothstep(0.0, 0.24, u);
      const exitEnv = isCrouchExit
        ? 1.0 - 0.35 * smoothstep(0.72, 1.0, u)
        : 1.0 - smoothstep(0.72, 1.0, u);
      const slideEnv = entryEnv * exitEnv;
      const endCrouch = isCrouchExit ? smoothstep(0.72, 1.0, u) : 0;

      // Determine lead vs trail leg based on lateral direction (Left leads for D01/D07/D08, Right leads for D02/D03/D04)
      const leftLeads = vx >= -0.05;
      const dirSignZ = vz >= -0.15 ? 1 : -0.75;

      // Upper body reclines back/away from slide direction while head/neck counter-flex forward to keep gaze level
      const pelvisPitch = -0.46 * dirSignZ * slideEnv + endCrouch * 0.22;
      const pelvisYaw = (leftLeads ? -0.32 : 0.32) * slideEnv + Math.atan2(-vx, vz) * 0.22 * slideEnv;
      const pelvisRoll = (leftLeads ? 0.22 : -0.22) * slideEnv + vx * 0.18 * slideEnv;

      // Lead leg extends along the ground plane; trail leg tucks underneath in a figure-4 support
      const leadHipPitch = -0.52 * slideEnv - endCrouch * 0.88;
      const leadKneeFlex = 0.20 * slideEnv + 0.06 * (1 - slideEnv) + endCrouch * 1.42;
      const leadHipRoll = (leftLeads ? 0.12 : -0.12) * slideEnv;

      const trailHipPitch = -0.88 * slideEnv - endCrouch * 0.92;
      const trailKneeFlex = 1.56 * slideEnv + 0.06 * (1 - slideEnv) + endCrouch * 1.46;
      const trailHipRoll = (leftLeads ? -0.32 : 0.32) * slideEnv;
      const trailHipYaw = (leftLeads ? -0.38 : 0.38) * slideEnv;

      const leftThighPitch = leftLeads ? leadHipPitch : trailHipPitch;
      const rightThighPitch = leftLeads ? trailHipPitch : leadHipPitch;
      const leftKnee = leftLeads ? leadKneeFlex : trailKneeFlex;
      const rightKnee = leftLeads ? trailKneeFlex : leadKneeFlex;
      const leftRoll = leftLeads ? leadHipRoll : trailHipRoll;
      const rightRoll = leftLeads ? trailHipRoll : leadHipRoll;

      const uprightY = computeGroundedPelvisY(
        endCrouch * 0.22,
        -endCrouch * 0.90,
        0.05,
        0.06 + endCrouch * 1.44,
        -endCrouch * 0.90,
        -0.05,
        0.06 + endCrouch * 1.44
      );
      // At full slide (slideEnv = 1), pelvis glides at y = 0.30m off the ground so the tucked trail calf & extended heel skim y = 0.00m
      const slidePelvisY = THREE.MathUtils.lerp(uprightY, 0.30, slideEnv);
      const slideTravel = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.34;

      pose.pelvisPos = [
        vx * slideTravel,
        slidePelvisY,
        vz * slideTravel,
      ];
      pose.rotations.Pelvis = [pelvisPitch, pelvisYaw, pelvisRoll];
      pose.rotations.Spine_01 = [0.24 * slideEnv + endCrouch * 0.18, -pelvisYaw * 0.45, -pelvisRoll * 0.4];
      pose.rotations.Spine_02 = [0.20 * slideEnv + endCrouch * 0.12, -pelvisYaw * 0.35, -pelvisRoll * 0.3];
      pose.rotations.Chest = [0.22 * slideEnv + endCrouch * 0.10, -pelvisYaw * 0.25, 0];
      pose.rotations.Neck = [0.32 * slideEnv - endCrouch * 0.24, 0, 0];
      pose.rotations.Head = [0.36 * slideEnv - endCrouch * 0.32, 0, 0];

      pose.rotations.Left_Thigh = [leftThighPitch, leftLeads ? 0 : trailHipYaw, leftRoll];
      pose.rotations.Right_Thigh = [rightThighPitch, leftLeads ? trailHipYaw : 0, rightRoll];
      pose.rotations.Left_Calf = [leftKnee, 0, 0];
      pose.rotations.Right_Calf = [rightKnee, 0, 0];

      pose.rotations.Left_Foot = [0.22 * slideEnv - endCrouch * 0.65, 0, 0];
      pose.rotations.Right_Foot = [0.22 * slideEnv - endCrouch * 0.65, 0, 0];

      // Lead arm in forward tactical guard; trail arm extended back/outward for low-CG balance
      if (leftLeads) {
        pose.rotations.Left_UpperArm = [-0.68 * slideEnv - 0.04, 0.22 * slideEnv, -0.22];
        pose.rotations.Left_Forearm = [-1.28 * slideEnv - 0.16, 0, 0];
        pose.rotations.Right_UpperArm = [0.42 * slideEnv - 0.04, -0.18 * slideEnv, 0.48 * slideEnv + 0.06];
        pose.rotations.Right_Forearm = [-0.36 * slideEnv - 0.16, 0, 0];
      } else {
        pose.rotations.Right_UpperArm = [-0.68 * slideEnv - 0.04, -0.22 * slideEnv, 0.22];
        pose.rotations.Right_Forearm = [-1.28 * slideEnv - 0.16, 0, 0];
        pose.rotations.Left_UpperArm = [0.42 * slideEnv - 0.04, 0.18 * slideEnv, -0.48 * slideEnv - 0.06];
        pose.rotations.Left_Forearm = [-0.36 * slideEnv - 0.16, 0, 0];
      }
      break;
    }

    case 'strafe_combat': {
      const isFast = vKey === 'STR_FAST';
      const isSlow = vKey === 'STR_SLOW';
      const isGuard = vKey === 'STR_GRD' || vKey === 'STR_DEF' || vKey === 'STR_CMB';
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: isFast ? 0.58 : isSlow ? 0.32 : 0.45,
        strideRoll: isFast ? 0.42 : 0.32,
        kneeLift: isFast ? 0.78 : 0.55,
        stanceKneeFlex: vKey === 'STR_DEF' ? 0.28 : 0.18,
        pelvisBounce: 0.024,
        pelvisSway: 0.025,
        pelvisTwist: 0.08,
        torsoForwardLean: vKey === 'STR_DEF' ? 0.22 : 0.14,
        torsoSideLean: 0.06,
        armSwingPitch: isGuard ? 0.08 : 0.20,
        elbowBaseBend: isGuard ? 1.55 : 1.25,
        elbowSwingAmp: 0.10,
        crouchDrop: vKey === 'STR_DEF' ? 0.12 : 0.06,
        upperBodyAimLock: 1.0, // Upper body stays locked forward!
      });
      if (vKey === 'STR_AIM' || isGuard) {
        pose.rotations.Left_UpperArm = [-0.68, 0.28, -0.18];
        pose.rotations.Right_UpperArm = [-0.72, -0.22, 0.18];
        pose.rotations.Left_Forearm = [-1.52, 0, 0];
        pose.rotations.Right_Forearm = [-1.58, 0, 0];
      }
      break;
    }

    case 'turn_in_place': {
      const targetRad = ((meta.turnAngleDeg ?? 90) * Math.PI) / 180;
      const smoothYaw = targetRad * smoothstep(0, 1, u);
      const stepArc = Math.sin(u * Math.PI);
      const leadLeft = targetRad < 0; // Turning left (+Y rotation)

      const isCrouch = vKey === 'CRW';
      const isStealth = vKey === 'STL';
      const isCombat = vKey === 'CMB';
      const isRunOrSpr = vKey === 'RUN' || vKey === 'SPR';

      const baseHipFlex = isCrouch ? -0.88 : isStealth ? -0.46 : isCombat ? -0.22 : isRunOrSpr ? -0.18 : -0.02;
      const baseKneeFlex = isCrouch ? 1.42 : isStealth ? 0.78 : isCombat ? 0.38 : isRunOrSpr ? 0.28 : 0.06;
      const basePelvisPitch = isCrouch ? 0.24 : isStealth ? 0.16 : isRunOrSpr ? 0.18 : 0.06;

      const leftStep = leadLeft
        ? Math.sin(Math.min(1, u * 1.35) * Math.PI)
        : Math.sin(Math.max(0, (u - 0.26) * 1.35) * Math.PI);
      const rightStep = !leadLeft
        ? Math.sin(Math.min(1, u * 1.35) * Math.PI)
        : Math.sin(Math.max(0, (u - 0.26) * 1.35) * Math.PI);

      const leftThighPitch = baseHipFlex - leftStep * 0.36;
      const rightThighPitch = baseHipFlex - rightStep * 0.36;
      const leftKnee = baseKneeFlex + leftStep * 0.62;
      const rightKnee = baseKneeFlex + rightStep * 0.62;
      const leftRoll = 0.05 + leftStep * 0.10;
      const rightRoll = -0.05 - rightStep * 0.10;

      const groundedY = computeGroundedPelvisY(
        basePelvisPitch,
        leftThighPitch,
        leftRoll,
        leftKnee,
        rightThighPitch,
        rightRoll,
        rightKnee,
        leftStep * 0.06,
        rightStep * 0.06
      );

      pose.pelvisPos = [0, groundedY, 0];
      pose.rotations.Pelvis = [basePelvisPitch, smoothYaw, 0];

      // Head and chest lead the turn before pelvis catches up
      const leadOffset = targetRad * 0.18 * stepArc;
      pose.rotations.Spine_01 = [basePelvisPitch * 0.6, leadOffset * 0.4, 0];
      pose.rotations.Chest = [basePelvisPitch * 0.4, leadOffset * 0.6, 0];
      pose.rotations.Head = [-basePelvisPitch * 0.8, leadOffset * 0.8, 0];

      pose.rotations.Left_Thigh = [leftThighPitch, 0, leftRoll];
      pose.rotations.Left_Calf = [leftKnee, 0, 0];
      pose.rotations.Right_Thigh = [rightThighPitch, 0, rightRoll];
      pose.rotations.Right_Calf = [rightKnee, 0, 0];

      pose.rotations.Left_Foot = [-(basePelvisPitch + leftThighPitch + leftKnee) * (1 - leftStep * 0.4), 0, -leftRoll * 0.5];
      pose.rotations.Right_Foot = [-(basePelvisPitch + rightThighPitch + rightKnee) * (1 - rightStep * 0.4), 0, -rightRoll * 0.5];

      if (isCombat) {
        pose.rotations.Left_UpperArm = [-0.55, 0.24, -0.16];
        pose.rotations.Right_UpperArm = [-0.48, -0.24, 0.16];
        pose.rotations.Left_Forearm = [-1.62, 0, 0];
        pose.rotations.Right_Forearm = [-1.68, 0, 0];
      } else {
        const elbowBase = isCrouch || isStealth ? -0.88 : isRunOrSpr ? -1.10 : -0.35;
        pose.rotations.Left_UpperArm = [-0.15 - stepArc * 0.18, 0, -0.10];
        pose.rotations.Right_UpperArm = [-0.15 - stepArc * 0.18, 0, 0.10];
        pose.rotations.Left_Forearm = [elbowBase - stepArc * 0.22, 0, 0];
        pose.rotations.Right_Forearm = [elbowBase - stepArc * 0.22, 0, 0];
      }
      break;
    }

    case 'combat_locomotion': {
      const isRun = vKey === 'CMB_RUN' || vKey === 'CMB_RAPD';
      const isCautious = vKey === 'CMB_CAUT';
      const isDefensive = vKey === 'CMB_DEF' || vKey === 'CMB_GRD';
      const isRetreat = vKey === 'CMB_RET';
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: isRun ? 0.68 : isCautious ? 0.34 : 0.44,
        strideRoll: 0.34,
        kneeLift: isRun ? 0.92 : isCautious ? 0.44 : 0.56,
        stanceKneeFlex: isDefensive ? 0.28 : 0.20,
        pelvisBounce: isRun ? 0.045 : 0.025,
        pelvisSway: 0.024,
        pelvisTwist: 0.12,
        torsoForwardLean: isRetreat ? 0.06 : isDefensive ? 0.24 : 0.18,
        torsoSideLean: 0.06,
        armSwingPitch: 0.14,
        elbowBaseBend: 1.65,
        elbowSwingAmp: 0.14,
        crouchDrop: isDefensive ? 0.12 : 0.07,
        upperBodyAimLock: 0.85,
      });
      const guardLift = isDefensive ? -0.72 : -0.56;
      pose.rotations.Left_UpperArm = [guardLift, 0.26, -0.18];
      pose.rotations.Right_UpperArm = [guardLift + 0.04, -0.26, 0.18];
      pose.rotations.Left_Forearm = [-1.68, 0, 0.15];
      pose.rotations.Right_Forearm = [-1.75, 0, -0.15];
      break;
    }

    case 'combat_stationary': {
      const s = Math.sin(u * Math.PI * 2);
      const pulse = Math.sin(u * Math.PI);
      const guardFactor =
        vKey === 'CMB_GUARD_DOWN'
          ? 1 - smoothstep(0, 1, u)
          : vKey === 'CMB_GUARD_UP'
            ? smoothstep(0, 1, u)
            : vKey === 'CMB_STANCE_RELAX'
              ? 0.45
              : 1.0;

      // Handle stance switch (Orthodox <-> Southpaw hop-pivot)
      const stanceSign = vKey === 'CMB_STANCE_TRANS' ? Math.cos(smoothstep(0, 1, u) * Math.PI) : 1.0;
      const hopArc = vKey === 'CMB_STANCE_TRANS' ? Math.sin(u * Math.PI) : 0;
      const balRec = vKey === 'CMB_BALANCE_REC' ? Math.sin(u * Math.PI) : 0;
      const isShell = vKey === 'CMB_STANCE_DEF';

      const pelvisPitch = 0.08 + (isShell ? 0.12 : 0) + balRec * 0.16;
      const leftThighPitch = -0.24 * stanceSign - 0.10 - (isShell ? 0.18 : 0) - balRec * 0.28;
      const rightThighPitch = 0.16 * stanceSign - 0.10 - (isShell ? 0.18 : 0) - balRec * 0.28;
      const leftKnee = 0.42 + (isShell ? 0.25 : 0) + balRec * 0.45 + hopArc * 0.35;
      const rightKnee = 0.38 + (isShell ? 0.25 : 0) + balRec * 0.45 + hopArc * 0.35;

      const groundedY = computeGroundedPelvisY(
        pelvisPitch,
        leftThighPitch,
        0.08 + balRec * 0.08,
        leftKnee,
        rightThighPitch,
        -0.08 - balRec * 0.08,
        rightKnee,
        0,
        0,
        hopArc * 0.08
      );

      pose.pelvisPos = [0.015 * s + balRec * 0.06, groundedY + 0.012 * Math.abs(s), 0];
      pose.rotations.Pelvis = [pelvisPitch, -0.34 * stanceSign, -balRec * 0.12];
      pose.rotations.Spine_01 = [0.10 + (isShell ? 0.14 : 0), 0.18 * stanceSign, balRec * 0.10];
      pose.rotations.Chest = [
        0.08 + (vKey === 'CMB_BREATHE' ? 0.07 * s : 0.025 * s),
        0.16 * stanceSign,
        0,
      ];
      pose.rotations.Head = [-0.16 - (isShell ? 0.14 : 0), 0, 0];
      pose.rotations.Left_Thigh = [leftThighPitch, 0.14 * stanceSign, 0.08 + balRec * 0.08];
      pose.rotations.Right_Thigh = [rightThighPitch, -0.12 * stanceSign, -0.10 - balRec * 0.08];
      pose.rotations.Left_Calf = [leftKnee, 0, 0];
      pose.rotations.Right_Calf = [rightKnee, 0, 0];
      pose.rotations.Left_Foot = [-(pelvisPitch + leftThighPitch + leftKnee), 0, -0.06];
      pose.rotations.Right_Foot = [-(pelvisPitch + rightThighPitch + rightKnee), 0, 0.06];

      const shellLift = isShell ? -0.28 : 0;
      pose.rotations.Left_UpperArm = [(-0.56 + shellLift) * guardFactor, 0.28 * guardFactor, -0.16 - balRec * 0.22];
      pose.rotations.Right_UpperArm = [(-0.50 + shellLift) * guardFactor, -0.28 * guardFactor, 0.16 + balRec * 0.22];
      pose.rotations.Left_Forearm = [-0.25 - 1.48 * guardFactor, 0, isShell ? 0.25 : 0.12];
      pose.rotations.Right_Forearm = [-0.25 - 1.55 * guardFactor, 0, isShell ? -0.25 : -0.12];
      if (vKey === 'CMB_BREATHE') {
        pose.rotations.Left_Clavicle = [0, 0, 0.04 * pulse];
        pose.rotations.Right_Clavicle = [0, 0, -0.04 * pulse];
      }
      break;
    }

    case 'melee_action': {
      const strike = Math.sin(Math.pow(u, 0.82) * Math.PI);
      const isKick = vKey === 'MLE_KICK';
      const isBlock = vKey === 'MLE_BLOCK';
      const isParry = vKey === 'MLE_PARRY';
      const isCounter = vKey === 'MLE_COUNTER';
      const isRecover = vKey === 'MLE_RECOVER';
      const isCombo = vKey === 'MLE_COMBO';
      const isPushOrShove = vKey === 'MLE_PUSH' || vKey === 'MLE_SHOVE';
      const useLeft = meta.handSide === 'left';
      const useBoth = meta.handSide === 'both';

      const aimYaw = Math.atan2(-vx, vz) * 0.45;

      if (isKick) {
        // Snap kick: right leg lifts and extends while left support foot remains firmly planted
        const chamber = Math.sin(u * Math.PI);
        const extend = Math.max(0, Math.sin((u - 0.15) * Math.PI * 1.35));
        const pelvisPitch = -0.32 * extend;
        const supportThigh = -0.14 * chamber;
        const supportKnee = 0.26 * chamber + 0.06;
        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          supportThigh,
          0.08,
          supportKnee,
          supportThigh,
          -0.08,
          supportKnee
        );
        pose.pelvisPos = [vx * extend * 0.10, groundedY, vz * extend * 0.12];
        pose.rotations.Pelvis = [pelvisPitch, aimYaw + 0.28 * extend, 0.18 * chamber];
        pose.rotations.Spine_01 = [0.16 * extend, -0.18 * extend, 0];
        pose.rotations.Head = [0.14 * extend, -aimYaw * 0.5, 0];
        pose.rotations.Left_Thigh = [supportThigh, 0, 0.08];
        pose.rotations.Left_Calf = [supportKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + supportThigh + supportKnee), 0, -0.05];
        pose.rotations.Right_Thigh = [-1.48 * chamber, -aimYaw * 0.4, -0.22 * chamber];
        pose.rotations.Right_Calf = [Math.max(0.06, 1.45 * chamber * (1 - extend * 0.85)), 0, 0];
        pose.rotations.Right_Foot = [-0.35 * extend, 0, 0];
        pose.rotations.Left_UpperArm = [-0.55, 0.25, -0.22];
        pose.rotations.Right_UpperArm = [-0.35 + 0.45 * extend, -0.15, 0.28];
        pose.rotations.Left_Forearm = [-1.52, 0, 0];
        pose.rotations.Right_Forearm = [-1.35, 0, 0];
      } else if (isBlock || isParry) {
        const pelvisPitch = 0.12 * strike;
        const thighPitch = -0.28 * strike;
        const kneeFlex = 0.48 * strike + 0.08;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.08, kneeFlex, thighPitch, -0.08, kneeFlex);
        pose.pelvisPos = [-vx * strike * 0.06, groundedY, -vz * strike * 0.06];
        pose.rotations.Pelvis = [pelvisPitch, aimYaw + (isParry ? 0.32 * strike : 0), 0];
        pose.rotations.Chest = [0.16 * strike, isParry ? 0.28 * strike : 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.08];
        pose.rotations.Right_Thigh = [thighPitch * 0.7, 0, -0.08];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex * 0.85, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch * 0.7 + kneeFlex * 0.85), 0, 0];
        if (isParry) {
          const sweep = Math.sin(u * Math.PI * 1.5);
          pose.rotations.Left_UpperArm = [-0.95 * strike - 0.3, 0.55 * sweep, -0.22];
          pose.rotations.Left_Forearm = [-1.45 * strike - 0.3, 0, 0.42 * sweep];
          pose.rotations.Right_UpperArm = [-0.52, -0.24, 0.18];
          pose.rotations.Right_Forearm = [-1.62, 0, 0];
        } else {
          pose.rotations.Left_UpperArm = [-1.18 * strike - 0.3, 0.45 * strike, -0.22];
          pose.rotations.Right_UpperArm = [-1.18 * strike - 0.3, -0.45 * strike, 0.22];
          pose.rotations.Left_Forearm = [-1.72 * strike - 0.2, 0, 0.35 * strike];
          pose.rotations.Right_Forearm = [-1.72 * strike - 0.2, 0, -0.35 * strike];
        }
      } else {
        // Punch / Push / Shove / Counter / Combo / Recover
        const slipPhase = isCounter && u < 0.36 ? Math.sin((u / 0.36) * Math.PI) : 0;
        const strikePhase = isCounter
          ? u < 0.32
            ? 0
            : Math.sin(((u - 0.32) / 0.68) * Math.PI)
          : isRecover
            ? 1 - smoothstep(0, 1, u)
            : strike;

        const p1 = isCombo ? Math.max(0, Math.sin(u * Math.PI * 2)) : strikePhase;
        const p2 = isCombo ? Math.max(0, -Math.sin(u * Math.PI * 2)) : strikePhase;
        const twist = useBoth
          ? 0
          : useLeft
            ? -0.48 * p1
            : isCombo
              ? -0.45 * p1 + 0.52 * p2
              : 0.52 * p1;

        const pelvisPitch = 0.16 * strikePhase + 0.18 * slipPhase + (isPushOrShove ? 0.12 * strikePhase : 0);
        const leftThighPitch = -0.42 * strikePhase - 0.35 * slipPhase;
        const rightThighPitch = 0.18 * strikePhase - 0.35 * slipPhase;
        const leftKnee = 0.62 * strikePhase + 0.55 * slipPhase + 0.08;
        const rightKnee = 0.32 * strikePhase + 0.55 * slipPhase + 0.08;

        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          leftThighPitch,
          0.10,
          leftKnee,
          rightThighPitch,
          -0.10,
          rightKnee
        );

        pose.pelvisPos = [
          vx * strikePhase * 0.16 - slipPhase * 0.12,
          groundedY,
          vz * strikePhase * 0.18,
        ];
        pose.rotations.Pelvis = [pelvisPitch, aimYaw + twist * 0.45, slipPhase * 0.22];
        pose.rotations.Spine_01 = [0.14 * strikePhase, twist * 0.55, slipPhase * 0.18];
        pose.rotations.Chest = [0.12 * strikePhase, twist * 0.65, 0];
        pose.rotations.Head = [-0.18 * strikePhase, -twist * 0.65, 0];

        pose.rotations.Left_Thigh = [leftThighPitch, 0, 0.10];
        pose.rotations.Right_Thigh = [rightThighPitch, 0, -0.10];
        pose.rotations.Left_Calf = [leftKnee, 0, 0];
        pose.rotations.Right_Calf = [rightKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + leftThighPitch + leftKnee), 0, -0.05];
        pose.rotations.Right_Foot = [-(pelvisPitch + rightThighPitch + rightKnee), 0, 0.05];

        if (useLeft || useBoth || isCombo) {
          const ext = isCombo ? p1 : strikePhase;
          pose.rotations.Left_UpperArm = [-1.48 * ext - 0.42 * (1 - ext), 0.15, -0.12];
          pose.rotations.Left_Forearm = [-0.15 * ext - 1.55 * (1 - ext), 0, 0];
        } else {
          pose.rotations.Left_UpperArm = [-0.48, 0.25, -0.18];
          pose.rotations.Left_Forearm = [-1.65, 0, 0];
        }

        if (!useLeft || useBoth || isCombo) {
          const ext = isCombo ? p2 : strikePhase;
          pose.rotations.Right_UpperArm = [-1.52 * ext - 0.42 * (1 - ext), -0.15, 0.12];
          pose.rotations.Right_Forearm = [-0.15 * ext - 1.55 * (1 - ext), 0, 0];
        } else {
          pose.rotations.Right_UpperArm = [-0.48, -0.25, 0.18];
          pose.rotations.Right_Forearm = [-1.65, 0, 0];
        }
      }
      break;
    }

    case 'hit_reaction': {
      if (vKey === 'HIT_STG') {
        // Multi-step directional stagger fighting to keep balance
        const staggerDecay = 1 - smoothstep(0.65, 1.0, u);
        pose = evaluateDirectionalGait(u * 1.5, dirId, {
          stridePitch: 0.52 * staggerDecay,
          strideRoll: 0.36 * staggerDecay,
          kneeLift: 0.65 * staggerDecay,
          stanceKneeFlex: 0.32 * staggerDecay + 0.08,
          pelvisBounce: 0.035 * staggerDecay,
          pelvisSway: 0.055 * staggerDecay,
          pelvisTwist: 0.18 * staggerDecay,
          torsoForwardLean: -vz * 0.32 * staggerDecay,
          torsoSideLean: -vx * 0.28 * staggerDecay,
          armSwingPitch: 0.55 * staggerDecay,
          elbowBaseBend: 0.65,
          elbowSwingAmp: 0.35 * staggerDecay,
          crouchDrop: 0.12 * staggerDecay,
          upperBodyAimLock: 0,
        });
        break;
      }

      const recoil = Math.sin(Math.pow(u, 0.65) * Math.PI);
      const wobble = vKey === 'HIT_UNBALANCE' ? Math.sin(u * Math.PI * 4) * recoil : 0;
      const amp = meta.intensity === 'light' ? 0.45 : meta.intensity === 'heavy' ? 1.30 : 0.85;

      const isGut = vKey === 'HIT_ZONE_TORSO_LOW';
      const isHead = vKey === 'HIT_ZONE_HEAD';
      const isLegL = vKey === 'HIT_ZONE_LEG_L';
      const isLegR = vKey === 'HIT_ZONE_LEG_R';
      const isArmL = vKey === 'HIT_ZONE_ARM_L';
      const isArmR = vKey === 'HIT_ZONE_ARM_R';

      const pelvisPitch = isGut ? 0.28 * recoil : -vz * recoil * 0.20 * amp;
      const leftThighPitch = (isLegL ? -0.68 : -0.24) * recoil * amp;
      const rightThighPitch = (isLegR ? -0.68 : -0.18) * recoil * amp;
      const leftKnee = (isLegL ? 1.25 : 0.46) * recoil * amp + 0.06;
      const rightKnee = (isLegR ? 1.25 : 0.38) * recoil * amp + 0.06;

      const groundedY = computeGroundedPelvisY(
        pelvisPitch,
        leftThighPitch,
        0.08,
        leftKnee,
        rightThighPitch,
        -0.08,
        rightKnee
      );

      pose.pelvisPos = [
        -vx * recoil * 0.14 * amp + wobble * 0.08,
        groundedY,
        -vz * recoil * 0.14 * amp,
      ];
      pose.rotations.Pelvis = [
        pelvisPitch,
        vx * recoil * 0.25 * amp + (isArmL ? 0.25 * recoil : isArmR ? -0.25 * recoil : 0),
        vx * recoil * 0.16 * amp + wobble * 0.18,
      ];
      pose.rotations.Spine_01 = [
        isGut ? 0.58 * recoil : -vz * recoil * 0.25 * amp,
        isArmL ? 0.32 * recoil : isArmR ? -0.32 * recoil : 0,
        vx * recoil * 0.18 * amp + wobble * 0.15,
      ];
      pose.rotations.Chest = [
        isGut ? 0.35 * recoil : -vz * recoil * 0.28 * amp,
        isArmL ? 0.35 * recoil : isArmR ? -0.35 * recoil : 0,
        0,
      ];
      pose.rotations.Head = [
        isHead ? -0.62 * recoil : isGut ? 0.32 * recoil : -vz * recoil * 0.42 * amp,
        vx * recoil * 0.35 * amp + (vKey === 'HIT_RECOVER' ? Math.sin(u * Math.PI * 4) * 0.28 * recoil : 0),
        0,
      ];

      pose.rotations.Left_Thigh = [leftThighPitch, 0, 0.08];
      pose.rotations.Right_Thigh = [rightThighPitch, 0, -0.08];
      pose.rotations.Left_Calf = [leftKnee, 0, 0];
      pose.rotations.Right_Calf = [rightKnee, 0, 0];
      pose.rotations.Left_Foot = [-(pelvisPitch + leftThighPitch + leftKnee), 0, 0];
      pose.rotations.Right_Foot = [-(pelvisPitch + rightThighPitch + rightKnee), 0, 0];

      if (isGut) {
        pose.rotations.Left_UpperArm = [-0.55 * recoil, 0.45 * recoil, -0.10];
        pose.rotations.Right_UpperArm = [-0.55 * recoil, -0.45 * recoil, 0.10];
        pose.rotations.Left_Forearm = [-1.45 * recoil - 0.16, 0, 0.35 * recoil];
        pose.rotations.Right_Forearm = [-1.45 * recoil - 0.16, 0, -0.35 * recoil];
      } else if (isHead) {
        pose.rotations.Left_UpperArm = [-1.25 * recoil, 0.35 * recoil, -0.18];
        pose.rotations.Right_UpperArm = [-1.25 * recoil, -0.35 * recoil, 0.18];
        pose.rotations.Left_Forearm = [-1.75 * recoil - 0.16, 0, 0];
        pose.rotations.Right_Forearm = [-1.75 * recoil - 0.16, 0, 0];
      } else if (isArmL) {
        pose.rotations.Left_UpperArm = [0.35 * recoil, 0, -0.25 * recoil - 0.08];
        pose.rotations.Left_Forearm = [-0.65 * recoil - 0.16, 0, 0];
        pose.rotations.Right_UpperArm = [-0.68 * recoil, -0.55 * recoil, 0.10];
        pose.rotations.Right_Forearm = [-1.45 * recoil - 0.16, 0, 0];
      } else if (isArmR) {
        pose.rotations.Right_UpperArm = [0.35 * recoil, 0, 0.25 * recoil + 0.08];
        pose.rotations.Right_Forearm = [-0.65 * recoil - 0.16, 0, 0];
        pose.rotations.Left_UpperArm = [-0.68 * recoil, 0.55 * recoil, -0.10];
        pose.rotations.Left_Forearm = [-1.45 * recoil - 0.16, 0, 0];
      } else {
        pose.rotations.Left_UpperArm = [-0.48 * recoil, 0, -0.38 * recoil - 0.10 - wobble * 0.35];
        pose.rotations.Right_UpperArm = [-0.48 * recoil, 0, 0.38 * recoil + 0.10 + wobble * 0.35];
        pose.rotations.Left_Forearm = [-0.95 * recoil - 0.20, 0, 0];
        pose.rotations.Right_Forearm = [-0.95 * recoil - 0.20, 0, 0];
      }
      break;
    }

    case 'fall_sequence':
    case 'recovery_getup': {
      // Anatomically grounded knockdown & get-up sequence:
      // Stage 1 (p in [0, 0.55]): Knees & hips buckle down to kneeling/seated ground contact
      // Stage 2 (p in [0.55, 1.0]): Upper body lowers onto floor (prone, supine, or lateral) with limbs resting on y >= 0.00m
      const isRecovery = arch === 'recovery_getup';
      const rawP = isRecovery ? 1 - smoothstep(0.0, 1.0, u) : smoothstep(0.0, 0.92, u);
      const buckleP = Math.sin(Math.min(1, rawP * 1.45) * Math.PI);
      const floorP = smoothstep(0.35, 1.0, rawP);

      const isSupine =
        vKey === 'REC_GETUP_BACK' ||
        vKey === 'REC_SUPINE' ||
        vKey === 'REC_SEATED' ||
        (vz < -0.35 && vKey !== 'REC_GETUP_FRONT' && vKey !== 'REC_PRONE');
      const isLeftSide = vKey === 'REC_GETUP_LEFT' || (vx > 0.6 && Math.abs(vz) < 0.4);
      const isRightSide = vKey === 'REC_GETUP_RIGHT' || (vx < -0.6 && Math.abs(vz) < 0.4);
      const isKneelOnly = vKey === 'REC_KNEEL';

      if (isKneelOnly) {
        const kP = isRecovery ? 1 - smoothstep(0, 1, u) : smoothstep(0, 1, u);
        const pelvisPitch = 0.22 * kP;
        const leftThigh = -1.15 * kP;
        const leftKnee = 1.55 * kP + 0.06;
        const rightThigh = -0.18 * kP;
        const rightKnee = 1.62 * kP + 0.06;
        pose.pelvisPos = [0, THREE.MathUtils.lerp(0.90, 0.52, kP), 0];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [0.16 * kP, 0, 0];
        pose.rotations.Head = [-0.28 * kP, 0, 0];
        pose.rotations.Left_Thigh = [leftThigh, 0, 0.08];
        pose.rotations.Left_Calf = [leftKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + leftThigh + leftKnee), 0, 0];
        pose.rotations.Right_Thigh = [rightThigh, 0, -0.08];
        pose.rotations.Right_Calf = [rightKnee, 0, 0];
        pose.rotations.Right_Foot = [0.35 * kP, 0, 0];
        pose.rotations.Left_UpperArm = [-0.45 * kP, 0, -0.12];
        pose.rotations.Right_UpperArm = [-0.35 * kP, 0, 0.12];
        pose.rotations.Left_Forearm = [-0.75 * kP - 0.16, 0, 0];
        pose.rotations.Right_Forearm = [-0.65 * kP - 0.16, 0, 0];
        break;
      }

      const targetPitch = isSupine
        ? vKey === 'REC_SEATED'
          ? -0.55
          : -1.38
        : isLeftSide || isRightSide
          ? 0.25
          : 1.38;
      const targetRoll = isLeftSide ? -1.32 : isRightSide ? 1.32 : -vx * 0.45;

      // During knee buckle (buckleP), knees flex strongly; once lying on floor (floorP -> 1), legs extend along floor so shins never stick up in the air!
      const hipFlex = -1.05 * buckleP * (1 - floorP * 0.78) - (isSupine ? 0.18 * floorP : -0.12 * floorP);
      const kneeFlex = 0.06 + 1.48 * buckleP * (1 - floorP * 0.82) + 0.18 * floorP;

      const bucklePelvisY = computeGroundedPelvisY(
        0.24 * buckleP,
        hipFlex,
        0.08,
        kneeFlex,
        hipFlex,
        -0.08,
        kneeFlex
      );
      const finalFloorY = vKey === 'REC_SEATED' ? 0.28 : 0.22;
      const pelvisY = THREE.MathUtils.lerp(bucklePelvisY, finalFloorY, floorP);

      pose.pelvisPos = [
        vx * rawP * 0.28,
        pelvisY,
        vz * rawP * 0.32,
      ];
      pose.rotations.Pelvis = [
        0.24 * buckleP * (1 - floorP) + targetPitch * floorP,
        vx * floorP * 0.22,
        targetRoll * floorP,
      ];
      pose.rotations.Spine_01 = [isSupine ? 0.24 * floorP : 0.18 * buckleP - 0.12 * floorP, 0, 0];
      pose.rotations.Chest = [isSupine ? 0.18 * floorP : -0.10 * floorP, 0, 0];
      pose.rotations.Head = [isSupine ? 0.28 * floorP : -0.32 * floorP, 0, 0];

      pose.rotations.Left_Thigh = [hipFlex, 0, 0.10 + 0.08 * floorP];
      pose.rotations.Right_Thigh = [hipFlex * 0.9, 0, -0.10 - 0.08 * floorP];
      pose.rotations.Left_Calf = [kneeFlex, 0, 0];
      pose.rotations.Right_Calf = [kneeFlex * 0.92, 0, 0];
      pose.rotations.Left_Foot = [0.18 * floorP, 0, 0];
      pose.rotations.Right_Foot = [0.18 * floorP, 0, 0];

      // Arms brace ground during transition and rest alongside body on floor
      pose.rotations.Left_UpperArm = [
        isSupine ? 0.45 * floorP - 0.65 * buckleP : -1.05 * buckleP - 0.55 * floorP,
        0,
        -0.32 * rawP - 0.10,
      ];
      pose.rotations.Right_UpperArm = [
        isSupine ? 0.45 * floorP - 0.65 * buckleP : -1.05 * buckleP - 0.55 * floorP,
        0,
        0.32 * rawP + 0.10,
      ];
      pose.rotations.Left_Forearm = [-0.95 * buckleP - 0.35 * floorP - 0.16, 0, 0];
      pose.rotations.Right_Forearm = [-0.95 * buckleP - 0.35 * floorP - 0.16, 0, 0];
      break;
    }

    case 'injured_locomotion': {
      const isRightLimp = meta.legSide === 'right';
      const isRun = vKey === 'INJ_RUN';
      const isCrouch = vKey === 'INJ_CRW';
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: isRun ? 0.58 : 0.36,
        strideRoll: 0.24,
        kneeLift: isRun ? 0.78 : 0.45,
        stanceKneeFlex: 0.22,
        pelvisBounce: 0.032,
        pelvisSway: 0.038,
        pelvisTwist: 0.09,
        torsoForwardLean: isCrouch ? 0.42 : 0.26,
        torsoSideLean: isRightLimp ? -0.14 : 0.14,
        armSwingPitch: 0.18,
        elbowBaseBend: 0.55,
        elbowSwingAmp: 0.15,
        crouchDrop: isCrouch ? 0.24 : 0.08,
        upperBodyAimLock: 0.2,
        asymmetryLeft: isRightLimp ? 1.0 : 0.52,
        asymmetryRight: isRightLimp ? 0.52 : 1.0,
      });
      if (!isRightLimp) {
        pose.rotations.Left_UpperArm = [-0.38, 0.35, -0.05];
        pose.rotations.Left_Forearm = [-1.45, 0, 0.45];
      } else {
        pose.rotations.Right_UpperArm = [-0.38, -0.35, 0.05];
        pose.rotations.Right_Forearm = [-1.45, 0, -0.45];
      }
      break;
    }

    case 'fatigue_locomotion': {
      const isRun = vKey === 'FAT_RUN';
      const isCrouch = vKey === 'FAT_CRW';
      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: isRun ? 0.55 : 0.35,
        strideRoll: 0.22,
        kneeLift: isRun ? 0.68 : 0.38,
        stanceKneeFlex: 0.24,
        pelvisBounce: 0.028,
        pelvisSway: 0.034,
        pelvisTwist: 0.08,
        torsoForwardLean: isCrouch ? 0.45 : 0.32,
        torsoSideLean: 0.08,
        armSwingPitch: 0.22,
        elbowBaseBend: 0.22,
        elbowSwingAmp: 0.14,
        crouchDrop: isCrouch ? 0.22 : 0.07,
        upperBodyAimLock: 0,
      });
      const heave = Math.sin(u * Math.PI * 2) * 0.08;
      pose.rotations.Chest[0] += heave;
      pose.rotations.Head[0] = 0.28 + heave * 0.5;
      break;
    }

    case 'fatigue_stationary': {
      const breath = Math.sin(u * Math.PI * 2);
      if (vKey === 'FAT_HANDS_KNEES') {
        const pelvisPitch = 0.42;
        const thighPitch = -0.68;
        const kneeFlex = 1.04;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.08, kneeFlex, thighPitch, -0.08, kneeFlex);
        pose.pelvisPos = [0, groundedY, -0.06];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [0.35 + 0.06 * breath, 0, 0];
        pose.rotations.Chest = [0.25 + 0.08 * breath, 0, 0];
        pose.rotations.Head = [-0.35 + 0.06 * breath, 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.08];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.08];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Left_UpperArm = [-0.68, 0.08, -0.06];
        pose.rotations.Right_UpperArm = [-0.68, -0.08, 0.06];
        pose.rotations.Left_Forearm = [-0.32, 0, 0];
        pose.rotations.Right_Forearm = [-0.32, 0, 0];
      } else if (vKey === 'FAT_CATCH_BREATH') {
        // Hands resting on hips while chest expands deeply
        const pelvisPitch = 0.08;
        const thighPitch = -0.16;
        const kneeFlex = 0.30;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.07, kneeFlex, thighPitch, -0.07, kneeFlex);
        pose.pelvisPos = [0, groundedY + 0.012 * breath, 0];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [0.06 + 0.05 * breath, 0, 0];
        pose.rotations.Chest = [-0.06 + 0.09 * breath, 0, 0];
        pose.rotations.Head = [-0.08 + 0.05 * breath, 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.07];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.07];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Left_UpperArm = [0.22, 0.35, -0.48];
        pose.rotations.Right_UpperArm = [0.22, -0.35, 0.48];
        pose.rotations.Left_Forearm = [-1.42, 0, 0.55];
        pose.rotations.Right_Forearm = [-1.42, 0, -0.55];
      } else if (vKey === 'FAT_SIT_DOWN' || vKey === 'FAT_STAND_UP') {
        const sitT = smoothstep(0, 1, vKey === 'FAT_SIT_DOWN' ? u : 1 - u);
        const pelvisPitch = sitT * 0.24;
        const thighPitch = -sitT * 1.32;
        const kneeFlex = 0.06 + sitT * 1.56;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.08, kneeFlex, thighPitch, -0.08, kneeFlex);
        pose.pelvisPos = [0, groundedY, -sitT * 0.10];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [sitT * 0.22, 0, 0];
        pose.rotations.Head = [-sitT * 0.28, 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.08];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.08];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Left_UpperArm = [-0.45 * sitT, 0, -0.10];
        pose.rotations.Right_UpperArm = [-0.45 * sitT, 0, 0.10];
        pose.rotations.Left_Forearm = [-0.65 * sitT - 0.16, 0, 0];
        pose.rotations.Right_Forearm = [-0.65 * sitT - 0.16, 0, 0];
      } else {
        const amp = vKey === 'FAT_IDLE_HEAVY' ? 1.35 : vKey === 'FAT_IDLE_LIGHT' ? 0.6 : 1.0;
        const pelvisPitch = 0.12 * amp;
        const thighPitch = -0.20 * amp;
        const kneeFlex = 0.38 * amp;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.05, kneeFlex, thighPitch, -0.05, kneeFlex);
        pose.pelvisPos = [0, groundedY + 0.012 * breath * amp, 0];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [0.15 * amp + 0.05 * breath * amp, 0, 0];
        pose.rotations.Chest = [0.12 * amp + 0.08 * breath * amp, 0, 0];
        pose.rotations.Head = [0.22 * amp + 0.05 * breath, 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.05];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.05];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
      }
      break;
    }

    case 'state_transition': {
      // Delegate specialized roll/slide/jump transitions directly to their dedicated 8D implementations
      const delegatedMap: Record<string, string> = {
        TR_RUN_JUMP: 'TR_RUN_JUMP_D01',
        TR_LAND_RUN: 'TR_JUMP_RUN_D01',
        TR_SPR_JUMP: 'JUMP_SPRINT',
        TR_JUMP_LAND: 'LAND_MED',
        TR_ROLL_IDLE: 'ROLL_TO_IDLE_D01',
        TR_ROLL_RUN: 'ROLL_TO_RUN_D01',
        TR_RUN_ROLL: 'RUN_TO_ROLL_D01',
        TR_RUN_SLIDE: 'RUN_TO_SLIDE_D01',
        TR_SLIDE_RUN: 'SLIDE_TO_RUN_D01',
        TR_SLIDE_CRW: 'SLIDE_TO_CROUCH_D01',
        TR_DDG_RUN: 'DDG_TO_RUN',
        TR_DDG_IDLE: 'DDG_RECOVER',
      };
      if (delegatedMap[vKey]) {
        const mappedClip = ANIMATION_CLIP_BY_ID[delegatedMap[vKey]];
        if (mappedClip) {
          return evaluateClipPoseAtNormalizedTime(mappedClip, u, rootMotion);
        }
      }

      if (vKey === 'TR_CMB_IDLE' || vKey === 'TR_IDLE_CMB') {
        const cmbT = smoothstep(0, 1, vKey === 'TR_IDLE_CMB' ? u : 1 - u);
        const pelvisPitch = 0.08 * cmbT;
        const leftThigh = -0.26 * cmbT;
        const rightThigh = 0.14 * cmbT;
        const leftKnee = 0.06 + 0.36 * cmbT;
        const rightKnee = 0.06 + 0.30 * cmbT;
        const groundedY = computeGroundedPelvisY(pelvisPitch, leftThigh, 0.08 * cmbT, leftKnee, rightThigh, -0.08 * cmbT, rightKnee);
        pose.pelvisPos = [0, groundedY, 0];
        pose.rotations.Pelvis = [pelvisPitch, -0.32 * cmbT, 0];
        pose.rotations.Spine_01 = [0.10 * cmbT, 0.16 * cmbT, 0];
        pose.rotations.Chest = [0.08 * cmbT, 0.16 * cmbT, 0];
        pose.rotations.Head = [-0.14 * cmbT, 0, 0];
        pose.rotations.Left_Thigh = [leftThigh, 0.18 * cmbT, 0.04 + 0.04 * cmbT];
        pose.rotations.Right_Thigh = [rightThigh, -0.12 * cmbT, -0.04 - 0.06 * cmbT];
        pose.rotations.Left_Calf = [leftKnee, 0, 0];
        pose.rotations.Right_Calf = [rightKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + leftThigh + leftKnee), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + rightThigh + rightKnee), 0, 0];
        pose.rotations.Left_UpperArm = [-0.04 - 0.51 * cmbT, 0.24 * cmbT, -0.06 - 0.10 * cmbT];
        pose.rotations.Right_UpperArm = [-0.04 - 0.44 * cmbT, -0.26 * cmbT, 0.06 + 0.10 * cmbT];
        pose.rotations.Left_Forearm = [-0.16 - 1.54 * cmbT, 0, 0];
        pose.rotations.Right_Forearm = [-0.16 - 1.64 * cmbT, 0, 0];
        break;
      }

      if (vKey === 'TR_CRW_STAND' || vKey === 'TR_STL_IDLE') {
        const maxDrop = vKey === 'TR_STL_IDLE' ? 0.58 : 1.0;
        const t = (1 - smoothstep(0, 1, u)) * maxDrop;
        const dirYaw = Math.atan2(-vx, vz) * 0.25 * t;
        const pelvisPitch = t * 0.24;
        const thighPitch = -t * 0.92;
        const kneeFlex = 0.05 + t * 1.44;
        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          thighPitch,
          0.04 + t * 0.03,
          kneeFlex,
          thighPitch,
          -0.04 - t * 0.03,
          kneeFlex
        );
        pose.pelvisPos = [0, groundedY, -t * 0.05];
        pose.rotations.Pelvis = [pelvisPitch, dirYaw, 0];
        pose.rotations.Spine_01 = [t * 0.18, -dirYaw * 0.4, 0];
        pose.rotations.Chest = [t * 0.12, -dirYaw * 0.3, 0];
        pose.rotations.Head = [-t * 0.36, dirYaw * 0.6, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.04 + t * 0.03];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.04 - t * 0.03];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, -0.03];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0.03];
        pose.rotations.Left_Forearm = [-0.16 - t * 0.72, 0, 0];
        pose.rotations.Right_Forearm = [-0.16 - t * 0.72, 0, 0];
        break;
      }

      if (vKey === 'TR_CRUN_STAND') {
        const crouchDecay = 1 - smoothstep(0.08, 0.92, u);
        const strideDecay = 1 - smoothstep(0.0, 0.72, u);
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.62 * strideDecay,
          strideRoll: 0.34 * strideDecay,
          kneeLift: 0.74 * strideDecay,
          stanceKneeFlex: 0.06 + 0.38 * crouchDecay,
          pelvisBounce: 0.022 * strideDecay,
          pelvisSway: 0.026 * strideDecay,
          pelvisTwist: 0.14 * strideDecay,
          torsoForwardLean: 0.46 * crouchDecay,
          torsoSideLean: 0.07 * strideDecay,
          armSwingPitch: 0.56 * strideDecay,
          elbowBaseBend: 0.16 + 0.92 * crouchDecay,
          elbowSwingAmp: 0.32 * strideDecay,
          crouchDrop: 0.22 * crouchDecay,
          upperBodyAimLock: 0.2 * crouchDecay,
        });
        break;
      }

      // General locomotion-to-locomotion state transitions (Idle/Walk/Run/Sprint/Crouch/Stealth)
      const sT = smoothstep(0, 1, u);
      const getStateSpeedTier = (tok: string) =>
        tok === 'IDLE' ? 0 : tok === 'STL' ? 0.35 : tok === 'CRW' ? 0.42 : tok === 'WLK' ? 0.52 : tok === 'CRUN' ? 0.74 : tok === 'RUN' ? 0.85 : 1.15;
      const parts = vKey.replace(/^TR_/, '').split('_');
      const startTier = getStateSpeedTier(parts[0] ?? 'WLK');
      const endTier = getStateSpeedTier(parts[1] ?? 'RUN');
      const w = THREE.MathUtils.lerp(startTier, endTier, sT);

      const startCrouch = parts[0] === 'CRW' ? 0.24 : parts[0] === 'CRUN' ? 0.22 : parts[0] === 'STL' ? 0.14 : 0.02;
      const endCrouch = parts[1] === 'CRW' ? 0.24 : parts[1] === 'CRUN' ? 0.22 : parts[1] === 'STL' ? 0.14 : 0.02;
      const crouchDrop = THREE.MathUtils.lerp(startCrouch, endCrouch, sT);

      pose = evaluateDirectionalGait(u, dirId, {
        stridePitch: 0.85 * w,
        strideRoll: 0.44 * w,
        kneeLift: 1.15 * w,
        stanceKneeFlex: 0.08 + 0.14 * w + crouchDrop * 1.2,
        pelvisBounce: 0.055 * w * (1 - crouchDrop * 2),
        pelvisSway: 0.024 * Math.min(1, w + 0.2),
        pelvisTwist: 0.18 * w,
        torsoForwardLean: 0.22 * w + crouchDrop * 1.1,
        torsoSideLean: 0.08 * w,
        armSwingPitch: 0.75 * w,
        elbowBaseBend: 0.18 + 0.95 * w + crouchDrop * 1.5,
        elbowSwingAmp: 0.42 * w,
        crouchDrop,
        upperBodyAimLock: 0,
      });
      break;
    }

    case 'human_idle': {
      // All 43 Stationary Human Idles, Behavioral Reactions & Body Adjustments (Part 22)
      const s = Math.sin(u * Math.PI * 2);
      const c = Math.cos(u * Math.PI * 2);
      const k = Math.sin(u * Math.PI); // Smooth 0 -> 1 -> 0 envelope over clip duration
      const s2 = Math.sin(u * Math.PI * 4);

      // Grounded base standing posture with gentle respiratory cycle
      pose.pelvisPos = [0.010 * s, 0.90 + 0.004 * c, 0];
      pose.rotations.Pelvis = [0, 0.025 * s, -0.02 * s];
      pose.rotations.Spine_01 = [0.012 * c, -0.018 * s, 0.018 * s];
      pose.rotations.Chest = [0.022 * s, 0, 0];
      pose.rotations.Head = [-0.018 * s, 0.03 * c, 0];

      switch (vKey) {
        case 'IDL_RELAXED': {
          pose.pelvisPos[0] = 0.028 + 0.008 * s;
          pose.rotations.Pelvis = [-0.03, 0.08, -0.055];
          pose.rotations.Spine_01 = [0.02, -0.04, 0.045];
          pose.rotations.Right_Thigh = [-0.14, -0.08, -0.06];
          pose.rotations.Right_Calf = [0.26, 0, 0];
          pose.rotations.Right_Foot = [-0.12, 0, 0];
          break;
        }
        case 'IDL_BREATHING': {
          pose.rotations.Spine_01[0] = 0.035 * s;
          pose.rotations.Chest[0] = -0.05 * s;
          pose.rotations.Left_Clavicle = [0, 0, 0.04 * s];
          pose.rotations.Right_Clavicle = [0, 0, -0.04 * s];
          pose.rotations.Head[0] = 0.03 * s;
          break;
        }
        case 'IDL_SHIFT_LEFT':
        case 'IDL_WEIGHT_SHIFT': {
          const shift = vKey === 'IDL_SHIFT_LEFT' ? k : s;
          pose.pelvisPos[0] = 0.042 * shift;
          pose.rotations.Pelvis[2] = -0.07 * shift;
          pose.rotations.Spine_01[2] = 0.055 * shift;
          pose.rotations.Right_Thigh[0] = -0.15 * Math.max(0, shift);
          pose.rotations.Right_Calf[0] = 0.28 * Math.max(0, shift);
          pose.rotations.Left_Thigh[0] = -0.15 * Math.max(0, -shift);
          pose.rotations.Left_Calf[0] = 0.28 * Math.max(0, -shift);
          break;
        }
        case 'IDL_SHIFT_RIGHT': {
          pose.pelvisPos[0] = -0.042 * k;
          pose.rotations.Pelvis[2] = 0.07 * k;
          pose.rotations.Spine_01[2] = -0.055 * k;
          pose.rotations.Left_Thigh[0] = -0.15 * k;
          pose.rotations.Left_Calf[0] = 0.28 * k;
          break;
        }
        case 'IDL_POSTURE_CORR':
        case 'ADJ_POSTURE': {
          pose.rotations.Spine_01[0] = -0.08 * k;
          pose.rotations.Chest[0] = -0.12 * k;
          pose.rotations.Left_Clavicle = [-0.08 * k, -0.12 * k, 0.05 * k];
          pose.rotations.Right_Clavicle = [-0.08 * k, 0.12 * k, -0.05 * k];
          pose.rotations.Head[0] = 0.06 * k;
          break;
        }
        case 'IDL_BLINK_NOD': {
          pose.rotations.Neck[0] = 0.10 * s2 * k;
          pose.rotations.Head[0] = 0.16 * s2 * k;
          break;
        }
        case 'IDL_HEAD_MOVE': {
          pose.rotations.Neck = [0.06 * c, 0.18 * s, 0.05 * s];
          pose.rotations.Head = [-0.08 * s, 0.28 * s, 0.06 * c];
          break;
        }
        case 'IDL_LOOK_FWD': {
          pose.rotations.Chest[0] = -0.04 * k;
          pose.rotations.Neck = [-0.04 * k, 0, 0];
          pose.rotations.Head = [-0.04 * k, 0, 0];
          break;
        }
        case 'IDL_LOOK_UP': {
          pose.rotations.Chest[0] = -0.10 * k;
          pose.rotations.Neck = [-0.26 * k, 0, 0];
          pose.rotations.Head = [-0.40 * k, 0, 0];
          break;
        }
        case 'IDL_LOOK_DOWN':
        case 'BHV_LOOK_GROUND': {
          const forwardSpine = vKey === 'BHV_LOOK_GROUND' ? 0.18 * k : 0.06 * k;
          pose.rotations.Spine_01[0] = forwardSpine;
          pose.rotations.Chest[0] = forwardSpine;
          pose.rotations.Neck = [0.26 * k, 0.12 * s * k, 0];
          pose.rotations.Head = [0.38 * k, 0.18 * s * k, 0];
          break;
        }
        case 'IDL_LOOK_LEFT':
        case 'IDL_LOOK_RIGHT':
        case 'IDL_LOOK_SHOULDER':
        case 'BHV_CHECK_SURR': {
          const sign = vKey === 'IDL_LOOK_RIGHT' ? -1 : vKey === 'BHV_CHECK_SURR' ? s : 1;
          const amp = vKey === 'IDL_LOOK_SHOULDER' ? 1.42 : 0.88;
          const turn = (vKey === 'BHV_CHECK_SURR' ? s : k * sign) * amp;
          pose.rotations.Spine_01[1] = 0.12 * turn;
          pose.rotations.Chest[1] = 0.22 * turn;
          pose.rotations.Neck[1] = 0.32 * turn;
          pose.rotations.Head[1] = 0.48 * turn;
          break;
        }
        case 'IDL_RELAX_SHOULDER':
        case 'ADJ_STRETCH_SHLDR': {
          const rollPhase = u * Math.PI * 2;
          pose.rotations.Left_Clavicle = [-0.14 * Math.cos(rollPhase), 0, 0.18 * Math.sin(rollPhase)];
          pose.rotations.Right_Clavicle = [-0.14 * Math.cos(rollPhase), 0, -0.18 * Math.sin(rollPhase)];
          pose.rotations.Left_UpperArm[0] = -0.04 + 0.12 * Math.cos(rollPhase);
          pose.rotations.Right_UpperArm[0] = -0.04 + 0.12 * Math.cos(rollPhase);
          break;
        }
        case 'IDL_RELAX_ARM': {
          pose.rotations.Left_UpperArm = [-0.08 + 0.18 * s2 * k, 0, -0.10 - 0.06 * k];
          pose.rotations.Right_UpperArm = [-0.08 - 0.18 * s2 * k, 0, 0.10 + 0.06 * k];
          pose.rotations.Left_Forearm = [-0.28 + 0.20 * s2 * k, 0, 0];
          pose.rotations.Right_Forearm = [-0.28 - 0.20 * s2 * k, 0, 0];
          break;
        }
        case 'IDL_RELAX_HAND':
        case 'ADJ_FLEX_FINGERS':
        case 'ADJ_OPEN_CLOSE_HAND': {
          pose.rotations.Left_UpperArm = [-0.28 * k, 0.12 * k, -0.08];
          pose.rotations.Right_UpperArm = [-0.28 * k, -0.12 * k, 0.08];
          pose.rotations.Left_Forearm = [-1.05 * k - 0.16, 0.35 * s2 * k, 0];
          pose.rotations.Right_Forearm = [-1.05 * k - 0.16, -0.35 * s2 * k, 0];
          pose.rotations.Left_Hand = [0.22 * s2 * k, 0, 0.15 * c * k];
          pose.rotations.Right_Hand = [-0.22 * s2 * k, 0, -0.15 * c * k];
          pose.rotations.Left_Fingers = [0.45 * (0.5 + 0.5 * s2) * k, 0, 0.45 * s2 * k];
          pose.rotations.Right_Fingers = [0.45 * (0.5 + 0.5 * s2) * k, 0, -0.45 * s2 * k];
          break;
        }
        case 'IDL_NECK_STRETCH':
        case 'ADJ_STRETCH_NECK': {
          pose.rotations.Neck = [0.05 * k, 0.10 * s, 0.26 * s];
          pose.rotations.Head = [0.05 * k, 0.12 * s, 0.34 * s];
          break;
        }
        case 'BHV_THINKING': {
          pose.rotations.Head = [0.14 * k, -0.14 * k, 0.08 * k];
          pose.rotations.Left_UpperArm = [-0.18 * k, 0.25 * k, -0.06];
          pose.rotations.Left_Forearm = [-1.35 * k - 0.16, 0, 0.45 * k];
          pose.rotations.Right_UpperArm = [-0.68 * k, -0.26 * k, 0.08];
          pose.rotations.Right_Forearm = [-1.98 * k - 0.16, 0, -0.25 * k];
          break;
        }
        case 'BHV_CONFUSED': {
          pose.rotations.Head = [-0.06 * k, 0.15 * s * k, 0.26 * k];
          pose.rotations.Left_Clavicle = [0, 0, 0.14 * k];
          pose.rotations.Right_Clavicle = [0, 0, -0.14 * k];
          pose.rotations.Left_UpperArm = [-0.24 * k, 0.25 * k, -0.28 * k - 0.06];
          pose.rotations.Right_UpperArm = [-0.24 * k, -0.25 * k, 0.28 * k + 0.06];
          pose.rotations.Left_Forearm = [-1.25 * k - 0.16, -0.45 * k, 0];
          pose.rotations.Right_Forearm = [-1.25 * k - 0.16, 0.45 * k, 0];
          break;
        }
        case 'BHV_CURIOUS': {
          pose.rotations.Spine_01 = [0.16 * k, 0, 0];
          pose.rotations.Chest = [0.14 * k, 0, 0];
          pose.rotations.Neck = [-0.18 * k, 0.12 * k, 0.14 * k];
          pose.rotations.Head = [-0.22 * k, 0.16 * k, 0.18 * k];
          pose.rotations.Left_UpperArm = [0.18 * k, 0, -0.10];
          pose.rotations.Right_UpperArm = [0.18 * k, 0, 0.10];
          break;
        }
        case 'BHV_SURPRISE': {
          const jolt = Math.sin(Math.pow(u, 0.6) * Math.PI);
          pose.pelvisPos[2] = -0.05 * jolt;
          pose.rotations.Spine_01 = [-0.16 * jolt, 0, 0];
          pose.rotations.Chest = [-0.18 * jolt, 0, 0];
          pose.rotations.Head = [-0.12 * jolt, 0, 0];
          pose.rotations.Left_UpperArm = [-0.72 * jolt, 0.28 * jolt, -0.25 * jolt - 0.06];
          pose.rotations.Right_UpperArm = [-0.72 * jolt, -0.28 * jolt, 0.25 * jolt + 0.06];
          pose.rotations.Left_Forearm = [-1.65 * jolt - 0.16, 0, 0];
          pose.rotations.Right_Forearm = [-1.65 * jolt - 0.16, 0, 0];
          break;
        }
        case 'BHV_FRUSTRATION': {
          const inhale = Math.max(0, Math.sin(u * Math.PI * 2));
          const exhale = Math.max(0, -Math.sin(u * Math.PI * 2));
          pose.rotations.Chest[0] = -0.12 * inhale + 0.22 * exhale;
          pose.rotations.Head = [0.24 * exhale, 0.25 * s2 * exhale, 0];
          pose.rotations.Left_Clavicle = [0, 0, 0.12 * inhale - 0.10 * exhale];
          pose.rotations.Right_Clavicle = [0, 0, -0.12 * inhale + 0.10 * exhale];
          pose.rotations.Left_UpperArm = [-0.35 * inhale, 0, -0.18 * inhale - 0.06];
          pose.rotations.Right_UpperArm = [-0.35 * inhale, 0, 0.18 * inhale + 0.06];
          pose.rotations.Left_Forearm = [-0.85 * inhale - 0.16, 0, 0];
          pose.rotations.Right_Forearm = [-0.85 * inhale - 0.16, 0, 0];
          break;
        }
        case 'BHV_HAPPY': {
          pose.pelvisPos[1] = 0.90 + 0.018 * Math.abs(s2);
          pose.rotations.Chest = [-0.12 * k, 0.08 * s, 0];
          pose.rotations.Head = [-0.10 * k + 0.08 * s2, 0.12 * s, 0.08 * s];
          pose.rotations.Left_UpperArm = [-0.65 * k, 0.15 * k, -0.32 * k - 0.06];
          pose.rotations.Right_UpperArm = [-0.65 * k, -0.15 * k, 0.32 * k + 0.06];
          pose.rotations.Left_Forearm = [-1.25 * k - 0.16, 0, 0];
          pose.rotations.Right_Forearm = [-1.25 * k - 0.16, 0, 0];
          break;
        }
        case 'BHV_SAD': {
          pose.rotations.Spine_01 = [0.16 * k, 0, 0];
          pose.rotations.Chest = [0.18 * k, 0, 0];
          pose.rotations.Neck = [0.24 * k, 0, 0];
          pose.rotations.Head = [0.32 * k, 0.08 * s * k, 0];
          pose.rotations.Left_UpperArm = [-0.28 * k, 0.38 * k, -0.04];
          pose.rotations.Right_UpperArm = [-0.28 * k, -0.38 * k, 0.04];
          pose.rotations.Left_Forearm = [-1.42 * k - 0.16, 0, 0.38 * k];
          pose.rotations.Right_Forearm = [-1.42 * k - 0.16, 0, -0.38 * k];
          break;
        }
        case 'BHV_NERVOUS': {
          pose.pelvisPos[0] = 0.025 * s2;
          pose.rotations.Pelvis[2] = -0.04 * s2;
          pose.rotations.Head = [0.06, 0.38 * s2, 0];
          pose.rotations.Left_UpperArm = [-0.36, 0.32, -0.06];
          pose.rotations.Right_UpperArm = [-0.36, -0.32, 0.06];
          pose.rotations.Left_Forearm = [-1.48, 0, 0.28 + 0.08 * s2];
          pose.rotations.Right_Forearm = [-1.48, 0, -0.28 - 0.08 * s2];
          break;
        }
        case 'BHV_RELIEVED': {
          pose.rotations.Spine_01[0] = 0.12 * k;
          pose.rotations.Chest[0] = -0.10 * Math.sin(u * Math.PI * 2) + 0.08 * k;
          pose.rotations.Head[0] = 0.16 * k;
          pose.rotations.Right_UpperArm = [-0.52 * k, -0.42 * k, 0.06];
          pose.rotations.Right_Forearm = [-1.68 * k - 0.16, 0, -0.35 * k];
          break;
        }
        case 'BHV_LISTENING': {
          pose.rotations.Spine_01 = [0.06 * k, 0.10 * k, 0];
          pose.rotations.Chest = [0.06 * k, 0.14 * k, 0];
          pose.rotations.Neck = [0, 0.26 * k, -0.12 * k];
          pose.rotations.Head = [-0.04 * k, 0.36 * k, -0.14 * k];
          pose.rotations.Right_UpperArm = [-0.58 * k, -0.18 * k, 0.16 * k + 0.06];
          pose.rotations.Right_Forearm = [-1.85 * k - 0.16, 0, 0];
          break;
        }
        case 'BHV_WAITING': {
          pose.rotations.Left_UpperArm = [-0.24, 0.32, -0.06];
          pose.rotations.Right_UpperArm = [-0.24, -0.32, 0.06];
          pose.rotations.Left_Forearm = [-1.18, 0, 0.38];
          pose.rotations.Right_Forearm = [-1.18, 0, -0.38];
          break;
        }
        case 'BHV_IMPATIENT': {
          const tap = Math.max(0, Math.sin(u * Math.PI * 6));
          pose.rotations.Pelvis = [0, -0.12, -0.04];
          pose.rotations.Right_Thigh = [-0.14, -0.08, -0.08];
          pose.rotations.Right_Calf = [0.24, 0, 0];
          pose.rotations.Right_Foot = [-0.10 - 0.28 * tap, 0, 0];
          pose.rotations.Left_UpperArm = [0.18, 0.32, -0.45];
          pose.rotations.Right_UpperArm = [0.18, -0.32, 0.45];
          pose.rotations.Left_Forearm = [-1.38, 0, 0.52];
          pose.rotations.Right_Forearm = [-1.38, 0, -0.52];
          break;
        }
        case 'ADJ_STRETCH_ARMS': {
          pose.rotations.Chest[0] = -0.14 * k;
          pose.rotations.Left_UpperArm = [-2.55 * k - 0.05, 0, -0.18 * k - 0.06];
          pose.rotations.Right_UpperArm = [-2.55 * k - 0.05, 0, 0.18 * k + 0.06];
          pose.rotations.Left_Forearm = [-0.25 * k - 0.15, 0, 0];
          pose.rotations.Right_Forearm = [-0.25 * k - 0.15, 0, 0];
          break;
        }
        case 'ADJ_STRETCH_BACK': {
          pose.rotations.Pelvis[0] = -0.08 * k;
          pose.rotations.Spine_01[0] = -0.18 * k;
          pose.rotations.Chest[0] = -0.22 * k;
          pose.rotations.Head[0] = -0.18 * k;
          pose.rotations.Left_UpperArm = [0.35 * k, -0.25 * k, -0.35 * k - 0.06];
          pose.rotations.Right_UpperArm = [0.35 * k, 0.25 * k, 0.35 * k + 0.06];
          pose.rotations.Left_Forearm = [-1.35 * k - 0.16, 0, 0];
          pose.rotations.Right_Forearm = [-1.35 * k - 0.16, 0, 0];
          break;
        }
        case 'ADJ_STRETCH_LEGS': {
          const pelvisPitch = 0.14 * k;
          const thighPitch = -0.52 * k;
          const kneeFlex = 0.96 * k + 0.06;
          const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.08, kneeFlex, thighPitch, -0.08, kneeFlex);
          pose.pelvisPos[1] = groundedY;
          pose.rotations.Pelvis[0] = pelvisPitch;
          pose.rotations.Spine_01[0] = 0.12 * k;
          pose.rotations.Head[0] = -0.22 * k;
          pose.rotations.Left_Thigh = [thighPitch, 0, 0.08];
          pose.rotations.Right_Thigh = [thighPitch, 0, -0.08];
          pose.rotations.Left_Calf = [kneeFlex, 0, 0];
          pose.rotations.Right_Calf = [kneeFlex, 0, 0];
          pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
          pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
          pose.rotations.Left_UpperArm = [-0.45 * k, 0, -0.10];
          pose.rotations.Right_UpperArm = [-0.45 * k, 0, 0.10];
          pose.rotations.Left_Forearm = [-0.45 * k - 0.16, 0, 0];
          pose.rotations.Right_Forearm = [-0.45 * k - 0.16, 0, 0];
          break;
        }
        case 'ADJ_CLOTHING': {
          pose.rotations.Head = [0.18 * k, -0.12 * s * k, 0];
          pose.rotations.Left_UpperArm = [-0.35 * k, 0.32 * k, -0.18 * k - 0.06];
          pose.rotations.Right_UpperArm = [-0.35 * k, -0.32 * k, 0.18 * k + 0.06];
          pose.rotations.Left_Forearm = [-1.45 * k - 0.16, 0, 0.25 * s2 * k];
          pose.rotations.Right_Forearm = [-1.45 * k - 0.16, 0, -0.25 * s2 * k];
          break;
        }
        case 'ADJ_BRUSH_HAIR': {
          pose.rotations.Head = [-0.08 * k, -0.15 * k, -0.10 * k];
          pose.rotations.Left_UpperArm = [-1.55 * k - 0.05, 0.25 * k, -0.35 * k - 0.06];
          pose.rotations.Left_Forearm = [-1.95 * k - 0.16, 0, 0.25 * k];
          break;
        }
        default:
          break;
      }
      break;
    }

    case 'interaction_action': {
      const k = Math.sin(u * Math.PI);
      if (vKey === 'INT_APPR' || vKey === 'INT_WLK_TO' || vKey === 'INT_STOP_AT') {
        const w = vKey === 'INT_WLK_TO' ? 1.0 : 1 - smoothstep(0.15, 0.95, u);
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.42 * w,
          strideRoll: 0.26 * w,
          kneeLift: 0.52 * w,
          stanceKneeFlex: 0.08,
          pelvisBounce: 0.024 * w,
          pelvisSway: 0.020 * w,
          pelvisTwist: 0.10 * w,
          torsoForwardLean: 0.08,
          torsoSideLean: 0.04 * w,
          armSwingPitch: 0.28 * w,
          elbowBaseBend: 0.28,
          elbowSwingAmp: 0.18 * w,
          crouchDrop: 0,
          upperBodyAimLock: 0.6,
        });
        break;
      }

      if (vKey === 'INT_CARRY_HOLD' || vKey === 'INT_DROP') {
        const s = Math.sin(u * Math.PI * 2);
        const c = Math.cos(u * Math.PI * 2);
        const holdFactor = vKey === 'INT_DROP' ? 1 - smoothstep(0.25, 0.85, u) : 1.0;
        const dropLook = vKey === 'INT_DROP' ? Math.sin(u * Math.PI) : 0;
        pose.pelvisPos = [0.012 * s * holdFactor, 0.89 + 0.008 * c * holdFactor, -0.04 * dropLook];
        pose.rotations.Pelvis = [-0.04 * holdFactor, 0.03 * s * holdFactor, -0.025 * s * holdFactor];
        pose.rotations.Spine_01 = [0.08 * dropLook - 0.04 * holdFactor, 0, 0.02 * s * holdFactor];
        pose.rotations.Chest = [0.035 * s * holdFactor, 0, 0];
        pose.rotations.Head = [0.28 * dropLook + 0.02 * c * holdFactor, 0.04 * s * holdFactor, 0];
        pose.rotations.Left_Thigh = [-0.10, 0, 0.05];
        pose.rotations.Right_Thigh = [-0.10, 0, -0.05];
        pose.rotations.Left_Calf = [0.20, 0, 0];
        pose.rotations.Right_Calf = [0.20, 0, 0];
        pose.rotations.Left_Foot = [-0.10, 0, 0];
        pose.rotations.Right_Foot = [-0.10, 0, 0];
        pose.rotations.Left_UpperArm = [(-0.42 - 0.03 * s) * holdFactor - 0.15 * dropLook, 0.22 * holdFactor, -0.08 - 0.12 * dropLook];
        pose.rotations.Right_UpperArm = [(-0.42 - 0.03 * s) * holdFactor - 0.15 * dropLook, -0.22 * holdFactor, 0.08 + 0.12 * dropLook];
        pose.rotations.Left_Forearm = [(-1.45 - 0.04 * c) * holdFactor - 0.16, 0.22 * holdFactor, 0];
        pose.rotations.Right_Forearm = [(-1.45 - 0.04 * c) * holdFactor - 0.16, -0.22 * holdFactor, 0];
        break;
      }

      const isPickupOrBend =
        vKey.includes('PICKUP') || vKey === 'INT_BEND_DOWN' || vKey === 'INT_KNEEL' || vKey.includes('PLACE');
      if (isPickupOrBend) {
        const pelvisPitch = 0.34 * k;
        const leftThigh = -1.08 * k;
        const rightThigh = -(vKey === 'INT_KNEEL' ? 0.32 : 1.08) * k;
        const leftKnee = 1.52 * k + 0.06;
        const rightKnee = 1.58 * k + 0.06;
        const groundedY = computeGroundedPelvisY(pelvisPitch, leftThigh, 0.08, leftKnee, leftThigh, -0.08, leftKnee);
        pose.pelvisPos = [0, groundedY, -0.05 * k];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [0.30 * k, 0, 0];
        pose.rotations.Chest = [0.20 * k, 0, 0];
        pose.rotations.Head = [-0.42 * k, 0, 0];
        pose.rotations.Left_Thigh = [leftThigh, 0, 0.08];
        pose.rotations.Right_Thigh = [rightThigh, 0, -0.08];
        pose.rotations.Left_Calf = [leftKnee, 0, 0];
        pose.rotations.Right_Calf = [rightKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + leftThigh + leftKnee), 0, 0];
        pose.rotations.Right_Foot = [vKey === 'INT_KNEEL' ? 0.32 * k : -(pelvisPitch + rightThigh + rightKnee), 0, 0];
        if (meta.handSide !== 'right') {
          pose.rotations.Left_UpperArm = [-0.92 * k, 0.12 * k, -0.06];
          pose.rotations.Left_Forearm = [-0.28 * k - 0.12, 0, 0];
        }
        if (meta.handSide !== 'left') {
          pose.rotations.Right_UpperArm = [-0.92 * k, -0.12 * k, 0.06];
          pose.rotations.Right_Forearm = [-0.28 * k - 0.12, 0, 0];
        }
      } else if (vKey === 'INT_PUSH' || vKey === 'INT_PULL') {
        const isPull = vKey === 'INT_PULL';
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: 0.38,
          strideRoll: 0.22,
          kneeLift: 0.45,
          stanceKneeFlex: 0.25,
          pelvisBounce: 0.018,
          pelvisSway: 0.020,
          pelvisTwist: 0.06,
          torsoForwardLean: isPull ? -0.18 : 0.38,
          torsoSideLean: 0.04,
          armSwingPitch: 0.06,
          elbowBaseBend: isPull ? 1.15 : 0.45,
          elbowSwingAmp: 0.08,
          crouchDrop: 0.12,
          upperBodyAimLock: 0.9,
        });
        pose.rotations.Left_UpperArm = [-1.15, 0.12, -0.08];
        pose.rotations.Right_UpperArm = [-1.15, -0.12, 0.08];
      } else {
        // Directional Reach / Door Open-Close / Activate Panel
        const sideDir = vKey === 'INT_REACH_SIDE_L' ? 1 : vKey === 'INT_REACH_SIDE_R' ? -1 : vx;
        const doorPull = vKey === 'INT_DOOR_OPEN_L' || vKey === 'INT_DOOR_CLOSE' ? Math.sin(u * Math.PI * 2) * 0.25 : 0;
        pose.pelvisPos = [sideDir * 0.08 * k, 0.88 - 0.03 * k, vz * 0.08 * k];
        pose.rotations.Spine_01 = [0.14 * k - doorPull * 0.4, -sideDir * 0.25 * k, 0];
        pose.rotations.Chest = [0.12 * k - doorPull * 0.4, -sideDir * 0.25 * k, 0];
        if (meta.handSide !== 'left') {
          pose.rotations.Right_UpperArm = [-1.35 * k + doorPull - 0.05, -sideDir * 0.35 * k, 0.12 + Math.max(0, -sideDir) * 0.55 * k];
          pose.rotations.Right_Forearm = [-0.35 * k - Math.abs(doorPull) - 0.15, 0, 0];
        }
        if (meta.handSide === 'left' || meta.handSide === 'both') {
          pose.rotations.Left_UpperArm = [-1.35 * k + doorPull - 0.05, -sideDir * 0.35 * k, -0.12 - Math.max(0, sideDir) * 0.55 * k];
          pose.rotations.Left_Forearm = [-0.35 * k - Math.abs(doorPull) - 0.15, 0, 0];
        }
      }
      break;
    }

    case 'carry_locomotion':
    case 'carry_stationary': {
      const isHeavy = meta.intensity === 'heavy' || vKey === 'CRY_HEAVY' || vKey === 'CRY_PICKUP_HEAVY';
      const isCrouch = vKey === 'CRY_CRW';

      if (vKey === 'CRY_PICKUP_HEAVY' || vKey === 'CRY_PUTDOWN') {
        // Deep squat hoist from floor to waist carry (or reverse for putdown)
        const liftT = smoothstep(0, 1, vKey === 'CRY_PICKUP_HEAVY' ? u : 1 - u);
        const squat = Math.sin(Math.pow(1 - liftT, 0.8) * Math.PI * 0.85);
        const pelvisPitch = 0.36 * squat - 0.08 * liftT;
        const thighPitch = -1.18 * squat - 0.14 * liftT;
        const kneeFlex = 1.62 * squat + 0.24 * liftT + 0.06;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.10, kneeFlex, thighPitch, -0.10, kneeFlex);
        pose.pelvisPos = [0, groundedY, -0.06 * squat];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [0.28 * squat - 0.08 * liftT, 0, 0];
        pose.rotations.Chest = [0.18 * squat - 0.06 * liftT, 0, 0];
        pose.rotations.Head = [-0.38 * squat, 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.10];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.10];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Left_UpperArm = [-0.95 * squat - 0.42 * liftT, 0.22, -0.08];
        pose.rotations.Right_UpperArm = [-0.95 * squat - 0.42 * liftT, -0.22, 0.08];
        pose.rotations.Left_Forearm = [-0.35 * squat - 1.48 * liftT, 0.22 * liftT, 0.20 * liftT];
        pose.rotations.Right_Forearm = [-0.35 * squat - 1.48 * liftT, -0.22 * liftT, -0.20 * liftT];
        break;
      }

      if (vKey === 'CRY_ADJUST_GRIP') {
        const hitch = Math.sin(u * Math.PI);
        const pelvisPitch = -0.08 * hitch;
        const thighPitch = -0.24 * hitch;
        const kneeFlex = 0.44 * hitch + 0.12;
        const groundedY = computeGroundedPelvisY(pelvisPitch, thighPitch, 0.06, kneeFlex, thighPitch, -0.06, kneeFlex);
        pose.pelvisPos = [0, groundedY + 0.03 * hitch, 0];
        pose.rotations.Pelvis = [pelvisPitch, 0, 0];
        pose.rotations.Spine_01 = [-0.10 * hitch, 0, 0];
        pose.rotations.Left_Thigh = [thighPitch, 0, 0.06];
        pose.rotations.Right_Thigh = [thighPitch, 0, -0.06];
        pose.rotations.Left_Calf = [kneeFlex, 0, 0];
        pose.rotations.Right_Calf = [kneeFlex, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + thighPitch + kneeFlex), 0, 0];
        pose.rotations.Left_UpperArm = [-0.42 - 0.22 * hitch, 0.24, -0.08];
        pose.rotations.Right_UpperArm = [-0.42 - 0.22 * hitch, -0.24, 0.08];
        pose.rotations.Left_Forearm = [-1.48 - 0.28 * hitch, 0.25, 0.22];
        pose.rotations.Right_Forearm = [-1.48 - 0.28 * hitch, -0.25, -0.22];
        break;
      }

      if (meta.loop && vKey !== 'CRY_TWO_HAND') {
        pose = evaluateDirectionalGait(u, dirId, {
          stridePitch: isHeavy ? 0.34 : 0.44,
          strideRoll: 0.24,
          kneeLift: isHeavy ? 0.42 : 0.56,
          stanceKneeFlex: isHeavy ? 0.26 : 0.14,
          pelvisBounce: 0.020,
          pelvisSway: 0.024,
          pelvisTwist: 0.06,
          torsoForwardLean: isHeavy ? -0.12 : isCrouch ? 0.32 : 0.04,
          torsoSideLean: meta.handSide === 'left' ? -0.08 : meta.handSide === 'right' ? 0.08 : 0.05,
          armSwingPitch: 0.22,
          elbowBaseBend: 0.28,
          elbowSwingAmp: 0.16,
          crouchDrop: isCrouch ? 0.22 : isHeavy ? 0.10 : 0.03,
          upperBodyAimLock: 0.9,
        });
      } else {
        const s = Math.sin(u * Math.PI * 2);
        pose.pelvisPos = [0.008 * s, 0.88 + 0.006 * Math.cos(u * Math.PI * 2), 0];
        pose.rotations.Spine_01 = [-0.06, 0, 0];
        pose.rotations.Chest = [0.025 * s, 0, 0];
        pose.rotations.Left_Thigh = [-0.10, 0, 0.05];
        pose.rotations.Right_Thigh = [-0.10, 0, -0.05];
        pose.rotations.Left_Calf = [0.20, 0, 0];
        pose.rotations.Right_Calf = [0.20, 0, 0];
        pose.rotations.Left_Foot = [-0.10, 0, 0];
        pose.rotations.Right_Foot = [-0.10, 0, 0];
      }
      // Position active carrying hand(s) in secure load cradle
      if (meta.handSide !== 'right') {
        pose.rotations.Left_UpperArm = [-0.42, 0.24, -0.08];
        pose.rotations.Left_Forearm = [-1.48, 0.25, 0.22];
      }
      if (meta.handSide !== 'left') {
        pose.rotations.Right_UpperArm = [-0.42, -0.24, 0.08];
        pose.rotations.Right_Forearm = [-1.48, -0.25, -0.22];
      }
      break;
    }

    case 'climb_traversal': {
      const isDescend = vKey === 'TRV_LADDER_DOWN' || vKey === 'TRV_ROPE_DOWN';
      const phase = (isDescend ? 1 - u : u) * Math.PI * 2;
      const sinP = Math.sin(phase);

      if (vKey.includes('LADDER') || vKey.includes('ROPE')) {
        const isRope = vKey.includes('ROPE');
        const dirSign = isDescend ? -1 : 1;
        pose.pelvisPos = [
          0,
          0.90 + (rootMotion ? (u - 0.5) * 0.55 * dirSign : 0.04 * Math.sin(phase * 2)),
          0,
        ];
        pose.rotations.Spine_01 = [-0.08, 0.06 * sinP, 0];
        pose.rotations.Head = [isDescend ? 0.26 : -0.35, 0, 0];
        const leftReach = sinP;
        const rightReach = -sinP;
        const armInwardYaw = isRope ? 0.34 : 0.14;
        pose.rotations.Left_UpperArm = [-2.05 - 0.45 * leftReach, armInwardYaw, isRope ? 0.06 : -0.10];
        pose.rotations.Right_UpperArm = [-2.05 - 0.45 * rightReach, -armInwardYaw, isRope ? -0.06 : 0.10];
        pose.rotations.Left_Forearm = [-0.65 + 0.35 * leftReach, 0, 0];
        pose.rotations.Right_Forearm = [-0.65 + 0.35 * rightReach, 0, 0];
        pose.rotations.Left_Thigh = [-0.68 - 0.45 * rightReach, 0, isRope ? -0.06 : 0.08];
        pose.rotations.Right_Thigh = [-0.68 - 0.45 * leftReach, 0, isRope ? 0.06 : -0.08];
        pose.rotations.Left_Calf = [0.98 + 0.45 * rightReach, 0, 0];
        pose.rotations.Right_Calf = [0.98 + 0.45 * leftReach, 0, 0];
      } else if (vKey === 'TRV_HANG_IDLE') {
        pose.pelvisPos = [0, 0.96 + 0.015 * sinP, 0];
        pose.rotations.Left_UpperArm = [-2.85, 0.08, -0.12];
        pose.rotations.Right_UpperArm = [-2.85, -0.08, 0.12];
        pose.rotations.Left_Forearm = [-0.15, 0, 0];
        pose.rotations.Right_Forearm = [-0.15, 0, 0];
        pose.rotations.Left_Thigh = [-0.12 * sinP, 0, 0.04];
        pose.rotations.Right_Thigh = [0.12 * sinP, 0, -0.04];
        pose.rotations.Left_Calf = [0.35, 0, 0];
        pose.rotations.Right_Calf = [0.42, 0, 0];
      } else if (vKey === 'TRV_VAULT_LOW') {
        // One-hand athletic low vault: plant left palm on barrier while swinging both legs laterally to the right
        const arc = Math.sin(u * Math.PI);
        pose.pelvisPos = [-0.18 * arc, 0.90 + 0.36 * arc, (u - 0.5) * 0.42];
        pose.rotations.Pelvis = [0.28 * arc, -0.22 * arc, 0.52 * arc];
        pose.rotations.Spine_01 = [0.22 * arc, 0.15 * arc, -0.24 * arc];
        pose.rotations.Head = [-0.32 * arc, 0, 0];
        pose.rotations.Left_Thigh = [-1.18 * arc, 0, -0.35 * arc];
        pose.rotations.Right_Thigh = [-1.05 * arc, 0, -0.45 * arc];
        pose.rotations.Left_Calf = [1.38 * arc + 0.08, 0, 0];
        pose.rotations.Right_Calf = [1.28 * arc + 0.08, 0, 0];
        pose.rotations.Left_UpperArm = [-0.35 * arc, 0, -0.38 * arc - 0.10];
        pose.rotations.Left_Forearm = [-0.18, 0, 0];
        pose.rotations.Right_UpperArm = [-1.15 * arc, 0, 0.42 * arc + 0.10];
        pose.rotations.Right_Forearm = [-0.85 * arc - 0.20, 0, 0];
      } else if (vKey === 'TRV_CLIMB_UP_PLAT' || vKey === 'TRV_CLIMB_DOWN_PLAT') {
        const climbU = vKey === 'TRV_CLIMB_DOWN_PLAT' ? 1 - u : u;
        const mantle = Math.sin(climbU * Math.PI);
        const rise = smoothstep(0.15, 0.88, climbU);
        const leadStep = Math.sin(Math.min(1, climbU * 1.4) * Math.PI);
        const trailStep = Math.sin(Math.max(0, (climbU - 0.28) * 1.4) * Math.PI);
        pose.pelvisPos = [0, 0.86 + rise * 0.48 - 0.12 * mantle, (climbU - 0.5) * 0.36];
        pose.rotations.Pelvis = [0.34 * mantle, 0, 0];
        pose.rotations.Spine_01 = [0.26 * mantle, 0, 0];
        pose.rotations.Head = [-0.42 * mantle, 0, 0];
        pose.rotations.Left_Thigh = [-1.38 * leadStep, 0, 0.08];
        pose.rotations.Left_Calf = [1.52 * leadStep + 0.08, 0, 0];
        pose.rotations.Right_Thigh = [-1.25 * trailStep, 0, -0.08];
        pose.rotations.Right_Calf = [1.45 * trailStep + 0.08, 0, 0];
        pose.rotations.Left_UpperArm = [-1.25 * mantle, 0.15 * mantle, -0.14];
        pose.rotations.Right_UpperArm = [-1.25 * mantle, -0.15 * mantle, 0.14];
        pose.rotations.Left_Forearm = [-0.95 * mantle - 0.16, 0, 0];
        pose.rotations.Right_Forearm = [-0.95 * mantle - 0.16, 0, 0];
      } else {
        // Sequential high-knee step-over / obstacle traversal (lead leg clears in [0..0.55], trail leg clears in [0.35..0.95])
        const leadArc = Math.sin(Math.min(1, u * 1.45) * Math.PI);
        const trailArc = Math.sin(Math.max(0, (u - 0.30) * 1.45) * Math.PI);
        const env = Math.sin(u * Math.PI);
        const sideSign = vKey === 'TRV_OBST_SIDE_L' ? 1 : vKey === 'TRV_OBST_SIDE_R' ? -1 : vx;
        const pelvisPitch = 0.22 * env;
        const leftThigh = -1.22 * leadArc;
        const rightThigh = -1.18 * trailArc;
        const leftKnee = 1.44 * leadArc + 0.08;
        const rightKnee = 1.40 * trailArc + 0.08;
        const leftRoll = 0.08 + Math.max(0, sideSign) * 0.32 * leadArc;
        const rightRoll = -0.08 + Math.min(0, sideSign) * 0.32 * trailArc;

        const groundedY = computeGroundedPelvisY(
          pelvisPitch,
          leftThigh,
          leftRoll,
          leftKnee,
          rightThigh,
          rightRoll,
          rightKnee,
          leadArc * 0.24,
          trailArc * 0.24
        );
        pose.pelvisPos = [sideSign * env * 0.14, groundedY, vz * env * 0.18];
        pose.rotations.Pelvis = [pelvisPitch, 0, -sideSign * 0.14 * env];
        pose.rotations.Spine_01 = [0.18 * env, 0, 0];
        pose.rotations.Head = [-0.28 * env, 0, 0];
        pose.rotations.Left_Thigh = [leftThigh, 0, leftRoll];
        pose.rotations.Right_Thigh = [rightThigh, 0, rightRoll];
        pose.rotations.Left_Calf = [leftKnee, 0, 0];
        pose.rotations.Right_Calf = [rightKnee, 0, 0];
        pose.rotations.Left_Foot = [-(pelvisPitch + leftThigh + leftKnee) * (1 - leadArc * 0.5), 0, 0];
        pose.rotations.Right_Foot = [-(pelvisPitch + rightThigh + rightKnee) * (1 - trailArc * 0.5), 0, 0];
        pose.rotations.Left_UpperArm = [-0.65 * trailArc - 0.15, 0, -0.22];
        pose.rotations.Right_UpperArm = [-0.65 * leadArc - 0.15, 0, 0.22];
        pose.rotations.Left_Forearm = [-0.75 * env - 0.20, 0, 0];
        pose.rotations.Right_Forearm = [-0.75 * env - 0.20, 0, 0];
      }
      break;
    }
  }

  // Root-Motion vs In-Place displacement along movement vector
  if (rootMotion && meta.speedMetersPerSec > 0) {
    const dist = (u - 0.5) * meta.speedMetersPerSec * meta.duration;
    pose.rootPos = [vx * dist, 0, vz * dist];
  } else {
    pose.rootPos = [0, 0, 0];
  }

  return pose;
}

const CLIP_CACHE = new Map<string, THREE.AnimationClip>();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _rollAxis = new THREE.Vector3();
const _rollQuat = new THREE.Quaternion();
const _baseEuler = new THREE.Euler();
const _baseQuat = new THREE.Quaternion();
const _rollEuler = new THREE.Euler();

/**
 * Generates (and caches) a Three.js AnimationClip for the given clip ID and rootMotion mode.
 */
export function getOrCreateAnimationClip(
  clipId: string,
  rootMotion = false,
  sampleFrames = 24
): THREE.AnimationClip {
  const cacheKey = `${clipId}__rm_${rootMotion ? 1 : 0}`;
  const existing = CLIP_CACHE.get(cacheKey);
  if (existing) return existing;

  const meta = ANIMATION_CLIP_BY_ID[clipId];
  if (!meta) {
    throw new Error(`Unknown animation clip ID: ${clipId}`);
  }

  const times = new Float32Array(sampleFrames + 1);
  for (let i = 0; i <= sampleFrames; i++) {
    times[i] = (i / sampleFrames) * meta.duration;
  }

  const rootPositions = new Float32Array((sampleFrames + 1) * 3);
  const pelvisPositions = new Float32Array((sampleFrames + 1) * 3);

  const boneQuaternions: Record<BoneName, Float32Array> = {} as Record<BoneName, Float32Array>;
  for (const def of BONE_DEFINITIONS) {
    boneQuaternions[def.name] = new Float32Array((sampleFrames + 1) * 4);
  }

  for (let i = 0; i <= sampleFrames; i++) {
    // Seamless loop closure: frame sampleFrames matches frame 0 when meta.loop is true
    const u = meta.loop && i === sampleFrames ? 0 : i / sampleFrames;
    const pose = evaluateClipPoseAtNormalizedTime(meta, u, rootMotion);

    rootPositions[i * 3 + 0] = pose.rootPos[0];
    rootPositions[i * 3 + 1] = pose.rootPos[1];
    rootPositions[i * 3 + 2] = pose.rootPos[2];

    pelvisPositions[i * 3 + 0] = pose.pelvisPos[0];
    pelvisPositions[i * 3 + 1] = pose.pelvisPos[1];
    pelvisPositions[i * 3 + 2] = pose.pelvisPos[2];

    for (const def of BONE_DEFINITIONS) {
      const [rx, ry, rz] = pose.rotations[def.name];
      _euler.set(rx, ry, rz, 'XYZ');
      _quat.setFromEuler(_euler);
      const qArr = boneQuaternions[def.name];
      // Enforce shortest-path quaternion hemisphere continuity across full 360° rolls
      if (i > 0) {
        const prevIdx = (i - 1) * 4;
        const dot =
          qArr[prevIdx + 0] * _quat.x +
          qArr[prevIdx + 1] * _quat.y +
          qArr[prevIdx + 2] * _quat.z +
          qArr[prevIdx + 3] * _quat.w;
        if (dot < 0) {
          _quat.x = -_quat.x;
          _quat.y = -_quat.y;
          _quat.z = -_quat.z;
          _quat.w = -_quat.w;
        }
      }
      qArr[i * 4 + 0] = _quat.x;
      qArr[i * 4 + 1] = _quat.y;
      qArr[i * 4 + 2] = _quat.z;
      qArr[i * 4 + 3] = _quat.w;
    }
  }

  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Root.position', times as unknown as number[], rootPositions as unknown as number[]),
    new THREE.VectorKeyframeTrack('Pelvis.position', times as unknown as number[], pelvisPositions as unknown as number[]),
  ];

  for (const def of BONE_DEFINITIONS) {
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${def.name}.quaternion`,
        times as unknown as number[],
        boneQuaternions[def.name] as unknown as number[]
      )
    );
  }

  const clip = new THREE.AnimationClip(meta.id, meta.duration, tracks);
  CLIP_CACHE.set(cacheKey, clip);
  return clip;
}
