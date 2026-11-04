import { FiberConnection, TelecomSite } from '../types/telecom';

// Code couleur par zone, calqué sur la couleur des salles :
// bleu = côté opérateur, vert = côté client, ambre = interconnexion cross-connect en MMR.
export const ROCADE_OPERATEUR_HEX = '#0284c7';
export const ROCADE_CLIENT_HEX = '#059669';
export const CROSS_CONNECT_HEX = '#f59e0b';

type RoomType = 'operator' | 'mmr' | 'client' | undefined;

// Gaine d'une rocade : verte si elle dessert la salle client, bleue sinon.
export function trunkJacketHex(roomTypeA: RoomType, roomTypeB: RoomType): string {
  return roomTypeA === 'client' || roomTypeB === 'client'
    ? ROCADE_CLIENT_HEX
    : ROCADE_OPERATEUR_HEX;
}

function roomOfEquipment(site: TelecomSite, equipmentId: string) {
  const eq = site.equipments.find((e) => e.id === equipmentId);
  const rack = eq && site.racks.find((r) => r.id === eq.rackId);
  return rack && site.rooms.find((rm) => rm.id === rack.roomId);
}

// Couleur de la zone traversée par un tronçon (sert à la mise en évidence de la route) :
// la salle hors MMR pour une rocade, la MMR pour le cross-connect, la salle locale sinon.
export function fiberZoneHex(site: TelecomSite, fiber: FiberConnection): string {
  if (fiber.kind === 'cross_connect_jumper') return CROSS_CONNECT_HEX;
  const roomA = roomOfEquipment(site, fiber.sourceEquipmentId);
  const roomB = roomOfEquipment(site, fiber.targetEquipmentId);
  const zone = roomA?.type === 'mmr' ? roomB ?? roomA : roomA ?? roomB;
  return zone?.colorHex ?? CROSS_CONNECT_HEX;
}
