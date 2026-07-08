export interface CanvasObject {
  id: string;
  type: "handwriting" | "shape" | "text" | "formula" | "image" | "group" | "voice" | "table";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
  layer: number; // sorting index
  createdAt: number;
  updatedAt: number;
  color: string;
  strokeWidth: number;
  // For handwriting
  points?: { x: number; y: number }[];
  // For shape
  shapeType?: string;
  startConnection?: { targetId: string; port: string };
  endConnection?: { targetId: string; port: string };
  isStartBroken?: boolean;
  isEndBroken?: boolean;
  // For text/formula
  content?: string;
  // For images
  imageUrl?: string;
  isSelected?: boolean;
  isLassoSelected?: boolean;
  isLocked?: boolean;
  hidden?: boolean;
  opacity?: number;
  name?: string;
  groupId?: string;
  children?: CanvasObject[];
  originalWidth?: number;
  originalHeight?: number;

  // Formatting properties for Text / Formula
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;

  // Properties for Voice Note
  audioUrl?: string;
  audioDuration?: number; // duration in seconds
  audioPlaying?: boolean;
  audioCurrentTime?: number;
  audioTitle?: string;
  waveform?: number[];
  isRecording?: boolean;
  elapsedRecordingSeconds?: number;

  // Custom geometry toolkit properties
  angleValue?: number;
  compassRadius?: number;
  spacing?: number;
  majorAxis?: number;
  minorAxis?: number;
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  p3?: { x: number; y: number };
}

export interface NotebookItem {
  id: string;
  name: string;
  isFolder: false;
  color: string; // HEX color
  icon: string; // e.g. "FileText", "BookOpen", "Cpu"
  isFavorite: boolean;
  isLocked: boolean;
  createdAt: number;
  updatedAt: number;
  lastOpened: number;
  pageCount: number;
  tags: string[];
  notebookType?: "whiteboard" | "rich_text";
}

export interface FolderItem {
  id: string;
  name: string;
  isFolder: true;
  color: string; // HEX color
  icon: string; // e.g. "Folder", "Brain", "Cpu"
  description?: string;
  isLocked: boolean;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  children: NotebookItem[];
}

export interface TrashItem {
  id: string;
  type: "folder" | "notebook";
  originalFolderId?: string; // parent folder id
  deletedAt: number;
  data: FolderItem | NotebookItem; // Serialized item data
}

export interface CustomPalette {
  id: string;
  name: string;
  colors: string[];
}

export interface RulerState {
  isActive: boolean;
  x: number;
  y: number;
  angle: number; // in degrees
  length: number; // in pixels
  isLocked: boolean;
  opacity: number; // 0 to 1
  color: string; // HEX color
  isSnapMode: boolean;
}

export interface Notebook {
  id: string;
  name: string;
  isFolder: boolean;
  color?: string;
  children?: Notebook[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface AndroidFile {
  name: string;
  path: string;
  language: string;
  content: string;
}

