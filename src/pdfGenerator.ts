import { jsPDF } from 'jspdf';

interface AuditLog {
  tx_id: string;
  senderName: string;
  senderUsername: string;
  receiverName: string;
  receiverUsername: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'ROLLBACKED';
  timestamp: string;
  note: string;
}

// Transliterates Bengali system messages and names to English
// to ensure standard PDF fonts (Helvetica) render clean text without empty squares
const transliterateToAscii = (text: string): string => {
  if (!text) return '';
  
  let clean = text;
  
  const replacements: { [key: string]: string } = {
    'শেখ রুবেল': 'Sheikh Rubel',
    'শেখ কোড এক্সচেঞ্জ': 'Sheikh Code Exchange',
    'আণিকা রহমান': 'Anika Rahman',
    'Anika Rahman': 'Anika Rahman',
    'সাকসেস': 'SUCCESS',
    'রোলব্যাক': 'ROLLBACKED',
    'ব্যালেন্স স্থানান্তর': 'Balance Transfer',
    'টেলিগ্রাম ওয়ালেটে': 'Telegram Wallet',
    'টেলিগ্রাম ওয়ালেট': 'Telegram Wallet',
    'অ্যাপ ব্যালেন্স থেকে': 'App Balance to Telegram Balance',
    'পিটুপি': 'P2P Transfer',
    'P2P Transfer via Telegram Bot': 'P2P Transfer via Telegram Bot',
    'P2P Transfer via Telegram Web App': 'P2P Transfer via Telegram Web App',
    'Concurrent Session Success': 'Concurrent Session Success',
    'Transfer App to Telegram Balance': 'Transfer App to Telegram Balance',
    'P2P Transfer via Bot Command': 'P2P Transfer via Bot Command'
  };

  for (const [key, value] of Object.entries(replacements)) {
    clean = clean.replace(new RegExp(key, 'g'), value);
  }

  // Fallback map for Bengali characters to safe ASCII characters if needed
  // Since we only want readable text, we'll strip unrenderable glyphs to avoid empty boxes
  return clean.replace(/[^\x20-\x7E]/g, '').trim() || 'Transaction Info';
};

export const generateInvoicePDFBlob = (log: AuditLog): Blob => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // --- Design Palette ---
  // Slate Dark Header: rgb(15, 23, 42)
  // Accent Teal: rgb(13, 148, 136)
  // Text Dark: rgb(30, 41, 59)
  // Text Muted: rgb(100, 116, 139)
  // Background Grey: rgb(248, 250, 252)

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, 210, 45, 'F');

  // Accent Border Stripe
  doc.setFillColor(13, 148, 136); // Teal #0D9488
  doc.rect(0, 45, 210, 3, 'F');

  // Brand Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SHEIKH CODE EXCHANGE', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Sovereign Fintech Ecosystem • Anycast Routing Active', 15, 28);
  doc.text('Domain: core.sheikh • Private DNS Network Node-42', 15, 34);

  // Invoice Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('OFFICIAL INVOICE', 195, 23, { align: 'right' });

  // 2. Summary Card Block
  doc.setFillColor(248, 250, 252);
  doc.rect(15, 58, 180, 26, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 58, 180, 26, 'S');

  // Card Labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('TRANSACTION TIMESTAMP', 20, 65);
  doc.text('TRANSACTION ID (UUID)', 75, 65);
  doc.text('STATUS', 155, 65);

  // Card Values
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // slate-900
  const dateStr = new Date(log.timestamp).toLocaleString('en-US', { hour12: true });
  doc.text(dateStr, 20, 74);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(log.tx_id, 75, 74);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (log.status === 'SUCCESS') {
    doc.setTextColor(5, 150, 105); // Emerald-600
    doc.text('SUCCESSFUL', 155, 74);
  } else if (log.status === 'ROLLBACKED') {
    doc.setTextColor(217, 119, 6); // Amber-600
    doc.text('ROLLBACKED', 155, 74);
  } else {
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text('FAILED', 155, 74);
  }

  // 3. Transaction Details List
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('FINANCIAL LEDGER ENTRY DETAILS', 15, 98);

  // Separator Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.35);
  doc.line(15, 101, 195, 101);

  // Print detail rows helper
  let currentY = 110;
  const renderDetailRow = (fieldLabel: string, fieldValue: string, useCourier = false) => {
    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(fieldLabel, 20, currentY);

    // Value
    if (useCourier) {
      doc.setFont('courier', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(fieldValue, 70, currentY);

    // Row divider line
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + 4, 195, currentY + 4);
    currentY += 12;
  };

  renderDetailRow('Sender Name', transliterateToAscii(log.senderName));
  renderDetailRow('Sender Username', log.senderUsername || 'N/A', true);
  renderDetailRow('Receiver Name', transliterateToAscii(log.receiverName));
  renderDetailRow('Receiver Username', log.receiverUsername || 'N/A', true);
  renderDetailRow('Transfer Type / Note', transliterateToAscii(log.note));

  // 4. Amount Block Banner
  currentY += 2;
  doc.setFillColor(241, 245, 249); // light grey
  doc.rect(15, currentY, 180, 20, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(15, currentY, 180, 20, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL TRANSFERRED FUNDS', 25, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(13, 148, 136); // Teal #0D9488
  doc.text(`${log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT`, 185, currentY + 12, { align: 'right' });

  // 5. System Protection Banner
  currentY += 34;
  doc.setFillColor(254, 252, 232); // Light yellow
  doc.rect(15, currentY, 180, 18, 'F');
  doc.setDrawColor(254, 240, 138); // Yellow border
  doc.rect(15, currentY, 180, 18, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 63, 18); // Amber deep text
  doc.text('CONCURRENCY LOCK & ATOMIC ROLLBACK SECURED', 20, currentY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(133, 77, 14);
  doc.text('This record is registered with a database concurrency lock. Rollbacks will auto-correct accounts balance symmetrically.', 20, currentY + 12);

  // 6. Signature / Verification Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Generated automatically by Sheikh Code Exchange System.', 105, 275, { align: 'center' });
  doc.text('Secured digitally via Google Drive Cloud Service. No manual signature required.', 105, 280, { align: 'center' });

  return doc.output('blob');
};
