import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";

/** Read-only listing repository for the admin "Contas Demo" screen — mutations go through IUserRepository/WalletService directly (see DemoAccountService), this only joins User+Wallet+Session for display. */
export interface IDemoAccountRepository {
  list(): Promise<DemoAccountRow[]>;
}
