"use client";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface Expense {
  _id?: string;
  details: string;
  amount: number;
  date: string;
}

export default function ExpenseManager() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ details: "", amount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    fetchData();
    fetchTotalIncome();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/expense");
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTotalIncome() {
    try {
      const res = await fetch("/api/fund");
      if (!res.ok) throw new Error("Failed to fetch income");
      const data = await res.json();
      const total = data.reduce((sum: number, item: { status: string; amount: number }) => 
        item.status === "Paid" ? sum + item.amount : sum, 0
      );
      setTotalIncome(total);
    } catch (err) {
      console.error("Error fetching income:", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.details || !form.amount) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to add expense");
      setForm({ details: "", amount: 0 });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      setLoading(true);
      const res = await fetch("/api/expense", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id }),
      });
      if (!res.ok) throw new Error("Failed to delete expense");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  function exportPDF() {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Title
    doc.setFontSize(16);
    doc.text("Society Fund Balance Report", 14, 15);
    
    // Summary Section
    doc.setFontSize(12);
    doc.text("Balance Summary", 14, 30);
    
    const summaryData = [
      ["Total Collection", `${totalIncome} Rs`],
    ];
    
    doc.autoTable({
      startY: 35,
      head: [],
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 10 },
    });
    
    // Expenses Section
    doc.text("Expense Details:", 14, doc.autoTable.previous.finalY + 10);
    
 
    doc.autoTable({
      startY: doc.autoTable.previous.finalY + 15,
      head: [["Details", "Amount"]],
      body: expenses.map(e => [e.details, `₹${e.amount}`]),
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      footStyles: { fillColor: [169, 169, 169] },
      foot: [
        ["Total Expenses", `${totalExpenses} Rs`],
        ["Balance Amount", `${balance} Rs`]
      ],
    });

    doc.save("society-fund-report.pdf");
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    
    // Summary Sheet
    const summaryData = [
      ["Society Fund Balance Report"],
      [],
      ["Total Collection", totalIncome],
      [],
      ["Expense Details:"],
      ["Details", "Amount", "Date"],
      ...expenses.map(e => [
        e.details,
        e.amount,
        new Date(e.date).toLocaleDateString()
      ]),
      [],
      ["Total Expenses", totalExpenses],
      ["Balance Amount", balance]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths
    ws["!cols"] = [
      { width: 30 }, // Details
      { width: 15 }, // Amount
      { width: 15 }  // Date
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Balance Report");
    XLSX.writeFile(wb, "society-fund-report.xlsx");
  }

  return (
      <div className="w-full max-w-3xl mx-auto p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Expense Manager</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn">
            Export Excel
          </button>
          <button onClick={exportPDF} className="btn">
            Export PDF
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Total Income</h3>
          <p className="text-2xl">₹{totalIncome}</p>
        </div>
        <div className="bg-red-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Total Expenses</h3>
          <p className="text-2xl">₹{totalExpenses}</p>
        </div>
        <div className={`p-4 rounded shadow ${balance >= 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <h3 className="text-lg font-semibold">Balance</h3>
          <p className="text-2xl">₹{balance}</p>
        </div>
      </div>      {/* Expense Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            value={form.details}
            onChange={(e) => setForm(f => ({ ...f, details: e.target.value }))}
            placeholder="Expense Details"
            className="input flex-grow"
            required
          />
          <div className="flex gap-4">
            <input
              type="number"
              value={form.amount || ""}
              onChange={(e) => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
              placeholder="Amount"
              className="input w-32"
              required
              min={1}
            />
            <button type="submit" className="btn-primary whitespace-nowrap">Add Expense</button>
          </div>
        </div>
        {error && <p className="text-red-500">{error}</p>}
      </form>

      {/* Expenses List */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left whitespace-nowrap">Date</th>
              <th className="px-4 py-2 text-left">Details</th>
              <th className="px-4 py-2 text-right whitespace-nowrap">Amount</th>
              <th className="px-4 py-2 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e._id} className="border-t">
                <td className="px-4 py-2">
                  {new Date(e.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{e.details}</td>
                <td className="px-4 py-2 text-right">₹{e.amount}</td>
                <td className="px-4 py-2">
                  <button 
                    onClick={() => e._id && handleDelete(e._id)}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <div className="mt-4 text-center">Loading...</div>}
    </div>
  );
}
