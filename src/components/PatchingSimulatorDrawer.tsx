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
  HelpCircle,
  Unplug,
  ArrowRight,
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
import { trunkJacketHex } from '../utils/fiberColors';

interface PatchingSimulatorDrawerProps {
  site: TelecomSite;
  onAddFiber: (fiber: FiberConnection, attachToCrossConnectId?: string) => void;
  onRemoveFiber: (fiberId: string) => void;
  onAddCrossConnect: (xc: EndToEndCrossConnect) => void;
  patchingDraftSource: { equipmentId: string; portId: string } | null;
  onSetDraftSource: (draft: { equipmentId: string; portId: string } | null) => void;
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
  onSetDraftSource,
  isPatchingMode,
  onTogglePatchingMode,
  selectedCrossConnectId,
  onSelectCrossConnect,
  onClose,
}) => {
  const [showGuide, setShowGuide] = useState<boolean>(true);
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

  // Sync when user clicks a port in 3D
  useEffect(() => {
    if (patchingDraftSource) {
      setSourceEqId(patchingDraftSource.equipmentId);
      setSourcePortId(patchingDraftSource.portId);
    }
  }, [patchingDraftSource]);

  const handleSelectCableCategory = (
    kind: 'cross_connect_jumper' | 'patch_cord' | 'trunk_cable'
  ) => {
    setCableKind(kind);
    if (kind === 'cross_connect_jumper') {
      setSourceEqId('eq-mmr-tiroir-sfr-24fo');
      setTargetEqId('eq-mmr-tiroir-cli-12fo');
      setLengthMeters(5.0);
      setSpliceCount(0);
      setSelectedPathwayId('path-mmr-loop');
    } else if (kind === 'patch_cord') {
      setSourceEqId('eq-sfr-router');
      setTargetEqId('eq-sfr-tiroir-24fo');
      setLengthMeters(2.5);
      setSpliceCount(0);
      setSelectedPathwayId('path-op-branch');
    } else {
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

  const selectedSourcePort = sourceEq?.ports.find((p) => p.id === sourcePortId);
  const selectedTargetPort = targetEq?.ports.find((p) => p.id === targetPortId);

  const sourceConnectedFiber = selectedSourcePort?.connectedFiberId
    ? site.fibers.find((f) => f.id === selectedSourcePort.connectedFiberId)
    : undefined;
  const targetConnectedFiber = selectedTargetPort?.connectedFiberId
    ? site.fibers.find((f) => f.id === selectedTargetPort.connectedFiberId)
    : undefined;

  const isSameRoom = sourceRoom?.id === targetRoom?.id;
  const isMmrRoom = sourceRoom?.type === 'mmr' && targetRoom?.type === 'mmr';

  // Auto-select first FREE port when equipment changes
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

  // Strict Telecom & Port Occupancy Validation Rules:
  let ruleValidationError: string | null = null;
  if (selectedSourcePort?.status === 'connected') {
    ruleValidationError = `Port de Départ occupé : ${sourceEq.code} ${selectedSourcePort.label} est déjà relié par "${sourceConnectedFiber?.code || 'une fibre'}". Cliquez sur "Débrancher ce port" ou choisissez un port libre (vert).`;
  } else if (selectedTargetPort?.status === 'connected') {
    ruleValidationError = `Port d'Arrivée occupé : ${targetEq.code} ${selectedTargetPort.label} est déjà relié par "${targetConnectedFiber?.code || 'une fibre'}". Cliquez sur "Débrancher ce port" ou choisissez un port libre (vert).`;
  } else if (sourcePortId && targetPortId && sourcePortId === targetPortId) {
    ruleValidationError =
      'Impossible de raccorder un port optique sur lui-même. Sélectionnez deux ports distincts.';
  } else if (cableKind !== 'trunk_cable' && !isSameRoom) {
    ruleValidationError =
      'Règle Télécom : Une jarretière optique ne peut relier que des baies situées dans la MÊME salle. Pour relier une salle (Opérateur ou Client) à la Salle MMR, sélectionnez "C. Câble Fibre Rocade (6FO / 12FO / 24FO)".';
  } else if (cableKind === 'cross_connect_jumper' && !isMmrRoom) {
    ruleValidationError =
      'Règle MMR : Une commande Cross-Connect se réalise exclusivement dans la Salle MMR (entre la Baie MMR Opérateur et la Baie MMR Client) par l\'Hébergeur Tiers.';
  } else if (cableKind === 'trunk_cable' && isSameRoom) {
    ruleValidationError =
      'Règle Télécom : Un câble rocade multi-fibres (6FO/12FO/24FO) sert à relier une salle (Salle Opérateur ou Salle Client) vers la Salle MMR. Dans une même salle, utilisez une Jarretière Optique.';
  }

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
    if (!srcPort || !dstPort || srcPort.status === 'connected' || dstPort.status === 'connected') {
      return;
    }

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
      jacketHex = trunkJacketHex(sourceRoom?.type, targetRoom?.type);
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
          ? `Jarretière Cross-Connect MMR ${polarity} (${sourceEq.code} ${srcPort.label} ↔ ${targetEq.code} ${dstPort.label})`
          : `Jarretière Optique Intra-Salle ${polarity} (${sourceEq.code} ${srcPort.label} → ${targetEq.code} ${dstPort.label})`),
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
    onSetDraftSource(null);
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
    <div className="fixed top-14 right-0 bottom-0 w-full max-w-[510px] bg-slate-900 border-l border-slate-800 z-30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Cable className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Atelier de Brassage 3D &amp; Gestion des Ports (OS2)
            </h2>
            <p className="text-[11px] text-slate-400">
              Brasser un port libre · Débrancher proprement un port connecté
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
              showGuide
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Mode d&apos;emploi
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive 3D Port Click Mode Toggle Banner */}
      <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-300">
          <span className="font-semibold text-slate-100">Sélection Directe en 3D :</span>{' '}
          {isPatchingMode
            ? 'Les ports LIBRES brillent en vert/cyan dans la scène 3D.'
            : 'Activez pour cliquer sur les ports directement en 3D.'}
        </div>
        <button
          onClick={() => onTogglePatchingMode(!isPatchingMode)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            isPatchingMode
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          {isPatchingMode ? 'Mode 3D Actif' : 'Activer Clic 3D'}
        </button>
      </div>

      {/* Body Scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* STEP-BY-STEP VISUAL GUIDE (MODE D'EMPLOI INTUITIF) */}
        {showGuide && (
          <div className="p-4 bg-slate-950 border border-sky-500/40 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
                Mode d&apos;Emploi — Comment Brasser ou Débrancher en 3D :
              </span>
              <button
                onClick={() => setShowGuide(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline"
              >
                Masquer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500 text-rose-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="font-semibold text-slate-100">
                    Choisir le Port de Départ Libre (Extrémité A)
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug mt-0.5">
                    Cliquez sur un port <strong className="text-emerald-400">LIBRE</strong> sur le bandeau de ports ci-dessous (ou directement sur un port en 3D). Il s&apos;allume en <strong className="text-rose-400">Rose (Départ A)</strong>.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="font-semibold text-slate-100">
                    Choisir le Port d&apos;Arrivée Libre (Extrémité B) &amp; Poser
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug mt-0.5">
                    Sélectionnez un second port <strong className="text-emerald-400">LIBRE</strong> (même salle = <strong>Jarretière</strong>, vers MMR = <strong>Câble Rocade 24FO/12FO</strong>). Les ports déjà occupés sont protégés contre les erreurs.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500 text-amber-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="font-semibold text-amber-300">
                    Retirer / Débrancher proprement un Port Connecté
                  </div>
                  <p className="text-slate-400 text-[11px] leading-snug mt-0.5">
                    Cliquez sur n&apos;importe quel port <strong className="text-amber-400">OCCUPÉ</strong> (en 3D ou dans la grille ci-dessous) puis cliquez sur le bouton rouge <strong className="text-rose-400">« Débrancher ce port »</strong> pour retirer proprement la fibre et libérer les 2 ports.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form 1: Create Jarretière or Câble Rocade */}
        <form onSubmit={handleCreateFiber} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Type d&apos;Opération Optique (100% OS2 Monomode)
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleSelectCableCategory('cross_connect_jumper')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
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
                    Hébergeur Tiers
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Relie en face avant la Baie MMR Opérateur (24FO SFR) et la Baie MMR Client (12FO Client).
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCableCategory('patch_cord')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
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
                className={`p-2.5 rounded-lg border text-left transition-all ${
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
                    Hébergeur Tiers
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Câble structuré inter-salles raccordé à l&apos;arrière des tiroirs (Baie SFR → MMR ou Baie Client → MMR).
                </p>
              </button>
            </div>
          </div>

          {/* Polarity & Trunk Capacity */}
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

          {/* =============================================================== */}
          {/* ENDPOINT A (SOURCE) WITH VISUAL 12-PORT FACEPLATE & UNPLUG      */}
          {/* =============================================================== */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400">
                Extrémité A — Port de Départ ({sourceRoom?.code})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {sourceRack?.code} · {sourceRack?.calepinage.tileRangeLabel}
              </span>
            </div>

            <select
              value={sourceEqId}
              onChange={(e) => setSourceEqId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
            >
              {site.equipments.map((eq) => {
                const rk = site.racks.find((r) => r.id === eq.rackId);
                const rm = site.rooms.find((room) => room.id === rk?.roomId);
                const freeCnt = eq.ports.filter((p) => p.status === 'free').length;
                return (
                  <option key={eq.id} value={eq.id}>
                    [{rm?.code} · {rk?.code}] {eq.name} ({freeCnt} ports libres)
                  </option>
                );
              })}
            </select>

            {/* Visual Faceplate Grid of 12 Ports for Equipment A */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400">
                  Façade {sourceEq.code} — Cliquez sur un port :
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  <strong className="text-emerald-400">Vert = Libre</strong> ·{' '}
                  <strong className="text-amber-400">Ambre = Occupé</strong>
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {sourceEq.ports.map((p) => {
                  const isSelected = p.id === sourcePortId;
                  const isOccupied = p.status === 'connected';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSourcePortId(p.id);
                        setConnectorA(p.connector);
                        if (!isOccupied) {
                          onSetDraftSource({ equipmentId: sourceEq.id, portId: p.id });
                        }
                      }}
                      className={`py-1.5 px-1 rounded border text-center transition-all ${
                        isSelected
                          ? 'bg-rose-500/25 border-rose-400 text-white ring-1 ring-rose-400'
                          : isOccupied
                          ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 hover:border-amber-400'
                          : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                      }`}
                    >
                      <div className="text-[11px] font-mono font-bold">
                        P{String(p.number).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] font-mono uppercase">
                        {isOccupied ? 'Occupé' : 'Libre'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If Selected Source Port is Occupied -> Direct Clean Disconnect Box! */}
            {selectedSourcePort?.status === 'connected' && sourceConnectedFiber && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-300">
                    {selectedSourcePort.label} est occupé par {sourceConnectedFiber.code}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {sourceConnectedFiber.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFiber(sourceConnectedFiber.id)}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-md flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Débrancher ce port
                </button>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* ENDPOINT B (TARGET) WITH VISUAL 12-PORT FACEPLATE & UNPLUG      */}
          {/* =============================================================== */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">
                Extrémité B — Port d&apos;Arrivée ({targetRoom?.code})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {targetRack?.code} · {targetRack?.calepinage.tileRangeLabel}
              </span>
            </div>

            <select
              value={targetEqId}
              onChange={(e) => setTargetEqId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
            >
              {site.equipments.map((eq) => {
                const rk = site.racks.find((r) => r.id === eq.rackId);
                const rm = site.rooms.find((room) => room.id === rk?.roomId);
                const freeCnt = eq.ports.filter((p) => p.status === 'free').length;
                return (
                  <option key={eq.id} value={eq.id}>
                    [{rm?.code} · {rk?.code}] {eq.name} ({freeCnt} ports libres)
                  </option>
                );
              })}
            </select>

            {/* Visual Faceplate Grid of 12 Ports for Equipment B */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400">
                  Façade {targetEq.code} — Cliquez sur un port :
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Connecteur {connectorB}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {targetEq.ports.map((p) => {
                  const isSelected = p.id === targetPortId;
                  const isOccupied = p.status === 'connected';
                  const isSameAsSource = p.id === sourcePortId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isSameAsSource}
                      onClick={() => {
                        setTargetPortId(p.id);
                        setConnectorB(p.connector);
                      }}
                      className={`py-1.5 px-1 rounded border text-center transition-all ${
                        isSameAsSource
                          ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-500/25 border-emerald-400 text-white ring-1 ring-emerald-400'
                          : isOccupied
                          ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 hover:border-amber-400'
                          : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                      }`}
                    >
                      <div className="text-[11px] font-mono font-bold">
                        P{String(p.number).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] font-mono uppercase">
                        {isSameAsSource ? 'Départ' : isOccupied ? 'Occupé' : 'Libre'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If Selected Target Port is Occupied -> Direct Clean Disconnect Box! */}
            {selectedTargetPort?.status === 'connected' && targetConnectedFiber && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-300">
                    {selectedTargetPort.label} est occupé par {targetConnectedFiber.code}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {targetConnectedFiber.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFiber(targetConnectedFiber.id)}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-md flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Débrancher ce port
                </button>
              </div>
            )}
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
                Prêt à raccorder : <strong>{sourceEq.code} ({selectedSourcePort?.label})</strong>{' '}
                <ArrowRight className="w-3 h-3 inline" />{' '}
                <strong>{targetEq.code} ({selectedTargetPort?.label})</strong> (Les 2 ports sont libres).
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
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {cableKind === 'trunk_cable'
              ? `Déployer le Câble Rocade ${trunkCapacity} en 3D`
              : `Poser la Jarretière ${polarity.split(' ')[0]} en 3D`}
          </button>
        </form>

        {/* Section 2: Active Fibers List with Clear Disconnect Buttons */}
        <div className="pt-5 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Liaisons Connectées — Débrancher / Retirer ({site.fibers.length})
            </h3>
          </div>
          <div className="space-y-2">
            {site.fibers.map((fib) => {
              const eqA = site.equipments.find((e) => e.id === fib.sourceEquipmentId);
              const eqB = site.equipments.find((e) => e.id === fib.targetEquipmentId);
              const pA = eqA?.ports.find((p) => p.id === fib.sourcePortId);
              const pB = eqB?.ports.find((p) => p.id === fib.targetPortId);

              return (
                <div
                  key={fib.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs shrink-0 ${
                          fib.kind === 'trunk_cable' ? 'bg-sky-500' : 'bg-amber-400'
                        }`}
                      />
                      <span className="text-xs font-mono font-bold text-slate-100">
                        {fib.code}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                        {fib.kind === 'trunk_cable'
                          ? `ROCADE ${fib.trunkCapacity || '24FO'}`
                          : `JARRETIÈRE ${fib.polarity.split(' ')[0]}`}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-sky-300 mt-1 truncate">
                      {eqA?.code} ({pA?.label}) ↔ {eqB?.code} ({pB?.label})
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {fib.responsibility} · {fib.lengthMeters}m · -{fib.attenuationDb}dB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFiber(fib.id)}
                    title="Débrancher proprement cette liaison et libérer les 2 ports"
                    className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-lg text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    Débrancher
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Create a New End-to-End Cross-Connect Order */}
        <div className="pt-5 border-t border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            3. Nouvelle Commande Cross-Connect MMR (Mono-Fibre ou Bi-Fibre)
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
      </div>
    </div>
  );
};
