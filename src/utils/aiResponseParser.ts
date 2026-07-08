import { CanvasObject } from "../types";

/**
 * Interface representing a parsed markdown table grid
 */
export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Helper utility to parse standard markdown tables into structured headers and rows.
 */
export function parseMarkdownTable(markdown: string): ParsedTable | null {
  const lines = markdown.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Filter lines that look like table rows (must start and end with a pipe)
  const tableLines = lines.filter(line => line.startsWith("|") && line.endsWith("|"));
  if (tableLines.length < 2) return null;

  // Extract headers
  const headers = tableLines[0]
    .split("|")
    .map(cell => cell.trim())
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

  // Filter out table separators (e.g., |---|---| or | :--- | ---: |)
  const dataLines = tableLines.slice(1).filter(line => {
    const innerContent = line.replace(/[\s|:\-]/g, "");
    return innerContent.length > 0;
  });

  const rows = dataLines.map(line =>
    line
      .split("|")
      .map(cell => cell.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
  );

  if (headers.length === 0) return null;

  return { headers, rows };
}

/**
 * Converts a raw AI study text or markdown into structured CanvasObject models.
 * Segments mathematical latex blocks, standard paragraphs, bullet point summaries,
 * and markdown table grids into custom-styled, draggable, editable elements.
 *
 * @param text The raw AI-generated response text
 * @param baseX Optional horizontal starting anchor on the board
 * @param baseY Optional vertical starting anchor on the board
 */
export function parseAIResponseToObjects(
  text: string,
  baseX: number = 180,
  baseY: number = 180
): CanvasObject[] {
  // 1. Clean potential digital ink tags or metadata headers
  const cleanText = text.replace(/^\*+\[Google ML Kit[\s\S]*?\]\*+\n+/i, "").trim();

  const blocks: { type: "text" | "formula" | "table"; content: string }[] = [];
  const lines = cleanText.split("\n");

  let currentBlockType: "text" | "formula" | "table" | null = null;
  let currentBlockLines: string[] = [];

  const flushBlock = () => {
    if (currentBlockLines.length === 0) return;
    const content = currentBlockLines.join("\n").trim();
    if (content) {
      blocks.push({
        type: currentBlockType || "text",
        content,
      });
    }
    currentBlockLines = [];
    currentBlockType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. If we are already in a formula block, we consume lines until we find the closing delimiter
    if (currentBlockType === "formula") {
      currentBlockLines.push(line);
      if (
        (trimmed.endsWith("$") && currentBlockLines.length > 1) ||
        trimmed.startsWith("\\end{") ||
        trimmed.endsWith("\\]")
      ) {
        flushBlock();
      }
      continue;
    }

    // 2. Check for LaTeX block formula start (wrapped in $)
    if (trimmed.startsWith("$")) {
      flushBlock();
      currentBlockType = "formula";
      currentBlockLines.push(line);
      // If it's a single line formula like $x^2 = y$, flush immediately
      if (trimmed.endsWith("$") && trimmed.length > 2) {
        flushBlock();
      }
      continue;
    }

    // 3. Check for environment math formulas (e.g. \begin{...} or \[ )
    if (trimmed.startsWith("\\begin{") || trimmed.startsWith("\\[")) {
      flushBlock();
      currentBlockType = "formula";
      currentBlockLines.push(line);
      if (trimmed.endsWith("\\end{") || trimmed.endsWith("\\]")) {
        flushBlock();
      }
      continue;
    }

    // 4. Check for Markdown table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (currentBlockType === "table") {
        currentBlockLines.push(line);
      } else {
        flushBlock();
        currentBlockType = "table";
        currentBlockLines.push(line);
      }
      continue;
    } else {
      if (currentBlockType === "table") {
        flushBlock();
      }
    }

    // Start text block if we aren't in any block
    if (!currentBlockType) {
      currentBlockType = "text";
    }

    if (currentBlockType === "text") {
      // If we see a blank line, check if we should split text paragraphs
      if (trimmed === "" && currentBlockLines.length > 2) {
        flushBlock();
        currentBlockType = "text";
      } else {
        currentBlockLines.push(line);
      }
    }
  }

  // Flush remaining lines
  flushBlock();

  // 2. Transform the structured text segments into CanvasObject models
  const objects: CanvasObject[] = [];
  let currentY = baseY;
  const spacingY = 24;

  blocks.forEach((block, index) => {
    const id = `ai-parsed-${block.type}-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`;
    
    let width = 380;
    let height = 130;

    if (block.type === "formula") {
      width = 400;
      // Strip outer delimiters ($$ or \[ \]) for cleaner render math engine support
      let cleanedFormula = block.content;
      if (cleanedFormula.startsWith("$$") && cleanedFormula.endsWith("$$")) {
        cleanedFormula = cleanedFormula.slice(2, cleanedFormula.length - 2).trim();
      } else if (cleanedFormula.startsWith("\\[") && cleanedFormula.endsWith("\\]")) {
        cleanedFormula = cleanedFormula.slice(2, cleanedFormula.length - 2).trim();
      }
      block.content = cleanedFormula;
      height = 95;
    } else if (block.type === "table") {
      width = 460;
      const rowsCount = block.content.split("\n").length;
      height = Math.max(160, rowsCount * 42 + 45);
    } else {
      width = 410;
      const chars = block.content.length;
      height = Math.max(110, Math.min(320, Math.ceil(chars / 2.3) + 35));
    }

    // Assign color accents matching existing InkFlow visual identity
    let color = "#D0BCFF"; // Lavender default
    if (block.type === "formula") {
      color = "#ffd60a"; // Academic Yellow
    } else if (block.type === "table") {
      color = "#34d399"; // Technical Green
    }

    objects.push({
      id,
      type: block.type,
      x: baseX,
      y: currentY,
      width,
      height,
      rotation: 0,
      layer: Date.now() + index,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color,
      strokeWidth: 2,
      content: block.content,
      isSelected: index === 0, // Select the primary block
      isLassoSelected: index === 0,
    });

    currentY += height + spacingY;
  });

  return objects;
}
