import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type {
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
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EconomyService } from "./economy.service";

@Controller("economy")
@UseGuards(AuthGuard)
export class EconomyController {
  constructor(
    @Inject(EconomyService)
    private readonly economyService: EconomyService
  ) {}

  @Get("store/items")
  getStoreItems(): StoreItem[] {
    return this.economyService.listStoreItems();
  }

  @Get("wallet")
  getWallet(@CurrentUser() user: AuthenticatedUser): Promise<WalletResponse> {
    return this.economyService.getWallet(user);
  }

  @Get("inventory")
  getInventory(@CurrentUser() user: AuthenticatedUser): Promise<InventoryItemResponse[]> {
    return this.economyService.getInventory(user);
  }

  @Get("transactions")
  getTransactions(@CurrentUser() user: AuthenticatedUser): Promise<TransactionResponse[]> {
    return this.economyService.getTransactions(user);
  }

  @Post("transactions/purchase")
  purchase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PurchaseRequest
  ): Promise<PurchaseResponse> {
    return this.economyService.purchase(user, body);
  }

  @Patch("inventory/:itemCode/equip")
  equipItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("itemCode") itemCode: string
  ): Promise<InventoryItemResponse> {
    return this.economyService.equipItem(user, itemCode);
  }

  @Get("payments/packages")
  getHardCurrencyPackages(): HardCurrencyPackage[] {
    return this.economyService.listHardCurrencyPackages();
  }

  @Post("payments/simulate")
  simulatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SimulatePaymentRequest
  ): Promise<SimulatePaymentResponse> {
    return this.economyService.simulatePayment(user, body);
  }
}
