// API route to proxy search requests to endaoment API
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const searchTerm = searchParams.get('searchTerm');
  
  if (!searchTerm) {
    return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
  }
  
  try {
    const response = await fetch(
      `https://donate.endaoment.org/api/ndao/search?searchTerm=${encodeURIComponent(searchTerm)}`, 
      { cache: 'no-store' }
    );
    
    if (!response.ok) {
      throw new Error(`Endaoment API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying search request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search results' }, 
      { status: 500 }
    );
  }
}
