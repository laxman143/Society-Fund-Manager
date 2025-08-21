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
    if (!client) {
      throw new Error('Failed to connect to MongoDB.');
    }

    const db = client.db("societyFund");
    const collection = db.collection("funds");

    // Test the connection with a simple operation
    await collection.countDocuments();

    const data = await collection
      .find({})
      .sort({ block: 1, flatNo: 1 })
      .toArray();
    
    // Transform ObjectId to string for client-side use
    const transformedData = data.map(item => ({
      ...item,
      _id: item._id.toString()
    }));
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Database Error:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.NODE_ENV,
      hasUri: !!process.env.MONGODB_URI
    });
    
    return NextResponse.json({ 
      error: 'Database Connection Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("societyFund");
    
    // Validate required fields
    if (!body.name || !body.block || !body.flatNo || body.amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newEntry = {
      ...body,
      amount: Number(body.amount),
      status: body.status || "Unpaid"
    };
    
    const result = await db.collection("funds").insertOne(newEntry);
    return NextResponse.json({
      ...newEntry,
      _id: result.insertedId.toString()
    });
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
