import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Cable,
  Sliders,
  Layers,
  FileDown,
} from 'lucide-react';
import {
  INITIAL_TELECOM_SITE,
  syncSitePortStatuses,
} from './data/initialSiteData';
import {
  TelecomSite,
  SelectedEntityRef,
  FiberConnection,
  EndToEndCrossConnect,
  LibraryTemplate,
  Rack,
  Equipment,
  Port,
} from './types/telecom';
import {
  buildOpticalBudgetForFibers,
  traceEndToEndChainFromPortOrFiber,
} from './utils/opticalCalculations';
import {
  ThreeSceneViewport,
  CameraPreset,
} from './components/ThreeSceneViewport';
import { Interactive2DPlanModal } from './components/Interactive2DPlanModal';
import { PatchingSimulatorDrawer } from './components/PatchingSimulatorDrawer';
import { LibraryInventoryModal } from './components/LibraryInventoryModal';
import { EntityEditorDrawer } from './components/EntityEditorDrawer';
import {
  downloadPdfEngineeringReport,
  downloadSvgEngineeringDiagram,
} from './utils/exportDocumentation';

type ActiveOverlay = 'none' | 'plan_2d' | 'patching' | 'library' | 'editor' | 'export_menu';

export default function App() {
  const [site, setSite] = useState<TelecomSite>(() =>
    syncSitePortStatuses(INITIAL_TELECOM_SITE)
  );

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityRef | null>(
    null
  );

  const [selectedCrossConnectId, setSelectedCrossConnectId] =
    useState<string>('xc-circuit-01');

  const [customTracedFiberIds, setCustomTracedFiberIds] = useState<
    string[] | null
  >(null);

  const [cameraPreset, setCameraPreset] =
    useState<CameraPreset>('site_overview');
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [pulseSpeed, setPulseSpeed] = useState<number>(1.2);
  const [showPathways, setShowPathways] = useState<boolean>(true);
  const [showLabels3D, setShowLabels3D] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('none');

  const [isPatchingMode, setIsPatchingMode] = useState<boolean>(false);
  const [patchingDraftSource, setPatchingDraftSource] = useState<{
    equipmentId: string;
    portId: string;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const highlightedFiberIds = useMemo(() => {
    if (customTracedFiberIds && customTracedFiberIds.length > 0) {
      return customTracedFiberIds;
    }
    const xc = site.crossConnects.find((c) => c.id === selectedCrossConnectId);
    return xc ? xc.fiberIds : [];
  }, [site.crossConnects, selectedCrossConnectId, customTracedFiberIds]);

  const activeOpticalBudget = useMemo(() => {
    const xc = site.crossConnects.find((c) => c.id === selectedCrossConnectId);
    const title = customTracedFiberIds
      ? 'Parcours Optique Monomode OS2 Tracé Dynamiquement'
      : xc
      ? `${xc.reference} — ${xc.name}`
      : 'Liaison Cross-Connect Monomode OS2';
    return buildOpticalBudgetForFibers(
      site,
      highlightedFiberIds,
      title,
      xc?.reference
    );
  }, [site, highlightedFiberIds, selectedCrossConnectId, customTracedFiberIds]);

  const handleSelectEntity = (entity: SelectedEntityRef | null) => {
    setSelectedEntity(entity);
    if (!entity) return;

    if (entity.kind === 'fiber') {
      const chain = traceEndToEndChainFromPortOrFiber(site, entity.id);
      if (chain.length > 0) {
        const matchingXc = site.crossConnects.find((xc) =>
          xc.fiberIds.includes(entity.id)
        );
        if (matchingXc) {
          setCustomTracedFiberIds(null);
          setSelectedCrossConnectId(matchingXc.id);
        } else {
          setCustomTracedFiberIds(chain);
        }
      }
    }

    if (activeOverlay === 'none') {
      setActiveOverlay('editor');
    }
  };

  // Direct 3D port click handler for interactive cabling simulation
  const handlePortClickForPatching = (equipmentId: string, portId: string) => {
    if (!patchingDraftSource) {
      setPatchingDraftSource({ equipmentId, portId });
      setActiveOverlay('patching');
      return;
    }

    if (patchingDraftSource.portId === portId) {
      setPatchingDraftSource(null);
      return;
    }

    const srcEq = site.equipments.find(
      (e) => e.id === patchingDraftSource.equipmentId
    );
    const dstEq = site.equipments.find((e) => e.id === equipmentId);
    if (!srcEq || !dstEq) return;

    const srcRack = site.racks.find((r) => r.id === srcEq.rackId);
    const dstRack = site.racks.find((r) => r.id === dstEq.rackId);
    const srcRoom = site.rooms.find((rm) => rm.id === srcRack?.roomId);
    const dstRoom = site.rooms.find((rm) => rm.id === dstRack?.roomId);

    const srcPort = srcEq.ports.find((p) => p.id === patchingDraftSource.portId);
    const dstPort = dstEq.ports.find((p) => p.id === portId);
    if (!srcPort || !dstPort) return;

    const isSameRoom = srcRoom?.id === dstRoom?.id;
    const isMmr = srcRoom?.type === 'mmr' && dstRoom?.type === 'mmr';
    const codeNum = String(site.fibers.length + 1).padStart(3, '0');

    // If same room -> Jarretière Optique (or Cross-Connect MMR if inside MMR); if different rooms -> Câble Rocade deployed by Hébergeur
    const kind: FiberConnection['kind'] = !isSameRoom
      ? 'trunk_cable'
      : isMmr && srcRack?.id !== dstRack?.id
      ? 'cross_connect_jumper'
      : 'patch_cord';

    const newFiber: FiberConnection = {
      id: `fib-3d-${Date.now()}`,
      name:
        kind === 'trunk_cable'
          ? `Câble Fibre Rocade 24FO (${srcRack?.code} → ${dstRack?.code})`
          : kind === 'cross_connect_jumper'
          ? `Jarretière Cross-Connect MMR Bi-Fibre (${srcEq.code} ${srcPort.label} ↔ ${dstEq.code} ${dstPort.label})`
          : `Jarretière Optique Intra-Salle Bi-Fibre (${srcEq.code} ${srcPort.label} → ${dstEq.code} ${dstPort.label})`,
      code:
        kind === 'trunk_cable'
          ? `CABLE-24FO-${codeNum}`
          : kind === 'cross_connect_jumper'
          ? `JAR-XC-${codeNum}`
          : `JAR-OS2-${codeNum}`,
      kind,
      sourceEquipmentId: srcEq.id,
      sourcePortId: srcPort.id,
      targetEquipmentId: dstEq.id,
      targetPortId: dstPort.id,
      fiberMode: 'OS2',
      polarity: 'Bi-Fibre (2FO Duplex)',
      trunkCapacity: kind === 'trunk_cable' ? '24FO' : undefined,
      activeStrandsUsed:
        kind === 'trunk_cable' ? 'Brins FO #01 & FO #02 sur 24FO' : undefined,
      responsibility:
        kind === 'trunk_cable' || isMmr
          ? 'Hébergeur Tiers (Accès Exclusif MMR)'
          : srcRoom?.type === 'operator'
          ? 'Opérateur Télécom (Baie SFR)'
          : 'Client Final (Baie Client)',
      connectorA: srcPort.connector,
      connectorB: dstPort.connector,
      JacketColorHex:
        kind === 'trunk_cable'
          ? '#0284c7'
          : kind === 'cross_connect_jumper'
          ? '#f59e0b'
          : '#facc15',
      lengthMeters:
        kind === 'trunk_cable' ? 42.0 : srcEq.rackId === dstEq.rackId ? 2.5 : 6.0,
      pathwayIds: [kind === 'trunk_cable' ? 'path-main-spine' : 'path-mmr-loop'],
      attenuationDb: kind === 'trunk_cable' ? 0.41 : 0.28,
      spliceCount: kind === 'trunk_cable' ? 2 : 0,
      installedDate: new Date().toISOString().slice(0, 10),
      customAttributes: [
        {
          id: `attr-${Date.now()}`,
          key: 'Mode de création',
          value: 'Brassage interactif direct 3D (100% OS2 Monomode)',
        },
      ],
    };

    handleAddFiber(newFiber, selectedCrossConnectId);
    setPatchingDraftSource(null);
  };

  const handleAddFiber = (
    newFiber: FiberConnection,
    attachToCrossConnectId?: string
  ) => {
    setSite((prev) => {
      const updatedFibers = [...prev.fibers, newFiber];
      const updatedXcs = attachToCrossConnectId
        ? prev.crossConnects.map((xc) =>
            xc.id === attachToCrossConnectId
              ? { ...xc, fiberIds: [...xc.fiberIds, newFiber.id] }
              : xc
          )
        : prev.crossConnects;

      return syncSitePortStatuses({
        ...prev,
        fibers: updatedFibers,
        crossConnects: updatedXcs,
      });
    });

    if (attachToCrossConnectId) {
      setCustomTracedFiberIds(null);
      setSelectedCrossConnectId(attachToCrossConnectId);
    } else {
      setCustomTracedFiberIds([newFiber.id]);
    }
  };

  const handleRemoveFiber = (fiberId: string) => {
    setSite((prev) => {
      const updatedFibers = prev.fibers.filter((f) => f.id !== fiberId);
      const updatedXcs = prev.crossConnects.map((xc) => ({
        ...xc,
        fiberIds: xc.fiberIds.filter((id) => id !== fiberId),
      }));
      return syncSitePortStatuses({
        ...prev,
        fibers: updatedFibers,
        crossConnects: updatedXcs,
      });
    });
  };

  const handleAddCrossConnect = (newXc: EndToEndCrossConnect) => {
    setSite((prev) => ({
      ...prev,
      crossConnects: [...prev.crossConnects, newXc],
    }));
  };

  const handleDeployEquipmentFromLibrary = (
    templateId: string,
    rackId: string,
    uPosition: number,
    customName: string,
    customCode: string
  ) => {
    setSite((prev) => {
      const tpl = prev.library.find((l) => l.id === templateId);
      if (!tpl || tpl.stockAvailable <= 0) return prev;

      const eqNum = String(prev.equipments.length + 1).padStart(2, '0');
      const eqCode =
        customCode.trim() ||
        `${tpl.category === 'patch_panel' ? 'TIROIR' : 'EQ'}-${eqNum}`;
      const eqId = `eq-deployed-${Date.now()}`;

      const ports: Port[] = [];
      for (let i = 1; i <= tpl.defaultPortCount; i++) {
        const pStr = String(i).padStart(2, '0');
        ports.push({
          id: `${eqCode}-P${pStr}`,
          number: i,
          label: `Port ${pStr}`,
          connector: tpl.defaultConnector,
          status: 'free',
          role: tpl.defaultRole,
          wavelengthNm: 1310,
          customAttributes: [
            {
              id: `${eqId}-p${i}-a1`,
              key: 'Standard Optique',
              value: 'OS2 Monomode 9/125µm (1310/1550nm)',
            },
          ],
        });
      }

      const newEquipment: Equipment = {
        id: eqId,
        rackId,
        name: customName.trim() || tpl.name,
        code: eqCode,
        category: tpl.category,
        manufacturer: tpl.manufacturer,
        model: tpl.model,
        uPosition,
        uHeight: tpl.uHeight,
        trunkCapacity: tpl.trunkCapacity,
        colorHex: tpl.colorHex,
        ports,
        customAttributes: [
          {
            id: `${eqId}-attr1`,
            key: 'Date Déploiement',
            value: new Date().toLocaleDateString('fr-FR'),
          },
          {
            id: `${eqId}-attr2`,
            key: 'Fibre Supportée',
            value: '100% Monomode OS2',
          },
        ],
      };

      return {
        ...prev,
        equipments: [...prev.equipments, newEquipment],
        library: prev.library.map((l) =>
          l.id === templateId
            ? { ...l, stockAvailable: Math.max(0, l.stockAvailable - 1) }
            : l
        ),
      };
    });
  };

  const handleAddLibraryTemplate = (template: LibraryTemplate) => {
    setSite((prev) => ({
      ...prev,
      library: [template, ...prev.library],
    }));
  };

  const handleRestockTemplate = (templateId: string, delta: number) => {
    setSite((prev) => ({
      ...prev,
      library: prev.library.map((l) =>
        l.id === templateId
          ? { ...l, stockAvailable: l.stockAvailable + delta }
          : l
      ),
    }));
  };

  const handleAddRack = (newRack: Rack) => {
    setSite((prev) => ({
      ...prev,
      racks: [...prev.racks, newRack],
    }));
  };

  return (
    <div className="relative w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* ===================================================================== */}
      {/* TOP BAR CONTRACT: Strictly 3 Zones separated by gap-8                 */}
      {/* ===================================================================== */}
      <header className="h-14 flex items-center justify-between gap-8 px-6 bg-slate-950 border-b border-slate-800 z-30 shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveOverlay('none');
            setCameraPreset('site_overview');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          OptiCross 3D
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#vue-3d"
            onClick={(e) => {
              e.preventDefault();
              setActiveOverlay('none');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeOverlay === 'none'
                ? 'border-amber-400 text-white'
                : 'border-transparent'
            }`}
          >
            Vue 3D Spatiale
          </a>
          <a
            href="#plan-2d"
            onClick={(e) => {
              e.preventDefault();
              setActiveOverlay(activeOverlay === 'plan_2d' ? 'none' : 'plan_2d');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeOverlay === 'plan_2d'
                ? 'border-amber-400 text-white'
                : 'border-transparent'
            }`}
          >
            Plan 2D &amp; Schémas
          </a>
          <a
            href="#brassage"
            onClick={(e) => {
              e.preventDefault();
              setActiveOverlay(
                activeOverlay === 'patching' ? 'none' : 'patching'
              );
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeOverlay === 'patching'
                ? 'border-amber-400 text-white'
                : 'border-transparent'
            }`}
          >
            Brassage &amp; Câblage
          </a>
          <a
            href="#bibliotheque"
            onClick={(e) => {
              e.preventDefault();
              setActiveOverlay(activeOverlay === 'library' ? 'none' : 'library');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeOverlay === 'library'
                ? 'border-amber-400 text-white'
                : 'border-transparent'
            }`}
          >
            Bibliothèque &amp; Stocks
          </a>
          <a
            href="#editeur"
            onClick={(e) => {
              e.preventDefault();
              setActiveOverlay(activeOverlay === 'editor' ? 'none' : 'editor');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeOverlay === 'editor'
                ? 'border-amber-400 text-white'
                : 'border-transparent'
            }`}
          >
            Éditeur &amp; Attributs
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="relative flex items-center shrink-0">
          <button
            onClick={() =>
              setActiveOverlay(
                activeOverlay === 'export_menu' ? 'none' : 'export_menu'
              )
            }
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Exporter PDF / SVG
          </button>

          {activeOverlay === 'export_menu' && (
            <div className="absolute right-0 top-11 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1">
              <button
                onClick={() => {
                  downloadPdfEngineeringReport(site, activeOpticalBudget);
                  setActiveOverlay('none');
                }}
                className="w-full text-left px-3 py-2.5 text-xs font-medium text-slate-100 hover:bg-slate-800 rounded-lg flex items-center justify-between"
              >
                <span>Dossier Technique Complet (.PDF)</span>
                <FileDown className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={() => {
                  downloadSvgEngineeringDiagram(site, activeOpticalBudget);
                  setActiveOverlay('none');
                }}
                className="w-full text-left px-3 py-2.5 text-xs font-medium text-slate-100 hover:bg-slate-800 rounded-lg flex items-center justify-between"
              >
                <span>Schéma Vectoriel Logique/2D (.SVG)</span>
                <Layers className="w-4 h-4 text-sky-400" />
              </button>
              <button
                onClick={() => setActiveOverlay('plan_2d')}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                Prévisualiser le schéma 2D avant export →
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN 3D SPATIAL VIEWPORT                                              */}
      {/* ===================================================================== */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <ThreeSceneViewport
          site={site}
          selectedEntity={selectedEntity}
          onSelectEntity={handleSelectEntity}
          highlightedFiberIds={highlightedFiberIds}
          cameraPreset={cameraPreset}
          explodedFactor={explodedFactor}
          pulseSpeed={pulseSpeed}
          showPathways={showPathways}
          showLabels3D={showLabels3D}
          patchingDraftSource={patchingDraftSource}
          onPortClickForPatching={handlePortClickForPatching}
          isPatchingMode={isPatchingMode}
        />

        {/* Top-Left Spec & Architecture Summary Card */}
        <div className="pointer-events-auto absolute top-4 left-6 z-20 bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 shadow-xl max-w-xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">
              Baie SFR (Câble 24FO)
            </span>
            <span aria-hidden="true">→</span>
            <span className="font-semibold text-amber-400">
              Salle MMR (Accès Exclusif Hébergeur · Cross-Connect)
            </span>
            <span aria-hidden="true">←</span>
            <span className="font-semibold text-emerald-400">
              Baie Client (Câble 12FO)
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
            <span className="text-amber-400 font-semibold">
              {activeOpticalBudget.title}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-slate-300">
              {activeOpticalBudget.totalLengthMeters} m (100% OS2)
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-amber-300">
              Perte -{activeOpticalBudget.totalAttenuationDb.toFixed(2)} dB
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-emerald-400">
              RX {activeOpticalBudget.rxPowerDbm.toFixed(2)} dBm
            </span>
          </div>

          {isPatchingMode && (
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-amber-300">
              <span>
                {patchingDraftSource
                  ? `Port Origine sélectionné (${patchingDraftSource.portId}) — Cliquez sur le Port Destination en 3D`
                  : 'Mode Brassage 3D Actif : Cliquez sur un port optique de départ dans la scène 3D'}
              </span>
              <button
                onClick={() => {
                  setIsPatchingMode(false);
                  setPatchingDraftSource(null);
                }}
                className="ml-3 text-slate-400 hover:text-white underline"
              >
                Quitter
              </button>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK                             */}
        {/* =================================================================== */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-6 transition-transform duration-200 ${
            dockCollapsed ? 'translate-y-[calc(100%-24px)]' : 'translate-y-0'
          }`}
        >
          <div className="pointer-events-auto w-full max-w-5xl">
            <div className="flex justify-center">
              <button
                onClick={() => setDockCollapsed(!dockCollapsed)}
                className="px-4 py-1 bg-slate-900 border border-b-0 border-slate-700 rounded-t-lg text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 shadow-lg"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Afficher le Dock de Contrôle 3D (Touche H)</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    <span>Masquer les contrôles (Touche H)</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3.5 shadow-2xl space-y-3">
              {/* Row 1: Camera View Presets & End-to-End Cross-Connect Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
                  {[
                    { id: 'site_overview', label: 'Vue Globale Site' },
                    { id: 'room_operator', label: 'Salle Opérateur (Baie SFR)' },
                    { id: 'room_mmr', label: 'Salle MMR (Hébergeur)' },
                    { id: 'mmr_closeup', label: 'Zoom Cross-Connect MMR' },
                    { id: 'room_client', label: 'Salle Client (Baie Client)' },
                  ].map((cam) => (
                    <button
                      key={cam.id}
                      onClick={() => setCameraPreset(cam.id as CameraPreset)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        cameraPreset === cam.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 max-w-full">
                  <label className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                    Scénario Monomode OS2 :
                  </label>
                  <select
                    value={selectedCrossConnectId}
                    onChange={(e) => {
                      setCustomTracedFiberIds(null);
                      setSelectedCrossConnectId(e.target.value);
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-amber-300 max-w-full truncate"
                  >
                    {site.crossConnects.map((xc) => (
                      <option key={xc.id} value={xc.id}>
                        {xc.reference} · {xc.polarity} — {xc.name.slice(0, 34)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Sliders & Action Toggles */}
              <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-300 whitespace-nowrap">
                      Vue Éclatée 3D :
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={explodedFactor}
                      onChange={(e) => setExplodedFactor(Number(e.target.value))}
                      className="w-24 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono tabular-nums text-slate-400 w-9">
                      {Math.round(explodedFactor * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-300 whitespace-nowrap">
                      Flux Optique :
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.1}
                      value={pulseSpeed}
                      onChange={(e) => setPulseSpeed(Number(e.target.value))}
                      className="w-24 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono tabular-nums text-slate-400 w-9">
                      {pulseSpeed.toFixed(1)}x
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowPathways(!showPathways)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      showPathways
                        ? 'bg-slate-800 text-amber-300 border-slate-700'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {showPathways ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    Chemins de Câblage
                  </button>

                  <button
                    onClick={() => setShowLabels3D(!showLabels3D)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      showLabels3D
                        ? 'bg-slate-800 text-sky-300 border-slate-700'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    Étiquettes 3D (24FO/12FO)
                  </button>

                  <button
                    onClick={() => {
                      setIsPatchingMode(!isPatchingMode);
                      if (!isPatchingMode) setActiveOverlay('patching');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isPatchingMode
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Cable className="w-3.5 h-3.5" />
                    Jarretière / Rocade
                  </button>

                  <button
                    onClick={() =>
                      setActiveOverlay(
                        activeOverlay === 'editor' ? 'none' : 'editor'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    Attributs
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* OVERLAY MODALS & DRAWERS                                            */}
        {/* =================================================================== */}
        {activeOverlay === 'plan_2d' && (
          <Interactive2DPlanModal
            site={site}
            budget={activeOpticalBudget}
            highlightedFiberIds={highlightedFiberIds}
            selectedCrossConnectId={selectedCrossConnectId}
            onSelectCrossConnect={(xcId) => {
              setCustomTracedFiberIds(null);
              setSelectedCrossConnectId(xcId);
            }}
            onSelectEntity={(ent) => {
              setSelectedEntity(ent);
              setActiveOverlay('editor');
            }}
            onClose={() => setActiveOverlay('none')}
          />
        )}

        {activeOverlay === 'patching' && (
          <PatchingSimulatorDrawer
            site={site}
            onAddFiber={handleAddFiber}
            onRemoveFiber={handleRemoveFiber}
            onAddCrossConnect={handleAddCrossConnect}
            patchingDraftSource={patchingDraftSource}
            onClearDraftSource={() => setPatchingDraftSource(null)}
            isPatchingMode={isPatchingMode}
            onTogglePatchingMode={setIsPatchingMode}
            selectedCrossConnectId={selectedCrossConnectId}
            onSelectCrossConnect={(xcId) => {
              setCustomTracedFiberIds(null);
              setSelectedCrossConnectId(xcId);
            }}
            onClose={() => setActiveOverlay('none')}
          />
        )}

        {activeOverlay === 'library' && (
          <LibraryInventoryModal
            site={site}
            onDeployEquipmentFromLibrary={handleDeployEquipmentFromLibrary}
            onAddLibraryTemplate={handleAddLibraryTemplate}
            onRestockTemplate={handleRestockTemplate}
            onAddRack={handleAddRack}
            onClose={() => setActiveOverlay('none')}
          />
        )}

        {activeOverlay === 'editor' && (
          <EntityEditorDrawer
            site={site}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
            onUpdateSite={(updater) =>
              setSite((prev) => syncSitePortStatuses(updater(prev)))
            }
            onTraceFromPortOrFiber={(fiberId, portId) => {
              const chain = traceEndToEndChainFromPortOrFiber(
                site,
                fiberId,
                portId
              );
              if (chain.length > 0) {
                setCustomTracedFiberIds(chain);
              }
            }}
            onStartPatchFromPort={(equipmentId, portId) => {
              setPatchingDraftSource({ equipmentId, portId });
              setIsPatchingMode(true);
              setActiveOverlay('patching');
            }}
            onClose={() => setActiveOverlay('none')}
          />
        )}
      </main>
    </div>
  );
};
