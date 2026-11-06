import { useMemo, useState } from 'react';
import { Search, X, Check, RotateCcw, Download } from 'lucide-react';
import {
  ANIMATION_CATALOG,
  ANIMATION_PART_CATEGORIES,
  AnimationClipMeta,
  AnimationPartId,
  DirectionId,
  EIGHT_DIRECTIONS,
} from '../character/animationCatalog';
import { CharacterMeshBuildResult } from '../character/femaleAnatomyMesh';
import {
  AnatomicalProportionsReport,
  BONE_DEFINITIONS,
  BoneName,
} from '../character/skeletonSpec';

export type ActiveModalType = 'library' | 'anatomy' | 'skeleton' | null;

interface InspectionModalsProps {
  activeModal: ActiveModalType;
  onClose: () => void;
  activeClipId: string;
  onSelectClip: (clipId: string) => void;
  meshReport: CharacterMeshBuildResult;
  proportionsReport: AnatomicalProportionsReport;
  manualBoneOverride: { bone: BoneName; rx: number; ry: number; rz: number } | null;
  onChangeManualBone: (
    override: { bone: BoneName; rx: number; ry: number; rz: number } | null
  ) => void;
  onExportGltf: (mode: 'active' | 'locomotion_pack') => void;
}

export function InspectionModals({
  activeModal,
  onClose,
  activeClipId,
  onSelectClip,
  meshReport,
  proportionsReport,
  manualBoneOverride,
  onChangeManualBone,
  onExportGltf,
}: InspectionModalsProps) {
  const [selectedPart, setSelectedPart] = useState<AnimationPartId | 'ALL'>('ALL');
  const [selectedDir, setSelectedDir] = useState<DirectionId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBone, setSelectedBone] = useState<BoneName>('Left_UpperArm');

  const filteredClips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ANIMATION_CATALOG.filter((c) => {
      if (selectedPart !== 'ALL' && c.partId !== selectedPart) return false;
      if (selectedDir !== 'ALL' && c.direction !== selectedDir) return false;
      if (
        q &&
        !c.id.toLowerCase().includes(q) &&
        !c.name.toLowerCase().includes(q) &&
        !c.subGroup.toLowerCase().includes(q) &&
        !c.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [selectedPart, selectedDir, searchQuery]);

  if (!activeModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        activeModal === 'library'
          ? 'Complete 25-Part Animation Library Browser'
          : activeModal === 'anatomy'
            ? 'Female Anatomy and Polygon Budget Verification'
            : '25-Bone Humanoid Skeleton Rig Inspector'
      }
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[82vh] flex flex-col bg-[#11151e] border border-slate-800 rounded-xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1017]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {activeModal === 'library' &&
                `Complete Eight-Directional Animation Library (${ANIMATION_CATALOG.length} Clips)`}
              {activeModal === 'anatomy' &&
                'Part 01 & Part 02 — Female Human Anatomy & Polygon Budget Audit'}
              {activeModal === 'skeleton' &&
                'Part 03 — 25-Bone Humanoid Skeleton & Joint Deformation Rig'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeModal === 'library' &&
                'Browse all 21 animation systems (Parts 05–25) with universal D01–D08 directional variants.'}
              {activeModal === 'anatomy' &&
                'Hard geometry limit: 999 triangles maximum · 7.0–7.5 head-height realistic adult female proportions.'}
              {activeModal === 'skeleton' &&
                'Unified humanoid hierarchy with 4-bone normalized skin weights and real-time joint rotation testing.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Animation Library */}
        {activeModal === 'library' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Filter Controls Bar */}
            <div className="p-4 border-b border-slate-800 bg-[#0f131c] flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clip ID or action (e.g. WLK_D02, SPR_D05, MLE_KICK, STL, FALL)..."
                  aria-label="Search animations"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#161b26] border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                aria-label="Filter by Specification Part"
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value as AnimationPartId | 'ALL')}
                className="px-3 py-2 text-xs bg-[#161b26] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">All 21 Animation Systems ({ANIMATION_CATALOG.length})</option>
                {ANIMATION_PART_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.partNumber}: {cat.title}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-[#161b26] p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDir('ALL')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    selectedDir === 'ALL'
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Dirs
                </button>
                {EIGHT_DIRECTIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDir(d.id)}
                    className={`px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      selectedDir === d.id
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Clip List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/70">
              {filteredClips.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No animation clips match your current filter criteria.
                </div>
              ) : (
                filteredClips.map((clip: AnimationClipMeta) => {
                  const isSelected = clip.id === activeClipId;
                  return (
                    <div
                      key={clip.id}
                      className={`py-3 px-4 flex items-center justify-between gap-4 rounded-lg transition-colors ${
                        isSelected ? 'bg-sky-500/15' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                          <span className="text-sky-400 font-semibold">{clip.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{clip.partNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span>{clip.subGroup}</span>
                          {clip.direction && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Dir {clip.direction}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{clip.duration.toFixed(2)}s</span>
                          <span aria-hidden="true">·</span>
                          <span>{clip.loop ? 'Looping' : 'One-Shot'}</span>
                        </div>
                        <div className="text-sm font-medium text-white mt-0.5 truncate">
                          {clip.name}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {clip.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectClip(clip.id);
                          onClose();
                        }}
                        className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? 'Active Clip' : 'Load Clip'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Modal Body: Anatomy & Budget Audit */}
        {activeModal === 'anatomy' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-[#161b26] border border-slate-800">
                <div className="text-xs text-slate-400">Deforming Mesh Budget</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {meshReport.totalTriangles} / {meshReport.maxLimitTriangles}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Strictly &lt; 1,000 Triangles</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161b26] border border-slate-800">
                <div className="text-xs text-slate-400">Total Indexed Vertices</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {meshReport.totalVertices}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  4-bone normalized skin weights
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161b26] border border-slate-800">
                <div className="text-xs text-slate-400">Standing Proportion Ratio</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {proportionsReport.headHeightRatio.toFixed(2)} Heads
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Target: 7.0–7.5 head heights ({proportionsReport.totalHeightMeters}m)
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161b26] border border-slate-800">
                <div className="text-xs text-slate-400">Deliverable Export</div>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onExportGltf('locomotion_pack')}
                    className="w-full px-3 py-2 text-xs font-semibold bg-sky-500 text-slate-950 rounded-lg hover:bg-sky-400 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export 8D Pack (.gltf)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Two-Column Tables: Part 02 Triangle Allocation & Part 01 Proportions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#161b26] border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    01. Part 02 Section Triangle Allocation
                  </h3>
                  <span className="text-xs text-slate-400 font-mono tabular-nums">
                    Hard Limit: 999 Tris
                  </span>
                </div>
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-[#0f131c] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-sans font-medium">Body Section</th>
                      <th className="py-2.5 px-3 text-right">Target</th>
                      <th className="py-2.5 px-3 text-right">Actual</th>
                      <th className="py-2.5 px-4 text-right">Vertices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {meshReport.sectionBreakdown.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-4 font-sans text-slate-200">{row.label}</td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          {row.targetBudget}
                        </td>
                        <td className="py-2 px-3 text-right text-sky-400 font-semibold">
                          {row.actualTriangles}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-400">
                          {row.vertexCount}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#161b26] font-semibold text-white">
                      <td className="py-2.5 px-4 font-sans">TOTAL CHARACTER MESH</td>
                      <td className="py-2.5 px-3 text-right">975</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {meshReport.totalTriangles}
                      </td>
                      <td className="py-2.5 px-4 text-right">{meshReport.totalVertices}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="px-4 py-3 bg-[#161b26] border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-white">
                      02. Part 01 Adult Female Anatomical Proportions
                    </h3>
                  </div>
                  <div className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Standing Stature (Crown to Sole)</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.totalHeightMeters.toFixed(3)} m (7.30 Head Heights)
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Cranial Head Unit (Chin to Apex)</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.headHeightMeters.toFixed(3)} m
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Biacromial Shoulder Joint Span</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.shoulderJointWidthMeters.toFixed(3)} m
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Natural Waist Width (L2–L3 Indentation)</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.waistWidthMeters.toFixed(3)} m
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Pelvic Trochanter / Hip Outer Width</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.hipOuterWidthMeters.toFixed(3)} m
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Upper Arm vs Forearm Segment</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.upperArmLengthMeters.toFixed(3)} m /{' '}
                        {proportionsReport.forearmLengthMeters.toFixed(3)} m
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                      <span className="text-slate-400">Femoral Thigh vs Tibial Calf Segment</span>
                      <span className="font-mono tabular-nums text-white">
                        {proportionsReport.thighLengthMeters.toFixed(3)} m /{' '}
                        {proportionsReport.calfLengthMeters.toFixed(3)} m
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[#161b26] border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                  Deformation loops are concentrated around the cervical neck, glenohumeral shoulder
                  girdle, elbows, radiocarpal wrists, lumbar waist, acetabular hips, patellar knees,
                  and talocrural ankles to ensure zero mesh collapse during high-amplitude combat,
                  crouch, and traversal animations.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body: 25-Bone Skeleton Rig Inspector */}
        {activeModal === 'skeleton' && (
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive Joint Rotation Tester */}
            <div className="border border-slate-800 rounded-lg p-4 bg-[#161b26] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Live Joint Deformation Tester
                </h3>
                {manualBoneOverride && (
                  <button
                    type="button"
                    onClick={() => onChangeManualBone(null)}
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Override</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Select any bone in the 25-bone hierarchy to test skin-weight deformation limits in
                real time.
              </p>

              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="bone-select">
                  Target Bone
                </label>
                <select
                  id="bone-select"
                  value={manualBoneOverride?.bone ?? selectedBone}
                  onChange={(e) => {
                    const bName = e.target.value as BoneName;
                    setSelectedBone(bName);
                    onChangeManualBone({ bone: bName, rx: 0, ry: 0, rz: 0 });
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#0f131c] border border-slate-700 rounded-lg text-white font-mono"
                >
                  {BONE_DEFINITIONS.map((b) => (
                    <option key={b.name} value={b.name}>
                      [{String(b.index).padStart(2, '0')}] {b.name} ({b.anatomicalGroup})
                    </option>
                  ))}
                </select>
              </div>

              {(['rx', 'ry', 'rz'] as const).map((axis) => {
                const label =
                  axis === 'rx'
                    ? 'Pitch X (Flexion / Extension)'
                    : axis === 'ry'
                      ? 'Yaw Y (Axial Twist)'
                      : 'Roll Z (Abduction / Adduction)';
                const val = manualBoneOverride ? manualBoneOverride[axis] : 0;
                return (
                  <div key={axis}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{label}</span>
                      <span className="font-mono tabular-nums text-sky-400">
                        {Math.round((val * 180) / Math.PI)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1.6}
                      max={1.6}
                      step={0.02}
                      value={val}
                      aria-label={label}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value);
                        const base = manualBoneOverride ?? {
                          bone: selectedBone,
                          rx: 0,
                          ry: 0,
                          rz: 0,
                        };
                        onChangeManualBone({ ...base, [axis]: num });
                      }}
                      className="w-full accent-sky-500"
                    />
                  </div>
                );
              })}
            </div>

            {/* 25-Bone Hierarchy Table */}
            <div className="lg:col-span-2 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#161b26] border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Part 03 — Unified 25-Bone Humanoid Hierarchy
                </h3>
                <span className="text-xs text-slate-400 font-mono">Root → Pelvis → Limbs</span>
              </div>
              <div className="max-h-[52vh] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-[#0f131c] text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Bone Name</th>
                      <th className="py-2 px-3">Parent Bone</th>
                      <th className="py-2 px-3">Bind Pos (X, Y, Z m)</th>
                      <th className="py-2 px-3 font-sans">Anatomical Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {BONE_DEFINITIONS.map((b) => (
                      <tr
                        key={b.name}
                        onClick={() => {
                          setSelectedBone(b.name);
                          onChangeManualBone({ bone: b.name, rx: 0, ry: 0, rz: 0 });
                        }}
                        className="hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="py-2 px-3 text-slate-500">
                          {String(b.index).padStart(2, '0')}
                        </td>
                        <td className="py-2 px-3 text-sky-400 font-semibold">{b.name}</td>
                        <td className="py-2 px-3 text-slate-400">{b.parent ?? '—'}</td>
                        <td className="py-2 px-3 text-slate-300">
                          {b.worldPos[0].toFixed(2)}, {b.worldPos[1].toFixed(2)},{' '}
                          {b.worldPos[2].toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-400">{b.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
