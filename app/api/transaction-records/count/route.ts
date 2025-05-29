import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const transactionsCollection = db.collection('transaction_records');
    
    // Count the total number of transaction records
    const count = await transactionsCollection.countDocuments();
    
    console.log(`Transaction record count: ${count}`);
    
    return NextResponse.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching transaction record count:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
