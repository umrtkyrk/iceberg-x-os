-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "update_id" TEXT,
    "demo_submission_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_stored_name_key" ON "Attachment"("stored_name");

-- CreateIndex
CREATE INDEX "Attachment_update_id_idx" ON "Attachment"("update_id");

-- CreateIndex
CREATE INDEX "Attachment_demo_submission_id_idx" ON "Attachment"("demo_submission_id");

-- CreateIndex
CREATE INDEX "Attachment_uploaded_by_id_created_at_idx" ON "Attachment"("uploaded_by_id", "created_at");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "Update"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_demo_submission_id_fkey" FOREIGN KEY ("demo_submission_id") REFERENCES "DemoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

