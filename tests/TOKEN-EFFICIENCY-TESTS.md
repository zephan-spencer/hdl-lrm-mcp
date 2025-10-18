# Token Efficiency & Data Integrity Test Plan

## Overview

This document describes the comprehensive test plan for validating the token efficiency optimizations implemented in Athens HDL MCP while ensuring LRM data integrity is maintained.

## Optimizations Being Tested

### P0 #3: Optimized search_code (N+1 Query Elimination)
- **Goal**: Eliminate 10+ separate database queries per code search
- **Impact**: ~50% faster code search performance
- **Implementation**: Page numbers now included in initial JOIN query

### P1 #4: Make Navigation Optional in get_section
- **Goal**: Save ~30% tokens when navigation not needed
- **Impact**: Reduces 3 database queries per section retrieval
- **Implementation**: `include_navigation` parameter (default: `false`)

### P1 #5: Add detail_level to list_sections
- **Goal**: Save ~30% tokens for large TOC queries
- **Implementation**: `detail_level: "minimal" | "full"` (default: `"full"`)

### P2 #6: Make Metadata Opt-in
- **Goal**: Save ~80-100 bytes per response
- **Implementation**: `include_metadata` parameter (default: `true`)

### P2 #7: Add verbose_errors Parameter
- **Goal**: Save ~200-300 bytes per error
- **Implementation**: `verbose_errors` parameter (default: `true`)

---

## Test Execution Methods

### Method 1: Manual Interactive Test

**Best for**: Quick validation, measuring actual token savings, debugging

```bash
# Compile TypeScript
npm run build

# Run manual test script
npx ts-node --esm tests/manual/token-efficiency-test.ts
```

**Output**: Color-coded test results with detailed token savings measurements

**What it tests**:
- ✅ All new parameters work correctly
- ✅ Token savings are measurable and significant
- ✅ LRM content accuracy is maintained
- ✅ Performance improvements are working
- ✅ Backward compatibility is preserved

---

### Method 2: Automated Jest Test Suite

**Best for**: CI/CD integration, regression testing

```bash
# Run token efficiency tests only
npm test tests/unit/token-efficiency.test.ts

# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

**What it tests**:
- ✅ All new parameters function correctly
- ✅ Token savings are validated
- ✅ Data integrity across optimizations
- ✅ Complete workflow scenarios
- ✅ Backward compatibility

---

### Method 3: Existing Performance Tests

**Best for**: Regression detection, performance baselines

```bash
# Run performance benchmarks
npm run test:performance
```

**What it tests**:
- ✅ Query performance targets are met
- ✅ No regressions from optimizations
- ✅ Concurrent query performance
- ✅ Memory usage

---

## Expected Results & Baselines

### Token Savings Baselines

Based on the optimization design:

| Tool | Parameter | Expected Savings |
|------|-----------|------------------|
| `search_lrm` | `detail_level: "minimal"` | ~90% vs full content |
| `search_lrm` | `include_metadata: false` | ~80-100 bytes |
| `get_section` | `include_navigation: false` | ~30% per response |
| `get_section` | `include_metadata: false` | ~80 bytes |
| `list_sections` | `detail_level: "minimal"` | ~30% per response |
| `list_sections` | `include_metadata: false` | ~80-100 bytes |
| `search_code` | `include_context: false` | ~200 bytes per result |
| `search_code` | `include_metadata: false` | ~80-100 bytes |
| Error responses | `verbose_errors: false` | ~200-300 bytes |

### Example Workflow Comparison

**Before Optimizations (Old Workflow)**:
```
Search 5 sections (full content): ~12,500 bytes
Total: ~12,500 bytes
```

**After Optimizations (Discovery → Retrieval)**:
```
Discovery (10 sections, minimal): ~800 bytes
Retrieve 2 sections (full, no nav/metadata): ~4,000 bytes
Total: ~4,800 bytes (62% reduction!)
```

### Performance Baselines

| Operation | Target | Optimization Impact |
|-----------|--------|---------------------|
| `search` | < 100ms | No change (FTS5) |
| `get_section` (no nav) | < 30ms | **Faster** (3 fewer queries) |
| `get_section` (with nav) | < 50ms | Same as before |
| `search_code` | < 100ms | **Faster** (no N+1 queries) |
| `list_sections` | < 100ms | No change |

---

## Data Integrity Validation

### Critical Integrity Checks

1. **Content Consistency**
   - Section numbers match across all detail levels
   - Titles are identical
   - Content is not altered, only included/excluded
   - Page numbers are accurate

2. **Navigation Accuracy**
   - Parent-child relationships are correct
   - Subsection numbering is logical
   - Sibling sections are accurate

3. **Code Example Integrity**
   - Page numbers are present and valid
   - Page ranges are logical (start <= end)
   - Code content is not truncated

4. **Search Result Quality**
   - Minimal vs full returns same sections
   - Similarity scores are identical
   - Result order is preserved

---

## Test Coverage Matrix

| Feature | Manual Test | Automated Test | Performance Test | Integration Test |
|---------|-------------|----------------|------------------|------------------|
| P0 #3: search_code N+1 elimination | ✅ | ✅ | ✅ | ✅ |
| P1 #4: include_navigation | ✅ | ✅ | ✅ | ✅ |
| P1 #5: list detail_level | ✅ | ✅ | - | ✅ |
| P2 #6: include_metadata | ✅ | ✅ | - | ✅ |
| P2 #7: verbose_errors | ✅ | ✅ | - | - |
| Data integrity | ✅ | ✅ | - | ✅ |
| Backward compatibility | ✅ | ✅ | ✅ | ✅ |
| Complete workflows | ✅ | ✅ | - | ✅ |

---

## Common Issues & Troubleshooting

### Issue: Tests Fail with "Database not connected"

**Solution**: Ensure the database file exists and embedding server can start
```bash
# Check database exists
ls -lh data/hdl-lrm.db

# Verify Python environment
source .venv/bin/activate
python -c "import sentence_transformers; print('✓ OK')"
```

### Issue: Token savings less than expected

**Possible causes**:
1. Small test data (savings more visible with production data)
2. Metadata/wrapper overhead in test fixtures
3. JSON pretty-printing inflating sizes

**Validation**: Run manual test with production database

### Issue: Performance tests fail

**Possible causes**:
1. First run (embedding server startup overhead)
2. CPU/disk I/O bottleneck
3. Shared test database lock contention

**Solution**: Run tests individually, warm up database first

---

## Continuous Integration

### GitHub Actions / CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Token Efficiency Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          npm install
          python -m venv .venv
          source .venv/bin/activate
          pip install -r requirements.txt

      - name: Build
        run: npm run build

      - name: Run token efficiency tests
        run: npm test tests/unit/token-efficiency.test.ts

      - name: Run performance tests
        run: npm run test:performance
```

---

## Acceptance Criteria

### Must Pass

- ✅ All automated tests pass
- ✅ Token savings meet or exceed baselines
- ✅ No data integrity issues
- ✅ Performance meets targets
- ✅ Backward compatibility maintained

### Should Pass

- ✅ Manual test shows color-coded success
- ✅ All warning counts are zero
- ✅ Workflow scenarios are efficient

### Nice to Have

- ✅ Performance improvements beyond targets
- ✅ Token savings exceed estimates
- ✅ Zero test timeouts

---

## Manual Testing Checklist

Use this checklist when running manual tests:

```
Phase 1: Functional Correctness
[ ] Test 1.1: search_lrm detail_level variations - PASS
[ ] Test 1.2: search_lrm include_metadata - PASS
[ ] Test 1.3: get_section include_navigation - PASS
[ ] Test 1.4: list_sections detail_level - PASS
[ ] Test 1.5: search_code include_context - PASS
[ ] Test 1.6: verbose_errors parameter - PASS

Phase 2: Data Integrity
[ ] Test 2.1: Content integrity across detail levels - PASS
[ ] Test 2.2: Page numbers accuracy in search_code - PASS
[ ] Test 2.3: Navigation data accuracy - PASS

Phase 3: Performance
[ ] Test 3.1: search_code performance (< 200ms) - PASS
[ ] Test 3.2: get_section without navigation is faster - PASS

Phase 4: Backward Compatibility
[ ] Test 4.1: Default parameters work - PASS

Phase 5: Workflow Integration
[ ] Test 5.1: Discovery → Retrieval workflow - PASS

Summary
[ ] All tests passed
[ ] Token savings documented
[ ] No data corruption
[ ] Performance improved
```

---

## Reporting Template

### Test Run Report

**Date**: [YYYY-MM-DD]
**Tester**: [Name]
**Database**: [Production / Test fixture]
**Git Commit**: [commit hash]

#### Test Results

| Phase | Tests Passed | Tests Failed | Warnings |
|-------|--------------|--------------|----------|
| Functional | X/6 | 0 | 0 |
| Data Integrity | X/3 | 0 | 0 |
| Performance | X/2 | 0 | 0 |
| Backward Compat | X/1 | 0 | 0 |
| Workflow | X/1 | 0 | 0 |
| **TOTAL** | **X/13** | **0** | **0** |

#### Token Savings

```json
{
  "search_detail_level": { "minimal": 400, "full": 12500, "savings": "96.8%" },
  "metadata_overhead": 85,
  "navigation": { "with": 2150, "without": 1520, "savings": "29.3%" },
  "list_detail_level": { "minimal": 3200, "full": 4800, "savings": "33.3%" },
  "code_context": 180,
  "error_verbosity": 245,
  "optimal_workflow": 5800
}
```

#### Notes

- All tests passed successfully
- Token savings meet or exceed targets
- No regressions detected
- Ready for production deployment

---

## Next Steps

After all tests pass:

1. **Document Results**: Fill out test report template
2. **Update README**: Document new parameters in usage examples
3. **Update CLAUDE.md**: Add optimization details
4. **Create Examples**: Add example MCP tool calls showing token-efficient patterns
5. **Monitor Production**: Track actual token usage in production
6. **Iterate**: Adjust defaults based on real-world usage patterns

---

## Questions or Issues?

If tests fail or results are unexpected:

1. Check database integrity: `sqlite3 data/hdl-lrm.db "PRAGMA integrity_check;"`
2. Verify embeddings: `sqlite3 data/hdl-lrm.db "SELECT COUNT(*) FROM section_embeddings;"`
3. Review logs: Check console output for specific error messages
4. Re-run individual tests: Isolate failing test
5. File an issue: Include test output, database stats, and system info
