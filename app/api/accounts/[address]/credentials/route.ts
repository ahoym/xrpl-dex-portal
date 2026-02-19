import { NextRequest } from "next/server";
import {
  getAndValidateAddress,
  getXrplClient,
  apiErrorResponse,
  isAccountNotFound,
} from "@/lib/api";
import { LSF_ACCEPTED, fromRippleEpoch } from "@/lib/xrpl/constants";
import { decodeCredentialType } from "@/lib/xrpl/credentials";
import type { CredentialInfo } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const client = await getXrplClient(request);

    let objects: Array<{
      LedgerEntryType: string;
      Issuer: string;
      Subject: string;
      CredentialType: string;
      Flags: number;
      Expiration?: number;
      URI?: string;
    }>;
    try {
      const response = await client.request({
        command: "account_objects",
        account: address,
        type: "credential",
        ledger_index: "validated",
      });
      objects = response.result.account_objects as typeof objects;
    } catch (err: unknown) {
      if (isAccountNotFound(err)) {
        return Response.json({ address, credentials: [] });
      }
      throw err;
    }

    const credentials: CredentialInfo[] = objects
      .filter((obj) => obj.Subject === address)
      .map((obj) => {
        const info: CredentialInfo = {
          issuer: obj.Issuer,
          credentialType: decodeCredentialType(obj.CredentialType),
          accepted: (obj.Flags & LSF_ACCEPTED) !== 0,
        };

        if (obj.Expiration !== undefined) {
          info.expiresAtMs = fromRippleEpoch(obj.Expiration).getTime();
        }

        if (obj.URI) {
          try {
            info.uri = Buffer.from(obj.URI, "hex").toString("utf-8");
          } catch {
            // Ignore decode failures — omit URI
          }
        }

        return info;
      });

    return Response.json({ address, credentials });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch credentials");
  }
}
