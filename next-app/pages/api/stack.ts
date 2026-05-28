import type { NextApiRequest, NextApiResponse } from "next";

type Data = { ok: boolean; router: string };

export default function handler(_req: NextApiRequest, res: NextApiResponse<Data>) {
  res.status(200).json({ ok: true, router: "pages-api" });
}
