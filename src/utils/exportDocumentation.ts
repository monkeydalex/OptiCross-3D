import { jsPDF } from 'jspdf';
import { TelecomSite } from '../types/telecom';
import { OpticalBudgetReport } from './opticalCalculations';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateTechnicalSvgDocument(
  site: TelecomSite,
  budget: OpticalBudgetReport
): string {
  const width = 1400;
  const height = 980;
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const mapX = (xM: number) => Math.round(700 + xM * 52);
  const mapZ = (zM: number) => Math.round(265 + zM * 26);

  const activeFiberIds = new Set(budget.hops.map((h) => h.fiber.id));

  let roomsSvg = '';
  site.rooms.forEach((rm) => {
    const rx = mapX(rm.bounds.x - rm.bounds.width / 2);
    const ry = mapZ(rm.bounds.z - rm.bounds.depth / 2);
    const rw = Math.round(rm.bounds.width * 52);
    const rh = Math.round(rm.bounds.depth * 26);
    roomsSvg += `
      <g>
        <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="6" fill="#0f172a" stroke="${rm.colorHex}" stroke-width="2" stroke-dasharray="6,3" />
        <rect x="${rx}" y="${ry}" width="${rw}" height="28" rx="4" fill="${rm.colorHex}" fill-opacity="0.18" />
        <text x="${rx + 12}" y="${ry + 19}" fill="#f8fafc" font-family="Plus Jakarta Sans, sans-serif" font-size="11.5" font-weight="700">${escapeXml(rm.name)}</text>
        <text x="${rx + rw - 12}" y="${ry + 19}" text-anchor="end" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="9.5">${escapeXml(rm.code)}</text>
      </g>
    `;
  });

  let pathwaysSvg = '';
  site.pathways.forEach((pw) => {
    if (pw.waypoints.length < 2) return;
    const pts = pw.waypoints.map(([x, , z]) => `${mapX(x)},${mapZ(z)}`).join(' ');
    pathwaysSvg += `
      <g>
        <polyline points="${pts}" fill="none" stroke="${pw.colorHex}" stroke-opacity="0.25" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="${pts}" fill="none" stroke="${pw.colorHex}" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="4,4" />
      </g>
    `;
  });

  let racksSvg = '';
  site.racks.forEach((rk) => {
    const cx = mapX(rk.position3D[0]);
    const cz = mapZ(rk.position3D[2]);
    const rw = 102;
    const rh = 54;
    const eqCount = site.equipments.filter((e) => e.rackId === rk.id).length;
    racksSvg += `
      <g>
        <rect x="${cx - rw / 2}" y="${cz - rh / 2}" width="${rw}" height="${rh}" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.5" />
        <text x="${cx}" y="${cz - 6}" text-anchor="middle" fill="#f8fafc" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">${escapeXml(rk.code)}</text>
        <text x="${cx}" y="${cz + 10}" text-anchor="middle" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="9">${escapeXml(rk.name.slice(0, 20))}</text>
        <text x="${cx}" y="${cz + 22}" text-anchor="middle" fill="#38bdf8" font-family="IBM Plex Mono, monospace" font-size="9">OS2 · ${eqCount} Équip.</text>
      </g>
    `;
  });

  let fibersPhysicalSvg = '';
  site.fibers.forEach((fib) => {
    const eqA = site.equipments.find((e) => e.id === fib.sourceEquipmentId);
    const eqB = site.equipments.find((e) => e.id === fib.targetEquipmentId);
    if (!eqA || !eqB) return;
    const rkA = site.racks.find((r) => r.id === eqA.rackId);
    const rkB = site.racks.find((r) => r.id === eqB.rackId);
    if (!rkA || !rkB) return;

    const x1 = mapX(rkA.position3D[0]);
    const y1 = mapZ(rkA.position3D[2]);
    const x2 = mapX(rkB.position3D[0]);
    const y2 = mapZ(rkB.position3D[2]);
    const isActive = activeFiberIds.has(fib.id);
    const isTrunk = fib.kind === 'trunk_cable';
    const midY = mapZ(0) + (isActive ? -8 : 8);

    const pathD =
      rkA.id === rkB.id
        ? `M ${x1 - 25} ${y1} C ${x1 - 55} ${y1 - 35}, ${x1 + 55} ${y1 - 35}, ${x1 + 25} ${y1}`
        : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    fibersPhysicalSvg += `
      <path d="${pathD}" fill="none" stroke="${isActive ? fib.JacketColorHex : '#475569'}" stroke-width="${isTrunk ? (isActive ? 6 : 3) : isActive ? 3 : 1.2}" stroke-opacity="${isActive ? 1 : 0.4}" />
    `;
  });

  let logicalNodesSvg = '';
  const hops = budget.hops;
  if (hops.length > 0) {
    interface LogicalStation {
      roomCode: string;
      rackCode: string;
      eqName: string;
      eqCode: string;
      portLabel: string;
      connector: string;
      colorHex: string;
    }

    const stations: LogicalStation[] = [];
    hops.forEach((h, i) => {
      if (i === 0) {
        stations.push({
          roomCode: h.sourceRoom.code,
          rackCode: h.sourceRack.code,
          eqName: h.sourceEquipment.name,
          eqCode: h.sourceEquipment.code,
          portLabel: h.sourcePort.label,
          connector: h.sourcePort.connector,
          colorHex: h.sourceRoom.colorHex,
        });
      }
      stations.push({
        roomCode: h.targetRoom.code,
        rackCode: h.targetRack.code,
        eqName: h.targetEquipment.name,
        eqCode: h.targetEquipment.code,
        portLabel: h.targetPort.label,
        connector: h.targetPort.connector,
        colorHex: h.targetRoom.colorHex,
      });
    });

    const startX = 95;
    const endX = 1305;
    const stepX = stations.length > 1 ? (endX - startX) / (stations.length - 1) : 0;
    const nodeY = 560;

    hops.forEach((h, idx) => {
      const xA = Math.round(startX + idx * stepX);
      const xB = Math.round(startX + (idx + 1) * stepX);
      const midX = Math.round((xA + xB) / 2);
      const isTrunk = h.fiber.kind === 'trunk_cable';
      const typeLabel = isTrunk
        ? `CÂBLE ROCADE ${h.fiber.trunkCapacity || '24FO'}`
        : h.fiber.kind === 'cross_connect_jumper'
        ? `JARRETIÈRE XC (${h.fiber.polarity.split(' ')[0]})`
        : `JARRETIÈRE (${h.fiber.polarity.split(' ')[0]})`;

      logicalNodesSvg += `
        <g>
          <line x1="${xA + 70}" y1="${nodeY}" x2="${xB - 70}" y2="${nodeY}" stroke="${h.fiber.JacketColorHex}" stroke-width="${isTrunk ? 6 : 3}" />
          <rect x="${midX - 64}" y="${nodeY - 40}" width="128" height="32" rx="4" fill="#090d16" stroke="${h.fiber.JacketColorHex}" stroke-width="1.2" />
          <text x="${midX}" y="${nodeY - 26}" text-anchor="middle" fill="#f8fafc" font-family="IBM Plex Mono, monospace" font-size="8.5" font-weight="700">${escapeXml(typeLabel)}</text>
          <text x="${midX}" y="${nodeY - 14}" text-anchor="middle" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="8">OS2 · ${h.fiber.lengthMeters}m · -${h.calculatedLossDb}dB</text>
        </g>
      `;
    });

    stations.forEach((st, idx) => {
      const cx = Math.round(startX + idx * stepX);
      logicalNodesSvg += `
        <g>
          <rect x="${cx - 72}" y="${nodeY - 45}" width="144" height="96" rx="6" fill="#0f172a" stroke="${st.colorHex}" stroke-width="2" />
          <rect x="${cx - 72}" y="${nodeY - 45}" width="144" height="20" rx="4" fill="${st.colorHex}" fill-opacity="0.25" />
          <text x="${cx}" y="${nodeY - 31}" text-anchor="middle" fill="#f8fafc" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">${escapeXml(st.rackCode)}</text>
          <text x="${cx}" y="${nodeY - 10}" text-anchor="middle" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="9.5" font-weight="700">${escapeXml(st.eqCode)}</text>
          <text x="${cx}" y="${nodeY + 6}" text-anchor="middle" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="8.5">${escapeXml(st.eqName.slice(0, 22))}</text>
          <rect x="${cx - 56}" y="${nodeY + 16}" width="112" height="24" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1" />
          <text x="${cx}" y="${nodeY + 32}" text-anchor="middle" fill="#fbbf24" font-family="IBM Plex Mono, monospace" font-size="9.5" font-weight="600">${escapeXml(st.portLabel)} (${escapeXml(st.connector)})</text>
        </g>
      `;
    });
  }

  let tableRowsSvg = '';
  hops.forEach((h, idx) => {
    const rowY = 755 + idx * 24;
    const nature =
      h.fiber.kind === 'trunk_cable'
        ? `Câble Rocade ${h.fiber.trunkCapacity || '24FO'} (Hébergeur)`
        : `Jarretière ${h.fiber.polarity.split(' ')[0]}`;
    tableRowsSvg += `
      <g>
        <line x1="50" y1="${rowY + 6}" x2="960" y2="${rowY + 6}" stroke="#1e293b" stroke-width="1" />
        <text x="58" y="${rowY}" fill="#f59e0b" font-family="IBM Plex Mono, monospace" font-size="9.5" font-weight="600">#0${h.stepIndex}</text>
        <text x="95" y="${rowY}" fill="#38bdf8" font-family="IBM Plex Mono, monospace" font-size="9.5" font-weight="600">${escapeXml(nature)}</text>
        <text x="295" y="${rowY}" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="9.5">${escapeXml(h.sourceRack.code)} · ${escapeXml(h.sourceEquipment.code)} (${escapeXml(h.sourcePort.label)})</text>
        <text x="565" y="${rowY}" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="9.5">${escapeXml(h.targetRack.code)} · ${escapeXml(h.targetEquipment.code)} (${escapeXml(h.targetPort.label)})</text>
        <text x="820" y="${rowY}" fill="#f8fafc" font-family="IBM Plex Mono, monospace" font-size="9.5">OS2 · ${h.fiber.lengthMeters}m</text>
        <text x="905" y="${rowY}" fill="#fbbf24" font-family="IBM Plex Mono, monospace" font-size="9.5">-${h.calculatedLossDb.toFixed(2)} dB</text>
      </g>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#020617" />
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#334155" stroke-width="2" />
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="#1e293b" stroke-width="1" />

  <rect x="30" y="30" width="${width - 60}" height="52" fill="#0f172a" />
  <line x1="30" y1="82" x2="${width - 30}" y2="82" stroke="#334155" stroke-width="1.5" />
  <text x="50" y="54" fill="#f8fafc" font-family="Plus Jakarta Sans, sans-serif" font-size="15.5" font-weight="700">DOSSIER CROSS-CONNECT MONOMODE OS2 (JARRETIÈRES VS CÂBLES ROCADES 24FO/12FO) — ${escapeXml(site.name)}</text>
  <text x="50" y="72" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="10.5">Salle MMR : Accès Exclusif Hébergeur Tiers · Liaison : ${escapeXml(budget.title)}</text>
  <text x="${width - 50}" y="60" text-anchor="end" fill="#f59e0b" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="600">DATE: ${escapeXml(dateStr)}</text>

  <text x="50" y="106" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700">01. PLAN PHYSIQUE 2D — BAIE SFR (CÂBLE 24FO) ↔ SALLE MMR (CROSS-CONNECT) ↔ BAIE CLIENT (CÂBLE 12FO)</text>
  ${pathwaysSvg}
  ${roomsSvg}
  ${fibersPhysicalSvg}
  ${racksSvg}

  <line x1="30" y1="435" x2="${width - 30}" y2="435" stroke="#1e293b" stroke-width="1.5" />
  <text x="50" y="462" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700">02. SCHÉMA LOGIQUE DE BOUT EN BOUT (${escapeXml(budget.title)})</text>
  ${logicalNodesSvg}

  <line x1="30" y1="685" x2="${width - 30}" y2="685" stroke="#1e293b" stroke-width="1.5" />
  <text x="50" y="712" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700">03. CARNET DE CÂBLAGE (NATURE PHYSIQUE : JARRETIÈRE VS CÂBLE ROCADE) &amp; BILAN OPTIQUE OS2</text>
  
  <rect x="50" y="722" width="910" height="20" fill="#0f172a" />
  <text x="58" y="736" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">#</text>
  <text x="95" y="736" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">TYPE (JARRETIÈRE / CÂBLE)</text>
  <text x="295" y="736" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">EXTRÉMITÉ A (ORIGINE)</text>
  <text x="565" y="736" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">EXTRÉMITÉ B (DESTINATION)</text>
  <text x="820" y="736" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">MODE / LONG.</text>
  <text x="905" y="736" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="600">PERTE</text>
  ${tableRowsSvg}

  <rect x="985" y="700" width="365" height="235" rx="4" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
  <rect x="985" y="700" width="365" height="30" rx="4" fill="#1e293b" />
  <text x="1000" y="720" fill="#f8fafc" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">CARTOUCHE &amp; BILAN OPTIQUE OS2</text>
  
  <text x="1000" y="752" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="10">Longueur Totale Optique :</text>
  <text x="1335" y="752" text-anchor="end" fill="#f8fafc" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">${budget.totalLengthMeters.toFixed(1)} m (${budget.hops.length} tronçons)</text>

  <text x="1000" y="776" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="10">Standard Fibre / Onde :</text>
  <text x="1335" y="776" text-anchor="end" fill="#38bdf8" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">100% OS2 Monomode (${budget.wavelengthNm} nm)</text>

  <text x="1000" y="800" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="10">Atténuation Cumulée :</text>
  <text x="1335" y="800" text-anchor="end" fill="#fbbf24" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">-${budget.totalAttenuationDb.toFixed(2)} dB</text>

  <text x="1000" y="824" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="10">Puissance Émise / Reçue :</text>
  <text x="1335" y="824" text-anchor="end" fill="#10b981" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">+${budget.txPowerDbm.toFixed(1)} dBm → ${budget.rxPowerDbm.toFixed(2)} dBm</text>

  <text x="1000" y="848" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="10">Marge Optique Disponible :</text>
  <text x="1335" y="848" text-anchor="end" fill="#10b981" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">+${budget.opticalMarginDb.toFixed(2)} dB</text>

  <line x1="985" y1="868" x2="1350" y2="868" stroke="#334155" stroke-width="1" />
  <text x="1000" y="890" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="9.5" font-weight="600">ROCADE SFR : Câble 24FO · ROCADE CLIENT : Câble 12FO</text>
  <text x="1000" y="908" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="9">SALLE MMR : Déploiement exclusif Hébergeur Tiers</text>
  <text x="1000" y="924" fill="#64748b" font-family="IBM Plex Mono, monospace" font-size="9">DOCUMENT GÉNÉRÉ PAR OPTICROSS 3D CAO</text>
</svg>`;
}

export function downloadSvgEngineeringDiagram(
  site: TelecomSite,
  budget: OpticalBudgetReport
): void {
  const svgContent = generateTechnicalSvgDocument(site, budget);
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanCode = (budget.crossConnectId || site.code).replace(/[^a-zA-Z0-9-_]/g, '_');
  a.download = `Schema_OptiCross_OS2_${cleanCode}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPdfEngineeringReport(
  site: TelecomSite,
  budget: OpticalBudgetReport
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFillColor(10, 15, 29);
  doc.rect(0, 0, 297, 210, 'F');

  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.5);
  doc.rect(6, 6, 285, 198);

  doc.setFillColor(15, 23, 42);
  doc.rect(6, 6, 285, 20, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    `DOSSIER D'INGENIERIE CROSS-CONNECT MONOMODE OS2 (JARRETIERES VS CABLES ROCADES) — ${site.code}`,
    12,
    14
  );

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    `Salle Operateur (Baie SFR - Cable 24FO)  |  Salle MMR (Acces Exclusif Hebergeur - Cross-Connect Mono/Bi-Fibre)  |  Salle Client (Baie Client - Cable 12FO)`,
    12,
    21
  );

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    '01. ARCHITECTURE PHYSIQUE DES SALLES & RESPONSABILITE DES CABLES ROCADES (100% OS2)',
    12,
    34
  );

  site.rooms.forEach((rm, idx) => {
    const boxX = 12 + idx * 92;
    const boxY = 38;
    const boxW = 87;
    const boxH = 42;

    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(71, 85, 105);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

    doc.setTextColor(248, 250, 252);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.text(`${rm.name.slice(0, 36)}`, boxX + 3, boxY + 6.5);

    doc.setTextColor(56, 189, 248);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${rm.accessRestriction.slice(0, 50)}`, boxX + 3, boxY + 12);

    const roomRacks = site.racks.filter((r) => r.roomId === rm.id);
    roomRacks.forEach((rk, rIdx) => {
      const rx = boxX + 3 + rIdx * 40;
      const ry = boxY + 15.5;
      doc.setFillColor(30, 41, 59);
      doc.setDrawColor(100, 116, 139);
      doc.roundedRect(rx, ry, 38, 22, 1.5, 1.5, 'FD');

      doc.setTextColor(245, 158, 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(rk.code, rx + 2.5, ry + 5.5);

      const eqs = site.equipments.filter((e) => e.rackId === rk.id);
      doc.setTextColor(203, 213, 225);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      eqs.slice(0, 2).forEach((eq, eIdx) => {
        doc.text(`U${eq.uPosition}: ${eq.code.slice(0, 16)}`, rx + 2.5, ry + 11 + eIdx * 4.5);
      });
    });
  });

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`02. SCHEMA LOGIQUE DE BOUT EN BOUT : ${budget.title}`, 12, 90);

  if (budget.hops.length > 0) {
    const stationsCount = budget.hops.length + 1;
    const stepW = Math.min(46, 265 / stationsCount);

    budget.hops.forEach((h, idx) => {
      const sx = 12 + idx * stepW;
      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(56, 189, 248);
      doc.roundedRect(sx, 94, stepW - 8, 26, 1.5, 1.5, 'FD');

      doc.setTextColor(248, 250, 252);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(h.sourceRack.code, sx + 2, 100);
      doc.setTextColor(203, 213, 225);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.text(h.sourceEquipment.code.slice(0, 16), sx + 2, 105);
      doc.setTextColor(251, 191, 36);
      doc.text(`${h.sourcePort.label} (${h.sourcePort.connector})`, sx + 2, 110.5);
      doc.setTextColor(56, 189, 248);
      doc.text(
        h.fiber.kind === 'trunk_cable'
          ? `Cable ${h.fiber.trunkCapacity || '24FO'}`
          : `Jarretiere ${h.fiber.polarity.split(' ')[0]}`,
        sx + 2,
        116
      );

      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.8);
      doc.line(sx + stepW - 8, 107, sx + stepW, 107);

      if (idx === budget.hops.length - 1) {
        const fx = 12 + (idx + 1) * stepW;
        doc.setFillColor(15, 23, 42);
        doc.setDrawColor(16, 185, 129);
        doc.roundedRect(fx, 94, stepW - 8, 26, 1.5, 1.5, 'FD');
        doc.setTextColor(248, 250, 252);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(h.targetRack.code, fx + 2, 100);
        doc.setTextColor(203, 213, 225);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.text(h.targetEquipment.code.slice(0, 16), fx + 2, 105);
        doc.setTextColor(251, 191, 36);
        doc.text(`${h.targetPort.label} (${h.targetPort.connector})`, fx + 2, 110.5);
        doc.setTextColor(16, 185, 129);
        doc.text(`RX: ${budget.rxPowerDbm} dBm`, fx + 2, 116);
      }
    });
  }

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('03. CARNET DE CABLAGE DETAILLE (JARRETIERE VS CABLE ROCADE) & BILAN OTDR', 12, 130);

  doc.setFillColor(30, 41, 59);
  doc.rect(12, 134, 195, 7, 'F');
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(7);
  doc.text('#', 14, 138.8);
  doc.text('NATURE PHYSIQUE & POLARITE', 21, 138.8);
  doc.text('ORIGINE (BAIE / TIROIR / PORT)', 72, 138.8);
  doc.text('DESTINATION (BAIE / TIROIR / PORT)', 130, 138.8);
  doc.text('LONG.', 182, 138.8);
  doc.text('PERTE', 195, 138.8);

  budget.hops.forEach((h, idx) => {
    const ry = 146 + idx * 7.5;
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.text(`0${h.stepIndex}`, 14, ry);

    const natureText =
      h.fiber.kind === 'trunk_cable'
        ? `Cable Rocade ${h.fiber.trunkCapacity || '24FO'} (Hebergeur)`
        : `Jarretiere ${h.fiber.polarity.split(' ')[0]}`;
    doc.setTextColor(56, 189, 248);
    doc.text(natureText, 21, ry);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(
      `${h.sourceRack.code} · ${h.sourceEquipment.code.slice(0, 14)} [${h.sourcePort.label}]`,
      72,
      ry
    );
    doc.text(
      `${h.targetRack.code} · ${h.targetEquipment.code.slice(0, 14)} [${h.targetPort.label}]`,
      130,
      ry
    );

    doc.setTextColor(248, 250, 252);
    doc.text(`${h.fiber.lengthMeters}m`, 182, ry);

    doc.setTextColor(251, 191, 36);
    doc.text(`-${h.calculatedLossDb.toFixed(2)}dB`, 195, ry);
  });

  doc.setFillColor(15, 23, 42);
  doc.setDrawColor(71, 85, 105);
  doc.roundedRect(212, 134, 73, 62, 2, 2, 'FD');

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text('BILAN OPTIQUE MONOMODE OS2', 216, 141);

  const metrics = [
    ['Standard Fibre :', '100% OS2 Monomode'],
    ['Longueur Totale :', `${budget.totalLengthMeters.toFixed(1)} metres`],
    ['Longueur d\'onde :', `${budget.wavelengthNm} nm`],
    ['Connecteurs / Episs. :', `${budget.totalConnectors} conn. / ${budget.totalSplices} ep.`],
    ['Perte d\'Insertion :', `-${budget.totalAttenuationDb.toFixed(2)} dB`],
    ['Puissance TX / RX :', `+${budget.txPowerDbm.toFixed(1)} / ${budget.rxPowerDbm.toFixed(2)} dBm`],
    ['Marge Optique :', `+${budget.opticalMarginDb.toFixed(2)} dB (${budget.status.toUpperCase()})`],
    ['Acces Salle MMR :', 'Exclusif Hebergeur Tiers'],
  ];

  metrics.forEach(([k, v], mIdx) => {
    const my = 148 + mIdx * 5.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(k, 216, my);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(248, 250, 252);
    doc.text(v, 281, my, { align: 'right' });
  });

  const cleanCode = (budget.crossConnectId || site.code).replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`Dossier_OptiCross_OS2_${cleanCode}.pdf`);
}
