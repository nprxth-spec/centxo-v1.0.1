import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { analyzeMediaForAd } from '@/ai/flows/analyze-media-for-ad';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';

export const dynamic = 'force-dynamic';

// Helper: Extract Multiple Video Frames for Better Analysis
async function extractVideoFrames(videoPath: string, count: number = 3): Promise<Buffer[]> {
    return new Promise((resolve, reject) => {
        // Get video duration first
        ffmpeg.ffprobe(videoPath, async (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const duration = metadata.format.duration || 10;
            const frames: Buffer[] = [];
            const timestamps: string[] = [];

            // Extract frames at different points (beginning, middle, end)
            for (let i = 0; i < count; i++) {
                const time = (duration / (count + 1)) * (i + 1);
                timestamps.push(`00:00:${time.toFixed(3)}`);
            }

            const tempDir = path.dirname(videoPath);
            const baseName = path.basename(videoPath, path.extname(videoPath));

            try {
                // Extract all frames
                await new Promise<void>((resolveScreenshots, rejectScreenshots) => {
                    ffmpeg(videoPath)
                        .screenshots({
                            timestamps,
                            filename: `${baseName}_frame_%i.jpg`,
                            folder: tempDir,
                            size: '1280x720'
                        })
                        .on('end', () => resolveScreenshots())
                        .on('error', rejectScreenshots);
                });

                // Read all frame files
                for (let i = 0; i < count; i++) {
                    const framePath = path.join(tempDir, `${baseName}_frame_${i + 1}.jpg`);
                    const frameBuffer = await fs.readFile(framePath);
                    frames.push(frameBuffer);
                    await fs.unlink(framePath).catch(() => { });
                }

                resolve(frames);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Helper: Optimize Image
async function optimizeImageForAI(imagePath: string): Promise<string> {
    try {
        const buffer = await fs.readFile(imagePath);
        const optimizedBuffer = await sharp(buffer)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        return `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Image optimization failed:', error);
        const buffer = await fs.readFile(imagePath);
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting for expensive AI operations
        const rateLimitResponse = await rateLimit(request, RateLimitPresets.aiAnalysis);
        if (rateLimitResponse) return rateLimitResponse;

        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey || !apiKey.trim()) {
            return NextResponse.json(
                { error: 'AI analysis requires GOOGLE_GENAI_API_KEY (or GOOGLE_API_KEY). Add it in .env.local and restart.' },
                { status: 400 }
            );
        }

        const formData = await request.formData();

        // Inputs: New File OR Existing Path/URL
        const file = formData.get('file') as File;
        const existingMediaPath = formData.get('existingMediaPath') as string;
        const existingMediaUrl = formData.get('existingMediaUrl') as string;
        const existingThumbnailUrl = formData.get('existingThumbnailUrl') as string;
        const analysisImage = formData.get('analysisImage') as File;

        const productContext = formData.get('productContext') as string || '';
        const adSetCount = Math.max(1, parseInt(formData.get('adSetCount') as string) || 3);
        const adsCount = Math.max(1, parseInt(formData.get('adsCount') as string) || 1);
        const copyVariationCount = Math.max(adSetCount, adsCount, 3);

        const thumbnailFiles = formData.getAll('thumbnails') as File[]; // Check early

        if (!file && !existingMediaPath && (!thumbnailFiles || thumbnailFiles.length === 0)) {
            return NextResponse.json({ error: 'No media provided (file, path, or thumbnails required)' }, { status: 400 });
        }

        let filePath = '';
        let mediaUrl = '';
        let isVideo = false;

        // 1. Handle Source (New Upload vs Existing)
        if (existingMediaPath && existingMediaPath.length > 0) {
            console.log('Using existing media path:', existingMediaPath);
            filePath = existingMediaPath;
            mediaUrl = existingMediaUrl || existingMediaPath;

            // Check extension to determine type
            let ext = '';
            if (filePath.startsWith('http')) {
                try {
                    const urlObj = new URL(filePath);
                    ext = path.extname(urlObj.pathname).toLowerCase();
                } catch (e) {
                    ext = path.extname(filePath).toLowerCase();
                }
            } else {
                ext = path.extname(filePath).toLowerCase();
            }

            isVideo = ['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext);
        } else if (file) {
            // 1. Save file temporarily
            const tempDir = path.join(process.cwd(), 'uploads', 'temp');
            if (!existsSync(tempDir)) await fs.mkdir(tempDir, { recursive: true });

            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            filePath = path.join(tempDir, fileName);
            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.writeFile(filePath, buffer);

            isVideo = file.type.startsWith('video/');
            mediaUrl = filePath; // Temp URL
        }

        // 2. Prepare Media for AI
        let mediaDataUri = '';
        let analysisMediaType: 'video' | 'image' = isVideo ? 'video' : 'image';
        let isVideoFile = false;
        let allThumbnailsDataUris: string[] = [];

        // PRIORITY 1: Use ALL Client-Provided Thumbnails if available (Best for comprehensive analysis)
        // thumbnailFiles is already declared above
        if (thumbnailFiles && thumbnailFiles.length > 0) {
            console.log(`📸 Using ${thumbnailFiles.length} client-provided thumbnails for comprehensive analysis`);

            // Process all thumbnails
            for (const thumbFile of thumbnailFiles) {
                const buffer = Buffer.from(await thumbFile.arrayBuffer());
                const optimizedBuffer = await sharp(buffer)
                    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                allThumbnailsDataUris.push(`data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`);
            }

            // Use middle thumbnail as primary
            mediaDataUri = allThumbnailsDataUris[Math.floor(allThumbnailsDataUris.length / 2)];
            analysisMediaType = 'image';
            isVideoFile = false;

            console.log(`✅ Processed ${allThumbnailsDataUris.length} thumbnails for AI analysis`);
        }
        // PRIORITY 2: Use single selected thumbnail (backward compatibility)
        else if (analysisImage) {
            console.log('Using single client-provided thumbnail for analysis');
            const buffer = Buffer.from(await analysisImage.arrayBuffer());
            const optimizedBuffer = await sharp(buffer)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
            mediaDataUri = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
            analysisMediaType = 'image';
            isVideoFile = false;
        }
        // Library video: prefer thumbnail (fast). Else pass video URL to flow (download + Google AI).
        else if (isVideo && existingMediaPath && typeof existingMediaPath === 'string' && existingMediaPath.startsWith('http')) {
            if (existingThumbnailUrl && typeof existingThumbnailUrl === 'string' && existingThumbnailUrl.startsWith('http')) {
                try {
                    const res = await fetch(existingThumbnailUrl);
                    if (!res.ok) throw new Error(`Thumbnail fetch ${res.status}`);
                    const buf = Buffer.from(await res.arrayBuffer());
                    const opt = await sharp(buf).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
                    mediaDataUri = `data:image/jpeg;base64,${opt.toString('base64')}`;
                    analysisMediaType = 'image';
                    isVideoFile = false;
                    console.log('📹 Using library thumbnail for AI analysis (no video download)');
                } catch (e) {
                    console.warn('Thumbnail fetch failed, falling back to video URL:', e);
                    mediaDataUri = existingMediaPath;
                    analysisMediaType = 'video';
                    isVideoFile = false;
                    console.log('📹 Using library video URL for AI analysis');
                }
            } else {
                mediaDataUri = existingMediaPath;
                analysisMediaType = 'video';
                isVideoFile = false;
                console.log('📹 Using library video URL for AI analysis (no frame extraction)');
            }
        }
        else if (isVideo) {
            try {
                // Local video file: extract 3 frames for comprehensive analysis
                console.log('📹 Extracting 3 frames from video for detailed analysis...');
                const frameBuffers = await extractVideoFrames(filePath, 3);

                // Convert all frames to base64 and combine them
                const frameDataUris = frameBuffers.map(buffer =>
                    `data:image/jpeg;base64,${buffer.toString('base64')}`
                );

                // Use the middle frame as primary, but we'll send all frames in the prompt
                mediaDataUri = frameDataUris[1]; // Middle frame as primary
                analysisMediaType = 'image';
                isVideoFile = false;

                console.log(`✅ Extracted ${frameBuffers.length} frames for AI analysis`);
            } catch (e) {
                console.warn('Frame extraction failed, using single frame fallback');
                try {
                    // Fallback to single frame
                    const singleFrame = await extractVideoFrames(filePath, 1);
                    mediaDataUri = `data:image/jpeg;base64,${singleFrame[0].toString('base64')}`;
                    analysisMediaType = 'image';
                    isVideoFile = false;
                } catch (e2) {
                    console.warn('All frame extraction failed, using full video path for AI');
                    mediaDataUri = filePath;
                    analysisMediaType = 'video';
                    isVideoFile = true;
                }
            }
        } else {
            mediaDataUri = await optimizeImageForAI(filePath);
        }

        // 3. Fetch Past Interests (Database Knowledge)
        let pastInterests: string[] = [];
        try {
            const recentAdSets = await prisma.adSet.findMany({
                where: {
                    campaign: { metaAccount: { userId: session.user.id } },
                    status: 'ACTIVE'
                },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                select: { targeting: true }
            });

            const interestSet = new Set<string>();
            recentAdSets.forEach((adSet: any) => {
                const targeting = adSet.targeting as any;
                if (targeting?.interests && Array.isArray(targeting.interests)) {
                    targeting.interests.forEach((i: any) => interestSet.add(i.name));
                }
                if (targeting?.flexible_spec) {
                    targeting.flexible_spec.forEach((spec: any) => {
                        if (spec.interests) {
                            spec.interests.forEach((i: any) => interestSet.add(i.name));
                        }
                    });
                }
            });
            pastInterests = Array.from(interestSet).slice(0, 20);
        } catch (dbError) {
            console.warn('Failed to fetch past interests:', dbError);
        }

        // 4. Run AI Analysis
        const randomSeed = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Determine MIME Type for video (file path or URL) — required for Gemini
        let mimeType = 'image/jpeg';
        if (isVideo) {
            if (file) {
                mimeType = file.type;
            } else if (existingMediaPath) {
                let ext = '';
                if (typeof existingMediaPath === 'string' && existingMediaPath.startsWith('http')) {
                    try {
                        ext = path.extname(new URL(existingMediaPath).pathname).toLowerCase();
                    } catch {
                        ext = path.extname(existingMediaPath).toLowerCase();
                    }
                } else {
                    ext = path.extname(String(existingMediaPath)).toLowerCase();
                }
                const mimeMap: Record<string, string> = {
                    '.mp4': 'video/mp4',
                    '.mov': 'video/quicktime',
                    '.avi': 'video/x-msvideo',
                    '.webm': 'video/webm',
                    '.mkv': 'video/x-matroska'
                };
                mimeType = mimeMap[ext] || 'video/mp4';
            }
        }

        const aiResult = await analyzeMediaForAd({
            mediaUrl: mediaDataUri,
            mediaType: analysisMediaType,
            mimeType: analysisMediaType === 'video' ? mimeType : undefined,
            additionalFrames: allThumbnailsDataUris.length > 0 ? allThumbnailsDataUris : undefined,
            productContext,
            isVideoFile,
            adSetCount,
            adsCount,
            copyVariationCount,
            randomContext: randomSeed,
            pastSuccessExamples: pastInterests.length > 0 ? pastInterests : undefined,
        });

        // Cleanup temp file immediately to save space
        // await fs.unlink(filePath).catch(() => {}); 

        // Return Result
        return NextResponse.json({
            success: true,
            data: aiResult,
            tempFilePath: isVideo ? filePath : undefined // Return path if needed for thumbnail extraction on client, else cleanup
        });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Analysis failed' },
            { status: 500 }
        );
    }
}
