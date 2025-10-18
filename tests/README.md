# Athens HDL MCP - Test Suite

Comprehensive test suite for the Athens HDL MCP server covering unit tests, integration tests, performance benchmarks, and token efficiency validation.

## Table of Contents

- [Overview](#overview)
- [Token Efficiency Tests](#token-efficiency-tests) ⭐ **NEW**
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Test Organization](#test-organization)
- [Writing New Tests](#writing-new-tests)
- [Continuous Integration](#continuous-integration)

---

## Overview

The test suite consists of:

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test component interactions and workflows
3. **Performance Tests** - Benchmark query performance and resource usage
4. **Token Efficiency Tests** ⭐ - Validate token optimization features (NEW)
5. **Parser Tests** - Test PDF parsing and data extraction (Python)

### Test Statistics

- **Total Test Files**: 9
- **Test Categories**: 5 (Unit, Integration, Performance, Token Efficiency, Edge Cases)
- **Coverage Target**: 80%+
- **Performance Target**: < 100ms query response time
- **Token Savings Target**: 30-90% reduction with optimizations

---

## Token Efficiency Tests

**Purpose**: Validate that recent token efficiency optimizations work correctly while maintaining LRM data integrity.

### Quick Start

```bash
# Manual interactive test (recommended for validation)
npx ts-node --esm tests/manual/token-efficiency-test.ts

# Automated test suite (for CI/CD)
npm test tests/unit/token-efficiency.test.ts
```

### What's Tested

✅ **P0 #3**: search_code N+1 query elimination (50% performance improvement)
✅ **P1 #4**: `include_navigation` parameter (30% token savings)
✅ **P1 #5**: `detail_level` for list_sections (30% token savings)
✅ **P2 #6**: `include_metadata` parameter (80-100 bytes per response)
✅ **P2 #7**: `verbose_errors` parameter (200-300 bytes per error)

### Expected Token Savings

| Optimization | Savings |
|-------------|---------|
| search_lrm `detail_level: "minimal"` | 90% vs full content |
| get_section `include_navigation: false` | ~30% per response |
| list_sections `detail_level: "minimal"` | ~30% per response |
| All tools `include_metadata: false` | ~80-100 bytes |
| Errors `verbose_errors: false` | ~200-300 bytes |
| **Discovery → Retrieval workflow** | **62% vs old approach** |

### Full Documentation

See [TOKEN-EFFICIENCY-TESTS.md](./TOKEN-EFFICIENCY-TESTS.md) for:
- Complete test plan
- Performance baselines
- Data integrity checks
- Reporting templates

---

## Setup

### Install Dependencies

#### TypeScript/Node.js Tests

```bash
npm install
```

This will install:
- `jest` - Test runner
- `ts-jest` - TypeScript support for Jest
- `@types/jest` - Type definitions

#### Python Tests

```bash
pip install -r requirements-dev.txt
```

This will install:
- `pytest` - Test runner
- `pytest-cov` - Coverage reporting
- `pytest-mock` - Mocking support

### Build Project

```bash
npm run build
```

---

## Running Tests

### All Tests

```bash
# Run all TypeScript tests
npm test

# Run all Python tests
npm run test:python
```

### By Category

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Performance benchmarks only
npm run test:performance
```

### Watch Mode

```bash
# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

### With Coverage

```bash
# Run tests with coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

### Python Tests

```bash
# Run Python parser tests
npm run test:python

# Or directly with pytest
pytest src/parser/tests/

# With coverage
pytest --cov=src/parser --cov-report=html src/parser/tests/
```

### Individual Test Files

```bash
# Run specific test file
npx jest tests/unit/database.test.ts

# Run specific test suite
npx jest --testNamePattern="search()"

# Run specific test
npx jest --testNamePattern="should find sections matching query"
```

---

## Test Coverage

### Coverage Requirements

- **Overall**: 80%+ line coverage
- **Database Layer**: 90%+ coverage
- **Tool Handlers**: 85%+ coverage
- **Parser**: 75%+ coverage

### Viewing Coverage

After running `npm run test:coverage`:

```bash
# Open HTML report
open coverage/index.html

# View terminal summary
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/` - TypeScript coverage
- `htmlcov/` - Python coverage

---

## Test Organization

```
tests/
├── unit/                         # Unit tests
│   ├── database.test.ts          # Database layer tests
│   ├── tools.test.ts             # MCP tool handler tests
│   └── token-efficiency.test.ts  # Token optimization tests ⭐
├── integration/                  # Integration tests
│   ├── mcp-protocol.test.ts      # MCP protocol compliance
│   └── e2e.test.ts               # End-to-end workflows
├── performance/                  # Performance benchmarks
│   └── benchmark.test.ts         # Query performance tests
├── manual/                       # Manual test scripts ⭐
│   └── token-efficiency-test.ts  # Interactive validation
├── edge-cases/                   # Edge case tests (future)
├── fixtures/                     # Test data and fixtures
│   └── test-data.ts              # Shared test data
├── setup.ts                      # Test utilities and setup
├── README.md                     # This file
└── TOKEN-EFFICIENCY-TESTS.md     # Token efficiency test plan ⭐

src/parser/tests/                 # Python parser tests
└── test_parser.py                # Parser unit tests
```

---

## Test Coverage Details

### Unit Tests - Database Layer (`tests/unit/database.test.ts`)

Tests all database operations:
- ✅ Connection/disconnection
- ✅ Full-text search with FTS5
- ✅ Section retrieval
- ✅ Hierarchical navigation
- ✅ Code example search
- ✅ Table retrieval
- ✅ Statistics queries
- ✅ Error handling

**Run**: `npx jest tests/unit/database.test.ts`

### Unit Tests - Tool Handlers (`tests/unit/tools.test.ts`)

Tests MCP tool implementations:
- ✅ Response formatting for all 5 tools
- ✅ Parameter validation
- ✅ Default value handling
- ✅ Language validation
- ✅ Error responses
- ✅ Edge cases (empty results, invalid inputs)

**Run**: `npx jest tests/unit/tools.test.ts`

### Integration Tests - MCP Protocol (`tests/integration/mcp-protocol.test.ts`)

Tests MCP protocol compliance:
- ✅ Server initialization
- ✅ Tool listing
- ✅ Tool execution
- ✅ Response format compliance
- ✅ Concurrent request handling
- ✅ Error propagation

**Run**: `npx jest tests/integration/mcp-protocol.test.ts`

### Integration Tests - End-to-End (`tests/integration/e2e.test.ts`)

Tests complete workflows:
- ✅ Search → Format workflow
- ✅ Section retrieval with code
- ✅ Hierarchical navigation
- ✅ Code search with context
- ✅ Table retrieval
- ✅ Multi-query workflows
- ✅ Data consistency
- ✅ Error recovery

**Run**: `npx jest tests/integration/e2e.test.ts`

### Performance Tests (`tests/performance/benchmark.test.ts`)

Benchmarks system performance:
- ✅ Query response time (< 100ms target)
- ✅ Batch query performance
- ✅ Concurrent query handling
- ✅ Complex FTS queries
- ✅ Memory usage
- ✅ Stress testing (100 mixed operations)

**Run**: `npx jest tests/performance/benchmark.test.ts`

### Parser Tests (`src/parser/tests/test_parser.py`)

Tests Python PDF parser:
- ✅ Initialization and validation
- ✅ Section extraction
- ✅ Code example detection
- ✅ Table extraction
- ✅ Duplicate section handling
- ✅ Database storage operations
- ✅ File hash calculation
- ✅ Hierarchical section parsing

**Run**: `pytest src/parser/tests/`

---

## Writing New Tests

### TypeScript Tests

```typescript
import { HDLDatabase } from '../../src/storage/database.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';

describe('My New Test Suite', () => {
    let db: HDLDatabase;

    beforeAll(async () => {
        await setupTestDatabase();
    });

    beforeEach(async () => {
        db = new HDLDatabase(TEST_DB_PATH);
        await db.connect();
    });

    afterEach(async () => {
        await db.close();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    test('should do something', async () => {
        // Your test here
        expect(true).toBe(true);
    });
});
```

### Python Tests

```python
import pytest
from parse_lrm import LRMParser

class TestMyFeature:
    def test_something(self):
        # Your test here
        assert True
```

---

## Best Practices

### Test Organization

1. **Arrange-Act-Assert** pattern
2. Clear, descriptive test names
3. One assertion per test (when possible)
4. Use test fixtures for common setup

### Test Data

- Use `tests/fixtures/test-data.ts` for shared test data
- Keep test data minimal but representative
- Use edge case data for boundary testing

### Performance Tests

- Set realistic performance targets
- Log actual timings for monitoring
- Test both sequential and concurrent operations
- Include memory usage checks

### Mocking

- Mock external dependencies (PDFs, network, etc.)
- Don't mock the system under test
- Use meaningful mock data

---

## Continuous Integration

### GitHub Actions (Example)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - uses: actions/setup-python@v4
        with:
          python-version: 3.9

      - run: npm install
      - run: npm run build
      - run: npm run test:coverage

      - run: pip install -r requirements-dev.txt
      - run: npm run test:python
```

---

## Troubleshooting

### Tests Fail to Connect to Database

```bash
# Ensure database is initialized
npm run init-db

# Or populate test data
node populate-test-data.js
```

### Jest Cannot Find Modules

```bash
# Rebuild TypeScript
npm run build

# Clear Jest cache
npx jest --clearCache
```

### Python Tests Fail

```bash
# Check Python dependencies
pip install -r requirements-dev.txt

# Verify Python version (3.9+)
python --version
```

### Performance Tests Timeout

```bash
# Increase Jest timeout (in jest.config.js)
testTimeout: 30000

# Or for specific test
test('name', async () => { ... }, 60000)
```

---

## Test Metrics

### Current Coverage

Run `npm run test:coverage` to see current coverage metrics.

Target coverage by component:
- **Database Layer**: 90%+
- **MCP Server**: 85%+
- **Tool Handlers**: 85%+
- **Parser**: 75%+

### Performance Baselines

| Operation | Target | Current |
|-----------|--------|---------|
| Search | < 100ms | Run tests to measure |
| Get Section | < 50ms | Run tests to measure |
| List Sections | < 100ms | Run tests to measure |
| Search Code | < 100ms | Run tests to measure |
| Get Tables | < 50ms | Run tests to measure |

Run `npm run test:performance` to see current performance metrics.

---

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure tests pass locally
3. Maintain > 80% coverage
4. Update this README if adding new test categories
5. Run all tests before submitting PR

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Pytest Documentation](https://docs.pytest.org/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Project Specifications](../SPECIFICATIONS_V2.md)

---

**Last Updated**: 2025-09-30
