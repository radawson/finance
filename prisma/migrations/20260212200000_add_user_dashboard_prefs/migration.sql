-- CreateTable
CREATE TABLE "user_dashboard_prefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "layouts" JSONB NOT NULL,
    "visibleWidgetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_dashboard_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_dashboard_prefs_userId_key" ON "user_dashboard_prefs"("userId");

-- AddForeignKey
ALTER TABLE "user_dashboard_prefs" ADD CONSTRAINT "user_dashboard_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
