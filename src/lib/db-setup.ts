import clientPromise from './mongodb';

export async function setupDatabase() {
  try {
    const client = await clientPromise;
    const db = client.db("societyFund");
    
    // Create indexes
    await db.collection("funds").createIndexes([
      { key: { block: 1, flatNo: 1 }, name: "block_flatNo" },
      { key: { status: 1 }, name: "status" }
    ]);

    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}
