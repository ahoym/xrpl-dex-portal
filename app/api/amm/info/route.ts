import { NextRequest } from "next/server";
import { getXrplClient, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
import { formatAmmFee } from "@/lib/xrpl/amm-fee";
import { Assets } from "@/lib/assets";
import BigNumber from "bignumber.js";
import type { AMMInfoResponse } from "xrpl";

export async function GET(request: NextRequest) {
  try {
    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;

    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getXrplClient(request);

    const asset = buildCurrencySpec(baseCurrency, baseIssuer);
    const asset2 = buildCurrencySpec(quoteCurrency, quoteIssuer);

    let result: AMMInfoResponse;
    try {
      result = await client.request({
        command: "amm_info",
        asset,
        asset2,
      });
    } catch (err: unknown) {
      // AMM does not exist for this pair
      if (
        err instanceof Error &&
        (err.message.includes("actNotFound") ||
          err.message.includes("ammNotFound"))
      ) {
        return Response.json(
          {
            exists: false,
            asset1Currency: baseCurrency,
            asset1Issuer: baseIssuer,
            asset1Value: "0",
            asset2Currency: quoteCurrency,
            asset2Issuer: quoteIssuer,
            asset2Value: "0",
            lpTokenCurrency: "",
            lpTokenIssuer: "",
            lpTokenValue: "0",
            tradingFee: 0,
            spotPrice: "0",
          },
          {
            headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=20" },
          },
        );
      }
      throw err;
    }

    const amm = result.result.amm;

    // Normalize amounts
    const amount1 = fromXrplAmount(amm.amount);
    const amount2 = fromXrplAmount(amm.amount2);

    // Match XRPL response order to query base/quote order.
    // amm_info may return assets in a different order than requested.
    const amount1IsBase =
      amount1.currency === baseCurrency &&
      (baseCurrency === Assets.XRP || amount1.issuer === baseIssuer);

    const base = amount1IsBase ? amount1 : amount2;
    const quote = amount1IsBase ? amount2 : amount1;
    const baseFrozen = amount1IsBase ? amm.asset_frozen : amm.asset2_frozen;
    const quoteFrozen = amount1IsBase ? amm.asset2_frozen : amm.asset_frozen;

    // Compute spot price = quote reserves / base reserves
    const spotPrice =
      new BigNumber(base.value).isZero()
        ? "0"
        : new BigNumber(quote.value).div(base.value).toFixed();

    // Build auction slot info
    const auctionSlot = amm.auction_slot
      ? {
          account: amm.auction_slot.account,
          discountedFee: amm.auction_slot.discounted_fee,
          expiration: amm.auction_slot.expiration,
          price: amm.auction_slot.price.value,
        }
      : undefined;

    // Build vote slots
    const voteSlots = amm.vote_slots?.map((v) => ({
      account: v.account,
      tradingFee: v.trading_fee,
      voteWeight: v.vote_weight,
    }));

    return Response.json(
      {
        exists: true,
        account: amm.account,
        asset1Currency: base.currency,
        asset1Issuer: base.issuer,
        asset1Value: base.value,
        asset2Currency: quote.currency,
        asset2Issuer: quote.issuer,
        asset2Value: quote.value,
        lpTokenCurrency: amm.lp_token.currency,
        lpTokenIssuer: amm.lp_token.issuer,
        lpTokenValue: amm.lp_token.value,
        tradingFee: amm.trading_fee,
        tradingFeeFormatted: formatAmmFee(amm.trading_fee),
        spotPrice,
        auctionSlot,
        voteSlots,
        asset1Frozen: baseFrozen,
        asset2Frozen: quoteFrozen,
      },
      {
        headers: { "Cache-Control": "s-maxage=3, stale-while-revalidate=6" },
      },
    );
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch AMM info");
  }
}
