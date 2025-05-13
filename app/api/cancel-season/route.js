// app/api/cancel-season/route.js
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

// Direct MongoDB connection
const uri = process.env.MONGODB_URI;

export async function POST(request) {
  let client;
  
  try {
    const body = await request.json();
    console.log('Cancel season request:', body);
    
    const { recordId, walletAddress } = body;

    // Validate required fields
    if (!recordId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: recordId or walletAddress' },
        { status: 400 }
      );
    }

    try {
      if (!uri) {
        throw new Error('MongoDB URI not found in environment variables');
      }
      
      console.log('Connecting to MongoDB to cancel season...');
      
      client = new MongoClient(uri);
      await client.connect();
      
      const db = client.db();
      const collection = db.collection('season_records');

      // Find the record and verify it belongs to the requesting wallet address
      const record = await collection.findOne({ 
        _id: new ObjectId(recordId),
        walletAddress: walletAddress 
      });
      
      if (!record) {
        return NextResponse.json(
          { error: 'Record not found or not authorized to cancel' },
          { status: 404 }
        );
      }

      // Update the record to mark it as inactive
      const result = await collection.updateOne(
        { _id: new ObjectId(recordId) },
        { $set: { active: false, cancelledAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return NextResponse.json(
          { error: 'Failed to cancel season' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Season cancelled successfully'
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error: ' + dbError.message },
        { status: 500 }
      );
    } finally {
      if (client) {
        await client.close();
        console.log('MongoDB connection closed');
      }
    }
  } catch (error) {
    console.error('General error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request: ' + error.message },
      { status: 500 }
    );
  }
}
