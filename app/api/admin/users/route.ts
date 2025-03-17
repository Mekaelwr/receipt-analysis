import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAllUsers, updateUserById, deleteUserById } from '@/utils/admin-db';

// API route configuration
export const runtime = 'edge';

// Middleware to check admin authorization
async function checkAdminAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  // In production, you should implement proper admin authentication
  // This is just a basic example
  const adminKey = process.env.ADMIN_API_KEY;
  const token = authHeader.split(' ')[1];
  
  return token === adminKey;
}

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const isAuthorized = await checkAdminAuth(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check admin authorization
    const isAuthorized = await checkAdminAuth(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, updateData } = body;

    if (!userId || !updateData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserById(userId, updateData);
    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authorization
    const isAuthorized = await checkAdminAuth(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    await deleteUserById(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 