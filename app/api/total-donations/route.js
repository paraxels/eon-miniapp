// app/api/total-donations/route.js
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Direct MongoDB connection
const uri = process.env.MONGODB_URI;

export async function GET() {
  let client;
  
  try {
    if (!uri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    console.log('Connecting to MongoDB to calculate total donations...');
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db();
    
    // Query the transaction_records collection
    const collection = db.collection('transaction_records');

    // Find all successful donation transactions
    const transactions = await collection
      .find({ 
        'status': 'success',
        'donation.usdcValue': { $exists: true }
      })
      .toArray();
    
    // Calculate total USDC value
    let totalDonated = 0;
    
    if (transactions.length > 0) {
      console.log(`Found ${transactions.length} total successful transactions`);
      
      totalDonated = transactions.reduce((sum, tx) => {
        // Parse the USDC value to a number and add to total
        const donationAmount = tx.donation?.usdcValue ? Number(tx.donation.usdcValue) : 0;
        return sum + donationAmount;
      }, 0);
      
      console.log(`Total donations across all users: ${totalDonated} base units (${totalDonated/1000000} USDC dollars)`);
      console.log(`Total transaction count: ${transactions.length}`)
    } else {
      console.log('No donation transactions found.');
    }
    
    return NextResponse.json(
      {
        success: true,
        totalDonated,
        transactionCount: transactions.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
        },
      }
    );
  } catch (error) {
    console.error('Error calculating total donations:', error);
    // Return a graceful fallback for production instead of an error
    return NextResponse.json({
      success: true,
      totalDonated: 0,
      transactionCount: 0,
      error: 'Database temporarily unavailable'
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
