import { useState, useEffect, useCallback, useRef } from 'react';

// Import the engine class - we'll load these as global scripts
declare global {
  interface Window {
    PdfTeXEngine: new () => PdfTeXEngine;
    LATEX_TEMPLATES: Record<string, string>;
    TEXLIVE_PACKAGES: Array<{ format: number; filename: string; content: string }>;
    TEXLIVE_FONTS: Array<{ format: number; filename: string; content: string }>;
    TEXLIVE_TYPE1_FONTS: Array<{ format: number; filename: string; content: string }>;
    TEXLIVE_VF_FONTS: Array<{ format: number; filename: string; content: string }>;
    SWIFTLATEX_BASE_PATH?: string;
  }
}

interface PdfTeXEngine {
  loadEngine(): Promise<void>;
  isReady(): boolean;
  writeMemFSFile(path: string, content: string | Uint8Array): void;
  makeMemFSFolder(path: string): void;
  setEngineMainFile(path: string): void;
  compileLaTeX(): Promise<{ status: number; pdf?: Uint8Array; log: string }>;
  preloadTexliveFile(format: number, filename: string, content: string | Uint8Array): void;
  setTexliveEndpoint(url: string): void;
}

// Helper to decode base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

interface LatexEngineState {
  engine: PdfTeXEngine | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

// Get base path from Vite (handles /libo-secured/ in production)
const BASE_PATH = import.meta.env.BASE_URL || '/';

// Helper to dynamically load a script
function loadScript(src: string): Promise<void> {
  // Prepend base path for production builds
  const fullSrc = src.startsWith('/') ? `${BASE_PATH}${src.slice(1)}` : src;

  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${fullSrc}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = fullSrc;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${fullSrc}`));
    document.head.appendChild(script);
  });
}

export function useLatexEngine() {
  const [state, setState] = useState<LatexEngineState>({
    engine: null,
    isReady: false,
    isLoading: true,
    error: null,
  });

  const engineRef = useRef<PdfTeXEngine | null>(null);
  const initStartedRef = useRef(false);

  const initEngine = useCallback(async () => {
    // Prevent double initialization in StrictMode
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    try {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      // Load required scripts dynamically
      console.log('Loading LaTeX engine scripts...');

      // Set base path for Worker to find swiftlatexpdftex.js
      // Remove trailing slash for proper path joining
      window.SWIFTLATEX_BASE_PATH = BASE_PATH.replace(/\/$/, '');

      // Load PdfTeXEngine first
      await loadScript('/lib/PdfTeXEngine.js');

      // Load templates and packages
      await Promise.all([
        loadScript('/lib/latex-templates.js'),
        loadScript('/lib/texlive-packages.js'),
      ]);

      // Wait a bit for scripts to register globals
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!window.PdfTeXEngine) {
        throw new Error('PdfTeXEngine not loaded - check if /lib/PdfTeXEngine.js exists');
      }

      console.log('Initializing LaTeX engine...');
      const engine = new window.PdfTeXEngine();
      await engine.loadEngine();

      // Set texlive endpoint to correct path (relative to base URL)
      // This tells the Worker where to fetch missing TeX packages from
      const texliveUrl = `${BASE_PATH}lib/texlive/`;
      engine.setTexliveEndpoint(texliveUrl);

      // Create virtual filesystem directories
      engine.makeMemFSFolder('formats');
      engine.makeMemFSFolder('attachments');
      engine.makeMemFSFolder('enclosures');
      engine.makeMemFSFolder('templates');

      // Preload TeX Live packages (text files like .cls, .sty, .cfg)
      if (window.TEXLIVE_PACKAGES) {
        console.log(`Preloading ${window.TEXLIVE_PACKAGES.length} TeX Live packages...`);
        for (const pkg of window.TEXLIVE_PACKAGES) {
          engine.preloadTexliveFile(pkg.format, pkg.filename, pkg.content);
        }
      }

      // Preload TFM font metrics (format 3, base64 encoded)
      if (window.TEXLIVE_FONTS) {
        console.log(`Preloading ${window.TEXLIVE_FONTS.length} TFM font metrics...`);
        for (const font of window.TEXLIVE_FONTS) {
          const bytes = base64ToUint8Array(font.content);
          engine.preloadTexliveFile(font.format, font.filename, bytes);
        }
      }

      // Preload Type1 fonts (format 4, base64 encoded)
      if (window.TEXLIVE_TYPE1_FONTS) {
        console.log(`Preloading ${window.TEXLIVE_TYPE1_FONTS.length} Type1 fonts...`);
        for (const font of window.TEXLIVE_TYPE1_FONTS) {
          const bytes = base64ToUint8Array(font.content);
          engine.preloadTexliveFile(font.format, font.filename, bytes);
        }
      }

      // Preload Virtual fonts (format 2, base64 encoded)
      if (window.TEXLIVE_VF_FONTS) {
        console.log(`Preloading ${window.TEXLIVE_VF_FONTS.length} Virtual fonts...`);
        for (const font of window.TEXLIVE_VF_FONTS) {
          const bytes = base64ToUint8Array(font.content);
          engine.preloadTexliveFile(font.format, font.filename, bytes);
        }
      }

      // Wait for worker to process all preload messages
      // postMessage is async, so we need to give the worker time to process
      console.log('Waiting for worker to process preload messages...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Preload wait complete');

      // Write LaTeX templates
      // Templates are stored with 'tex/' prefix but need to be written to root for SwiftLaTeX
      if (window.LATEX_TEMPLATES) {
        console.log(`Writing ${Object.keys(window.LATEX_TEMPLATES).length} LaTeX templates...`);
        for (const [path, content] of Object.entries(window.LATEX_TEMPLATES)) {
          // Strip 'tex/' prefix if present - SwiftLaTeX expects files in root
          let targetPath = path.startsWith('tex/') ? path.slice(4) : path;
          // Also strip 'templates/' prefix - \input{\DocumentType} expects files at root
          targetPath = targetPath.startsWith('templates/') ? targetPath.slice(10) : targetPath;
          engine.writeMemFSFile(targetPath, content);
        }
      }

      engineRef.current = engine;
      console.log('LaTeX engine ready!');
      setState({
        engine,
        isReady: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Failed to initialize LaTeX engine:', err);
      initStartedRef.current = false; // Allow retry
      setState({
        engine: null,
        isReady: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const resetEngine = useCallback(async () => {
    initStartedRef.current = false;
    setState((s) => ({ ...s, isReady: false, isLoading: true }));
    await initEngine();
  }, [initEngine]);

  const compile = useCallback(
    async (files: Record<string, string | Uint8Array>): Promise<Uint8Array | null> => {
      const engine = engineRef.current;
      if (!engine || !engine.isReady()) {
        throw new Error('Engine not ready');
      }

      // Write all files to virtual filesystem
      for (const [path, content] of Object.entries(files)) {
        engine.writeMemFSFile(path, content);
      }

      // Set main file and compile
      engine.setEngineMainFile('main.tex');
      const result = await engine.compileLaTeX();

      if (result.status === 0 && result.pdf) {
        return result.pdf;
      }

      // Check for fatal error requiring reset
      if (result.log?.includes('Fatal format file error')) {
        await resetEngine();
        throw new Error('ENGINE_RESET_NEEDED');
      }

      console.error('LaTeX compilation failed:', result.log);
      throw new Error('Compilation failed');
    },
    [resetEngine]
  );

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  return {
    ...state,
    compile,
    resetEngine,
  };
}
