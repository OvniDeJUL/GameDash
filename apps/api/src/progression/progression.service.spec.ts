import assert from "node:assert/strict";
import { ProgressionService } from "./progression.service";

const service = new ProgressionService();
const playerId = "usr_progression_player";
const matchOne = "9e12e735-72a0-4db3-8d4a-0a60c3a2b111";
const matchTwo = "ef7a9b12-77dc-4f1d-85a5-778e3d4e2111";

const initial = service.getPlayerProgression(playerId);
assert.equal(initial.level, 1);
assert.equal(initial.lifetimeXp, 0);
assert.equal(initial.currentLevelXp, 0);
assert.equal(initial.nextLevelXp, 150);
assert.equal(initial.xpToNextLevel, 150);
assert.equal(initial.rewards.length, 0);

const firstAward = service.awardMatchXp({
  playerId,
  mode: "ranked",
  outcome: "win",
  matchId: matchOne,
  actorId: playerId,
  occurredAt: "2026-06-11T12:00:00.000Z"
});

assert.equal(firstAward.xpAwarded, 180);
assert.equal(firstAward.levelBefore, 1);
assert.equal(firstAward.levelAfter, 2);
assert.equal(firstAward.lifetimeXpBefore, 0);
assert.equal(firstAward.lifetimeXpAfter, 180);
assert.equal(firstAward.rewardsGranted.length, 1);
assert.equal(firstAward.rewardsGranted[0]?.code, "profile_border_copper");

const secondAward = service.awardMatchXp({
  playerId,
  mode: "ranked",
  outcome: "win",
  matchId: matchTwo,
  actorId: playerId,
  occurredAt: "2026-06-11T12:15:00.000Z"
});

assert.equal(secondAward.levelBefore, 2);
assert.equal(secondAward.levelAfter, 3);
assert.equal(secondAward.rewardsGranted.length, 1);
assert.equal(secondAward.rewardsGranted[0]?.code, "title_queue_climber");

const progression = service.getPlayerProgression(playerId);
assert.equal(progression.level, 3);
assert.equal(progression.lifetimeXp, 360);
assert.equal(progression.currentLevelXp, 10);
assert.equal(progression.nextLevelXp, 650);
assert.equal(progression.xpToNextLevel, 290);
assert.equal(progression.rewards.length, 2);

const rewards = service.getLevelRewards();
assert.ok(rewards.some((reward) => reward.level === 4 && reward.rewardType === "soft_currency"));

const rules = service.getProgressionRules();
assert.equal(rules.baseXpByMode.ranked, 120);
assert.equal(rules.outcomeXp.loss, 25);
assert.ok(rules.levelThresholds.length >= 5);

const auditActions = service.getAuditLogs().map((entry) => entry.action);
assert.deepEqual(auditActions, ["progression.xp_award", "progression.xp_award"]);

console.log("progression service tests passed");
