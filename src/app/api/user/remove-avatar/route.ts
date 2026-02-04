import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get current user to find their image
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { image: true },
        });

        // Delete the physical file if it exists and is a local file
        if (user?.image && user.image.startsWith('/uploads/')) {
            const filepath = join(process.cwd(), 'public', user.image);
            if (existsSync(filepath)) {
                try {
                    await unlink(filepath);
                } catch (error) {
                    console.error('Error deleting file:', error);
                    // Continue even if file deletion fails
                }
            }
        }

        // Update user in database to remove image
        await prisma.user.update({
            where: { email: session.user.email },
            data: { image: null },
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error('Error removing avatar:', error);
        return NextResponse.json(
            { error: 'Failed to remove avatar' },
            { status: 500 }
        );
    }
}
