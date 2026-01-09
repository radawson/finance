import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { Role } from '@/generated/prisma/client'

/**
 * Seeds a default admin user if no admin exists in the database
 * Call this on application startup
 */
export async function seedDefaultAdmin() {
  try {
    // Check if any admin exists
    const adminExists = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
    })

    if (adminExists) {
      console.log('✅ Admin user already exists')
      return
    }

    // Create default admin
    const defaultAdmin = {
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@kontado.local',
      password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
      name: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
    }

    const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10)

    await prisma.user.create({
      data: {
        email: defaultAdmin.email,
        name: defaultAdmin.name,
        password: hashedPassword,
        role: Role.ADMIN,
        isKeycloakUser: false,
        isActive: true,
      },
    })

    console.log('✅ Default admin created successfully')
    console.log(`📧 Email: ${defaultAdmin.email}`)
    console.log(`🔑 Password: ${defaultAdmin.password}`)
    console.log('⚠️  Please change the password after first login!')
  } catch (error) {
    console.error('❌ Error seeding default admin:', error)
  }
}

