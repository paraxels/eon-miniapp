import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
// import { MongoClient } from 'mongodb';

// Define interface for user profile
// interface UserProfile {
//   fid: string;
//   username: string | null;
//   wallets: string[];
//   firstVisitAt: Date;
//   lastVisitAt: Date;
//   shownAddMiniappPrompt: boolean;
// }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, username, wallet } = body;

    // Validate required fields
    if (!fid) {
      return NextResponse.json({ success: false, error: 'FID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userProfilesCollection = db.collection('user_profiles');
    
    // Use updateOne with upsert to create or update the document atomically
    // This prevents race conditions that create duplicate profiles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      // Fields to update on existing profile
      $set: {
        lastVisitAt: new Date(),
      },
      // Fields to set only if creating a new document
      $setOnInsert: {
        firstVisitAt: new Date(),
        shownAddMiniappPrompt: false
      }
    };
    
    // Only set username if provided, otherwise keep existing value
    if (username !== undefined) {
      updateData.$set.username = username;
    }
    
    // Add wallet to array if provided
    if (wallet) {
      updateData.$addToSet = { wallets: wallet };
    }
    
    const result = await userProfilesCollection.updateOne(
      { fid: String(fid) },
      updateData,
      { upsert: true }
    );
    
    // Fetch the updated/created profile to return in the response
    const profile = await userProfilesCollection.findOne({ fid: String(fid) });
    
    return NextResponse.json({
      success: true,
      profile,
      isNewProfile: result.upsertedCount > 0
    });
  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ success: false, error: 'FID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userProfilesCollection = db.collection('user_profiles');

    // Find user profile by FID
    const profile = await userProfilesCollection.findOne({ fid: String(fid) });

    if (!profile) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, shownAddMiniappPrompt } = body;

    if (!fid) {
      return NextResponse.json({ success: false, error: 'FID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userProfilesCollection = db.collection('user_profiles');

    // Update specific fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { lastVisitAt: new Date() };
    
    if (shownAddMiniappPrompt !== undefined) {
      updateData.shownAddMiniappPrompt = shownAddMiniappPrompt;
    }

    const updateResult = await userProfilesCollection.updateOne(
      { fid: String(fid) },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      updated: updateResult.modifiedCount > 0
    });
  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
