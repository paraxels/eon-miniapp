// models/TransactionRecord.js
import mongoose from 'mongoose';

// Define a schema for transaction records
const TransactionRecordSchema = new mongoose.Schema({
  fid: {
    type: String,
    required: true,
    index: true
  },
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  dollarAmount: {
    type: Number,
    required: true
  },
  percentAmount: {
    type: Number,
    required: true
  },
  authorized: {
    type: String,
    required: true,
    description: "The spender address that was authorized"
  },
  active: {
    type: Boolean,
    default: true,
    description: "Whether this donation commitment is currently active"
  },
  target: {
    type: String,
    required: true,
    description: "The target address that will receive the donation"
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  network: {
    type: String,
    required: true
  }
});

// Check if the model already exists before defining it
// This prevents the "Cannot overwrite model once compiled" error in Next.js development
export default mongoose.models.TransactionRecord || mongoose.model('TransactionRecord', TransactionRecordSchema);
