import type { BookOffer } from "xrpl";
import { fromXrplAmount } from "./currency";

/** Normalize a raw XRPL BookOffer into the shape our API returns. */
export function normalizeOffer(offer: BookOffer) {
  return {
    account: offer.Account,
    taker_gets: fromXrplAmount(offer.TakerGets),
    taker_pays: fromXrplAmount(offer.TakerPays),
    quality: offer.quality,
    owner_funds: offer.owner_funds,
    flags: offer.Flags,
    sequence: offer.Sequence,
  };
}
