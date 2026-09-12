declare module "@cashfreepayments/cashfree-js" {
  type CashfreeMode = "sandbox" | "production";

  interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_modal";
  }

  interface Cashfree {
    checkout(options: CashfreeCheckoutOptions): Promise<unknown>;
  }

  interface LoadOptions {
    mode: CashfreeMode;
  }

  export function load(options: LoadOptions): Promise<Cashfree>;
}