import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import TransactionRecord from '../../../models/TransactionRecord'; // Adjust the path as necessary

export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    await mongoose.connect(process.env.MONGODB_URI); // Ensure you connect to the database
    const count = await TransactionRecord.countDocuments(); // Count the documents
    console.log(`######### Transaction count: ${count}`);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching transaction record count:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch count' });
  } finally {
    await mongoose.disconnect(); // Disconnect after the operation
  }
}
