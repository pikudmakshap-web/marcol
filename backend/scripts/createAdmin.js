import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export default async function createAdmin() {
    try {
        const passwordHash = await bcrypt.hash('admin123', 10);

        const admin = await prisma.user.create({
            data: {
                username: 'admin',
                passwordHash,
                fullName: 'מנהל מערכת',
                role: 'admin',
                personalNumber: '1000',
                barcode: 'ADMIN001',
                email: 'admin@system.local',
                isActive: true
            }
        });

        console.log('✅ Admin user created successfully!');
        console.log('Username:', admin.username);
        console.log('Password: admin123');
        console.log('Role:', admin.role);

    } catch (error) {
        if (error.code === 'P2002') {
            console.log('⚠️  Admin user already exists');
        } else {
            console.error('❌ Error creating admin:', error.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}


