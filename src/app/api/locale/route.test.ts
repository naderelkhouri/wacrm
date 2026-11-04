import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/locale", () => {
  it("sets supported locale 'en' in cookie", async () => {
    const req = new Request("http://localhost:3000/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.locale).toBe("en");

    const cookieHeader = res.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("NEXT_LOCALE=en");
    expect(cookieHeader.toLowerCase()).toContain("path=/");
  });

  it("normalizes 'pt' to 'pt-BR'", async () => {
    const req = new Request("http://localhost:3000/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "pt" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.locale).toBe("pt-BR");

    const cookieHeader = res.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("NEXT_LOCALE=pt-BR");
  });

  it("falls back to default locale for unsupported or deleted locales like 'ko'", async () => {
    const req = new Request("http://localhost:3000/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "ko" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.locale).toBe("pt-BR");

    const cookieHeader = res.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("NEXT_LOCALE=pt-BR");
  });
});
