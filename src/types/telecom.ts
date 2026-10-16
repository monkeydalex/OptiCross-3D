export type RoomType = 'operator' | 'mmr' | 'client';

export type FiberMode = 'OS2';

export type PolarityMode = 'Mono-Fibre (1FO Simplex)' | 'Bi-Fibre (2FO Duplex)';

export type TrunkCapacityFO = '6FO' | '12FO' | '24FO' | '48FO' | '72FO';

export type ResponsibilityOwner =
  | 'Hébergeur Tiers (Accès Exclusif MMR)'
  | 'Opérateur Télécom (Baie SFR)'
  | 'Client Final (Baie Client)';

export type ConnectorType = 'LC/APC' | 'LC/UPC' | 'SC/APC' | 'SC/UPC';

export type EquipmentCategory = 'patch_panel' | 'router' | 'switch' | 'dwdm' | 'olt';

export type PortStatus = 'connected' | 'free' | 'reserved' | 'fault';

export type PortRole = 'front_patch' | 'rear_trunk' | 'transceiver';

export type AisleType =
  | 'Allée Centrale de Brassage (Accès Baie Avant)'
  | 'Couloir Arrière Rocades (Accès Baie Arrière)'
  | 'Couloir Confiné MMR (Avant Cross-Connect / Arrière Rocades)';

export type RackFootprintMm = '600 × 600 mm (1 Dalle entière 60×60 cm — Sans demi-baie)';

export interface RackCalepinage {
  rowLabel: string;          // ex: "Rangée Nord (Ligne 02)"
  positionInRow: string;     // ex: "Pos 03 (Dalle C)"
  zoneLabel: string;         // ex: "Îlot POP Opérateur SFR"
  tileColumn: string;        // ex: "C" (Axe X Dalle 60x60cm : A à F)
  tileRow: number;           // ex: 2 (Axe Z Dalle 60x60cm : 01 à 06)
  tileRangeLabel: string;    // ex: "Dalle C-02 (60×60 cm)" -> 1 Baie = 1 Dalle unique !
  footprintMm: RackFootprintMm;
  aisleType: AisleType;
  orientationLabel: string;  // ex: "Baie Avant au Sud (Allée) · Baie Arrière au Nord (Rocade)"
  frontFaceLabel: string;    // ex: "Baie Avant (Sud) — Brassage Jarretières OS2"
  rearFaceLabel: string;     // ex: "Baie Arrière (Nord) — Arrivée Câble Rocade 24FO"
  maxFloorLoadKg: number;    // ex: 1000
  allocatedPowerKw: number;  // ex: 4.5
}

export interface CustomAttribute {
  id: string;
  key: string;
  value: string;
  unit?: string;
}

export interface Port {
  id: string;
  number: number;
  label: string;
  connector: ConnectorType;
  status: PortStatus;
  role: PortRole;
  wavelengthNm: number;
  txPowerDbm?: number;
  rxSensitivityDbm?: number;
  connectedFiberId?: string;
  pairedInternalPortId?: string;
  customAttributes: CustomAttribute[];
}

export interface Equipment {
  id: string;
  rackId: string;
  name: string;
  code: string;
  category: EquipmentCategory;
  manufacturer: string;
  model: string;
  uPosition: number; // 1 to 42
  uHeight: number;   // 1U, 2U, 4U
  trunkCapacity?: TrunkCapacityFO; // e.g., 24FO for SFR ODF, 12FO for Client ODF
  colorHex: string;
  ports: Port[];
  customAttributes: CustomAttribute[];
}

export interface Rack {
  id: string;
  roomId: string;
  name: string;
  code: string;
  uTotal: number;
  position3D: [number, number, number];
  rotationY: number;
  widthM: number;  // 0.60m = 60cm (1 Dalle)
  depthM: number;  // 0.60m = 60cm (1 Dalle)
  heightM: number;
  calepinage: RackCalepinage;
  customAttributes: CustomAttribute[];
}

export interface Room {
  id: string;
  name: string;
  code: string;
  type: RoomType;
  accessRestriction: string;
  description: string;
  bounds: {
    x: number;
    z: number;
    width: number;
    depth: number;
  };
  colorHex: string;
  floorElevationCm: number;
  customAttributes: CustomAttribute[];
}

export interface CablePathway {
  id: string;
  name: string;
  code: string;
  type: 'overhead_fiberrunner' | 'underfloor_tray' | 'vertical_manager';
  waypoints: [number, number, number][];
  widthCm: number;
  heightCm: number;
  capacityFibers: number;
  colorHex: string;
  customAttributes: CustomAttribute[];
}

export interface FiberConnection {
  id: string;
  name: string;
  code: string;
  /**
   * 'patch_cord' = Jarretière souple intra-salle (branchée en BAIE AVANT)
   * 'cross_connect_jumper' = Jarretière Cross-Connect en Salle MMR (branchée en BAIE AVANT entre les 2 baies MMR)
   * 'trunk_cable' = Câble Fibre Optique / Rocade pré-fibrée (6FO, 12FO, 24FO, 48FO) inter-salles (branché en BAIE ARRIÈRE des tiroirs)
   */
  kind: 'patch_cord' | 'trunk_cable' | 'cross_connect_jumper';
  sourceEquipmentId: string;
  sourcePortId: string;
  targetEquipmentId: string;
  targetPortId: string;
  fiberMode: FiberMode;
  polarity: PolarityMode;
  trunkCapacity?: TrunkCapacityFO;
  activeStrandsUsed?: string;
  responsibility: ResponsibilityOwner;
  connectorA: ConnectorType;
  connectorB: ConnectorType;
  JacketColorHex: string;
  lengthMeters: number;
  pathwayIds: string[];
  attenuationDb: number;
  spliceCount: number;
  installedDate: string;
  customAttributes: CustomAttribute[];
}

export interface EndToEndCrossConnect {
  id: string;
  name: string;
  reference: string;
  orderNumber: string;
  polarity: PolarityMode;
  clientName: string;
  operatorName: string;
  serviceType: string;
  wavelengthNm: number;
  fiberIds: string[];
  active: boolean;
  customAttributes: CustomAttribute[];
}

export interface LibraryTemplate {
  id: string;
  name: string;
  category: EquipmentCategory;
  manufacturer: string;
  model: string;
  uHeight: number;
  defaultPortCount: number;
  defaultConnector: ConnectorType;
  defaultRole: 'front_patch' | 'transceiver';
  trunkCapacity?: TrunkCapacityFO;
  colorHex: string;
  stockAvailable: number;
  powerConsumptionW: number;
  description: string;
}

export interface TelecomSite {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  tierLevel: string;
  rooms: Room[];
  racks: Rack[];
  equipments: Equipment[];
  pathways: CablePathway[];
  fibers: FiberConnection[];
  crossConnects: EndToEndCrossConnect[];
  library: LibraryTemplate[];
  customAttributes: CustomAttribute[];
}

export interface SelectedEntityRef {
  kind: 'site' | 'room' | 'rack' | 'equipment' | 'port' | 'fiber' | 'pathway' | 'cross_connect';
  id: string;
  equipmentId?: string;
}
