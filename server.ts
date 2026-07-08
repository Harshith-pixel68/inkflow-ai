import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client to avoid crashes if API key is not yet set
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured. Please set it in the Secrets panel in AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Resilient helper to handle temporary Gemini API model unavailability (503/429/etc.).
 * It implements exponential backoff retries and falls back to gemini-3.1-flash-lite if gemini-3.5-flash fails.
 */
async function generateContentResilient(
  params: {
    model?: string;
    contents: any;
    config?: any;
  },
  maxRetries = 2
): Promise<any> {
  const primaryModel = params.model || "gemini-3.5-flash";
  const modelsToTry = [primaryModel, "gemini-3.1-flash-lite"];

  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 600; // ms
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const ai = getGeminiClient();
        console.log(`[AI] Attempting generateContent using model "${model}" (attempt ${attempt + 1}/${maxRetries + 1})`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        
        // Extract status/error details
        const statusCode = error.status || error.statusCode;
        const isUnavailable = statusCode === 503 || (error.message && error.message.includes("503")) || (error.message && error.message.includes("UNAVAILABLE"));
        const isRateLimit = statusCode === 429 || (error.message && error.message.includes("429")) || (error.message && error.message.includes("RESOURCE_EXHAUSTED"));
        
        console.warn(`[AI] Error with model "${model}" (attempt ${attempt + 1}):`, error.message || error);
        
        // Handle auth errors immediately without looping
        const isAuthError = statusCode === 401 || statusCode === 403 || (error.message && (error.message.includes("API_KEY") || error.message.includes("API key")));
        if (isAuthError) {
          throw error;
        }

        if (attempt < maxRetries && (isUnavailable || isRateLimit)) {
          console.log(`[AI] Temporary issue detected. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
        } else {
          // If we exhausted retries or got a non-retryable error, proceed to fallback model
          break;
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content after retries and fallbacks.");
}

// API endpoint for streaming AI assistant chat (Server-Sent Events)
app.post("/api/ai/chat/stream", async (req, res) => {
  try {
    const { message, history, action, notesContext } = req.body;
    if (!message && !action) {
      res.status(400).json({ error: "Message or action is required." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Compose high-fidelity engineering tutor context
    let promptText = "";
    if (action) {
      promptText = `Perform action "${action}" on this text:\n"${message || "(no input content)"}"`;
    } else {
      promptText = message;
    }

    if (notesContext) {
      const { notebookTitle, notebookId, selectionDesc } = notesContext;
      promptText = `STUDY CONTEXT:\nNotebook: "${notebookTitle || "whiteboard"}" (${notebookId || "default"})\nSelection Context: ${selectionDesc || "Use entire board"}\n\nUSER REQUEST/PROBLEM:\n${promptText}`;
    }

    // Prepare contents array matching GoogleGenAI schema
    const contents: any[] = [];
    if (history && history.length > 0) {
      history.forEach((h: { sender: string; text: string }) => {
        contents.push({
          role: h.sender === "user" ? "user" : "model",
          parts: [{ text: h.text }],
        });
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: promptText }],
    });

    const ai = getGeminiClient();
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: `You are InkFlow AI Assistant, a premium, high-fidelity AI tutor and engineering study assistant built into InkFlow AI—an infinite canvas handwriting and diagramming application.
Your target users are engineering and STEM students working with calculus, thermodynamics, physics, and circuit design.
Keep your answers highly professional, scientifically rigorous, yet clear and helpful. Use LaTeX format for equations (wrapped in $ or $$) and Markdown for clear explanations.
If the request is a math problem, solve it step-by-step. If applicable, describe how to graph it.
If the user asks for actions like Generate Flashcards or Generate Mind Map, output structured markdown so they can easily be imported.
Keep equations wrapped in $$ for block math or $ for inline math.`,
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Error in streaming API:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "Failed to generate stream" })}\n\n`);
    res.end();
  }
});

// API endpoint for AI assistant chat
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Structure chat history or compile custom prompt for deep context
    let prompt = "";
    if (history && history.length > 0) {
      prompt += "This is a continuation of the conversation. Here is the previous history:\n";
      history.forEach((h: { sender: string; text: string }) => {
        prompt += `${h.sender === "user" ? "User" : "AI Assistant"}: ${h.text}\n`;
      });
      prompt += `\nNow, respond to this message: ${message}`;
    } else {
      prompt = message;
    }

    const response = await generateContentResilient({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are InkFlow AI Assistant, a premium, high-fidelity AI tutor and engineering study assistant built into InkFlow AI—an infinite canvas handwriting and diagramming application.
Your target users are engineering and STEM students working with calculus, thermodynamics, physics, and circuit design.
Keep your answers highly professional, scientifically rigorous, yet clear and helpful. Use LaTeX format for equations (wrapped in $ or $$) and Markdown for clear explanations. Provide diagrams or text representations when requested.
Be encouraging and always explain the underlying physical or mathematical principles.`,
      },
    });

    const reply = response.text || "I apologize, but I couldn't generate a response.";
    res.json({ reply });
  } catch (error: any) {
    console.error("Gemini API Error in /api/ai/chat:", error);
    res.status(500).json({ error: error.message || "Internal server error occurred." });
  }
});

// API endpoint for smart math solver and formula analysis
app.post("/api/ai/solve", async (req, res) => {
  try {
    const { equation, type } = req.body;
    if (!equation) {
      res.status(400).json({ error: "Equation/Formula is required" });
      return;
    }

    let systemInstruction = "You are a smart engineering mathematics and physics solver engine.";
    let prompt = "";

    if (type === "solve") {
      prompt = `Solve the following mathematical/engineering equation step-by-step: "${equation}".
Show each intermediate algebraic or calculus step clearly.
Provide a clear final answer, explaining the physical significance of any constants or results if applicable.
Format formulas using clean LaTeX markdown (e.g. $...$ for inline, $$...$$ for block).`;
    } else if (type === "simplify") {
      prompt = `Simplify this mathematical expression: "${equation}". Show the step-by-step reduction.`;
    } else if (type === "explain") {
      prompt = `Explain the physical meaning, applications, and formulation of this physics/engineering equation: "${equation}".
Include what each symbol stands for and why it is fundamental in engineering.`;
    } else {
      prompt = `Process the formula: "${equation}"`;
    }

    const response = await generateContentResilient({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { systemInstruction },
    });

    const solution = response.text || "Unable to solve the equation.";
    res.json({ solution });
  } catch (error: any) {
    console.error("Gemini API Error in /api/ai/solve:", error);
    res.status(500).json({ error: error.message || "Internal server error occurred." });
  }
});

// API endpoint to simulate Digital Ink OCR Conversion using Gemini (if the user submits handwritten coordinates or custom drawings)
app.post("/api/ai/ocr", async (req, res) => {
  try {
    const { strokesDesc } = req.body;
    const prompt = `You are a handwriting recognition model (ML Kit Digital Ink). Convert this text representation of strokes to editable digital text or LaTeX formula: "${strokesDesc}". Return ONLY the digital text or equation string without any surrounding commentary.`;

    const response = await generateContentResilient({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text?.trim() || strokesDesc });
  } catch (error: any) {
    console.error("Gemini API Error in /api/ai/ocr:", error);
    res.status(500).json({ error: error.message || "Failed to convert handwriting." });
  }
});

// AI-powered visual recognition endpoint for handwriting strokes to LaTeX formula or vector shape conversion
app.post("/api/ai/visual-ocr", async (req, res) => {
  try {
    const { image, targetType } = req.body;
    if (!image) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    // Strip out the data URL metadata header if present
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

    const imagePart = {
      inlineData: {
        mimeType: "image/png",
        data: cleanBase64,
      }
    };

    let instructionText = "Analyze the handwriting stroke(s) drawn on this whiteboard canvas image. ";
    
    if (targetType === "formula") {
      instructionText += "You MUST interpret this drawing as a mathematical, physics, chemistry, or general scientific equation, expression, or formula. " +
                         "Set `isFormula` to true, and output the reconstructed equation strictly in LaTeX formatting (without $$ or $ delimiters in the `content` string itself, just the raw LaTeX expression, e.g. \\int e^x dx, \\Delta x \\ge \\frac{\\hbar}{2}, or y = mx + b). " +
                         "Be extremely precise and do not omit subscripts, superscripts, or symbols.";
    } else if (targetType === "text") {
      instructionText += "You MUST transcribe this drawing as clean, readable handwritten notes, words, sentences, or paragraphs of text. " +
                         "Set `isFormula` to false, and populate the `content` field with the exact transcribed text string. " +
                         "Do not translate or summarize, just transcribe what is written as faithfully as possible.";
    } else {
      instructionText += "First, determine if the drawing represents a mathematical, physics, chemistry, or general scientific equation, expression, or formula (or part of one, e.g., integral symbol, fraction, variable with subscripts). " +
                         "If it is a scientific formula or mathematical symbol/expression, set `isFormula` to true, and output the reconstructed equation strictly in LaTeX formatting (without $$ or $ delimiters in the `content` string itself, just the raw LaTeX expression, e.g. \\int e^x dx, \\Delta x \\ge \\frac{\\hbar}{2}, or y = mx + b). " +
                         "If the drawing is not an equation or formula but rather a diagrammatic engineering symbol, flowchart shape, or geometric shape (such as a resistor, inductor, capacitor, diode, logic gate, decision diamond, database cylinder, process box, circle, line, etc.), set `isFormula` to false, and populate `detectedType` and `detectedLabel` with the appropriate engineering component or shape. " +
                         "If it is a mixture, prefer recognizing the mathematical formula/symbols if they are dominant. Be highly accurate and scientifically rigorous.";
    }

    const textPart = {
      text: instructionText
    };

    const response = await generateContentResilient({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFormula: {
              type: Type.BOOLEAN,
              description: "True if the handwriting contains a math, physics, engineering, or chemical equation/expression/symbol."
            },
            content: {
              type: Type.STRING,
              description: "The recognized LaTeX formula or transcribed plain text transcription of the handwritten notes."
            },
            detectedType: {
              type: Type.STRING,
              description: "The machine-readable type of shape or engineering sketch detected if isFormula is false and not converting to plain text. Must be one of: resistor, inductor, capacitor, diode, and, or, decision, start_end, process, database, gear, cloud, circle, line."
            },
            detectedLabel: {
              type: Type.STRING,
              description: "The human-readable label for the detected shape, e.g. 'Resistor (Electrical)', 'Capacitor (Electrical)', 'AND Gate (Logic)', etc."
            }
          },
          required: ["isFormula"]
        }
      }
    });

    const resultText = response.text || "{}";
    const resultObj = JSON.parse(resultText);
    res.json(resultObj);
  } catch (error: any) {
    console.error("Gemini API Error in /api/ai/visual-ocr:", error);
    res.status(500).json({ error: error.message || "Internal server error in visual OCR recognition." });
  }
});

// Vite dev server middleware integration or production static routing
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`InkFlow AI custom server running on http://localhost:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error("Failed to start server:", err);
});
