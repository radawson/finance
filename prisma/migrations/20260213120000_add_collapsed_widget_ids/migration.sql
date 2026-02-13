-- AlterTable
ALTER TABLE "user_dashboard_prefs" ADD COLUMN "collapsedWidgetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
