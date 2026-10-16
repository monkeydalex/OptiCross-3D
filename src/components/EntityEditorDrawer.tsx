import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  X,
  Building2,
  Server,
  Cpu,
  Radio,
  Cable,
  Route,
  Sparkles,
} from 'lucide-react';
import {
  TelecomSite,
  SelectedEntityRef,
  CustomAttribute,
  ConnectorType,
  PortStatus,
  PolarityMode,
  TrunkCapacityFO,
  AisleType,
  RackFootprintMm,
} from '../types/telecom';
import {
  CALEPINAGE_COLUMNS,
  CALEPINAGE_ROWS,
  relocateRackToTile,
  worldPositionToTile,
  flipRackFrontRearOrientation,
} from '../utils/calepinageUtils';

interface EntityEditorDrawerProps {
  site: TelecomSite;
  selectedEntity: SelectedEntityRef | null;
  onSelectEntity: (entity: SelectedEntityRef) => void;
  onUpdateSite: (updater: (prev: TelecomSite) => TelecomSite) => void;
  onTraceFromPortOrFiber: (fiberId?: string, portId?: string) => void;
  onStartPatchFromPort: (equipmentId: string, portId: string) => void;
  onClose: () => void;
}

export const EntityEditorDrawer: React.FC<EntityEditorDrawerProps> = ({
  site,
  selectedEntity,
  onSelectEntity,
  onUpdateSite,
  onTraceFromPortOrFiber,
  onStartPatchFromPort,
  onClose,
}) => {
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');

  const currentRef: SelectedEntityRef = selectedEntity || {
    kind: 'site',
    id: site.id,
  };

  const handleAddCustomAttribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttrKey.trim() || !newAttrVal.trim()) return;
    const attr: CustomAttribute = {
      id: `attr-${Date.now()}`,
      key: newAttrKey.trim(),
      value: newAttrVal.trim(),
    };

    onUpdateSite((prev) => {
      if (currentRef.kind === 'site') {
        return { ...prev, customAttributes: [...prev.customAttributes, attr] };
      }
      if (currentRef.kind === 'room') {
        return {
          ...prev,
          rooms: prev.rooms.map((r) =>
            r.id === currentRef.id
              ? { ...r, customAttributes: [...r.customAttributes, attr] }
              : r
          ),
        };
      }
      if (currentRef.kind === 'rack') {
        return {
          ...prev,
          racks: prev.racks.map((rk) =>
            rk.id === currentRef.id
              ? { ...rk, customAttributes: [...rk.customAttributes, attr] }
              : rk
          ),
        };
      }
      if (currentRef.kind === 'equipment') {
        return {
          ...prev,
          equipments: prev.equipments.map((eq) =>
            eq.id === currentRef.id
              ? { ...eq, customAttributes: [...eq.customAttributes, attr] }
              : eq
          ),
        };
      }
      if (currentRef.kind === 'port') {
        return {
          ...prev,
          equipments: prev.equipments.map((eq) =>
            eq.id === currentRef.equipmentId
              ? {
                  ...eq,
                  ports: eq.ports.map((p) =>
                    p.id === currentRef.id
                      ? { ...p, customAttributes: [...p.customAttributes, attr] }
                      : p
                  ),
                }
              : eq
          ),
        };
      }
      if (currentRef.kind === 'fiber') {
        return {
          ...prev,
          fibers: prev.fibers.map((f) =>
            f.id === currentRef.id
              ? { ...f, customAttributes: [...f.customAttributes, attr] }
              : f
          ),
        };
      }
      if (currentRef.kind === 'pathway') {
        return {
          ...prev,
          pathways: prev.pathways.map((pw) =>
            pw.id === currentRef.id
              ? { ...pw, customAttributes: [...pw.customAttributes, attr] }
              : pw
          ),
        };
      }
      return prev;
    });

    setNewAttrKey('');
    setNewAttrVal('');
  };

  const handleUpdateCustomAttribute = (attrId: string, key: string, value: string) => {
    const updateList = (list: CustomAttribute[]) =>
      list.map((a) => (a.id === attrId ? { ...a, key, value } : a));

    onUpdateSite((prev) => {
      if (currentRef.kind === 'site') {
        return { ...prev, customAttributes: updateList(prev.customAttributes) };
      }
      if (currentRef.kind === 'room') {
        return {
          ...prev,
          rooms: prev.rooms.map((r) =>
            r.id === currentRef.id
              ? { ...r, customAttributes: updateList(r.customAttributes) }
              : r
          ),
        };
      }
      if (currentRef.kind === 'rack') {
        return {
          ...prev,
          racks: prev.racks.map((rk) =>
            rk.id === currentRef.id
              ? { ...rk, customAttributes: updateList(rk.customAttributes) }
              : rk
          ),
        };
      }
      if (currentRef.kind === 'equipment') {
        return {
          ...prev,
          equipments: prev.equipments.map((eq) =>
            eq.id === currentRef.id
              ? { ...eq, customAttributes: updateList(eq.customAttributes) }
              : eq
          ),
        };
      }
      if (currentRef.kind === 'port') {
        return {
          ...prev,
          equipments: prev.equipments.map((eq) =>
            eq.id === currentRef.equipmentId
              ? {
                  ...eq,
                  ports: eq.ports.map((p) =>
                    p.id === currentRef.id
                      ? { ...p, customAttributes: updateList(p.customAttributes) }
                      : p
                  ),
                }
              : eq
          ),
        };
      }
      if (currentRef.kind === 'fiber') {
        return {
          ...prev,
          fibers: prev.fibers.map((f) =>
            f.id === currentRef.id
              ? { ...f, customAttributes: updateList(f.customAttributes) }
              : f
          ),
        };
      }
      if (currentRef.kind === 'pathway') {
        return {
          ...prev,
          pathways: prev.pathways.map((pw) =>
            pw.id === currentRef.id
              ? { ...pw, customAttributes: updateList(pw.customAttributes) }
              : pw
          ),
        };
      }
      return prev;
    });
  };

  const handleDeleteCustomAttribute = (attrId: string) => {
    const filterList = (list: CustomAttribute[]) => list.filter((a) => a.id !== attrId);
    onUpdateSite((prev) => {
      if (currentRef.kind === 'site') {
        return { ...prev, customAttributes: filterList(prev.customAttributes) };
      }
      if (currentRef.kind === 'room') {
        return {
          ...prev,
          rooms: prev.rooms.map((r) =>
            r.id === currentRef.id
              ? { ...r, customAttributes: filterList(r.customAttributes) }
              : r
          ),
        };
      }
      if (currentRef.kind === 'rack') {
        return {
          ...prev,
          racks: prev.racks.map((rk) =>
            rk.id === currentRef.id
              ? { ...rk, customAttributes: filterList(rk.customAttributes) }
              : rk
          ),
        };
      }
      if (currentRef.kind === 'equipment') {
        return {
          ...prev,
          equipments: prev.equipments.map((eq) =>
            eq.id === currentRef.id
              ? { ...eq, customAttributes: filterList(eq.customAttributes) }
              : eq
          ),
        };
      }
      if (currentRef.kind === 'port') {
        return {
          ...prev,
          equipments: prev.equipments.map((eq) =>
            eq.id === currentRef.equipmentId
              ? {
                  ...eq,
                  ports: eq.ports.map((p) =>
                    p.id === currentRef.id
                      ? { ...p, customAttributes: filterList(p.customAttributes) }
                      : p
                  ),
                }
              : eq
          ),
        };
      }
      if (currentRef.kind === 'fiber') {
        return {
          ...prev,
          fibers: prev.fibers.map((f) =>
            f.id === currentRef.id
              ? { ...f, customAttributes: filterList(f.customAttributes) }
              : f
          ),
        };
      }
      if (currentRef.kind === 'pathway') {
        return {
          ...prev,
          pathways: prev.pathways.map((pw) =>
            pw.id === currentRef.id
              ? { ...pw, customAttributes: filterList(pw.customAttributes) }
              : pw
          ),
        };
      }
      return prev;
    });
  };

  let activeAttributes: CustomAttribute[] = [];
  if (currentRef.kind === 'site') activeAttributes = site.customAttributes;
  else if (currentRef.kind === 'room')
    activeAttributes = site.rooms.find((r) => r.id === currentRef.id)?.customAttributes || [];
  else if (currentRef.kind === 'rack')
    activeAttributes = site.racks.find((r) => r.id === currentRef.id)?.customAttributes || [];
  else if (currentRef.kind === 'equipment')
    activeAttributes =
      site.equipments.find((e) => e.id === currentRef.id)?.customAttributes || [];
  else if (currentRef.kind === 'port') {
    const eq = site.equipments.find((e) => e.id === currentRef.equipmentId);
    activeAttributes = eq?.ports.find((p) => p.id === currentRef.id)?.customAttributes || [];
  } else if (currentRef.kind === 'fiber')
    activeAttributes = site.fibers.find((f) => f.id === currentRef.id)?.customAttributes || [];
  else if (currentRef.kind === 'pathway')
    activeAttributes =
      site.pathways.find((p) => p.id === currentRef.id)?.customAttributes || [];

  const roomObj =
    currentRef.kind === 'room' ? site.rooms.find((r) => r.id === currentRef.id) : undefined;
  const rackObj =
    currentRef.kind === 'rack' ? site.racks.find((r) => r.id === currentRef.id) : undefined;
  const eqObj =
    currentRef.kind === 'equipment'
      ? site.equipments.find((e) => e.id === currentRef.id)
      : undefined;
  const portParentEq =
    currentRef.kind === 'port'
      ? site.equipments.find((e) => e.id === currentRef.equipmentId)
      : undefined;
  const portObj =
    currentRef.kind === 'port'
      ? portParentEq?.ports.find((p) => p.id === currentRef.id)
      : undefined;
  const fiberObj =
    currentRef.kind === 'fiber' ? site.fibers.find((f) => f.id === currentRef.id) : undefined;
  const pathwayObj =
    currentRef.kind === 'pathway'
      ? site.pathways.find((p) => p.id === currentRef.id)
      : undefined;

  return (
    <div className="fixed top-14 right-0 bottom-0 w-full max-w-[460px] bg-slate-900 border-l border-slate-800 z-30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Éditeur Réseau &amp; Attributs Techniques (OS2)
            </h2>
            <p className="text-[11px] text-slate-400">
              Personnalisez les noms, codes, rocades 24FO/12FO et jarretières
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

      {/* Quick Hierarchy Selector Bar */}
      <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[
            { kind: 'site', label: 'Site', icon: Building2, defaultId: site.id },
            { kind: 'room', label: 'Salles', icon: Building2, defaultId: site.rooms[0]?.id },
            { kind: 'rack', label: 'Baies', icon: Server, defaultId: site.racks[0]?.id },
            { kind: 'equipment', label: 'Tiroirs/Équip.', icon: Cpu, defaultId: site.equipments[0]?.id },
            { kind: 'fiber', label: 'Câbles/Jarretières', icon: Cable, defaultId: site.fibers[0]?.id },
            { kind: 'pathway', label: 'Chemins', icon: Route, defaultId: site.pathways[0]?.id },
          ].map((item) => {
            const Icon = item.icon;
            const active = currentRef.kind === item.kind;
            return (
              <button
                key={item.kind}
                onClick={() =>
                  onSelectEntity({
                    kind: item.kind as SelectedEntityRef['kind'],
                    id: item.defaultId,
                  })
                }
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </button>
            );
          })}
        </div>

        {currentRef.kind === 'room' && (
          <select
            value={currentRef.id}
            onChange={(e) => onSelectEntity({ kind: 'room', id: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
          >
            {site.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
        )}

        {currentRef.kind === 'rack' && (
          <select
            value={currentRef.id}
            onChange={(e) => onSelectEntity({ kind: 'rack', id: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
          >
            {site.racks.map((rk) => (
              <option key={rk.id} value={rk.id}>
                {rk.code} — {rk.name}
              </option>
            ))}
          </select>
        )}

        {currentRef.kind === 'equipment' && (
          <select
            value={currentRef.id}
            onChange={(e) => onSelectEntity({ kind: 'equipment', id: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
          >
            {site.equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.code} — {eq.name}
              </option>
            ))}
          </select>
        )}

        {currentRef.kind === 'fiber' && (
          <select
            value={currentRef.id}
            onChange={(e) => onSelectEntity({ kind: 'fiber', id: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
          >
            {site.fibers.map((f) => (
              <option key={f.id} value={f.id}>
                [{f.kind === 'trunk_cable' ? `CÂBLE ${f.trunkCapacity || '24FO'}` : 'JARRETIÈRE'}] {f.code} — {f.name}
              </option>
            ))}
          </select>
        )}

        {currentRef.kind === 'pathway' && (
          <select
            value={currentRef.id}
            onChange={(e) => onSelectEntity({ kind: 'pathway', id: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
          >
            {site.pathways.map((pw) => (
              <option key={pw.id} value={pw.id}>
                {pw.code} — {pw.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main Editor Form */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {currentRef.kind === 'site' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Identification du Site Télécom (100% OS2)
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Nom du Site</label>
              <input
                type="text"
                value={site.name}
                onChange={(e) =>
                  onUpdateSite((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Code Site</label>
                <input
                  type="text"
                  value={site.code}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({ ...prev, code: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Certification Tier</label>
                <input
                  type="text"
                  value={site.tierLevel}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({ ...prev, tierLevel: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {currentRef.kind === 'room' && roomObj && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
              Paramètres de la Salle Télécom
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Nom de la Salle</label>
              <input
                type="text"
                value={roomObj.name}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    rooms: prev.rooms.map((r) =>
                      r.id === roomObj.id ? { ...r, name: e.target.value } : r
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Règle d&apos;Accès &amp; Responsabilité
              </label>
              <input
                type="text"
                value={roomObj.accessRestriction}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    rooms: prev.rooms.map((r) =>
                      r.id === roomObj.id
                        ? { ...r, accessRestriction: e.target.value }
                        : r
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-amber-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={roomObj.description}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    rooms: prev.rooms.map((r) =>
                      r.id === roomObj.id ? { ...r, description: e.target.value } : r
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>
          </div>
        )}

        {currentRef.kind === 'rack' && rackObj && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
              Identification de la Baie Télécom
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Nom de la Baie</label>
              <input
                type="text"
                value={rackObj.name}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    racks: prev.racks.map((rk) =>
                      rk.id === rackObj.id ? { ...rk, name: e.target.value } : rk
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Code Baie</label>
                <input
                  type="text"
                  value={rackObj.code}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      racks: prev.racks.map((rk) =>
                        rk.id === rackObj.id ? { ...rk, code: e.target.value } : rk
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Capacité (Unités U)</label>
                <input
                  type="number"
                  value={rackObj.uTotal}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      racks: prev.racks.map((rk) =>
                        rk.id === rackObj.id ? { ...rk, uTotal: Number(e.target.value) } : rk
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>

            {/* CALEPINAGE 60x60cm (1 BAIE = 1 DALLE ENTIÈRE — ZÉRO DEMI-BAIE) & BAIE AVANT / ARRIÈRE */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Calepinage 60×60 cm (1 Baie = 1 Dalle)
                </h4>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40">
                  {rackObj.calepinage.tileRangeLabel}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Orientation Baie Avant / Baie Arrière
                  </span>
                  <button
                    onClick={() =>
                      onUpdateSite((prev) => ({
                        ...prev,
                        racks: prev.racks.map((rk) =>
                          rk.id === rackObj.id ? flipRackFrontRearOrientation(rk) : rk
                        ),
                      }))
                    }
                    className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded transition-colors"
                  >
                    Inverser Avant / Arrière (180°)
                  </button>
                </div>
                <div className="text-[11px] text-amber-300 font-mono">
                  ▼ {rackObj.calepinage.frontFaceLabel}
                </div>
                <div className="text-[11px] text-sky-400 font-mono">
                  ▲ {rackObj.calepinage.rearFaceLabel}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Colonne Dalle 60×60 (A à F)
                  </label>
                  <select
                    value={rackObj.calepinage.tileColumn}
                    onChange={(e) => {
                      const newCol = e.target.value;
                      onUpdateSite((prev) => {
                        const rm = prev.rooms.find((r) => r.id === rackObj.roomId);
                        if (!rm) return prev;
                        return {
                          ...prev,
                          racks: prev.racks.map((rk) =>
                            rk.id === rackObj.id
                              ? relocateRackToTile(rk, rm, newCol, rk.calepinage.tileRow)
                              : rk
                          ),
                        };
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-amber-300"
                  >
                    {CALEPINAGE_COLUMNS.map((col) => (
                      <option key={col} value={col}>
                        Colonne Dalle {col} (60 cm)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Ligne Dalle 60×60 (01 à 06)
                  </label>
                  <select
                    value={rackObj.calepinage.tileRow}
                    onChange={(e) => {
                      const newRow = Number(e.target.value);
                      onUpdateSite((prev) => {
                        const rm = prev.rooms.find((r) => r.id === rackObj.roomId);
                        if (!rm) return prev;
                        return {
                          ...prev,
                          racks: prev.racks.map((rk) =>
                            rk.id === rackObj.id
                              ? relocateRackToTile(rk, rm, rk.calepinage.tileColumn, newRow)
                              : rk
                          ),
                        };
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-amber-300"
                  >
                    {CALEPINAGE_ROWS.map((rNum) => (
                      <option key={rNum} value={rNum}>
                        Ligne Dalle {String(rNum).padStart(2, '0')} (60 cm)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Rangée / Allée
                  </label>
                  <input
                    type="text"
                    value={rackObj.calepinage.rowLabel}
                    onChange={(e) =>
                      onUpdateSite((prev) => ({
                        ...prev,
                        racks: prev.racks.map((rk) =>
                          rk.id === rackObj.id
                            ? {
                                ...rk,
                                calepinage: { ...rk.calepinage, rowLabel: e.target.value },
                              }
                            : rk
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Position dans la Rangée
                  </label>
                  <input
                    type="text"
                    value={rackObj.calepinage.positionInRow}
                    onChange={(e) =>
                      onUpdateSite((prev) => ({
                        ...prev,
                        racks: prev.racks.map((rk) =>
                          rk.id === rackObj.id
                            ? {
                                ...rk,
                                calepinage: {
                                  ...rk.calepinage,
                                  positionInRow: e.target.value,
                                },
                              }
                            : rk
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Dimension Standard (Sans demi-baie)
                  </label>
                  <select
                    value={rackObj.calepinage.footprintMm}
                    onChange={(e) =>
                      onUpdateSite((prev) => ({
                        ...prev,
                        racks: prev.racks.map((rk) =>
                          rk.id === rackObj.id
                            ? {
                                ...rk,
                                calepinage: {
                                  ...rk.calepinage,
                                  footprintMm: e.target.value as RackFootprintMm,
                                },
                              }
                            : rk
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  >
                    <option value="600 × 600 mm (1 Dalle entière 60×60 cm — Sans demi-baie)">
                      600 × 600 mm (1 Dalle entière 60×60 cm)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Organisation Couloirs Avant / Arrière
                  </label>
                  <select
                    value={rackObj.calepinage.aisleType}
                    onChange={(e) =>
                      onUpdateSite((prev) => ({
                        ...prev,
                        racks: prev.racks.map((rk) =>
                          rk.id === rackObj.id
                            ? {
                                ...rk,
                                calepinage: {
                                  ...rk.calepinage,
                                  aisleType: e.target.value as AisleType,
                                },
                              }
                            : rk
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  >
                    <option value="Allée Centrale de Brassage (Accès Baie Avant)">
                      Allée Centrale de Brassage (Accès Baie Avant)
                    </option>
                    <option value="Couloir Arrière Rocades (Accès Baie Arrière)">
                      Couloir Arrière Rocades (Accès Baie Arrière)
                    </option>
                    <option value="Couloir Confiné MMR (Avant Cross-Connect / Arrière Rocades)">
                      Couloir Confiné MMR (Avant / Arrière)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Îlot / Zone ou Cage Colocation
                </label>
                <input
                  type="text"
                  value={rackObj.calepinage.zoneLabel}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      racks: prev.racks.map((rk) =>
                        rk.id === rackObj.id
                          ? {
                              ...rk,
                              calepinage: { ...rk.calepinage, zoneLabel: e.target.value },
                            }
                          : rk
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>

              {/* Fine 3D X/Z Sliders */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Coord 3D X : {rackObj.position3D[0].toFixed(2)} m
                  </label>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={0.1}
                    value={rackObj.position3D[0]}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      onUpdateSite((prev) => {
                        const rm = prev.rooms.find((r) => r.id === rackObj.roomId);
                        return {
                          ...prev,
                          racks: prev.racks.map((rk) => {
                            if (rk.id !== rackObj.id) return rk;
                            const nextPos: [number, number, number] = [
                              newX,
                              rk.position3D[1],
                              rk.position3D[2],
                            ];
                            const tileInfo = rm
                              ? worldPositionToTile(rm, nextPos)
                              : null;
                            return {
                              ...rk,
                              position3D: nextPos,
                              calepinage: tileInfo
                                ? {
                                    ...rk.calepinage,
                                    tileColumn: tileInfo.tileColumn,
                                    tileRow: tileInfo.tileRow,
                                    tileRangeLabel: tileInfo.tileRangeLabel,
                                  }
                                : rk.calepinage,
                            };
                          }),
                        };
                      });
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Coord 3D Z : {rackObj.position3D[2].toFixed(2)} m
                  </label>
                  <input
                    type="range"
                    min={-3.5}
                    max={3.5}
                    step={0.1}
                    value={rackObj.position3D[2]}
                    onChange={(e) => {
                      const newZ = Number(e.target.value);
                      onUpdateSite((prev) => {
                        const rm = prev.rooms.find((r) => r.id === rackObj.roomId);
                        return {
                          ...prev,
                          racks: prev.racks.map((rk) => {
                            if (rk.id !== rackObj.id) return rk;
                            const nextPos: [number, number, number] = [
                              rk.position3D[0],
                              rk.position3D[1],
                              newZ,
                            ];
                            const tileInfo = rm
                              ? worldPositionToTile(rm, nextPos)
                              : null;
                            return {
                              ...rk,
                              position3D: nextPos,
                              calepinage: tileInfo
                                ? {
                                    ...rk.calepinage,
                                    tileColumn: tileInfo.tileColumn,
                                    tileRow: tileInfo.tileRow,
                                    tileRangeLabel: tileInfo.tileRangeLabel,
                                  }
                                : rk.calepinage,
                            };
                          }),
                        };
                      });
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentRef.kind === 'equipment' && eqObj && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Paramètres du Tiroir Optique / Équipement OS2
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Nom du Tiroir / Équipement
              </label>
              <input
                type="text"
                value={eqObj.name}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    equipments: prev.equipments.map((eq) =>
                      eq.id === eqObj.id ? { ...eq, name: e.target.value } : eq
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Code Technique</label>
                <input
                  type="text"
                  value={eqObj.code}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      equipments: prev.equipments.map((eq) =>
                        eq.id === eqObj.id ? { ...eq, code: e.target.value } : eq
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Position en Baie (U)</label>
                <input
                  type="number"
                  min={1}
                  max={41}
                  value={eqObj.uPosition}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      equipments: prev.equipments.map((eq) =>
                        eq.id === eqObj.id
                          ? { ...eq, uPosition: Number(e.target.value) }
                          : eq
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Ports Optiques OS2 du Tiroir / Équipement (Cliquez pour éditer un port)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {eqObj.ports.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onSelectEntity({
                        kind: 'port',
                        id: p.id,
                        equipmentId: eqObj.id,
                      })
                    }
                    className={`p-2 rounded border text-left transition-colors ${
                      p.status === 'connected'
                        ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[11px] font-mono font-bold">{p.label}</div>
                    <div className="text-[10px] font-mono opacity-80">{p.connector}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentRef.kind === 'port' && portObj && portParentEq && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                Port Optique OS2 ({portParentEq.code})
              </h3>
              <button
                onClick={() =>
                  onSelectEntity({ kind: 'equipment', id: portParentEq.id })
                }
                className="text-xs text-sky-400 hover:underline"
              >
                ← Retour au tiroir
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Étiquette du Port</label>
                <input
                  type="text"
                  value={portObj.label}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      equipments: prev.equipments.map((eq) =>
                        eq.id === portParentEq.id
                          ? {
                              ...eq,
                              ports: eq.ports.map((p) =>
                                p.id === portObj.id ? { ...p, label: e.target.value } : p
                              ),
                            }
                          : eq
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Connecteur OS2</label>
                <select
                  value={portObj.connector}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      equipments: prev.equipments.map((eq) =>
                        eq.id === portParentEq.id
                          ? {
                              ...eq,
                              ports: eq.ports.map((p) =>
                                p.id === portObj.id
                                  ? { ...p, connector: e.target.value as ConnectorType }
                                  : p
                              ),
                            }
                          : eq
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value="LC/APC">LC/APC (Vert 8°)</option>
                  <option value="LC/UPC">LC/UPC (Bleu 0°)</option>
                  <option value="SC/APC">SC/APC (Vert 8°)</option>
                  <option value="SC/UPC">SC/UPC (Bleu 0°)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Longueur d&apos;onde (nm)</label>
                <select
                  value={portObj.wavelengthNm}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      equipments: prev.equipments.map((eq) =>
                        eq.id === portParentEq.id
                          ? {
                              ...eq,
                              ports: eq.ports.map((p) =>
                                p.id === portObj.id
                                  ? { ...p, wavelengthNm: Number(e.target.value) }
                                  : p
                              ),
                            }
                          : eq
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value={1310}>1310 nm (OS2 O-Band)</option>
                  <option value={1550}>1550 nm (OS2 C-Band)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Statut d&apos;Exploitation</label>
                <select
                  value={portObj.status}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      equipments: prev.equipments.map((eq) =>
                        eq.id === portParentEq.id
                          ? {
                              ...eq,
                              ports: eq.ports.map((p) =>
                                p.id === portObj.id
                                  ? { ...p, status: e.target.value as PortStatus }
                                  : p
                              ),
                            }
                          : eq
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value="connected">Connecté (En service)</option>
                  <option value="free">Libre (Bouchon optique)</option>
                  <option value="reserved">Réservé Commande</option>
                  <option value="fault">Défaut / Alarme LOS</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {portObj.connectedFiberId && (
                <button
                  type="button"
                  onClick={() =>
                    onTraceFromPortOrFiber(portObj.connectedFiberId, portObj.id)
                  }
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Mettre en Valeur le Parcours de Bout en Bout (2D/3D)
                </button>
              )}
              <button
                type="button"
                onClick={() => onStartPatchFromPort(portParentEq.id, portObj.id)}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg border border-slate-700 transition-colors"
              >
                Brasser une Nouvelle Jarretière OS2 depuis ce Port →
              </button>
            </div>
          </div>
        )}

        {currentRef.kind === 'fiber' && fiberObj && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {fiberObj.kind === 'trunk_cable'
                ? `Câble Fibre Rocade ${fiberObj.trunkCapacity || '24FO'} (Déployé par l'Hébergeur)`
                : `Jarretière Optique OS2 (${fiberObj.polarity})`}
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Désignation</label>
              <input
                type="text"
                value={fiberObj.name}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    fibers: prev.fibers.map((f) =>
                      f.id === fiberObj.id ? { ...f, name: e.target.value } : f
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  value={fiberObj.code}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      fibers: prev.fibers.map((f) =>
                        f.id === fiberObj.id ? { ...f, code: e.target.value } : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Polarité (Mono / Bi-Fibre)
                </label>
                <select
                  value={fiberObj.polarity}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      fibers: prev.fibers.map((f) =>
                        f.id === fiberObj.id
                          ? { ...f, polarity: e.target.value as PolarityMode }
                          : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-amber-300"
                >
                  <option value="Bi-Fibre (2FO Duplex)">Bi-Fibre (2FO Duplex)</option>
                  <option value="Mono-Fibre (1FO Simplex)">Mono-Fibre (1FO Simplex)</option>
                </select>
              </div>
            </div>

            {fiberObj.kind === 'trunk_cable' && (
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Capacité du Câble Fibre Rocade (Inter-Salles)
                </label>
                <select
                  value={fiberObj.trunkCapacity || '24FO'}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      fibers: prev.fibers.map((f) =>
                        f.id === fiberObj.id
                          ? { ...f, trunkCapacity: e.target.value as TrunkCapacityFO }
                          : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-sky-500/50 rounded-lg text-sky-300"
                >
                  <option value="6FO">Câble 6FO OS2</option>
                  <option value="12FO">Câble 12FO OS2 (Baie Client → MMR)</option>
                  <option value="24FO">Câble 24FO OS2 (Baie SFR → MMR)</option>
                  <option value="48FO">Câble 48FO OS2</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Longueur (m)</label>
                <input
                  type="number"
                  step={0.5}
                  value={fiberObj.lengthMeters}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      fibers: prev.fibers.map((f) =>
                        f.id === fiberObj.id
                          ? { ...f, lengthMeters: Number(e.target.value) }
                          : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Atténuation Mesurée (dB)
                </label>
                <input
                  type="number"
                  step={0.01}
                  value={fiberObj.attenuationDb}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      fibers: prev.fibers.map((f) =>
                        f.id === fiberObj.id
                          ? { ...f, attenuationDb: Number(e.target.value) }
                          : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onTraceFromPortOrFiber(fiberObj.id)}
              className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
            >
              Isoler toute la Liaison de Bout en Bout contenant ce Tronçon
            </button>
          </div>
        )}

        {currentRef.kind === 'pathway' && pathwayObj && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Chemin de Câblage Optique (FiberRunner)
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Nom du Chemin de Câblage
              </label>
              <input
                type="text"
                value={pathwayObj.name}
                onChange={(e) =>
                  onUpdateSite((prev) => ({
                    ...prev,
                    pathways: prev.pathways.map((pw) =>
                      pw.id === pathwayObj.id ? { ...pw, name: e.target.value } : pw
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Code Goulotte</label>
                <input
                  type="text"
                  value={pathwayObj.code}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      pathways: prev.pathways.map((pw) =>
                        pw.id === pathwayObj.id ? { ...pw, code: e.target.value } : pw
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Capacité Max Fibres</label>
                <input
                  type="number"
                  value={pathwayObj.capacityFibers}
                  onChange={(e) =>
                    onUpdateSite((prev) => ({
                      ...prev,
                      pathways: prev.pathways.map((pw) =>
                        pw.id === pathwayObj.id
                          ? { ...pw, capacityFibers: Number(e.target.value) }
                          : pw
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Custom Technical Attributes */}
        <div className="pt-5 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Attributs Techniques Personnalisables ({activeAttributes.length})
            </h3>
          </div>

          <div className="space-y-2">
            {activeAttributes.map((attr) => (
              <div
                key={attr.id}
                className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800"
              >
                <input
                  type="text"
                  value={attr.key}
                  onChange={(e) =>
                    handleUpdateCustomAttribute(attr.id, e.target.value, attr.value)
                  }
                  className="w-2/5 px-2 py-1 text-xs font-medium bg-slate-900 border border-slate-800 rounded text-slate-300"
                />
                <input
                  type="text"
                  value={attr.value}
                  onChange={(e) =>
                    handleUpdateCustomAttribute(attr.id, attr.key, e.target.value)
                  }
                  className="flex-1 px-2 py-1 text-xs font-mono bg-slate-900 border border-slate-800 rounded text-amber-300"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteCustomAttribute(attr.id)}
                  className="p-1 text-slate-500 hover:text-rose-400"
                  title="Supprimer cet attribut"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddCustomAttribute} className="pt-2 space-y-2">
            <div className="text-[11px] text-slate-400">
              Ajouter un nouvel attribut technique (ex: N° Tube, Brin FO, Réf. Commande MMR) :
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nom de l'attribut"
                value={newAttrKey}
                onChange={(e) => setNewAttrKey(e.target.value)}
                className="w-2/5 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
              <input
                type="text"
                placeholder="Valeur technique"
                value={newAttrVal}
                onChange={(e) => setNewAttrVal(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
              />
              <button
                type="submit"
                className="p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shrink-0"
                title="Ajouter l'attribut"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
