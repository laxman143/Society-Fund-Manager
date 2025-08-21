"use client";
import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface FundEntry {
  id: number;
  name: string;
  block: string;
  flatNo: string;
  amount: number;
  status: "Paid" | "Unpaid";
}

const BLOCKS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const initialForm: Partial<FundEntry> = { name: "", block: "", flatNo: "", amount: 0, status: "Paid" };

export default function FundManager() {
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [form, setForm] = useState<Partial<FundEntry>>(initialForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortBlock, setSortBlock] = useState<string>("all");
  
  const sortedEntries = useMemo(() => {
    return [...entries]
      .filter(e => sortBlock === "all" || e.block === sortBlock)
      .sort((a, b) => {
        if (a.block !== b.block) return a.block.localeCompare(b.block);
        return a.flatNo.localeCompare(b.flatNo);
      });
  }, [entries, sortBlock]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const res = await fetch("/api/fund");
    const data = await res.json();
    setEntries(data);
    setLoading(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "amount" ? Number(value) : value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name || !form.block || !form.amount) return;
    if (editId) {
      await fetch("/api/fund", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editId }),
      });
    } else {
      await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setForm(initialForm);
    setEditId(null);
    fetchData();
  }

  function handleEdit(entry: FundEntry) {
    setForm(entry);
    setEditId(entry.id);
  }

  async function handleDelete(id: number) {
    await fetch("/api/fund", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const blocks = sortBlock === "all" ? BLOCKS : [sortBlock];

    // Create summary sheet first
    if (sortBlock === "all") {
      const summaryWs = XLSX.utils.aoa_to_sheet([
        ["Ganpati Fund Collection - Summary"],
        [""],
        ["Block", "Total Flats", "Paid Count", "Unpaid Count", "Total Amount", "Collected Amount"]
      ]);

      blocks.forEach(block => {
        const blockEntries = entries.filter(e => e.block === block);
        if (blockEntries.length > 0) {
          const paidEntries = blockEntries.filter(e => e.status === "Paid");
          const totalAmount = blockEntries.reduce((sum, e) => sum + e.amount, 0);
          const collectedAmount = paidEntries.reduce((sum, e) => sum + e.amount, 0);
          
          XLSX.utils.sheet_add_aoa(
            summaryWs,
            [[
              block,
              blockEntries.length,
              paidEntries.length,
              blockEntries.length - paidEntries.length,
              totalAmount,
              collectedAmount
            ]],
            { origin: -1 }
          );
        }
      });

      // Add grand total
      const grandTotal = entries.reduce((sum, e) => sum + e.amount, 0);
      const collectedTotal = entries.filter(e => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0);
      XLSX.utils.sheet_add_aoa(summaryWs, [[""], ["Grand Total:", "", "", "", grandTotal, collectedTotal]], { origin: -1 });

      // Add summary sheet
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
    }

    // Create individual block sheets
    blocks.forEach(block => {
      const blockEntries = entries.filter(e => e.block === block);
      if (blockEntries.length > 0) {
        // Sort entries by flat number
        const sortedEntries = [...blockEntries].sort((a, b) => a.flatNo.localeCompare(b.flatNo));
        
        // Create worksheet with title
        const ws = XLSX.utils.aoa_to_sheet([
          [`Block ${block} - Fund Collection Details`],
          [""],
          ["Name", "Flat Number", "Amount", "Status", "Remarks"]
        ]);
        
        // Add entries
        sortedEntries.forEach(e => {
          XLSX.utils.sheet_add_aoa(ws, [[
            e.name,
            e.flatNo,
            e.amount,
            e.status === "Paid" ? "Paid ✅" : "Unpaid ❌",
            "" // Empty column for manual remarks
          ]], { origin: -1 });
        });
        
        // Add statistics
        const paidEntries = blockEntries.filter(e => e.status === "Paid");
        const totalAmount = blockEntries.reduce((sum, e) => sum + e.amount, 0);
        const collectedAmount = paidEntries.reduce((sum, e) => sum + e.amount, 0);
        
        XLSX.utils.sheet_add_aoa(ws, [
          [""],
          ["Statistics:"],
          ["Total Flats:", blockEntries.length],
          ["Paid Count:", paidEntries.length],
          ["Unpaid Count:", blockEntries.length - paidEntries.length],
          ["Total Amount:", totalAmount],
          ["Collected Amount:", collectedAmount],
          ["Pending Amount:", totalAmount - collectedAmount]
        ], { origin: -1 });
        
        XLSX.utils.book_append_sheet(wb, ws, `Block ${block}`);
      }
    });

    // Set column widths for better readability
    wb.Sheets["Summary"]["!cols"] = [
      { width: 10 }, // Block
      { width: 15 }, // Total Flats
      { width: 15 }, // Paid Count
      { width: 15 }, // Unpaid Count
      { width: 15 }, // Total Amount
      { width: 15 }, // Collected Amount
    ];

    XLSX.writeFile(wb, `Ganpati-fund${sortBlock === "all" ? "" : "-block-" + sortBlock}.xlsx`);
  }

  function exportPDF() {
    try {
      const doc = new jsPDF();
      let yOffset = 15;
      
      // Title
      doc.setFontSize(16);
      doc.text("Ganpati Fund Collection Details", 14, yOffset);
      yOffset += 10;

      // Get blocks to process
      const blocksToProcess = sortBlock === "all" ? 
        BLOCKS.filter(block => entries.some(e => e.block === block)) : 
        [sortBlock];
      
      blocksToProcess.forEach((block, blockIndex) => {
        const blockEntries = entries.filter(e => e.block === block);
        if (blockEntries.length === 0) return;

        // Add new page if needed
        if (blockIndex > 0) {
          doc.addPage();
          yOffset = 15;
        }

        // Block header
        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185);
        doc.text(`Block ${block}`, 14, yOffset);
        
        const blockTotal = blockEntries
          .filter((e) => e.status === "Paid")
          .reduce((sum, e) => sum + e.amount, 0);

        // Block table
        // @ts-expect-error jsPDF types are incomplete
        doc.autoTable({
          startY: yOffset + 5,
          head: [["Name", "Flat No", "Amount", "Status"]],
          body: blockEntries
            .sort((a, b) => a.flatNo.localeCompare(b.flatNo))
            .map((e) => [
              e.name,
              e.flatNo,
              {
                content: e.amount.toString(),
                styles: { halign: 'right' }
              },
              {
                content: e.status === "Paid" ? "Yes" : "No",
                styles: {
                  textColor: e.status === "Paid" ? [0, 128, 0] : [255, 0, 0],
                  fontStyle: 'bold',
                  fontSize: 11,
                  halign: 'center'
                }
              }
            ]),
          foot: [[
            "", 
            "Block Total:", 
            {
              content: blockTotal.toString(),
              styles: { halign: 'right' }
            },
            ""
          ]],
          theme: "striped",
          styles: { 
            fontSize: 10, 
            cellPadding: 3
          },
          headStyles: { 
            fillColor: [41, 128, 185], 
            textColor: 255,
            fontSize: 11,
            fontStyle: 'bold'
          },
          footStyles: { 
            fillColor: [169, 169, 169], 
            textColor: 0, 
            fontStyle: "bold"
          }
        });

        yOffset = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      });

      // Add grand total if showing all blocks
      if (sortBlock === "all" && entries.length > 0) {
        const grandTotal = entries
          .filter((e) => e.status === "Paid")
          .reduce((sum, e) => sum + e.amount, 0);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(
          `Grand Total: ${grandTotal}`, 
          doc.internal.pageSize.width - 20, 
          doc.internal.pageSize.height - 20, 
          { align: 'right' }
        );
      }
      
      doc.save(`Ganpati-fund${sortBlock === "all" ? "" : "-block-" + sortBlock}.pdf`);
      
      doc.save(`Ganpati-fund${sortBlock === "all" ? "" : "-" + sortBlock}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Error exporting PDF. Please try again.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Society Ganapati fund</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 mb-6 flex flex-col gap-4">
        <div className="flex gap-4">
          <input name="name" value={form.name} onChange={handleChange} placeholder="Full Name" className="input" required />
          <select name="block" value={form.block} onChange={handleChange} className="input" required>
            <option value="">Select Block</option>
            {BLOCKS.map(block => (
              <option key={block} value={block}>Block {block}</option>
            ))}
          </select>
          <input name="flatNo" value={form.flatNo} onChange={handleChange} placeholder="Flat Number" className="input" required />
          <input name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="Amount" className="input" required min={1} />
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-1">
            <input type="radio" name="status" value="Paid" checked={form.status === "Paid"} onChange={handleChange} /> Paid
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="status" value="Unpaid" checked={form.status === "Unpaid"} onChange={handleChange} /> Unpaid
          </label>
          <button type="submit" className="btn-primary ml-auto">{editId ? "Update" : "Add"}</button>
          {editId && <button type="button" className="btn" onClick={() => { setForm(initialForm); setEditId(null); }}>Cancel</button>}
        </div>
      </form>
      <div className="flex gap-4 mb-4 items-center justify-between">
        <div className="flex gap-2">
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn" onClick={exportPDF}>Export PDF</button>
        </div>
        <div className="flex items-center gap-2">
          <label>Sort by:</label>
          <select 
            value={sortBlock} 
            onChange={(e) => setSortBlock(e.target.value)}
            className="input min-w-[120px]"
          >
            <option value="all">All</option>
            {BLOCKS.map(block => (
              <option key={block} value={block}>{block}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Flat No</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2">{e.name}</td>
                <td className="px-4 py-2">{e.block}-{e.flatNo}</td>
                <td className="px-4 py-2">₹{e.amount}</td>
                <td className="px-4 py-2 text-center">{e.status === "Paid" ? "✅" : "❌"}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button className="btn" onClick={() => handleEdit(e)}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDelete(e.id)}>Delete</button>
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td colSpan={2} className="px-4 py-2 text-right">Total Paid</td>
              <td className="px-4 py-2">
                {sortedEntries.filter((e) => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
      {loading && <div className="mt-4 text-center">Loading...</div>}
    </div>
  );
}
