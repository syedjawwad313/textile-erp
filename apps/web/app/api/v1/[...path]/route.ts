import { NextRequest, NextResponse } from "next/server";

function getTargetApiUrl(): string {
  // 1. If explicit external API_URL is configured
  if (process.env.API_URL) {
    return process.env.API_URL.trim().replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  }

  // 2. Default to internal local API port (starts on 4001 or INTERNAL_API_PORT)
  const internalPort = process.env.INTERNAL_API_PORT || "4001";
  return `http://127.0.0.1:${internalPort}`;
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
