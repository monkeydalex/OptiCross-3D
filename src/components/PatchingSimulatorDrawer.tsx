import React, { useState, useEffect } from 'react';
import {
  Cable,
  Plus,
  Trash2,
  X,
  Activity,
  MousePointerClick,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import {
  TelecomSite,
  FiberConnection,
  ConnectorType,
  EndToEndCrossConnect,
  PolarityMode,
  TrunkCapacityFO,
  ResponsibilityOwner,
} from '../types/telecom';
import { calculateSegmentLossDb } from '../utils/opticalCalculations';

interface PatchingSimulatorDrawerProps {
  site: TelecomSite;
  onAddFiber: (fiber: FiberConnection, attachToCrossConnectId?: string) => void;
  onRemoveFiber: (fiberId: string) => void;
  onAddCrossConnect: (xc: EndToEndCrossConnect) => void;
  patchingDraftSource: { equipmentId: string; portId: string } | null;
  onClearDraftSource: () => void;
  isPatchingMode: boolean;
  onTogglePatchingMode: (enabled: boolean) => void;
  selectedCrossConnectId: string;
  onSelectCrossConnect: (xcId: string) => void;
  onClose: () => void;
}

export const PatchingSimulatorDrawer: React.FC<PatchingSimulatorDrawerProps> = ({
  site,
  onAddFiber,
  onRemoveFiber,
  onAddCrossConnect,
  patchingDraftSource,
  onClearDraftSource,
  isPatchingMode,
  onTogglePatchingMode,
  selectedCrossConnectId,
  onSelectCrossConnect,
  onClose,
}) => {
  const [cableKind, setCableKind] = useState<
    'cross_connect_jumper' | 'patch_cord' | 'trunk_cable'
  >('cross_connect_jumper');

  const [polarity, setPolarity] = useState<PolarityMode>('Bi-Fibre (2FO Duplex)');
  const [trunkCapacity, setTrunkCapacity] = useState<TrunkCapacityFO>('24FO');

  const [sourceEqId, setSourceEqId] = useState<string>(
    patchingDraftSource?.equipmentId || 'eq-mmr-tiroir-sfr-24fo'
  );
  const [sourcePortId, setSourcePortId] = useState<string>(
    patchingDraftSource?.portId || ''
  );

  const [targetEqId, setTargetEqId] = useState<string>('eq-mmr-tiroir-cli-12fo');
  const [targetPortId, setTargetPortId] = useState<string>('');

  const [connectorA, setConnectorA] = useState<ConnectorType>('LC/APC');
  const [connectorB, setConnectorB] = useState<ConnectorType>('LC/APC');
  const [lengthMeters, setLengthMeters] = useState<number>(5.0);
  const [spliceCount, setSpliceCount] = useState<number>(0);
  const [selectedPathwayId, setSelectedPathwayId] = useState<string>('path-mmr-loop');
  const [attachToXcId, setAttachToXcId] = useState<string>(selectedCrossConnectId);
  const [customLabel, setCustomLabel] = useState<string>('');

  // New End-to-End Cross-Connect order creation state
  const [newXcName, setNewXcName] = useState<string>('');
  const [newXcPolarity, setNewXcPolarity] = useState<PolarityMode>('Bi-Fibre (2FO Duplex)');
  const [newXcOrderNum, setNewXcOrderNum] = useState<string>('CMD-XC-2026-9104');

  // Sync when user clicks a port in 3D while in Patching Mode
  useEffect(() => {
    if (patchingDraftSource) {
      setSourceEqId(patchingDraftSource.equipmentId);
      setSourcePortId(patchingDraftSource.portId);
    }
  }, [patchingDraftSource]);

  // Preset sensible defaults when user switches between the 3 telecom cable categories
  const handleSelectCableCategory = (
    kind: 'cross_connect_jumper' | 'patch_cord' | 'trunk_cable'
  ) => {
    setCableKind(kind);
    if (kind === 'cross_connect_jumper') {
      // MMR Cross-Connect between MMR-OP (SFR 24FO arrival) and MMR-CLI (Client 12FO arrival)
      setSourceEqId('eq-mmr-tiroir-sfr-24fo');
      setTargetEqId('eq-mmr-tiroir-cli-12fo');
      setLengthMeters(5.0);
      setSpliceCount(0);
      setSelectedPathwayId('path-mmr-loop');
    } else if (kind === 'patch_cord') {
      // Intra-room patch cord (e.g. inside Baie SFR or inside Baie Client)
      setSourceEqId('eq-sfr-router');
      setTargetEqId('eq-sfr-tiroir-24fo');
      setLengthMeters(2.5);
      setSpliceCount(0);
      setSelectedPathwayId('path-op-branch');
    } else {
      // Inter-room Multi-Fiber Trunk Cable (6FO / 12FO / 24FO) deployed by Hébergeur Tiers
      setSourceEqId('eq-sfr-tiroir-24fo');
      setTargetEqId('eq-mmr-tiroir-sfr-24fo');
      setTrunkCapacity('24FO');
      setLengthMeters(45.0);
      setSpliceCount(2);
      setSelectedPathwayId('path-main-spine');
    }
  };

  const sourceEq = site.equipments.find((e) => e.id === sourceEqId) || site.equipments[0];
  const targetEq = site.equipments.find((e) => e.id === targetEqId) || site.equipments[1];

  const sourceRack = site.racks.find((r) => r.id === sourceEq?.rackId);
  const targetRack = site.racks.find((r) => r.id === targetEq?.rackId);
  const sourceRoom = site.rooms.find((rm) => rm.id === sourceRack?.roomId);
  const targetRoom = site.rooms.find((rm) => rm.id === targetRack?.roomId);

  const isSameRoom = sourceRoom?.id === targetRoom?.id;
  const isMmrRoom = sourceRoom?.type === 'mmr' && targetRoom?.type === 'mmr';

  // Telecom Domain Validation Rule:
  // - Jarretières ('patch_cord' or 'cross_connect_jumper') MUST stay within the SAME room!
  // - Câbles Rocades ('trunk_cable' 6FO/12FO/24FO) MUST connect a room (Opérateur or Client) to the Salle MMR!
  let ruleValidationError: string | null = null;
  if (cableKind !== 'trunk_cable' && !isSameRoom) {
    ruleValidationError =
      'Règle Télécom : Une jarretière optique ne peut relier que des baies situées dans la MÊME salle. Pour relier une salle (Opérateur ou Client) à la Salle MMR, sélectionnez "Câble Fibre Rocade (6FO / 12FO / 24FO)".';
  } else if (cableKind === 'cross_connect_jumper' && !isMmrRoom) {
    ruleValidationError =
      'Règle MMR : Une commande Cross-Connect se réalise exclusivement dans la Salle MMR (entre la Baie MMR Opérateur et la Baie MMR Client) par l\'Hébergeur Tiers.';
  } else if (cableKind === 'trunk_cable' && isSameRoom) {
    ruleValidationError =
      'Règle Télécom : Un câble rocade multi-fibres (6FO/12FO/24FO) sert à relier une salle (Salle Opérateur ou Salle Client) vers la Salle MMR. Dans une même salle, utilisez une Jarretière Optique.';
  }

  useEffect(() => {
    if (sourceEq && !sourceEq.ports.some((p) => p.id === sourcePortId)) {
      const freePort = sourceEq.ports.find((p) => p.status === 'free') || sourceEq.ports[0];
      if (freePort) {
        setSourcePortId(freePort.id);
        setConnectorA(freePort.connector);
      }
    }
  }, [sourceEq, sourcePortId]);

  useEffect(() => {
    if (targetEq && !targetEq.ports.some((p) => p.id === targetPortId)) {
      const freePort =
        targetEq.ports.find((p) => p.status === 'free' && p.id !== sourcePortId) ||
        targetEq.ports[0];
      if (freePort) {
        setTargetPortId(freePort.id);
        setConnectorB(freePort.connector);
      }
    }
  }, [targetEq, targetPortId, sourcePortId]);

  const simulatedLossDb = calculateSegmentLossDb(
    'OS2',
    1310,
    lengthMeters,
    connectorA,
    connectorB,
    spliceCount
  );

  const handleCreateFiber = (e: React.FormEvent) => {
    e.preventDefault();
    if (ruleValidationError) return;
    if (!sourceEq || !targetEq || !sourcePortId || !targetPortId) return;
    if (sourcePortId === targetPortId) return;

    const srcPort = sourceEq.ports.find((p) => p.id === sourcePortId);
    const dstPort = targetEq.ports.find((p) => p.id === targetPortId);
    const codeNumber = String(site.fibers.length + 1).padStart(3, '0');

    let codePrefix = 'JAR-OS2';
    let jacketHex = '#facc15';
    let responsibility: ResponsibilityOwner = 'Client Final (Baie Client)';

    if (cableKind === 'cross_connect_jumper') {
      codePrefix = polarity.includes('Mono') ? 'JAR-XC-MONO' : 'JAR-XC-BI';
      jacketHex = '#f59e0b';
      responsibility = 'Hébergeur Tiers (Accès Exclusif MMR)';
    } else if (cableKind === 'trunk_cable') {
      codePrefix = `CABLE-${trunkCapacity}`;
      jacketHex = '#0284c7';
      responsibility = 'Hébergeur Tiers (Accès Exclusif MMR)';
    } else {
      codePrefix = sourceRoom?.type === 'operator' ? 'JAR-SFR' : 'JAR-CLI';
      jacketHex = '#facc15';
      responsibility =
        sourceRoom?.type === 'operator'
          ? 'Opérateur Télécom (Baie SFR)'
          : 'Client Final (Baie Client)';
    }

    const newFiber: FiberConnection = {
      id: `fib-custom-${Date.now()}`,
      name:
        customLabel.trim() ||
        (cableKind === 'trunk_cable'
          ? `Câble Fibre Rocade ${trunkCapacity} (${sourceRack?.code} → ${targetRack?.code})`
          : cableKind === 'cross_connect_jumper'
          ? `Jarretière Cross-Connect MMR ${polarity} (${sourceEq.code} ${srcPort?.label} ↔ ${targetEq.code} ${dstPort?.label})`
          : `Jarretière Optique Intra-Salle ${polarity} (${sourceEq.code} ${srcPort?.label} → ${targetEq.code} ${dstPort?.label})`),
      code: `${codePrefix}-${codeNumber}`,
      kind: cableKind,
      sourceEquipmentId: sourceEq.id,
      sourcePortId,
      targetEquipmentId: targetEq.id,
      targetPortId,
      fiberMode: 'OS2',
      polarity,
      trunkCapacity: cableKind === 'trunk_cable' ? trunkCapacity : undefined,
      activeStrandsUsed:
        cableKind === 'trunk_cable'
          ? polarity.includes('Bi-Fibre')
            ? `2 Brins Actifs (TX/RX) sur Câble ${trunkCapacity}`
            : `1 Brin Actif (Simplex BiDi) sur Câble ${trunkCapacity}`
          : undefined,
      responsibility,
      connectorA,
      connectorB,
      JacketColorHex: jacketHex,
      lengthMeters,
      pathwayIds: [selectedPathwayId],
      attenuationDb: simulatedLossDb,
      spliceCount,
      installedDate: new Date().toISOString().slice(0, 10),
      customAttributes: [
        {
          id: `attr-${Date.now()}-1`,
          key: 'Type Physique',
          value:
            cableKind === 'trunk_cable'
              ? `Câble Rocade Structuré ${trunkCapacity} OS2 (Arrière Tiroir)`
              : `Jarretière Optique Souple ${polarity} OS2 (Face Avant)`,
        },
        {
          id: `attr-${Date.now()}-2`,
          key: 'Responsabilité',
          value: responsibility,
        },
      ],
    };

    onAddFiber(newFiber, attachToXcId || undefined);
    setCustomLabel('');
    onClearDraftSource();
  };

  const handleCreateCrossConnectCircuit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newXcName.trim()) return;
    const idx = String(site.crossConnects.length + 1).padStart(3, '0');
    const newXc: EndToEndCrossConnect = {
      id: `xc-circuit-${Date.now()}`,
      name: newXcName.trim(),
      reference: newXcPolarity.includes('Mono')
        ? `XC-MONOFIBRE-${idx}`
        : `XC-BIFIBRE-${idx}`,
      orderNumber: newXcOrderNum,
      polarity: newXcPolarity,
      clientName: 'Salle Client — Baie Client (Câble 12FO)',
      operatorName: 'Salle Opérateur — Baie SFR (Câble 24FO)',
      serviceType: newXcPolarity.includes('Mono')
        ? '10GBASE-BX BiDi Mono-Fibre Simplex OS2 (1270/1330 nm)'
        : '100GBASE-LR4 Bi-Fibre Duplex OS2 (1310 nm)',
      wavelengthNm: 1310,
      fiberIds: [],
      active: true,
      customAttributes: [
        { id: `xca-${Date.now()}-1`, key: 'Polarité Commande', value: newXcPolarity },
        { id: `xca-${Date.now()}-2`, key: 'Standard Fibre', value: '100% Monomode OS2' },
      ],
    };
    onAddCrossConnect(newXc);
    onSelectCrossConnect(newXc.id);
    setAttachToXcId(newXc.id);
    setNewXcName('');
  };

  return (
    <div className="fixed top-14 right-0 bottom-0 w-full max-w-[490px] bg-slate-900 border-l border-slate-800 z-30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Cable className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Simulateur Jarretières vs Câbles Rocades (100% OS2)
            </h2>
            <p className="text-[11px] text-slate-400">
              Cross-Connect MMR (Mono/Bi-Fibre) · Câbles 24FO SFR &amp; 12FO Client
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive 3D Port Click Mode Toggle Banner */}
      <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-300">
          <span className="font-semibold text-slate-100">Brassage Direct en 3D :</span>{' '}
          Cliquez sur 2 ports en 3D pour poser une jarretière OS2.
        </div>
        <button
          onClick={() => onTogglePatchingMode(!isPatchingMode)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            isPatchingMode
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          {isPatchingMode ? 'Mode 3D Actif' : 'Activer Clic 3D'}
        </button>
      </div>

      {/* Body Scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Educational Banner Explaining Jarretière vs Câble Rocade */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="font-bold text-slate-100">
            Règle d&apos;Architecture Télécom &amp; Hébergeur (Monomode OS2) :
          </div>
          <p className="text-slate-300 leading-relaxed">
            1. <strong className="text-sky-400">Câbles Fibres Rocades (6FO, 12FO, 24FO)</strong> : Déployés par l&apos;<strong>Hébergeur Tiers</strong> entre les salles (<em>Baie SFR 24FO → Salle MMR</em> et <em>Baie Client 12FO → Salle MMR</em>), car seul l&apos;hébergeur a accès à la Salle MMR.
          </p>
          <p className="text-slate-300 leading-relaxed">
            2. <strong className="text-amber-400">Jarretières Optiques (Mono-Fibre ou Bi-Fibre)</strong> : Utilisées uniquement dans une <strong>même salle</strong> (brassage local en Baie SFR/Client, ou <strong>Cross-Connect MMR</strong> entre les 2 baies MMR lors d&apos;une commande).
          </p>
        </div>

        {/* Form 1: Create Jarretière or Câble Rocade */}
        <form onSubmit={handleCreateFiber} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Choisir la Nature Physique de la Liaison (100% OS2 Monomode)
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleSelectCableCategory('cross_connect_jumper')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  cableKind === 'cross_connect_jumper'
                    ? 'bg-amber-500/15 border-amber-400 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">
                    A. Jarretière Cross-Connect en Salle MMR (Commande XC)
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    Resp. Hébergeur Tiers
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Relie en face avant la Baie MMR Opérateur (24FO SFR) et la Baie MMR Client (12FO Client).
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCableCategory('patch_cord')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  cableKind === 'patch_cord'
                    ? 'bg-amber-500/15 border-amber-400 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-yellow-300">
                    B. Jarretière Optique Intra-Salle (Même Salle uniquement)
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    Opérateur ou Client
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Relie un routeur/switch à son tiroir optique ou 2 baies dans la même salle.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCableCategory('trunk_cable')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  cableKind === 'trunk_cable'
                    ? 'bg-sky-500/15 border-sky-400 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">
                    C. Câble Fibre Optique Rocade (6FO / 12FO / 24FO / 48FO)
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    Resp. Hébergeur Tiers
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Câble structuré inter-salles raccordé à l&apos;arrière des tiroirs (Baie SFR → MMR ou Baie Client → MMR).
                </p>
              </button>
            </div>
          </div>

          {/* Polarity (Mono-Fibre vs Bi-Fibre) & Trunk Capacity (6FO / 12FO / 24FO / 48FO) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Polarité (Mono-Fibre ou Bi-Fibre)
              </label>
              <select
                value={polarity}
                onChange={(e) => setPolarity(e.target.value as PolarityMode)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              >
                <option value="Bi-Fibre (2FO Duplex)">Bi-Fibre (2FO Duplex TX/RX)</option>
                <option value="Mono-Fibre (1FO Simplex)">Mono-Fibre (1FO Simplex BiDi)</option>
              </select>
            </div>

            {cableKind === 'trunk_cable' ? (
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Capacité Câble Rocade
                </label>
                <select
                  value={trunkCapacity}
                  onChange={(e) => setTrunkCapacity(e.target.value as TrunkCapacityFO)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-sky-500/60 rounded-lg text-sky-300"
                >
                  <option value="6FO">Câble 6FO OS2</option>
                  <option value="12FO">Câble 12FO OS2 (Standard Client)</option>
                  <option value="24FO">Câble 24FO OS2 (Standard Opérateur SFR)</option>
                  <option value="48FO">Câble 48FO OS2 (Haute Densité)</option>
                  <option value="72FO">Câble 72FO OS2</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Standard Fibre Optique
                </label>
                <div className="px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-amber-400">
                  OS2 Monomode 9/125µm
                </div>
              </div>
            )}
          </div>

          {/* Endpoint A (Source) */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-400">
                Extrémité A — Départ ({sourceRoom?.name.split('(')[0]})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {sourceRack?.code}
              </span>
            </div>
            <div>
              <select
                value={sourceEqId}
                onChange={(e) => setSourceEqId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
              >
                {site.equipments.map((eq) => {
                  const rk = site.racks.find((r) => r.id === eq.rackId);
                  const rm = site.rooms.find((room) => room.id === rk?.roomId);
                  return (
                    <option key={eq.id} value={eq.id}>
                      [{rm?.code} · {rk?.code}] {eq.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Port Départ</label>
                <select
                  value={sourcePortId}
                  onChange={(e) => setSourcePortId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded text-slate-100"
                >
                  {sourceEq.ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.status === 'free' ? 'Libre' : 'Occupé'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Connecteur A</label>
                <select
                  value={connectorA}
                  onChange={(e) => setConnectorA(e.target.value as ConnectorType)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded text-slate-100"
                >
                  <option value="LC/APC">LC/APC (Vert 8° OS2)</option>
                  <option value="LC/UPC">LC/UPC (Bleu 0° OS2)</option>
                  <option value="SC/APC">SC/APC (Vert 8° OS2)</option>
                  <option value="SC/UPC">SC/UPC (Bleu 0° OS2)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Endpoint B (Target) */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                Extrémité B — Arrivée ({targetRoom?.name.split('(')[0]})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {targetRack?.code}
              </span>
            </div>
            <div>
              <select
                value={targetEqId}
                onChange={(e) => setTargetEqId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
              >
                {site.equipments.map((eq) => {
                  const rk = site.racks.find((r) => r.id === eq.rackId);
                  const rm = site.rooms.find((room) => room.id === rk?.roomId);
                  return (
                    <option key={eq.id} value={eq.id}>
                      [{rm?.code} · {rk?.code}] {eq.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Port Arrivée</label>
                <select
                  value={targetPortId}
                  onChange={(e) => setTargetPortId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded text-slate-100"
                >
                  {targetEq.ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.status === 'free' ? 'Libre' : 'Occupé'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Connecteur B</label>
                <select
                  value={connectorB}
                  onChange={(e) => setConnectorB(e.target.value as ConnectorType)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded text-slate-100"
                >
                  <option value="LC/APC">LC/APC (Vert 8° OS2)</option>
                  <option value="LC/UPC">LC/UPC (Bleu 0° OS2)</option>
                  <option value="SC/APC">SC/APC (Vert 8° OS2)</option>
                  <option value="SC/UPC">SC/UPC (Bleu 0° OS2)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Validation Rule Feedback */}
          {ruleValidationError ? (
            <div className="p-3 bg-rose-950/60 border border-rose-500/60 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{ruleValidationError}</span>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Conforme aux règles d&apos;ingénierie :{' '}
                {cableKind === 'trunk_cable'
                  ? `Câble Rocade ${trunkCapacity} inter-salles déployé par l'Hébergeur Tiers.`
                  : cableKind === 'cross_connect_jumper'
                  ? `Jarretière Cross-Connect MMR (${polarity}) posée par l'Hébergeur Tiers.`
                  : `Jarretière optique intra-salle (${polarity}) dans ${sourceRoom?.code}.`}
              </span>
            </div>
          )}

          {/* Length & Attach to Cross-Connect */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Longueur (m) &amp; Épissures
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.5}
                  max={500}
                  step={0.5}
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={spliceCount}
                  onChange={(e) => setSpliceCount(Number(e.target.value))}
                  title="Nombre d'épissures"
                  className="w-16 px-2 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Rattacher à la Commande XC
              </label>
              <select
                value={attachToXcId}
                onChange={(e) => setAttachToXcId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              >
                <option value="">Aucune (Tronçon indépendant)</option>
                {site.crossConnects.map((xc) => (
                  <option key={xc.id} value={xc.id}>
                    {xc.reference} ({xc.polarity.slice(0, 10)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Optical Simulation Preview Box */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Bilan d&apos;Atténuation OTDR (OS2 1310nm)
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {polarity} · {connectorA} ↔ {connectorB}
                </div>
              </div>
            </div>
            <div className="text-sm font-mono font-bold tabular-nums text-amber-400">
              -{simulatedLossDb.toFixed(2)} dB
            </div>
          </div>

          <button
            type="submit"
            disabled={Boolean(ruleValidationError)}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {cableKind === 'trunk_cable'
              ? `Déployer le Câble Rocade ${trunkCapacity} en 3D`
              : `Poser la Jarretière ${polarity.split(' ')[0]} en 3D`}
          </button>
        </form>

        {/* Section 2: Create a New End-to-End Cross-Connect Order */}
        <div className="pt-5 border-t border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            2. Nouvelle Commande Cross-Connect MMR (Mono-Fibre ou Bi-Fibre)
          </h3>
          <form onSubmit={handleCreateCrossConnectCircuit} className="space-y-2.5">
            <input
              type="text"
              placeholder="Intitulé (ex: Cross-Connect SFR ↔ Client FinTech)"
              value={newXcName}
              onChange={(e) => setNewXcName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newXcPolarity}
                onChange={(e) => setNewXcPolarity(e.target.value as PolarityMode)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-amber-300"
              >
                <option value="Bi-Fibre (2FO Duplex)">Bi-Fibre (2FO Duplex)</option>
                <option value="Mono-Fibre (1FO Simplex)">Mono-Fibre (1FO Simplex)</option>
              </select>
              <input
                type="text"
                placeholder="N° Commande"
                value={newXcOrderNum}
                onChange={(e) => setNewXcOrderNum(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg border border-slate-700 transition-colors"
            >
              + Créer Commande Cross-Connect OS2
            </button>
          </form>
        </div>

        {/* Section 3: Active Fibers List Separated by Rocades vs Jarretières */}
        <div className="pt-5 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            3. Inventaire des Câbles Rocades &amp; Jarretières ({site.fibers.length})
          </h3>
          <div className="space-y-2">
            {site.fibers.map((fib) => (
              <div
                key={fib.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: fib.JacketColorHex }}
                    />
                    <span className="text-xs font-mono font-bold text-slate-100">
                      {fib.code}
                    </span>
                    <span className="text-[11px] font-mono text-amber-400">
                      {fib.kind === 'trunk_cable'
                        ? `CÂBLE ROCADE ${fib.trunkCapacity || '24FO'}`
                        : `JARRETIÈRE (${fib.polarity.split(' ')[0]})`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">{fib.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {fib.responsibility} · {fib.lengthMeters}m · -{fib.attenuationDb}dB
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFiber(fib.id)}
                  title="Supprimer ce tronçon"
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-900 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
