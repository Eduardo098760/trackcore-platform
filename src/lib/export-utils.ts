import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportToExcel(data: any[], filename = "export.xlsx") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([wbout], { type: "application/octet-stream" }), filename);
}

export function exportToPDF(
  data: any[],
  columns: { header: string; key: string }[],
  filename = "export.pdf"
) {
  const doc = new jsPDF();
  const head = [columns.map((c) => c.header)];
  const body = data.map((row) => columns.map((c) => (row[c.key] ?? "").toString()));
  // @ts-ignore - jspdf-autotable types may not be present
  ;(doc as any).autoTable({ head, body });
  doc.save(filename);
}
