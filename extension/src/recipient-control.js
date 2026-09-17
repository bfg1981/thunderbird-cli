/**
 * Pure recipient-list helpers shared by the reply handler and regression tests.
 */

(function exposeRecipientControl(global) {
  function asRecipientList(value) {
    if (value === undefined || value === null || value === "") return [];
    return Array.isArray(value) ? value : [value];
  }

  function recipientMailbox(recipient) {
    if (typeof recipient !== "string") return null;
    const value = recipient.trim();
    const bracketed = value.match(/<([^<>]+)>\s*$/);
    return (bracketed?.[1] || value).trim().toLowerCase();
  }

  function recipientKey(recipient) {
    const mailbox = recipientMailbox(recipient);
    if (mailbox) return `mailbox:${mailbox}`;
    if (recipient && typeof recipient === "object" && recipient.nodeId) {
      return `${recipient.type || "node"}:${recipient.nodeId}`;
    }
    return null;
  }

  function recipientDetailsMatch(expected, actual) {
    return ["to", "cc", "bcc"].every((field) => {
      const expectedKeys = asRecipientList(expected[field]).map(recipientKey).sort();
      const actualKeys = asRecipientList(actual[field]).map(recipientKey).sort();
      return !expectedKeys.includes(null) && !actualKeys.includes(null) &&
        JSON.stringify(expectedKeys) === JSON.stringify(actualKeys);
    });
  }

  function excludeFromRecipientDetails(details, requestedExclusions) {
    const exclusions = new Set(
      asRecipientList(requestedExclusions)
        .map(recipientMailbox)
        .filter(Boolean),
    );
    const matched = new Set();
    const recipients = {};

    for (const field of ["to", "cc", "bcc"]) {
      recipients[field] = asRecipientList(details[field]).filter((recipient) => {
        const address = recipientMailbox(recipient);
        if (address && exclusions.has(address)) {
          matched.add(address);
          return false;
        }
        return true;
      });
    }

    return {
      recipients,
      excludedRecipients: [...exclusions],
      unmatchedRecipients: [...exclusions].filter((address) => !matched.has(address)),
    };
  }

  global.tbRecipientControl = {
    asRecipientList,
    recipientMailbox,
    recipientDetailsMatch,
    excludeFromRecipientDetails,
  };
})(globalThis);
