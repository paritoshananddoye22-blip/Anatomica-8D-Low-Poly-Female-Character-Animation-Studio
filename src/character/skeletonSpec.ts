import * as THREE from 'three';

/**
 * PART 03 — HUMANOID SKELETON ARCHITECTURE
 * Unified 25-bone humanoid skeleton with anatomically accurate adult female proportions.
 * Total standing height: 1.680m (~7.30 head heights, with 1 head height = 0.230m).
 */

export type BoneName =
  | 'Root'
  | 'Pelvis'
  | 'Spine_01'
  | 'Spine_02'
  | 'Chest'
  | 'Neck'
  | 'Head'
  | 'Left_Clavicle'
  | 'Left_UpperArm'
  | 'Left_Forearm'
  | 'Left_Hand'
  | 'Left_Fingers'
  | 'Right_Clavicle'
  | 'Right_UpperArm'
  | 'Right_Forearm'
  | 'Right_Hand'
  | 'Right_Fingers'
  | 'Left_Thigh'
  | 'Left_Calf'
  | 'Left_Foot'
  | 'Left_Toe'
  | 'Right_Thigh'
  | 'Right_Calf'
  | 'Right_Foot'
  | 'Right_Toe';

export interface BoneDefinition {
  index: number;
  name: BoneName;
  parent: BoneName | null;
  /** World-space bind position [x, y, z] in meters (Y-up, +Z forward, +X left of character) */
  worldPos: [number, number, number];
  /** Local offset from parent bone [x, y, z] */
  localOffset: [number, number, number];
  anatomicalGroup: 'Core' | 'Head & Neck' | 'Left Arm' | 'Right Arm' | 'Left Leg' | 'Right Leg';
  description: string;
}

const RAW_WORLD_POSITIONS: Array<{
  name: BoneName;
  parent: BoneName | null;
  worldPos: [number, number, number];
  anatomicalGroup: BoneDefinition['anatomicalGroup'];
  description: string;
}> = [
  {
    name: 'Root',
    parent: null,
    worldPos: [0, 0.0, 0],
    anatomicalGroup: 'Core',
    description: 'Ground-plane root motion origin between feet (0, 0, 0)',
  },
  {
    name: 'Pelvis',
    parent: 'Root',
    worldPos: [0, 0.90, 0.0],
    anatomicalGroup: 'Core',
    description: 'Sacral/pelvic center of gravity (53.6% of standing height)',
  },
  {
    name: 'Spine_01',
    parent: 'Pelvis',
    worldPos: [0, 1.02, -0.01],
    anatomicalGroup: 'Core',
    description: 'Lumbar spine L3–L5 natural waist articulation',
  },
  {
    name: 'Spine_02',
    parent: 'Spine_01',
    worldPos: [0, 1.15, -0.015],
    anatomicalGroup: 'Core',
    description: 'Lower thoracic ribcage base T8–T12',
  },
  {
    name: 'Chest',
    parent: 'Spine_02',
    worldPos: [0, 1.29, -0.01],
    anatomicalGroup: 'Core',
    description: 'Upper thoracic sternum and ribcage T1–T7',
  },
  {
    name: 'Neck',
    parent: 'Chest',
    worldPos: [0, 1.42, 0.0],
    anatomicalGroup: 'Head & Neck',
    description: 'Cervical spine base C7 at trapezius/clavicle junction',
  },
  {
    name: 'Head',
    parent: 'Neck',
    worldPos: [0, 1.49, 0.01],
    anatomicalGroup: 'Head & Neck',
    description: 'Atlanto-occipital skull pivot (cranium apex at 1.68m)',
  },
  // Left Arm (+X is character's anatomical left in +Z forward space)
  {
    name: 'Left_Clavicle',
    parent: 'Chest',
    worldPos: [0.055, 1.38, 0.01],
    anatomicalGroup: 'Left Arm',
    description: 'Left sternoclavicular joint and shoulder girdle',
  },
  {
    name: 'Left_UpperArm',
    parent: 'Left_Clavicle',
    worldPos: [0.165, 1.37, 0.0],
    anatomicalGroup: 'Left Arm',
    description: 'Left glenohumeral shoulder socket (biacromial width 0.33m)',
  },
  {
    name: 'Left_Forearm',
    parent: 'Left_UpperArm',
    worldPos: [0.20, 1.11, -0.01],
    anatomicalGroup: 'Left Arm',
    description: 'Left humeroulnar elbow hinge joint',
  },
  {
    name: 'Left_Hand',
    parent: 'Left_Forearm',
    worldPos: [0.22, 0.87, 0.01],
    anatomicalGroup: 'Left Arm',
    description: 'Left radiocarpal wrist joint',
  },
  {
    name: 'Left_Fingers',
    parent: 'Left_Hand',
    worldPos: [0.225, 0.79, 0.015],
    anatomicalGroup: 'Left Arm',
    description: 'Left metacarpophalangeal finger cluster',
  },
  // Right Arm (-X is character's anatomical right)
  {
    name: 'Right_Clavicle',
    parent: 'Chest',
    worldPos: [-0.055, 1.38, 0.01],
    anatomicalGroup: 'Right Arm',
    description: 'Right sternoclavicular joint and shoulder girdle',
  },
  {
    name: 'Right_UpperArm',
    parent: 'Right_Clavicle',
    worldPos: [-0.165, 1.37, 0.0],
    anatomicalGroup: 'Right Arm',
    description: 'Right glenohumeral shoulder socket',
  },
  {
    name: 'Right_Forearm',
    parent: 'Right_UpperArm',
    worldPos: [-0.20, 1.11, -0.01],
    anatomicalGroup: 'Right Arm',
    description: 'Right humeroulnar elbow hinge joint',
  },
  {
    name: 'Right_Hand',
    parent: 'Right_Forearm',
    worldPos: [-0.22, 0.87, 0.01],
    anatomicalGroup: 'Right Arm',
    description: 'Right radiocarpal wrist joint',
  },
  {
    name: 'Right_Fingers',
    parent: 'Right_Hand',
    worldPos: [-0.225, 0.79, 0.015],
    anatomicalGroup: 'Right Arm',
    description: 'Right metacarpophalangeal finger cluster',
  },
  // Left Leg (+X)
  {
    name: 'Left_Thigh',
    parent: 'Pelvis',
    worldPos: [0.095, 0.86, 0.0],
    anatomicalGroup: 'Left Leg',
    description: 'Left acetabular hip socket (natural female pelvis width)',
  },
  {
    name: 'Left_Calf',
    parent: 'Left_Thigh',
    worldPos: [0.09, 0.47, 0.01],
    anatomicalGroup: 'Left Leg',
    description: 'Left tibiofemoral knee joint',
  },
  {
    name: 'Left_Foot',
    parent: 'Left_Calf',
    worldPos: [0.09, 0.08, -0.01],
    anatomicalGroup: 'Left Leg',
    description: 'Left talocrural ankle joint',
  },
  {
    name: 'Left_Toe',
    parent: 'Left_Foot',
    worldPos: [0.09, 0.018, 0.11],
    anatomicalGroup: 'Left Leg',
    description: 'Left metatarsophalangeal forefoot ball & toes',
  },
  // Right Leg (-X)
  {
    name: 'Right_Thigh',
    parent: 'Pelvis',
    worldPos: [-0.095, 0.86, 0.0],
    anatomicalGroup: 'Right Leg',
    description: 'Right acetabular hip socket',
  },
  {
    name: 'Right_Calf',
    parent: 'Right_Thigh',
    worldPos: [-0.09, 0.47, 0.01],
    anatomicalGroup: 'Right Leg',
    description: 'Right tibiofemoral knee joint',
  },
  {
    name: 'Right_Foot',
    parent: 'Right_Calf',
    worldPos: [-0.09, 0.08, -0.01],
    anatomicalGroup: 'Right Leg',
    description: 'Right talocrural ankle joint',
  },
  {
    name: 'Right_Toe',
    parent: 'Right_Foot',
    worldPos: [-0.09, 0.018, 0.11],
    anatomicalGroup: 'Right Leg',
    description: 'Right metatarsophalangeal forefoot ball & toes',
  },
];

export const BONE_DEFINITIONS: BoneDefinition[] = RAW_WORLD_POSITIONS.map((item, index) => {
  let localOffset: [number, number, number] = [...item.worldPos];
  if (item.parent) {
    const parentDef = RAW_WORLD_POSITIONS.find((p) => p.name === item.parent)!;
    localOffset = [
      Number((item.worldPos[0] - parentDef.worldPos[0]).toFixed(4)),
      Number((item.worldPos[1] - parentDef.worldPos[1]).toFixed(4)),
      Number((item.worldPos[2] - parentDef.worldPos[2]).toFixed(4)),
    ];
  }
  return {
    index,
    name: item.name,
    parent: item.parent,
    worldPos: item.worldPos,
    localOffset,
    anatomicalGroup: item.anatomicalGroup,
    description: item.description,
  };
});

export const BONE_INDEX_BY_NAME: Record<BoneName, number> = BONE_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.name] = def.index;
    return acc;
  },
  {} as Record<BoneName, number>
);

export interface AnatomicalProportionsReport {
  totalHeightMeters: number;
  headHeightMeters: number;
  headHeightRatio: number;
  shoulderJointWidthMeters: number;
  hipJointWidthMeters: number;
  waistWidthMeters: number;
  hipOuterWidthMeters: number;
  upperArmLengthMeters: number;
  forearmLengthMeters: number;
  thighLengthMeters: number;
  calfLengthMeters: number;
  boneCount: number;
}

export function getAnatomicalProportionsReport(): AnatomicalProportionsReport {
  const totalHeightMeters = 1.68;
  const headHeightMeters = 0.23; // Chin (1.45m) to Cranium apex (1.68m)
  const headHeightRatio = Number((totalHeightMeters / headHeightMeters).toFixed(2)); // 7.30 heads
  return {
    totalHeightMeters,
    headHeightMeters,
    headHeightRatio,
    shoulderJointWidthMeters: 0.33,
    hipJointWidthMeters: 0.19,
    waistWidthMeters: 0.238,
    hipOuterWidthMeters: 0.364,
    upperArmLengthMeters: 0.263,
    forearmLengthMeters: 0.242,
    thighLengthMeters: 0.39,
    calfLengthMeters: 0.39,
    boneCount: BONE_DEFINITIONS.length,
  };
}

export function createHumanoidSkeleton(): {
  bones: THREE.Bone[];
  boneMap: Record<BoneName, THREE.Bone>;
  skeleton: THREE.Skeleton;
  rootBone: THREE.Bone;
} {
  const bones: THREE.Bone[] = [];
  const boneMap = {} as Record<BoneName, THREE.Bone>;

  for (const def of BONE_DEFINITIONS) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(def.localOffset[0], def.localOffset[1], def.localOffset[2]);
    bones.push(bone);
    boneMap[def.name] = bone;
  }

  for (const def of BONE_DEFINITIONS) {
    if (def.parent) {
      const parentBone = boneMap[def.parent];
      parentBone.add(boneMap[def.name]);
    }
  }

  const rootBone = boneMap.Root;
  rootBone.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  return { bones, boneMap, skeleton, rootBone };
}
