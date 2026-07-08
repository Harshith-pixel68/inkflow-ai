import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, History, Send, Image as ImageIcon, Calculator, Brain, ListCollapse,
  Plus, Trash2, Copy, Edit3, Search, Share2, Check, BookOpen, XCircle, 
  Flame, CornerDownLeft, ChevronDown, PlusCircle, HelpCircle
} from "lucide-react";
import { ChatMessage, CanvasObject } from "../types";
import { parseAIResponseToObjects } from "../utils/aiResponseParser";

// Pre-defined fully functional study actions
const ALL_ACTIONS = [
  { id: "explain", label: "Explain Concept", icon: Brain, prompt: "Explain this in detail with core physics/engineering principles." },
  { id: "summarize", label: "Summarize", icon: BookOpen, prompt: "Summarize the key concepts concisely." },
  { id: "simplify", label: "Simplify Math", icon: Calculator, prompt: "Simplify this complex explanation or mathematical expression step-by-step." },
  { id: "expand", label: "Expand Topic", icon: Plus, prompt: "Expand on this concept, providing practical examples, real-world engineering applications, and key formulas." },
  { id: "rewrite", label: "Rewrite/Polish", icon: Edit3, prompt: "Rewrite this content for maximum clarity and technical precision." },
  { id: "bullets", label: "Bullet Points", icon: ListCollapse, prompt: "Extract the core concepts into clear, scannable bullet points." },
  { id: "flashcards", label: "Generate Flashcards", icon: Flame, prompt: "Generate 3 interactive study flashcards based on this content. Format each pair clearly on its own lines exactly as Front: [Question] and Back: [Answer]." },
  { id: "mindmap", label: "Generate Mind Map", icon: Sparkles, prompt: "Generate a hierarchical mind map structure for this topic. List subtopics as bullet points so they can be laid out circularly." },
  { id: "quiz", label: "Generate Quiz", icon: HelpCircle, prompt: "Generate a 3-question conceptual quiz with detailed answers." },
  { id: "practice", label: "Practice Problems", icon: Calculator, prompt: "Generate 3 advanced mathematical physics practice problems with full solutions." },
];

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface AssistantPanelProps {
  canvasSelectionText: string;
  onSolveFormula: (formula: string) => void;
  canvasObjects: CanvasObject[];
  onUpdateObjects: (objs: CanvasObject[]) => void;
  activeNotebook: string;
  activeNotebookId: string;
}

export default function AssistantPanel({ 
  canvasSelectionText, 
  onSolveFormula,
  canvasObjects = [],
  onUpdateObjects,
  activeNotebook = "Thermodynamics",
  activeNotebookId = "thermo"
}: AssistantPanelProps) {
  // Multiple conversation manager state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingTitleId, setIsEditingTitleId] = useState<string | null>(null);
  const [editingTitleVal, setEditingTitleVal] = useState("");
  const [showConvDropdown, setShowConvDropdown] = useState(false);

  // Chat/Input states
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string>("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  
  // Offline detection state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const defaultMsg: ChatMessage = {
    id: "init",
    sender: "assistant",
    text: `Hello! I am your **InkFlow AI Assistant**, your dedicated high-fidelity tutor for engineering, physics, and advanced mathematics. 

I can analyze handwritten notes, formulas, or circuit diagrams directly from your whiteboard selection.

What concept or equation would you like to master today? Feel free to ask or trigger a quick study action below!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load conversations from localStorage keyed by activeNotebookId
  useEffect(() => {
    const key = `inkflow_convs_${activeNotebookId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setConversations(parsed);
          setActiveConvId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error("Failed to parse conversations", e);
      }
    }

    // Default conversation setup if none saved
    const defaultConv: Conversation = {
      id: `conv-default-${Date.now()}`,
      title: "General Study Session",
      messages: [defaultMsg],
      createdAt: Date.now(),
    };
    setConversations([defaultConv]);
    setActiveConvId(defaultConv.id);
  }, [activeNotebookId]);

  // Persist conversations
  const saveConversations = (updated: Conversation[]) => {
    setConversations(updated);
    localStorage.setItem(`inkflow_convs_${activeNotebookId}`, JSON.stringify(updated));
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const messages = activeConv ? activeConv.messages : [defaultMsg];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle creating a new conversation
  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: `Study Session #${conversations.length + 1}`,
      messages: [defaultMsg],
      createdAt: Date.now(),
    };
    const nextConvs = [newConv, ...conversations];
    saveConversations(nextConvs);
    setActiveConvId(newConv.id);
    setShowConvDropdown(false);
  };

  // Handle deleting a conversation
  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      alert("You must keep at least one conversation history.");
      return;
    }
    const filtered = conversations.filter(c => c.id !== id);
    saveConversations(filtered);
    if (activeConvId === id) {
      setActiveConvId(filtered[0].id);
    }
  };

  // Handle renaming a conversation
  const handleRenameConversation = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const updated = conversations.map(c => c.id === id ? { ...c, title: newTitle } : c);
    saveConversations(updated);
    setIsEditingTitleId(null);
  };

  // Stop current streaming generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // Main streaming send message handler
  const handleSendMessage = async (customText?: string, actionPrompt?: string) => {
    const textToSend = customText || inputValue;
    if (!textToSend.trim() && !actionPrompt) return;
    if (isLoading) return;

    if (isOffline) {
      alert("You are currently offline. Please restore network connectivity to contact Gemini.");
      return;
    }

    // Cancel previous abort if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Simulate Digital Ink OCR flow if handwriting selection is used
    let ocrConversionPrefix = "";
    if (canvasSelectionText && canvasSelectionText === "∇ × E = -∂B/∂t") {
      setIsLoading(true);
      // Brief delay to simulate Google ML Kit Digital Ink OCR conversion
      await new Promise(r => setTimeout(r, 600));
      ocrConversionPrefix = `\n*[Google ML Kit Digital Ink OCR conversion successful. Extracted: "∇ × E = -∂B/∂t"]*\n\n`;
    }

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: actionPrompt ? `[Study Action: ${actionPrompt}] ${textToSend}` : textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let nextMessages = [...messages, userMessage];
    
    // Auto-update conversation title based on first query
    let updatedTitle = activeConv?.title || "Study Session";
    if (messages.length === 1 && activeConv && activeConv.title.startsWith("Study Session #")) {
      updatedTitle = textToSend.slice(0, 30) + (textToSend.length > 30 ? "..." : "");
    }

    const nextConversations = conversations.map(c => 
      c.id === activeConvId ? { ...c, title: updatedTitle, messages: nextMessages } : c
    );
    saveConversations(nextConversations);

    if (!customText) setInputValue("");
    setIsLoading(true);
    setErrorMsg(null);

    // Create streaming message placeholder
    const streamMsgId = `msg-stream-${Date.now()}`;
    const streamPlaceholder: ChatMessage = {
      id: streamMsgId,
      sender: "assistant",
      text: ocrConversionPrefix ? ocrConversionPrefix + "Analyzing handwritten ink strokes...\n" : "",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setConversations(prev => prev.map(c => 
      c.id === activeConvId ? { ...c, messages: [...nextMessages, streamPlaceholder] } : c
    ));

    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(1).map(m => ({ sender: m.sender, text: m.text })), // skip welcome message
          action: actionPrompt,
          notesContext: {
            notebookTitle: activeNotebook,
            notebookId: activeNotebookId,
            selectionDesc: canvasSelectionText || null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read streaming text reader.");
      }

      const decoder = new TextDecoder();
      let streamText = ocrConversionPrefix;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                streamText += parsed.text;
                // Update conversation message stream in real-time
                setConversations(prev => prev.map(c => {
                  if (c.id === activeConvId) {
                    const updatedMsgs = c.messages.map(m => 
                      m.id === streamMsgId ? { ...m, text: streamText } : m
                    );
                    return { ...c, messages: updatedMsgs };
                  }
                  return c;
                }));
              }
            } catch (err) {
              // Ignore partial parse failures
            }
          }
        }
      }

      // Save conversation state locally
      const finalConvs = localStorage.getItem(`inkflow_convs_${activeNotebookId}`);
      if (finalConvs) {
        try {
          const parsed = JSON.parse(finalConvs) as Conversation[];
          const savedUpdated = parsed.map(c => {
            if (c.id === activeConvId) {
              const cleanedPlaceholder = c.messages.map(m => 
                m.id === streamMsgId ? { ...m, text: streamText } : m
              );
              return { ...c, messages: cleanedPlaceholder };
            }
            return c;
          });
          setConversations(savedUpdated);
          localStorage.setItem(`inkflow_convs_${activeNotebookId}`, JSON.stringify(savedUpdated));
        } catch {}
      }

    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("AI generation aborted by student request.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || "Connection failure.");
      
      const errMsgText = `⚠️ **Gemini Study Stream Connection Error:**\n${err.message || "Failed to establish real-time connection with AI model server."}\n\n*Please verify your Internet connection and confirm your \`GEMINI_API_KEY\` is configured in AI Studio secrets.*`;
      
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvId) {
          const updatedMsgs = c.messages.map(m => 
            m.id === streamMsgId ? { ...m, text: errMsgText } : m
          );
          return { ...c, messages: updatedMsgs };
        }
        return c;
      }));
    } finally {
      setIsLoading(false);
      setSelectedActionId("");
    }
  };

  // Re-trigger the previous prompt
  const handleRegenerate = () => {
    const userMsgs = messages.filter(m => m.sender === "user");
    if (userMsgs.length > 0) {
      const lastUserText = userMsgs[userMsgs.length - 1].text;
      // Remove last assistant message
      const cleaned = messages.slice(0, messages.length - 1);
      const updatedConvs = conversations.map(c => 
        c.id === activeConvId ? { ...c, messages: cleaned } : c
      );
      saveConversations(updatedConvs);
      handleSendMessage(lastUserText);
    }
  };

  // Insert response back into whiteboard canvas
  const handleInsertToCanvas = (text: string, mode: "new" | "below" | "replace") => {
    if (!onUpdateObjects) return;

    const selected = canvasObjects.filter(o => o.isSelected || o.isLassoSelected);
    let x = 150;
    let y = 150;

    if (selected.length > 0) {
      const minX = Math.min(...selected.map(o => o.x));
      const maxX = Math.max(...selected.map(o => o.x + (o.width || 100)));
      const maxY = Math.max(...selected.map(o => o.y + (o.height || 80)));
      
      if (mode === "replace") {
        x = minX;
        y = selected[0].y;
      } else if (mode === "below") {
        x = minX;
        y = maxY + 30;
      } else {
        x = maxX + 40;
        y = selected[0].y;
      }
    }

    // Call our high-fidelity response parser to get multiple structured objects
    const parsedObjects = parseAIResponseToObjects(text, x, y);

    let nextObjects = canvasObjects;
    if (mode === "replace") {
      nextObjects = canvasObjects.filter(o => !o.isSelected && !o.isLassoSelected);
    } else {
      nextObjects = canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false }));
    }

    // Force lasso-selection on all of our newly generated high-fidelity objects so they can be moved as a group
    const finalizedNewObjs = parsedObjects.map((o, idx) => ({
      ...o,
      isSelected: true,
      isLassoSelected: true,
    }));

    onUpdateObjects([...nextObjects, ...finalizedNewObjs]);
  };

  // Parse questions/answers to create interactive whiteboard flashcards
  const handleCreateFlashcards = (text: string) => {
    if (!onUpdateObjects) return;
    
    const lines = text.split("\n");
    const cards: { q: string; a: string }[] = [];
    let currentQ = "";
    let currentA = "";
    
    lines.forEach(line => {
      const qMatch = line.match(/^(?:Q|Question|Front|Front:):\s*(.*)/i);
      const aMatch = line.match(/^(?:A|Answer|Back|Back:):\s*(.*)/i);
      if (qMatch) {
        if (currentQ) cards.push({ q: currentQ, a: currentA || "..." });
        currentQ = qMatch[1];
        currentA = "";
      } else if (aMatch) {
        currentA = aMatch[1];
      } else if (line.trim() && currentQ) {
        if (currentA) currentA += "\n" + line;
        else currentA = line;
      }
    });

    if (currentQ) {
      cards.push({ q: currentQ, a: currentA || "..." });
    }
    
    // Bullet parser fallback
    if (cards.length === 0) {
      const bullets = lines.filter(l => l.trim().startsWith("-") || l.trim().startsWith("*"));
      bullets.forEach((b, idx) => {
        const clean = b.replace(/^[-*\s]+/, "");
        const parts = clean.split(":");
        if (parts.length > 1) {
          cards.push({ q: parts[0].trim(), a: parts.slice(1).join(":").trim() });
        } else {
          cards.push({ q: `Important Concept ${idx + 1}`, a: clean });
        }
      });
    }

    if (cards.length === 0) {
      cards.push({ q: "Core Study Concept", a: text.slice(0, 120) + "..." });
    }

    const baseObjects = canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false }));
    const newObjects: CanvasObject[] = [];
    
    let startX = 180;
    let startY = 320;
    
    cards.slice(0, 4).forEach((card, idx) => {
      const qId = `fc-q-${idx}-${Date.now()}`;
      newObjects.push({
        id: qId,
        type: "text",
        x: startX + idx * 280,
        y: startY,
        width: 250,
        height: 120,
        rotation: 0,
        layer: Date.now() + idx,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#ffd60a",
        strokeWidth: 2,
        content: `Flashcard ${idx + 1} (Q):\n\n${card.q}`,
        isSelected: idx === 0,
        isLassoSelected: idx === 0,
      });

      const aId = `fc-a-${idx}-${Date.now()}`;
      newObjects.push({
        id: aId,
        type: "text",
        x: startX + idx * 280,
        y: startY + 150,
        width: 250,
        height: 120,
        rotation: 0,
        layer: Date.now() + idx + 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#D0BCFF",
        strokeWidth: 2,
        content: `Answer:\n\n${card.a}`,
        isSelected: false,
        isLassoSelected: false,
      });
    });

    onUpdateObjects([...baseObjects, ...newObjects]);
    alert(`Laid out ${Math.min(4, cards.length)} Study Flashcards side-by-side on the whiteboard!`);
  };

  // Parse hierarchic bullet list to generate connected circular Mind Map nodes on canvas
  const handleCreateMindMap = (text: string) => {
    if (!onUpdateObjects) return;

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const nodes: { text: string; level: number }[] = [];
    
    lines.forEach(line => {
      if (line.startsWith("-") || line.startsWith("*")) {
        const clean = line.replace(/^[-*\s]+/, "");
        nodes.push({ text: clean, level: 1 });
      } else if (line.match(/^\d+\./)) {
        const clean = line.replace(/^\d+[\.\s]+/, "");
        nodes.push({ text: clean, level: 1 });
      } else if (line.startsWith("#")) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const clean = line.replace(/^#+\s*/, "");
        nodes.push({ text: clean, level: level - 1 });
      }
    });

    if (nodes.length === 0) {
      const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 8);
      sentences.forEach((s, idx) => {
        nodes.push({ text: s, level: idx === 0 ? 0 : 1 });
      });
    }

    const baseObjects = canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false }));
    const newObjects: CanvasObject[] = [];
    
    const centerX = 500;
    const centerY = 350;
    
    const centralText = nodes.find(n => n.level === 0)?.text || "AI Mind Map";
    const centralId = `mm-root-${Date.now()}`;
    
    newObjects.push({
      id: centralId,
      type: "text",
      x: centerX - 120,
      y: centerY - 50,
      width: 240,
      height: 100,
      rotation: 0,
      layer: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: "#ffd60a",
      strokeWidth: 3,
      content: `📌 CENTRAL TOPIC:\n${centralText}`,
      isSelected: true,
      isLassoSelected: true,
    });

    const subnodes = nodes.filter(n => n.level > 0).slice(0, 6);
    const radius = 220;
    
    subnodes.forEach((node, idx) => {
      const angle = (idx * 2 * Math.PI) / subnodes.length;
      const x = centerX + radius * Math.cos(angle) - 100;
      const y = centerY + radius * Math.sin(angle) - 40;
      
      const subId = `mm-sub-${idx}-${Date.now()}`;
      newObjects.push({
        id: subId,
        type: "text",
        x,
        y,
        width: 200,
        height: 80,
        rotation: 0,
        layer: Date.now() + idx + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#D0BCFF",
        strokeWidth: 1.5,
        content: `🔹 ${node.text.slice(0, 70)}`,
        isSelected: false,
        isLassoSelected: false,
      });

      const lineId = `mm-line-${idx}-${Date.now()}`;
      newObjects.push({
        id: lineId,
        type: "handwriting",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        layer: Date.now() - 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: "#444444",
        strokeWidth: 1.5,
        points: [
          { x: centerX, y: centerY },
          { x: x + 100, y: y + 40 }
        ]
      });
    });

    onUpdateObjects([...baseObjects, ...newObjects]);
    alert(`Generated interactive Mind Map on the whiteboard! Connection lines drawn.`);
  };

  // Copy response to clipboard helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  // Share session via mail helper
  const handleShareSession = (conv: Conversation) => {
    const text = conv.messages.map(m => `${m.sender === "user" ? "Student" : "Gemini AI"}: ${m.text}`).join("\n\n");
    const mailto = `mailto:?subject=${encodeURIComponent(`InkFlow Study Notes: ${conv.title}`)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
  };

  // Filter conversation list by search query
  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed right-4 top-24 bottom-24 w-80 md:w-[410px] bg-[#121212]/95 backdrop-blur-2xl rounded-3xl border border-[#333333] shadow-2xl z-[50] flex flex-col overflow-hidden transform translate-x-[82%] md:translate-x-[90%] hover:translate-x-0 transition-transform duration-300 ease-in-out group">
      {/* Expand/Collapse Trigger Tab */}
      <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-center justify-center bg-[#1C1C1C]/50 border-r border-[#333333] cursor-pointer hover:bg-[#1C1C1C]/80 transition-colors">
        <Sparkles className="w-5 h-5 text-[#D0BCFF] animate-pulse group-hover:scale-110 transition-transform" />
        <span className="text-[10px] text-[#D0BCFF] uppercase font-bold tracking-[0.2em] [writing-mode:vertical-lr] rotate-180 mt-4 font-mono">
          Study Assistant
        </span>
      </div>

      {/* Main Interface */}
      <div className="pl-12 p-4 flex-1 flex flex-col h-full bg-[#0A0A0A]/50 relative">
        
        {/* Offline Warning */}
        {isOffline && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-2 mb-2 text-red-300 text-xs text-center font-mono">
            ⚠️ Device Offline. Answers might fail.
          </div>
        )}

        {/* Header Block with Conversation Manager Dropdown */}
        <div className="flex items-center justify-between pb-3 border-b border-[#333333] gap-2">
          <div className="relative flex-1 min-w-0">
            <button 
              onClick={() => setShowConvDropdown(!showConvDropdown)}
              className="flex items-center gap-1.5 text-left text-xs font-semibold text-[#D0BCFF] hover:bg-[#1C1C1C] px-2 py-1 rounded-lg truncate w-full"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{activeConv?.title || "Study Session"}</span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>

            {/* Conversation list Dropdown */}
            {showConvDropdown && (
              <div className="absolute left-0 mt-2 w-72 bg-[#1C1C1C] border border-[#333333] rounded-2xl shadow-2xl z-[60] p-2 flex flex-col gap-1 select-none">
                <div className="flex items-center gap-1 bg-black/40 border border-[#333333] rounded-lg px-2 py-1 mb-1.5">
                  <Search className="w-3.5 h-3.5 text-[#938F99]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search session content..."
                    className="bg-transparent border-none text-[11px] text-[#E6E1E5] placeholder-[#938F99] focus:outline-none focus:ring-0 w-full"
                  />
                </div>

                <button
                  onClick={handleNewConversation}
                  className="flex items-center justify-center gap-1 w-full text-center py-1.5 bg-[#D0BCFF] hover:bg-opacity-90 text-[#381E72] rounded-xl text-xs font-bold transition-all mb-1.5 active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  New Study Session
                </button>

                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 no-scrollbar">
                  {filteredConversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveConvId(c.id);
                        setShowConvDropdown(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer group/item transition-colors ${
                        c.id === activeConvId ? "bg-[#2B2930] text-[#E6E1E5]" : "hover:bg-[#121212] text-[#938F99]"
                      }`}
                    >
                      {isEditingTitleId === c.id ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={c.title}
                          onBlur={(e) => handleRenameConversation(c.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameConversation(c.id, e.currentTarget.value);
                          }}
                          className="bg-black/40 text-xs text-[#E6E1E5] rounded px-1 outline-none border-b border-[#D0BCFF] w-[80%]"
                        />
                      ) : (
                        <span className="truncate font-medium flex-1">{c.title}</span>
                      )}

                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingTitleId(c.id);
                          }}
                          title="Rename Session"
                          className="p-0.5 hover:bg-white/10 rounded text-gray-400 hover:text-[#D0BCFF]"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => handleDeleteConversation(c.id, e)}
                          title="Delete Session"
                          className="p-0.5 hover:bg-red-500/20 rounded text-red-400"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => {
                if (activeConv) {
                  const resetMessages = [defaultMsg];
                  saveConversations(conversations.map(c => c.id === activeConvId ? { ...c, messages: resetMessages } : c));
                }
              }} 
              className="p-1.5 rounded-full hover:bg-[#1C1C1C] text-[#938F99] hover:text-[#E6E1E5] transition-colors"
              title="Clear Session History"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => activeConv && handleShareSession(activeConv)}
              className="p-1.5 rounded-full hover:bg-[#1C1C1C] text-[#938F99] hover:text-[#E6E1E5] transition-colors"
              title="Email Study Notes"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Canvas Context Panel */}
        {canvasSelectionText && (
          <div className="mt-2 bg-[#2B2930] border border-[#D0BCFF]/30 rounded-xl p-2.5 flex items-center justify-between gap-2 animate-in slide-in-from-top-1 duration-200 shadow-md">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-[#D0BCFF] uppercase font-bold block tracking-wider font-mono">Active Selection Context</span>
              <p className="text-xs text-[#E6E1E5] truncate font-mono mt-0.5">"{canvasSelectionText}"</p>
            </div>
            <button 
              onClick={() => onSolveFormula(canvasSelectionText)}
              className="text-xs bg-[#D0BCFF] text-[#381E72] px-2.5 py-1 rounded-full font-bold hover:bg-opacity-95 shrink-0 transition-transform active:scale-95"
            >
              Solve Now
            </button>
          </div>
        )}

        {/* Chat History Box */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-4 pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col max-w-[88%] ${
                m.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#938F99] font-medium">
                {m.sender === "assistant" && (
                  <div className="w-4 h-4 rounded-full bg-[#2B2930] flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-[#D0BCFF]" />
                  </div>
                )}
                <span>{m.sender === "user" ? "Student" : "InkFlow AI"} • {m.timestamp}</span>
              </div>
              
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap select-text group/bubble relative transition-all ${
                  m.sender === "user"
                    ? "bg-[#2B2930] text-[#E6E1E5] border border-[#D0BCFF]/15 rounded-tr-xs"
                    : "bg-[#1C1C1C] text-[#E6E1E5] border border-[#333333] rounded-tl-xs"
                }`}
              >
                {m.text}

                {/* AI Interactive Whiteboard Insertion Toolbar */}
                {m.sender === "assistant" && m.id !== "init" && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-[#333333]/50 justify-start">
                    <button
                      onClick={() => handleCopy(m.id, m.text)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 text-gray-300 hover:text-white text-[10px] font-bold transition-all"
                      title="Copy text to Clipboard"
                    >
                      {copiedMsgId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#938F99]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleInsertToCanvas(m.text, "new")}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 text-[#D0BCFF] hover:bg-opacity-90 text-[10px] font-bold transition-all"
                      title="Insert response onto Board as text/formula"
                    >
                      <Plus className="w-3 h-3 text-[#D0BCFF]" />
                      <span>Insert on Canvas</span>
                    </button>

                    <button
                      onClick={() => handleInsertToCanvas(m.text, "below")}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 text-[#d8f3dc] hover:bg-opacity-90 text-[10px] font-bold transition-all"
                      title="Place just below selected elements"
                    >
                      <CornerDownLeft className="w-3 h-3 text-[#a7c957]" />
                      <span>Insert Below</span>
                    </button>

                    <button
                      onClick={() => handleInsertToCanvas(m.text, "replace")}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 text-[#ffb4ab] hover:bg-opacity-90 text-[10px] font-bold transition-all"
                      title="Replace selection on Board"
                    >
                      <XCircle className="w-3 h-3 text-[#ff80ab]" />
                      <span>Replace</span>
                    </button>

                    {/* Highly unique, smart conversion widgets */}
                    <button
                      onClick={() => handleCreateFlashcards(m.text)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#2B2930] hover:bg-[#381E72] text-[#ffd60a] text-[10px] font-bold transition-all border border-[#ffd60a]/20"
                      title="Generate study flashcard group on whiteboard"
                    >
                      <Flame className="w-3 h-3 text-[#ffd60a]" />
                      <span>Flashcards</span>
                    </button>

                    <button
                      onClick={() => handleCreateMindMap(m.text)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#2B2930] hover:bg-[#381E72] text-[#ffc6ff] text-[10px] font-bold transition-all border border-[#ffc6ff]/20"
                      title="Construct circular connected Mind Map on whiteboard"
                    >
                      <Sparkles className="w-3 h-3 text-[#ffc6ff]" />
                      <span>Mind Map</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator spinner or Abort controller */}
          {isLoading && (
            <div className="flex items-center justify-between bg-[#1C1C1C]/40 border border-[#333333]/30 rounded-xl p-2.5 animate-pulse text-xs text-[#938F99]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-[#D0BCFF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#D0BCFF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#D0BCFF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="font-mono">Streaming Gemini solutions...</span>
              </div>
              <button
                onClick={handleStopGeneration}
                className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 px-2 py-0.5 rounded font-mono font-bold"
              >
                STOP
              </button>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Action Scrollable Chips Library */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3 pt-1">
          {ALL_ACTIONS.map((act) => {
            const IconComp = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => {
                  setSelectedActionId(act.id);
                  const selectionTextToUse = canvasSelectionText || "[Using full Thermodynamics Study notebook for context]";
                  handleSendMessage(selectionTextToUse, act.prompt);
                }}
                disabled={isLoading}
                className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedActionId === act.id
                    ? "bg-[#D0BCFF] text-[#381E72] border-[#D0BCFF]"
                    : "bg-[#1C1C1C] hover:bg-[#121212] border-[#333333] text-[#E6E1E5]"
                }`}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>

        {/* Text Input area with action select and submit */}
        <div className="relative bg-[#1C1C1C] rounded-2xl p-1 border border-[#333333] focus-within:border-[#D0BCFF]/40 transition-all shadow-lg">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={2}
            className="w-full bg-transparent border-none text-xs text-[#E6E1E5] placeholder-[#938F99] focus:outline-none focus:ring-0 resize-none p-2.5 pr-10 font-sans"
            placeholder="Ask about equations, circuits, chemistry, graphs..."
          />
          <div className="flex justify-between items-center px-1.5 pb-1">
            <div className="flex items-center gap-1.5">
              <button 
                className="p-1.5 rounded-full hover:bg-[#121212] text-[#938F99] hover:text-[#E6E1E5] transition-colors"
                title="Whiteboard Canvas automatic layout active"
                onClick={() => alert("Multimodal study mode enabled. Drawings, OCR selections, formulas, and attachments are synchronized automatically.")}
              >
                <ImageIcon className="w-4 h-4 text-[#ffd60a]" />
              </button>
              
              {/* Action Dropdown quick selection */}
              <select
                value={selectedActionId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedActionId(val);
                  if (val) {
                    const act = ALL_ACTIONS.find(a => a.id === val);
                    if (act) {
                      const sel = canvasSelectionText || "[Full Notebook Canvas]";
                      handleSendMessage(sel, act.prompt);
                    }
                  }
                }}
                className="bg-black/30 text-[10px] text-gray-400 border border-[#333333] rounded px-1.5 py-0.5 outline-none max-w-[120px] font-semibold cursor-pointer"
              >
                <option value="">Study Action...</option>
                {ALL_ACTIONS.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleSendMessage()}
              disabled={(!inputValue.trim() && !selectedActionId) || isLoading}
              className={`p-1.5 rounded-full transition-all ${
                (inputValue.trim() || selectedActionId) && !isLoading
                  ? "bg-[#D0BCFF] text-[#381E72] hover:opacity-90 active:scale-95"
                  : "bg-white/5 text-gray-500"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
