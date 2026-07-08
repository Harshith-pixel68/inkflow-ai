import React, { useState } from "react";
import { 
  Layers, Lock, Unlock, Eye, EyeOff, Trash2, Copy, 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Search, Edit3, Type, Image, FileText, Square, 
  Volume2, FolderPlus, Grid, CheckSquare, RefreshCw,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Sparkles
} from "lucide-react";
import { CanvasObject } from "../types";

interface LayersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasObjects: CanvasObject[];
  onUpdateObjects: (objs: CanvasObject[]) => void;
}

export default function LayersPanel({
  isOpen,
  onClose,
  canvasObjects,
  onUpdateObjects
}: LayersPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showSmartGroupMenu, setShowSmartGroupMenu] = useState(false);
  const [smartGroupNotification, setSmartGroupNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  // Since canvasObjects is rendered back-to-front (index 0 is bottom-most, last index is top-most),
  // in a layers panel, we want to show layers in visual order: top-most layer at the top of the list (reverse of array index).
  // We'll work with the list and map actions back to their original canvasObjects array.
  
  // Create an array with original index references
  const layersList = canvasObjects.map((obj, index) => ({
    obj,
    originalIndex: index
  }));

  // Visual layers list (top-most layer at the top)
  const visualLayersList = [...layersList].reverse();

  // Filter list based on search query
  const filteredLayers = visualLayersList.filter(item => {
    const typeLabel = getLayerTypeLabel(item.obj);
    const customName = item.obj.name || "";
    const searchTarget = `${typeLabel} ${customName} ${item.obj.type} ${item.obj.shapeType || ""}`.toLowerCase();
    return searchTarget.includes(searchQuery.toLowerCase());
  });

  // Get localized label for the layer
  function getLayerTypeLabel(obj: CanvasObject): string {
    switch (obj.type) {
      case "handwriting":
        return "Freehand Stroke";
      case "text":
        return "Text Box";
      case "formula":
        return "Math Formula";
      case "image":
        return "Image Asset";
      case "table":
        return "Structured Table";
      case "voice":
        return "Voice Note";
      case "group":
        return "Grouped Objects";
      case "shape":
        if (obj.shapeType) {
          const formatted = obj.shapeType.charAt(0).toUpperCase() + obj.shapeType.slice(1);
          if (["resistor", "battery", "lamp"].includes(obj.shapeType)) {
            return `${formatted} (Circuit)`;
          }
          return `${formatted} (Shape)`;
        }
        return "Vector Shape";
      default:
        return "Canvas Layer";
    }
  }

  // Get suitable Lucide Icon for thumbnail rendering
  function getLayerIcon(obj: CanvasObject) {
    const cls = "w-4 h-4";
    switch (obj.type) {
      case "handwriting":
        return <Edit3 className={`${cls} text-amber-400`} />;
      case "text":
        return <Type className={`${cls} text-blue-400`} />;
      case "formula":
        return <FileText className={`${cls} text-emerald-400`} />;
      case "image":
        return <Image className={`${cls} text-indigo-400`} />;
      case "table":
        return <Grid className={`${cls} text-cyan-400`} />;
      case "voice":
        return <Volume2 className={`${cls} text-rose-400`} />;
      case "group":
        return <FolderPlus className={`${cls} text-purple-400`} />;
      case "shape":
        return <Square className={`${cls} text-[#D0BCFF]`} />;
      default:
        return <Layers className={`${cls} text-gray-400`} />;
    }
  }

  // Layer manipulation handlers
  const handleToggleLock = (originalIndex: number) => {
    const updated = [...canvasObjects];
    updated[originalIndex] = {
      ...updated[originalIndex],
      isLocked: !updated[originalIndex].isLocked,
      // If locked, we also clear selection to avoid moving
      isSelected: false,
      isLassoSelected: false
    };
    onUpdateObjects(updated);
  };

  const handleToggleVisibility = (originalIndex: number) => {
    const updated = [...canvasObjects];
    updated[originalIndex] = {
      ...updated[originalIndex],
      hidden: !updated[originalIndex].hidden,
      isSelected: false,
      isLassoSelected: false
    };
    onUpdateObjects(updated);
  };

  const handleOpacityChange = (originalIndex: number, opacity: number) => {
    const updated = [...canvasObjects];
    updated[originalIndex] = {
      ...updated[originalIndex],
      opacity: opacity
    };
    onUpdateObjects(updated);
  };

  const handleDeleteLayer = (originalIndex: number) => {
    const updated = canvasObjects.filter((_, i) => i !== originalIndex);
    onUpdateObjects(updated);
  };

  const handleDuplicateLayer = (originalIndex: number) => {
    const sourceObj = canvasObjects[originalIndex];
    const duplicate: CanvasObject = {
      ...sourceObj,
      id: `${sourceObj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      x: sourceObj.x + 30, // Offset duplication position slightly
      y: sourceObj.y + 30,
      name: sourceObj.name ? `${sourceObj.name} (Copy)` : undefined,
      isSelected: true,
      isLassoSelected: true,
      layer: Date.now()
    };
    // Clear selection on other objects
    const cleared = canvasObjects.map(o => ({ ...o, isSelected: false, isLassoSelected: false }));
    onUpdateObjects([...cleared, duplicate]);
  };

  const handleStartRename = (id: string, currentName: string, defaultLabel: string) => {
    setEditingId(id);
    setRenameValue(currentName || defaultLabel);
  };

  const handleSaveRename = (originalIndex: number) => {
    const updated = [...canvasObjects];
    updated[originalIndex] = {
      ...updated[originalIndex],
      name: renameValue.trim()
    };
    onUpdateObjects(updated);
    setEditingId(null);
  };

  // Reordering controls
  const moveLayer = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= canvasObjects.length) return;
    const updated = [...canvasObjects];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    onUpdateObjects(updated);
  };

  const bringForward = (originalIndex: number) => {
    moveLayer(originalIndex, originalIndex + 1);
  };

  const sendBackward = (originalIndex: number) => {
    moveLayer(originalIndex, originalIndex - 1);
  };

  const bringToFront = (originalIndex: number) => {
    moveLayer(originalIndex, canvasObjects.length - 1);
  };

  const sendToBack = (originalIndex: number) => {
    moveLayer(originalIndex, 0);
  };

  // Drag and drop HTML5 reordering
  const handleDragStart = (e: React.DragEvent, originalIndex: number) => {
    setDraggedIndex(originalIndex);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, originalIndex: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    const updated = [...canvasObjects];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);
    onUpdateObjects(updated);
    setDraggedIndex(null);
  };

  const handleSelectLayer = (originalIndex: number, event: React.MouseEvent) => {
    const isShiftOrCtrl = event.shiftKey || event.ctrlKey || event.metaKey;
    const updated = canvasObjects.map((obj, idx) => {
      if (idx === originalIndex) {
        return { ...obj, isSelected: !obj.isSelected, isLassoSelected: !obj.isSelected };
      }
      return isShiftOrCtrl ? obj : { ...obj, isSelected: false, isLassoSelected: false };
    });
    onUpdateObjects(updated);
  };

  const selectedCount = canvasObjects.filter(o => o.isSelected).length;

  const handleBulkToggleLock = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    const anyUnlocked = selected.some(o => !o.isLocked);
    const updated = canvasObjects.map(o => {
      if (o.isSelected) {
        return { 
          ...o, 
          isLocked: anyUnlocked, 
          isSelected: !anyUnlocked ? o.isSelected : false, 
          isLassoSelected: !anyUnlocked ? o.isLassoSelected : false 
        };
      }
      return o;
    });
    onUpdateObjects(updated);
  };

  const handleBulkToggleVisibility = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    const anyVisible = selected.some(o => !o.hidden);
    const updated = canvasObjects.map(o => {
      if (o.isSelected) {
        return { 
          ...o, 
          hidden: anyVisible, 
          isSelected: !anyVisible ? o.isSelected : false, 
          isLassoSelected: !anyVisible ? o.isLassoSelected : false 
        };
      }
      return o;
    });
    onUpdateObjects(updated);
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedCount} selected layers?`)) {
      const updated = canvasObjects.filter(o => !o.isSelected);
      onUpdateObjects(updated);
    }
  };

  const handleBulkDuplicate = () => {
    const duplicates: CanvasObject[] = [];
    const cleared = canvasObjects.map(o => {
      if (o.isSelected) {
        const dup: CanvasObject = {
          ...o,
          id: `${o.type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          x: o.x + 30,
          y: o.y + 30,
          name: o.name ? `${o.name} (Copy)` : undefined,
          isSelected: true,
          isLassoSelected: true,
          layer: Date.now()
        };
        duplicates.push(dup);
        return { ...o, isSelected: false, isLassoSelected: false };
      }
      return o;
    });
    onUpdateObjects([...cleared, ...duplicates]);
  };

  const handleBulkOpacityChange = (opacity: number) => {
    const updated = canvasObjects.map(o => {
      if (o.isSelected) {
        return { ...o, opacity };
      }
      return o;
    });
    onUpdateObjects(updated);
  };

  const getObjectDimensionsLocal = (o: CanvasObject) => {
    if (!o) return { w: 100, h: 80 };
    const w = o.width || (o.type === "text" || o.type === "formula" ? 350 : o.type === "table" ? 450 : 100);
    const h = o.height || (o.type === "text" || o.type === "formula" ? 60 : o.type === "table" ? 180 : 80);
    return { w, h };
  };

  const handleBulkAlignLeft = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    if (selected.length < 2) return;
    const minX = Math.min(...selected.map(o => o.x));
    const updated = canvasObjects.map(o => {
      if (o.isSelected) {
        return { ...o, x: minX };
      }
      return o;
    });
    onUpdateObjects(updated);
  };

  const handleBulkAlignCenter = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    if (selected.length < 2) return;
    const minX = Math.min(...selected.map(o => o.x));
    const maxX = Math.max(...selected.map(o => o.x + getObjectDimensionsLocal(o).w));
    const groupCenter = minX + (maxX - minX) / 2;

    const updated = canvasObjects.map(o => {
      if (o.isSelected) {
        const { w } = getObjectDimensionsLocal(o);
        return { ...o, x: Math.round(groupCenter - w / 2) };
      }
      return o;
    });
    onUpdateObjects(updated);
  };

  const handleBulkAlignRight = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    if (selected.length < 2) return;
    const maxX = Math.max(...selected.map(o => o.x + getObjectDimensionsLocal(o).w));
    const updated = canvasObjects.map(o => {
      if (o.isSelected) {
        const { w } = getObjectDimensionsLocal(o);
        return { ...o, x: maxX - w };
      }
      return o;
    });
    onUpdateObjects(updated);
  };

  const handleBulkDistributeSpaced = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    if (selected.length < 3) {
      alert("Please select at least 3 layers to distribute.");
      return;
    }

    const minX = Math.min(...selected.map(o => o.x));
    const maxX = Math.max(...selected.map(o => o.x + getObjectDimensionsLocal(o).w));
    const minY = Math.min(...selected.map(o => o.y));
    const maxY = Math.max(...selected.map(o => o.y + getObjectDimensionsLocal(o).h));
    
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    const isMostlyVertical = boundingHeight > boundingWidth;

    let updatedSelectedMap = new Map<string, CanvasObject>();

    if (isMostlyVertical) {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const span = (last.y + getObjectDimensionsLocal(last).h) - first.y;
      const sumHeights = sorted.reduce((sum, o) => sum + getObjectDimensionsLocal(o).h, 0);
      const gap = (span - sumHeights) / (sorted.length - 1);

      let currentY = sorted[0].y;
      sorted.forEach((o, idx) => {
        const { h } = getObjectDimensionsLocal(o);
        if (idx === 0) {
          currentY += h;
          updatedSelectedMap.set(o.id, o);
          return;
        }
        if (idx === sorted.length - 1) {
          updatedSelectedMap.set(o.id, o);
          return;
        }
        const newY = currentY + gap;
        currentY = newY + h;
        updatedSelectedMap.set(o.id, { ...o, y: Math.round(newY) });
      });
    } else {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const span = (last.x + getObjectDimensionsLocal(last).w) - first.x;
      const sumWidths = sorted.reduce((sum, o) => sum + getObjectDimensionsLocal(o).w, 0);
      const gap = (span - sumWidths) / (sorted.length - 1);

      let currentX = sorted[0].x;
      sorted.forEach((o, idx) => {
        const { w } = getObjectDimensionsLocal(o);
        if (idx === 0) {
          currentX += w;
          updatedSelectedMap.set(o.id, o);
          return;
        }
        if (idx === sorted.length - 1) {
          updatedSelectedMap.set(o.id, o);
          return;
        }
        const newX = currentX + gap;
        currentX = newX + w;
        updatedSelectedMap.set(o.id, { ...o, x: Math.round(newX) });
      });
    }

    const updated = canvasObjects.map(o => {
      if (updatedSelectedMap.has(o.id)) {
        return updatedSelectedMap.get(o.id)!;
      }
      return o;
    });

    onUpdateObjects(updated);
  };

  const handleSmartGroupByType = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    if (selected.length < 2) {
      alert("Please select at least 2 layers to run Smart Grouping.");
      return;
    }

    // Group items by their type
    const typeGroups: { [key: string]: CanvasObject[] } = {};
    selected.forEach(o => {
      const key = o.type === "shape" ? `shape-${o.shapeType || 'generic'}` : o.type;
      if (!typeGroups[key]) {
        typeGroups[key] = [];
      }
      typeGroups[key].push(o);
    });

    let groupCount = 0;
    const generatedGroupIds: { [key: string]: string } = {};
    Object.keys(typeGroups).forEach(key => {
      if (typeGroups[key].length >= 2) {
        generatedGroupIds[key] = `group-type-${key}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        groupCount++;
      }
    });

    if (groupCount === 0) {
      alert("No shared object types with 2 or more items were found in your selection to group.");
      return;
    }

    const finalObjects = canvasObjects.map(o => {
      if (o.isSelected) {
        const key = o.type === "shape" ? `shape-${o.shapeType || 'generic'}` : o.type;
        const groupId = generatedGroupIds[key];
        if (groupId) {
          return {
            ...o,
            groupId,
            isSelected: false,
            isLassoSelected: false
          };
        }
      }
      return o;
    });

    onUpdateObjects(finalObjects);
    setShowSmartGroupMenu(false);
    
    const summary = Object.entries(typeGroups)
      .filter(([_, items]) => items.length >= 2)
      .map(([key, items]) => `${items.length}x ${key.replace('shape-', '')}`)
      .join(", ");
    
    setSmartGroupNotification(`Smart Grouped by Type: ${summary}`);
    setTimeout(() => setSmartGroupNotification(null), 4000);
  };

  const handleSmartGroupByProximity = () => {
    const selected = canvasObjects.filter(o => o.isSelected);
    if (selected.length < 2) {
      alert("Please select at least 2 layers to run Smart Grouping.");
      return;
    }

    // Get centers of all selected items
    const itemsWithCenters = selected.map(o => {
      const { w, h } = getObjectDimensionsLocal(o);
      return {
        o,
        cx: o.x + w / 2,
        cy: o.y + h / 2
      };
    });

    // Distance threshold: 300px
    const THRESHOLD = 300;

    // Build adjacency list for connected components
    const adj: { [id: string]: string[] } = {};
    itemsWithCenters.forEach(item => {
      adj[item.o.id] = [];
    });

    for (let i = 0; i < itemsWithCenters.length; i++) {
      for (let j = i + 1; j < itemsWithCenters.length; j++) {
        const dist = Math.sqrt(
          Math.pow(itemsWithCenters[i].cx - itemsWithCenters[j].cx, 2) +
          Math.pow(itemsWithCenters[i].cy - itemsWithCenters[j].cy, 2)
        );
        if (dist <= THRESHOLD) {
          adj[itemsWithCenters[i].o.id].push(itemsWithCenters[j].o.id);
          adj[itemsWithCenters[j].o.id].push(itemsWithCenters[i].o.id);
        }
      }
    }

    // Find connected components (BFS)
    const visited = new Set<string>();
    const components: string[][] = [];

    itemsWithCenters.forEach(item => {
      const id = item.o.id;
      if (!visited.has(id)) {
        const comp: string[] = [];
        const queue = [id];
        visited.add(id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          comp.push(curr);

          (adj[curr] || []).forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
        components.push(comp);
      }
    });

    // Create group IDs for components with size >= 2
    const objIdToGroupId: { [id: string]: string } = {};
    let groupCount = 0;

    components.forEach((comp, idx) => {
      if (comp.length >= 2) {
        const groupId = `group-prox-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
        comp.forEach(id => {
          objIdToGroupId[id] = groupId;
        });
        groupCount++;
      }
    });

    if (groupCount === 0) {
      alert("Selected items are too far apart (threshold: 300px) to form proximity groups.");
      return;
    }

    const finalObjects = canvasObjects.map(o => {
      if (o.isSelected) {
        const groupId = objIdToGroupId[o.id];
        if (groupId) {
          return {
            ...o,
            groupId,
            isSelected: false,
            isLassoSelected: false
          };
        }
      }
      return o;
    });

    onUpdateObjects(finalObjects);
    setShowSmartGroupMenu(false);

    setSmartGroupNotification(`Smart Grouped by Proximity into ${groupCount} separate spatial cluster(s).`);
    setTimeout(() => setSmartGroupNotification(null), 4000);
  };

  // Select all or deselect all layers
  const handleSelectAll = (select: boolean) => {
    const updated = canvasObjects.map(obj => ({
      ...obj,
      isSelected: select,
      isLassoSelected: select
    }));
    onUpdateObjects(updated);
  };

  // Group selected layers
  const handleGroupSelected = () => {
    const selectedIndices = canvasObjects
      .map((o, idx) => ({ o, idx }))
      .filter(item => item.o.isSelected);
    
    if (selectedIndices.length < 2) {
      alert("Please select at least 2 layers using Shift+Click or Ctrl+Click to group.");
      return;
    }

    const groupId = `group-${Date.now()}`;
    const updated = canvasObjects.map((obj) => {
      if (obj.isSelected) {
        return {
          ...obj,
          groupId: groupId,
          isSelected: false,
          isLassoSelected: false
        };
      }
      return obj;
    });

    onUpdateObjects(updated);
  };

  const handleUngroupSelected = () => {
    const selectedWithGroup = canvasObjects.filter(o => o.isSelected && o.groupId);
    if (selectedWithGroup.length === 0) {
      alert("Please select an item inside a group to ungroup.");
      return;
    }

    const groupIdsToUngroup = Array.from(new Set(selectedWithGroup.map(o => o.groupId)));
    const updated = canvasObjects.map((obj) => {
      if (obj.groupId && groupIdsToUngroup.includes(obj.groupId)) {
        return {
          ...obj,
          groupId: undefined
        };
      }
      return obj;
    });

    onUpdateObjects(updated);
  };

  return (
    <div className="fixed right-4 top-24 z-[100] w-96 max-h-[70vh] bg-[#121212]/95 backdrop-blur-xl border border-[#333333] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col text-[#E6E1E5]">
      {/* Panel Header */}
      <div className="px-5 py-4 bg-[#1C1C1C] border-b border-[#333333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#D0BCFF]" />
          <div>
            <h2 className="text-xs font-bold text-gray-100 uppercase tracking-wider font-mono">Layers Panel</h2>
            <p className="text-[10px] text-[#938F99]">{canvasObjects.length} Object{canvasObjects.length !== 1 ? "s" : ""} on Canvas</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-[#938F99] hover:text-white text-xs font-bold font-mono p-1 rounded hover:bg-[#2B2930] transition-colors"
        >
          ✕
        </button>
      </div>

      {smartGroupNotification && (
        <div className="px-4 py-2.5 bg-[#1B122C] text-[#D0BCFF] text-[10px] font-semibold border-b border-[#D0BCFF]/20 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-300">
          <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse text-[#D0BCFF]" />
          <span className="flex-1">{smartGroupNotification}</span>
        </div>
      )}

      {/* Global Toolbar */}
      <div className="px-4 py-3 bg-[#151515] border-b border-[#333333] flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text"
            placeholder="Search layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#333333] rounded-full pl-8 pr-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-[#D0BCFF]/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleSelectAll(true)}
            title="Select All"
            className="p-1.5 hover:bg-[#2B2930] rounded text-[#938F99] hover:text-white transition-all text-[10px] font-mono uppercase tracking-wider font-semibold border border-transparent"
          >
            All
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            title="Deselect All"
            className="p-1.5 hover:bg-[#2B2930] rounded text-[#938F99] hover:text-white transition-all text-[10px] font-mono uppercase tracking-wider font-semibold border border-transparent"
          >
            None
          </button>
          <button
            onClick={handleGroupSelected}
            title="Group Selected Layers"
            className="p-1.5 hover:bg-[#2B2930] rounded text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleUngroupSelected}
            title="Ungroup Selected Layers"
            className="p-1.5 hover:bg-[#2B2930] rounded text-rose-400 hover:text-rose-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedCount > 1 && (
        <div className="px-4 py-3 bg-[#1B122C] border-b border-[#D0BCFF]/20 flex flex-col gap-2.5 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#D0BCFF] uppercase">
              ✨ Bulk Actions ({selectedCount} Selected)
            </span>
            <button
              onClick={() => handleSelectAll(false)}
              className="text-[9px] font-mono text-[#D0BCFF]/70 hover:text-[#D0BCFF] hover:underline"
            >
              Clear Selection
            </button>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-1">
              <button
                onClick={handleBulkToggleLock}
                title="Lock / Unlock Selected"
                className="p-2 bg-[#121212]/80 hover:bg-[#2B2930] border border-[#333333] rounded-lg text-amber-400 hover:text-amber-300 transition-colors flex items-center justify-center"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleBulkToggleVisibility}
                title="Show / Hide Selected"
                className="p-2 bg-[#121212]/80 hover:bg-[#2B2930] border border-[#333333] rounded-lg text-sky-400 hover:text-sky-300 transition-colors flex items-center justify-center"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleBulkDuplicate}
                title="Duplicate Selected"
                className="p-2 bg-[#121212]/80 hover:bg-[#2B2930] border border-[#333333] rounded-lg text-[#D0BCFF] hover:text-[#E8DEF8] transition-colors flex items-center justify-center"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleGroupSelected}
                title="Group Selected"
                className="p-2 bg-[#121212]/80 hover:bg-[#2B2930] border border-[#333333] rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-center"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowSmartGroupMenu(!showSmartGroupMenu)}
                title="Smart Grouping Options (AI-driven)"
                className={`p-2 border rounded-lg transition-colors flex items-center justify-center ${
                  showSmartGroupMenu 
                    ? "bg-[#D0BCFF] text-[#381E72] border-[#D0BCFF]" 
                    : "bg-[#121212]/80 hover:bg-[#2B2930] border-[#333333] text-fuchsia-400 hover:text-fuchsia-300"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleBulkDelete}
                title="Delete Selected"
                className="p-2 bg-[#121212]/80 hover:bg-[#2B2930] border border-[#333333] rounded-lg text-rose-500 hover:text-rose-400 transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bulk Opacity Slider */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider shrink-0">Opac.</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                defaultValue="1"
                onChange={(e) => handleBulkOpacityChange(parseFloat(e.target.value))}
                className="flex-1 accent-[#D0BCFF] h-1 bg-[#121212] rounded-lg appearance-none cursor-pointer"
                title="Bulk Opacity Control"
              />
            </div>
          </div>

          {/* Smart Group Options Dropdown/Panel */}
          {showSmartGroupMenu && (
            <div className="p-2.5 bg-[#120F1F] rounded-xl border border-[#D0BCFF]/20 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#D0BCFF] uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-fuchsia-400" />
                <span>Smart Grouping Assistant</span>
              </div>
              <p className="text-[9px] text-gray-400 leading-normal">
                Choose a clustering mechanism to intelligently group the {selectedCount} selected layers.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleSmartGroupByProximity}
                  className="px-2.5 py-2 bg-[#1C1735] hover:bg-[#2B2254] border border-[#D0BCFF]/10 hover:border-[#D0BCFF]/30 rounded-lg text-left transition-all active:scale-[0.98]"
                >
                  <div className="text-[10px] font-bold text-[#E8DEF8] flex items-center gap-1">📍 Proximity</div>
                  <div className="text-[8px] text-gray-400 mt-0.5 font-mono leading-tight">Cluster items close to each other on canvas (&lt; 300px)</div>
                </button>
                <button
                  onClick={handleSmartGroupByType}
                  className="px-2.5 py-2 bg-[#1C1735] hover:bg-[#2B2254] border border-[#D0BCFF]/10 hover:border-[#D0BCFF]/30 rounded-lg text-left transition-all active:scale-[0.98]"
                >
                  <div className="text-[10px] font-bold text-[#E8DEF8] flex items-center gap-1">🏷️ Shared Type</div>
                  <div className="text-[8px] text-gray-400 mt-0.5 font-mono leading-tight">Combine items sharing similar types (Texts, Formulas, shapes)</div>
                </button>
              </div>
            </div>
          )}

          {/* Alignment & Distribution Row */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#D0BCFF]/10">
            <span className="text-[9px] font-mono font-semibold text-[#D0BCFF]/70 uppercase tracking-wider shrink-0">
              Arrange:
            </span>
            <div className="flex items-center gap-1.5 flex-1 justify-start">
              <button
                onClick={handleBulkAlignLeft}
                title="Align Left"
                className="px-2 py-1 bg-[#121212]/80 hover:bg-[#2B2930] hover:text-[#D0BCFF] border border-[#333333] rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors text-[#938F99]"
              >
                <AlignLeft className="w-3 h-3" />
                <span className="font-mono">Left</span>
              </button>
              <button
                onClick={handleBulkAlignCenter}
                title="Align Center"
                className="px-2 py-1 bg-[#121212]/80 hover:bg-[#2B2930] hover:text-[#D0BCFF] border border-[#333333] rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors text-[#938F99]"
              >
                <AlignCenter className="w-3 h-3" />
                <span className="font-mono">Center</span>
              </button>
              <button
                onClick={handleBulkAlignRight}
                title="Align Right"
                className="px-2 py-1 bg-[#121212]/80 hover:bg-[#2B2930] hover:text-[#D0BCFF] border border-[#333333] rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors text-[#938F99]"
              >
                <AlignRight className="w-3 h-3" />
                <span className="font-mono">Right</span>
              </button>
              <button
                onClick={handleBulkDistributeSpaced}
                disabled={selectedCount < 3}
                title="Distribute Spaced (Requires 3+ items)"
                className="px-2 py-1 bg-[#121212]/80 hover:bg-[#2B2930] hover:text-[#D0BCFF] border border-[#333333] rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-30 disabled:hover:bg-[#121212]/80 disabled:hover:text-[#938F99] disabled:cursor-not-allowed ml-auto text-[#938F99]"
              >
                <AlignJustify className="w-3 h-3" />
                <span className="font-mono">Distribute</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layers List Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[40vh] no-scrollbar">
        {filteredLayers.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 font-medium">
            {searchQuery ? "No matching layers found" : "Whiteboard canvas is empty"}
          </div>
        ) : (
          filteredLayers.map((item) => {
            const { obj, originalIndex } = item;
            const isSelected = obj.isSelected;
            const isLocked = obj.isLocked;
            const isHidden = obj.hidden;
            const isEditing = editingId === obj.id;
            const defaultLabel = getLayerTypeLabel(obj);

            return (
              <div
                key={obj.id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, originalIndex)}
                onDragOver={(e) => handleDragOver(e, originalIndex)}
                onDrop={(e) => handleDrop(e, originalIndex)}
                className={`group flex flex-col p-2.5 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-[#251E36]/90 border-[#D0BCFF]/50 shadow-[0_2px_12px_rgba(208,188,255,0.08)]" 
                    : "bg-[#181818]/60 border-[#333333]/40 hover:bg-[#1C1C1C] hover:border-[#333333]"
                }`}
              >
                {/* Main Row */}
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left Side: Drag, Icon, Label / Name */}
                  <div 
                    onClick={(e) => handleSelectLayer(originalIndex, e)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                  >
                    {/* Tiny drag grip handle */}
                    <div className="flex flex-col gap-0.5 text-gray-600 group-hover:text-gray-400 cursor-grab shrink-0">
                      <span className="text-[10px] leading-none">⋮</span>
                    </div>

                    {/* Thumbnail representation */}
                    <div className="w-7 h-7 rounded-lg bg-[#222222] border border-[#333333] flex items-center justify-center shrink-0">
                      {getLayerIcon(obj)}
                    </div>

                    {/* Layer Name / Type */}
                    <div className="flex-1 min-w-0 text-left">
                      {isEditing ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(originalIndex);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => handleSaveRename(originalIndex)}
                          className="w-full bg-[#121212] border border-[#D0BCFF]/40 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-200 truncate flex items-center gap-1">
                            {obj.name || defaultLabel}
                            {obj.groupId && (
                              <span className="text-[8px] px-1 bg-[#4f378b]/55 text-[#D0BCFF] rounded-md uppercase font-mono tracking-wide scale-90">
                                Grouped
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] text-[#938F99] font-mono leading-none mt-0.5">
                            {obj.id.slice(0, 10)}... | Opacity: {Math.round((obj.opacity !== undefined ? obj.opacity : 1) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side Actions toolbar */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Inline Rename Trigger */}
                    {!isEditing && (
                      <button
                        onClick={() => handleStartRename(obj.id, obj.name || "", defaultLabel)}
                        title="Rename Layer"
                        className="p-1 hover:bg-[#2B2930] rounded text-[#938F99] hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}

                    {/* Visibility switch */}
                    <button
                      onClick={() => handleToggleVisibility(originalIndex)}
                      title={isHidden ? "Show Layer" : "Hide Layer"}
                      className={`p-1 rounded transition-colors ${
                        isHidden ? "text-rose-400 hover:text-rose-300" : "text-[#938F99] hover:text-white"
                      }`}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    {/* Lock toggle */}
                    <button
                      onClick={() => handleToggleLock(originalIndex)}
                      title={isLocked ? "Unlock Layer" : "Lock Layer"}
                      className={`p-1 rounded transition-colors ${
                        isLocked ? "text-amber-400 hover:text-amber-300" : "text-[#938F99] hover:text-white"
                      }`}
                    >
                      {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>

                    {/* Layer duplicate */}
                    <button
                      onClick={() => handleDuplicateLayer(originalIndex)}
                      title="Duplicate Layer"
                      className="p-1 hover:bg-[#2B2930] rounded text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete layer */}
                    <button
                      onClick={() => handleDeleteLayer(originalIndex)}
                      title="Delete Layer"
                      className="p-1 hover:bg-[#2B2930] rounded text-rose-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-row: Opacity Slider (Always Visible but styled beautifully) */}
                <div className="mt-2.5 pt-2 border-t border-[#333333]/20 flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={obj.opacity !== undefined ? obj.opacity : 1}
                    onChange={(e) => handleOpacityChange(originalIndex, parseFloat(e.target.value))}
                    className="flex-1 accent-[#D0BCFF] h-1 bg-[#222222] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Layer Depth Quick Controls Footer */}
      {canvasObjects.length > 0 && (
        <div className="px-5 py-3 bg-[#1C1C1C] border-t border-[#333333] flex items-center justify-between text-xs font-mono text-gray-400">
          <span className="text-[10px] text-[#938F99] uppercase font-bold tracking-wider">Z-Order Quick Tools</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const selIdx = canvasObjects.findIndex(o => o.isSelected);
                if (selIdx !== -1) bringToFront(selIdx);
              }}
              title="Bring to Front"
              className="p-1.5 bg-[#222] hover:bg-[#2B2930] border border-[#333] rounded text-gray-200 flex items-center gap-1 text-[10px] transition-colors"
            >
              <ChevronsUp className="w-3 h-3" />
              <span>Front</span>
            </button>
            <button
              onClick={() => {
                const selIdx = canvasObjects.findIndex(o => o.isSelected);
                if (selIdx !== -1) bringForward(selIdx);
              }}
              title="Bring Forward"
              className="p-1.5 bg-[#222] hover:bg-[#2B2930] border border-[#333] rounded text-gray-200 flex items-center gap-1 text-[10px] transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
              <span>Forward</span>
            </button>
            <button
              onClick={() => {
                const selIdx = canvasObjects.findIndex(o => o.isSelected);
                if (selIdx !== -1) sendBackward(selIdx);
              }}
              title="Send Backward"
              className="p-1.5 bg-[#222] hover:bg-[#2B2930] border border-[#333] rounded text-gray-200 flex items-center gap-1 text-[10px] transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                const selIdx = canvasObjects.findIndex(o => o.isSelected);
                if (selIdx !== -1) sendToBack(selIdx);
              }}
              title="Send to Back"
              className="p-1.5 bg-[#222] hover:bg-[#2B2930] border border-[#333] rounded text-gray-200 flex items-center gap-1 text-[10px] transition-colors"
            >
              <ChevronsDown className="w-3 h-3" />
              <span>Base</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
