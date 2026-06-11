import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  CurrencyType,
  InventoryItemResponse,
  PurchaseRequest,
  PurchaseResponse,
  StoreItem,
  TransactionResponse,
  WalletResponse
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";

interface WalletState {
  playerId: string;
  softBalance: number;
  hardBalance: number;
  updatedAt: string;
}

interface EconomyAuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const INITIAL_SOFT_BALANCE = 1000;
const INITIAL_HARD_BALANCE = 20;

const STORE_ITEMS: StoreItem[] = [
  {
    id: "item_starter_skin",
    itemCode: "skin_starter",
    name: "Starter Skin",
    description: "Baseline character skin purchasable with soft currency.",
    currencyType: "soft",
    price: 200,
    active: true,
    sortOrder: 10
  },
  {
    id: "item_ranked_banner",
    itemCode: "banner_ranked",
    name: "Ranked Banner",
    description: "Profile banner for competitive players.",
    currencyType: "soft",
    price: 400,
    active: true,
    sortOrder: 20
  },
  {
    id: "item_premium_skin",
    itemCode: "skin_premium",
    name: "Premium Skin",
    description: "Sandbox premium cosmetic purchasable with hard currency.",
    currencyType: "hard",
    price: 5,
    active: true,
    sortOrder: 30
  }
];

@Injectable()
export class EconomyService {
  private readonly wallets = new Map<string, WalletState>();
  private readonly inventory = new Map<string, Map<string, InventoryItemResponse>>();
  private readonly transactions = new Map<string, TransactionResponse[]>();
  private readonly auditLogs: EconomyAuditEntry[] = [];

  listStoreItems(): StoreItem[] {
    return STORE_ITEMS.filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getWallet(actor: AuthenticatedUser): WalletResponse {
    return this.toWalletResponse(this.ensureWallet(actor.id));
  }

  getInventory(actor: AuthenticatedUser): InventoryItemResponse[] {
    return [...this.ensureInventory(actor.id).values()].sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  }

  getTransactions(actor: AuthenticatedUser): TransactionResponse[] {
    return [...(this.transactions.get(actor.id) ?? [])];
  }

  purchase(actor: AuthenticatedUser, body: PurchaseRequest): PurchaseResponse {
    const quantity = this.assertQuantity(body.quantity);
    const item = STORE_ITEMS.find((storeItem) => storeItem.id === body.storeItemId && storeItem.active);

    if (!item) {
      throw new NotFoundException("Store item not found.");
    }

    const wallet = this.ensureWallet(actor.id);
    const createdAt = new Date().toISOString();
    const amount = item.price * quantity;
    const balanceBefore = this.getCurrencyBalance(wallet, item.currencyType);

    if (balanceBefore < amount) {
      const transaction = this.recordTransaction(actor.id, {
        transactionId: randomUUID(),
        status: "rejected",
        storeItemId: item.id,
        itemCode: item.itemCode,
        currencyType: item.currencyType,
        unitPrice: item.price,
        quantity,
        amount,
        balanceBefore,
        balanceAfter: balanceBefore,
        reason: "insufficient_funds",
        createdAt
      });
      this.audit(actor.id, "economy.purchase.rejected", "transaction", transaction.transactionId, {
        storeItemId: item.id,
        itemCode: item.itemCode,
        currencyType: item.currencyType,
        amount,
        balanceBefore,
        balanceAfter: balanceBefore,
        reason: transaction.reason
      });

      return {
        transaction,
        wallet: this.toWalletResponse(wallet)
      };
    }

    const balanceAfter = balanceBefore - amount;
    this.setCurrencyBalance(wallet, item.currencyType, balanceAfter);
    wallet.updatedAt = createdAt;

    const inventoryItem = this.upsertInventoryItem(actor.id, item, quantity, createdAt);
    const transaction = this.recordTransaction(actor.id, {
      transactionId: randomUUID(),
      status: "accepted",
      storeItemId: item.id,
      itemCode: item.itemCode,
      currencyType: item.currencyType,
      unitPrice: item.price,
      quantity,
      amount,
      balanceBefore,
      balanceAfter,
      createdAt
    });
    this.audit(actor.id, "economy.purchase.accepted", "transaction", transaction.transactionId, {
      storeItemId: item.id,
      itemCode: item.itemCode,
      currencyType: item.currencyType,
      quantity,
      amount,
      balanceBefore,
      balanceAfter,
      inventoryItemId: inventoryItem.id
    });

    return {
      transaction,
      wallet: this.toWalletResponse(wallet),
      inventoryItem
    };
  }

  getAuditLogs(): EconomyAuditEntry[] {
    return [...this.auditLogs];
  }

  private ensureWallet(playerId: string): WalletState {
    const existing = this.wallets.get(playerId);
    if (existing) {
      return existing;
    }

    const wallet: WalletState = {
      playerId,
      softBalance: INITIAL_SOFT_BALANCE,
      hardBalance: INITIAL_HARD_BALANCE,
      updatedAt: new Date().toISOString()
    };
    this.wallets.set(playerId, wallet);
    return wallet;
  }

  private ensureInventory(playerId: string): Map<string, InventoryItemResponse> {
    const existing = this.inventory.get(playerId);
    if (existing) {
      return existing;
    }

    const playerInventory = new Map<string, InventoryItemResponse>();
    this.inventory.set(playerId, playerInventory);
    return playerInventory;
  }

  private upsertInventoryItem(
    playerId: string,
    item: StoreItem,
    quantity: number,
    updatedAt: string
  ): InventoryItemResponse {
    const inventory = this.ensureInventory(playerId);
    const existing = inventory.get(item.itemCode);

    if (existing) {
      existing.quantity += quantity;
      existing.updatedAt = updatedAt;
      return existing;
    }

    const inventoryItem: InventoryItemResponse = {
      id: randomUUID(),
      playerId,
      itemCode: item.itemCode,
      name: item.name,
      quantity,
      equipped: false,
      updatedAt
    };
    inventory.set(item.itemCode, inventoryItem);
    return inventoryItem;
  }

  private recordTransaction(playerId: string, transaction: TransactionResponse): TransactionResponse {
    const existing = this.transactions.get(playerId) ?? [];
    existing.unshift(transaction);
    this.transactions.set(playerId, existing);
    return transaction;
  }

  private assertQuantity(quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException("Purchase quantity must be a positive integer.");
    }

    return quantity;
  }

  private getCurrencyBalance(wallet: WalletState, currencyType: CurrencyType): number {
    return currencyType === "soft" ? wallet.softBalance : wallet.hardBalance;
  }

  private setCurrencyBalance(wallet: WalletState, currencyType: CurrencyType, balance: number): void {
    if (currencyType === "soft") {
      wallet.softBalance = balance;
      return;
    }

    wallet.hardBalance = balance;
  }

  private toWalletResponse(wallet: WalletState): WalletResponse {
    return {
      playerId: wallet.playerId,
      softBalance: wallet.softBalance,
      hardBalance: wallet.hardBalance,
      updatedAt: wallet.updatedAt
    };
  }

  private audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.auditLogs.push({
      id: randomUUID(),
      actorId,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: new Date().toISOString()
    });
  }
}
