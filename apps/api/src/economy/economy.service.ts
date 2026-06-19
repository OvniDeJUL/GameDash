import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  CurrencyType,
  HardCurrencyPackage,
  InventoryItemResponse,
  PurchaseRequest,
  PurchaseResponse,
  SimulatePaymentRequest,
  SimulatePaymentResponse,
  StoreItem,
  TransactionResponse,
  WalletResponse
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const INITIAL_SOFT_BALANCE = 1000;
const INITIAL_HARD_BALANCE = 20;

const DEFAULT_SOFT_PER_MATCH: Record<"ranked" | "unranked" | "fun", { base: number; winBonus: number }> = {
  ranked:   { base: 50, winBonus: 25 },
  unranked: { base: 40, winBonus: 20 },
  fun:      { base: 25, winBonus: 10 }
};

const HARD_CURRENCY_PACKAGES: HardCurrencyPackage[] = [
  { id: "pkg_5",   label: "Starter Pack",   hardAmount: 5,   bonusAmount: 0,  priceUsd: 4.99  },
  { id: "pkg_10",  label: "Value Pack",      hardAmount: 10,  bonusAmount: 1,  priceUsd: 9.99  },
  { id: "pkg_25",  label: "Plus Pack",       hardAmount: 25,  bonusAmount: 4,  priceUsd: 24.99 },
  { id: "pkg_50",  label: "Premium Pack",    hardAmount: 50,  bonusAmount: 10, priceUsd: 49.99 }
];


@Injectable()
export class EconomyService {
  private softPerMatch: Record<"ranked" | "unranked" | "fun", { base: number; winBonus: number }> = {
    ranked:   { ...DEFAULT_SOFT_PER_MATCH.ranked },
    unranked: { ...DEFAULT_SOFT_PER_MATCH.unranked },
    fun:      { ...DEFAULT_SOFT_PER_MATCH.fun }
  };

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async reloadRewardSettings(): Promise<void> {
    const row = await this.prisma.studioSetting.findUnique({ where: { key: "rewards" } });
    if (!row?.value) return;
    const v = row.value as {
      rankedSoftBase?: number; rankedSoftWinBonus?: number;
      unrankedSoftBase?: number; unrankedSoftWinBonus?: number;
      funSoftBase?: number; funSoftWinBonus?: number;
    };
    if (v.rankedSoftBase !== undefined) this.softPerMatch.ranked.base = v.rankedSoftBase;
    if (v.rankedSoftWinBonus !== undefined) this.softPerMatch.ranked.winBonus = v.rankedSoftWinBonus;
    if (v.unrankedSoftBase !== undefined) this.softPerMatch.unranked.base = v.unrankedSoftBase;
    if (v.unrankedSoftWinBonus !== undefined) this.softPerMatch.unranked.winBonus = v.unrankedSoftWinBonus;
    if (v.funSoftBase !== undefined) this.softPerMatch.fun.base = v.funSoftBase;
    if (v.funSoftWinBonus !== undefined) this.softPerMatch.fun.winBonus = v.funSoftWinBonus;
  }

  async listStoreItems(): Promise<StoreItem[]> {
    const items = await this.prisma.storeItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" }
    });
    return items.map((i) => this.toStoreItem(i));
  }

  private toStoreItem(i: { id: string; itemCode: string; name: string; description: string | null; currencyType: string; price: number; active: boolean; sortOrder: number }): StoreItem {
    return {
      id: i.id,
      itemCode: i.itemCode,
      name: i.name,
      description: i.description ?? undefined,
      currencyType: i.currencyType.toLowerCase() as CurrencyType,
      price: i.price,
      active: i.active,
      sortOrder: i.sortOrder
    };
  }

  async getWallet(actor: AuthenticatedUser): Promise<WalletResponse> {
    const wallet = await this.ensureWallet(actor.id);
    return this.toWalletResponse(actor.id, wallet);
  }

  async getInventory(actor: AuthenticatedUser): Promise<InventoryItemResponse[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { userId: actor.id },
      orderBy: { itemCode: "asc" }
    });
    return items.map((i) => ({
      id: i.id,
      playerId: i.userId,
      itemCode: i.itemCode,
      name: i.name,
      quantity: i.quantity,
      equipped: i.equipped,
      updatedAt: i.updatedAt.toISOString()
    }));
  }

  async getTransactions(actor: AuthenticatedUser): Promise<TransactionResponse[]> {
    const txs = await this.prisma.transaction.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" }
    });
    return txs.map(this.toTransactionResponse);
  }

  async purchase(actor: AuthenticatedUser, body: PurchaseRequest): Promise<PurchaseResponse> {
    const quantity = this.assertQuantity(body.quantity);
    const dbItem = await this.prisma.storeItem.findFirst({ where: { id: body.storeItemId, active: true } });
    if (!dbItem) throw new NotFoundException("Store item not found.");
    const item = this.toStoreItem(dbItem);

    const wallet = await this.ensureWallet(actor.id);
    const amount = item.price * quantity;
    const currencyField = item.currencyType === "soft" ? "softBalance" : "hardBalance";
    const balanceBefore = currencyField === "softBalance" ? wallet.softBalance : wallet.hardBalance;
    const createdAt = new Date();

    if (balanceBefore < amount) {
      const tx = await this.prisma.transaction.create({
        data: {
          userId: actor.id,
          itemCode: item.itemCode,
          currencyType: item.currencyType.toUpperCase() as "SOFT" | "HARD",
          unitPrice: item.price,
          quantity,
          amount,
          balanceBefore,
          balanceAfter: balanceBefore,
          status: "REJECTED",
          reason: "insufficient_funds",
          createdAt
        }
      });
      await this.audit(actor.id, "economy.purchase.rejected", "transaction", tx.id, {
        storeItemId: item.id,
        amount,
        reason: "insufficient_funds"
      });

      return {
        transaction: this.toTransactionResponse(tx),
        wallet: this.toWalletResponse(actor.id, wallet)
      };
    }

    const balanceAfter = balanceBefore - amount;
    const updatedWallet = await this.prisma.wallet.update({
      where: { userId: actor.id },
      data: { [currencyField]: balanceAfter }
    });

    const [tx, inventoryItem] = await Promise.all([
      this.prisma.transaction.create({
        data: {
          userId: actor.id,
          itemCode: item.itemCode,
          currencyType: item.currencyType.toUpperCase() as "SOFT" | "HARD",
          unitPrice: item.price,
          quantity,
          amount,
          balanceBefore,
          balanceAfter,
          status: "ACCEPTED",
          createdAt
        }
      }),
      this.upsertInventoryItem(actor.id, item, quantity)
    ]);

    await this.audit(actor.id, "economy.purchase.accepted", "transaction", tx.id, {
      storeItemId: item.id,
      itemCode: item.itemCode,
      quantity,
      amount,
      balanceBefore,
      balanceAfter
    });

    const inv: InventoryItemResponse = {
      id: inventoryItem.id,
      playerId: actor.id,
      itemCode: inventoryItem.itemCode,
      name: inventoryItem.name,
      quantity: inventoryItem.quantity,
      equipped: inventoryItem.equipped,
      updatedAt: inventoryItem.updatedAt.toISOString()
    };

    return {
      transaction: this.toTransactionResponse(tx),
      wallet: this.toWalletResponse(actor.id, updatedWallet),
      inventoryItem: inv
    };
  }

  listHardCurrencyPackages(): HardCurrencyPackage[] {
    return [...HARD_CURRENCY_PACKAGES];
  }

  async simulatePayment(actor: AuthenticatedUser, body: SimulatePaymentRequest): Promise<SimulatePaymentResponse> {
    const pkg = HARD_CURRENCY_PACKAGES.find((p) => p.id === body.packageId);
    if (!pkg) throw new NotFoundException("Hard currency package not found.");

    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

    const accepted = Math.random() < 0.95;
    const referenceId = `${body.provider.toUpperCase()}-${randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase()}`;
    const wallet = await this.ensureWallet(actor.id);

    if (!accepted) {
      await this.audit(actor.id, "economy.payment.rejected", "wallet", actor.id, {
        provider: body.provider,
        packageId: pkg.id,
        referenceId,
        reason: "gateway_declined"
      });
      return {
        accepted: false,
        referenceId,
        provider: body.provider,
        packageId: pkg.id,
        hardCurrencyAwarded: 0,
        wallet: this.toWalletResponse(actor.id, wallet),
        failureReason: "Payment declined by gateway (simulated)."
      };
    }

    const totalHard = pkg.hardAmount + pkg.bonusAmount;
    const balanceBefore = wallet.hardBalance;
    const balanceAfter = balanceBefore + totalHard;

    const updatedWallet = await this.prisma.wallet.update({
      where: { userId: actor.id },
      data: { hardBalance: balanceAfter }
    });

    await this.prisma.transaction.create({
      data: {
        userId: actor.id,
        itemCode: pkg.id,
        currencyType: "HARD",
        unitPrice: totalHard,
        quantity: 1,
        amount: totalHard,
        balanceBefore,
        balanceAfter,
        status: "ACCEPTED",
        metadata: { provider: body.provider, referenceId, priceUsd: pkg.priceUsd } as never
      }
    });

    await this.audit(actor.id, "economy.payment.accepted", "wallet", actor.id, {
      provider: body.provider,
      packageId: pkg.id,
      referenceId,
      totalHard,
      balanceBefore,
      balanceAfter
    });

    return {
      accepted: true,
      referenceId,
      provider: body.provider,
      packageId: pkg.id,
      hardCurrencyAwarded: totalHard,
      wallet: this.toWalletResponse(actor.id, updatedWallet)
    };
  }

  async awardSoftCurrency(
    userId: string,
    mode: "ranked" | "unranked" | "fun",
    outcome: "win" | "loss" | "draw",
    matchId: string
  ): Promise<number> {
    const cfg = this.softPerMatch[mode];
    const amount = cfg.base + (outcome === "win" ? cfg.winBonus : 0);
    const wallet = await this.ensureWallet(userId);
    const balanceBefore = wallet.softBalance;
    const balanceAfter = balanceBefore + amount;

    await this.prisma.wallet.update({
      where: { userId },
      data: { softBalance: balanceAfter }
    });

    await this.prisma.transaction.create({
      data: {
        userId,
        itemCode: "match_reward",
        currencyType: "SOFT",
        unitPrice: amount,
        quantity: 1,
        amount,
        balanceBefore,
        balanceAfter,
        status: "ACCEPTED",
        metadata: { matchId, mode, outcome } as never
      }
    });

    return amount;
  }

  async equipItem(actor: AuthenticatedUser, itemCode: string): Promise<InventoryItemResponse> {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { userId_itemCode: { userId: actor.id, itemCode } }
    });
    if (!item) throw new NotFoundException("Item not in inventory.");

    const updated = await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { equipped: !item.equipped }
    });

    return {
      id: updated.id,
      playerId: actor.id,
      itemCode: updated.itemCode,
      name: updated.name,
      quantity: updated.quantity,
      equipped: updated.equipped,
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async ensureWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, softBalance: INITIAL_SOFT_BALANCE, hardBalance: INITIAL_HARD_BALANCE },
      update: {}
    });
  }

  private toWalletResponse(
    playerId: string,
    wallet: { softBalance: number; hardBalance: number; updatedAt: Date }
  ): WalletResponse {
    return {
      playerId,
      softBalance: wallet.softBalance,
      hardBalance: wallet.hardBalance,
      updatedAt: wallet.updatedAt.toISOString()
    };
  }

  private toTransactionResponse(tx: {
    id: string;
    storeItemId: string | null;
    itemCode: string | null;
    currencyType: string;
    unitPrice: number;
    quantity: number;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    status: string;
    reason: string | null;
    createdAt: Date;
  }): TransactionResponse {
    return {
      transactionId: tx.id,
      status: tx.status.toLowerCase() as "accepted" | "rejected",
      storeItemId: tx.storeItemId ?? undefined,
      itemCode: tx.itemCode ?? undefined,
      currencyType: tx.currencyType.toLowerCase() as CurrencyType,
      unitPrice: tx.unitPrice,
      quantity: tx.quantity,
      amount: tx.amount,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      reason: tx.reason ?? undefined,
      createdAt: tx.createdAt.toISOString()
    };
  }

  private async upsertInventoryItem(
    userId: string,
    item: StoreItem,
    quantity: number
  ) {
    return this.prisma.inventoryItem.upsert({
      where: { userId_itemCode: { userId, itemCode: item.itemCode } },
      create: { userId, itemCode: item.itemCode, name: item.name, quantity },
      update: { quantity: { increment: quantity } }
    });
  }

  private assertQuantity(quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException("Purchase quantity must be a positive integer.");
    }
    return quantity;
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorId, action, targetType, targetId, metadata: metadata as never }
    });
  }
}
