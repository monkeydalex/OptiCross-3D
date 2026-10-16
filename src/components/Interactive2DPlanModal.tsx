import React, { useState } from 'react';
import {
  FileDown,
  FileCode2,
  Layers,
  GitCommitHorizontal,
  Server,
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { TelecomSite, SelectedEntityRef } from '../types/telecom';
import { OpticalBudgetReport } from '../utils/opticalCalculations';
import {
  downloadSvgEngineeringDiagram,
  downloadPdfEngineeringReport,
} from '../utils/exportDocumentation';

interface Interactive2DPlanModalProps {
  site: TelecomSite;
  budget: OpticalBudgetReport;
  highlightedFiberIds: string[];
  selectedCrossConnectId: string;
  onSelectCrossConnect: (xcId: string) => void;
  onSelectEntity: (entity: SelectedEntityRef) => void;
  onClose: () => void;
}

export const Interactive2DPlanModal: React.FC<Interactive2DPlanModalProps> = ({
  site,
  budget,
  highlightedFiberIds,
  selectedCrossConnectId,
  onSelectCrossConnect,
  onSelectEntity,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<'logical_physical' | 'rack_elevation'>('logical_physical');
  const [selectedRackId, setSelectedRackId] = useState<string>(site.racks[0]?.id);

  const activeSet = new Set(highlightedFiberIds);

  const mapX = (xM: number) => Math.round(520 + xM * 42);
  const mapZ = (zM: number) => Math.round(165 + zM * 25);

  const currentRack = site.racks.find((r) => r.id === selectedRackId) || site.racks[0];
  const currentRackEquipments = site.equipments
    .filter((eq) => eq.rackId === currentRack?.id)
    .sort((a, b) => b.uPosition - a.uPosition);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4 md:p-6">
      <div className="w-full max-w-[1380px] h-[91vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Plan Interactif 2D &amp; Schéma Logique Cross-Connect (100% Monomode OS2)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mise en évidence : <strong className="text-sky-400">Câble Rocade 24FO (Baie SFR → MMR)</strong> <span aria-hidden="true">·</span>{' '}
              <strong className="text-amber-400">Jarretière Cross-Connect MMR (Mono/Bi-Fibre)</strong> <span aria-hidden="true">·</span>{' '}
              <strong className="text-sky-400">Câble Rocade 12FO (Baie Client → MMR)</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                Plan 2D &amp; Schéma Logique
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
                Élévation des Baies 42U
              </button>
            </div>

            <button
              onClick={() => downloadSvgEngineeringDiagram(site, budget)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-4 h-4 text-sky-400" />
              Exporter SVG
            </button>
            <button
              onClick={() => downloadPdfEngineeringReport(site, budget)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-4 h-4" />
              Exporter PDF
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
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
              Cas d&apos;usage Monomode OS2 :
            </span>
            {site.crossConnects.map((xc) => (
              <button
                key={xc.id}
                onClick={() => onSelectCrossConnect(xc.id)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
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
              Longueur: <strong className="text-slate-100">{budget.totalLengthMeters} m</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Perte Totale: <strong className="text-amber-400">-{budget.totalAttenuationDb.toFixed(2)} dB</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Bilan RX: <strong className="text-emerald-400">{budget.rxPowerDbm.toFixed(2)} dBm</strong>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {subTab === 'logical_physical' ? (
            <>
              {/* 1. Interactive 2D Physical Floor Plan */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      01. Plan Physique Interactif 2D — Différenciation Jarretières (Intra-Salle) vs Câbles Rocades 24FO/12FO (Inter-Salles)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Seul l&apos;Hébergeur Tiers a accès à la Salle MMR et déploie les câbles structurés (24FO côté Baie SFR, 12FO côté Baie Client).
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-2 rounded-xs bg-sky-500 inline-block" />
                      <strong>Câble Rocade (24FO / 12FO)</strong> — Inter-salles (Hébergeur)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-1 rounded-xs bg-amber-400 inline-block" />
                      <strong>Jarretière OS2 (1FO / 2FO)</strong> — Intra-salle &amp; Cross-Connect MMR
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto bg-slate-900/50 border border-slate-800/80 rounded-lg">
                  <svg
                    viewBox="0 0 1040 340"
                    className="w-full h-auto min-w-[860px] select-none"
                  >
                    <defs>
                      <pattern id="grid2d" width="26" height="26" patternUnits="userSpaceOnUse">
                        <path
                          d="M 26 0 L 0 0 0 26"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="0.6"
                        />
                      </pattern>
                    </defs>
                    <rect width="1040" height="340" fill="url(#grid2d)" />

                    {/* Rooms */}
                    {site.rooms.map((rm) => {
                      const rx = mapX(rm.bounds.x - rm.bounds.width / 2);
                      const ry = mapZ(rm.bounds.z - rm.bounds.depth / 2);
                      const rw = Math.round(rm.bounds.width * 42);
                      const rh = Math.round(rm.bounds.depth * 25);
                      return (
                        <g
                          key={rm.id}
                          onClick={() => onSelectEntity({ kind: 'room', id: rm.id })}
                          className="cursor-pointer"
                        >
                          <rect
                            x={rx}
                            y={ry}
                            width={rw}
                            height={rh}
                            rx={8}
                            fill="#090d16"
                            fillOpacity={0.88}
                            stroke={rm.colorHex}
                            strokeWidth={2}
                          />
                          <rect
                            x={rx}
                            y={ry}
                            width={rw}
                            height={34}
                            rx={6}
                            fill={rm.colorHex}
                            fillOpacity={0.22}
                          />
                          <text
                            x={rx + 10}
                            y={ry + 15}
                            fill="#f8fafc"
                            fontSize="11"
                            fontWeight="700"
                          >
                            {rm.name}
                          </text>
                          <text
                            x={rx + 10}
                            y={ry + 28}
                            fill="#cbd5e1"
                            fontSize="8.8"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {rm.type === 'mmr'
                              ? 'ACCÈS EXCLUSIF HÉBERGEUR TIERS'
                              : rm.type === 'operator'
                              ? 'Départ Câble 24FO vers MMR'
                              : 'Départ Câble 12FO vers MMR'}
                          </text>
                        </g>
                      );
                    })}

                    {/* Cable Pathways */}
                    {site.pathways.map((pw) => {
                      if (pw.waypoints.length < 2) return null;
                      const pts = pw.waypoints
                        .map(([x, , z]) => `${mapX(x)},${mapZ(z)}`)
                        .join(' ');
                      return (
                        <g
                          key={pw.id}
                          onClick={() => onSelectEntity({ kind: 'pathway', id: pw.id })}
                          className="cursor-pointer"
                        >
                          <polyline
                            points={pts}
                            fill="none"
                            stroke={pw.colorHex}
                            strokeOpacity={0.18}
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })}

                    {/* Fibers on 2D Floor Plan: Thick Double-Stroked Trunk Cables vs Thin Jarretières */}
                    {site.fibers.map((fib, idx) => {
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
                      const isActive = activeSet.has(fib.id);
                      const isTrunk = fib.kind === 'trunk_cable';
                      const offset = (idx % 3 - 1) * 5;
                      const midY = mapZ(0) + offset;

                      const d =
                        rkA.id === rkB.id
                          ? `M ${x1 - 24} ${y1} C ${x1 - 56} ${y1 - 38}, ${x1 + 56} ${y1 - 38}, ${x1 + 24} ${y1}`
                          : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

                      const midX = Math.round((x1 + x2) / 2);

                      return (
                        <g
                          key={fib.id}
                          onClick={() => onSelectEntity({ kind: 'fiber', id: fib.id })}
                          className="cursor-pointer"
                        >
                          {/* Outer sheath for Multi-Fiber Trunk Cable */}
                          {isTrunk && (
                            <path
                              d={d}
                              fill="none"
                              stroke="#0369a1"
                              strokeWidth={isActive ? 9 : 5}
                              strokeOpacity={isActive ? 0.9 : 0.45}
                            />
                          )}
                          <path
                            d={d}
                            fill="none"
                            stroke={isActive ? fib.JacketColorHex : '#475569'}
                            strokeWidth={isTrunk ? (isActive ? 4.5 : 2.5) : isActive ? 3 : 1.5}
                            strokeDasharray={!isTrunk && fib.polarity.includes('Mono') ? '5,3' : undefined}
                            strokeOpacity={isActive ? 1 : 0.45}
                          />

                          {/* Callout Badge on Active Trunk Cables & MMR Cross-Connect */}
                          {isActive && isTrunk && (
                            <g>
                              <rect
                                x={midX - 74}
                                y={midY - 26}
                                width={148}
                                height={22}
                                rx={4}
                                fill="#0c4a6e"
                                stroke="#38bdf8"
                                strokeWidth={1.2}
                              />
                              <text
                                x={midX}
                                y={midY - 12}
                                textAnchor="middle"
                                fill="#f8fafc"
                                fontSize="9.5"
                                fontWeight="700"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                CÂBLE ROCADE {fib.trunkCapacity || '24FO'} (Hébergeur)
                              </text>
                            </g>
                          )}

                          {isActive && fib.kind === 'cross_connect_jumper' && (
                            <g>
                              <rect
                                x={midX - 78}
                                y={y1 + 26}
                                width={156}
                                height={22}
                                rx={4}
                                fill="#451a03"
                                stroke="#f59e0b"
                                strokeWidth={1.2}
                              />
                              <text
                                x={midX}
                                y={y1 + 40}
                                textAnchor="middle"
                                fill="#fde68a"
                                fontSize="9"
                                fontWeight="700"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                JARRETIÈRE XC ({fib.polarity.split(' ')[0]})
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Racks */}
                    {site.racks.map((rk) => {
                      const cx = mapX(rk.position3D[0]);
                      const cz = mapZ(rk.position3D[2]);
                      const rw = 94;
                      const rh = 46;
                      const eqs = site.equipments.filter((e) => e.rackId === rk.id);
                      const hasActiveHop = budget.hops.some(
                        (h) => h.sourceRack.id === rk.id || h.targetRack.id === rk.id
                      );
                      return (
                        <g
                          key={rk.id}
                          onClick={() => {
                            setSelectedRackId(rk.id);
                            onSelectEntity({ kind: 'rack', id: rk.id });
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            x={cx - rw / 2}
                            y={cz - rh / 2}
                            width={rw}
                            height={rh}
                            rx={5}
                            fill="#1e293b"
                            stroke={hasActiveHop ? '#f59e0b' : '#64748b'}
                            strokeWidth={hasActiveHop ? 2.2 : 1.2}
                          />
                          <text
                            x={cx}
                            y={cz - 5}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="10"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {rk.code}
                          </text>
                          <text
                            x={cx}
                            y={cz + 11}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="8.5"
                          >
                            {rk.name.slice(0, 18)} ({eqs.length})
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* 2. End-to-End Logical Cross-Connect Chain */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <GitCommitHorizontal className="w-4 h-4 text-amber-400" />
                      02. Schéma Logique de Bout en Bout — Continuité Jarretière SFR → Câble 24FO → Cross-Connect MMR → Câble 12FO → Jarretière Client
                    </h3>
                    <p className="text-xs text-slate-400">
                      Détail de chaque segment physique, polarité (Mono-Fibre ou Bi-Fibre), capacité de rocade (24FO / 12FO) et responsabilité d&apos;exploitation.
                    </p>
                  </div>
                </div>

                {budget.hops.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Aucun tronçon optique sélectionné.
                  </p>
                ) : (
                  <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
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
                              className="min-w-[205px] bg-slate-900 border border-slate-700 hover:border-sky-400 rounded-lg p-3.5 cursor-pointer transition-colors flex flex-col justify-between"
                            >
                              <div>
                                <div className="text-[11px] font-mono text-sky-400 font-semibold">
                                  {hop.sourceRoom.code} · {hop.sourceRack.code}
                                </div>
                                <div className="text-xs font-bold text-slate-100 mt-1">
                                  {hop.sourceEquipment.name}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {hop.sourceEquipment.manufacturer} {hop.sourceEquipment.model}
                                </div>
                              </div>
                              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                                <span className="text-amber-400 font-semibold">
                                  {hop.sourcePort.label}
                                </span>
                                <span className="text-slate-400">{hop.sourcePort.connector}</span>
                              </div>
                            </div>
                          )}

                          {/* Segment Card Differentiating Câble Rocade vs Jarretière */}
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
                                    isTrunk
                                      ? 'text-sky-300 font-bold'
                                      : 'text-amber-300 font-bold'
                                  }
                                >
                                  {isTrunk
                                    ? `CÂBLE ROCADE ${hop.fiber.trunkCapacity || '24FO'}`
                                    : hop.fiber.kind === 'cross_connect_jumper'
                                    ? 'JARRETIÈRE CROSS-CONNECT MMR'
                                    : 'JARRETIÈRE INTRA-SALLE'}
                                </span>
                                <span className="text-slate-400">#{hop.stepIndex}</span>
                              </div>

                              <div className="text-xs font-mono font-bold text-slate-100 mt-1">
                                {hop.fiber.code}
                              </div>

                              <div className="w-full flex items-center gap-1 my-1.5">
                                <div
                                  className={isTrunk ? 'h-2 flex-1 rounded-xs' : 'h-1 flex-1 rounded-full'}
                                  style={{ backgroundColor: hop.fiber.JacketColorHex }}
                                />
                                <ArrowRight
                                  className="w-3.5 h-3.5 shrink-0"
                                  style={{ color: hop.fiber.JacketColorHex }}
                                />
                              </div>

                              <div className="text-[11px] text-slate-200 font-medium">
                                {hop.fiber.polarity}
                              </div>
                              {hop.fiber.activeStrandsUsed && (
                                <div className="text-[10px] font-mono text-sky-300 mt-0.5">
                                  {hop.fiber.activeStrandsUsed}
                                </div>
                              )}
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-0.5 text-[10px] font-mono">
                              <div className="text-slate-300 truncate">
                                Resp: {hop.fiber.responsibility.split('(')[0]}
                              </div>
                              <div className="flex items-center justify-between text-amber-400">
                                <span>OS2 · {hop.fiber.lengthMeters}m</span>
                                <span>-{hop.calculatedLossDb.toFixed(2)} dB</span>
                              </div>
                            </div>
                          </div>

                          {/* Target Node */}
                          <div
                            onClick={() =>
                              onSelectEntity({
                                kind: 'equipment',
                                id: hop.targetEquipment.id,
                              })
                            }
                            className="min-w-[205px] bg-slate-900 border border-slate-700 hover:border-emerald-400 rounded-lg p-3.5 cursor-pointer transition-colors flex flex-col justify-between"
                          >
                            <div>
                              <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                                {hop.targetRoom.code} · {hop.targetRack.code}
                              </div>
                              <div className="text-xs font-bold text-slate-100 mt-1">
                                {hop.targetEquipment.name}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Position U{hop.targetEquipment.uPosition} ({hop.targetEquipment.uHeight}U)
                              </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
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
          ) : (
            /* Rack Elevation View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Sélectionner une Baie Télécom (42U)
                </h3>
                <div className="space-y-2">
                  {site.racks.map((rk) => {
                    const rm = site.rooms.find((r) => r.id === rk.roomId);
                    const eqCount = site.equipments.filter((e) => e.rackId === rk.id).length;
                    return (
                      <button
                        key={rk.id}
                        onClick={() => setSelectedRackId(rk.id)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                          selectedRackId === rk.id
                            ? 'bg-slate-800 border-amber-500 text-slate-100'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {rk.code}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {rm?.code} · {rk.uTotal}U
                          </span>
                        </div>
                        <div className="text-sm font-semibold mt-1">{rk.name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {eqCount} équipements / tiroirs optiques OS2
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Élévation Frontale — {currentRack?.name} ({currentRack?.code})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cliquez sur un port optique OS2 pour l&apos;inspecter ou modifier ses attributs.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentRackEquipments.map((eq) => (
                    <div
                      key={eq.id}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-mono font-bold text-sky-400">
                            U{eq.uPosition}–U{eq.uPosition + eq.uHeight - 1}
                          </span>{' '}
                          <span aria-hidden="true">·</span>{' '}
                          <span className="text-sm font-bold text-slate-100">{eq.name}</span>{' '}
                          <span className="text-xs font-mono text-slate-400">({eq.code})</span>
                        </div>
                        <button
                          onClick={() => {
                            onSelectEntity({ kind: 'equipment', id: eq.id });
                            onClose();
                          }}
                          className="text-xs text-amber-400 hover:underline font-medium"
                        >
                          Éditer ce tiroir / équipement →
                        </button>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2 pt-2 border-t border-slate-800">
                        {eq.ports.map((port) => {
                          const isHighlighted =
                            port.connectedFiberId && activeSet.has(port.connectedFiberId);
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
                              className={`p-2 rounded border text-center transition-all ${
                                isHighlighted
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                  : port.status === 'connected'
                                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              <div className="text-[11px] font-mono font-bold">
                                P{String(port.number).padStart(2, '0')}
                              </div>
                              <div className="text-[9px] font-mono opacity-80 truncate">
                                {port.connector}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
