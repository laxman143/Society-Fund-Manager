import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface FundEntry {
  _id?: ObjectId;
  name: string;
  block: string;
  flatNo: string;
  amount: number;
  status: "Paid" | "Unpaid";
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("societyFund");
    const data = await db.collection("funds")
      .find({})
      .sort({ block: 1, flatNo: 1 })
      .toArray();
    
    return NextResponse.json(data);
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
    
    const result = await db.collection("funds").insertOne(body);
    return NextResponse.json({ ...body, _id: result.insertedId });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { _id, ...updateData } = body;
    
    const client = await clientPromise;
    const db = client.db("societyFund");
    
    const result = await db.collection("funds").findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result);
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
    
    const result = await db.collection("funds").deleteOne({
      _id: new ObjectId(_id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
