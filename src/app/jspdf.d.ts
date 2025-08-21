interface Window {
  jspdf: typeof import('jspdf');
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: {
      startY?: number;
      head?: Array<string[]>;
      body?: Array<Array<string | { content: string; styles?: Record<string, unknown> }>>;
      foot?: Array<Array<string | { content: string; styles?: Record<string, unknown> }>>;
      theme?: string;
      styles?: Record<string, unknown>;
      headStyles?: Record<string, unknown>;
      bodyStyles?: Record<string, unknown>;
      footStyles?: Record<string, unknown>;
      columnStyles?: Record<string, Record<string, unknown>>;
    }) => void;
  }
}
