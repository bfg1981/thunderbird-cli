import assert from "node:assert/strict";

await import("../extension/src/recipient-control.js");

const {
  asRecipientList,
  recipientMailbox,
  recipientDetailsMatch,
  excludeFromRecipientDetails,
} = globalThis.tbRecipientControl;

assert.deepEqual(asRecipientList(undefined), []);
assert.deepEqual(asRecipientList("one@example.com"), ["one@example.com"]);
assert.equal(recipientMailbox("Person <Mixed.Case@Example.COM>"), "mixed.case@example.com");
assert.equal(recipientDetailsMatch(
  { to: ["Person <one@example.com>"], cc: [], bcc: [] },
  { to: ["ONE@example.com"], cc: [], bcc: [] },
), true);
assert.equal(recipientDetailsMatch(
  { to: ["one@example.com"], cc: [], bcc: [] },
  { to: ["other@example.com"], cc: [], bcc: [] },
), false);

const result = excludeFromRecipientDetails({
  to: ["Keep <keep@example.com>", "Remove <remove@example.com>"],
  cc: "REMOVE@example.com",
  bcc: ["hidden@example.com"],
}, ["remove@example.com"]);

assert.deepEqual(result.recipients, {
  to: ["Keep <keep@example.com>"],
  cc: [],
  bcc: ["hidden@example.com"],
});
assert.deepEqual(result.excludedRecipients, ["remove@example.com"]);
assert.deepEqual(result.unmatchedRecipients, []);

const unmatched = excludeFromRecipientDetails(
  { to: ["keep@example.com"], cc: [], bcc: [] },
  ["missing@example.com"],
);
assert.deepEqual(unmatched.unmatchedRecipients, ["missing@example.com"]);

console.log("recipient control tests passed");
