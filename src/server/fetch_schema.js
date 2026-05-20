import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually parse .env file
const envPath = path.join(__dirname, '../../.env');
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      // Remove surrounding quotes if any
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (key === 'VITE_SUPABASE_URL') {
        supabaseUrl = val;
      }
      if (key === 'SUPABASE_SECRET_KEY') {
        supabaseKey = val;
      }
    }
  }
} catch (e) {
  console.error("Failed to read .env file:", e);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

console.log("Fetching from:", supabaseUrl);

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch schema: ${res.status} ${res.statusText}`);
    }
    const schema = await res.json();
    
    console.log("=== DB TABLES AND COLUMNS ===");
    const definitions = schema.definitions;
    if (!definitions) {
      console.log("No definitions found in OpenAPI spec.");
      console.log(schema);
      return;
    }
    for (const [tableName, definition] of Object.entries(definitions)) {
      console.log(`\nTable: ${tableName}`);
      if (definition.properties) {
        for (const [colName, colDef] of Object.entries(definition.properties)) {
          const required = (definition.required || []).includes(colName) ? 'REQUIRED' : 'OPTIONAL';
          console.log(`  - ${colName}: ${colDef.type} (${colDef.format || ''}) [${required}]`);
        }
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
