import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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
//
// Gate 3 adds one deliberate, narrow exception: the WooCommerce Adapter
// itself (docs/architecture/auth-entitlement-abstraction.md). That file is
// the ONLY place WooCommerce may be referenced in code, not just comments —
// everything else, core domain included, must go through the
// EntitlementService interface instead.

const FORBIDDEN_PATTERNS = [/\$wpdb/, /get_current_user_id\s*\(/, /user_meta/i, /\bwc_get_order\b/, /\bwcs_user_has_subscription\b/, /WooCommerce/i, /WP_REST_/];

const ADAPTER_ALLOWLIST = new Set(['infra/entitlement/WooCommerceEntitlementAdapter.ts']);

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
  const srcDir = join(import.meta.dirname, '..', 'src');
  const files = collectSourceFiles(srcDir);

  it('core domain source never references WordPress/WooCommerce APIs (except the designated adapter)', () => {
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const relPath = relative(srcDir, file).split(sep).join('/');
      if (ADAPTER_ALLOWLIST.has(relPath)) continue;

      const content = stripComments(readFileSync(file, 'utf-8'));
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(pattern.test(content), `${file} matched forbidden pattern ${pattern}`).toBe(false);
      }
    }
  });

  it('the domain layer never imports the WooCommerce adapter directly', () => {
    const domainFiles = files.filter((f) => relative(srcDir, f).split(sep)[0] === 'domain');
    for (const file of domainFiles) {
      const content = stripComments(readFileSync(file, 'utf-8'));
      expect(content.includes('WooCommerceEntitlementAdapter'), `${file} imports the adapter directly`).toBe(false);
    }
  });
});
