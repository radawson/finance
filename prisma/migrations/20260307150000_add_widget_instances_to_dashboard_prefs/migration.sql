-- AlterTable
ALTER TABLE "user_dashboard_prefs"
ADD COLUMN "widgetInstances" JSONB NOT NULL DEFAULT '[]';
