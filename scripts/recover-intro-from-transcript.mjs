import fs from "fs";
import path from "path";

const jsonl =
  "C:/Users/pudum/.cursor/projects/c-Users-pudum-OneDrive-Desktop-Cursor-Projects-USA-Projects-Circle-Prospecting-AI/agent-transcripts/b62b4c39-f301-4687-9a6a-49c377346701/b62b4c39-f301-4687-9a6a-49c377346701.jsonl";
const outDir = path.resolve("scripts/.recovery-transcript");
fs.mkdirSync(outDir, { recursive: true });

const fileState = new Map();

function norm(p) {
  const s = String(p).replace(/\\/g, "/");
  const idx = s.toLowerCase().lastIndexOf("circle-prospecting-ai/");
  return idx >= 0 ? s.slice(idx + "circle-prospecting-ai/".length) : s;
}

let lineNo = 0;
for (const line of fs.readFileSync(jsonl, "utf8").split("\n")) {
  lineNo++;
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const item of content) {
    if (item?.type !== "tool_use") continue;
    const input = item.input || {};
    const p = norm(input.path || "");
    if (!p) continue;
    if (item.name === "Write" && input.contents != null) {
      fileState.set(p, { contents: input.contents, lineNo, failed: [] });
    } else if (
      item.name === "StrReplace" &&
      input.old_string != null &&
      input.new_string != null
    ) {
      const cur = fileState.get(p);
      if (cur && cur.contents.includes(input.old_string)) {
        cur.contents = cur.contents.replace(input.old_string, input.new_string);
        cur.lineNo = lineNo;
      } else if (cur) {
        cur.failed.push({ lineNo, oldPreview: input.old_string.slice(0, 80) });
      }
    }
  }
}

const introPattern =
  /intro|IntroCampaign|AgentPhone|App\.tsx$|intro-campaign\.css$/i;

for (const [k, v] of [...fileState.entries()].sort()) {
  if (!introPattern.test(k)) continue;
  const safe = k.replace(/[/:]/g, "__");
  fs.writeFileSync(path.join(outDir, safe), v.contents);
  console.log(
    JSON.stringify({
      file: k,
      chars: v.contents.length,
      line: v.lineNo,
      failedReplacements: v.failed.length,
    }),
  );
}
