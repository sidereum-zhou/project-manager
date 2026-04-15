# Quality Scanner False Positive Reduction - Round 1

**Date**: 2026-04-15
**Scope**: Fix unused-export and complexity false positives in `electron/core/quality-scanner.ts`

## Problem

The quality scanner reports too many false positives across multiple dimensions:

1. **unused-export**: Exports used within the same file (e.g., as method return types) are flagged as unused
2. **unused-export**: Path aliases like `@/` are not resolved, so imports using aliases don't count
3. **unused-export**: Type/interface exports used via type inference in other files are flagged
4. **complexity**: CatchClause always counted due to `|| true` bug (line 245)
5. **complexity**: Chained logical operators (`a && b && c`) each count as +1 instead of +1 for the whole chain

## Design

### A. unused-export: Same-file reference detection

**Current**: Only cross-file `import` statements are tracked in `importedSymbols`.

**Fix**: Before reporting an unused export, check if the symbol is referenced within its own source file (outside its declaration). If any non-declaration reference exists, skip reporting.

Implementation:
- After collecting `importedSymbols`, add a new method `isUsedInSameFile(sf: SourceFile, symbolName: string): boolean`
- Walk the AST of the source file looking for identifier references that match the symbol name
- Exclude the export declaration node itself and any re-export of the same name
- For type/interface exports specifically, also check type reference positions (e.g., `Promise<X>`, `X | Y`)

### B. unused-export: Path alias resolution

**Current**: `resolveImport()` only handles relative paths (`./`, `../`) and `node_modules`.

**Fix**: Read `tsconfig.json` `compilerOptions.paths` and resolve aliases.

Implementation:
- In constructor or `scan()`, parse `tsconfig.json` for `paths` mappings (e.g., `@/*` → `src/*`)
- Add a `resolveAlias(moduleSpecifier: string): string | null` method
- Integrate into `resolveImport()` as a fallback: if relative resolution fails, try alias resolution

### C. complexity: Fix CatchClause counting

**Current**: Line 245 has `kind !== SyntaxKind.CatchClause || true` which always evaluates to true — catch clauses are always counted.

**Fix**: Remove catch clauses from complexity counting entirely. This aligns with industry practice (most complexity tools don't count catch as a branch).

Implementation:
- Remove `SyntaxKind.CatchClause` from `COMPLEXITY_BRANCH_KINDS` set

### D. complexity: Chained logical operator merging

**Current**: Each `&&`, `||`, `??` operator increments complexity by +1. In `a && b && c`, the AST nests as `BinaryExpression(BinaryExpression(a, &&, b), &&, c)`, resulting in +2.

**Fix**: Count a chain of consecutive logical operators as +1 total.

Implementation:
- Replace the BinaryExpression handling in `measureComplexity()` with a chain detection approach
- When a logical operator is found, traverse upward and downward to check if it's part of a chain
- Only count +1 for the outermost (root) operator in the chain
- Helper: `isLogicalChainRoot(node): boolean` — true if the parent is not also a logical BinaryExpression

## Files Changed

- `electron/core/quality-scanner.ts` — all changes in this single file
- No IPC, type, or UI changes required

## Round 2 (Future)

- Duplicate detection: improve AST fingerprinting, raise minimum line threshold
- Additional scan dimensions if needed
