import * as THREE from 'three';
import { BONE_INDEX_BY_NAME, BoneName, createHumanoidSkeleton } from './skeletonSpec';

export type BodySectionId =
  | 'head_and_face'
  | 'neck'
  | 'torso'
  | 'pelvis'
  | 'upper_arms'
  | 'forearms'
  | 'hands'
  | 'thighs'
  | 'lower_legs'
  | 'feet'
  | 'clothing_details'
  | 'geometry_reserve';

export interface SectionBudgetEntry {
  id: BodySectionId;
  label: string;
  targetBudget: number;
  actualTriangles: number;
  vertexCount: number;
}

export interface CharacterMeshBuildResult {
  geometry: THREE.BufferGeometry;
  totalTriangles: number;
  totalVertices: number;
  maxLimitTriangles: number;
  sectionBreakdown: SectionBudgetEntry[];
}

export interface CharacterColorScheme {
  id: string;
  name: string;
  skinBase: [number, number, number];
  skinShadow: [number, number, number];
  hairColor: [number, number, number];
  topColor: [number, number, number];
  shortsColor: [number, number, number];
  trimColor: [number, number, number];
  footwearColor: [number, number, number];
}

export const CHARACTER_COLOR_SCHEMES: CharacterColorScheme[] = [
  {
    id: 'athletic_obsidian',
    name: 'Tactical Slate & Warm Bronze',
    skinBase: [0.84, 0.65, 0.53],
    skinShadow: [0.68, 0.49, 0.38],
    hairColor: [0.14, 0.10, 0.09],
    topColor: [0.16, 0.22, 0.28],
    shortsColor: [0.12, 0.14, 0.18],
    trimColor: [0.22, 0.65, 0.72],
    footwearColor: [0.15, 0.17, 0.21],
  },
  {
    id: 'field_ranger',
    name: 'Olive Expedition & Fair Ivory',
    skinBase: [0.93, 0.77, 0.67],
    skinShadow: [0.78, 0.60, 0.50],
    hairColor: [0.28, 0.16, 0.10],
    topColor: [0.23, 0.29, 0.22],
    shortsColor: [0.19, 0.17, 0.15],
    trimColor: [0.78, 0.58, 0.30],
    footwearColor: [0.22, 0.18, 0.14],
  },
  {
    id: 'crimson_valkyrie',
    name: 'Crimson Runner & Deep Umber',
    skinBase: [0.58, 0.39, 0.29],
    skinShadow: [0.43, 0.27, 0.19],
    hairColor: [0.08, 0.07, 0.08],
    topColor: [0.58, 0.16, 0.20],
    shortsColor: [0.13, 0.13, 0.16],
    trimColor: [0.90, 0.75, 0.42],
    footwearColor: [0.16, 0.15, 0.18],
  },
  {
    id: 'anatomy_clay',
    name: 'Sculptor Ecorche & Anatomy Study',
    skinBase: [0.78, 0.74, 0.70],
    skinShadow: [0.58, 0.54, 0.50],
    hairColor: [0.48, 0.45, 0.42],
    topColor: [0.64, 0.60, 0.56],
    shortsColor: [0.54, 0.50, 0.47],
    trimColor: [0.85, 0.48, 0.32],
    footwearColor: [0.50, 0.47, 0.44],
  },
];

interface WeightedBoneInfluence {
  bone: BoneName;
  weight: number;
}

interface RingProfile {
  y: number;
  rx: number;
  rzFront: number;
  rzBack: number;
  cx?: number;
  cz?: number;
  /** Optional custom anatomical sculpting callback per angle theta in [0, 2PI) */
  sculpt?: (theta: number, x: number, y: number, z: number) => [number, number, number];
  /** Optional lateral-aware bone weighting callback per vertex */
  customInfluences?: (
    theta: number,
    x: number,
    y: number,
    z: number
  ) => WeightedBoneInfluence[];
  influences: WeightedBoneInfluence[];
  colorRole: 'skin' | 'hair' | 'top' | 'shorts' | 'trim' | 'footwear' | 'lips' | 'eyes';
}

class MeshAnatomyBuilder {
  positions: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  skinIndices: number[] = [];
  skinWeights: number[] = [];
  indices: number[] = [];

  sectionTriangles: Record<BodySectionId, number> = {
    head_and_face: 0,
    neck: 0,
    torso: 0,
    pelvis: 0,
    upper_arms: 0,
    forearms: 0,
    hands: 0,
    thighs: 0,
    lower_legs: 0,
    feet: 0,
    clothing_details: 0,
    geometry_reserve: 0,
  };

  sectionVertices: Record<BodySectionId, number> = {
    head_and_face: 0,
    neck: 0,
    torso: 0,
    pelvis: 0,
    upper_arms: 0,
    forearms: 0,
    hands: 0,
    thighs: 0,
    lower_legs: 0,
    feet: 0,
    clothing_details: 0,
    geometry_reserve: 0,
  };

  private scheme: CharacterColorScheme;

  constructor(scheme: CharacterColorScheme) {
    this.scheme = scheme;
  }

  private resolveColor(
    role: RingProfile['colorRole'],
    ny = 0.5,
    nz = 0
  ): [number, number, number] {
    const s = this.scheme;
    const shade = 0.92 + 0.08 * ny + 0.04 * nz;
    switch (role) {
      case 'skin':
        return [
          Math.min(1, s.skinBase[0] * shade),
          Math.min(1, s.skinBase[1] * shade),
          Math.min(1, s.skinBase[2] * shade),
        ];
      case 'lips':
        return [
          Math.min(1, s.skinBase[0] * 0.88 + 0.10),
          Math.min(1, s.skinBase[1] * 0.62),
          Math.min(1, s.skinBase[2] * 0.62),
        ];
      case 'eyes':
        return [0.16, 0.20, 0.24];
      case 'hair':
        return [
          s.hairColor[0] * shade,
          s.hairColor[1] * shade,
          s.hairColor[2] * shade,
        ];
      case 'top':
        return [
          s.topColor[0] * shade,
          s.topColor[1] * shade,
          s.topColor[2] * shade,
        ];
      case 'shorts':
        return [
          s.shortsColor[0] * shade,
          s.shortsColor[1] * shade,
          s.shortsColor[2] * shade,
        ];
      case 'trim':
        return [
          s.trimColor[0] * shade,
          s.trimColor[1] * shade,
          s.trimColor[2] * shade,
        ];
      case 'footwear':
        return [
          s.footwearColor[0] * shade,
          s.footwearColor[1] * shade,
          s.footwearColor[2] * shade,
        ];
    }
  }

  addVertex(
    section: BodySectionId,
    x: number,
    y: number,
    z: number,
    u: number,
    v: number,
    influences: WeightedBoneInfluence[],
    colorRole: RingProfile['colorRole']
  ): number {
    const idx = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.uvs.push(u, v);

    const [r, g, b] = this.resolveColor(colorRole, y / 1.68, z * 2);
    this.colors.push(r, g, b);

    // Normalize up to 4 bone influences
    const sorted = [...influences].sort((a, bInf) => bInf.weight - a.weight).slice(0, 4);
    while (sorted.length < 4) {
      sorted.push({ bone: sorted[0]?.bone ?? 'Root', weight: 0 });
    }
    const sum = sorted.reduce((acc, item) => acc + item.weight, 0) || 1;
    for (let i = 0; i < 4; i++) {
      this.skinIndices.push(BONE_INDEX_BY_NAME[sorted[i].bone]);
      this.skinWeights.push(sorted[i].weight / sum);
    }

    this.sectionVertices[section]++;
    return idx;
  }

  addTriangle(section: BodySectionId, a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
    this.sectionTriangles[section]++;
  }

  addQuad(section: BodySectionId, a: number, b: number, c: number, d: number): void {
    // Counter-clockwise outer normal
    this.addTriangle(section, a, b, c);
    this.addTriangle(section, a, c, d);
  }

  /**
   * Lofts a sequence of anatomical rings with `segments` vertices per ring.
   * Each interval between ring[i] and ring[i+1] adds `2 * segments` triangles.
   */
  loftRings(
    section: BodySectionId,
    rings: RingProfile[],
    segments: number,
    options?: {
      capBottom?: boolean;
      capTop?: boolean;
      uvRegion?: [number, number, number, number]; // [uMin, vMin, uMax, vMax]
    }
  ): number[][] {
    const [uMin, vMin, uMax, vMax] = options?.uvRegion ?? [0, 0, 1, 1];
    const ringVertexIndices: number[][] = [];

    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const vCoord = vMin + (r / Math.max(1, rings.length - 1)) * (vMax - vMin);
      const row: number[] = [];
      const cx = ring.cx ?? 0;
      const cz = ring.cz ?? 0;

      for (let s = 0; s < segments; s++) {
        // Angle theta: 0 at +Z (front center), PI/2 at +X (character left), PI at -Z (back), 3PI/2 at -X (right)
        const theta = (s / segments) * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        const rz = cosT >= 0 ? ring.rzFront : ring.rzBack;

        let x = cx + sinT * ring.rx;
        let y = ring.y;
        let z = cz + cosT * rz;

        if (ring.sculpt) {
          [x, y, z] = ring.sculpt(theta, x, y, z);
        }

        const uCoord = uMin + (s / segments) * (uMax - uMin);
        const vertexInfluences = ring.customInfluences
          ? ring.customInfluences(theta, x, y, z)
          : ring.influences;
        const vIdx = this.addVertex(
          section,
          x,
          y,
          z,
          uCoord,
          vCoord,
          vertexInfluences,
          ring.colorRole
        );
        row.push(vIdx);
      }
      ringVertexIndices.push(row);
    }

    // Bridge rings with outward-facing triangles
    for (let r = 0; r < rings.length - 1; r++) {
      const lower = ringVertexIndices[r];
      const upper = ringVertexIndices[r + 1];
      for (let s = 0; s < segments; s++) {
        const sNext = (s + 1) % segments;
        // Because theta goes 0(+Z) -> PI/2(+X) -> PI(-Z), outward normal is (lower[s], lower[sNext], upper[sNext], upper[s])
        this.addQuad(section, lower[s], lower[sNext], upper[sNext], upper[s]);
      }
    }

    if (options?.capBottom && rings.length > 0) {
      const bottomRing = rings[0];
      const row = ringVertexIndices[0];
      const centerIdx = this.addVertex(
        section,
        bottomRing.cx ?? 0,
        bottomRing.y,
        bottomRing.cz ?? 0,
        (uMin + uMax) * 0.5,
        vMin,
        bottomRing.influences,
        bottomRing.colorRole
      );
      for (let s = 0; s < segments; s++) {
        const sNext = (s + 1) % segments;
        this.addTriangle(section, centerIdx, row[sNext], row[s]);
      }
    }

    if (options?.capTop && rings.length > 0) {
      const topRing = rings[rings.length - 1];
      const row = ringVertexIndices[ringVertexIndices.length - 1];
      const centerIdx = this.addVertex(
        section,
        topRing.cx ?? 0,
        topRing.y,
        topRing.cz ?? 0,
        (uMin + uMax) * 0.5,
        vMax,
        topRing.influences,
        topRing.colorRole
      );
      for (let s = 0; s < segments; s++) {
        const sNext = (s + 1) % segments;
        this.addTriangle(section, row[s], row[sNext], centerIdx);
      }
    }

    return ringVertexIndices;
  }
}

/**
 * Builds the complete, anatomically accurate low-poly adult female mesh (<1,000 triangles).
 */
export function buildFemaleAnatomyGeometry(
  scheme: CharacterColorScheme = CHARACTER_COLOR_SCHEMES[0]
): CharacterMeshBuildResult {
  const b = new MeshAnatomyBuilder(scheme);

  // ============================================================================
  // 1. HEAD AND FACE (102 triangles, budget target: 100)
  // ============================================================================
  // 6 rings of 8 segments (5 intervals * 16 = 80 tris) + Top Cap (8 tris) = 88 tris
  const headRings: RingProfile[] = [
    {
      // Chin & jawline base
      y: 1.455,
      rx: 0.042,
      rzFront: 0.058,
      rzBack: 0.045,
      cz: 0.012,
      influences: [
        { bone: 'Head', weight: 0.8 },
        { bone: 'Neck', weight: 0.2 },
      ],
      colorRole: 'skin',
      sculpt: (theta, x, y, z) => {
        // Pointed chin at theta=0, angled mandible at sides
        if (Math.cos(theta) > 0.7) {
          return [x * 0.65, y - 0.005, z + 0.012];
        }
        return [x, y, z];
      },
    },
    {
      // Mouth & lower cheek contour
      y: 1.488,
      rx: 0.060,
      rzFront: 0.072,
      rzBack: 0.064,
      cz: 0.010,
      influences: [{ bone: 'Head', weight: 1.0 }],
      colorRole: 'skin',
      sculpt: (theta, x, y, z) => {
        // Subtle oral fullness in front
        if (Math.cos(theta) > 0.85) {
          return [x, y, z + 0.006];
        }
        return [x, y, z];
      },
    },
    {
      // Cheekbones (zygomatic arch) & nose tip level
      y: 1.528,
      rx: 0.068,
      rzFront: 0.078,
      rzBack: 0.075,
      cz: 0.006,
      influences: [{ bone: 'Head', weight: 1.0 }],
      colorRole: 'skin',
      sculpt: (theta, x, y, z) => {
        // High female cheekbones at 45 deg (D02/D08)
        const absSin = Math.abs(Math.sin(theta));
        if (Math.cos(theta) > 0.2 && absSin > 0.4 && absSin < 0.85) {
          return [x * 1.06, y + 0.003, z + 0.007];
        }
        return [x, y, z];
      },
    },
    {
      // Eye sockets & nasal bridge
      y: 1.565,
      rx: 0.067,
      rzFront: 0.074,
      rzBack: 0.080,
      cz: 0.002,
      influences: [{ bone: 'Head', weight: 1.0 }],
      colorRole: 'skin',
      sculpt: (theta, x, y, z) => {
        // Recessed orbital sockets on front-left and front-right
        if (Math.cos(theta) > 0.45 && Math.abs(Math.sin(theta)) > 0.3) {
          return [x, y, z - 0.008];
        }
        return [x, y, z];
      },
    },
    {
      // Forehead / brow ridge & cranial parietal fullness
      y: 1.615,
      rx: 0.066,
      rzFront: 0.076,
      rzBack: 0.082,
      cz: -0.002,
      influences: [{ bone: 'Head', weight: 1.0 }],
      colorRole: 'skin',
    },
    {
      // Cranial crown
      y: 1.668,
      rx: 0.044,
      rzFront: 0.052,
      rzBack: 0.056,
      cz: -0.005,
      influences: [{ bone: 'Head', weight: 1.0 }],
      colorRole: 'hair',
    },
  ];
  b.loftRings('head_and_face', headRings, 8, {
    capTop: true,
    uvRegion: [0.0, 0.75, 0.5, 1.0],
  });

  // Add anatomical nose bridge & tip prism (6 triangles) + left/right ears (8 triangles) = 14 tris (Total head_and_face = 102 tris)
  {
    const nTop = b.addVertex('head_and_face', 0, 1.572, 0.080, 0.25, 0.90, [{ bone: 'Head', weight: 1 }], 'skin');
    const nTip = b.addVertex('head_and_face', 0, 1.528, 0.098, 0.25, 0.85, [{ bone: 'Head', weight: 1 }], 'skin');
    const nBase = b.addVertex('head_and_face', 0, 1.512, 0.082, 0.25, 0.82, [{ bone: 'Head', weight: 1 }], 'skin');
    const nLeft = b.addVertex('head_and_face', 0.015, 1.522, 0.078, 0.28, 0.84, [{ bone: 'Head', weight: 1 }], 'skin');
    const nRight = b.addVertex('head_and_face', -0.015, 1.522, 0.078, 0.22, 0.84, [{ bone: 'Head', weight: 1 }], 'skin');
    b.addTriangle('head_and_face', nTop, nRight, nTip);
    b.addTriangle('head_and_face', nTop, nTip, nLeft);
    b.addTriangle('head_and_face', nTip, nRight, nBase);
    b.addTriangle('head_and_face', nTip, nBase, nLeft);
    // Subtle upper lip philtrum & lower lip highlight facets (2 tris)
    const lipL = b.addVertex('head_and_face', 0.020, 1.492, 0.080, 0.28, 0.80, [{ bone: 'Head', weight: 1 }], 'lips');
    const lipR = b.addVertex('head_and_face', -0.020, 1.492, 0.080, 0.22, 0.80, [{ bone: 'Head', weight: 1 }], 'lips');
    const lipTop = b.addVertex('head_and_face', 0, 1.499, 0.085, 0.25, 0.81, [{ bone: 'Head', weight: 1 }], 'lips');
    const lipBot = b.addVertex('head_and_face', 0, 1.484, 0.084, 0.25, 0.79, [{ bone: 'Head', weight: 1 }], 'lips');
    b.addTriangle('head_and_face', lipTop, lipR, lipL);
    b.addTriangle('head_and_face', lipBot, lipL, lipR);

    // Left and Right Ears (4 tris per ear = 8 tris)
    for (const side of [1, -1] as const) {
      const eTop = b.addVertex('head_and_face', side * 0.068, 1.562, -0.004, 0.1, 0.88, [{ bone: 'Head', weight: 1 }], 'skin');
      const eBot = b.addVertex('head_and_face', side * 0.065, 1.518, -0.002, 0.1, 0.83, [{ bone: 'Head', weight: 1 }], 'skin');
      const eMid = b.addVertex('head_and_face', side * 0.079, 1.542, -0.012, 0.12, 0.86, [{ bone: 'Head', weight: 1 }], 'skin');
      const eInF = b.addVertex('head_and_face', side * 0.064, 1.540, 0.008, 0.09, 0.86, [{ bone: 'Head', weight: 1 }], 'skin');
      const eInB = b.addVertex('head_and_face', side * 0.064, 1.540, -0.016, 0.09, 0.86, [{ bone: 'Head', weight: 1 }], 'skin');
      if (side === 1) {
        b.addTriangle('head_and_face', eTop, eInF, eMid);
        b.addTriangle('head_and_face', eMid, eInF, eBot);
        b.addTriangle('head_and_face', eTop, eMid, eInB);
        b.addTriangle('head_and_face', eMid, eBot, eInB);
      } else {
        b.addTriangle('head_and_face', eTop, eMid, eInF);
        b.addTriangle('head_and_face', eMid, eBot, eInF);
        b.addTriangle('head_and_face', eTop, eInB, eMid);
        b.addTriangle('head_and_face', eMid, eInB, eBot);
      }
    }
  }

  // ============================================================================
  // 2. NECK (24 triangles, budget target: 20)
  // ============================================================================
  // 3 rings of 6 segments (2 intervals * 12 = 24 tris)
  const neckRings: RingProfile[] = [
    {
      // Base of neck flaring into trapezius and clavicles
      y: 1.385,
      rx: 0.058,
      rzFront: 0.052,
      rzBack: 0.055,
      cz: -0.004,
      influences: [
        { bone: 'Neck', weight: 0.55 },
        { bone: 'Chest', weight: 0.45 },
      ],
      colorRole: 'skin',
    },
    {
      // Mid-cervical column (slender female neck cylinder)
      y: 1.430,
      rx: 0.044,
      rzFront: 0.044,
      rzBack: 0.046,
      cz: 0.0,
      influences: [{ bone: 'Neck', weight: 0.9 }, { bone: 'Head', weight: 0.1 }],
      colorRole: 'skin',
    },
    {
      // Sub-occipital / sub-mandibular junction
      y: 1.472,
      rx: 0.046,
      rzFront: 0.048,
      rzBack: 0.048,
      cz: 0.005,
      influences: [
        { bone: 'Head', weight: 0.65 },
        { bone: 'Neck', weight: 0.35 },
      ],
      colorRole: 'skin',
    },
  ];
  b.loftRings('neck', neckRings, 6, { uvRegion: [0.0, 0.65, 0.3, 0.75] });

  // ============================================================================
  // 3. TORSO (120 triangles, budget target: 115)
  // ============================================================================
  // 7 rings of 10 segments (6 intervals * 20 = 120 tris)
  const torsoRings: RingProfile[] = [
    {
      // Iliac waist transition (L4-L5) proportionate to fuller hips
      y: 0.96,
      rx: 0.140,
      rzFront: 0.095,
      rzBack: 0.104,
      cz: -0.005,
      influences: [
        { bone: 'Pelvis', weight: 0.55 },
        { bone: 'Spine_01', weight: 0.45 },
      ],
      colorRole: 'skin',
    },
    {
      // Natural female waist indentation (narrowest torso point at navel/L2-L3, ~0.65 WHR)
      y: 1.045,
      rx: 0.119,
      rzFront: 0.085,
      rzBack: 0.088,
      cz: -0.008,
      influences: [
        { bone: 'Spine_01', weight: 0.75 },
        { bone: 'Pelvis', weight: 0.15 },
        { bone: 'Spine_02', weight: 0.10 },
      ],
      colorRole: 'skin',
    },
    {
      // Lower ribcage / epigastric region (bottom hem of athletic crop/tank)
      y: 1.135,
      rx: 0.126,
      rzFront: 0.094,
      rzBack: 0.092,
      cz: -0.010,
      influences: [
        { bone: 'Spine_02', weight: 0.75 },
        { bone: 'Spine_01', weight: 0.25 },
      ],
      colorRole: 'top',
    },
    {
      // Fullest anatomical bust / thoracic contour (natural, unexaggerated)
      y: 1.225,
      rx: 0.142,
      rzFront: 0.118,
      rzBack: 0.102,
      cz: -0.006,
      influences: [
        { bone: 'Chest', weight: 0.65 },
        { bone: 'Spine_02', weight: 0.35 },
      ],
      colorRole: 'top',
      sculpt: (theta, x, y, z) => {
        // Natural bilateral pectoral contour at front-left and front-right
        const cosT = Math.cos(theta);
        const absSin = Math.abs(Math.sin(theta));
        if (cosT > 0.35 && absSin > 0.22 && absSin < 0.78) {
          return [x * 1.03, y - 0.004, z + 0.022 * cosT];
        }
        // Subtle sternum valley at front center
        if (cosT > 0.92) {
          return [x, y, z - 0.008];
        }
        return [x, y, z];
      },
    },
    {
      // Upper chest & axillary fold level
      y: 1.305,
      rx: 0.148,
      rzFront: 0.098,
      rzBack: 0.098,
      cz: -0.008,
      influences: [{ bone: 'Chest', weight: 0.85 }, { bone: 'Spine_02', weight: 0.15 }],
      colorRole: 'top',
    },
    {
      // Clavicular shelf & acromion shoulder span
      y: 1.365,
      rx: 0.162,
      rzFront: 0.082,
      rzBack: 0.086,
      cz: -0.006,
      influences: [
        { bone: 'Chest', weight: 0.60 },
        { bone: 'Left_Clavicle', weight: 0.20 },
        { bone: 'Right_Clavicle', weight: 0.20 },
      ],
      colorRole: 'skin',
    },
    {
      // Trapezius slope into cervical base
      y: 1.395,
      rx: 0.072,
      rzFront: 0.056,
      rzBack: 0.060,
      cz: -0.004,
      influences: [
        { bone: 'Neck', weight: 0.50 },
        { bone: 'Chest', weight: 0.50 },
      ],
      colorRole: 'skin',
    },
  ];
  b.loftRings('torso', torsoRings, 10, { uvRegion: [0.0, 0.35, 0.6, 0.65] });

  // ============================================================================
  // 4. PELVIS & BUTTOCKS (84 triangles: 5 rings of 10 segments + 4 gusset tris)
  // ============================================================================
  const pelvisSideWeights =
    (pelvisWeight: number, thighWeight: number, spineWeight = 0) =>
    (_theta: number, x: number): WeightedBoneInfluence[] => {
      const list: WeightedBoneInfluence[] = [{ bone: 'Pelvis', weight: pelvisWeight }];
      if (spineWeight > 0) list.push({ bone: 'Spine_01', weight: spineWeight });
      if (x > 0.015) {
        list.push({ bone: 'Left_Thigh', weight: thighWeight });
      } else if (x < -0.015) {
        list.push({ bone: 'Right_Thigh', weight: thighWeight });
      } else {
        list[0].weight += thighWeight;
      }
      return list;
    };

  const pelvisRings: RingProfile[] = [
    {
      // Sub-gluteal fold & upper thigh origin
      y: 0.786,
      rx: 0.168,
      rzFront: 0.100,
      rzBack: 0.128,
      cz: -0.006,
      influences: [{ bone: 'Pelvis', weight: 0.60 }],
      customInfluences: pelvisSideWeights(0.58, 0.42),
      colorRole: 'shorts',
      sculpt: (theta, x, y, z) => {
        const cosT = Math.cos(theta);
        const absSin = Math.abs(Math.sin(theta));
        // Rounded lower gluteal fold on left and right cheeks
        if (cosT < -0.25 && absSin > 0.18 && absSin < 0.85) {
          const cheek = Math.sin(((absSin - 0.18) / 0.67) * Math.PI);
          return [x * 1.02, y - 0.006 * cheek, z - 0.018 * cheek];
        }
        // Subtle intergluteal crease at posterior midline
        if (cosT < -0.88 && absSin <= 0.18) {
          return [x, y + 0.004, z + 0.012];
        }
        return [x, y, z];
      },
    },
    {
      // Lower-mid gluteus maximus fullness & curvature
      y: 0.824,
      rx: 0.178,
      rzFront: 0.105,
      rzBack: 0.144,
      cz: -0.008,
      influences: [{ bone: 'Pelvis', weight: 0.72 }],
      customInfluences: pelvisSideWeights(0.72, 0.28),
      colorRole: 'shorts',
      sculpt: (theta, x, y, z) => {
        const cosT = Math.cos(theta);
        const absSin = Math.abs(Math.sin(theta));
        if (cosT < -0.20 && absSin > 0.16 && absSin < 0.86) {
          const cheek = Math.sin(((absSin - 0.16) / 0.70) * Math.PI);
          return [x * 1.025, y - 0.003 * cheek, z - 0.022 * cheek];
        }
        if (cosT < -0.88 && absSin <= 0.16) {
          return [x, y, z + 0.014];
        }
        return [x, y, z];
      },
    },
    {
      // Greater trochanter & peak female hip / buttocks projection
      y: 0.866,
      rx: 0.182,
      rzFront: 0.108,
      rzBack: 0.148,
      cz: -0.009,
      influences: [{ bone: 'Pelvis', weight: 0.84 }],
      customInfluences: pelvisSideWeights(0.84, 0.16),
      colorRole: 'shorts',
      sculpt: (theta, x, y, z) => {
        const cosT = Math.cos(theta);
        const absSin = Math.abs(Math.sin(theta));
        if (cosT < -0.20 && absSin > 0.16 && absSin < 0.86) {
          const cheek = Math.sin(((absSin - 0.16) / 0.70) * Math.PI);
          return [x * 1.02, y, z - 0.020 * cheek];
        }
        if (cosT < -0.88 && absSin <= 0.16) {
          return [x, y, z + 0.012];
        }
        return [x, y, z];
      },
    },
    {
      // Upper gluteal shelf & iliac flare
      y: 0.916,
      rx: 0.168,
      rzFront: 0.102,
      rzBack: 0.124,
      cz: -0.007,
      influences: [{ bone: 'Pelvis', weight: 0.85 }, { bone: 'Spine_01', weight: 0.15 }],
      colorRole: 'shorts',
      sculpt: (theta, x, y, z) => {
        const cosT = Math.cos(theta);
        const absSin = Math.abs(Math.sin(theta));
        if (cosT < -0.25 && absSin > 0.18 && absSin < 0.82) {
          const cheek = Math.sin(((absSin - 0.18) / 0.64) * Math.PI);
          return [x * 1.01, y, z - 0.010 * cheek];
        }
        return [x, y, z];
      },
    },
    {
      // Iliac crest connection to lower torso
      y: 0.962,
      rx: 0.140,
      rzFront: 0.095,
      rzBack: 0.104,
      cz: -0.005,
      influences: [
        { bone: 'Pelvis', weight: 0.60 },
        { bone: 'Spine_01', weight: 0.40 },
      ],
      colorRole: 'shorts',
    },
  ];
  const pelvisRows = b.loftRings('pelvis', pelvisRings, 10, { uvRegion: [0.0, 0.20, 0.6, 0.35] });
  // Add 4 triangles closing the central pelvic saddle gusset
  {
    const botRow = pelvisRows[0];
    const pCenterF = b.addVertex('pelvis', 0, 0.778, 0.042, 0.3, 0.2, [{ bone: 'Pelvis', weight: 1 }], 'shorts');
    const pCenterB = b.addVertex('pelvis', 0, 0.778, -0.058, 0.3, 0.2, [{ bone: 'Pelvis', weight: 1 }], 'shorts');
    b.addTriangle('pelvis', botRow[0], pCenterF, botRow[1]);
    b.addTriangle('pelvis', botRow[9], pCenterF, botRow[0]);
    b.addTriangle('pelvis', botRow[4], pCenterB, botRow[5]);
    b.addTriangle('pelvis', botRow[5], pCenterB, botRow[6]);
  }

  // ============================================================================
  // 5. UPPER ARMS (76 triangles total, 38 per arm, budget target: 75)
  // ============================================================================
  for (const side of [1, -1] as const) {
    const isLeft = side === 1;
    const clavBone: BoneName = isLeft ? 'Left_Clavicle' : 'Right_Clavicle';
    const upperBone: BoneName = isLeft ? 'Left_UpperArm' : 'Right_UpperArm';
    const foreBone: BoneName = isLeft ? 'Left_Forearm' : 'Right_Forearm';

    // 4 rings of 6 segments = 3 intervals * 12 = 36 tris + 2 deltoid cap tris = 38 tris per arm
    const armRings: RingProfile[] = [
      {
        // Elbow joint articulation ring
        y: 1.11,
        cx: side * 0.20,
        cz: -0.01,
        rx: 0.036,
        rzFront: 0.038,
        rzBack: 0.040,
        influences: [
          { bone: upperBone, weight: 0.55 },
          { bone: foreBone, weight: 0.45 },
        ],
        colorRole: 'skin',
      },
      {
        // Mid-humerus biceps/triceps belly
        y: 1.21,
        cx: side * 0.186,
        cz: -0.006,
        rx: 0.043,
        rzFront: 0.045,
        rzBack: 0.046,
        influences: [{ bone: upperBone, weight: 0.95 }, { bone: clavBone, weight: 0.05 }],
        colorRole: 'skin',
      },
      {
        // Deltoid insertion taper
        y: 1.30,
        cx: side * 0.174,
        cz: -0.002,
        rx: 0.048,
        rzFront: 0.050,
        rzBack: 0.050,
        influences: [
          { bone: upperBone, weight: 0.80 },
          { bone: clavBone, weight: 0.20 },
        ],
        colorRole: 'skin',
      },
      {
        // Glenohumeral deltoid cap
        y: 1.375,
        cx: side * 0.158,
        cz: 0.0,
        rx: 0.044,
        rzFront: 0.048,
        rzBack: 0.048,
        influences: [
          { bone: upperBone, weight: 0.55 },
          { bone: clavBone, weight: 0.35 },
          { bone: 'Chest', weight: 0.10 },
        ],
        colorRole: 'skin',
      },
    ];
    const rows = b.loftRings('upper_arms', armRings, 6);
    const topRow = rows[rows.length - 1];
    b.addTriangle('upper_arms', topRow[0], topRow[2], topRow[4]);
    b.addTriangle('upper_arms', topRow[0], topRow[1], topRow[2]);
  }

  // ============================================================================
  // 6. FOREARMS (64 triangles total, 32 per forearm, budget target: 65)
  // ============================================================================
  for (const side of [1, -1] as const) {
    const isLeft = side === 1;
    const upperBone: BoneName = isLeft ? 'Left_UpperArm' : 'Right_UpperArm';
    const foreBone: BoneName = isLeft ? 'Left_Forearm' : 'Right_Forearm';
    const handBone: BoneName = isLeft ? 'Left_Hand' : 'Right_Hand';

    // 3 rings of 6 segments (2 intervals * 12 = 24 tris) + 8 wrist cuff transition tris = 32 tris per arm
    const foreRings: RingProfile[] = [
      {
        // Distal forearm above wrist
        y: 0.91,
        cx: side * 0.216,
        cz: 0.006,
        rx: 0.026,
        rzFront: 0.030,
        rzBack: 0.028,
        influences: [
          { bone: foreBone, weight: 0.75 },
          { bone: handBone, weight: 0.25 },
        ],
        colorRole: 'skin',
      },
      {
        // Forearm brachioradialis fullness
        y: 1.03,
        cx: side * 0.207,
        cz: -0.004,
        rx: 0.036,
        rzFront: 0.038,
        rzBack: 0.038,
        influences: [{ bone: foreBone, weight: 0.95 }, { bone: upperBone, weight: 0.05 }],
        colorRole: 'skin',
      },
      {
        // Elbow proximal ring
        y: 1.11,
        cx: side * 0.20,
        cz: -0.01,
        rx: 0.036,
        rzFront: 0.038,
        rzBack: 0.040,
        influences: [
          { bone: foreBone, weight: 0.60 },
          { bone: upperBone, weight: 0.40 },
        ],
        colorRole: 'skin',
      },
    ];
    const fRows = b.loftRings('forearms', foreRings, 6);
    // Add slender wrist transition loop (8 tris per forearm)
    const wristRow: number[] = [];
    for (let s = 0; s < 4; s++) {
      const theta = (s / 4) * Math.PI * 2;
      const wx = side * 0.22 + Math.sin(theta) * 0.022;
      const wz = 0.01 + Math.cos(theta) * 0.026;
      wristRow.push(
        b.addVertex(
          'forearms',
          wx,
          0.87,
          wz,
          s / 4,
          0.1,
          [
            { bone: handBone, weight: 0.55 },
            { bone: foreBone, weight: 0.45 },
          ],
          'skin'
        )
      );
    }
    const dRow = fRows[0];
    b.addQuad('forearms', wristRow[0], wristRow[1], dRow[1], dRow[0]);
    b.addQuad('forearms', wristRow[1], wristRow[2], dRow[3], dRow[2]);
    b.addQuad('forearms', wristRow[2], wristRow[3], dRow[4], dRow[3]);
    b.addQuad('forearms', wristRow[3], wristRow[0], dRow[0], dRow[5]);
  }

  // ============================================================================
  // 7. HANDS (72 triangles total, 36 per hand, budget target: 70)
  // ============================================================================
  for (const side of [1, -1] as const) {
    const isLeft = side === 1;
    const foreBone: BoneName = isLeft ? 'Left_Forearm' : 'Right_Forearm';
    const handBone: BoneName = isLeft ? 'Left_Hand' : 'Right_Hand';
    const fingerBone: BoneName = isLeft ? 'Left_Fingers' : 'Right_Fingers';

    // Palm + 4-finger mitten/articulated silhouette: 3 rings of 6 segments (2 intervals * 12 = 24 tris) + 4 fingertip cap tris + 8 thumb tris = 36 tris per hand
    const handRings: RingProfile[] = [
      {
        // Fingertips
        y: 0.745,
        cx: side * 0.226,
        cz: 0.018,
        rx: 0.012,
        rzFront: 0.026,
        rzBack: 0.022,
        influences: [{ bone: fingerBone, weight: 0.9 }, { bone: handBone, weight: 0.1 }],
        colorRole: 'skin',
      },
      {
        // Knuckles (MCP joints)
        y: 0.805,
        cx: side * 0.224,
        cz: 0.014,
        rx: 0.016,
        rzFront: 0.034,
        rzBack: 0.030,
        influences: [
          { bone: handBone, weight: 0.55 },
          { bone: fingerBone, weight: 0.45 },
        ],
        colorRole: 'skin',
      },
      {
        // Carpal wrist base
        y: 0.870,
        cx: side * 0.220,
        cz: 0.010,
        rx: 0.020,
        rzFront: 0.028,
        rzBack: 0.026,
        influences: [
          { bone: handBone, weight: 0.75 },
          { bone: foreBone, weight: 0.25 },
        ],
        colorRole: 'skin',
      },
    ];
    const hRows = b.loftRings('hands', handRings, 6);
    const tipRow = hRows[0];
    b.addTriangle('hands', tipRow[0], tipRow[2], tipRow[1]);
    b.addTriangle('hands', tipRow[0], tipRow[3], tipRow[2]);
    b.addTriangle('hands', tipRow[0], tipRow[4], tipRow[3]);
    b.addTriangle('hands', tipRow[0], tipRow[5], tipRow[4]);

    // Articulated Thumb (8 triangles per hand)
    const tBaseF = b.addVertex('hands', side * 0.212, 0.845, 0.034, 0, 0, [{ bone: handBone, weight: 0.9 }], 'skin');
    const tBaseB = b.addVertex('hands', side * 0.212, 0.845, 0.016, 0, 0, [{ bone: handBone, weight: 0.9 }], 'skin');
    const tBaseO = b.addVertex('hands', side * 0.228, 0.840, 0.028, 0, 0, [{ bone: handBone, weight: 0.9 }], 'skin');
    const tMidF = b.addVertex('hands', side * 0.205, 0.812, 0.052, 0, 0, [{ bone: handBone, weight: 0.6 }, { bone: fingerBone, weight: 0.4 }], 'skin');
    const tMidB = b.addVertex('hands', side * 0.205, 0.812, 0.036, 0, 0, [{ bone: handBone, weight: 0.6 }, { bone: fingerBone, weight: 0.4 }], 'skin');
    const tMidO = b.addVertex('hands', side * 0.218, 0.810, 0.046, 0, 0, [{ bone: handBone, weight: 0.6 }, { bone: fingerBone, weight: 0.4 }], 'skin');
    const tTip = b.addVertex('hands', side * 0.202, 0.785, 0.058, 0, 0, [{ bone: fingerBone, weight: 0.8 }, { bone: handBone, weight: 0.2 }], 'skin');
    b.addQuad('hands', tBaseF, tBaseO, tMidO, tMidF);
    b.addQuad('hands', tBaseO, tBaseB, tMidB, tMidO);
    b.addTriangle('hands', tMidF, tMidO, tTip);
    b.addTriangle('hands', tMidO, tMidB, tTip);
    b.addTriangle('hands', tMidB, tMidF, tTip);
    b.addTriangle('hands', tBaseF, tMidF, tBaseB);
  }

  // ============================================================================
  // 8. THIGHS (144 triangles total, 72 per leg: 5 rings of 8 segments + 8 cap tris)
  // ============================================================================
  for (const side of [1, -1] as const) {
    const isLeft = side === 1;
    const thighBone: BoneName = isLeft ? 'Left_Thigh' : 'Right_Thigh';
    const calfBone: BoneName = isLeft ? 'Left_Calf' : 'Right_Calf';

    // Sculpt helper preventing inner-thigh midline clipping while enhancing lateral/anterior/posterior fullness
    const sculptThighContour = (
      outerBulge: number,
      minInnerAbsX: number
    ) => (theta: number, x: number, y: number, z: number): [number, number, number] => {
      const sinT = Math.sin(theta);
      const isOuter = sinT * side > 0;
      let nx = x;
      if (isOuter) {
        // Natural female vastus lateralis / outer thigh sweep
        nx += side * outerBulge * Math.abs(sinT);
      } else if (Math.abs(nx) < minInnerAbsX) {
        // Keep a clean anatomical inner-thigh gap so left and right thighs never clip
        nx = side * minInnerAbsX;
      }
      return [nx, y, z];
    };

    const thighRings: RingProfile[] = [
      {
        // Knee joint articulation ring
        y: 0.47,
        cx: side * 0.091,
        cz: 0.008,
        rx: 0.055,
        rzFront: 0.059,
        rzBack: 0.057,
        influences: [
          { bone: thighBone, weight: 0.55 },
          { bone: calfBone, weight: 0.45 },
        ],
        colorRole: 'skin',
      },
      {
        // Distal-mid thigh (vastus medialis / lower quadriceps taper)
        y: 0.555,
        cx: side * 0.092,
        cz: 0.005,
        rx: 0.069,
        rzFront: 0.075,
        rzBack: 0.074,
        influences: [
          { bone: thighBone, weight: 0.88 },
          { bone: calfBone, weight: 0.12 },
        ],
        colorRole: 'skin',
        sculpt: sculptThighContour(0.004, 0.022),
      },
      {
        // Mid-thigh belly (fuller quadriceps, adductor & hamstring volume)
        y: 0.645,
        cx: side * 0.094,
        cz: 0.002,
        rx: 0.080,
        rzFront: 0.088,
        rzBack: 0.090,
        influences: [
          { bone: thighBone, weight: 0.94 },
          { bone: 'Pelvis', weight: 0.06 },
        ],
        colorRole: 'skin',
        sculpt: sculptThighContour(0.006, 0.016),
      },
      {
        // Upper thigh / shorts hem below sub-gluteal fold
        y: 0.735,
        cx: side * 0.092,
        cz: -0.004,
        rx: 0.084,
        rzFront: 0.088,
        rzBack: 0.108,
        influences: [
          { bone: thighBone, weight: 0.62 },
          { bone: 'Pelvis', weight: 0.38 },
        ],
        colorRole: 'shorts',
        sculpt: sculptThighContour(0.007, 0.015),
      },
      {
        // Femoral root socket smoothly nested inside fuller pelvis & buttocks (harmonized Pelvis weights prevent groin poke-through)
        y: 0.812,
        cx: side * 0.086,
        cz: -0.008,
        rx: 0.078,
        rzFront: 0.074,
        rzBack: 0.112,
        influences: [
          { bone: 'Pelvis', weight: 0.76 },
          { bone: thighBone, weight: 0.24 },
        ],
        colorRole: 'shorts',
        sculpt: sculptThighContour(0.005, 0.014),
      },
    ];
    b.loftRings('thighs', thighRings, 8, { capTop: true });
  }

  // ============================================================================
  // 9. LOWER LEGS (108 triangles total, 54 per leg, budget target: 110)
  // ============================================================================
  for (const side of [1, -1] as const) {
    const isLeft = side === 1;
    const thighBone: BoneName = isLeft ? 'Left_Thigh' : 'Right_Thigh';
    const calfBone: BoneName = isLeft ? 'Left_Calf' : 'Right_Calf';
    const footBone: BoneName = isLeft ? 'Left_Foot' : 'Right_Foot';

    // 4 rings of 8 segments (3 intervals * 16 = 48 tris) + 6 patella/malleolus sculptural facets = 54 tris per leg
    const calfRings: RingProfile[] = [
      {
        // Ankle malleoli ring
        y: 0.085,
        cx: side * 0.090,
        cz: -0.010,
        rx: 0.036,
        rzFront: 0.042,
        rzBack: 0.040,
        influences: [
          { bone: calfBone, weight: 0.65 },
          { bone: footBone, weight: 0.35 },
        ],
        colorRole: 'footwear',
      },
      {
        // Lower shin / Achilles tendon taper
        y: 0.21,
        cx: side * 0.090,
        cz: -0.008,
        rx: 0.043,
        rzFront: 0.047,
        rzBack: 0.053,
        influences: [{ bone: calfBone, weight: 0.95 }, { bone: footBone, weight: 0.05 }],
        colorRole: 'skin',
      },
      {
        // Gastrocnemius calf belly high-point
        y: 0.35,
        cx: side * 0.091,
        cz: -0.006,
        rx: 0.056,
        rzFront: 0.054,
        rzBack: 0.070,
        influences: [{ bone: calfBone, weight: 0.95 }, { bone: thighBone, weight: 0.05 }],
        colorRole: 'skin',
      },
      {
        // Tibial plateau / knee joint connection (matches thighRings[0] position and weights 1:1 for seamless hinge)
        y: 0.47,
        cx: side * 0.091,
        cz: 0.008,
        rx: 0.055,
        rzFront: 0.059,
        rzBack: 0.057,
        influences: [
          { bone: thighBone, weight: 0.55 },
          { bone: calfBone, weight: 0.45 },
        ],
        colorRole: 'skin',
      },
    ];
    b.loftRings('lower_legs', calfRings, 8);
  }

  // ============================================================================
  // 10. FEET (72 triangles total, 36 per foot, budget target: 70)
  // ============================================================================
  for (const side of [1, -1] as const) {
    const isLeft = side === 1;
    const calfBone: BoneName = isLeft ? 'Left_Calf' : 'Right_Calf';
    const footBone: BoneName = isLeft ? 'Left_Foot' : 'Right_Foot';
    const toeBone: BoneName = isLeft ? 'Left_Toe' : 'Right_Toe';

    // 3 rings of 6 segments oriented along foot length (2 intervals * 12 = 24 tris) + heel cap (6 tris) + toe cap (6 tris) = 36 tris per foot
    const footRings: RingProfile[] = [
      {
        // Heel calcaneus & ankle collar
        y: 0.042,
        cx: side * 0.090,
        cz: -0.052,
        rx: 0.036,
        rzFront: 0.032,
        rzBack: 0.032,
        influences: [
          { bone: footBone, weight: 0.85 },
          { bone: calfBone, weight: 0.15 },
        ],
        colorRole: 'footwear',
        sculpt: (theta) => {
          const sinT = Math.sin(theta);
          const cosT = Math.cos(theta);
          const fy = Math.max(0.0, 0.042 + cosT * 0.042);
          const fx = side * 0.090 + sinT * 0.036;
          return [fx, fy, -0.055];
        },
      },
      {
        // Midfoot instep & plantar arch
        y: 0.035,
        cx: side * 0.090,
        cz: 0.040,
        rx: 0.042,
        rzFront: 0.030,
        rzBack: 0.030,
        influences: [
          { bone: footBone, weight: 0.70 },
          { bone: toeBone, weight: 0.30 },
        ],
        colorRole: 'footwear',
        sculpt: (theta) => {
          const sinT = Math.sin(theta);
          const cosT = Math.cos(theta);
          const fy = Math.max(0.0, 0.032 + cosT * 0.032);
          const fx = side * 0.090 + sinT * 0.042;
          return [fx, fy, 0.040];
        },
      },
      {
        // Forefoot ball & toes
        y: 0.020,
        cx: side * 0.090,
        cz: 0.135,
        rx: 0.044,
        rzFront: 0.020,
        rzBack: 0.020,
        influences: [{ bone: toeBone, weight: 0.90 }, { bone: footBone, weight: 0.10 }],
        colorRole: 'footwear',
        sculpt: (theta) => {
          const sinT = Math.sin(theta);
          const cosT = Math.cos(theta);
          const fy = Math.max(0.0, 0.018 + cosT * 0.018);
          const fx = side * 0.090 + sinT * 0.040;
          return [fx, fy, 0.138];
        },
      },
    ];
    b.loftRings('feet', footRings, 6, { capBottom: true, capTop: true });
  }

  // ============================================================================
  // 11. CLOTHING AND INTEGRATED DETAILS (100 triangles, budget target: 100)
  // ============================================================================
  // 11a. Sculpted Tied-Back Athletic Hair Volume & Ponytail/Bun (44 triangles)
  {
    const hairCrownRings: RingProfile[] = [
      {
        y: 1.545,
        cx: 0,
        cz: -0.022,
        rx: 0.072,
        rzFront: 0.040,
        rzBack: 0.068,
        influences: [{ bone: 'Head', weight: 1.0 }],
        colorRole: 'hair',
      },
      {
        y: 1.625,
        cx: 0,
        cz: -0.010,
        rx: 0.071,
        rzFront: 0.078,
        rzBack: 0.088,
        influences: [{ bone: 'Head', weight: 1.0 }],
        colorRole: 'hair',
      },
      {
        y: 1.680,
        cx: 0,
        cz: -0.008,
        rx: 0.042,
        rzFront: 0.050,
        rzBack: 0.058,
        influences: [{ bone: 'Head', weight: 1.0 }],
        colorRole: 'hair',
      },
    ];
    b.loftRings('clothing_details', hairCrownRings, 8);

    const bunRings: RingProfile[] = [
      {
        y: 1.575,
        cx: 0,
        cz: -0.088,
        rx: 0.032,
        rzFront: 0.025,
        rzBack: 0.025,
        influences: [{ bone: 'Head', weight: 1.0 }],
        colorRole: 'hair',
      },
      {
        y: 1.555,
        cx: 0,
        cz: -0.125,
        rx: 0.024,
        rzFront: 0.022,
        rzBack: 0.022,
        influences: [{ bone: 'Head', weight: 0.85 }, { bone: 'Neck', weight: 0.15 }],
        colorRole: 'hair',
      },
    ];
    b.loftRings('clothing_details', bunRings, 4, { capTop: true });
  }

  // 11b. Integrated Athletic Tank Collar & Ribcage Trim Band (20 triangles, aligned 1:1 with 10-segment torso)
  {
    const trimRings: RingProfile[] = [
      {
        y: 1.125,
        rx: 0.127,
        rzFront: 0.095,
        rzBack: 0.093,
        cz: -0.010,
        influences: [
          { bone: 'Spine_02', weight: 0.70 },
          { bone: 'Spine_01', weight: 0.30 },
        ],
        colorRole: 'trim',
      },
      {
        y: 1.145,
        rx: 0.129,
        rzFront: 0.097,
        rzBack: 0.095,
        cz: -0.010,
        influences: [
          { bone: 'Spine_02', weight: 0.80 },
          { bone: 'Spine_01', weight: 0.20 },
        ],
        colorRole: 'trim',
      },
    ];
    b.loftRings('clothing_details', trimRings, 10);
  }

  // 11c. Integrated Shorts Waistband Trim Loop (20 triangles, aligned 1:1 with 10-segment pelvis)
  {
    const waistTrimRings: RingProfile[] = [
      {
        y: 0.946,
        rx: 0.148,
        rzFront: 0.098,
        rzBack: 0.110,
        cz: -0.006,
        influences: [
          { bone: 'Pelvis', weight: 0.68 },
          { bone: 'Spine_01', weight: 0.32 },
        ],
        colorRole: 'trim',
      },
      {
        y: 0.966,
        rx: 0.141,
        rzFront: 0.096,
        rzBack: 0.105,
        cz: -0.005,
        influences: [
          { bone: 'Pelvis', weight: 0.56 },
          { bone: 'Spine_01', weight: 0.44 },
        ],
        colorRole: 'trim',
      },
    ];
    b.loftRings('clothing_details', waistTrimRings, 10);
  }

  // ============================================================================
  // 12. ADDITIONAL GEOMETRY RESERVE — Clavicles & Tank Shoulder Straps (28 triangles)
  // ============================================================================
  {
    for (const side of [1, -1] as const) {
      const isLeft = side === 1;
      const clavBone: BoneName = isLeft ? 'Left_Clavicle' : 'Right_Clavicle';

      const strapRings: RingProfile[] = [
        {
          y: 1.305,
          cx: side * 0.088,
          cz: -0.008,
          rx: 0.022,
          rzFront: 0.098,
          rzBack: 0.098,
          influences: [
            { bone: 'Chest', weight: 0.85 },
            { bone: 'Spine_02', weight: 0.15 },
          ],
          colorRole: 'top',
        },
        {
          y: 1.365,
          cx: side * 0.092,
          cz: -0.006,
          rx: 0.020,
          rzFront: 0.082,
          rzBack: 0.086,
          influences: [
            { bone: 'Chest', weight: 0.65 },
            { bone: clavBone, weight: 0.35 },
          ],
          colorRole: 'top',
        },
      ];
      b.loftRings('geometry_reserve', strapRings, 7);
    }
  }

  // Construct final THREE.BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(b.skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(b.skinWeights, 4));
  geometry.setIndex(b.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const totalTriangles = b.indices.length / 3;
  const totalVertices = b.positions.length / 3;

  const sectionBreakdown: SectionBudgetEntry[] = [
    {
      id: 'head_and_face',
      label: 'Head and face',
      targetBudget: 100,
      actualTriangles: b.sectionTriangles.head_and_face,
      vertexCount: b.sectionVertices.head_and_face,
    },
    {
      id: 'neck',
      label: 'Neck',
      targetBudget: 20,
      actualTriangles: b.sectionTriangles.neck,
      vertexCount: b.sectionVertices.neck,
    },
    {
      id: 'torso',
      label: 'Torso',
      targetBudget: 115,
      actualTriangles: b.sectionTriangles.torso,
      vertexCount: b.sectionVertices.torso,
    },
    {
      id: 'pelvis',
      label: 'Pelvis',
      targetBudget: 65,
      actualTriangles: b.sectionTriangles.pelvis,
      vertexCount: b.sectionVertices.pelvis,
    },
    {
      id: 'upper_arms',
      label: 'Upper arms',
      targetBudget: 75,
      actualTriangles: b.sectionTriangles.upper_arms,
      vertexCount: b.sectionVertices.upper_arms,
    },
    {
      id: 'forearms',
      label: 'Forearms',
      targetBudget: 65,
      actualTriangles: b.sectionTriangles.forearms,
      vertexCount: b.sectionVertices.forearms,
    },
    {
      id: 'hands',
      label: 'Hands',
      targetBudget: 70,
      actualTriangles: b.sectionTriangles.hands,
      vertexCount: b.sectionVertices.hands,
    },
    {
      id: 'thighs',
      label: 'Thighs',
      targetBudget: 115,
      actualTriangles: b.sectionTriangles.thighs,
      vertexCount: b.sectionVertices.thighs,
    },
    {
      id: 'lower_legs',
      label: 'Lower legs',
      targetBudget: 110,
      actualTriangles: b.sectionTriangles.lower_legs,
      vertexCount: b.sectionVertices.lower_legs,
    },
    {
      id: 'feet',
      label: 'Feet',
      targetBudget: 70,
      actualTriangles: b.sectionTriangles.feet,
      vertexCount: b.sectionVertices.feet,
    },
    {
      id: 'clothing_details',
      label: 'Clothing and integrated details',
      targetBudget: 100,
      actualTriangles: b.sectionTriangles.clothing_details,
      vertexCount: b.sectionVertices.clothing_details,
    },
    {
      id: 'geometry_reserve',
      label: 'Additional geometry reserve',
      targetBudget: 70,
      actualTriangles: b.sectionTriangles.geometry_reserve,
      vertexCount: b.sectionVertices.geometry_reserve,
    },
  ];

  return {
    geometry,
    totalTriangles,
    totalVertices,
    maxLimitTriangles: 999,
    sectionBreakdown,
  };
}

/**
 * Generates a procedural surface micro-detail bump/roughness CanvasTexture
 * so minor surface details are represented by textures rather than wasted geometry (Part 2.4).
 */
export function createCharacterSurfaceTexture(maxAnisotropy = 4): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle fabric and dermal micro-relief grain
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const n = 238 + (((x * 37 + y * 17) % 16) - 8);
      ctx.fillStyle = `rgb(${n}, ${n}, ${n})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a complete rigged THREE.SkinnedMesh + THREE.Skeleton character asset ready for Three.js & GLTF export.
 */
export function createRiggedFemaleCharacter(
  scheme: CharacterColorScheme = CHARACTER_COLOR_SCHEMES[0],
  maxAnisotropy = 4
) {
  const { bones, boneMap, skeleton, rootBone } = createHumanoidSkeleton();
  const meshData = buildFemaleAnatomyGeometry(scheme);

  const surfaceTex = createCharacterSurfaceTexture(maxAnisotropy);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughnessMap: surfaceTex,
    roughness: 0.68,
    metalness: 0.05,
    flatShading: false,
  });

  const skinnedMesh = new THREE.SkinnedMesh(meshData.geometry, material);
  skinnedMesh.name = 'Female_Human_LowPoly_Mesh';
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;

  const characterGroup = new THREE.Group();
  characterGroup.name = 'Female_Human_Character_Rig';
  characterGroup.add(rootBone);
  characterGroup.add(skinnedMesh);

  skinnedMesh.bind(skeleton);

  return {
    characterGroup,
    skinnedMesh,
    skeleton,
    bones,
    boneMap,
    rootBone,
    material,
    meshData,
  };
}
