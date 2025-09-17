"use client";
import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface FundEntry {
  _id?: string;
  name: string;
  block: string;
  flatNo: string;
  amount: number;
  status: "Paid" | "Unpaid";
  comment?: string;
}

const BLOCKS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "Shop", "Other"];
const initialForm: Partial<FundEntry> = { name: "", block: "", flatNo: "", amount: 0, status: "Paid", comment: "" };

export default function FundManager() {
  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [form, setForm] = useState<Partial<FundEntry>>(initialForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/fund");
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch data');
      }
      
      if (!Array.isArray(data)) {
        console.error('Unexpected data format:', data);
        throw new Error('Received invalid data format from server');
      }

      setEntries(data);
    } catch (err) {
      console.error('Fetch Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "amount" ? Number(value) : value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name || !form.block || !form.amount) return;
    // Make flatNo optional when block is "Other"
    if (form.block !== "Other" && !form.flatNo) return;
    
    if (editId) {
      await fetch("/api/fund", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _id: editId }),
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
    setEditId(entry._id || null);
  }

  async function handleDelete(_id: string) {
    await fetch("/api/fund", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _id }),
    });
    fetchData();
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const blocks = sortBlock === "all" ? BLOCKS : [sortBlock];

      // Create summary sheet first
      if (sortBlock === "all") {
        const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
        const totalPaid = entries.filter(e => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0);
        const totalPending = entries.filter(e => e.status === "Unpaid").reduce((sum, e) => sum + e.amount, 0);
        
        const summaryWs = XLSX.utils.aoa_to_sheet([
          ["Saransh Arth Navratri Mahostav - Fund Collection Summary"],
          [""],
          ["Overall Summary:"],
          ["Total Amount", totalAmount],
          ["Total Paid", totalPaid],
          ["Total Pending", totalPending],
          [""],
          ["Block-wise Summary:"],
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
        const blockTotalAmount = blockEntries.reduce((sum, e) => sum + e.amount, 0);
        const blockPaidAmount = blockEntries.filter(e => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0);
        const blockPendingAmount = blockEntries.filter(e => e.status === "Unpaid").reduce((sum, e) => sum + e.amount, 0);
        
        const ws = XLSX.utils.aoa_to_sheet([
          [`Block ${block} - Fund Collection Details`],
          [""],
          ["Block Summary:"],
          ["Total Amount", blockTotalAmount],
          ["Total Paid", blockPaidAmount],
          ["Total Pending", blockPendingAmount],
          [""],
          ["Details:"],
          ["Name", "Flat Number", "Amount", "Status", "Comments"]
        ]);
        
        // Add entries
        sortedEntries.forEach(e => {
          XLSX.utils.sheet_add_aoa(ws, [[
            e.name,
            e.block === "Shop" ? `Shop-${e.flatNo}` : e.block === "Other" ? `Other-${e.flatNo}` : e.flatNo,
            e.amount,
            e.status === "Paid" ? "Paid ✅" : "Unpaid ❌",
            e.comment || "" // Comments column
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

    XLSX.writeFile(wb, `Navratri-fund${sortBlock === "all" ? "" : "-block-" + sortBlock}.xlsx`);
  }

  function exportPDF() {
    try {
      const doc = new jsPDF();
      let yOffset = 15;
      
      // Title
      doc.setFontSize(16);
      doc.text("Saransh Arth Navratri Mahostav - Fund Collection Details", 14, yOffset);
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
        const grandTotal = entries.reduce((sum, e) => sum + e.amount, 0);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(
          `Grand Total: ${grandTotal}`, 
          doc.internal.pageSize.width - 20, 
          doc.internal.pageSize.height - 20, 
          { align: 'right' }
        );
      }
      
      doc.save(`Navratri-fund${sortBlock === "all" ? "" : "-block-" + sortBlock}.pdf`);
      
      doc.save(`Navratri-fund${sortBlock === "all" ? "" : "-" + sortBlock}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Error exporting PDF. Please try again.");
    }
  }

  function exportSummaryPDF() {
    try {
      const doc = new jsPDF();
      let y = 15;
      
      // Title
      doc.setFontSize(16);
      doc.text("Saransh Arth Navratri Mahostav - Summary", 14, y);
      y += 10;

      // Overall Summary
      const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
      const totalPaid = entries.filter(e => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0);
      const totalPending = entries.filter(e => e.status === "Unpaid").reduce((sum, e) => sum + e.amount, 0);

      doc.setFontSize(12);
      doc.text("Overall Summary:", 14, y);
      y += 5;

      doc.autoTable({
        startY: y,
        head: [["Metric", "Amount"]],
        body: [
          ["Total Amount", `${totalAmount}`],
          ["Total Collected (Paid)", `${totalPaid}`],
          ["Total Pending", `${totalPending}`],
        ],
        theme: 'striped',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Optional: Block-wise Summary
      const blocksToSummarize = BLOCKS.filter(b => entries.some(e => e.block === b));
      if (blocksToSummarize.length > 0) {
        doc.text("Block-wise Summary:", 14, y);
        y += 5;
        const blockRows = blocksToSummarize.map(block => {
          const be = entries.filter(e => e.block === block);
          const t = be.reduce((s, e) => s + e.amount, 0);
          const p = be.filter(e => e.status === 'Paid').reduce((s, e) => s + e.amount, 0);
          const pend = t - p;
          return [block, `${t}`, `${p}`, `${pend}`];
        });
        doc.autoTable({
          startY: y,
          head: [["Block", "Total", "Collected", "Pending"]],
          body: blockRows,
          theme: 'striped',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        });
      }

      doc.save('Navratri-fund-summary.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error exporting Summary PDF. Please try again.');
    }
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = entries.filter(e => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0);
  const totalPending = entries.filter(e => e.status === "Unpaid").reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Saransh Arth Navratri Mahostav</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Total Amount</h3>
          <p className="text-2xl">{totalAmount}</p>
        </div>
        <div className="bg-green-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Total Paid</h3>
          <p className="text-2xl">{totalPaid}</p>
        </div>
        <div className="bg-red-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Total Pending</h3>
          <p className="text-2xl">{totalPending}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 mb-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="name" value={form.name} onChange={handleChange} placeholder="Full Name" className="input" required />
          <select name="block" value={form.block} onChange={handleChange} className="input" required>
            <option value="">Select Block</option>
            {BLOCKS.map(block => (
              <option key={block} value={block}>
                {block === "Shop" ? "Shop" : block === "Other" ? "Other" : `Block ${block}`}
              </option>
            ))}
          </select>
          <input 
            name="flatNo" 
            value={form.flatNo} 
            onChange={handleChange} 
            placeholder={form.block === "Other" ? "Flat Number (Optional)" : "Flat Number"} 
            className="input" 
            required={form.block !== "Other"} 
          />
          <input name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="Amount" className="input" required min={1} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-1">
              <input type="radio" name="status" value="Paid" checked={form.status === "Paid"} onChange={handleChange} /> Paid
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="status" value="Unpaid" checked={form.status === "Unpaid"} onChange={handleChange} /> Unpaid
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editId ? "Update" : "Add"}</button>
            {editId && <button type="button" className="btn" onClick={() => { setForm(initialForm); setEditId(null); }}>Cancel</button>}
          </div>
        </div>
        <div>
          <textarea 
            name="comment" 
            value={form.comment || ""} 
            onChange={handleChange} 
            placeholder="Comments (Optional)" 
            className="input w-full h-20 resize-none" 
          />
        </div>
      </form>
      <div className="flex gap-4 mb-4 items-center justify-between">
        <div className="flex gap-2">
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn" onClick={exportPDF}>Export PDF</button>
          <button className="btn" onClick={exportSummaryPDF}>Export Summary PDF</button>
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
              <th className="px-4 py-2">Block/Flat</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Comments</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((e) => (
              <tr key={e._id} className="border-t">
                <td className="px-4 py-2">{e.name}</td>
                <td className="px-4 py-2">
                  {e.block === "Shop" ?  `Shop-${e.flatNo}` : e.block === "Other" ? `Other-${e.flatNo}` : `${e.block}-${e.flatNo}`}
                </td>
                <td className="px-4 py-2">{e.amount}</td>
                <td className="px-4 py-2 text-center">{e.status === "Paid" ? "✅" : "❌"}</td>
                <td className="px-4 py-2 max-w-xs truncate">{e.comment || "-"}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button className="btn" onClick={() => handleEdit(e)}>Edit</button>
                  <button className="btn-danger" onClick={() => e._id && handleDelete(e._id)}>Delete</button>
                </td>
              </tr>
            ))}
          <tr className="font-bold bg-gray-50">
            <td colSpan={2} className="px-4 py-2 text-right">Total Amount</td>
            <td className="px-4 py-2">{sortedEntries.reduce((sum, e) => sum + e.amount, 0)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr className="font-bold bg-green-50">
            <td colSpan={2} className="px-4 py-2 text-right">Total Collected (Paid)</td>
            <td className="px-4 py-2">{sortedEntries.filter((e) => e.status === "Paid").reduce((sum, e) => sum + e.amount, 0)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr className="font-bold bg-red-50">
            <td colSpan={2} className="px-4 py-2 text-right">Total Pending</td>
            <td className="px-4 py-2">{sortedEntries.filter((e) => e.status === "Unpaid").reduce((sum, e) => sum + e.amount, 0)}</td>
            <td colSpan={3}></td>
          </tr>
          </tbody>
        </table>
      </div>
      {loading && <div className="mt-4 text-center">Loading...</div>}
    </div>
  );
}
