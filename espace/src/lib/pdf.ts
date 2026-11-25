import { jsPDF } from 'jspdf';
import { computeTotals, euros, frDate, lineTotal } from './money';
import type { Client, Doc, Settings } from './types';

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ACCENT: [number, number, number] = [13, 150, 104];
const MUTED: [number, number, number] = [90, 101, 95];

export function docTitle(doc: Doc): string {
  if (doc.kind === 'devis') return 'DEVIS';
  if (doc.kind === 'facture') return doc.status === 'acquittee' ? 'FACTURE ACQUITTÉE' : 'FACTURE';
  if (doc.kind === 'contrat') return 'CONTRAT';
  return 'DOCUMENT';
}

export function pdfFilename(doc: Doc, client: Pick<Client, 'name'>): string {
  const base = [docTitle(doc), doc.number || doc.title, client.name].filter(Boolean).join(' - ');
  return `${base.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
}

class Writer {
  pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  y = MARGIN;

  ensure(height: number) {
    if (this.y + height > PAGE_H - MARGIN) {
      this.pdf.addPage();
      this.y = MARGIN;
    }
  }

  text(str: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number; width?: number; align?: 'left' | 'right'; gap?: number } = {}) {
    const { size = 10, bold = false, color = [20, 20, 20], x = MARGIN, width = CONTENT_W, align = 'left', gap = 1.5 } = opts;
    const p = this.pdf;
    p.setFont('helvetica', bold ? 'bold' : 'normal');
    p.setFontSize(size);
    p.setTextColor(...color);
    const lines = p.splitTextToSize(str || '', width) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      this.ensure(lh);
      p.text(line, align === 'right' ? x + width : x, this.y + lh * 0.8, { align });
      this.y += lh;
    }
    this.y += gap;
  }

  rule(color: [number, number, number] = [220, 224, 222]) {
    this.pdf.setDrawColor(...color);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 3;
  }
}

/** Génère le PDF d'un devis, d'une facture ou d'un contrat à partir des données. */
export function buildPdf(doc: Doc, client: Client, settings: Settings): jsPDF {
  const w = new Writer();
  const p = w.pdf;

  // En-tête
  p.setFont('helvetica', 'bold');
  p.setFontSize(20);
  p.setTextColor(...ACCENT);
  p.text(docTitle(doc), MARGIN, w.y + 7);
  p.setFontSize(11);
  p.setTextColor(20, 20, 20);
  p.text('CS MyAppFlow', PAGE_W - MARGIN, w.y + 7, { align: 'right' });
  w.y += 13;
  w.text(doc.number || doc.title, { size: 12, bold: true, gap: 1 });
  if (doc.number && doc.title) w.text(doc.title, { size: 10, color: MUTED, gap: 1 });

  const dateLabel = doc.kind === 'facture' ? 'Émise le' : doc.kind === 'devis' ? 'Émis le' : 'Date';
  const dueLabel = doc.kind === 'devis' ? "Valide jusqu'au" : 'Échéance';
  const yDates = w.y;
  w.text(`${dateLabel} : ${frDate(doc.issue_date)}`, { size: 9, color: MUTED, gap: 0 });
  if (doc.due_date && doc.kind !== 'contrat') {
    w.y = yDates;
    w.text(`${dueLabel} : ${frDate(doc.due_date)}`, { size: 9, color: MUTED, align: 'right', gap: 0 });
  }
  w.y += 6;

  // Émetteur / client
  const colW = CONTENT_W / 2 - 4;
  const yBlocks = w.y;
  w.text('ÉMETTEUR', { size: 8, bold: true, color: ACCENT, width: colW, gap: 0.5 });
  const issuer = [settings.issuer_name, settings.issuer_address, settings.issuer_siren && `SIREN : ${settings.issuer_siren}`, settings.issuer_email, settings.issuer_phone]
    .filter(Boolean)
    .join('\n');
  w.text(issuer, { size: 9, width: colW, gap: 0 });
  const yAfterIssuer = w.y;
  w.y = yBlocks;
  const xClient = MARGIN + CONTENT_W / 2 + 4;
  w.text('CLIENT', { size: 8, bold: true, color: ACCENT, x: xClient, width: colW, gap: 0.5 });
  const clientBlock = [client.name, client.address, client.siret && `SIRET : ${client.siret}`, client.contact_name].filter(Boolean).join('\n');
  w.text(clientBlock, { size: 9, x: xClient, width: colW, gap: 0 });
  w.y = Math.max(w.y, yAfterIssuer) + 8;

  if (doc.kind === 'facture' && doc.status === 'acquittee') {
    w.text('Statut : PAYÉE', { size: 10, bold: true, color: ACCENT, gap: 4 });
  }

  if (doc.kind === 'devis' || doc.kind === 'facture') {
    // Tableau des lignes
    const cols = { qty: MARGIN + CONTENT_W - 62, unit: MARGIN + CONTENT_W - 30, total: MARGIN + CONTENT_W };
    const descW = cols.qty - MARGIN - 14;
    p.setFillColor(243, 245, 244);
    p.rect(MARGIN, w.y, CONTENT_W, 8, 'F');
    p.setFont('helvetica', 'bold');
    p.setFontSize(9);
    p.setTextColor(...MUTED);
    p.text('Désignation', MARGIN + 2, w.y + 5.3);
    p.text('Qté', cols.qty, w.y + 5.3, { align: 'right' });
    p.text('P.U. HT', cols.unit, w.y + 5.3, { align: 'right' });
    p.text('Total HT', cols.total - 2, w.y + 5.3, { align: 'right' });
    w.y += 11;

    for (const line of doc.lines) {
      w.ensure(14);
      const yLine = w.y;
      p.setFont('helvetica', 'bold');
      p.setFontSize(10);
      p.setTextColor(20, 20, 20);
      p.text(String(line.quantity ?? ''), cols.qty, yLine + 3.4, { align: 'right' });
      p.text(euros(Number(line.unit_price) || 0), cols.unit, yLine + 3.4, { align: 'right' });
      p.text(euros(lineTotal(line)), cols.total - 2, yLine + 3.4, { align: 'right' });
      w.text(line.title, { size: 10, bold: true, x: MARGIN + 2, width: descW, gap: 0.5 });
      if (line.description) w.text(line.description, { size: 8.5, color: MUTED, x: MARGIN + 4, width: descW - 2, gap: 0 });
      w.y += 3;
      w.rule();
    }

    // Totaux
    const t = computeTotals(doc.lines, doc.discount_pct, doc.vat_rate);
    const xLabel = MARGIN + CONTENT_W - 80;
    const row = (label: string, value: string, bold = false) => {
      w.ensure(6);
      p.setFont('helvetica', bold ? 'bold' : 'normal');
      p.setFontSize(bold ? 11 : 9.5);
      p.setTextColor(20, 20, 20);
      p.text(label, xLabel, w.y + 4);
      p.text(value, MARGIN + CONTENT_W - 2, w.y + 4, { align: 'right' });
      w.y += bold ? 7 : 5.5;
    };
    w.y += 2;
    row('Sous-total HT :', euros(t.subtotal));
    if (t.discount) {
      row(`Remise (${Number(doc.discount_pct)} %) :`, `-${euros(t.discount)}`);
      row('Total HT après remise :', euros(t.net));
    }
    if (Number(doc.vat_rate) > 0) {
      row(`TVA (${Number(doc.vat_rate)} %) :`, euros(t.vat));
    } else if (settings.vat_mention) {
      w.ensure(6);
      p.setFont('helvetica', 'italic');
      p.setFontSize(8.5);
      p.setTextColor(...MUTED);
      p.text(settings.vat_mention, xLabel, w.y + 4);
      w.y += 6;
    }
    row('Total TTC :', euros(t.total), true);
    w.y += 4;
  }

  if (doc.kind === 'contrat' || doc.kind === 'autre') {
    w.rule();
    w.text(doc.body, { size: 9.5, gap: 4 });
  }

  if (doc.kind === 'contrat') {
    // Bloc de signatures : le Prestataire signe (image des Réglages), le Client signe à la main.
    w.ensure(44);
    const colW = (CONTENT_W - 10) / 2;
    const top = w.y;
    const xClient = MARGIN + colW + 10;
    w.text('Le Prestataire', { size: 9, color: MUTED, width: colW, gap: 0.5 });
    w.text(settings.issuer_name, { size: 10, bold: true, width: colW, gap: 1 });
    if (settings.signature_data_url) {
      try {
        p.addImage(settings.signature_data_url, 'PNG', MARGIN, w.y, 42, 20);
      } catch {
        /* image illisible : on continue sans signature */
      }
    }
    w.y = top;
    w.text('Le Client', { size: 9, color: MUTED, x: xClient, width: colW, gap: 0.5 });
    w.text(client.name, { size: 10, bold: true, x: xClient, width: colW, gap: 1 });
    w.text('Signature précédée de « Bon pour accord »', { size: 8, color: MUTED, x: xClient, width: colW, gap: 0 });
    w.y = top + 34;
  }

  if (doc.payment_terms) {
    w.ensure(14);
    w.text(doc.kind === 'devis' ? 'Échéancier de paiement' : 'Conditions de paiement', { size: 10, bold: true, gap: 1 });
    w.text(doc.payment_terms, { size: 9, color: MUTED, gap: 4 });
  }
  if (doc.notes) {
    w.ensure(14);
    w.text('Notes', { size: 10, bold: true, gap: 1 });
    w.text(doc.notes, { size: 9, color: MUTED, gap: 4 });
  }

  if (doc.kind === 'facture' && settings.iban) {
    w.ensure(28);
    w.text('Coordonnées bancaires', { size: 10, bold: true, gap: 1 });
    const bank = [
      settings.bank_holder && `Titulaire : ${settings.bank_holder}`,
      settings.bank_name && `Banque : ${settings.bank_name}`,
      `IBAN : ${settings.iban}`,
      settings.bic && `BIC : ${settings.bic}`,
    ]
      .filter(Boolean)
      .join('\n');
    w.text(bank, { size: 9, gap: 4 });
  }

  if (doc.kind === 'facture' && doc.status === 'acquittee') {
    w.ensure(42);
    const x = MARGIN + CONTENT_W - 70;
    w.text('Facture acquittée — Signature :', { size: 9, x, width: 70, gap: 0.5 });
    w.text(settings.issuer_name, { size: 9, bold: true, x, width: 70, gap: 1 });
    if (settings.signature_data_url) {
      try {
        p.addImage(settings.signature_data_url, 'PNG', x, w.y, 50, 18);
      } catch {
        /* image illisible : on continue sans signature */
      }
    }
    w.y += 20;
    if (doc.acquitted_at) w.text(`Acquittée le ${frDate(doc.acquitted_at)}`, { size: 9, color: MUTED, x, width: 70 });
  }

  // Pied de page
  const pages = p.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    p.setPage(i);
    p.setFont('helvetica', 'normal');
    p.setFontSize(7.5);
    p.setTextColor(...MUTED);
    p.text(`${settings.issuer_name || 'MyAppFlow'} · ${doc.number || ''}`, MARGIN, PAGE_H - 8);
    p.text(`${i} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  }
  return p;
}
