import {
  TelecomSite,
  FiberConnection,
  Equipment,
  Rack,
  Room,
  Port,
  FiberMode,
  ConnectorType,
} from '../types/telecom';

export interface HopSegmentDetail {
  stepIndex: number;
  fiber: FiberConnection;
  sourceRoom: Room;
  sourceRack: Rack;
  sourceEquipment: Equipment;
  sourcePort: Port;
  targetRoom: Room;
  targetRack: Rack;
  targetEquipment: Equipment;
  targetPort: Port;
  calculatedLossDb: number;
  cumulativeLossDb: number;
  cumulativeLengthM: number;
}

export interface OpticalBudgetReport {
  crossConnectId?: string;
  title: string;
  hops: HopSegmentDetail[];
  totalLengthMeters: number;
  totalConnectors: number;
  totalSplices: number;
  totalAttenuationDb: number;
  txPowerDbm: number;
  rxPowerDbm: number;
  rxSensitivityDbm: number;
  opticalMarginDb: number;
  wavelengthNm: number;
  status: 'optimal' | 'warning' | 'critical';
}

export function calculateSegmentLossDb(
  _fiberMode: FiberMode,
  wavelengthNm: number,
  lengthMeters: number,
  connectorA: ConnectorType,
  connectorB: ConnectorType,
  spliceCount: number
): number {
  // 100% OS2 Monomode ITU-T G.652.D / G.657.A2
  // 0.35 dB/km @ 1310nm, 0.22 dB/km @ 1550nm
  const dbPerKm = wavelengthNm >= 1500 ? 0.22 : 0.35;
  const lengthLoss = (lengthMeters / 1000) * dbPerKm;

  const connLoss = (conn: ConnectorType) => {
    if (conn.includes('APC')) return 0.15;
    return 0.20; // LC/UPC or SC/UPC
  };

  const connectorInsertionLoss = (connLoss(connectorA) + connLoss(connectorB)) * 0.85;
  const spliceLoss = spliceCount * 0.08;

  return Number((lengthLoss + connectorInsertionLoss + spliceLoss).toFixed(2));
}

export function buildOpticalBudgetForFibers(
  site: TelecomSite,
  fiberIds: string[],
  title = 'Parcours Fibre Optique Monomode OS2 de Bout en Bout',
  crossConnectId?: string
): OpticalBudgetReport {
  const hops: HopSegmentDetail[] = [];
  let cumulativeLossDb = 0;
  let cumulativeLengthM = 0;
  let totalSplices = 0;
  let txPowerDbm = 2.0;
  let rxSensitivityDbm = -14.0;
  let wavelengthNm = 1310;

  fiberIds.forEach((fid, idx) => {
    const fiber = site.fibers.find((f) => f.id === fid);
    if (!fiber) return;

    const sourceEquipment = site.equipments.find((e) => e.id === fiber.sourceEquipmentId);
    const targetEquipment = site.equipments.find((e) => e.id === fiber.targetEquipmentId);
    if (!sourceEquipment || !targetEquipment) return;

    const sourceRack = site.racks.find((r) => r.id === sourceEquipment.rackId);
    const targetRack = site.racks.find((r) => r.id === targetEquipment.rackId);
    if (!sourceRack || !targetRack) return;

    const sourceRoom = site.rooms.find((rm) => rm.id === sourceRack.roomId);
    const targetRoom = site.rooms.find((rm) => rm.id === targetRack.roomId);
    if (!sourceRoom || !targetRoom) return;

    const sourcePort =
      sourceEquipment.ports.find((p) => p.id === fiber.sourcePortId) || sourceEquipment.ports[0];
    const targetPort =
      targetEquipment.ports.find((p) => p.id === fiber.targetPortId) || targetEquipment.ports[0];

    if (idx === 0 && sourcePort) {
      wavelengthNm = sourcePort.wavelengthNm || 1310;
      if (sourcePort.txPowerDbm !== undefined) txPowerDbm = sourcePort.txPowerDbm;
    }
    if (targetPort && targetPort.rxSensitivityDbm !== undefined) {
      rxSensitivityDbm = targetPort.rxSensitivityDbm;
    }

    const segLoss =
      fiber.attenuationDb > 0
        ? fiber.attenuationDb
        : calculateSegmentLossDb(
            fiber.fiberMode,
            wavelengthNm,
            fiber.lengthMeters,
            fiber.connectorA,
            fiber.connectorB,
            fiber.spliceCount
          );

    cumulativeLossDb = Number((cumulativeLossDb + segLoss).toFixed(2));
    cumulativeLengthM = Number((cumulativeLengthM + fiber.lengthMeters).toFixed(1));
    totalSplices += fiber.spliceCount;

    hops.push({
      stepIndex: idx + 1,
      fiber,
      sourceRoom,
      sourceRack,
      sourceEquipment,
      sourcePort,
      targetRoom,
      targetRack,
      targetEquipment,
      targetPort,
      calculatedLossDb: segLoss,
      cumulativeLossDb,
      cumulativeLengthM,
    });
  });

  const rxPowerDbm = Number((txPowerDbm - cumulativeLossDb).toFixed(2));
  const opticalMarginDb = Number((rxPowerDbm - rxSensitivityDbm).toFixed(2));

  let status: 'optimal' | 'warning' | 'critical' = 'optimal';
  if (opticalMarginDb < 1.5) {
    status = 'critical';
  } else if (opticalMarginDb < 4.5) {
    status = 'warning';
  }

  return {
    crossConnectId,
    title,
    hops,
    totalLengthMeters: cumulativeLengthM,
    totalConnectors: hops.length * 2,
    totalSplices,
    totalAttenuationDb: cumulativeLossDb,
    txPowerDbm,
    rxPowerDbm,
    rxSensitivityDbm,
    opticalMarginDb,
    wavelengthNm,
    status,
  };
}

export function traceEndToEndChainFromPortOrFiber(
  site: TelecomSite,
  startFiberId?: string,
  startPortId?: string
): string[] {
  if (startFiberId) {
    const existingXc = site.crossConnects.find((xc) => xc.fiberIds.includes(startFiberId));
    if (existingXc) return existingXc.fiberIds;
  }

  if (startPortId) {
    const connectedFibers = site.fibers.filter(
      (f) => f.sourcePortId === startPortId || f.targetPortId === startPortId
    );
    if (connectedFibers.length > 0) {
      const existingXc = site.crossConnects.find((xc) =>
        connectedFibers.some((cf) => xc.fiberIds.includes(cf.id))
      );
      if (existingXc) return existingXc.fiberIds;
    }
  }

  const seedFiber = startFiberId
    ? site.fibers.find((f) => f.id === startFiberId)
    : site.fibers.find((f) => f.sourcePortId === startPortId || f.targetPortId === startPortId);

  if (!seedFiber) return [];

  const visited = new Set<string>([seedFiber.id]);
  const chain: string[] = [seedFiber.id];

  let currPortId = seedFiber.sourcePortId;
  while (currPortId) {
    const prevFiber = site.fibers.find(
      (f) => !visited.has(f.id) && (f.targetPortId === currPortId || f.sourcePortId === currPortId)
    );
    if (!prevFiber) break;
    visited.add(prevFiber.id);
    chain.unshift(prevFiber.id);
    currPortId = prevFiber.sourcePortId === currPortId ? prevFiber.targetPortId : prevFiber.sourcePortId;
  }

  currPortId = seedFiber.targetPortId;
  while (currPortId) {
    const nextFiber = site.fibers.find(
      (f) => !visited.has(f.id) && (f.sourcePortId === currPortId || f.targetPortId === currPortId)
    );
    if (!nextFiber) break;
    visited.add(nextFiber.id);
    chain.push(nextFiber.id);
    currPortId = nextFiber.sourcePortId === currPortId ? nextFiber.targetPortId : nextFiber.sourcePortId;
  }

  return chain;
}
