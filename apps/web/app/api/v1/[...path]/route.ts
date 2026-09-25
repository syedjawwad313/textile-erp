import { NextRequest, NextResponse } from "next/server";

// Fallback target URL for the NestJS API
const DEFAULT_API_URL = "https://textile-erp-api.onrender.com";

function getTargetApiUrl(): string {
  const configured =
    process.env.API_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_API_URL;

  // Clean trailing slashes and /api/v1 if accidentally included
  return configured.trim().replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const subPath = (params.path || []).join("/");
  const targetBase = getTargetApiUrl();
  const search = req.nextUrl.search || "";
  const backendUrl = `${targetBase}/api/v1/${subPath}${search}`;

  try {
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      // Exclude host and hop-by-hop headers
      const lower = key.toLowerCase();
      if (
        lower !== "host" &&
        lower !== "connection" &&
        lower !== "keep-alive" &&
        lower !== "transfer-encoding"
      ) {
        headers.set(key, value);
      }
    });

    // Ensure x-forwarded headers
    headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));
    headers.set("x-forwarded-host", req.nextUrl.host);

    const body =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await req.arrayBuffer();

    const response = await fetch(backendUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== "content-encoding" && lower !== "transfer-encoding") {
        responseHeaders.set(key, value);
      }
    });

    const responseData = await response.arrayBuffer();

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[API Proxy Error] Failed to proxy request to ${backendUrl}:`, err);
    return NextResponse.json(
      {
        statusCode: 502,
        error: "Bad Gateway",
        message: `Unable to reach Textile ERP API service at ${targetBase}. ${err?.message || ""}`,
        target: backendUrl,
      },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
