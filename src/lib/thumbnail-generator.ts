import ffmpeg from 'fluent-ffmpeg';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

// FFmpeg will use system binaries (ffmpeg and ffprobe must be installed on the system)

export interface ThumbnailGenerationResult {
    success: boolean;
    thumbnailUrls?: string[];
    error?: string;
}

/**
 * Generate thumbnails from a video file and save locally
 * @param videoPath - Local path to the video file
 * @param userId - User ID for organizing thumbnails
 * @param videoId - Unique video identifier
 * @param count - Number of thumbnails to generate (default: 18)
 * @returns Array of thumbnail URLs (local API paths)
 */
export async function generateAndUploadThumbnails(
    videoPath: string,
    userId: string,
    videoId: string,
    count: number = 18
): Promise<ThumbnailGenerationResult> {
    try {
        console.log(`🎬 Generating ${count} thumbnails for video: ${videoPath}`);

        // Get video duration
        const duration = await getVideoDuration(videoPath);
        if (!duration || duration <= 0) {
            return {
                success: false,
                error: 'Could not determine video duration',
            };
        }

        console.log(`📹 Video duration: ${duration.toFixed(2)}s`);

        // Calculate intervals for thumbnail extraction
        const interval = duration / (count + 1);
        const timestamps: number[] = [];
        for (let i = 1; i <= count; i++) {
            timestamps.push(interval * i);
        }

        // Create local directory for thumbnails: uploads/thumbnails/userId/videoId/
        const thumbDir = path.join(process.cwd(), 'uploads', 'thumbnails', userId, videoId);
        if (!existsSync(thumbDir)) {
            await mkdir(thumbDir, { recursive: true });
        }

        // Extract and save thumbnails locally
        const thumbnailUrls: string[] = [];
        for (let i = 0; i < timestamps.length; i++) {
            const timestamp = timestamps[i];
            const thumbFileName = `thumb-${i}.jpg`;
            const thumbPath = path.join(thumbDir, thumbFileName);

            await extractFrameAtTime(videoPath, timestamp, thumbPath);

            // Optimize thumbnail: resize with fixed height 180px, width auto
            const buffer = await sharp(thumbPath)
                .resize({ height: 180 })
                .jpeg({ quality: 80 })
                .toBuffer();

            await writeFile(thumbPath, buffer);

            // Return local API URL for serving
            const thumbnailUrl = `/api/uploads/thumbnails/${userId}/${videoId}/${thumbFileName}`;
            thumbnailUrls.push(thumbnailUrl);
        }

        console.log(`✅ Saved ${thumbnailUrls.length} thumbnails locally`);

        return {
            success: true,
            thumbnailUrls,
        };
    } catch (error) {
        console.error('Error generating thumbnails:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Thumbnail generation failed',
        };
    }
}

/**
 * Get video duration in seconds
 */
function getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata.format.duration || 0);
            }
        });
    });
}

/**
 * Extract a single frame from video at specific timestamp
 */
function extractFrameAtTime(
    videoPath: string,
    timestamp: number,
    outputPath: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [timestamp],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '?x360', // Height 360, width auto
            })
            .on('end', () => resolve())
            .on('error', reject);
    });
}
