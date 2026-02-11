import { NextRequest } from "next/server";
import { Wallet } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { NETWORKS, resolveNetwork } from "@/lib/xrpl/networks";
import { apiErrorResponse } from "@/lib/api";
import type { GenerateAccountResponse } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const networkId = resolveNetwork(body.network);

    const wallet = Wallet.generate();

    // On networks with a faucet (testnet/devnet), fund the wallet automatically
    const faucet = NETWORKS[networkId].faucet;
    let balance = "0";

    if (faucet) {
      const client = await getClient(networkId);
      const funded = await client.fundWallet(wallet, { amount: "1000" });
      balance = String(funded.balance);
    }

    const response: GenerateAccountResponse = {
      address: wallet.address,
      seed: wallet.seed!,
      publicKey: wallet.publicKey,
      balance,
    };

    return Response.json(response, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to generate account");
  }
}
