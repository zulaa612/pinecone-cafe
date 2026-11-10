import assert from "node:assert/strict";
import { CURRENCY, money, toCents } from "../src/lib/cafe";

assert.equal(CURRENCY, "MNT");
assert.equal(money(12_500), "₮12,500");
assert.equal(money(1_234.56), "₮1,234.56");
assert.equal(money(0), "₮0");
assert.equal(money(-12.5), "-₮12.5");

// Historical fractional amounts must keep the same stored value after the currency change.
assert.equal(toCents(1_234.56), 123_456);
assert.equal(toCents(0.29), 29);

console.log("MNT currency formatting and stored-unit checks passed.");
