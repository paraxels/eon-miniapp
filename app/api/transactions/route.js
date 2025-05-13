// app/api/transactions/route.js
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Direct MongoDB connection
const uri = process.env.MONGODB_URI;

// Default spender address if not provided
const DEFAULT_SPENDER = "0x66B5700036D7E397F721192fA06E17f9c0515F7f";

// Test environment target address
const TEST_TARGET_ADDRESS = "0xa65d8A8Cf67795B375FAFb97C3627d59A4d73efB";

// Production environment target address
const PROD_TARGET_ADDRESS = "0x8d2a84300d6ce230ed3fffc23dbcdf1e6c781ff0";

export async function POST(request) {
  let client;
  
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    let { fid, walletAddress, transactionHash, dollarAmount, percentAmount, authorized } = body;

    // Set default values for missing fields
    fid = fid || 'unknown';
    authorized = authorized || DEFAULT_SPENDER;
    
    // Validate required fields
    if (!walletAddress || !transactionHash || dollarAmount == null || percentAmount == null) {
      console.error('Missing required fields:', { fid, walletAddress, transactionHash, dollarAmount, percentAmount, authorized });
      return NextResponse.json(
        { error: 'Missing required fields: wallet address, transaction hash, dollar amount or percent amount' },
        { status: 400 }
      );
    }

    try {
      // Log the MongoDB URI (redacted for security)
      if (!uri) {
        throw new Error('MongoDB URI not found in environment variables');
      }
      
      console.log('Connecting to MongoDB...');
      
      // Create a new client and connect
      client = new MongoClient(uri);
      await client.connect();
      console.log('Connected to MongoDB');
      
      const db = client.db();
      const collection = db.collection('season_records');

      // Check if this transaction hash already exists
      const existingRecord = await collection.findOne({ transactionHash });
      if (existingRecord) {
        return NextResponse.json(
          { error: 'Transaction already recorded' },
          { status: 409 }
        );
      }

      // Get network information based on environment
      const isTestnet = process.env.NEXT_PUBLIC_ENV_TEST === "true";
      const network = isTestnet ? "base-sepolia" : "base-mainnet";
      
      // Set the target address based on environment
      const targetAddress = isTestnet ? TEST_TARGET_ADDRESS : PROD_TARGET_ADDRESS;

      // Create record
      const record = {
        fid,
        walletAddress,
        transactionHash,
        dollarAmount: Number(dollarAmount),
        percentAmount: Number(percentAmount),
        authorized,
        active: true, // Default to active
        target: targetAddress,
        timestamp: new Date(),
        network
      };

      // Insert into MongoDB
      const result = await collection.insertOne(record);
      console.log('Record inserted successfully', result);

      return NextResponse.json({
        success: true,
        insertedId: result.insertedId,
        record // Include the full record in the response
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error: ' + dbError.message },
        { status: 500 }
      );
    } finally {
      // Close the client connection
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

export async function GET() {
  let client;
  
  try {
    // Log the MongoDB URI (redacted for security)
    if (!uri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    console.log('Connecting to MongoDB...');
    
    // Create a new client and connect
    client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('transaction_records');
    
    const records = await collection.find({}).sort({ timestamp: -1 }).limit(100).toArray();
    
    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error retrieving transaction records:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve transaction records' },
      { status: 500 }
    );
  } finally {
    // Close the client connection
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}
