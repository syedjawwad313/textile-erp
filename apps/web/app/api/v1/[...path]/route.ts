import { NextRequest, NextResponse } from "next/server";

async function getTargetApiUrl(): Promise<string> {
  // 1. If explicit external API_URL is configured
  if (process.env.API_URL) {
    return process.env.API_URL.trim().replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  }

  // 2. Check if local backend API is running in the container on port 3001
  try {
    const res = await fetch("http://127.0.0.1:3001/ready", {
      signal: AbortSignal.timeout(600),
    });
    if (res.ok) {
      return "http://127.0.0.1:3001";
    }
  } catch {
    // Local API not responding yet or not running
  }

  // 3. Check NEXT_PUBLIC_API_URL if it points to a remote domain
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    !process.env.NEXT_PUBLIC_API_URL.includes("localhost") &&
    !process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1")
  ) {
    return process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  }

  // 4. Default to local container loopback on port 3001
  return "http://127.0.0.1:3001";
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const subPath = (params.path || []).join("/");
  const targetBase = await getTargetApiUrl();
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
