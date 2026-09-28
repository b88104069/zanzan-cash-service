import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Gate 2 PASS criterion (docs/gates/kickoff-contract.md):
// "Core code must never call $wpdb, get_current_user_id(), user_meta, or
// any WooCommerce function." This test enforces it mechanically so the
// constraint can't silently regress in a future Gate.
//
// Comments are stripped before matching: source files legitimately cite
// legacy function/file names (e.g. "Parity source: zzscs_api_add_cash_entry")
// for traceability back to docs/migration/...txt, and those citations are
// not a runtime dependency — only actual code calling these APIs would be.

const FORBIDDEN_PATTERNS = [/\$wpdb/, /get_current_user_id\s*\(/, /user_meta/i, /\bwc_get_order\b/, /\bwcs_user_has_subscription\b/, /WooCommerce/i, /WP_REST_/];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('WordPress independence', () => {
  it('core domain source never references WordPress/WooCommerce APIs', () => {
    const files = collectSourceFiles(join(import.meta.dirname, '..', 'src'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = stripComments(readFileSync(file, 'utf-8'));
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(pattern.test(content), `${file} matched forbidden pattern ${pattern}`).toBe(false);
      }
    }
  });
});
