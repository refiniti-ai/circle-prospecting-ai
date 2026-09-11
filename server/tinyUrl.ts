import axios from "axios";

type TinyUrlCreateResponse = {
  data?: {
    tiny_url?: string;
    url?: string;
  };
  errors?: unknown[];
};

/** Shorten via TinyURL API when TINYURL_API_TOKEN is set; otherwise return long URL. */
export async function shortenWithTinyUrl(longUrl: string): Promise<{ url: string; shortened: boolean }> {
  const token = process.env.TINYURL_API_TOKEN?.trim();
  if (!token) return { url: longUrl, shortened: false };

  const domain = process.env.TINYURL_DOMAIN?.trim() || "tinyurl.com";
  try {
    const res = await axios.post<TinyUrlCreateResponse>(
      "https://api.tinyurl.com/create",
      { url: longUrl, domain },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15_000,
        validateStatus: () => true,
      }
    );
    if (res.status >= 200 && res.status < 300) {
      const tiny = res.data?.data?.tiny_url?.trim() || res.data?.data?.url?.trim();
      if (tiny?.startsWith("http")) return { url: tiny, shortened: true };
    }
    console.warn("[tinyurl] create failed", res.status, JSON.stringify(res.data).slice(0, 300));
  } catch (e) {
    console.warn("[tinyurl] create error", e instanceof Error ? e.message : e);
  }
  return { url: longUrl, shortened: false };
}
