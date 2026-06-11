import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EconomyService } from "./economy.service";
import type { AuthenticatedUser } from "../auth/auth.types";

const service = new EconomyService();

const player: AuthenticatedUser = {
  id: "usr_economy_player",
  email: "economy@example.test",
  role: "player"
};

const storeItems = service.listStoreItems();
assert.ok(storeItems.length >= 3);
assert.ok(storeItems.every((item) => item.active));

const initialWallet = service.getWallet(player);
assert.equal(initialWallet.playerId, player.id);
assert.equal(initialWallet.softBalance, 1000);
assert.equal(initialWallet.hardBalance, 20);

const softItem = storeItems.find((item) => item.currencyType === "soft");
assert.ok(softItem);

const acceptedPurchase = service.purchase(player, {
  storeItemId: softItem.id,
  quantity: 2
});

assert.equal(acceptedPurchase.transaction.status, "accepted");
assert.equal(acceptedPurchase.transaction.amount, softItem.price * 2);
assert.equal(acceptedPurchase.transaction.balanceBefore, 1000);
assert.equal(acceptedPurchase.transaction.balanceAfter, 1000 - softItem.price * 2);
assert.equal(acceptedPurchase.wallet.softBalance, 1000 - softItem.price * 2);
assert.equal(acceptedPurchase.inventoryItem?.itemCode, softItem.itemCode);
assert.equal(acceptedPurchase.inventoryItem?.quantity, 2);

const inventory = service.getInventory(player);
assert.equal(inventory.length, 1);
assert.equal(inventory[0]?.quantity, 2);

const rejectedPurchase = service.purchase(player, {
  storeItemId: softItem.id,
  quantity: 999
});

assert.equal(rejectedPurchase.transaction.status, "rejected");
assert.equal(rejectedPurchase.transaction.reason, "insufficient_funds");
assert.equal(rejectedPurchase.wallet.softBalance, acceptedPurchase.wallet.softBalance);
assert.equal(service.getInventory(player)[0]?.quantity, 2);

const transactions = service.getTransactions(player);
assert.equal(transactions.length, 2);
assert.equal(transactions[0]?.status, "rejected");
assert.equal(transactions[1]?.status, "accepted");

const auditActions = service.getAuditLogs().map((entry) => entry.action);
assert.deepEqual(auditActions, ["economy.purchase.accepted", "economy.purchase.rejected"]);

assert.throws(
  () =>
    service.purchase(player, {
      storeItemId: softItem.id,
      quantity: 0
    }),
  BadRequestException
);

assert.throws(
  () =>
    service.purchase(player, {
      storeItemId: "missing_item",
      quantity: 1
    }),
  NotFoundException
);

console.log("economy service tests passed");
