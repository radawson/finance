import { NextResponse } from 'next/server'
import { seedDefaultAdmin } from '@/lib/seed-admin'

/**
 * Initialization endpoint
 * Call once after deployment to seed default admin
 * Can be protected with an API key in production
 */
export async function POST() {
  try {
    await seedDefaultAdmin()
    
    return NextResponse.json({ 
      success: true,
      message: 'Initialization complete' 
    })
  } catch (error) {
    console.error('Init error:', error)
    return NextResponse.json(
      { error: 'Initialization failed' },
      { status: 500 }
    )
  }
}

