import { NextRequest } from "next/server";
import { getXrplClient, apiErrorResponse } from "@/lib/api";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";
import { decodeCredentialType } from "@/lib/xrpl/credentials";
import type { AcceptedCredentialInfo } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const { domainId } = await params;

    if (!DOMAIN_ID_REGEX.test(domainId)) {
      return Response.json({ error: "Invalid domain ID format" }, { status: 400 });
    }

    const client = await getXrplClient(request);

    let node: {
      LedgerEntryType: string;
      Owner: string;
      AcceptedCredentials?: Array<{
        Credential: { Issuer: string; CredentialType: string };
      }>;
    };

    try {
      const response = await client.request({
        command: "ledger_entry",
        index: domainId,
        ledger_index: "validated",
      });
      node = response.result.node as typeof node;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("entryNotFound")) {
        return Response.json({ error: "Domain not found" }, { status: 404 });
      }
      throw err;
    }

    if (node.LedgerEntryType !== "PermissionedDomain") {
      return Response.json({ error: "Domain not found" }, { status: 404 });
    }

    const acceptedCredentials: AcceptedCredentialInfo[] = (node.AcceptedCredentials ?? []).map(
      (entry) => ({
        issuer: entry.Credential.Issuer,
        credentialType: decodeCredentialType(entry.Credential.CredentialType),
      }),
    );

    return Response.json({ domainId, owner: node.Owner, acceptedCredentials });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch domain");
  }
}
