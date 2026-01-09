import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/version
 * Returns the current software version
 */
export async function GET() {
  try {
    const packagePath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
    
    return NextResponse.json({
      version: packageJson.version,
      name: packageJson.name,
    })
  } catch (error) {
    console.error('Error reading package.json:', error)
    return NextResponse.json(
      { error: 'Failed to read version information' },
      { status: 500 }
    )
  }
}

