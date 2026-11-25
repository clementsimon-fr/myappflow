// Calcul des mensualités de contrat (logique pure, testée dans espace/src/lib/monthly.test.ts).
// Les fichiers de /api qui commencent par « _ » ne sont pas exposés par Vercel.

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function parisToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** « Contrat de maintenance · mensualité » -> « Contrat de maintenance · mensualité de décembre 2026 ». */
export function monthlyTitle(title, iso) {
  const base = String(title || 'Contrat de maintenance · mensualité').replace(/\s+de\s+\S+\s+\d{4}\s*$/i, '').trim();
  const [y, m] = iso.split('-');
  return `${base} de ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Prochain numéro FAC-AAAA-NNN, d'après les numéros existants. */
export function nextInvoiceNumber(numbers, year) {
  const re = new RegExp(`^FAC-${year}-(\\d+)$`);
  const max = numbers.reduce((acc, n) => {
    const m = re.exec(n || '');
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `FAC-${year}-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Factures à créer ce mois-ci : pour chaque contrat actif qui a déjà une facture (le modèle),
 * une nouvelle facture copiée sur la dernière, sauf s'il en existe déjà une ce mois-ci.
 * @param contracts documents de type contrat
 * @param invoices  toutes les factures (pour le modèle, le mois en cours et la numérotation)
 * @param today     AAAA-MM-JJ
 * @param only      identifiant d'un contrat, pour ne traiter que celui-là
 */
export function planMonthlyInvoices(contracts, invoices, today, only) {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const numbers = invoices.map((i) => i.number);
  const plan = [];
  const skipped = [];
  for (const c of contracts) {
    if (only && c.id !== only) continue;
    if (c.kind !== 'contrat' || c.status !== 'actif') {
      skipped.push({ contract: c.number, reason: 'Contrat non actif' });
      continue;
    }
    const mine = invoices
      .filter((i) => i.related_document_id === c.id && i.status !== 'annulee')
      .sort((a, b) => a.issue_date.localeCompare(b.issue_date) || a.number.localeCompare(b.number));
    const model = mine[mine.length - 1];
    if (!model) {
      skipped.push({ contract: c.number, reason: 'Aucune facture modèle : créez la première à la main' });
      continue;
    }
    if (mine.some((i) => i.issue_date.slice(0, 7) === month)) {
      skipped.push({ contract: c.number, reason: 'Facture du mois déjà créée' });
      continue;
    }
    const number = nextInvoiceNumber(numbers, year);
    numbers.push(number);
    plan.push({
      project_id: model.project_id,
      kind: 'facture',
      number,
      title: monthlyTitle(model.title, today),
      module: model.module || '',
      status: 'a_regler',
      visible: true,
      issue_date: today,
      due_date: addDays(today, 30),
      lines: model.lines,
      discount_pct: model.discount_pct,
      vat_rate: model.vat_rate,
      payment_terms: model.payment_terms || '',
      notes: model.notes || '',
      related_document_id: c.id,
    });
  }
  return { plan, skipped };
}
