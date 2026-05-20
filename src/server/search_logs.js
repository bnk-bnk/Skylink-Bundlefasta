import fs from 'fs';
import path from 'path';

const logDirs = [
  'C:/Users/ADMIN/.gemini/antigravity/brain/02ae5b45-36cb-44fb-8c92-8912e3d71f61/.system_generated/logs/transcript.jsonl',
  'C:/Users/ADMIN/.gemini/antigravity/brain/b83d8a6a-7d01-4663-a91f-779e422ff777/.system_generated/logs/transcript.jsonl'
];

for (const logPath of logDirs) {
  if (fs.existsSync(logPath)) {
    console.log("Found log:", logPath);
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('sql') || line.toLowerCase().includes('password') || line.toLowerCase().includes('postgres')) {
        try {
          const obj = JSON.parse(line);
          console.log(`Step ${obj.step_index} (${obj.type}):`);
          if (obj.tool_calls) {
            console.log("  Tool calls:", JSON.stringify(obj.tool_calls).substring(0, 300));
          }
          if (obj.content) {
            console.log("  Content snippet:", obj.content.substring(0, 300));
          }
        } catch {
          console.log("  Line:", line.substring(0, 200));
        }
      }
    }
  } else {
    console.log("Log not found:", logPath);
  }
}
