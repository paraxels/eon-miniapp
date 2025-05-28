import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    // For security, we'll add a simple auth check in production
    // For now, we'll just implement the listing functionality
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const sort = searchParams.get('sort') || 'lastVisitAt'; // Default sort by lastVisitAt
    const order = searchParams.get('order') === 'asc' ? 1 : -1; // Default to descending
    
    const client = await clientPromise;
    const db = client.db();
    const userProfilesCollection = db.collection('user_profiles');
    
    // Count total number of profiles
    const totalCount = await userProfilesCollection.countDocuments();
    
    // Get profiles with pagination
    const profiles = await userProfilesCollection
      .find({})
      .sort({ [sort]: order })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Quick stats
    const stats = {
      totalProfiles: totalCount,
      activeInLast24h: await userProfilesCollection.countDocuments({
        lastVisitAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      withWallets: await userProfilesCollection.countDocuments({
        wallets: { $exists: true, $not: { $size: 0 } }
      })
    };
    
    return NextResponse.json({
      success: true,
      profiles,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + profiles.length < totalCount
      },
      stats
    });
  } catch (error) {
    console.error('Error listing user profiles:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
