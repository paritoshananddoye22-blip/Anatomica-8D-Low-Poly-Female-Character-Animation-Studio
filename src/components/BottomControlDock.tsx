import { useState } from 'react';
import {
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Compass,
  Sliders,
  Eye,
  Download,
} from 'lucide-react';
import {
  ANIMATION_CLIP_BY_ID,
  ANIMATION_PART_CATEGORIES,
  AnimationPartId,
  DirectionId,
  EIGHT_DIRECTIONS,
  getClipsByPart,
} from '../character/animationCatalog';
import { CHARACTER_COLOR_SCHEMES } from '../character/femaleAnatomyMesh';
import { CameraPresetId, StudioViewportState } from './ThreeCharacterCanvas';

interface BottomControlDockProps {
  state: StudioViewportState;
  activePartId: AnimationPartId;
  telemetry: { timeSec: number; durationSec: number; activeDir: DirectionId };
  totalTriangles: number;
  onSelectPart: (partId: AnimationPartId) => void;
  onSelectClip: (clipId: string) => void;
  onSelectDirection: (dirId: DirectionId) => void;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: number) => void;
  onScrub: (normTime: number | null) => void;
  onToggleRootMotion: () => void;
  onToggleWireframe: () => void;
  onToggleSkeleton: () => void;
  onToggleProportionGuide: () => void;
  onSelectColorScheme: (schemeId: string) => void;
  onSelectCameraPreset: (preset: CameraPresetId) => void;
  onToggleBlendMode: (enabled: boolean) => void;
  onChangeBlendVector: (vec: [number, number]) => void;
  onChangeGaitTier: (tier: StudioViewportState['gaitTier']) => void;
  onExportGltf: (mode: 'active' | 'locomotion_pack') => void;
}

type DockTab = 'deck' | 'blend' | 'display';

export function BottomControlDock({
  state,
  activePartId,
  telemetry,
  totalTriangles,
  onSelectPart,
  onSelectClip,
  onSelectDirection,
  onTogglePlay,
  onChangeSpeed,
  onScrub,
  onToggleRootMotion,
  onToggleWireframe,
  onToggleSkeleton,
  onToggleProportionGuide,
  onSelectColorScheme,
  onSelectCameraPreset,
  onToggleBlendMode,
  onChangeBlendVector,
  onChangeGaitTier,
  onExportGltf,
}: BottomControlDockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('deck');

  const partClips = getClipsByPart(activePartId);
  const currentClip = ANIMATION_CLIP_BY_ID[state.activeClipId] ?? partClips[0];
  const currentDir = currentClip?.direction ?? telemetry.activeDir;

  const progressRatio =
    state.scrubNormalizedTime !== null
      ? state.scrubNormalizedTime
      : telemetry.durationSec > 0
        ? Math.min(1, Math.max(0, telemetry.timeSec / telemetry.durationSec))
        : 0;

  return (
    <div
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'min(940px, 94vw)',
      }}
      className="fixed z-30 w-full pointer-events-auto transition-transform duration-200"
    >
      {/* Top Collapse / Expand Tab & Unboxed Telemetry Bar */}
      <div className="flex items-center justify-between px-4 mb-1.5">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-[#11151e] border border-slate-800 text-xs text-slate-300 font-mono tabular-nums">
          <span className="text-sky-400 font-semibold">{currentClip?.id}</span>
          <span aria-hidden="true">·</span>
          <span>Dir {currentDir}</span>
          <span aria-hidden="true">·</span>
          <span>{totalTriangles} / 999 Tris</span>
          <span aria-hidden="true">·</span>
          <span>25 Bones</span>
          <span aria-hidden="true">·</span>
          <span>7.30 Heads</span>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#11151e] hover:bg-[#181e2b] text-slate-200 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Container */}
      {!collapsed && (
        <div className="bg-[#11151e] border border-slate-800 rounded-xl p-4 shadow-2xl space-y-3">
          {/* Top Row: Segmented Mode Tabs + Quick 8-Direction Compass Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-[#0b0d12] p-1 rounded-lg border border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('deck');
                  onToggleBlendMode(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'deck'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>25-Part Animation Deck</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('blend');
                  onToggleBlendMode(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'blend'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>8-Way Blend & WASD</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('display')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'display'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Camera, Rig & Mesh</span>
              </button>
            </div>

            {/* Universal Eight-Direction Selector Strip (D01–D08) */}
            <div
              role="group"
              aria-label="Eight-Directional Compass Selector"
              className="flex items-center gap-1 bg-[#0b0d12] p-1 rounded-lg border border-slate-800/80 overflow-x-auto"
            >
              {EIGHT_DIRECTIONS.map((dir) => {
                const isActive = currentDir === dir.id;
                return (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => onSelectDirection(dir.id)}
                    title={`${dir.id}: ${dir.label} (${dir.angleDeg}°)`}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {dir.id} {dir.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: 25-PART ANIMATION DECK */}
          {activeTab === 'deck' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Part Category Dropdown */}
                <div className="md:col-span-5">
                  <label htmlFor="part-category-select" className="sr-only">
                    Animation System Category
                  </label>
                  <select
                    id="part-category-select"
                    aria-label="Animation System Category"
                    value={activePartId}
                    onChange={(e) => onSelectPart(e.target.value as AnimationPartId)}
                    className="w-full px-3 py-2 text-xs bg-[#161b26] border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-sky-500"
                  >
                    {ANIMATION_PART_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.shortTitle} — {cat.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clip Selector Dropdown */}
                <div className="md:col-span-5">
                  <label htmlFor="clip-select" className="sr-only">
                    Active Animation Clip
                  </label>
                  <select
                    id="clip-select"
                    aria-label="Active Animation Clip"
                    value={state.activeClipId}
                    onChange={(e) => onSelectClip(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#161b26] border border-slate-700 rounded-lg text-sky-300 font-mono focus:outline-none focus:border-sky-500"
                  >
                    {partClips.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.duration.toFixed(2)}s)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Root Motion vs In-Place Toggle */}
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onToggleRootMotion}
                    className={`w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      state.rootMotion
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-[#161b26] border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {state.rootMotion ? 'Root Motion' : 'In-Place'}
                  </button>
                </div>
              </div>

              {/* Quick Action Presets for Roll, Slide, Crouch Run, Jump & Transitions (Supports D01–D08) */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap shrink-0 mr-1">
                  Quick Presets:
                </span>
                {(
                  [
                    [`ROLL_${currentDir}`, 'Roll (8D)'],
                    [`ROLL_TO_IDLE_${currentDir}`, 'Roll → Idle'],
                    [`ROLL_TO_RUN_${currentDir}`, 'Roll → Run'],
                    [`SLIDE_${currentDir}`, 'Slide (8D)'],
                    [`SLIDE_TO_RUN_${currentDir}`, 'Slide → Run'],
                    [`CRUN_${currentDir}`, 'Crouch Run'],
                    [`CRW_${currentDir}`, 'Crouch Walk'],
                    [`CRW_IDLE_${currentDir}`, 'Crouch Idle'],
                    [`CRW_TO_STAND_${currentDir}`, 'Crouch → Stand'],
                    [`CRUN_TO_STAND_${currentDir}`, 'Crouch-Run → Stand'],
                    [`JUMP_${currentDir}`, 'Jump (6-Phase)'],
                    [`JUMP_RUN_${currentDir}`, 'Jump While Running'],
                    [`TR_RUN_JUMP_${currentDir}`, 'Run → Jump'],
                    [`TR_JUMP_RUN_${currentDir}`, 'Jump → Run Land'],
                  ] as const
                ).map(([presetClipId, label]) => {
                  const resolvedId = ANIMATION_CLIP_BY_ID[presetClipId]
                    ? presetClipId
                    : presetClipId.replace(/_D0[1-8]$/, '_D01');
                  const isCurrent = state.activeClipId === resolvedId;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onSelectClip(resolvedId)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                        isCurrent
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                          : 'bg-[#0b0d12] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Playback Transport & Scrubber Row */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={state.isPlaying ? 'Pause animation' : 'Play animation'}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {state.isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <div className="flex-1 flex items-center gap-3 min-w-[180px]">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.005}
                    value={progressRatio}
                    aria-label="Animation Timeline Scrubber"
                    onChange={(e) => onScrub(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
                    {telemetry.timeSec.toFixed(2)}s / {telemetry.durationSec.toFixed(2)}s
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-[#0b0d12] p-1 rounded-lg border border-slate-800">
                  {[0.25, 0.5, 1.0, 1.5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onChangeSpeed(spd)}
                      className={`px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                        state.playbackSpeed === spd
                          ? 'bg-slate-700 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 8-WAY CONTINUOUS BLEND SPACE & PLAYABLE CONTROLLER */}
          {activeTab === 'blend' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 space-y-2">
                <div className="text-xs font-medium text-white">
                  Locomotion Gait Tier (Blends Adjacent D01–D08 Vectors)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['WLK', 'Walk'],
                      ['FWLK', 'Fast Walk'],
                      ['RUN', 'Run'],
                      ['SPR', 'Sprint'],
                      ['CRW', 'Crouch Walk'],
                      ['CRUN', 'Crouch Run'],
                      ['STL', 'Stealth'],
                    ] as const
                  ).map(([tierId, label]) => (
                    <button
                      key={tierId}
                      type="button"
                      onClick={() => onChangeGaitTier(tierId)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        state.gaitTier === tierId
                          ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                          : 'bg-[#161b26] text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  Hold <span className="font-mono text-slate-200">W A S D</span> or{' '}
                  <span className="font-mono text-slate-200">Arrow Keys</span> (+{' '}
                  <span className="font-mono text-slate-200">Shift</span> to sprint) or adjust the
                  X/Z directional sliders.
                </p>
              </div>

              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#161b26] p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Lateral Axis (Left D07 ↔ Right D03)</span>
                    <span className="font-mono tabular-nums text-sky-400">
                      {state.blendVector[0].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={state.blendVector[0]}
                    aria-label="Blend Lateral Axis"
                    onChange={(e) =>
                      onChangeBlendVector([parseFloat(e.target.value), state.blendVector[1]])
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Sagittal Axis (Bwd D05 ↔ Fwd D01)</span>
                    <span className="font-mono tabular-nums text-sky-400">
                      {state.blendVector[1].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={state.blendVector[1]}
                    aria-label="Blend Sagittal Axis"
                    onChange={(e) =>
                      onChangeBlendVector([state.blendVector[0], parseFloat(e.target.value)])
                    }
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAMERA, RIG & MESH DISPLAY */}
          {activeTab === 'display' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Camera Angle Presets */}
              <div className="flex items-center gap-1 bg-[#0b0d12] p-1 rounded-lg border border-slate-800 overflow-x-auto">
                {(
                  [
                    ['three_quarter', '3/4 View'],
                    ['front', 'Front'],
                    ['side', 'Side'],
                    ['back', 'Back'],
                    ['head_closeup', 'Head'],
                    ['top_compass', 'Top 8D'],
                  ] as const
                ).map(([presetId, label]) => (
                  <button
                    key={presetId}
                    type="button"
                    onClick={() => onSelectCameraPreset(presetId)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      state.cameraPreset === presetId
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Surface Finish / Palette Selector */}
              <select
                aria-label="Character Surface Palette"
                value={state.colorSchemeId}
                onChange={(e) => onSelectColorScheme(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#161b26] border border-slate-700 rounded-lg text-slate-200"
              >
                {CHARACTER_COLOR_SCHEMES.map((s) => (
                  <option key={s.id} value={s.id}>
                    Finish: {s.name}
                  </option>
                ))}
              </select>

              {/* Wireframe, Skeleton & Stadiometer Toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleWireframe}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    state.showWireframe
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                      : 'bg-[#161b26] border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  Wireframe ({totalTriangles} Tris)
                </button>
                <button
                  type="button"
                  onClick={onToggleSkeleton}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    state.showSkeleton
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                      : 'bg-[#161b26] border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  25-Bone Rig
                </button>
                <button
                  type="button"
                  onClick={onToggleProportionGuide}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    state.showProportionGuide
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                      : 'bg-[#161b26] border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  7.3-Head Scale
                </button>
                <button
                  type="button"
                  onClick={() => onExportGltf('locomotion_pack')}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>8D GLTF Pack</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
