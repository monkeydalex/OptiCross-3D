import { Room, Rack, RackCalepinage } from '../types/telecom';

export const CALEPINAGE_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const CALEPINAGE_ROWS = [1, 2, 3, 4, 5, 6] as const;

export const CALEPINAGE_ROW_INFO: Record<
  number,
  {
    shortLabel: string;
    roleTitle: string;
    zoneType: 'rear_corridor' | 'rack_row_north' | 'front_aisle' | 'rack_row_south';
    defaultFrontDir: 'Sud' | 'Nord';
  }
> = {
  1: {
    shortLabel: 'Couloir Arrière Nord',
    roleTitle: 'Passage Câbles Rocades (Accès Baie Arrière)',
    zoneType: 'rear_corridor',
    defaultFrontDir: 'Sud',
  },
  2: {
    shortLabel: 'Rangée Baies Nord',
    roleTitle: 'Alignement Baies 60×60 (Arrière ↑ Nord · Avant ↓ Sud)',
    zoneType: 'rack_row_north',
    defaultFrontDir: 'Sud',
  },
  3: {
    shortLabel: 'Allée Brassage Avant',
    roleTitle: 'Couloir Central Jarretières (Face Avant Baies)',
    zoneType: 'front_aisle',
    defaultFrontDir: 'Sud',
  },
  4: {
    shortLabel: 'Allée Brassage Avant',
    roleTitle: 'Couloir Central Jarretières (Face Avant Baies)',
    zoneType: 'front_aisle',
    defaultFrontDir: 'Nord',
  },
  5: {
    shortLabel: 'Rangée Baies Sud',
    roleTitle: 'Alignement Baies 60×60 (Avant ↑ Nord · Arrière ↓ Sud)',
    zoneType: 'rack_row_south',
    defaultFrontDir: 'Nord',
  },
  6: {
    shortLabel: 'Couloir Arrière Sud',
    roleTitle: 'Passage Câbles Rocades (Accès Baie Arrière)',
    zoneType: 'rear_corridor',
    defaultFrontDir: 'Nord',
  },
};

export interface FloorTileCell {
  col: string;
  colIndex: number;
  row: number;
  rowIndex: number;
  code: string; // ex: "C-02" (1 Dalle 60x60cm = 1 Baie max, zéro demi-baie)
  worldX: number;
  worldZ: number;
  zoneType: 'rear_corridor' | 'rack_row_north' | 'front_aisle' | 'rack_row_south';
  occupyingRack?: Rack;
}

/**
 * Converts a (tileColumn A..F, tileRow 1..6) within a Room into 3D world [x, 0, z] coordinates.
 * 1 Tile = 60 x 60 cm = 1 Rack footprint (Zero half-rack / demi-baie offset).
 */
export function tileToWorldPosition(
  room: Room,
  tileColumn: string,
  tileRow: number
): [number, number, number] {
  const colIdx = Math.max(
    0,
    Math.min(
      CALEPINAGE_COLUMNS.length - 1,
      CALEPINAGE_COLUMNS.indexOf(tileColumn as any) !== -1
        ? CALEPINAGE_COLUMNS.indexOf(tileColumn as any)
        : 2
    )
  );
  const rowIdx = Math.max(0, Math.min(CALEPINAGE_ROWS.length - 1, tileRow - 1));

  const usableWidth = room.bounds.width - 1.6;
  const usableDepth = room.bounds.depth - 2.0;

  const startX = room.bounds.x - usableWidth / 2;
  const startZ = room.bounds.z - usableDepth / 2;

  const stepX = usableWidth / (CALEPINAGE_COLUMNS.length - 1);
  const stepZ = usableDepth / (CALEPINAGE_ROWS.length - 1);

  const worldX = Number((startX + colIdx * stepX).toFixed(2));
  const worldZ = Number((startZ + rowIdx * stepZ).toFixed(2));

  return [worldX, 0, worldZ];
}

/**
 * Converts a 3D world [x, y, z] inside a Room into the nearest 60x60cm (tileColumn, tileRow).
 * Strictly 1 Dalle (60x60 cm) per Baie — no multi-tile spanning or half-rack offset.
 */
export function worldPositionToTile(
  room: Room,
  pos3D: [number, number, number]
): {
  tileColumn: string;
  tileRow: number;
  tileRangeLabel: string;
  suggestedRowLabel: string;
  suggestedPosInRow: string;
  frontFaceLabel: string;
  rearFaceLabel: string;
  orientationLabel: string;
} {
  const usableWidth = room.bounds.width - 1.6;
  const usableDepth = room.bounds.depth - 2.0;

  const startX = room.bounds.x - usableWidth / 2;
  const startZ = room.bounds.z - usableDepth / 2;

  const stepX = usableWidth / (CALEPINAGE_COLUMNS.length - 1);
  const stepZ = usableDepth / (CALEPINAGE_ROWS.length - 1);

  const rawColIdx = Math.round((pos3D[0] - startX) / stepX);
  const rawRowIdx = Math.round((pos3D[2] - startZ) / stepZ);

  const colIdx = Math.max(0, Math.min(CALEPINAGE_COLUMNS.length - 1, rawColIdx));
  const rowIdx = Math.max(0, Math.min(CALEPINAGE_ROWS.length - 1, rawRowIdx));

  const tileColumn = CALEPINAGE_COLUMNS[colIdx];
  const tileRow = CALEPINAGE_ROWS[rowIdx];
  const rowStr = String(tileRow).padStart(2, '0');

  const tileRangeLabel = `Dalle ${tileColumn}-${rowStr} (60×60 cm)`;
  const suggestedRowLabel =
    tileRow <= 2
      ? 'Rangée Nord (Ligne 02)'
      : tileRow <= 4
      ? 'Allée Centrale (Lignes 03-04)'
      : 'Rangée Sud (Ligne 05)';
  const suggestedPosInRow = `Pos ${String(colIdx + 1).padStart(2, '0')} (Col ${tileColumn})`;

  const frontIsSouth = tileRow <= 3;
  const frontFaceLabel = frontIsSouth
    ? 'Baie Avant (Sud) — Façade Ports & Jarretières OS2'
    : 'Baie Avant (Nord) — Façade Ports & Jarretières OS2';
  const rearFaceLabel = frontIsSouth
    ? 'Baie Arrière (Nord) — Arrivée Câbles Rocades (24FO/12FO)'
    : 'Baie Arrière (Sud) — Arrivée Câbles Rocades (24FO/12FO)';
  const orientationLabel = frontIsSouth
    ? 'Baie Avant au Sud (Allée) · Baie Arrière au Nord (Rocade)'
    : 'Baie Avant au Nord (Allée) · Baie Arrière au Sud (Rocade)';

  return {
    tileColumn,
    tileRow,
    tileRangeLabel,
    suggestedRowLabel,
    suggestedPosInRow,
    frontFaceLabel,
    rearFaceLabel,
    orientationLabel,
  };
}

/**
 * Generates the 6x6 (36 tiles of 60x60cm) Calepinage matrix for a Room.
 * 1 Baie = 1 Dalle 60x60cm (Zero half-rack / demi-baie).
 */
export function buildRoomCalepinageMatrix(room: Room, roomRacks: Rack[]): FloorTileCell[][] {
  const matrix: FloorTileCell[][] = [];

  for (let rIdx = 0; rIdx < CALEPINAGE_ROWS.length; rIdx++) {
    const rowNum = CALEPINAGE_ROWS[rIdx];
    const rowCells: FloorTileCell[] = [];
    const rowMeta = CALEPINAGE_ROW_INFO[rowNum];

    for (let cIdx = 0; cIdx < CALEPINAGE_COLUMNS.length; cIdx++) {
      const colChar = CALEPINAGE_COLUMNS[cIdx];
      const [worldX, , worldZ] = tileToWorldPosition(room, colChar, rowNum);
      const code = `${colChar}-${String(rowNum).padStart(2, '0')}`;

      // Strict 1-to-1 matching: 1 Rack = 1 Single 60x60cm Tile
      const occupyingRack = roomRacks.find(
        (rk) => rk.calepinage.tileColumn === colChar && rk.calepinage.tileRow === rowNum
      );

      rowCells.push({
        col: colChar,
        colIndex: cIdx,
        row: rowNum,
        rowIndex: rIdx,
        code,
        worldX,
        worldZ,
        zoneType: rowMeta.zoneType,
        occupyingRack,
      });
    }

    matrix.push(rowCells);
  }

  return matrix;
}

/**
 * Relocates a Rack to a single 60x60cm tile (tileColumn, tileRow) with zero half-rack offset.
 */
export function relocateRackToTile(
  rack: Rack,
  room: Room,
  tileColumn: string,
  tileRow: number
): Rack {
  const newPos3D = tileToWorldPosition(room, tileColumn, tileRow);
  const computed = worldPositionToTile(room, newPos3D);

  const updatedCalepinage: RackCalepinage = {
    ...rack.calepinage,
    tileColumn: computed.tileColumn,
    tileRow: computed.tileRow,
    tileRangeLabel: computed.tileRangeLabel,
    rowLabel: computed.suggestedRowLabel,
    positionInRow: computed.suggestedPosInRow,
    footprintMm: '600 × 600 mm (1 Dalle entière 60×60 cm — Sans demi-baie)',
    frontFaceLabel: computed.frontFaceLabel,
    rearFaceLabel: computed.rearFaceLabel,
    orientationLabel: computed.orientationLabel,
  };

  return {
    ...rack,
    widthM: 0.6,
    depthM: 0.6,
    position3D: newPos3D,
    calepinage: updatedCalepinage,
  };
}

/**
 * Inverts a Rack's Baie Avant / Baie Arrière orientation (180° flip) while keeping it on its 60x60cm tile.
 */
export function flipRackFrontRearOrientation(rack: Rack): Rack {
  const newRotY = Math.abs(rack.rotationY) > 0.1 ? 0 : Math.PI;
  const isFlipped = Math.abs(newRotY) > 0.1;

  const frontFaceLabel = isFlipped
    ? 'Baie Avant (Nord) — Façade Ports & Jarretières OS2'
    : 'Baie Avant (Sud) — Façade Ports & Jarretières OS2';
  const rearFaceLabel = isFlipped
    ? 'Baie Arrière (Sud) — Arrivée Câbles Rocades (24FO/12FO)'
    : 'Baie Arrière (Nord) — Arrivée Câbles Rocades (24FO/12FO)';
  const orientationLabel = isFlipped
    ? 'Baie Avant au Nord · Baie Arrière au Sud (Inversée 180°)'
    : 'Baie Avant au Sud · Baie Arrière au Nord (Standard)';

  return {
    ...rack,
    rotationY: newRotY,
    calepinage: {
      ...rack.calepinage,
      frontFaceLabel,
      rearFaceLabel,
      orientationLabel,
    },
  };
}
