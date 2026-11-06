import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ANIMATION_CLIP_BY_ID,
  AnimationPartId,
  DIRECTION_BY_ID,
  DirectionId,
  getClipsByPart,
} from './character/animationCatalog';
import { buildFemaleAnatomyGeometry } from './character/femaleAnatomyMesh';
import { getAnatomicalProportionsReport } from './character/skeletonSpec';
import { BottomControlDock } from './components/BottomControlDock';
import { ActiveModalType, InspectionModals } from './components/InspectionModals';
import {
  CameraPresetId,
  StudioViewportState,
  ThreeCharacterCanvas,
} from './components/ThreeCharacterCanvas';

export default function App() {
  const meshReport = useMemo(() => buildFemaleAnatomyGeometry(), []);
  const proportionsReport = useMemo(() => getAnatomicalProportionsReport(), []);

  const [activePartId, setActivePartId] = useState<AnimationPartId>('PART_05_WALK');
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);

  const [viewportState, setViewportState] = useState<StudioViewportState>({
    activeClipId: 'WLK_D01',
    isPlaying: true,
    playbackSpeed: 1.0,
    scrubNormalizedTime: null,
    rootMotion: false,
    showWireframe: false,
    showSkeleton: false,
    showProportionGuide: true,
    colorSchemeId: 'athletic_obsidian',
    cameraPreset: 'three_quarter',
    cameraPresetTrigger: 0,
    blendModeActive: false,
    blendVector: [0, 1],
    gaitTier: 'WLK',
    manualBoneOverride: null,
  });

  const [telemetry, setTelemetry] = useState<{
    timeSec: number;
    durationSec: number;
    activeDir: DirectionId;
  }>({
    timeSec: 0,
    durationSec: 1.1,
    activeDir: 'D01',
  });

  const exportFnRef = useRef<((mode: 'active' | 'locomotion_pack') => void) | null>(null);

  const handleSelectPart = useCallback((partId: AnimationPartId) => {
    setActivePartId(partId);
    const clips = getClipsByPart(partId);
    if (clips.length > 0) {
      setViewportState((prev) => ({
        ...prev,
        activeClipId: clips[0].id,
        scrubNormalizedTime: null,
        isPlaying: true,
        blendModeActive: false,
      }));
    }
  }, []);

  const handleSelectClip = useCallback((clipId: string) => {
    const meta = ANIMATION_CLIP_BY_ID[clipId];
    if (meta) {
      setActivePartId(meta.partId);
    }
    setViewportState((prev) => ({
      ...prev,
      activeClipId: clipId,
      scrubNormalizedTime: null,
      isPlaying: true,
      blendModeActive: false,
      manualBoneOverride: null,
    }));
  }, []);

  const handleSelectDirection = useCallback(
    (dirId: DirectionId) => {
      setViewportState((prev) => {
        if (prev.blendModeActive) {
          const dSpec = DIRECTION_BY_ID[dirId];
          // Map direction vector into blend space
          return {
            ...prev,
            blendVector: [-dSpec.vectorXZ[0], dSpec.vectorXZ[1]],
          };
        }

        // Find matching directional variant in the current sub-group or part
        const currentMeta = ANIMATION_CLIP_BY_ID[prev.activeClipId];
        if (currentMeta) {
          const basePrefix = prev.activeClipId.replace(/_D0[1-8]$/, '');
          const candidateId = `${basePrefix}_${dirId}`;
          if (ANIMATION_CLIP_BY_ID[candidateId]) {
            return {
              ...prev,
              activeClipId: candidateId,
              scrubNormalizedTime: null,
              isPlaying: true,
            };
          }
          // Otherwise find first clip in activePartId with that direction
          const partDirClip = getClipsByPart(activePartId).find((c) => c.direction === dirId);
          if (partDirClip) {
            return {
              ...prev,
              activeClipId: partDirClip.id,
              scrubNormalizedTime: null,
              isPlaying: true,
            };
          }
        }
        return {
          ...prev,
          activeClipId: `WLK_${dirId}`,
          scrubNormalizedTime: null,
          isPlaying: true,
        };
      });
    },
    [activePartId]
  );

  const handleExportGltf = useCallback((mode: 'active' | 'locomotion_pack') => {
    if (exportFnRef.current) {
      exportFnRef.current(mode);
    }
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b0d12] text-slate-100 overflow-hidden select-none">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="relative z-50 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0b0d12] border-b border-slate-800/90">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveModal(null);
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Anatomica 8D
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Studio Inspector Navigation"
          className="flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-300 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() =>
              setActiveModal((prev) => (prev === 'library' ? null : 'library'))
            }
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Animation Library
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveModal((prev) => (prev === 'anatomy' ? null : 'anatomy'))
            }
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Anatomy &amp; Budget
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveModal((prev) => (prev === 'skeleton' ? null : 'skeleton'))
            }
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            25-Bone Rig
          </button>
          <button
            type="button"
            onClick={() =>
              setViewportState((prev) => ({
                ...prev,
                showWireframe: !prev.showWireframe,
              }))
            }
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {viewportState.showWireframe ? 'Hide Wireframe' : 'Wireframe Overlay'}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => handleExportGltf('active')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Export GLTF (.gltf)
          </button>
        </div>
      </header>

      {/* Main 100% Unobstructed 3D Viewport */}
      <main
        className="flex-1 relative w-full h-full min-h-0"
        data-active-clip={viewportState.activeClipId}
        data-triangle-count={meshReport.totalTriangles}
        data-active-direction={telemetry.activeDir}
      >
        <ThreeCharacterCanvas
          state={viewportState}
          onSelectDirection={handleSelectDirection}
          onExportReady={(fn) => {
            exportFnRef.current = fn;
          }}
          onTelemetryUpdate={(timeSec, durationSec, activeDir) => {
            setTelemetry({ timeSec, durationSec, activeDir });
          }}
        />

        {/* Unified Collapsible Bottom Dock */}
        <BottomControlDock
          state={viewportState}
          activePartId={activePartId}
          telemetry={telemetry}
          totalTriangles={meshReport.totalTriangles}
          onSelectPart={handleSelectPart}
          onSelectClip={handleSelectClip}
          onSelectDirection={handleSelectDirection}
          onTogglePlay={() =>
            setViewportState((prev) => ({
              ...prev,
              isPlaying: !prev.isPlaying,
              scrubNormalizedTime: null,
            }))
          }
          onChangeSpeed={(speed) =>
            setViewportState((prev) => ({ ...prev, playbackSpeed: speed }))
          }
          onScrub={(normTime) =>
            setViewportState((prev) => ({
              ...prev,
              isPlaying: false,
              scrubNormalizedTime: normTime,
            }))
          }
          onToggleRootMotion={() =>
            setViewportState((prev) => ({ ...prev, rootMotion: !prev.rootMotion }))
          }
          onToggleWireframe={() =>
            setViewportState((prev) => ({ ...prev, showWireframe: !prev.showWireframe }))
          }
          onToggleSkeleton={() =>
            setViewportState((prev) => ({ ...prev, showSkeleton: !prev.showSkeleton }))
          }
          onToggleProportionGuide={() =>
            setViewportState((prev) => ({
              ...prev,
              showProportionGuide: !prev.showProportionGuide,
            }))
          }
          onSelectColorScheme={(schemeId) =>
            setViewportState((prev) => ({ ...prev, colorSchemeId: schemeId }))
          }
          onSelectCameraPreset={(preset: CameraPresetId) =>
            setViewportState((prev) => ({
              ...prev,
              cameraPreset: preset,
              cameraPresetTrigger: prev.cameraPresetTrigger + 1,
            }))
          }
          onToggleBlendMode={(enabled) =>
            setViewportState((prev) => ({
              ...prev,
              blendModeActive: enabled,
              scrubNormalizedTime: null,
              isPlaying: true,
            }))
          }
          onChangeBlendVector={(vec) =>
            setViewportState((prev) => ({ ...prev, blendVector: vec }))
          }
          onChangeGaitTier={(tier) =>
            setViewportState((prev) => ({ ...prev, gaitTier: tier }))
          }
          onExportGltf={handleExportGltf}
        />

        {/* Inspection Modals (Library Browser, Anatomy & Budget Audit, 25-Bone Skeleton Inspector) */}
        <InspectionModals
          activeModal={activeModal}
          onClose={() => setActiveModal(null)}
          activeClipId={viewportState.activeClipId}
          onSelectClip={handleSelectClip}
          meshReport={meshReport}
          proportionsReport={proportionsReport}
          manualBoneOverride={viewportState.manualBoneOverride}
          onChangeManualBone={(override) =>
            setViewportState((prev) => ({ ...prev, manualBoneOverride: override }))
          }
          onExportGltf={handleExportGltf}
        />
      </main>
    </div>
  );
}
