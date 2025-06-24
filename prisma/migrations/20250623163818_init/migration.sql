-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessingType" AS ENUM ('THUMBNAIL', 'MEDIUM', 'LARGE', 'CUSTOM', 'WATERMARK', 'CROP', 'RESIZE', 'COMPRESS');

-- CreateEnum
CREATE TYPE "ImageFormat" AS ENUM ('JPEG', 'PNG', 'WEBP', 'GIF');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "description" TEXT,
    "altText" TEXT,
    "tags" TEXT[],
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_images" (
    "id" TEXT NOT NULL,
    "originalImageId" TEXT NOT NULL,
    "type" "ProcessingType" NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "format" "ImageFormat" NOT NULL,
    "quality" INTEGER,
    "size" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "parameters" JSONB,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "uploadedFiles" INTEGER NOT NULL DEFAULT 0,
    "failedFiles" INTEGER NOT NULL DEFAULT 0,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "images_s3Key_key" ON "images"("s3Key");

-- CreateIndex
CREATE INDEX "images_userId_idx" ON "images"("userId");

-- CreateIndex
CREATE INDEX "images_createdAt_idx" ON "images"("createdAt");

-- CreateIndex
CREATE INDEX "images_processingStatus_idx" ON "images"("processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "processed_images_s3Key_key" ON "processed_images"("s3Key");

-- CreateIndex
CREATE INDEX "processed_images_originalImageId_idx" ON "processed_images"("originalImageId");

-- CreateIndex
CREATE INDEX "processed_images_type_idx" ON "processed_images"("type");

-- CreateIndex
CREATE INDEX "processed_images_status_idx" ON "processed_images"("status");

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_sessionToken_key" ON "upload_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "upload_sessions_sessionToken_idx" ON "upload_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "upload_sessions_userId_idx" ON "upload_sessions"("userId");

-- CreateIndex
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions"("status");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_images" ADD CONSTRAINT "processed_images_originalImageId_fkey" FOREIGN KEY ("originalImageId") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
