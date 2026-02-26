import { NextRequest } from "next/server";
import { dropsToXrp } from "xrpl";
import { decodeCurrency } from "@/lib/xrpl/currency";
import {
  getXrplClient,
  getAndValidateAddress,
  apiErrorResponse,
  isAccountNotFound,
} from "@/lib/api";
import type { CurrencyBalance } from "@/lib/xrpl/types";
import { Assets } from "@/lib/assets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const client = await getXrplClient(request);

    let accountInfo;
    try {
      accountInfo = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
      });
    } catch (err: unknown) {
      if (isAccountNotFound(err)) {
        return Response.json({
          address,
          balances: [{ currency: Assets.XRP, value: "0" }],
        });
      }
      throw err;
    }

    const accountLines = await client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated",
    });

    const xrpBalance: CurrencyBalance = {
      currency: Assets.XRP,
      value: String(dropsToXrp(accountInfo.result.account_data.Balance)),
    };

    const issuedBalances: CurrencyBalance[] = accountLines.result.lines.map((line) => ({
      currency: decodeCurrency(line.currency),
      value: line.balance,
      issuer: line.account,
    }));

    return Response.json({
      address,
      balances: [xrpBalance, ...issuedBalances],
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch balances");
  }
}
