// app/api/donation-progress/route.js
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
    
    console.log('Connecting to MongoDB to retrieve donation transactions...');
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db();
    
    // Query the transaction_records collection
    const collection = db.collection('transaction_records');

    console.log(`Looking for transactions with donation.from === '${walletAddress}'...`);
    
    // First, let's log all available records to see what we're dealing with
    const allTransactions = await collection.find({}).limit(10).toArray();
    console.log('Sample of available transactions:', allTransactions.map(tx => ({
      txHash: tx.txHash,
      from: tx.donation?.from || 'N/A',
      to: tx.donation?.to || 'N/A',
      usdcValue: tx.donation?.usdcValue || 'N/A'
    })));
    
    // Find all successful donation transactions where this wallet is the donor
    // Use case-insensitive comparison to handle potential casing differences
    const transactions = await collection
      .find({
        $or: [
          { 'donation.from': walletAddress },
          { 'donation.from': walletAddress.toLowerCase() },
          { 'donation.from': walletAddress.toUpperCase() }
        ],
        'status': 'success'
      })
      .toArray();
      
    console.log(`Found ${transactions.length} matching transactions for address '${walletAddress}'`);
    
    // Calculate total USDC value
    let totalDonated = 0;
    
    if (transactions.length > 0) {
      console.log('Matching transaction details:');
      
      totalDonated = transactions.reduce((sum, tx) => {
        // Parse the USDC value (which is in cents) to a number and add to total
        const donationAmount = tx.donation?.usdcValue ? Number(tx.donation.usdcValue) : 0;
        
        console.log(`Transaction ${tx.txHash}: ` + 
                   `from=${tx.donation?.from || 'unknown'}, ` +
                   `amount=${donationAmount} base units (${donationAmount/1000000} USDC dollars)`);  
                   
        return sum + donationAmount;
      }, 0);
      
      console.log(`Total donation amount: ${totalDonated} base units (${totalDonated/1000000} USDC dollars)`);
    } else {
      console.log('No matching transactions found.');
    }
    
    // Format response
    return NextResponse.json({
      success: true,
      totalDonated: totalDonated, // This is in USDC base units (e.g., 1000000 = $1.00)
      transactionCount: transactions.length,
      transactions: transactions.map(tx => ({
        txHash: tx.txHash,
        donationTxHash: tx.donation?.donationTxHash,
        amount: tx.donation?.usdcValue,
        timestamp: tx.donation?.blockTimestamp || tx.createdAt
      }))
    });
  } catch (error) {
    console.error('Error retrieving donation progress:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve donation progress: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}
