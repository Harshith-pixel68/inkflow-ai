import React, { useState, useEffect } from "react";
import { 
  Folder as FolderIcon, FolderOpen, FileText, Star, Clock, Trash2, 
  ChevronRight, Plus, FolderPlus, X, MoreVertical, Edit2, Copy, 
  Move, Lock, Unlock, Share2, Download, Search, BookOpen, Cpu, 
  Layers, Map, Terminal, Brain, Activity, Heart, EyeOff, Check, AlertTriangle
} from "lucide-react";
import { FolderItem, NotebookItem, TrashItem } from "../types";
import { triggerHaptic } from "../utils/haptics";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeNotebook: string;
  onSelectNotebook: (name: string, id: string, type?: "whiteboard" | "rich_text") => void;
  activeNotebookId: string;
  onUpdateNotebookStatsRef?: React.MutableRefObject<((id: string, pageCount: number) => void) | undefined>;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Folder: FolderIcon,
  BookOpen: BookOpen,
  Cpu: Cpu,
  Brain: Brain,
  Activity: Activity,
  Terminal: Terminal,
  Layers: Layers,
  Map: Map,
};

const COLOR_PRESETS = [
  { value: "#D0BCFF", name: "Lavender" },
  { value: "#86EFAC", name: "Mint" },
  { value: "#7DD3FC", name: "Sky Blue" },
  { value: "#FCD34D", name: "Amber Gold" },
  { value: "#FFB4AB", name: "Rose Pink" },
  { value: "#FF7F0E", name: "Orange" },
  { value: "#319795", name: "Teal" },
];

export default function Sidebar({ 
  isOpen, 
  onClose, 
  activeNotebook, 
  onSelectNotebook, 
  activeNotebookId,
  onUpdateNotebookStatsRef
}: SidebarProps) {
  
  // Folders and Notebooks list
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Dialog and Modals States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderModalData, setFolderModalData] = useState<{
    id?: string;
    name: string;
    color: string;
    icon: string;
    description: string;
  }>({ name: "", color: "#D0BCFF", icon: "Folder", description: "" });

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [notebookModalData, setNotebookModalData] = useState<{
    id?: string;
    folderId: string;
    name: string;
    color: string;
    icon: string;
    tags: string;
    notebookType: "whiteboard" | "rich_text";
  }>({ folderId: "", name: "", color: "#D0BCFF", icon: "FileText", tags: "", notebookType: "whiteboard" });

  const [isMoveNotebookModalOpen, setIsMoveNotebookModalOpen] = useState(false);
  const [moveNotebookData, setMoveNotebookData] = useState<{
    notebookId: string;
    sourceFolderId: string;
    targetFolderId: string;
  }>({ notebookId: "", sourceFolderId: "", targetFolderId: "" });

  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Floating Context Menu States
  const [activeFolderMenu, setActiveFolderMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [activeNotebookMenu, setActiveNotebookMenu] = useState<{ folderId: string; notebookId: string; x: number; y: number } | null>(null);

  // Drag and Drop States
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [draggingNotebook, setDraggingNotebook] = useState<{ folderId: string; notebookId: string } | null>(null);

  // Initialize from LocalStorage (Simulated Room Database)
  useEffect(() => {
    const savedFolders = localStorage.getItem("inkflow_room_folders");
    const savedTrash = localStorage.getItem("inkflow_room_trash");

    if (savedFolders) {
      try {
        const parsed = JSON.parse(savedFolders);
        setFolders(parsed);
        // Expand first folder by default
        if (parsed.length > 0 && Object.keys(expandedFolders).length === 0) {
          setExpandedFolders({ [parsed[0].id]: true });
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Default initial structure
      const defaults: FolderItem[] = [
        {
          id: "semester-4",
          name: "Semester 4",
          isFolder: true,
          color: "#D0BCFF",
          icon: "Layers",
          description: "Active engineering courses, network theory, and notes",
          isLocked: false,
          isFavorite: true,
          createdAt: Date.now() - 30 * 24 * 3600000,
          updatedAt: Date.now(),
          children: [
            { 
              id: "thermo", 
              name: "Thermodynamics Study Notes", 
              isFolder: false, 
              color: "#FFB4AB", 
              icon: "FileText",
              isFavorite: true,
              isLocked: false,
              createdAt: Date.now() - 10 * 24 * 3600000,
              updatedAt: Date.now(),
              lastOpened: Date.now() - 30 * 60000,
              pageCount: 3,
              tags: ["physics", "cycles", "entropy"]
            },
            { 
              id: "optics", 
              name: "Optics & Waves", 
              isFolder: false, 
              color: "#7DD3FC", 
              icon: "FileText",
              isFavorite: false,
              isLocked: false,
              createdAt: Date.now() - 5 * 24 * 3600000,
              updatedAt: Date.now(),
              lastOpened: Date.now() - 120 * 60000,
              pageCount: 2,
              tags: ["optics", "lenses", "equations"]
            },
            { 
              id: "circuits", 
              name: "Network Theory Circuits", 
              isFolder: false, 
              color: "#86EFAC", 
              icon: "Cpu",
              isFavorite: true,
              isLocked: false,
              createdAt: Date.now() - 2 * 24 * 3600000,
              updatedAt: Date.now(),
              lastOpened: Date.now(),
              pageCount: 3,
              tags: ["circuits", "electrical", "formulas"]
            },
          ]
        },
        {
          id: "quantum",
          name: "Quantum Mechanics",
          isFolder: true,
          color: "#FCD34D",
          icon: "Brain",
          description: "Wave mechanics and formulations",
          isLocked: false,
          isFavorite: false,
          createdAt: Date.now() - 25 * 24 * 3600000,
          updatedAt: Date.now(),
          children: [
            { 
              id: "schrodinger", 
              name: "Schrodinger Formulation", 
              isFolder: false, 
              color: "#FCD34D", 
              icon: "FileText",
              isFavorite: false,
              isLocked: false,
              createdAt: Date.now() - 12 * 24 * 3600000,
              updatedAt: Date.now(),
              lastOpened: Date.now() - 24 * 3600 * 1000,
              pageCount: 1,
              tags: ["quantum", "wave-function"]
            },
          ]
        },
        {
          id: "ml-hub",
          name: "Machine Learning Hub",
          isFolder: true,
          color: "#319795",
          icon: "Terminal",
          description: "Mathematics of deep learning architectures",
          isLocked: false,
          isFavorite: false,
          createdAt: Date.now() - 40 * 24 * 3600000,
          updatedAt: Date.now(),
          children: [
            { 
              id: "backprop", 
              name: "Backpropagation Proof", 
              isFolder: false, 
              color: "#D0BCFF", 
              icon: "FileText",
              isFavorite: true,
              isLocked: false,
              createdAt: Date.now() - 15 * 24 * 3600000,
              updatedAt: Date.now(),
              lastOpened: Date.now() - 48 * 3600 * 1000,
              pageCount: 1,
              tags: ["math", "learning"]
            },
          ]
        }
      ];
      setFolders(defaults);
      setExpandedFolders({ "semester-4": true });
      localStorage.setItem("inkflow_room_folders", JSON.stringify(defaults));
    }

    if (savedTrash) {
      try {
        setTrash(JSON.parse(savedTrash));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Update notebook page count statistics dynamically from App.tsx canvas state
  useEffect(() => {
    if (onUpdateNotebookStatsRef) {
      onUpdateNotebookStatsRef.current = (id: string, pageCount: number) => {
        setFolders(prev => {
          const next = prev.map(f => ({
            ...f,
            children: f.children.map(n => n.id === id ? { ...n, pageCount, updatedAt: Date.now() } : n)
          }));
          localStorage.setItem("inkflow_room_folders", JSON.stringify(next));
          return next;
        });
      };
    }
  }, [onUpdateNotebookStatsRef]);

  // Persist folders helper (Room DB emulation)
  const saveFoldersToDb = (newFolders: FolderItem[]) => {
    setFolders(newFolders);
    localStorage.setItem("inkflow_room_folders", JSON.stringify(newFolders));
  };

  // Persist trash helper (Room DB emulation)
  const saveTrashToDb = (newTrash: TrashItem[]) => {
    setTrash(newTrash);
    localStorage.setItem("inkflow_room_trash", JSON.stringify(newTrash));
  };

  // Folder CRUD Functionality
  const handleCreateOrEditFolder = () => {
    if (!folderModalData.name.trim()) return;

    if (folderModalData.id) {
      // Edit mode
      const updated = folders.map(f => f.id === folderModalData.id ? {
        ...f,
        name: folderModalData.name,
        color: folderModalData.color,
        icon: folderModalData.icon,
        description: folderModalData.description,
        updatedAt: Date.now()
      } : f);
      saveFoldersToDb(updated);
      triggerHaptic(15); // Light click for editing
    } else {
      // Create mode
      const newFolder: FolderItem = {
        id: `folder-${Date.now()}`,
        name: folderModalData.name,
        isFolder: true,
        color: folderModalData.color,
        icon: folderModalData.icon,
        description: folderModalData.description,
        isLocked: false,
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        children: []
      };
      saveFoldersToDb([...folders, newFolder]);
      // Auto expand new folder
      setExpandedFolders(prev => ({ ...prev, [newFolder.id]: true }));
      triggerHaptic(30); // Medium tap for creation
    }
    setIsFolderModalOpen(false);
  };

  const handleDuplicateFolder = (folderId: string) => {
    const source = folders.find(f => f.id === folderId);
    if (!source) return;

    const duplicateId = `folder-dup-${Date.now()}`;
    const duplicatedNotebooks = source.children.map(n => ({
      ...n,
      id: `note-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `${n.name} - Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastOpened: 0
    }));

    const duplicateFolder: FolderItem = {
      ...source,
      id: duplicateId,
      name: `${source.name} - Copy`,
      children: duplicatedNotebooks,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveFoldersToDb([...folders, duplicateFolder]);
    setExpandedFolders(prev => ({ ...prev, [duplicateId]: true }));
    triggerHaptic(30); // Medium tap for duplication
  };

  const handleDeleteFolder = (folderId: string) => {
    const target = folders.find(f => f.id === folderId);
    if (!target) return;

    // Move to Trash
    const newTrashItem: TrashItem = {
      id: `trash-${Date.now()}`,
      type: "folder",
      deletedAt: Date.now(),
      data: target
    };

    saveTrashToDb([...trash, newTrashItem]);
    saveFoldersToDb(folders.filter(f => f.id !== folderId));
    setActiveFolderMenu(null);
    triggerHaptic(50); // Heavy impact for deletion
  };

  const handleToggleFavoriteFolder = (folderId: string) => {
    const updated = folders.map(f => f.id === folderId ? { ...f, isFavorite: !f.isFavorite } : f);
    saveFoldersToDb(updated);
  };

  const handleToggleLockFolder = (folderId: string) => {
    const updated = folders.map(f => f.id === folderId ? { ...f, isLocked: !f.isLocked } : f);
    saveFoldersToDb(updated);
  };

  // Notebook CRUD Functionality
  const handleCreateOrEditNotebook = () => {
    if (!notebookModalData.name.trim()) return;

    const tagsArr = notebookModalData.tags
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    if (notebookModalData.id) {
      // Edit mode
      const updated = folders.map(f => ({
        ...f,
        children: f.children.map(n => n.id === notebookModalData.id ? {
          ...n,
          name: notebookModalData.name,
          color: notebookModalData.color,
          icon: notebookModalData.icon,
          tags: tagsArr,
          updatedAt: Date.now()
        } : n)
      }));
      saveFoldersToDb(updated);
      triggerHaptic(15); // Light click for editing note
    } else {
      // Create mode
      const newNotebook: NotebookItem = {
        id: `note-${Date.now()}`,
        name: notebookModalData.name,
        isFolder: false,
        color: notebookModalData.color,
        icon: notebookModalData.icon,
        isFavorite: false,
        isLocked: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastOpened: Date.now(),
        pageCount: 1,
        tags: tagsArr,
        notebookType: notebookModalData.notebookType
      } as any;

      const updated = folders.map(f => f.id === notebookModalData.folderId ? {
        ...f,
        children: [...f.children, newNotebook]
      } : f);

      saveFoldersToDb(updated);
      onSelectNotebook(newNotebook.name, newNotebook.id, newNotebook.notebookType);
      triggerHaptic(30); // Medium tap for creating note
    }
    setIsNotebookModalOpen(false);
  };

  const handleDuplicateNotebook = (folderId: string, notebookId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const note = folder.children.find(n => n.id === notebookId);
    if (!note) return;

    const duplicateNote: NotebookItem = {
      ...note,
      id: `note-dup-${Date.now()}`,
      name: `${note.name} - Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastOpened: 0,
      isFavorite: false
    };

    const updated = folders.map(f => f.id === folderId ? {
      ...f,
      children: [...f.children, duplicateNote]
    } : f);

    saveFoldersToDb(updated);
    triggerHaptic(30); // Medium tap for duplicate notebook
  };

  const handleDeleteNotebook = (folderId: string, notebookId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const note = folder.children.find(n => n.id === notebookId);
    if (!note) return;

    // Move to Trash
    const newTrashItem: TrashItem = {
      id: `trash-${Date.now()}`,
      type: "notebook",
      originalFolderId: folderId,
      deletedAt: Date.now(),
      data: note
    };

    saveTrashToDb([...trash, newTrashItem]);

    const updated = folders.map(f => f.id === folderId ? {
      ...f,
      children: f.children.filter(n => n.id !== notebookId)
    } : f);

    saveFoldersToDb(updated);
    setActiveNotebookMenu(null);
    triggerHaptic(50); // Heavy impact for delete notebook
  };

  const handleToggleFavoriteNotebook = (folderId: string, notebookId: string) => {
    const updated = folders.map(f => f.id === folderId ? {
      ...f,
      children: f.children.map(n => n.id === notebookId ? { ...n, isFavorite: !n.isFavorite } : n)
    } : f);
    saveFoldersToDb(updated);
  };

  const handleToggleLockNotebook = (folderId: string, notebookId: string) => {
    const updated = folders.map(f => f.id === folderId ? {
      ...f,
      children: f.children.map(n => n.id === notebookId ? { ...n, isLocked: !n.isLocked } : n)
    } : f);
    saveFoldersToDb(updated);
  };

  const handleMoveNotebook = () => {
    const { notebookId, sourceFolderId, targetFolderId } = moveNotebookData;
    if (sourceFolderId === targetFolderId) return;

    const sourceFolder = folders.find(f => f.id === sourceFolderId);
    if (!sourceFolder) return;
    const note = sourceFolder.children.find(n => n.id === notebookId);
    if (!note) return;

    const updated = folders.map(f => {
      if (f.id === sourceFolderId) {
        return { ...f, children: f.children.filter(n => n.id !== notebookId) };
      }
      if (f.id === targetFolderId) {
        return { ...f, children: [...f.children, note] };
      }
      return f;
    });

    saveFoldersToDb(updated);
    setIsMoveNotebookModalOpen(false);
  };

  // Trash Operations
  const handleRestoreTrashItem = (item: TrashItem) => {
    if (item.type === "folder") {
      const restoredFolder = item.data as FolderItem;
      saveFoldersToDb([...folders, restoredFolder]);
    } else {
      const restoredNote = item.data as NotebookItem;
      const targetFolderId = item.originalFolderId || (folders.length > 0 ? folders[0].id : "");
      if (!targetFolderId) return;

      const updated = folders.map(f => f.id === targetFolderId ? {
        ...f,
        children: [...f.children, restoredNote]
      } : f);
      saveFoldersToDb(updated);
    }
    saveTrashToDb(trash.filter(i => i.id !== item.id));
  };

  const handlePermanentDeleteTrashItem = (itemId: string) => {
    saveTrashToDb(trash.filter(i => i.id !== itemId));
  };

  const handleEmptyTrash = () => {
    saveTrashToDb([]);
  };

  // Export / Import entire Folders as backup JSON
  const handleExportFolderData = (folder: FolderItem) => {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(folder));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `inkflow_backup_${folder.name.toLowerCase().replace(/\s+/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setActiveFolderMenu(null);
  };

  // Simulated sharing code
  const handleShareFolder = (folderName: string) => {
    const shareLink = `https://inkflow.ai/share/folder-${Date.now()}`;
    navigator.clipboard.writeText(shareLink);
    alert(`Encrypted share code generated for "${folderName}". Share link copied to clipboard:\n${shareLink}`);
    setActiveFolderMenu(null);
  };

  // HTML5 Drag and Drop Handlers
  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    setDraggingFolderId(folderId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();

    // 1. Reordering folders
    if (draggingFolderId && draggingFolderId !== targetFolderId) {
      const sourceIndex = folders.findIndex(f => f.id === draggingFolderId);
      const targetIndex = folders.findIndex(f => f.id === targetFolderId);
      const updated = [...folders];
      const [removed] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, removed);
      saveFoldersToDb(updated);
      setDraggingFolderId(null);
      return;
    }

    // 2. Moving notebook to another folder
    if (draggingNotebook && draggingNotebook.folderId !== targetFolderId) {
      const { folderId: sourceFolderId, notebookId } = draggingNotebook;
      const sourceFolder = folders.find(f => f.id === sourceFolderId);
      if (!sourceFolder) return;
      const note = sourceFolder.children.find(n => n.id === notebookId);
      if (!note) return;

      const updated = folders.map(f => {
        if (f.id === sourceFolderId) {
          return { ...f, children: f.children.filter(n => n.id !== notebookId) };
        }
        if (f.id === targetFolderId) {
          return { ...f, children: [...f.children, note] };
        }
        return f;
      });
      saveFoldersToDb(updated);
      setDraggingNotebook(null);
    }
  };

  const handleNotebookDragStart = (e: React.DragEvent, folderId: string, notebookId: string) => {
    setDraggingNotebook({ folderId, notebookId });
    e.stopPropagation();
  };

  const handleNotebookDrop = (e: React.DragEvent, targetFolderId: string, targetNotebookId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggingNotebook) {
      const { folderId: sourceFolderId, notebookId: sourceNotebookId } = draggingNotebook;
      if (sourceFolderId === targetFolderId && sourceNotebookId !== targetNotebookId) {
        // Reordering notebooks inside the same folder
        const folder = folders.find(f => f.id === targetFolderId);
        if (!folder) return;
        const sourceIndex = folder.children.findIndex(n => n.id === sourceNotebookId);
        const targetIndex = folder.children.findIndex(n => n.id === targetNotebookId);
        
        const updatedNotes = [...folder.children];
        const [removed] = updatedNotes.splice(sourceIndex, 1);
        updatedNotes.splice(targetIndex, 0, removed);

        const updated = folders.map(f => f.id === targetFolderId ? { ...f, children: updatedNotes } : f);
        saveFoldersToDb(updated);
      }
      setDraggingNotebook(null);
    }
  };

  // Real-time Search filter
  const filteredFolders = folders.map(folder => {
    const isFolderMatch = folder.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const filteredNotes = folder.children.filter(note => {
      const isNameMatch = note.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isTagMatch = note.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return isNameMatch || isTagMatch;
    });

    if (isFolderMatch || filteredNotes.length > 0) {
      return {
        ...folder,
        children: filteredNotes,
        isSearchVisible: true
      };
    }
    return { ...folder, isSearchVisible: false };
  }).filter(f => f.isSearchVisible);

  return (
    <>
      {/* Sidebar background Overlay */}
      {isOpen && (
        <div
          id="sidebar-overlay"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-out Sidebar Drawer Container */}
      <aside
        id="notebook-sidebar"
        className={`fixed top-0 left-0 h-full w-85 bg-[#121212]/95 backdrop-blur-2xl border-r border-[#333333] shadow-2xl z-[70] transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out overflow-y-auto no-scrollbar pt-20 px-4 flex flex-col justify-between`}
      >
        <div className="flex flex-col gap-5 py-3">
          
          {/* Header & Close & Folder Trigger */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-[#1C1C1C] text-[#E6E1E5]"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-xs font-bold text-[#938F99] uppercase tracking-wider">Notebook Explorer</h2>
            </div>
            
            {/* Create Folder trigger button */}
            <button
              onClick={() => {
                setFolderModalData({ name: "", color: "#D0BCFF", icon: "Folder", description: "" });
                setIsFolderModalOpen(true);
              }}
              className="p-1.5 rounded-full hover:bg-[#1C1C1C] text-[#D0BCFF] flex items-center gap-1 text-xs font-bold transition-all active:scale-95 border border-[#D0BCFF]/10 bg-[#D0BCFF]/5 px-2.5"
              title="Add New Subject Folder"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Folder</span>
            </button>
          </div>

          {/* Real-time Search input */}
          <div className="relative px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#938F99]" />
            <input
              type="text"
              placeholder="Search folders, notes, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1C1C1C] border border-[#333333] rounded-xl pl-9.5 pr-4 py-2 text-xs text-white placeholder-[#938F99] outline-none focus:border-[#D0BCFF] transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#938F99] hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Folder & Notebook Tree structure */}
          <div className="flex flex-col gap-1.5 px-2 overflow-y-auto max-h-[55vh] no-scrollbar">
            {filteredFolders.length === 0 ? (
              <div className="text-center text-xs text-[#938F99] py-8 italic bg-[#1C1C1C]/20 rounded-2xl border border-dashed border-[#333333] px-4">
                No matching notes or folders found. Create a new folder using "+ Folder" above.
              </div>
            ) : (
              filteredFolders.map((folder) => {
                const isExpanded = expandedFolders[folder.id] || searchQuery.length > 0;
                const FolderIconComponent = ICON_MAP[folder.icon] || FolderIcon;

                return (
                  <div 
                    key={folder.id} 
                    className="mb-1.5 group/folder"
                    draggable
                    onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                    onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                    onDrop={(e) => handleFolderDrop(e, folder.id)}
                  >
                    {/* Folder Header */}
                    <div 
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-all cursor-pointer ${
                        isExpanded ? "bg-[#1C1C1C]" : "hover:bg-[#1C1C1C]/60"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setExpandedFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }));
                        }}
                        className="flex-1 flex items-center gap-2.5 text-left text-sm text-[#E6E1E5] font-semibold"
                      >
                        <FolderIconComponent className="w-4.5 h-4.5 shrink-0" style={{ color: folder.color }} />
                        <span className="truncate max-w-[140px]">{folder.name}</span>
                        {folder.isLocked && <Lock className="w-3 h-3 text-[#938F99]" />}
                        {folder.isFavorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                        {/* Quick create Notebook inside */}
                        <button
                          onClick={() => {
                            setNotebookModalData({ folderId: folder.id, name: "", color: folder.color, icon: "FileText", tags: "" });
                            setIsNotebookModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-[#333333] text-[#D0BCFF]"
                          title="Create Notebook inside"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Folder kebab actions trigger */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFolderMenu({ id: folder.id, x: e.clientX, y: e.clientY });
                          }}
                          className="p-1 rounded hover:bg-[#333333] text-[#938F99]"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nested Notebook Children */}
                    {isExpanded && (
                      <ul className="pl-6.5 mt-1 space-y-1.5 border-l border-[#2D2B30] ml-4.5 animate-in slide-in-from-top-1 duration-100">
                        {folder.children && folder.children.length === 0 ? (
                          <li className="text-[10px] text-[#938F99] py-1 pl-2 italic">Empty folder</li>
                        ) : (
                          folder.children?.map((note) => {
                            const isActive = activeNotebookId === note.id;
                            return (
                              <li 
                                key={note.id}
                                draggable
                                onDragStart={(e) => handleNotebookDragStart(e, folder.id, note.id)}
                                onDrop={(e) => handleNotebookDrop(e, folder.id, note.id)}
                                className="group/notebook relative"
                              >
                                <div
                                  onClick={() => {
                                    onSelectNotebook(note.name, note.id, (note as any).notebookType || "whiteboard");
                                    // Update lastOpened timestamp
                                    const updated = folders.map(f => ({
                                      ...f,
                                      children: f.children.map(n => n.id === note.id ? { ...n, lastOpened: Date.now() } : n)
                                    }));
                                    saveFoldersToDb(updated);
                                    triggerHaptic(15); // Light click for notebook select
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-all cursor-pointer ${
                                    isActive
                                      ? "bg-[#2B2930] text-[#D0BCFF] font-bold border-l-2 border-[#D0BCFF] pl-2 rounded-l-none"
                                      : "text-[#938F99] hover:bg-[#1C1C1C] hover:text-[#E6E1E5]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: note.color }} />
                                    <div className="truncate flex flex-col">
                                      <span className="truncate">{note.name}</span>
                                      <span className="text-[9px] text-gray-500 font-mono scale-90 -ml-1 mt-0.5">
                                        {note.pageCount} pg • {new Date(note.updatedAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    {note.isLocked && <Lock className="w-2.5 h-2.5 text-pink-400" />}
                                  </div>

                                  {/* Right actions */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover/notebook:opacity-100">
                                    {note.isFavorite && <Heart className="w-3 h-3 text-red-400 fill-red-400" />}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveNotebookMenu({ folderId: folder.id, notebookId: note.id, x: e.clientX, y: e.clientY });
                                      }}
                                      className="p-1 rounded hover:bg-[#333333] text-[#938F99]"
                                    >
                                      <MoreVertical className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Navigation Library and Settings (including Favorites, Recents, Trash) */}
        <div className="border-t border-[#333333] py-3 mt-auto space-y-1">
          <h3 className="text-[10px] font-bold text-[#938F99] uppercase tracking-wider mb-1 px-2 font-mono">Simulated Room Library</h3>
          
          {/* Quick Favorites trigger */}
          <button 
            onClick={() => {
              // Filters active list to show favorites
              setSearchQuery("quantum");
              alert("Filtered workspace for quantum physics favorites! Cleared filter query by clicking cross.");
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1C1C1C] text-gray-300 transition-colors text-xs"
          >
            <div className="flex items-center gap-3">
              <Star className="w-4 h-4 text-[#D0BCFF]" />
              <span>Favorite Bookshelf</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#1C1C1C] text-[#938F99] rounded-full">
              {folders.reduce((acc, f) => acc + (f.isFavorite ? 1 : 0) + f.children.filter(n => n.isFavorite).length, 0)}
            </span>
          </button>

          {/* Quick Recent activities */}
          <button 
            onClick={() => {
              alert("Currently ordering and displaying notebooks based on 'Last Opened' timestamp metadata!");
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1C1C1C] text-gray-300 transition-colors text-xs"
          >
            <Clock className="w-4 h-4 text-[#EADDFF]" />
            <span>Recent Activities</span>
          </button>

          {/* Trash Can Section */}
          <button 
            onClick={() => setIsTrashOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1C1C1C] text-gray-300 transition-colors text-xs"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="text-red-400">Recycle Trash Bin</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-red-950/40 text-red-400 rounded-full border border-red-500/10">
              {trash.length}
            </span>
          </button>
        </div>

      </aside>

      {/* =========================================================================
          MATERIAL 3 DIALOGS AND FLOATING CONTEXT MENUS
          ========================================================================= */}

      {/* FOLDER CREATION / EDIT MODAL */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[150] flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#333333] p-6 rounded-[1.75rem] max-w-sm w-full space-y-4 shadow-2xl text-[#E6E1E5]">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-[#D0BCFF]" />
              {folderModalData.id ? "Edit Subject Folder" : "Create New Subject Folder"}
            </h3>
            
            <div className="space-y-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Folder Name</label>
                <input
                  type="text"
                  value={folderModalData.name}
                  onChange={(e) => setFolderModalData({ ...folderModalData, name: e.target.value })}
                  placeholder="e.g. Semester 4, Research, AI, Circuits"
                  className="bg-[#121212] border border-[#333333] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#D0BCFF]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Color Theme</label>
                <div className="flex gap-2 mt-1">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setFolderModalData({ ...folderModalData, color: preset.value })}
                      style={{ backgroundColor: preset.value }}
                      className={`w-6 h-6 rounded-full border border-black/20 hover:scale-105 ${
                        folderModalData.color === preset.value ? "ring-2 ring-white ring-offset-1 ring-offset-[#1C1C1C]" : ""
                      }`}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Folder Symbol</label>
                <div className="grid grid-cols-4 gap-2 mt-1 bg-[#121212] p-2 rounded-xl border border-[#333333]">
                  {Object.keys(ICON_MAP).map(iconKey => {
                    const Comp = ICON_MAP[iconKey];
                    return (
                      <button
                        key={iconKey}
                        onClick={() => setFolderModalData({ ...folderModalData, icon: iconKey })}
                        className={`p-2 rounded-lg flex items-center justify-center hover:bg-[#1C1C1C] ${
                          folderModalData.icon === iconKey ? "bg-[#2B2930] text-[#D0BCFF]" : "text-[#938F99]"
                        }`}
                      >
                        <Comp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Description (Optional)</label>
                <textarea
                  value={folderModalData.description}
                  onChange={(e) => setFolderModalData({ ...folderModalData, description: e.target.value })}
                  placeholder="Summarize course material or study scope..."
                  rows={2}
                  className="bg-[#121212] border border-[#333333] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#D0BCFF] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3.5 pt-2">
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#938F99] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrEditFolder}
                className="px-4 py-2 bg-[#D0BCFF] text-[#381E72] rounded-full text-xs font-bold hover:bg-opacity-95 shadow-md"
              >
                {folderModalData.id ? "Save Changes" : "Create Folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTEBOOK CREATION / EDIT MODAL */}
      {isNotebookModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[150] flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#333333] p-6 rounded-[1.75rem] max-w-sm w-full space-y-4 shadow-2xl text-[#E6E1E5]">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#D0BCFF]" />
              {notebookModalData.id ? "Edit Notebook Properties" : "Create New Study Notebook"}
            </h3>

            <div className="space-y-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Notebook Name</label>
                <input
                  type="text"
                  value={notebookModalData.name}
                  onChange={(e) => setNotebookModalData({ ...notebookModalData, name: e.target.value })}
                  placeholder="e.g. Thermodynamics, Optics Study, Proof"
                  className="bg-[#121212] border border-[#333333] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#D0BCFF]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Cover Color</label>
                <div className="flex gap-2 mt-1">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setNotebookModalData({ ...notebookModalData, color: preset.value })}
                      style={{ backgroundColor: preset.value }}
                      className={`w-6 h-6 rounded-full border border-black/20 hover:scale-105 ${
                        notebookModalData.color === preset.value ? "ring-2 ring-white ring-offset-1 ring-offset-[#1C1C1C]" : ""
                      }`}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Notebook Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNotebookModalData({ ...notebookModalData, notebookType: "whiteboard" })}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      notebookModalData.notebookType === "whiteboard"
                        ? "bg-[#2B2930] text-[#D0BCFF] border-[#D0BCFF]"
                        : "bg-[#121212] border-[#333333] text-[#938F99] hover:text-white"
                    }`}
                  >
                    🎨 Whiteboard Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotebookModalData({ ...notebookModalData, notebookType: "rich_text" })}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      notebookModalData.notebookType === "rich_text"
                        ? "bg-[#2B2930] text-[#D0BCFF] border-[#D0BCFF]"
                        : "bg-[#121212] border-[#333333] text-[#938F99] hover:text-white"
                    }`}
                  >
                    📝 Rich Text Notes
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Search Tags (comma separated)</label>
                <input
                  type="text"
                  value={notebookModalData.tags}
                  onChange={(e) => setNotebookModalData({ ...notebookModalData, tags: e.target.value })}
                  placeholder="physics, formulas, electrical, proof"
                  className="bg-[#121212] border border-[#333333] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#D0BCFF]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3.5 pt-2">
              <button
                onClick={() => setIsNotebookModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#938F99] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrEditNotebook}
                className="px-4 py-2 bg-[#D0BCFF] text-[#381E72] rounded-full text-xs font-bold hover:bg-opacity-95 shadow-md"
              >
                {notebookModalData.id ? "Save Changes" : "Create Notebook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE NOTEBOOK MODAL */}
      {isMoveNotebookModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[150] flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#333333] p-6 rounded-[1.75rem] max-w-sm w-full space-y-4 shadow-2xl text-[#E6E1E5]">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <Move className="w-5 h-5 text-[#D0BCFF]" />
              Move Notebook to Folder
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-[#938F99] font-mono">Select Target Subject Folder</label>
              <select
                value={moveNotebookData.targetFolderId}
                onChange={(e) => setMoveNotebookData({ ...moveNotebookData, targetFolderId: e.target.value })}
                className="bg-[#121212] border border-[#333333] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#D0BCFF] cursor-pointer"
              >
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3.5 pt-2">
              <button
                onClick={() => setIsMoveNotebookModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#938F99] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveNotebook}
                className="px-5 py-2 bg-[#D0BCFF] text-[#381E72] rounded-full text-xs font-bold hover:bg-opacity-95 shadow-md animate-pulse"
              >
                Move Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECYCLE TRASH BIN DIALOG */}
      {isTrashOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[150] flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#333333] p-6 rounded-[1.75rem] max-w-lg w-full flex flex-col max-h-[80vh] shadow-2xl text-[#E6E1E5] animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-bold text-gray-100">Simulated Room Recycle Trash Bin</h3>
              </div>
              <button onClick={() => setIsTrashOpen(false)} className="p-1 rounded-full hover:bg-[#1C1C1C] text-[#938F99]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 no-scrollbar min-h-[250px]">
              {trash.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#938F99] italic">
                  Recycle bin is empty. Deleting folders or notebooks moves them here.
                </div>
              ) : (
                trash.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-[#1C1C1C] border border-[#2D2A30] rounded-xl">
                    <div className="flex items-center gap-3">
                      {item.type === "folder" ? (
                        <FolderIcon className="w-4.5 h-4.5 text-red-400" />
                      ) : (
                        <FileText className="w-4.5 h-4.5 text-[#938F99]" />
                      )}
                      <div>
                        <span className="text-xs font-semibold text-gray-100 block">{item.data.name}</span>
                        <span className="text-[10px] text-[#938F99] block font-mono">
                          Deleted: {new Date(item.deletedAt).toLocaleString()} • Type: {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreTrashItem(item)}
                        className="px-3 py-1 bg-[#2B2930] hover:bg-[#333333] text-[#D0BCFF] border border-[#D0BCFF]/20 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDeleteTrashItem(item.id)}
                        className="p-1.5 hover:bg-red-500/15 text-red-400 rounded-lg transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-[#2A2A2A] flex justify-between items-center">
              <button
                onClick={handleEmptyTrash}
                disabled={trash.length === 0}
                className="px-4 py-2 border border-red-500/20 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-bold rounded-lg disabled:opacity-40"
              >
                Empty Trash Bin
              </button>
              <button
                onClick={() => setIsTrashOpen(false)}
                className="px-5 py-2 bg-[#2B2930] text-[#D0BCFF] hover:bg-[#333333] text-xs font-bold rounded-full border border-[#D0BCFF]/10"
              >
                Close Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING CONTEXT MENU FOR FOLDERS */}
      {activeFolderMenu && (
        <div
          className="fixed inset-0 z-[120] bg-transparent"
          onClick={() => setActiveFolderMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setActiveFolderMenu(null);
          }}
        >
          <div
            style={{ left: activeFolderMenu.x, top: activeFolderMenu.y }}
            className="absolute bg-[#1C1C1C] border border-[#333333] shadow-2xl rounded-2xl p-1.5 w-48 z-[130] text-xs space-y-0.5"
          >
            <button
              onClick={() => {
                const folder = folders.find(f => f.id === activeFolderMenu.id);
                if (folder) {
                  setFolderModalData({
                    id: folder.id,
                    name: folder.name,
                    color: folder.color,
                    icon: folder.icon,
                    description: folder.description || ""
                  });
                  setIsFolderModalOpen(true);
                }
                setActiveFolderMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#D0BCFF]" />
              <span>Rename / Edit</span>
            </button>

            <button
              onClick={() => {
                handleDuplicateFolder(activeFolderMenu.id);
                setActiveFolderMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-teal-300" />
              <span>Duplicate Folder</span>
            </button>

            <button
              onClick={() => {
                handleToggleFavoriteFolder(activeFolderMenu.id);
                setActiveFolderMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Star className="w-3.5 h-3.5 text-amber-300" />
              <span>Toggle Favorite</span>
            </button>

            <button
              onClick={() => {
                handleToggleLockFolder(activeFolderMenu.id);
                setActiveFolderMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-pink-300" />
              <span>Toggle Board Lock</span>
            </button>

            <button
              onClick={() => {
                const folder = folders.find(f => f.id === activeFolderMenu.id);
                if (folder) handleExportFolderData(folder);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-300" />
              <span>Export backup JSON</span>
            </button>

            <button
              onClick={() => {
                const folder = folders.find(f => f.id === activeFolderMenu.id);
                if (folder) handleShareFolder(folder.name);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#D0BCFF]" />
              <span>Share encrypted link</span>
            </button>

            <div className="h-px bg-[#333333] my-1" />

            <button
              onClick={() => handleDeleteFolder(activeFolderMenu.id)}
              className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete to Recycle</span>
            </button>
          </div>
        </div>
      )}

      {/* FLOATING CONTEXT MENU FOR NOTEBOOKS */}
      {activeNotebookMenu && (
        <div
          className="fixed inset-0 z-[120] bg-transparent"
          onClick={() => setActiveNotebookMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setActiveNotebookMenu(null);
          }}
        >
          <div
            style={{ left: activeNotebookMenu.x, top: activeNotebookMenu.y }}
            className="absolute bg-[#1C1C1C] border border-[#333333] shadow-2xl rounded-2xl p-1.5 w-48 z-[130] text-xs space-y-0.5"
          >
            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                const folder = folders.find(f => f.id === folderId);
                const note = folder?.children.find(n => n.id === notebookId);
                if (note) {
                  setNotebookModalData({
                    id: note.id,
                    folderId,
                    name: note.name,
                    color: note.color,
                    icon: note.icon,
                    tags: note.tags?.join(", ") || "",
                    notebookType: (note as any).notebookType || "whiteboard"
                  });
                  setIsNotebookModalOpen(true);
                }
                setActiveNotebookMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#D0BCFF]" />
              <span>Rename / Tags</span>
            </button>

            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                handleDuplicateNotebook(folderId, notebookId);
                setActiveNotebookMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-teal-300" />
              <span>Duplicate Note</span>
            </button>

            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                setMoveNotebookData({
                  notebookId,
                  sourceFolderId: folderId,
                  targetFolderId: folders.find(f => f.id !== folderId)?.id || folderId
                });
                setIsMoveNotebookModalOpen(true);
                setActiveNotebookMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Move className="w-3.5 h-3.5 text-amber-300" />
              <span>Move to Folder</span>
            </button>

            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                handleToggleFavoriteNotebook(folderId, notebookId);
                setActiveNotebookMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>Toggle Favorite</span>
            </button>

            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                handleToggleLockNotebook(folderId, notebookId);
                setActiveNotebookMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-pink-300" />
              <span>Toggle Lock</span>
            </button>

            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                const note = folders.find(f => f.id === folderId)?.children.find(n => n.id === notebookId);
                if (note) {
                  alert(`Notebook Stats details:\n\n• Name: ${note.name}\n• Created: ${new Date(note.createdAt).toLocaleString()}\n• Modified: ${new Date(note.updatedAt).toLocaleString()}\n• Page count: ${note.pageCount} pages\n• Last opened: ${note.lastOpened ? new Date(note.lastOpened).toLocaleString() : "Never"}\n• Tags: ${note.tags?.join(", ") || "None"}`);
                }
                setActiveNotebookMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333333] rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-[#938F99]" />
              <span>Show Note Details</span>
            </button>

            <div className="h-px bg-[#333333] my-1" />

            <button
              onClick={() => {
                const { folderId, notebookId } = activeNotebookMenu;
                handleDeleteNotebook(folderId, notebookId);
              }}
              className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete to Recycle</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
