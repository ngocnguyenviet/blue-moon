ALTER TABLE "Otp" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
UPDATE "Otp" SET "used" = true WHERE "used" = false;
