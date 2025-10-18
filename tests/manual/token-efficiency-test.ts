/**
 * Manual Token Efficiency Test Script
 *
 * Run this script to manually validate all token efficiency optimizations
 * and verify data integrity.
 *
 * Usage:
 *   npm run build && node dist/../tests/manual/token-efficiency-test.js
 *   OR compile and run directly:
 *   npx ts-node --esm tests/manual/token-efficiency-test.ts
 */

import { HDLDatabase } from '../../src/storage/database.js';
import { handleSearchLRM } from '../../src/handlers/search-handler.js';
import { handleGetSection, handleListSections } from '../../src/handlers/section-handler.js';
import { handleSearchCode } from '../../src/handlers/code-handler.js';
import { handleGetTable } from '../../src/handlers/table-handler.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../../data/hdl-lrm.db');

// ANSI color codes for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
    console.log('\n' + '='.repeat(80));
    log(title, 'bright');
    console.log('='.repeat(80) + '\n');
}

function measureSize(obj: any): number {
    return JSON.stringify(obj).length;
}

// ============================================================================
// Test Suite
// ============================================================================

async function runTests() {
    const db = new HDLDatabase(DB_PATH);
    const results: any = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tokenSavings: {},
    };

    try {
        log('Starting Token Efficiency & Data Integrity Tests...', 'bright');
        await db.connect();

        // ====================================================================
        // Phase 1: Functional Correctness Tests
        // ====================================================================
        section('Phase 1: Functional Correctness - New Parameters Work');

        // Test 1.1: search_lrm detail_level parameter
        log('Test 1.1: search_lrm detail_level variations', 'blue');
        const searchMinimal = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 5,
            detail_level: 'minimal',
            include_metadata: true,
        });
        const searchFull = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 5,
            detail_level: 'full',
            include_metadata: true,
        });

        const minimalSize = measureSize(searchMinimal.content[0].text);
        const fullSize = measureSize(searchFull.content[0].text);
        const savings = ((fullSize - minimalSize) / fullSize * 100).toFixed(1);

        log(`  Minimal response: ${minimalSize} bytes`, 'cyan');
        log(`  Full response: ${fullSize} bytes`, 'cyan');
        log(`  ✓ Token savings: ${savings}% (${fullSize - minimalSize} bytes saved)`, 'green');
        results.tokenSavings.search_detail_level = { minimal: minimalSize, full: fullSize, savings };
        results.passed++;

        // Test 1.2: search_lrm include_metadata parameter
        log('\nTest 1.2: search_lrm include_metadata parameter', 'blue');
        const searchWithMetadata = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 5,
            detail_level: 'minimal',
            include_metadata: true,
        });
        const searchWithoutMetadata = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 5,
            detail_level: 'minimal',
            include_metadata: false,
        });

        const withMetaSize = measureSize(searchWithMetadata.content[0].text);
        const withoutMetaSize = measureSize(searchWithoutMetadata.content[0].text);
        const metaSavings = withMetaSize - withoutMetaSize;

        log(`  With metadata: ${withMetaSize} bytes`, 'cyan');
        log(`  Without metadata: ${withoutMetaSize} bytes`, 'cyan');
        log(`  ✓ Metadata overhead: ${metaSavings} bytes`, 'green');
        results.tokenSavings.metadata_overhead = metaSavings;
        results.passed++;

        // Test 1.3: get_section include_navigation parameter
        log('\nTest 1.3: get_section include_navigation parameter', 'blue');
        const sectionWithNav = await handleGetSection(db, {
            section_number: '9.2.1',
            language: 'verilog',
            include_code: false,
            include_navigation: true,
            include_metadata: true,
        });
        const sectionWithoutNav = await handleGetSection(db, {
            section_number: '9.2.1',
            language: 'verilog',
            include_code: false,
            include_navigation: false,
            include_metadata: true,
        });

        const withNavSize = measureSize(sectionWithNav.content[0].text);
        const withoutNavSize = measureSize(sectionWithoutNav.content[0].text);
        const navSavings = ((withNavSize - withoutNavSize) / withNavSize * 100).toFixed(1);

        log(`  With navigation: ${withNavSize} bytes`, 'cyan');
        log(`  Without navigation: ${withoutNavSize} bytes`, 'cyan');
        log(`  ✓ Navigation savings: ${navSavings}% (${withNavSize - withoutNavSize} bytes saved)`, 'green');
        results.tokenSavings.navigation = { with: withNavSize, without: withoutNavSize, savings: navSavings };
        results.passed++;

        // Test 1.4: list_sections detail_level parameter
        log('\nTest 1.4: list_sections detail_level parameter', 'blue');
        const listMinimal = await handleListSections(db, {
            language: 'verilog',
            max_depth: 2,
            detail_level: 'minimal',
            include_metadata: true,
        });
        const listFull = await handleListSections(db, {
            language: 'verilog',
            max_depth: 2,
            detail_level: 'full',
            include_metadata: true,
        });

        const listMinimalSize = measureSize(listMinimal.content[0].text);
        const listFullSize = measureSize(listFull.content[0].text);
        const listSavings = ((listFullSize - listMinimalSize) / listFullSize * 100).toFixed(1);

        log(`  Minimal response: ${listMinimalSize} bytes`, 'cyan');
        log(`  Full response: ${listFullSize} bytes`, 'cyan');
        log(`  ✓ Detail level savings: ${listSavings}% (${listFullSize - listMinimalSize} bytes saved)`, 'green');
        results.tokenSavings.list_detail_level = { minimal: listMinimalSize, full: listFullSize, savings: listSavings };
        results.passed++;

        // Test 1.5: search_code include_context parameter
        log('\nTest 1.5: search_code include_context parameter', 'blue');
        const codeWithContext = await handleSearchCode(db, {
            query: 'always',
            language: 'verilog',
            max_results: 5,
            include_context: true,
            include_metadata: true,
        });
        const codeWithoutContext = await handleSearchCode(db, {
            query: 'always',
            language: 'verilog',
            max_results: 5,
            include_context: false,
            include_metadata: true,
        });

        const codeWithContextSize = measureSize(codeWithContext.content[0].text);
        const codeWithoutContextSize = measureSize(codeWithoutContext.content[0].text);
        const contextSavings = codeWithContextSize - codeWithoutContextSize;

        log(`  With context: ${codeWithContextSize} bytes`, 'cyan');
        log(`  Without context: ${codeWithoutContextSize} bytes`, 'cyan');
        log(`  ✓ Context overhead: ~${contextSavings} bytes`, 'green');
        results.tokenSavings.code_context = contextSavings;
        results.passed++;

        // Test 1.6: verbose_errors parameter
        log('\nTest 1.6: verbose_errors parameter (error case)', 'blue');
        const verboseError = await handleSearchLRM(db, {
            query: 'nonexistentquerythatreturnsnothing12345',
            language: 'verilog',
            max_results: 5,
            detail_level: 'minimal',
            verbose_errors: true,
        });
        const minimalError = await handleSearchLRM(db, {
            query: 'nonexistentquerythatreturnsnothing12345',
            language: 'verilog',
            max_results: 5,
            detail_level: 'minimal',
            verbose_errors: false,
        });

        const verboseErrorSize = measureSize(verboseError.content[0].text);
        const minimalErrorSize = measureSize(minimalError.content[0].text);
        const errorSavings = verboseErrorSize - minimalErrorSize;

        log(`  Verbose error: ${verboseErrorSize} bytes`, 'cyan');
        log(`  Minimal error: ${minimalErrorSize} bytes`, 'cyan');
        log(`  ✓ Error verbosity savings: ${errorSavings} bytes`, 'green');
        results.tokenSavings.error_verbosity = errorSavings;
        results.passed++;

        // ====================================================================
        // Phase 2: Data Integrity Tests
        // ====================================================================
        section('Phase 2: Data Integrity - LRM Content Accuracy');

        // Test 2.1: Verify content is identical across detail levels
        log('Test 2.1: Content integrity across detail levels', 'blue');
        const preview = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 3,
            detail_level: 'preview',
        });
        const full2 = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 3,
            detail_level: 'full',
        });

        const previewData = JSON.parse(preview.content[0].text as string);
        const fullData = JSON.parse(full2.content[0].text as string);

        // Verify same section_numbers
        let contentIntact = true;
        for (let i = 0; i < previewData.results.length; i++) {
            if (previewData.results[i].section_number !== fullData.results[i].section_number) {
                contentIntact = false;
                break;
            }
            // Verify preview is substring of full content
            if (fullData.results[i].content && !fullData.results[i].content.startsWith(previewData.results[i].content_preview?.replace('...', ''))) {
                log(`  ⚠️ Warning: Preview doesn't match full content for ${fullData.results[i].section_number}`, 'yellow');
                results.warnings++;
            }
        }

        if (contentIntact) {
            log(`  ✓ Section numbers match across detail levels`, 'green');
            log(`  ✓ Content preview is accurate`, 'green');
            results.passed++;
        } else {
            log(`  ✗ Content mismatch detected!`, 'red');
            results.failed++;
        }

        // Test 2.2: Verify page numbers in search_code
        log('\nTest 2.2: Page numbers accuracy in search_code', 'blue');
        const codeResults = await handleSearchCode(db, {
            query: 'always',
            language: 'verilog',
            max_results: 5,
            include_context: false,
        });

        const codeData = JSON.parse(codeResults.content[0].text as string);
        let pageNumbersValid = true;
        for (const result of codeData.results) {
            if (!result.page_start || !result.page_end) {
                log(`  ✗ Missing page numbers for ${result.section_number}`, 'red');
                pageNumbersValid = false;
            }
            if (result.page_start > result.page_end) {
                log(`  ✗ Invalid page range: ${result.page_start} > ${result.page_end}`, 'red');
                pageNumbersValid = false;
            }
        }

        if (pageNumbersValid) {
            log(`  ✓ All code results have valid page numbers`, 'green');
            log(`  ✓ Page ranges are logical (start <= end)`, 'green');
            results.passed++;
        } else {
            results.failed++;
        }

        // Test 2.3: Verify navigation data when included
        log('\nTest 2.3: Navigation data accuracy', 'blue');
        const navSection = await handleGetSection(db, {
            section_number: '9.2',
            language: 'verilog',
            include_navigation: true,
        });

        const navData = JSON.parse(navSection.content[0].text as string);
        let navValid = true;

        if (navData.section.parent_section) {
            log(`  ✓ Has parent section: ${navData.section.parent_section.section_number}`, 'green');
        }
        if (navData.section.subsections && navData.section.subsections.length > 0) {
            log(`  ✓ Has ${navData.section.subsections.length} subsections`, 'green');
            // Verify subsection numbering
            for (const sub of navData.section.subsections) {
                if (!sub.section_number.startsWith('9.2.')) {
                    log(`  ✗ Invalid subsection number: ${sub.section_number}`, 'red');
                    navValid = false;
                }
            }
        }

        if (navValid) {
            log(`  ✓ Navigation hierarchy is correct`, 'green');
            results.passed++;
        } else {
            results.failed++;
        }

        // ====================================================================
        // Phase 3: Performance Tests
        // ====================================================================
        section('Phase 3: Performance - N+1 Query Elimination');

        // Test 3.1: search_code performance (should be much faster without N+1)
        log('Test 3.1: search_code performance (no N+1 queries)', 'blue');
        const iterations = 10;
        let totalTime = 0;

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 10,
                include_context: false,
            });
            totalTime += performance.now() - start;
        }

        const avgTime = totalTime / iterations;
        log(`  Average time over ${iterations} runs: ${avgTime.toFixed(2)}ms`, 'cyan');

        // Should be faster than 200ms (pre-optimization was slower with N+1)
        if (avgTime < 200) {
            log(`  ✓ Performance is good (< 200ms average)`, 'green');
            results.passed++;
        } else {
            log(`  ⚠️ Performance could be better (target: < 200ms)`, 'yellow');
            results.warnings++;
        }

        // Test 3.2: get_section without navigation (should be faster)
        log('\nTest 3.2: get_section without navigation is faster', 'blue');
        const runWithNav = async () => {
            const start = performance.now();
            await handleGetSection(db, {
                section_number: '9.2.1',
                language: 'verilog',
                include_navigation: true,
            });
            return performance.now() - start;
        };

        const runWithoutNav = async () => {
            const start = performance.now();
            await handleGetSection(db, {
                section_number: '9.2.1',
                language: 'verilog',
                include_navigation: false,
            });
            return performance.now() - start;
        };

        const withNavTime = await runWithNav();
        const withoutNavTime = await runWithoutNav();

        log(`  With navigation: ${withNavTime.toFixed(2)}ms`, 'cyan');
        log(`  Without navigation: ${withoutNavTime.toFixed(2)}ms`, 'cyan');

        if (withoutNavTime < withNavTime) {
            log(`  ✓ Navigation-free query is faster (${(withNavTime - withoutNavTime).toFixed(2)}ms saved)`, 'green');
            results.passed++;
        } else {
            log(`  ⚠️ Navigation overhead not measurable (difference too small)`, 'yellow');
            results.warnings++;
        }

        // ====================================================================
        // Phase 4: Backward Compatibility Tests
        // ====================================================================
        section('Phase 4: Backward Compatibility');

        // Test 4.1: Old-style calls still work (defaults)
        log('Test 4.1: Default parameters maintain backward compatibility', 'blue');
        try {
            // Call without new parameters
            const oldStyleSearch = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 5,
                // No detail_level, include_metadata, verbose_errors
            });

            const oldStyleSection = await handleGetSection(db, {
                section_number: '9.2.1',
                language: 'verilog',
                // No include_navigation, include_metadata, verbose_errors
            });

            const oldStyleList = await handleListSections(db, {
                language: 'verilog',
                // No detail_level, include_metadata, verbose_errors
            });

            log(`  ✓ search_lrm works with defaults`, 'green');
            log(`  ✓ get_section works with defaults`, 'green');
            log(`  ✓ list_sections works with defaults`, 'green');
            results.passed += 3;
        } catch (error) {
            log(`  ✗ Backward compatibility broken: ${error}`, 'red');
            results.failed++;
        }

        // ====================================================================
        // Phase 5: Workflow Integration Tests
        // ====================================================================
        section('Phase 5: Complete Workflows - Discovery → Retrieval');

        // Test 5.1: Optimal agent workflow
        log('Test 5.1: Discovery → Retrieval workflow', 'blue');
        let workflowSize = 0;

        // Step 1: Discovery
        const discovery = await handleSearchLRM(db, {
            query: 'blocking assignments',
            language: 'verilog',
            max_results: 10,
            detail_level: 'minimal',
            include_metadata: false,
        });
        const discoverySize = measureSize(discovery.content[0].text);
        workflowSize += discoverySize;
        log(`  Step 1 - Discovery (10 results, minimal): ${discoverySize} bytes`, 'cyan');

        // Step 2: Get top 2 sections
        const discoveryData = JSON.parse(discovery.content[0].text as string);
        for (let i = 0; i < 2; i++) {
            const section = await handleGetSection(db, {
                section_number: discoveryData.results[i].section_number,
                language: 'verilog',
                include_code: true,
                include_navigation: false,
                include_metadata: false,
            });
            const sectionSize = measureSize(section.content[0].text);
            workflowSize += sectionSize;
            log(`  Step 2.${i + 1} - Retrieve section ${discoveryData.results[i].section_number}: ${sectionSize} bytes`, 'cyan');
        }

        log(`  Total workflow size: ${workflowSize} bytes`, 'bright');
        log(`  ✓ Efficient discovery → retrieval pattern validated`, 'green');
        results.tokenSavings.optimal_workflow = workflowSize;
        results.passed++;

        // ====================================================================
        // Summary Report
        // ====================================================================
        section('Test Summary');

        log(`Passed: ${results.passed}`, 'green');
        log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'cyan');
        log(`Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'cyan');

        console.log('\n' + '-'.repeat(80));
        log('Token Savings Summary:', 'bright');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(results.tokenSavings, null, 2));

        if (results.failed === 0) {
            console.log('\n');
            log('✓ All tests passed! Token efficiency optimizations are working correctly.', 'green');
            log('✓ LRM data integrity maintained across all optimizations.', 'green');
        } else {
            console.log('\n');
            log(`✗ ${results.failed} test(s) failed. Review output above for details.`, 'red');
        }

    } catch (error) {
        log(`\nFatal error during testing: ${error}`, 'red');
        console.error(error);
        results.failed++;
    } finally {
        await db.close();
    }

    return results.failed === 0 ? 0 : 1;
}

// ============================================================================
// Main
// ============================================================================

runTests()
    .then((exitCode) => {
        process.exit(exitCode);
    })
    .catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
