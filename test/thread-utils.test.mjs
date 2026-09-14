#!/usr/bin/env node
/**
 * Unit tests for extension/src/thread-utils.js (thread header parsing, bracket stripping,
 * subject normalization). The file is a classic background script, so it is loaded in a vm.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import vm from "vm";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "extension", "src", "thread-utils.js");
const ctx = vm.createContext({});
vm.runInContext(readFileSync(SRC, "utf-8"), ctx, { filename: SRC });
const { parseHeader, stripAngleBrackets, parseReferences, normalizeSubject, buildThreadIds } = ctx;

let passed = 0, failed = 0;
function test(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SIMPLE_RAW = [
  "Message-ID: <abc123@example.org>",
  "References: <root@example.org> <mid@example.org>",
  "In-Reply-To: <mid@example.org>",
  "Subject: Re: [team-list] Call for Participants",
  "From: someone@example.org",
  "",
  "Body text here.",
].join("\r\n");

const FOLDED_RAW = [
  "Message-ID: <abc123@example.org>",
  "References: <root@example.org>",
  " <mid@example.org>",
  "\t<other@example.org>",
  "Subject: AW: Topic",
  "",
  "Body.",
].join("\r\n");

// Embedded forwarded message: a second header block after the blank line
const FORWARDED_RAW = [
  "Message-ID: <outer@example.org>",
  "References: <first@example.org>",
  "In-Reply-To: <first@example.org>",
  "Subject: WG: Original",
  "",
  "---------- Forwarded message ----------",
  "Message-ID: <embedded@other.com>",
  "Subject: Original",
  "",
  "Forwarded body.",
].join("\r\n");

console.log("\n\x1b[1m=== thread-utils unit tests ===\x1b[0m\n");

// ─── parseHeader ─────────────────────────────────────────────────────────────

console.log("\x1b[1mparseHeader\x1b[0m");
test("extracts Message-ID", parseHeader(SIMPLE_RAW, "Message-ID"), "<abc123@example.org>");
test("extracts References", parseHeader(SIMPLE_RAW, "References"), "<root@example.org> <mid@example.org>");
test("extracts In-Reply-To", parseHeader(SIMPLE_RAW, "In-Reply-To"), "<mid@example.org>");
test("case-insensitive header name", parseHeader(SIMPLE_RAW, "message-id"), "<abc123@example.org>");
test("empty string for missing header", parseHeader(SIMPLE_RAW, "X-Nonexistent"), "");
test("unfolds multi-line References", parseHeader(FOLDED_RAW, "References"), "<root@example.org> <mid@example.org> <other@example.org>");
test("does not bleed into embedded forwarded headers", parseHeader(FORWARDED_RAW, "Message-ID"), "<outer@example.org>");
test("does not match a header that merely ends with the name",
  parseHeader("X-Original-Message-ID: <x@y>\nMessage-ID: <real@y>\n\nb", "Message-ID"), "<real@y>");
test("LF-only line endings", parseHeader("Message-ID: <lf@host>\nSubject: s\n\nbody", "Message-ID"), "<lf@host>");
test("message without a body", parseHeader("Message-ID: <nobody@host>", "Message-ID"), "<nobody@host>");

// ─── stripAngleBrackets ──────────────────────────────────────────────────────

console.log("\n\x1b[1mstripAngleBrackets\x1b[0m");
test("strips brackets from <id@host>", stripAngleBrackets("<abc123@example.org>"), "abc123@example.org");
test("no-op when already stripped", stripAngleBrackets("abc123@example.org"), "abc123@example.org");
test("trims surrounding whitespace", stripAngleBrackets("  <id@host>  "), "id@host");
test("empty string stays empty", stripAngleBrackets(""), "");

// ─── parseReferences ─────────────────────────────────────────────────────────

console.log("\n\x1b[1mparseReferences\x1b[0m");
test("parses multiple IDs", parseReferences("<root@example.org> <mid@example.org>"), ["root@example.org", "mid@example.org"]);
test("parses single ID", parseReferences("<only@host.com>"), ["only@host.com"]);
test("empty array for empty string", parseReferences(""), []);
test("ignores comments around an In-Reply-To id", parseReferences("<mid@host> (Someone's message of Monday)"), ["mid@host"]);

// ─── normalizeSubject ────────────────────────────────────────────────────────

console.log("\n\x1b[1mnormalizeSubject\x1b[0m");
test("strips Re:", normalizeSubject("Re: Topic"), "Topic");
test("strips WG: (German forward)", normalizeSubject("WG: Topic"), "Topic");
test("strips AW: (German reply)", normalizeSubject("AW: Topic"), "Topic");
test("strips Fwd:", normalizeSubject("Fwd: Topic"), "Topic");
test("strips FW:", normalizeSubject("FW: Topic"), "Topic");
test("strips stacked prefixes", normalizeSubject("Re: WG: AW: Topic"), "Topic");
test("strips [list-name] prefix", normalizeSubject("[team-list] Call for Participants"), "Call for Participants");
test("strips [list-name] after reply prefix", normalizeSubject("Re: [team-list] Call for Participants"), "Call for Participants");
test("strips complex stacked prefixes", normalizeSubject("AW: WG: [team-list] Call for Participants"), "Call for Participants");
test("no-op on plain subject", normalizeSubject("Kickoff meeting"), "Kickoff meeting");
test("does not strip words that start with a prefix", normalizeSubject("Review notes"), "Review notes");
test("trims whitespace", normalizeSubject("  Re: Topic  "), "Topic");

// ─── buildThreadIds ──────────────────────────────────────────────────────────

console.log("\n\x1b[1mbuildThreadIds\x1b[0m");
test("collects Message-ID + References + In-Reply-To without brackets",
  [...buildThreadIds(SIMPLE_RAW)].sort(), ["abc123@example.org", "mid@example.org", "root@example.org"]);
test("deduplicates IDs in both References and In-Reply-To",
  [...buildThreadIds(SIMPLE_RAW)].filter((id) => id === "mid@example.org").length, 1);
test("does not bleed embedded forwarded Message-ID",
  [...buildThreadIds(FORWARDED_RAW)].includes("embedded@other.com"), false);
test("empty set for a message with no threading headers", buildThreadIds("Subject: hi\r\n\r\nbody").size, 0);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n\x1b[1m${"─".repeat(40)}\x1b[0m`);
console.log(`\x1b[1m${passed} passed, ${failed} failed, ${passed + failed} total\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
