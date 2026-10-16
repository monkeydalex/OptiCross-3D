import React, { useState } from 'react';
import {
  Package,
  Plus,
  Server,
  Box,
  X,
} from 'lucide-react';
import {
  TelecomSite,
  LibraryTemplate,
  Equipment,
  Rack,
  ConnectorType,
  EquipmentCategory,
  Port,
  TrunkCapacityFO,
} from '../types/telecom';

interface LibraryInventoryModalProps {
  site: TelecomSite;
  onDeployEquipmentFromLibrary: (
    templateId: string,
    rackId: string,
    uPosition: number,
    customName: string,
    customCode: string
  ) => void;
  onAddLibraryTemplate: (template: LibraryTemplate) => void;
  onRestockTemplate: (templateId: string, delta: number) => void;
  onAddRack: (rack: Rack) => void;
  onClose: () => void;
}

export const LibraryInventoryModal: React.FC<LibraryInventoryModalProps> = ({
  site,
  onDeployEquipmentFromLibrary,
  onAddLibraryTemplate,
  onRestockTemplate,
  onAddRack,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'inventory' | 'new_model'>('catalog');
  const [selectedRackId, setSelectedRackId] = useState<string>(site.racks[0]?.id);
  const [uPosition, setUPosition] = useState<number>(16);
  const [customEqName, setCustomEqName] = useState<string>('');
  const [customEqCode, setCustomEqCode] = useState<string>('');

  // New Rack State
  const [newRackRoomId, setNewRackRoomId] = useState<string>(site.rooms[1].id);
  const [newRackName, setNewRackName] = useState<string>('');
  const [newRackCode, setNewRackCode] = useState<string>('');

  // New Library Model State
  const [modName, setModName] = useState<string>('');
  const [modManufacturer, setModManufacturer] = useState<string>('Corning');
  const [modModel, setModModel] = useState<string>('EDGE 2U 24FO OS2 Monomode');
  const [modCategory, setModCategory] = useState<EquipmentCategory>('patch_panel');
  const [modConnector, setModConnector] = useState<ConnectorType>('LC/APC');
  const [modTrunkCapacity, setModTrunkCapacity] = useState<TrunkCapacityFO>('24FO');
  const [modUHeight, setModUHeight] = useState<number>(2);
  const [modPorts, setModPorts] = useState<number>(12);
  const [modStock, setModStock] = useState<number>(10);

  const totalPorts = site.equipments.reduce((acc, eq) => acc + eq.ports.length, 0);
  const connectedPorts = site.equipments.reduce(
    (acc, eq) => acc + eq.ports.filter((p) => p.status === 'connected').length,
    0
  );
  const freePorts = totalPorts - connectedPorts;
  const trunkCablesCount = site.fibers.filter((f) => f.kind === 'trunk_cable').length;
  const jarretieresCount = site.fibers.filter((f) => f.kind !== 'trunk_cable').length;

  const handleCreateModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modName.trim()) return;
    const newTpl: LibraryTemplate = {
      id: `lib-custom-${Date.now()}`,
      name: modName.trim(),
      category: modCategory,
      manufacturer: modManufacturer,
      model: modModel,
      uHeight: modUHeight,
      defaultPortCount: modPorts,
      defaultConnector: modConnector,
      defaultRole: modCategory === 'patch_panel' ? 'front_patch' : 'transceiver',
      trunkCapacity: modCategory === 'patch_panel' ? modTrunkCapacity : undefined,
      colorHex: modCategory === 'patch_panel' ? '#1e293b' : '#065f46',
      stockAvailable: modStock,
      powerConsumptionW: modCategory === 'patch_panel' ? 0 : 420,
      description: `Équipement 100% Monomode OS2 (${
        modCategory === 'patch_panel' ? `Tête de câble ${modTrunkCapacity} ` : ''
      }${modPorts} ports ${modConnector}).`,
    };
    onAddLibraryTemplate(newTpl);
    setModName('');
    setActiveTab('catalog');
  };

  const handleAddNewRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackName.trim()) return;
    const room = site.rooms.find((r) => r.id === newRackRoomId) || site.rooms[0];
    const roomRacks = site.racks.filter((r) => r.roomId === room.id);
    const zOffset = (roomRacks.length % 2 === 0 ? -1 : 1) * (1.8 + roomRacks.length * 0.6);

    const newRack: Rack = {
      id: `rack-custom-${Date.now()}`,
      roomId: room.id,
      name: newRackName.trim(),
      code: newRackCode.trim() || `BAIE-${site.racks.length + 1}`,
      uTotal: 42,
      position3D: [
        room.bounds.x + (roomRacks.length > 1 ? 1.1 : -1.1),
        0,
        Math.max(-2.8, Math.min(2.8, zOffset)),
      ],
      rotationY: 0,
      widthM: 0.8,
      depthM: 1.0,
      heightM: 2.1,
      customAttributes: [
        {
          id: `rk-attr-${Date.now()}`,
          key: 'Standard Optique',
          value: '100% Monomode OS2',
        },
      ],
    };
    onAddRack(newRack);
    setSelectedRackId(newRack.id);
    setNewRackName('');
    setNewRackCode('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4 md:p-6">
      <div className="w-full max-w-[1240px] h-[88vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Bibliothèque Dynamique &amp; Inventaire Temps Réel (100% Monomode OS2)
              </h2>
              <p className="text-xs text-slate-400">
                Déployez des Tiroirs Tête de Câble (12FO, 24FO, 48FO), Routeurs SFR/Client et suivez les Câbles Rocades vs Jarretières.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'catalog'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Catalogue &amp; Déploiement 3D
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'inventory'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Inventaire Ports &amp; Rocades
              </button>
              <button
                onClick={() => setActiveTab('new_model')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'new_model'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                + Nouveau Modèle / Baie
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 font-mono tabular-nums">
          <div>
            <div className="text-[11px] text-slate-400">Équipements &amp; Tiroirs OS2</div>
            <div className="text-base font-bold text-slate-100 mt-0.5">
              {site.equipments.length} unités{' '}
              <span className="text-xs text-slate-400">({site.racks.length} baies)</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Occupation des Ports OS2</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {connectedPorts} / {totalPorts} occupés{' '}
              <span className="text-xs text-slate-400">({freePorts} libres)</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Câbles Rocades vs Jarretières</div>
            <div className="text-base font-bold text-sky-400 mt-0.5">
              {trunkCablesCount} Rocades <span className="text-xs text-amber-400">· {jarretieresCount} Jarretières</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Stock Magasin Disponible</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {site.library.reduce((acc, l) => acc + l.stockAvailable, 0)} châssis en stock
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'catalog' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Baie Télécom Cible (Destination 3D)
                  </label>
                  <select
                    value={selectedRackId}
                    onChange={(e) => setSelectedRackId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  >
                    {site.racks.map((rk) => {
                      const rm = site.rooms.find((r) => r.id === rk.roomId);
                      return (
                        <option key={rk.id} value={rk.id}>
                          [{rm?.code}] {rk.code} — {rk.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Hauteur d&apos;Installation (Position U : 1–40)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={uPosition}
                    onChange={(e) => setUPosition(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nom Personnalisé (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Tiroir 24FO SFR Extension"
                    value={customEqName}
                    onChange={(e) => setCustomEqName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Code Technique (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: TIROIR-SFR-02"
                    value={customEqCode}
                    onChange={(e) => setCustomEqCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {site.library.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>
                          {tpl.manufacturer} · {tpl.uHeight}U · OS2
                        </span>
                        <span
                          className={
                            tpl.stockAvailable > 0
                              ? 'text-emerald-400 font-semibold'
                              : 'text-rose-400'
                          }
                        >
                          En stock : {tpl.stockAvailable}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 mt-1.5">{tpl.name}</h3>
                      <p className="text-xs font-mono text-amber-400 mt-0.5">{tpl.model}</p>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {tpl.description}
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-3 text-xs font-mono text-slate-300">
                        {tpl.trunkCapacity && (
                          <>
                            <span className="text-sky-400 font-semibold">
                              Rocade {tpl.trunkCapacity}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{tpl.defaultPortCount} Ports</span>
                        <span aria-hidden="true">·</span>
                        <span>{tpl.defaultConnector}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        disabled={tpl.stockAvailable <= 0}
                        onClick={() => {
                          onDeployEquipmentFromLibrary(
                            tpl.id,
                            selectedRackId,
                            uPosition,
                            customEqName,
                            customEqCode
                          );
                          setCustomEqName('');
                          setCustomEqCode('');
                        }}
                        className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Installer en Baie (U{uPosition})
                      </button>
                      <button
                        onClick={() => onRestockTemplate(tpl.id, 5)}
                        title="Réapprovisionner +5 unités en stock"
                        className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-colors"
                      >
                        +5 Stock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-slate-100">
                Inventaire en Temps Réel des Équipements &amp; Tiroirs Optiques (100% Monomode OS2)
              </h3>

              <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-slate-900/60">
                      <th className="py-3 px-4">SALLE / BAIE</th>
                      <th className="py-3 px-4">CODE ÉQUIPEMENT</th>
                      <th className="py-3 px-4">DÉSIGNATION &amp; CAPACITÉ ROCADE</th>
                      <th className="py-3 px-4">POSITION</th>
                      <th className="py-3 px-4">CONNECTIQUE OS2</th>
                      <th className="py-3 px-4 text-right">OCCUPATION PORTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {site.equipments.map((eq: Equipment) => {
                      const rk = site.racks.find((r) => r.id === eq.rackId);
                      const rm = site.rooms.find((r) => r.id === rk?.roomId);
                      const used = eq.ports.filter((p: Port) => p.status === 'connected').length;
                      const total = eq.ports.length;
                      const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                      return (
                        <tr key={eq.id} className="hover:bg-slate-900/50">
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {rm?.code} <span aria-hidden="true">·</span>{' '}
                            <span className="text-sky-400 font-semibold">{rk?.code}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-100">
                            {eq.code}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            <div className="font-semibold">{eq.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {eq.manufacturer} {eq.model}{' '}
                              {eq.trunkCapacity ? `· Tête de Câble ${eq.trunkCapacity}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                            U{eq.uPosition} ({eq.uHeight}U)
                          </td>
                          <td className="py-3 px-4 font-mono text-amber-400">
                            {eq.ports[0]?.connector || 'LC/APC'} (OS2)
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-right">
                            <span className="text-slate-100 font-semibold">
                              {used} / {total}
                            </span>{' '}
                            <span className="text-slate-400">({pct}%)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'new_model' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form
                onSubmit={handleCreateModel}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Ajouter une Référence Monomode OS2 au Catalogue
                  </h3>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Nom Commercial</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tiroir Optique 24FO OS2 LC/APC"
                    value={modName}
                    onChange={(e) => setModName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Constructeur</label>
                    <input
                      type="text"
                      value={modManufacturer}
                      onChange={(e) => setModManufacturer(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Modèle Exact</label>
                    <input
                      type="text"
                      value={modModel}
                      onChange={(e) => setModModel(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Catégorie</label>
                    <select
                      value={modCategory}
                      onChange={(e) => setModCategory(e.target.value as EquipmentCategory)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    >
                      <option value="patch_panel">Tiroir Optique</option>
                      <option value="router">Routeur OS2</option>
                      <option value="switch">Switch OS2</option>
                      <option value="dwdm">DWDM OS2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Connecteur OS2</label>
                    <select
                      value={modConnector}
                      onChange={(e) => setModConnector(e.target.value as ConnectorType)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    >
                      <option value="LC/APC">LC/APC (Vert)</option>
                      <option value="LC/UPC">LC/UPC (Bleu)</option>
                      <option value="SC/APC">SC/APC (Vert)</option>
                      <option value="SC/UPC">SC/UPC (Bleu)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Rocade Tiroir</label>
                    <select
                      value={modTrunkCapacity}
                      onChange={(e) => setModTrunkCapacity(e.target.value as TrunkCapacityFO)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-sky-300"
                    >
                      <option value="6FO">6FO</option>
                      <option value="12FO">12FO</option>
                      <option value="24FO">24FO</option>
                      <option value="48FO">48FO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Hauteur (U)</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={modUHeight}
                      onChange={(e) => setModUHeight(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Nb Ports 3D</label>
                    <input
                      type="number"
                      min={4}
                      max={24}
                      value={modPorts}
                      onChange={(e) => setModPorts(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Stock Initial</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={modStock}
                      onChange={(e) => setModStock(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
                >
                  Enregistrer dans la Bibliothèque Dynamique
                </button>
              </form>

              <form
                onSubmit={handleAddNewRack}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Implanter une Nouvelle Baie Télécom 42U dans une Salle
                  </h3>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Salle d&apos;Implantation</label>
                  <select
                    value={newRackRoomId}
                    onChange={(e) => setNewRackRoomId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  >
                    {site.rooms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Nom de la Baie</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Baie Opérateur Extension SFR #02"
                    value={newRackName}
                    onChange={(e) => setNewRackName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Code Baie</label>
                  <input
                    type="text"
                    placeholder="Ex: BAIE-SFR-02"
                    value={newRackCode}
                    onChange={(e) => setNewRackCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
                >
                  Ajouter la Baie 42U dans la Scène 3D
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
