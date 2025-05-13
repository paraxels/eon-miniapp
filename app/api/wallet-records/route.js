// app/api/wallet-records/route.js
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Direct MongoDB connection
const uri = process.env.MONGODB_URI;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('address');
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }
  
  let client;
  
  try {
    if (!uri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    console.log('Connecting to MongoDB to retrieve wallet records...');
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db();
    const collection = db.collection('season_records');

    // Find active records for the given wallet address
    const activeRecords = await collection
      .find({ 
        walletAddress: walletAddress,
        active: true 
      })
      .sort({ timestamp: -1 }) // Get the most recent first
      .limit(1) // We just need the most recent active record
      .toArray();
    
    return NextResponse.json({
      success: true,
      hasActiveRecord: activeRecords.length > 0,
      record: activeRecords.length > 0 ? activeRecords[0] : null
    });
  } catch (error) {
    console.error('Error retrieving wallet records:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve wallet records: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}
