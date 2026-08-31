import test from "node:test";
import assert from "node:assert/strict";

test("Obsidian Agent Lock Guard - Unit Tests", async (t) => {
  await t.test("1. Duration formatting calculator", () => {
    function calculateDurationText(lockedAtDate) {
      if (!lockedAtDate) return "aktiv";
      const now = new Date();
      const diffSec = Math.max(0, Math.floor((now.getTime() - lockedAtDate.getTime()) / 1000));
      if (diffSec < 60) return `vor ${diffSec}s`;
      const mins = Math.floor(diffSec / 60);
      const remainingSec = diffSec % 60;
      return `vor ${mins}m ${remainingSec}s`;
    }

    const now = new Date();
    const tenSecAgo = new Date(now.getTime() - 10000);
    const twoMinAgo = new Date(now.getTime() - 130000);

    assert.ok(calculateDurationText(tenSecAgo).includes("10s"));
    assert.ok(calculateDurationText(twoMinAgo).includes("2m 10s"));
    assert.equal(calculateDurationText(null), "aktiv");
  });

  await t.test("2. Lock info parsing rules", () => {
    function extractLock(frontmatter) {
      if (!frontmatter || frontmatter.agent_state !== "processing") return null;
      return {
        lockedBy: frontmatter.locked_by || "KI-Agent",
        lockedAt: frontmatter.locked_at || null,
        agentState: "processing",
      };
    }

    assert.equal(extractLock({ agent_state: "idle" }), null);
    assert.equal(extractLock({}), null);

    const locked = extractLock({
      agent_state: "processing",
      locked_by: "agent:antigravity",
      locked_at: "2026-08-31T22:00:00.000Z",
    });

    assert.ok(locked !== null);
    assert.equal(locked.lockedBy, "agent:antigravity");
    assert.equal(locked.agentState, "processing");
  });
});
