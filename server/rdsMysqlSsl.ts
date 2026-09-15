import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PEM = path.join(path.dirname(fileURLToPath(import.meta.url)), "certs", "rds-global-bundle.pem");

/** TLS for Amazon RDS MySQL (official CA bundle). */
export function rdsMysqlSsl(): { rejectUnauthorized: true; ca: string } {
  return {
    rejectUnauthorized: true,
    ca: fs.readFileSync(PEM, "utf8"),
  };
}
