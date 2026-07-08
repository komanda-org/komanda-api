-- CreateTable
CREATE TABLE "restaurants" (
    "user_id" VARCHAR(36) NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "cuisine_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "logo_url" TEXT,
    "averageRating" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_cnpj_key" ON "restaurants"("cnpj");

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
