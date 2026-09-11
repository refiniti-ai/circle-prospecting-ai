import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, "../public/marketing/homepage-campaign-checkout.png");

const candidates = [
  process.argv[2],
  path.join(
    process.env.USERPROFILE || "",
    ".cursor/projects/c-Users-pudum-OneDrive-Desktop-Cursor-Projects-USA-Projects-Circle-Prospecting-AI/assets/c__Users_pudum_AppData_Roaming_Cursor_User_workspaceStorage_548c8088a09cdd8d59795e1b9f8f603f_images_be9132e7-b49f-4044-a904-0fd4afba12e9-890d1ea9-d361-4f1f-8a3c-dea4222bf29c.png"
  ),
].filter(Boolean);

let src = candidates.find((p) => p && fs.existsSync(p));
if (!src) {
  console.error("Source screenshot not found. Usage: node scripts/copy-homepage-checkout-preview.mjs <path-to-png>");
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest} (${fs.statSync(dest).size} bytes)`);
