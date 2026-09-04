// Versioned emission-factor registry. Built in kickoff Session 2 — see
// ../../KICKOFF-PROMPT.md. A factor set is immutable, identified by (source, version,
// effective_date). A missing factor returns a typed MissingFactor error; it never falls
// back to a guess, an average, or a hard-coded literal.
export {};
