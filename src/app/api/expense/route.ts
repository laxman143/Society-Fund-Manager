import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface Expense {
  _id?: ObjectId;
  details: string;
  amount: number;
  date: string;
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("societyFund");
    const data = await db.collection("expenses")
      .find({})
      .sort({ date: -1 })
      .toArray();
    
    return NextResponse.json(data.map(item => ({
      ...item,
      _id: item._id.toString()
    })));
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("societyFund");
    
    const newExpense = {
      ...body,
      amount: Number(body.amount),
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString()
    };
    
    const result = await db.collection("expenses").insertOne(newExpense);
    return NextResponse.json({
      ...newExpense,
      _id: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { _id } = await req.json();
    const client = await clientPromise;
    const db = client.db("societyFund");
    
    await db.collection("expenses").deleteOne({
      _id: new ObjectId(_id)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { _id, details, amount, date } = body || {};
    if (!_id) {
      return NextResponse.json({ error: 'Missing _id' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("societyFund");

    const update: Partial<Expense> = {};
    if (typeof details === 'string') update.details = details;
    if (amount !== undefined) update.amount = Number(amount);
    if (date) update.date = new Date(date).toISOString();

    await db.collection("expenses").updateOne(
      { _id: new ObjectId(_id) },
      { $set: update }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
