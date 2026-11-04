import React, { useState } from 'react';
import {
  FileDown,
  FileCode2,
  Layers,
  GitCommitHorizontal,
  Server,
  Grid3X3,
  Move,
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  RotateCw,
  Eye,
} from 'lucide-react';
import { TelecomSite, SelectedEntityRef, Rack } from '../types/telecom';
import { OpticalBudgetReport } from '../utils/opticalCalculations';
import {
  CALEPINAGE_COLUMNS,
  CALEPINAGE_ROWS,
  CALEPINAGE_ROW_INFO,
  buildRoomCalepinageMatrix,
} from '../utils/calepinageUtils';
import {
  downloadSvgEngineeringDiagram,
  downloadPdfEngineeringReport,
} from '../utils/exportDocumentation';

export type PlanModalTab = 'logical_physical' | 'calepinage_grid' | 'rack_elevation';

interface Interactive2DPlanModalProps {
  site: TelecomSite;
  budget: OpticalBudgetReport;
  highlightedFiberIds: string[];
  selectedCrossConnectId: string;
  initialTab?: PlanModalTab;
  onSelectCrossConnect: (xcId: string) => void;
  onSelectEntity: (entity: SelectedEntityRef) => void;
  onRelocateRack: (rackId: string, tileColumn: string, tileRow: number) => void;
  onFlipRackOrientation?: (rackId: string) => void;
  onFocusRack3D?: (rackId: string, side: 'front' | 'rear') => void;
  onClose: () => void;
}

export const Interactive2DPlanModal: React.FC<Interactive2DPlanModalProps> = ({
  site,
  budget,
  highlightedFiberIds,
  selectedCrossConnectId,
  initialTab = 'logical_physical',
  onSelectCrossConnect,
  onSelectEntity,
  onRelocateRack,
  onFlipRackOrientation,
  onFocusRack3D,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<PlanModalTab>(initialTab);
  const [selectedRackId, setSelectedRackId] = useState<string>(site.racks[0]?.id);
  const [calepinageViewMode, setCalepinageViewMode] = useState<'single_room' | 'all_rooms'>('single_room');

  // Plan 2D Readability Filters (declutters the 2D diagram by default)
  const [showOnlyActiveCircuit, setShowOnlyActiveCircuit] = useState<boolean>(true);
  const [showTileGridOn2D, setShowTileGridOn2D] = useState<boolean>(true);
  const [zoomRoom2D, setZoomRoom2D] = useState<string>('all');

  // Rack 42U Elevation View Mode: Front + Rear side-by-side, Front only, or Rear only
  const [elevationFaceMode, setElevationFaceMode] = useState<'both' | 'front' | 'rear'>('both');

  const activeSet = new Set(highlightedFiberIds);

  const currentRack = site.racks.find((r) => r.id === selectedRackId) || site.racks[0];
  const currentRackRoom =
    site.rooms.find((rm) => rm.id === currentRack?.roomId) || site.rooms[0];

  const currentRackEquipments = site.equipments
    .filter((eq) => eq.rackId === currentRack?.id)
    .sort((a, b) => b.uPosition - a.uPosition);

  const displayedCalepinageRooms =
    calepinageViewMode === 'all_rooms' ? site.rooms : [currentRackRoom];

  // Spacious 2D coordinate mapping
  const mapX = (xM: number) => Math.round(560 + xM * 48);
  const mapZ = (zM: number) => Math.round(225 + zM * 34);
  const TRUNK_CTRL_Y = 30; // point de contrôle des rocades, au-dessus du haut des salles (y≈82)

  // Compute SVG viewBox dynamically if user zooms on a single room in 2D
  const zoomedRoomObj = site.rooms.find((r) => r.id === zoomRoom2D);
  const svgViewBox = zoomedRoomObj
    ? `${mapX(zoomedRoomObj.bounds.x - zoomedRoomObj.bounds.width / 2) - 40} ${
        mapZ(zoomedRoomObj.bounds.z - zoomedRoomObj.bounds.depth / 2) - 35
      } ${Math.round(zoomedRoomObj.bounds.width * 48) + 80} ${
        Math.round(zoomedRoomObj.bounds.depth * 34) + 70
      }`
    : '0 0 1120 440';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-3 md:p-5">
      <div className="w-full max-w-[1440px] h-[92vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              Plan Physique 2D Simplifié · Calepinage Dalles 60×60 cm (Sans Demi-Baie) · Baie Avant / Arrière
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-amber-300">1 Baie = 1 Dalle 60×60 cm</strong>{' '}
              <span aria-hidden="true">·</span>{' '}
              <strong className="text-emerald-400">Baie Avant = Brassage Jarretières OS2</strong>{' '}
              <span aria-hidden="true">·</span>{' '}
              <strong className="text-sky-400">Baie Arrière = Arrivée Câbles Rocades (24FO / 12FO)</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={() => setSubTab('logical_physical')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  subTab === 'logical_physical'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                1. Plan 2D &amp; Schéma Logique
              </button>
              <button
                onClick={() => setSubTab('calepinage_grid')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  subTab === 'calepinage_grid'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                2. Calepinage 60×60 cm (1 Baie = 1 Dalle)
              </button>
              <button
                onClick={() => setSubTab('rack_elevation')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  subTab === 'rack_elevation'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                3. Vue Baie Avant &amp; Baie Arrière (42U)
              </button>
            </div>

            <button
              onClick={() => downloadSvgEngineeringDiagram(site, budget)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
              SVG
            </button>
            <button
              onClick={() => downloadPdfEngineeringReport(site, budget)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Circuit Selector Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
              Liaison Cross-Connect active :
            </span>
            {site.crossConnects.map((xc) => (
              <button
                key={xc.id}
                onClick={() => onSelectCrossConnect(xc.id)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedCrossConnectId === xc.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {xc.reference} · {xc.polarity}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300">
            <span>
              Distance : <strong className="text-slate-100">{budget.totalLengthMeters} m</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Perte : <strong className="text-amber-400">-{budget.totalAttenuationDb.toFixed(2)} dB</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Signal RX : <strong className="text-emerald-400">{budget.rxPowerDbm.toFixed(2)} dBm</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              {budget.status === 'optimal' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              Marge +{budget.opticalMarginDb.toFixed(2)} dB
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ================================================================= */}
          {/* TAB 1: READABLE 2D FLOOR PLAN + LOGICAL END-TO-END CHAIN          */}
          {/* ================================================================= */}
          {subTab === 'logical_physical' && (
            <>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                {/* Filter & Readability Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      01. Plan Physique 2D Lisible — Baie Avant (Jarretières) vs Baie Arrière (Câbles Rocades)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chaque baie occupe <strong className="text-amber-300">1 Dalle carrée 60×60 cm</strong> : le bord <strong className="text-sky-400">BLEU indique la Baie Arrière (Câble Rocade)</strong> et le bord <strong className="text-amber-400">AMBRE indique la Baie Avant (Jarretières)</strong>.
                    </p>
                  </div>

                  {/* Readability Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Zoom Room Filter */}
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setZoomRoom2D('all')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          zoomRoom2D === 'all'
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Vue 3 Salles
                      </button>
                      {site.rooms.map((rm) => (
                        <button
                          key={rm.id}
                          onClick={() => setZoomRoom2D(rm.id)}
                          className={`px-2.5 py-1 rounded transition-colors ${
                            zoomRoom2D === rm.id
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Zoom {rm.code.replace('SALLE-', '')}
                        </button>
                      ))}
                    </div>

                    {/* Toggle Active Cables Only vs All Cables */}
                    <button
                      onClick={() => setShowOnlyActiveCircuit(!showOnlyActiveCircuit)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        showOnlyActiveCircuit
                          ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {showOnlyActiveCircuit
                        ? 'Affichage épuré : Liaison active seule'
                        : 'Affichage complet : Toutes les liaisons'}
                    </button>

                    {/* Toggle 60x60cm Tile Grid */}
                    <button
                      onClick={() => setShowTileGridOn2D(!showTileGridOn2D)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        showTileGridOn2D
                          ? 'bg-sky-950/50 border-sky-500/50 text-sky-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      Grille 60×60 cm : {showTileGridOn2D ? 'Visible' : 'Masquée'}
                    </button>
                  </div>
                </div>

                {/* Clear Visual Legend Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs">
                  <div className="flex flex-wrap items-center gap-5">
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-2.5 rounded-xs bg-sky-500 inline-block" />
                      <strong className="text-sky-300">Câble Fibre Rocade (24FO / 12FO)</strong>
                      <span className="text-slate-400">→ Branché en <strong className="text-sky-300">BAIE ARRIÈRE</strong></span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-1.5 rounded-full bg-amber-400 inline-block" />
                      <strong className="text-amber-300">Jarretière Optique (1FO / 2FO)</strong>
                      <span className="text-slate-400">→ Branchée en <strong className="text-amber-300">BAIE AVANT</strong></span>
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Cliquez sur une baie pour voir ses faces <strong className="text-amber-300">Avant / Arrière</strong> ou changer sa dalle 60×60 cm.
                  </div>
                </div>

                {/* Spacious, Uncluttered 2D SVG Floor Plan */}
                <div className="w-full overflow-x-auto bg-slate-900/40 border border-slate-800 rounded-xl">
                  <svg
                    viewBox={svgViewBox}
                    className="w-full h-auto min-w-[900px] max-h-[460px] select-none"
                  >
                    <defs>
                      <pattern id="grid60cm" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path
                          d="M 32 0 L 0 0 0 32"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="0.7"
                        />
                      </pattern>
                    </defs>
                    <rect
                      x="-200"
                      y="-200"
                      width="1600"
                      height="900"
                      fill={showTileGridOn2D ? 'url(#grid60cm)' : '#090d16'}
                    />

                    {/* 1. ROOMS */}
                    {site.rooms.map((rm) => {
                      const rx = mapX(rm.bounds.x - rm.bounds.width / 2);
                      const ry = mapZ(rm.bounds.z - rm.bounds.depth / 2);
                      const rw = Math.round(rm.bounds.width * 48);
                      const rh = Math.round(rm.bounds.depth * 34);

                      return (
                        <g key={rm.id}>
                          {/* Room Outer Box */}
                          <rect
                            x={rx}
                            y={ry}
                            width={rw}
                            height={rh}
                            rx={10}
                            fill="#090d16"
                            fillOpacity={0.92}
                            stroke={rm.colorHex}
                            strokeWidth={2.2}
                          />

                          {/* Room Header Strip */}
                          <rect
                            x={rx}
                            y={ry}
                            width={rw}
                            height={32}
                            rx={8}
                            fill={rm.colorHex}
                            fillOpacity={0.2}
                          />

                          {/* Central Front Patching Aisle Band inside each Room */}
                          <rect
                            x={rx + 14}
                            y={mapZ(0) - 24}
                            width={rw - 28}
                            height={48}
                            rx={6}
                            fill="#0f172a"
                            stroke="#334155"
                            strokeDasharray="4,4"
                            strokeWidth={1}
                          />
                          <text
                            x={rx + rw / 2}
                            y={mapZ(0) + 19}
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="9"
                            fontWeight="600"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            ALLÉE CENTRALE DE BRASSAGE (ACCÈS BAIE AVANT · JARRETIÈRES)
                          </text>

                          {/* Optional 60x60cm Column & Row Rulers */}
                          {showTileGridOn2D &&
                            CALEPINAGE_COLUMNS.map((col, ci) => {
                              const cx = rx + 36 + ci * ((rw - 72) / 5);
                              return (
                                <text
                                  key={`${rm.id}-col-${col}`}
                                  x={cx}
                                  y={ry + rh - 8}
                                  textAnchor="middle"
                                  fill="#64748b"
                                  fontSize="9.5"
                                  fontWeight="700"
                                  fontFamily="IBM Plex Mono, monospace"
                                >
                                  Col {col}
                                </text>
                              );
                            })}
                        </g>
                      );
                    })}

                    {/* 2. FIBERS: CÂBLES ROCADES (REAR) VS JARRETIÈRES (FRONT) */}
                    {site.fibers.map((fib) => {
                      const isActive = activeSet.has(fib.id);
                      if (showOnlyActiveCircuit && !isActive) return null;

                      const eqA = site.equipments.find((e) => e.id === fib.sourceEquipmentId);
                      const eqB = site.equipments.find((e) => e.id === fib.targetEquipmentId);
                      if (!eqA || !eqB) return null;
                      const rkA = site.racks.find((r) => r.id === eqA.rackId);
                      const rkB = site.racks.find((r) => r.id === eqB.rackId);
                      if (!rkA || !rkB) return null;

                      const x1 = mapX(rkA.position3D[0]);
                      const y1 = mapZ(rkA.position3D[2]);
                      const x2 = mapX(rkB.position3D[0]);
                      const y2 = mapZ(rkB.position3D[2]);
                      const isTrunk = fib.kind === 'trunk_cable';

                      // Trunk cables connect to the REAR (North side y - 30) of the racks!
                      // Jarretières connect to the FRONT (South side y + 30) of the racks!
                      const pathD = isTrunk
                        ? `M ${x1} ${y1 - 30} C ${x1} ${TRUNK_CTRL_Y}, ${x2} ${TRUNK_CTRL_Y}, ${x2} ${y2 - 30}`
                        : rkA.id === rkB.id
                        ? `M ${x1 - 18} ${y1 + 30} C ${x1 - 45} ${y1 + 72}, ${x1 + 45} ${y1 + 72}, ${x1 + 18} ${y1 + 30}`
                        : `M ${x1} ${y1 + 30} C ${x1} ${y1 + 78}, ${x2} ${y2 + 78}, ${x2} ${y2 + 30}`;

                      const midX = Math.round((x1 + x2) / 2);
                      // Rocades : étiquette au sommet de la courbe, au-dessus des salles
                      // (avant, elle recouvrait le titre des salles).
                      const labelY = isTrunk
                        ? Math.round((y1 - 30 + y2 - 30) / 8 + (TRUNK_CTRL_Y * 3) / 4)
                        : Math.max(y1, y2) + 64;

                      return (
                        <g
                          key={fib.id}
                          onClick={() => onSelectEntity({ kind: 'fiber', id: fib.id })}
                          className="cursor-pointer"
                        >
                          {isTrunk && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#0369a1"
                              strokeWidth={isActive ? 9 : 4}
                              strokeOpacity={isActive ? 0.9 : 0.35}
                            />
                          )}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isActive ? fib.JacketColorHex : '#475569'}
                            strokeWidth={isTrunk ? (isActive ? 4.5 : 2) : isActive ? 3.5 : 1.5}
                            strokeDasharray={!isTrunk && fib.polarity.includes('Mono') ? '6,4' : undefined}
                            strokeOpacity={isActive ? 1 : 0.4}
                          />

                          {/* Clean, Non-Overlapping Callout Pill for Active Circuit */}
                          {isActive && (
                            <g>
                              <rect
                                x={midX - 78}
                                y={labelY - 12}
                                width={156}
                                height={22}
                                rx={5}
                                fill={isTrunk ? '#082f49' : '#451a03'}
                                stroke={isTrunk ? '#38bdf8' : '#f59e0b'}
                                strokeWidth={1.3}
                              />
                              <text
                                x={midX}
                                y={labelY + 2}
                                textAnchor="middle"
                                fill="#f8fafc"
                                fontSize="9.5"
                                fontWeight="700"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                {isTrunk
                                  ? `ROCADE ${fib.trunkCapacity || '24FO'} (BAIE ARRIÈRE)`
                                  : rkA.id === rkB.id
                                  ? `JARRETIÈRE ${fib.code} (AVANT)`
                                  : `CROSS-CONNECT MMR (AVANT)`}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Titres des salles au-dessus des fibres, avec un liseré sombre pour rester lisibles */}
                    {site.rooms.map((rm) => (
                      <text
                        key={`${rm.id}-title`}
                        x={mapX(rm.bounds.x - rm.bounds.width / 2) + 14}
                        y={mapZ(rm.bounds.z - rm.bounds.depth / 2) + 20}
                        fill="#f8fafc"
                        fontSize="12"
                        fontWeight="700"
                        stroke="#090d16"
                        strokeWidth={4}
                        paintOrder="stroke"
                        className="pointer-events-none"
                      >
                        {rm.code} — {rm.type === 'mmr' ? 'Zone Hébergeur Tiers' : rm.type === 'operator' ? 'POP SFR (Rocade 24FO)' : 'Espace Client (Rocade 12FO)'}
                      </text>
                    ))}

                    {/* 3. RACKS: 1:1 SQUARE TILE 60x60cm WITH EXPLICIT BAIE AVANT & BAIE ARRIÈRE BARS */}
                    {site.racks.map((rk) => {
                      const cx = mapX(rk.position3D[0]);
                      const cz = mapZ(rk.position3D[2]);
                      const tileSize = 62; // Square 1:1 representation of a 60x60cm tile!
                      const hasActiveHop = budget.hops.some(
                        (h) => h.sourceRack.id === rk.id || h.targetRack.id === rk.id
                      );
                      const isFlipped = Math.abs(rk.rotationY) > 0.1 || rk.calepinage.tileRow >= 5;
                      const tileShort = `${rk.calepinage.tileColumn}-${String(
                        rk.calepinage.tileRow
                      ).padStart(2, '0')}`;

                      // Determine where Rear (Blue) and Front (Amber) bars sit on the square
                      const rearY = isFlipped
                        ? cz + tileSize / 2 - 8
                        : cz - tileSize / 2;
                      const frontY = isFlipped
                        ? cz - tileSize / 2
                        : cz + tileSize / 2 - 8;

                      return (
                        <g
                          key={rk.id}
                          onClick={() => {
                            setSelectedRackId(rk.id);
                          }}
                          className="cursor-pointer"
                        >
                          {/* 60x60cm Square Rack Body */}
                          <rect
                            x={cx - tileSize / 2}
                            y={cz - tileSize / 2}
                            width={tileSize}
                            height={tileSize}
                            rx={6}
                            fill="#0f172a"
                            stroke={
                              selectedRackId === rk.id
                                ? '#facc15'
                                : hasActiveHop
                                ? '#f59e0b'
                                : '#64748b'
                            }
                            strokeWidth={selectedRackId === rk.id ? 2.6 : hasActiveHop ? 2 : 1.2}
                          />

                          {/* BAIE ARRIÈRE Strip (Sky Blue) */}
                          <rect
                            x={cx - tileSize / 2 + 2}
                            y={rearY}
                            width={tileSize - 4}
                            height={8}
                            rx={2}
                            fill="#0284c7"
                          />
                          <text
                            x={cx}
                            y={rearY + 6.5}
                            textAnchor="middle"
                            fill="#e0f2fe"
                            fontSize="6.5"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            ARRIÈRE
                          </text>

                          {/* BAIE AVANT Strip (Amber Gold) */}
                          <rect
                            x={cx - tileSize / 2 + 2}
                            y={frontY}
                            width={tileSize - 4}
                            height={8}
                            rx={2}
                            fill="#d97706"
                          />
                          <text
                            x={cx}
                            y={frontY + 6.5}
                            textAnchor="middle"
                            fill="#fef3c7"
                            fontSize="6.5"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            AVANT
                          </text>

                          {/* Rack Code & Single 60x60cm Tile Address */}
                          <text
                            x={cx}
                            y={cz - 3}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="8.5"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {rk.code.replace('BAIE-', '')}
                          </text>
                          <text
                            x={cx}
                            y={cz + 9}
                            textAnchor="middle"
                            fill="#38bdf8"
                            fontSize="8"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            Dalle {tileShort}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Selected Rack Quick Action Bar below 2D Plan */}
                {currentRack && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-bold">
                        {currentRack.code}
                      </span>
                      <span className="font-semibold text-slate-100">{currentRack.name}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono text-sky-300 font-semibold">
                        {currentRack.calepinage.tileRangeLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-amber-300">{currentRack.calepinage.frontFaceLabel}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-sky-400">{currentRack.calepinage.rearFaceLabel}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {onFocusRack3D && (
                        <>
                          <button
                            onClick={() => {
                              onFocusRack3D(currentRack.id, 'front');
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-medium flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Voir Baie Avant en 3D
                          </button>
                          <button
                            onClick={() => {
                              onFocusRack3D(currentRack.id, 'rear');
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg font-medium flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Voir Baie Arrière en 3D
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSubTab('calepinage_grid')}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium"
                      >
                        Déplacer sur Dalle 60×60 →
                      </button>
                      <button
                        onClick={() => setSubTab('rack_elevation')}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg font-medium"
                      >
                        Élévation Avant / Arrière 42U →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. End-to-End Logical Cross-Connect Chain */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <GitCommitHorizontal className="w-4 h-4 text-amber-400" />
                    02. Schéma Logique de Bout en Bout (Indication Baie Avant vs Baie Arrière)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Suivez comment le signal optique traverse chaque baie par sa <strong className="text-amber-300">Baie Avant (Jarretières)</strong> ou sa <strong className="text-sky-400">Baie Arrière (Câble Rocade 24FO / 12FO)</strong>.
                  </p>
                </div>

                {budget.hops.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">
                    Aucun tronçon optique sélectionné.
                  </p>
                ) : (
                  <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2">
                    {budget.hops.map((hop, idx) => {
                      const isTrunk = hop.fiber.kind === 'trunk_cable';
                      return (
                        <React.Fragment key={hop.fiber.id}>
                          {idx === 0 && (
                            <div
                              onClick={() =>
                                onSelectEntity({
                                  kind: 'equipment',
                                  id: hop.sourceEquipment.id,
                                })
                              }
                              className="min-w-[205px] bg-slate-900 border border-slate-700 hover:border-sky-400 rounded-lg p-3 cursor-pointer transition-colors flex flex-col justify-between"
                            >
                              <div>
                                <div className="text-[11px] font-mono text-sky-400 font-bold">
                                  {hop.sourceRack.code} · Dalle {hop.sourceRack.calepinage.tileColumn}-{String(hop.sourceRack.calepinage.tileRow).padStart(2, '0')}
                                </div>
                                <div className="text-xs font-bold text-slate-100 mt-1">
                                  {hop.sourceEquipment.name}
                                </div>
                              </div>
                              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                                <span className="text-amber-400 font-semibold">
                                  {hop.sourcePort.label} (Baie Avant)
                                </span>
                                <span className="text-slate-400">{hop.sourcePort.connector}</span>
                              </div>
                            </div>
                          )}

                          {/* Cable / Jumper Hop Card */}
                          <div
                            onClick={() =>
                              onSelectEntity({ kind: 'fiber', id: hop.fiber.id })
                            }
                            className={`min-w-[215px] flex flex-col justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                              isTrunk
                                ? 'bg-sky-950/35 border-sky-500/60 hover:border-sky-400'
                                : 'bg-amber-950/25 border-amber-500/50 hover:border-amber-400'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span
                                  className={
                                    isTrunk ? 'text-sky-300 font-bold' : 'text-amber-300 font-bold'
                                  }
                                >
                                  {isTrunk
                                    ? `BAIE ARRIÈRE · ROCADE ${hop.fiber.trunkCapacity || '24FO'}`
                                    : hop.fiber.kind === 'cross_connect_jumper'
                                    ? 'BAIE AVANT · CROSS-CONNECT MMR'
                                    : 'BAIE AVANT · JARRETIÈRE'}
                                </span>
                                <span className="text-slate-400">#{hop.stepIndex}</span>
                              </div>

                              <div className="text-xs font-mono font-bold text-slate-100 mt-1">
                                {hop.fiber.code}
                              </div>

                              <div className="w-full flex items-center gap-1 my-1.5">
                                <div
                                  className={
                                    isTrunk
                                      ? 'h-2 flex-1 rounded-xs bg-sky-500'
                                      : 'h-1 flex-1 rounded-full bg-amber-400'
                                  }
                                />
                                <ArrowRight
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isTrunk ? 'text-sky-400' : 'text-amber-400'
                                  }`}
                                />
                              </div>

                              <div className="text-[11px] text-slate-200 font-medium">
                                {hop.fiber.polarity}
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-amber-400">
                              <span>OS2 · {hop.fiber.lengthMeters}m</span>
                              <span>-{hop.calculatedLossDb.toFixed(2)} dB</span>
                            </div>
                          </div>

                          {/* Target Equipment Card */}
                          <div
                            onClick={() =>
                              onSelectEntity({
                                kind: 'equipment',
                                id: hop.targetEquipment.id,
                              })
                            }
                            className="min-w-[205px] bg-slate-900 border border-slate-700 hover:border-emerald-400 rounded-lg p-3 cursor-pointer transition-colors flex flex-col justify-between"
                          >
                            <div>
                              <div className="text-[11px] font-mono text-emerald-400 font-bold">
                                {hop.targetRack.code} · Dalle {hop.targetRack.calepinage.tileColumn}-{String(hop.targetRack.calepinage.tileRow).padStart(2, '0')}
                              </div>
                              <div className="text-xs font-bold text-slate-100 mt-1">
                                {hop.targetEquipment.name}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {isTrunk
                                  ? 'Arrivée en Baie Arrière → Sortie Baie Avant'
                                  : 'Raccordé en Baie Avant (Façade)'}
                              </div>
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                              <span className="text-amber-400 font-semibold">
                                {hop.targetPort.label}
                              </span>
                              <span className="text-slate-400">{hop.targetPort.connector}</span>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================================================================= */}
          {/* TAB 2: SIMPLE 60x60cm CALEPINAGE (1 BAIE = 1 DALLE, ZERO HALF-RACK) */}
          {/* ================================================================= */}
          {subTab === 'calepinage_grid' && (
            <div className="space-y-5">
              {/* Visual 3-Rule Explanation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                    Règle 1 · Zéro Demi-Baie
                  </div>
                  <div className="text-sm font-bold text-slate-100 mt-1">
                    1 Dalle 60×60 cm = 1 Baie Entière
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Chaque baie mesure exactement <strong>60 × 60 cm</strong> et occupe <strong>1 seule case</strong> sur la grille (ex: <code>Dalle C-02</code>). Aucune baie ne déborde sur une demi-dalle.
                  </p>
                </div>

                <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4">
                  <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                    Règle 2 · Baie Avant (Façade)
                  </div>
                  <div className="text-sm font-bold text-slate-100 mt-1">
                    Côté Ambre = Brassage Jarretières
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    La <strong>Baie Avant</strong> donne sur l&apos;<strong>Allée Centrale de Brassage (Lignes 03-04)</strong>. C&apos;est ici qu&apos;on branche les <strong>Jarretières OS2</strong>.
                  </p>
                </div>

                <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-4">
                  <div className="text-xs font-mono font-bold text-sky-400 uppercase">
                    Règle 3 · Baie Arrière (Fond)
                  </div>
                  <div className="text-sm font-bold text-slate-100 mt-1">
                    Côté Bleu = Arrivée Câbles Rocades
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    La <strong>Baie Arrière</strong> donne sur le <strong>Couloir Technique Arrière (Lignes 01 ou 06)</strong> où arrivent les <strong>Câbles Rocades 24FO et 12FO</strong>.
                  </p>
                </div>
              </div>

              {/* Control Bar: Step 1 Pick Rack -> Step 2 Click a 60x60cm Tile */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Move className="w-4 h-4 text-amber-400" />
                      Étape 1 : Choisissez la Baie à localiser ou déplacer (1 clic)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sélectionnez une baie ci-dessous, puis cliquez sur n&apos;importe quelle <strong className="text-amber-300">Dalle 60×60 cm libre (A-01 à F-06)</strong> dans la grille pour la déplacer.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setCalepinageViewMode('single_room')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        calepinageViewMode === 'single_room'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Vue Grande Grille (Salle Active)
                    </button>
                    <button
                      onClick={() => setCalepinageViewMode('all_rooms')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        calepinageViewMode === 'all_rooms'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Comparer les 3 Salles
                    </button>
                  </div>
                </div>

                {/* 6 Rack Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  {site.racks.map((rk) => {
                    const rm = site.rooms.find((r) => r.id === rk.roomId);
                    const isSelected = currentRack?.id === rk.id;
                    const singleTile = `${rk.calepinage.tileColumn}-${String(
                      rk.calepinage.tileRow
                    ).padStart(2, '0')}`;
                    return (
                      <button
                        key={rk.id}
                        onClick={() => setSelectedRackId(rk.id)}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/50'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {rk.code}
                          </span>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-sky-500/40">
                            Dalle {singleTile}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 truncate mt-1">
                          {rk.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                          {rm?.code} · 60×60 cm (1 Dalle)
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Rack Orientation & Front/Rear Summary Strip */}
                {currentRack && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Baie sélectionnée : <strong className="text-white font-mono">{currentRack.code}</strong>
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono text-amber-300 font-bold">
                        {currentRack.calepinage.tileRangeLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-amber-300">
                        ▼ {currentRack.calepinage.frontFaceLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-sky-400">
                        ▲ {currentRack.calepinage.rearFaceLabel}
                      </span>
                    </div>

                    {onFlipRackOrientation && (
                      <button
                        onClick={() => onFlipRackOrientation(currentRack.id)}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Inverser Baie Avant / Baie Arrière (180°)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Large 6x6 Visual Tile Grid (1 Case = 1 Dalle 60x60cm = 1 Baie) */}
              <div
                className={`grid grid-cols-1 ${
                  displayedCalepinageRooms.length > 1 ? 'xl:grid-cols-3' : 'max-w-5xl mx-auto'
                } gap-5`}
              >
                {displayedCalepinageRooms.map((room) => {
                  const roomRacks = site.racks.filter((rk) => rk.roomId === room.id);
                  const matrix = buildRoomCalepinageMatrix(room, roomRacks);
                  const isTargetRoom = currentRack?.roomId === room.id;

                  return (
                    <div
                      key={room.id}
                      className={`bg-slate-950 border rounded-xl p-5 space-y-4 ${
                        isTargetRoom ? 'border-amber-500/70 shadow-xl' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="text-xs font-mono font-bold uppercase text-amber-400">
                            {room.code} · Grille 6×6 Dalles de 60×60 cm
                          </div>
                          <h4 className="text-base font-bold text-slate-100">{room.name}</h4>
                        </div>
                        <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {roomRacks.length} Baies · 1 Baie = 1 Dalle 60×60 cm
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse select-none">
                          <thead>
                            <tr>
                              <th className="p-2 text-left text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 w-44">
                                Ligne / Fonction Couloir
                              </th>
                              {CALEPINAGE_COLUMNS.map((col) => (
                                <th
                                  key={col}
                                  className="p-2 text-xs font-mono font-bold text-slate-200 text-center bg-slate-900 border border-slate-800"
                                >
                                  Col {col}
                                  <div className="text-[9px] font-normal text-slate-400">
                                    60 cm
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrix.map((rowCells, rIdx) => {
                              const rowNum = CALEPINAGE_ROWS[rIdx];
                              const rowStr = String(rowNum).padStart(2, '0');
                              const rowMeta = CALEPINAGE_ROW_INFO[rowNum];
                              const isFrontAisle = rowMeta.zoneType === 'front_aisle';
                              const isRearCorridor = rowMeta.zoneType === 'rear_corridor';

                              return (
                                <tr key={rowStr}>
                                  {/* Clear Architectural Row Explanation */}
                                  <td
                                    className={`p-2 border border-slate-800 ${
                                      isFrontAisle
                                        ? 'bg-amber-950/25 text-amber-300'
                                        : isRearCorridor
                                        ? 'bg-sky-950/25 text-sky-300'
                                        : 'bg-slate-900 text-slate-200'
                                    }`}
                                  >
                                    <div className="text-xs font-mono font-bold">
                                      Ligne {rowStr} · {rowMeta.shortLabel}
                                    </div>
                                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                      {rowMeta.roleTitle}
                                    </div>
                                  </td>

                                  {/* 6 Square Tiles (60x60cm each) */}
                                  {rowCells.map((cell) => {
                                    const occRack: Rack | undefined = cell.occupyingRack;
                                    const isSelectedRack =
                                      occRack && occRack.id === currentRack?.id;
                                    const isRackFlipped =
                                      occRack &&
                                      (Math.abs(occRack.rotationY) > 0.1 ||
                                        occRack.calepinage.tileRow >= 5);

                                    return (
                                      <td
                                        key={cell.code}
                                        onClick={() => {
                                          if (occRack) {
                                            setSelectedRackId(occRack.id);
                                          } else if (isTargetRoom && currentRack) {
                                            onRelocateRack(
                                              currentRack.id,
                                              cell.col,
                                              cell.row
                                            );
                                          }
                                        }}
                                        className={`h-20 p-1.5 border text-center align-middle transition-all cursor-pointer ${
                                          isSelectedRack
                                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/60'
                                            : occRack
                                            ? 'bg-slate-800 border-sky-400 hover:bg-slate-700'
                                            : isFrontAisle
                                            ? 'bg-amber-950/10 border-slate-800/90 hover:border-amber-400/60'
                                            : isRearCorridor
                                            ? 'bg-sky-950/15 border-slate-800/90 hover:border-sky-400/60'
                                            : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800 hover:border-amber-400'
                                        }`}
                                      >
                                        {occRack ? (
                                          <div className="h-full flex flex-col justify-between rounded bg-slate-950 border border-slate-700 p-1">
                                            {/* Top Edge of Rack Tile */}
                                            <div
                                              className={`text-[8px] font-mono font-bold uppercase rounded-xs px-1 py-0.5 ${
                                                isRackFlipped
                                                  ? 'bg-amber-500 text-slate-950'
                                                  : 'bg-sky-600 text-white'
                                              }`}
                                            >
                                              {isRackFlipped
                                                ? '▲ AVANT (Jarretières)'
                                                : '▲ ARRIÈRE (Rocade)'}
                                            </div>

                                            {/* Rack Name & Single Tile Code */}
                                            <div className="my-0.5">
                                              <div className="text-[10px] font-mono font-bold text-white truncate">
                                                {occRack.code}
                                              </div>
                                              <div className="text-[9px] font-mono text-amber-300">
                                                Dalle {cell.code}
                                              </div>
                                            </div>

                                            {/* Bottom Edge of Rack Tile */}
                                            <div
                                              className={`text-[8px] font-mono font-bold uppercase rounded-xs px-1 py-0.5 ${
                                                isRackFlipped
                                                  ? 'bg-sky-600 text-white'
                                                  : 'bg-amber-500 text-slate-950'
                                              }`}
                                            >
                                              {isRackFlipped
                                                ? '▼ ARRIÈRE (Rocade)'
                                                : '▼ AVANT (Jarretières)'}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-0.5">
                                            <div className="text-[11px] font-mono font-semibold text-slate-400">
                                              {cell.code}
                                            </div>
                                            <div className="text-[9px] text-slate-500">
                                              {isFrontAisle
                                                ? 'Couloir Avant'
                                                : isRearCorridor
                                                ? 'Couloir Arrière'
                                                : 'Libre 60×60'}
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: RACK ELEVATION 42U — BAIE AVANT & BAIE ARRIÈRE             */}
          {/* ================================================================= */}
          {subTab === 'rack_elevation' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Sidebar: Select Rack */}
              <div className="lg:col-span-3 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-100">
                  Sélectionner une Baie (60×60 cm)
                </h3>
                <div className="space-y-2">
                  {site.racks.map((rk) => {
                    const rm = site.rooms.find((r) => r.id === rk.roomId);
                    const eqCount = site.equipments.filter((e) => e.rackId === rk.id).length;
                    return (
                      <button
                        key={rk.id}
                        onClick={() => setSelectedRackId(rk.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedRackId === rk.id
                            ? 'bg-slate-800 border-amber-500 text-slate-100'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {rk.code}
                          </span>
                          <span className="text-[11px] font-mono text-sky-400">
                            {rk.calepinage.tileRangeLabel}
                          </span>
                        </div>
                        <div className="text-xs font-semibold mt-1">{rk.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {rm?.code} · {eqCount} équipements
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Main Panel: Front Face (Baie Avant) & Rear Face (Baie Arrière) */}
              <div className="lg:col-span-9 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      {currentRack?.name} ({currentRack?.code}) — {currentRack?.calepinage.tileRangeLabel}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Comparez la <strong className="text-amber-300">Baie Avant (Façade Ports &amp; Jarretières)</strong> et la <strong className="text-sky-400">Baie Arrière (Arrivée Câble Rocade 24FO/12FO)</strong>.
                    </p>
                  </div>

                  {/* View Mode Switcher: Front + Rear, Front only, Rear only */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setElevationFaceMode('both')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        elevationFaceMode === 'both'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Côte-à-Côte (Avant + Arrière)
                    </button>
                    <button
                      onClick={() => setElevationFaceMode('front')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        elevationFaceMode === 'front'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Baie AVANT seule
                    </button>
                    <button
                      onClick={() => setElevationFaceMode('rear')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        elevationFaceMode === 'rear'
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Baie ARRIÈRE seule
                    </button>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    elevationFaceMode === 'both' ? 'xl:grid-cols-2' : ''
                  } gap-5`}
                >
                  {/* ========================================================= */}
                  {/* COLUMN 1: BAIE AVANT (FAÇADE PORTS & JARRETIÈRES)         */}
                  {/* ========================================================= */}
                  {(elevationFaceMode === 'both' || elevationFaceMode === 'front') && (
                    <div className="bg-slate-900/70 border border-amber-500/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[11px] font-mono font-bold uppercase text-amber-400">
                            ▼ BAIE AVANT (FAÇADE BRASSAGE)
                          </span>
                          <h4 className="text-sm font-bold text-slate-100">
                            {currentRack?.calepinage.frontFaceLabel}
                          </h4>
                        </div>
                        {onFocusRack3D && currentRack && (
                          <button
                            onClick={() => {
                              onFocusRack3D(currentRack.id, 'front');
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg"
                          >
                            Caméra 3D Avant →
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400">
                        Face tournée vers l&apos;allée de brassage : accès aux ports optiques frontaux pour brancher ou débrancher les <strong className="text-amber-300">Jarretières OS2 (1FO / 2FO)</strong>.
                      </p>

                      <div className="space-y-3">
                        {currentRackEquipments.map((eq) => (
                          <div
                            key={`front-${eq.id}`}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-3.5"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <div>
                                <span className="text-xs font-mono font-bold text-amber-400">
                                  U{eq.uPosition}
                                </span>{' '}
                                <span className="text-xs font-bold text-slate-100">
                                  {eq.name}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                Façade {eq.ports.length} Ports
                              </span>
                            </div>

                            <div className="grid grid-cols-6 gap-1.5">
                              {eq.ports.map((port) => {
                                const fib = port.connectedFiberId
                                  ? site.fibers.find((f) => f.id === port.connectedFiberId)
                                  : undefined;
                                const isJarretiere = fib && fib.kind !== 'trunk_cable';
                                return (
                                  <button
                                    key={port.id}
                                    onClick={() => {
                                      onSelectEntity({
                                        kind: 'port',
                                        id: port.id,
                                        equipmentId: eq.id,
                                      });
                                      onClose();
                                    }}
                                    className={`p-1.5 rounded border text-center transition-all ${
                                      isJarretiere
                                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                        : port.status === 'connected'
                                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="text-[10px] font-mono font-bold">
                                      P{String(port.number).padStart(2, '0')}
                                    </div>
                                    <div className="text-[8px] font-mono truncate">
                                      {isJarretiere ? 'Jarretière' : port.status === 'connected' ? 'Actif' : 'Libre'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* COLUMN 2: BAIE ARRIÈRE (FOND DE BAIE & CÂBLES ROCADES)    */}
                  {/* ========================================================= */}
                  {(elevationFaceMode === 'both' || elevationFaceMode === 'rear') && (
                    <div className="bg-slate-900/70 border border-sky-500/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[11px] font-mono font-bold uppercase text-sky-400">
                            ▲ BAIE ARRIÈRE (FOND DE BAIE · ROCADES)
                          </span>
                          <h4 className="text-sm font-bold text-slate-100">
                            {currentRack?.calepinage.rearFaceLabel}
                          </h4>
                        </div>
                        {onFocusRack3D && currentRack && (
                          <button
                            onClick={() => {
                              onFocusRack3D(currentRack.id, 'rear');
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg"
                          >
                            Caméra 3D Arrière →
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400">
                        Face arrière technique : arrivée des <strong className="text-sky-300">Câbles Fibres Optiques de Rocade (12FO / 24FO)</strong> sur le boîtier d&apos;épanouissement arrière des tiroirs optiques.
                      </p>

                      <div className="space-y-3">
                        {currentRackEquipments.map((eq) => {
                          const isPatchPanel = eq.category === 'patch_panel';
                          const rearTrunkFibers = site.fibers.filter(
                            (f) =>
                              f.kind === 'trunk_cable' &&
                              (f.sourceEquipmentId === eq.id || f.targetEquipmentId === eq.id)
                          );

                          return (
                            <div
                              key={`rear-${eq.id}`}
                              className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-xs font-mono font-bold text-sky-400">
                                    U{eq.uPosition} (Arrière)
                                  </span>{' '}
                                  <span className="text-xs font-bold text-slate-100">
                                    {eq.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-800">
                                  {isPatchPanel
                                    ? `Tête de Câble Arrière ${eq.trunkCapacity || '24FO'}`
                                    : 'Alimentations Redondantes A+B'}
                                </span>
                              </div>

                              {isPatchPanel ? (
                                <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/40 space-y-2">
                                  <div className="text-xs font-semibold text-sky-300">
                                    Boîtier d&apos;Épanouissement Optique Arrière ({eq.trunkCapacity || '24FO'} OS2)
                                  </div>
                                  {rearTrunkFibers.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {rearTrunkFibers.map((tf) => (
                                        <div
                                          key={tf.id}
                                          onClick={() => {
                                            onSelectEntity({ kind: 'fiber', id: tf.id });
                                            onClose();
                                          }}
                                          className="p-2 rounded bg-slate-900/90 border border-sky-500/40 hover:border-sky-400 cursor-pointer flex items-center justify-between text-xs"
                                        >
                                          <div>
                                            <div className="font-mono font-bold text-white">
                                              {tf.code} · Rocade {tf.trunkCapacity || '24FO'}
                                            </div>
                                            <div className="text-[11px] text-slate-300">
                                              {tf.activeStrandsUsed || 'Brins OS2 raccordés en cassette arrière'}
                                            </div>
                                          </div>
                                          <span className="text-[11px] font-mono text-sky-400">
                                            {tf.lengthMeters} m →
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-400">
                                      Presse-étoupe arrière prêt à recevoir un câble de rocade (6FO / 12FO / 24FO).
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                  <span>
                                    Face arrière châssis actif : 2× Alimentations AC/DC + Ventilation Arrière
                                  </span>
                                  <span className="font-mono text-emerald-400">PSU OK</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
