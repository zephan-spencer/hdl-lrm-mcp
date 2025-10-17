/**
 * Test data fixtures for Athens HDL MCP tests
 */

import { Section, CodeExample, Table } from '../../src/storage/database.js';

export const testSections = [
    {
        language: 'verilog',
        section_number: '1',
        parent_section: null,
        title: 'Overview',
        content: 'This section provides an overview of the Verilog hardware description language.',
        page_start: 1,
        page_end: 5,
        depth: 0,
    },
    {
        language: 'verilog',
        section_number: '1.1',
        parent_section: '1',
        title: 'Purpose and Scope',
        content: 'The purpose of this standard is to define the Verilog Hardware Description Language (HDL).',
        page_start: 2,
        page_end: 3,
        depth: 1,
    },
    {
        language: 'verilog',
        section_number: '9',
        parent_section: null,
        title: 'Behavioral Modeling',
        content: 'Verilog provides procedural blocks for behavioral modeling including always and initial blocks.',
        page_start: 120,
        page_end: 145,
        depth: 0,
    },
    {
        language: 'verilog',
        section_number: '9.2',
        parent_section: '9',
        title: 'Procedural Blocks',
        content: 'There are two types of procedural blocks in Verilog: always and initial. An always block executes continuously throughout simulation.',
        page_start: 123,
        page_end: 130,
        depth: 1,
    },
    {
        language: 'verilog',
        section_number: '9.2.1',
        parent_section: '9.2',
        title: 'The always Construct',
        content: 'The always statement is used to model combinational and sequential logic. It executes whenever any signal in its sensitivity list changes. Syntax: always @(sensitivity_list) statement',
        page_start: 123,
        page_end: 125,
        depth: 2,
    },
];

export const testCodeExamples = [
    {
        section_number: '9.2.1',
        code: `always @(posedge clk) begin
    q <= d;
end`,
        description: 'Simple D flip-flop',
    },
    {
        section_number: '9.2.1',
        code: `always @(a or b or c) begin
    out = a & b | c;
end`,
        description: 'Combinational logic',
    },
    {
        section_number: '9.2',
        code: `initial begin
    reset = 1;
    #10 reset = 0;
end`,
        description: 'Initial block example',
    },
];

export const testTables = [
    {
        section_number: '1',
        caption: 'Verilog Data Types',
        content_json: JSON.stringify([
            { type: 'wire', description: 'Represents physical connection' },
            { type: 'reg', description: 'Represents storage element' },
            { type: 'integer', description: '32-bit signed number' },
        ]),
        markdown: `| Type | Description |
|---|---|
| wire | Represents physical connection |
| reg | Represents storage element |
| integer | 32-bit signed number |`,
    },
];

export const testSystemVerilogSections = [
    {
        language: 'systemverilog',
        section_number: '1',
        parent_section: null,
        title: 'Introduction',
        content: 'SystemVerilog extends Verilog with object-oriented features.',
        page_start: 1,
        page_end: 3,
        depth: 0,
    },
];

export const testVHDLSections = [
    {
        language: 'vhdl',
        section_number: '1',
        parent_section: null,
        title: 'Overview',
        content: 'VHDL (VHSIC Hardware Description Language) is a hardware description language.',
        page_start: 1,
        page_end: 5,
        depth: 0,
    },
];

/**
 * Edge case test data
 */
export const edgeCaseData = {
    // Very long content section
    longContent: {
        language: 'verilog',
        section_number: '99',
        parent_section: null,
        title: 'Long Content Test',
        content: 'A'.repeat(100000), // 100KB of content
        page_start: 1,
        page_end: 1,
        depth: 0,
    },
    // Special characters in content
    specialChars: {
        language: 'verilog',
        section_number: '98',
        parent_section: null,
        title: 'Special Characters: <>&"\'',
        content: 'Content with special chars: <>&"\' and unicode: 你好世界 🚀',
        page_start: 1,
        page_end: 1,
        depth: 0,
    },
    // Empty content
    emptyContent: {
        language: 'verilog',
        section_number: '97',
        parent_section: null,
        title: 'Empty Content',
        content: '',
        page_start: 1,
        page_end: 1,
        depth: 0,
    },
};
