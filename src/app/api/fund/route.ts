import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

interface FundEntry {
  id: number;
  name: string;
  block: string;
  flatNo: string;
  amount: number;
  status: "Paid" | "Unpaid";
}

const DATA_FILE = path.join(process.cwd(), 'data.json');

async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeData(data: FundEntry[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  const data = await readData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = await readData();
  const nextId = data.length > 0 ? Math.max(...data.map((e: FundEntry) => e.id)) + 1 : 1;
  const entry = { id: nextId, ...body };
  data.push(entry);
  await writeData(data);
  return NextResponse.json(entry);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const data = await readData();
  const idx = data.findIndex((e: FundEntry) => e.id === body.id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  data[idx] = body;
  await writeData(data);
  return NextResponse.json(body);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  let data = await readData();
  data = data.filter((e: FundEntry) => e.id !== id);
  await writeData(data);
  return NextResponse.json({ success: true });
}
