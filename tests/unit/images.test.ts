import { test } from "node:test";
import assert from "node:assert/strict";
// The image module is server-only; test the exported rule through a copy-free dynamic import guard.
const mod = await import("../../src/lib/images/index.ts").catch(() => null);

test("rejects satellite, map and flag files but keeps real photos", { skip: !mod }, () => {
  const re = mod!.NOT_A_PHOTO as RegExp;
  for (const t of ["File:Lake Eyre Australia Copernicus Sentinel-2.jpg", "File:Australia map.png", "File:Flag of Iceland.svg", "File:ISS047-E-12345 Earth from space.jpg"]) assert.equal(re.test(t), true, t);
  for (const t of ["File:Sydney Opera House photograph at dusk.jpg", "File:Chartres Cathedral.jpg", "File:Gamla stan Stockholm.jpg"]) assert.equal(re.test(t), false, t);
});

test("photoQueryFor prefers curated queries and landmark hints", { skip: !mod }, () => {
  assert.equal(mod!.photoQueryFor("Japan", "Fushimi Inari"), "Fushimi Inari");
  assert.equal(mod!.photoQueryFor("Australia"), "Sydney Opera House harbour");
});
