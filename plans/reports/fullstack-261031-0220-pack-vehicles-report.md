# Pack vehicles report

## Changes (branch feat/pack-vehicles, commit b1a4d73)
- `app/src/render/vehicle-models.ts`: car/truck/bike use MEGA PACK models from `VEHICLE_PACK`; `buildCar/buildBike/buildTruck` deleted. Box placeholder (entity colour) until the model loads. Variant chosen lazily on first `update(view)` via `pickVariant(pool.models, view.ownerNodeId)`. No scene-view change needed.
- Orientation/size: models lying along z (cars, trucks, scooters, City_6 bikes) turned +90 deg so nose is +X; the Town_19 bicycles lie along x facing -X, turned 180 deg. Uniform scale from `fitPlacement` on the turned bounds so length = footprint; floor at -height/2.
- Locomotive and wagon unchanged (boxes, wheel spin kept). Pack vehicles do not spin wheels or take colour.
- `app/tests/render/vehicle-models.test.ts`: new tests (placeholder then model, nose +X, length = footprint, on floor, variant by seed, no wheel spin, owner id); train tests kept.

## Tests
- tsc clean. tests/render: 12 files, 115 passed. Full run: 97 files, 1482 passed, 0 failed.

## Visual check
Scripts: `plans/browser-scripts/pack-vehicles-shots.mjs`, `pack-vehicles-lineup.mjs`. Shots in `plans/reports/shots-pack-vehicles/`.
- lineup-cars/trucks/bikes.png (temporary harness page, since deleted): all variants with footprint boxes and +X arrows. Cars and trucks face +X, wheels on ground, fit footprint. Bicycles initially faced backwards, fixed (handlebars now at the +X end).
- city-*.png (city-delivery-3d, 3D): pack cars (pink, red) drive on the road, sized like before, facing travel direction. No console errors.
- Race sample opens in 2D-top view (separate 2D renderer, not VehicleFigure); I could not switch it to 3D in the script, so race not checked in 3D.

## Known issues / not verified
- Seated driver and truck cargo not visually confirmed: the player truck sat under the HUD label and the camera was far; cargo count stayed 0 in my shots. Driver seat height (`seatFeet`) was not tuned.
- Pack car/truck height may exceed old collision height (capped by footprint rule at 2.5x).
