ALTER TABLE "vendors"
  ADD COLUMN "pickup_address" VARCHAR(240),
  ADD COLUMN "pickup_lat" DOUBLE PRECISION,
  ADD COLUMN "pickup_lng" DOUBLE PRECISION,
  ADD COLUMN "delivery_cutoff_time" VARCHAR(5),
  ADD COLUMN "next_day_delivery" BOOLEAN NOT NULL DEFAULT false;

UPDATE "vendors" AS v SET "pickup_lat" = p.latitude, "pickup_lng" = p.longitude
FROM "pincodes" AS p WHERE v.pickup_pincode = p.pincode;

ALTER TABLE "vendors" ADD CONSTRAINT "vendors_pickup_coordinates_check" CHECK (
  (pickup_lat IS NULL AND pickup_lng IS NULL) OR
  (pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL AND
   pickup_lat BETWEEN -90 AND 90 AND pickup_lng BETWEEN -180 AND 180)
);
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_cutoff_check" CHECK (
  delivery_cutoff_time IS NULL OR delivery_cutoff_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);
CREATE INDEX "vendors_status_same_day_delivery_pickup_lat_pickup_lng_idx"
  ON "vendors" ("status", "same_day_delivery", "pickup_lat", "pickup_lng");
