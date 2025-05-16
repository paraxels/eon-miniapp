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
    
    // First, get the user's current active season to determine the start date
    const seasonCollection = db.collection('season_records');
    
    // Find the user's active season
    const activeSeasons = await seasonCollection
      .find({
        walletAddress: walletAddress,
        active: true
      })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    
    const currentSeason = activeSeasons.length > 0 ? activeSeasons[0] : null;
    const seasonStartDate = currentSeason ? new Date(currentSeason.timestamp) : null;
    
    console.log(`Current active season:`, currentSeason ? {
      id: currentSeason._id,
      startDate: seasonStartDate,
      dollarAmount: currentSeason.dollarAmount
    } : 'None');
    
    // Query the transaction_records collection
    const collection = db.collection('transaction_records');

    console.log(`Looking for transactions with donation.from === '${walletAddress}'...`);
    
    // Log a couple of transactions to understand data structure
    const sampleTransactions = await collection.find({}).limit(3).toArray();
    console.log('Sample transaction data structures:', sampleTransactions.map(tx => ({
      txHash: tx.txHash,
      from: tx.donation?.from || 'N/A',
      to: tx.donation?.to || 'N/A',
      usdcValue: tx.donation?.usdcValue || 'N/A',
      createdAt: tx.createdAt || 'N/A',
      timestamp: tx.timestamp || 'N/A',
      // Log all potential date/timestamp fields to understand what we're working with
      dateFields: {
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        timestamp: tx.timestamp,
        blockTimestamp: tx.donation?.blockTimestamp,
        processedAt: tx.donation?.processedAt
      }
    })));
    
    // Let's get all transactions from this user that have been successful
    const allUserTransactions = await collection
      .find({
        $or: [
          { 'donation.from': walletAddress },
          { 'donation.from': walletAddress.toLowerCase() },
          { 'donation.from': walletAddress.toUpperCase() }
        ],
        'status': 'success'
      })
      .toArray();
    
    console.log(`Found ${allUserTransactions.length} total successful transactions for this wallet`);
    
    // If we have a current season, we'll filter the transactions in application code
    // This gives us more control over the filtering logic than relying on complex MongoDB queries
    let transactions = allUserTransactions;
    
    if (seasonStartDate) {
      console.log(`Filtering transactions after season start date: ${seasonStartDate.toISOString()}`);
      
      // Convert season start date to milliseconds for reliable comparison
      const seasonStartTime = seasonStartDate.getTime();
      const seasonStartUnixTimestamp = Math.floor(seasonStartTime / 1000);
      console.log(`Season start unix timestamp: ${seasonStartUnixTimestamp}`);
      
      // Filter transactions in application code rather than in MongoDB query
      // This gives us more flexibility with inconsistent data schemas
      transactions = allUserTransactions.filter(tx => {
        // Try all possible ways a transaction might have a timestamp
        // Case 1: Using createdAt ISO string field
        if (tx.createdAt) {
          const txTime = new Date(tx.createdAt).getTime();
          if (txTime >= seasonStartTime) {
            console.log(`Transaction ${tx.txHash} is in season (createdAt: ${tx.createdAt})`);
            return true;
          }
        }
        
        // Case 2: Using updatedAt ISO string field
        if (tx.updatedAt) {
          const txTime = new Date(tx.updatedAt).getTime();
          if (txTime >= seasonStartTime) {
            console.log(`Transaction ${tx.txHash} is in season (updatedAt: ${tx.updatedAt})`);
            return true;
          }
        }
        
        // Case 3: Using Unix timestamp in donation.blockTimestamp
        if (tx.donation && tx.donation.blockTimestamp) {
          const blockTimestamp = parseInt(tx.donation.blockTimestamp);
          if (!isNaN(blockTimestamp) && blockTimestamp >= seasonStartUnixTimestamp) {
            console.log(`Transaction ${tx.txHash} is in season (blockTimestamp: ${blockTimestamp})`);
            return true;
          }
        }
        
        // Case 4: Using Unix timestamp in donation.processedAt
        if (tx.donation && tx.donation.processedAt) {
          const processedAt = parseInt(tx.donation.processedAt);
          if (!isNaN(processedAt) && processedAt >= seasonStartUnixTimestamp) {
            console.log(`Transaction ${tx.txHash} is in season (processedAt: ${processedAt})`);
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`After filtering, found ${transactions.length} transactions that occurred during this season`);
    }
    
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
