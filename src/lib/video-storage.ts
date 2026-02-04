import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface UploadResult {
  success: boolean;
  filePath?: string;
  url?: string;
  thumbnailUrls?: string[]; // Array of thumbnail URLs
  error?: string;
}

export class VideoStorage {
  private uploadDir: string;

  constructor() {
    // Use UPLOAD_DIR from env or default to ./uploads
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'videos');
  }

  /**
   * Delete video file from local storage
   */
  async delete(fileName: string, userId: string): Promise<{ success: boolean; error?: string }> {
    let deletedFromLocal = false;
    let errorMsg = '';

    // Local Deletion
    try {
      // Possible local paths
      const possiblePaths = [
        path.join(process.cwd(), 'uploads', 'videos', userId, fileName),
        path.join(process.cwd(), 'uploads', userId, fileName),
        path.join(this.uploadDir, userId, fileName)
      ];

      for (const p of possiblePaths) {
        if (existsSync(p)) {
          console.log(`🗑️ Deleting local file: ${p}`);
          await unlink(p);
          deletedFromLocal = true;
          console.log('✅ Deleted local file');
        }
      }
    } catch (err: any) {
      console.error('Local deletion failed:', err);
      // Windows file lock issue?
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        errorMsg += `Local file locked (being used by another process). `;
      } else {
        errorMsg += `Local: ${err.message}`;
      }
    }

    if (deletedFromLocal) {
      return { success: true };
    }

    return {
      success: false,
      error: errorMsg || 'File not found in local storage'
    };
  }

  /**
   * Upload video file to local storage
   */
  async uploadToLocal(file: File, folderName?: string): Promise<UploadResult> {
    try {
      // Log file size for tracking
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`📤 Uploading file to local storage: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);

      // Create folder structure: uploads/videos/{folderName}/
      const targetDir = folderName
        ? path.join(this.uploadDir, folderName)
        : this.uploadDir;

      // Ensure upload directory exists
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileExtension = file.name.split('.').pop();
      const fileName = `video_${timestamp}_${randomStr}.${fileExtension}`;
      const filePath = path.join(targetDir, fileName);

      // Convert File to Buffer
      console.log(`⏳ Converting file to buffer...`);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Write file to disk
      console.log(`💾 Writing file to disk: ${filePath}`);
      await writeFile(filePath, buffer);

      console.log(`✅ Video uploaded successfully (${fileSizeMB.toFixed(2)}MB): ${filePath}`);

      // Generate URL path (served via /api/uploads/[...path])
      const urlPath = folderName
        ? `/api/uploads/videos/${folderName}/${fileName}`
        : `/api/uploads/videos/${fileName}`;

      return {
        success: true,
        filePath,
        url: urlPath,
      };
    } catch (error) {
      console.error('Error uploading video to local storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload video - uses local storage only
   * For videos, also generates thumbnails and saves them locally
   */
  async upload(file: File, folderName?: string): Promise<UploadResult> {
    // Local upload
    const localResult = await this.uploadToLocal(file, folderName);

    // Generate thumbnails for local video uploads
    if (localResult.success && file.type.startsWith('video/') && localResult.filePath && folderName) {
      try {
        console.log('🎬 Generating thumbnails for uploaded video...');
        const { generateAndUploadThumbnails } = await import('./thumbnail-generator');

        // Extract video ID from file path
        const videoId = path.basename(localResult.filePath, path.extname(localResult.filePath));

        const thumbResult = await generateAndUploadThumbnails(
          localResult.filePath,
          folderName,
          videoId,
          18
        );

        if (thumbResult.success && thumbResult.thumbnailUrls) {
          localResult.thumbnailUrls = thumbResult.thumbnailUrls;
          console.log(`✅ Generated ${thumbResult.thumbnailUrls.length} thumbnails`);
        }
      } catch (thumbError) {
        console.error('Thumbnail generation failed:', thumbError);
        // Don't fail the upload if thumbnail generation fails
      }
    }

    return localResult;
  }
}

export const videoStorage = new VideoStorage();
