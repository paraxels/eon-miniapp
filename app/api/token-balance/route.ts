import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// ERC20 ABI for balanceOf
const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)'
]);

// Check environment
const isTestnet = process.env.NEXT_PUBLIC_ENV_TEST === "true";

export async function GET(request: NextRequest) {
  try {
    // Get address and token from query parameters
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const tokenAddress = searchParams.get('token');
    
    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing address parameter' 
      }, { status: 400 });
    }
    
    if (!tokenAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing token parameter' 
      }, { status: 400 });
    }
    
    // Create a public client for Base or Base Sepolia
    const client = createPublicClient({
      chain: isTestnet ? baseSepolia : base,
      transport: http()
    });
    
    // Call the balanceOf function on the token contract
    const balance = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    });
    
    return NextResponse.json({
      success: true,
      balance: balance.toString()
    });
    
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch token balance' 
    }, { status: 500 });
  }
}
