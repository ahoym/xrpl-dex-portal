import type { BookOffer } from "xrpl";
import { fromXrplAmount } from "./currency";

/** Normalize a raw XRPL BookOffer into the shape our API returns. */
export function normalizeOffer(offer: BookOffer) {
  return {
    account: offer.Account,
    taker_gets: fromXrplAmount(offer.TakerGets),
    taker_pays: fromXrplAmount(offer.TakerPays),
    ...(offer.taker_gets_funded && { taker_gets_funded: fromXrplAmount(offer.taker_gets_funded) }),
    ...(offer.taker_pays_funded && { taker_pays_funded: fromXrplAmount(offer.taker_pays_funded) }),
    quality: offer.quality,
    owner_funds: offer.owner_funds,
    flags: offer.Flags,
    sequence: offer.Sequence,
  };
}
