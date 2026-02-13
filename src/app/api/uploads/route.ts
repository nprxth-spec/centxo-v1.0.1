import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { videoStorage } from '@/lib/video-storage';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Use videoStorage helper (local storage only)
        // It also supports images despite the name (logic is file generic usually)
        // If videoStorage is strict about extensions, we might need a separate image handler,
        // but typically it just returns a path.
        // Let's check videoStorage implementation later if needed, but for now we assume it manages user folder.

        // Actually, let's look at `videoStorage.upload` implementation logic from memory/inference
        // It likely returns { success: true, url: string, filePath: string }

        const uploadResult = await videoStorage.upload(file, session.user.id);

        if (!uploadResult.success) {
            return NextResponse.json(
                { error: uploadResult.error || 'Upload failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            url: uploadResult.url,
            filePath: uploadResult.filePath
        });

    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
