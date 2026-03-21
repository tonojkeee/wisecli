import { useState, useEffect, useCallback, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@renderer/components/ui/dialog";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Loader2, GitCommit, FileCode, User, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GitLogCommit, GitDiffFile } from "@shared/types/fs";
import { useFileStore } from "@renderer/stores/useFileStore";
import { useEffectiveTheme } from "@renderer/stores/useSettingsStore";

// Import the loader config to ensure Monaco loads locally
import "@renderer/components/editor/monaco-loader";

// Helper function to detect Monaco language from file path
function getLanguageFromFile(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    xml: "xml",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
  };

  return languageMap[ext || ""] || "plaintext";
}

interface GitLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
}

export function GitLogDialog({ open, onOpenChange, projectPath }: GitLogDialogProps) {
  const { t } = useTranslation("filebrowser");
  const effectiveTheme = useEffectiveTheme();
  const projectRoot = useFileStore((state) => state.projectPath);

  // Commits state
  const [commits, setCommits] = useState<GitLogCommit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  // Selected commit state
  const [selectedCommit, setSelectedCommit] = useState<GitLogCommit | null>(null);

  // Diff files state
  const [diffFiles, setDiffFiles] = useState<GitDiffFile[]>([]);
  const [diffFilesLoading, setDiffFilesLoading] = useState(false);

  // Selected file state
  const [selectedFile, setSelectedFile] = useState<GitDiffFile | null>(null);

  // File content state
  const [originalContent, setOriginalContent] = useState<string>("");
  const [modifiedContent, setModifiedContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Track if we've loaded commits for this open session
  const hasLoadedRef = useRef(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      hasLoadedRef.current = false;
      setSelectedCommit(null);
      setSelectedFile(null);
      setDiffFiles([]);
      setOriginalContent("");
      setModifiedContent("");
      setCommitsError(null);
      setContentError(null);
    }
  }, [open, projectPath]);

  // Load commits when dialog opens
  useEffect(() => {
    if (!open || !projectPath || hasLoadedRef.current) return;

    const loadCommits = async () => {
      setCommitsLoading(true);
      setCommitsError(null);

      try {
        const result = await window.electronAPI.git.getLog(projectPath);
        if (result.isGitRepo) {
          setCommits(result.commits);
        } else {
          setCommits([]);
          setCommitsError(t("gitLog.noCommits"));
        }
      } catch (error) {
        console.error("[GitLogDialog] Failed to load commits:", error);
        setCommitsError(String(error));
        setCommits([]);
      } finally {
        setCommitsLoading(false);
        hasLoadedRef.current = true;
      }
    };

    loadCommits();
  }, [open, projectPath, t]);

  // Load diff files when a commit is selected
  useEffect(() => {
    if (!selectedCommit || !projectPath) {
      setDiffFiles([]);
      return;
    }

    const loadDiffFiles = async () => {
      setDiffFilesLoading(true);
      setSelectedFile(null);
      setOriginalContent("");
      setModifiedContent("");
      setContentError(null);

      try {
        const result = await window.electronAPI.git.getCommitDiff(projectPath, selectedCommit.hash);
        setDiffFiles(result.files);
      } catch (error) {
        console.error("[GitLogDialog] Failed to load diff files:", error);
        setDiffFiles([]);
      } finally {
        setDiffFilesLoading(false);
      }
    };

    loadDiffFiles();
  }, [selectedCommit, projectPath]);

  // Load file content for diff viewer
  const loadFileContent = useCallback(async (file: GitDiffFile) => {
    if (!selectedCommit || !projectPath) return;

    setContentLoading(true);
    setContentError(null);

    try {
      const path = file.oldPath || file.path;

      // Load original content (from commit^)
      const original = await window.electronAPI.git.getFileAtRef(
        projectPath,
        path,
        `${selectedCommit.hash}^`
      );

      // Load modified content (from commit)
      const modified = await window.electronAPI.git.getFileAtRef(
        projectPath,
        path,
        selectedCommit.hash
      );

      if (file.isBinary) {
        setOriginalContent(t("gitLog.binaryFile"));
        setModifiedContent(t("gitLog.binaryFile"));
      } else {
        setOriginalContent(original ?? "");
        setModifiedContent(modified ?? "");
      }
    } catch (error) {
      console.error("[GitLogDialog] Failed to load file content:", error);
      setContentError(String(error));
      setOriginalContent("");
      setModifiedContent("");
    } finally {
      setContentLoading(false);
    }
  }, [selectedCommit, projectPath, t]);

  // Handle file selection
  const handleFileClick = useCallback((file: GitDiffFile) => {
    setSelectedFile(file);
    loadFileContent(file);
  }, [loadFileContent]);

  // Format date for display
  const formatDate = useCallback((dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  }, []);

  // Get file status label
  const getStatusLabel = (status: GitDiffFile["status"]) => {
    const labels: Record<GitDiffFile["status"], string> = {
      A: t("gitLog.added") || "Added",
      M: t("gitLog.modified") || "Modified",
      D: t("gitLog.deleted") || "Deleted",
      R: t("gitLog.renamed") || "Renamed",
    };
    return labels[status] || status;
  };

  // Get status color class
  const getStatusColor = (status: GitDiffFile["status"]) => {
    const colors: Record<GitDiffFile["status"], string> = {
      A: "text-green-600",
      M: "text-yellow-600",
      D: "text-red-600",
      R: "text-blue-600",
    };
    return colors[status] || "text-muted-foreground";
  };

  // Use projectRoot for repo operations
  const repoPath = projectRoot || projectPath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            {t("gitLog.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Commit list */}
          <div className="w-80 border-r flex flex-col bg-muted/30">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium text-sm">{t("gitLog.commits")}</h3>
            </div>

            <ScrollArea className="flex-1">
              {commitsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : commitsError ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {commitsError}
                </div>
              ) : commits.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t("gitLog.noCommits")}
                </div>
              ) : (
                <div className="divide-y">
                  {commits.map((commit) => (
                    <button
                      key={commit.hash}
                      onClick={() => setSelectedCommit(commit)}
                      className={`
                        w-full text-left p-3 hover:bg-accent transition-colors
                        ${selectedCommit?.hash === commit.hash ? "bg-accent" : ""}
                      `}
                    >
                      <div className="flex items-start gap-2">
                        <GitCommit className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-muted-foreground mb-1">
                            {commit.shortHash}
                          </div>
                          <div className="text-sm font-medium truncate">
                            {commit.message}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate">{commit.author}</span>
                            <Clock className="h-3 w-3 ml-auto flex-shrink-0" />
                            <span className="flex-shrink-0">{commit.relativeDate}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right panel: Files and diff */}
          <div className="flex-1 flex flex-col">
            {/* Files list */}
            <div className="h-48 border-b flex flex-col">
              <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
                <h3 className="font-medium text-sm">{t("gitLog.changedFiles")}</h3>
                {selectedCommit && (
                  <span className="text-xs text-muted-foreground">
                    {diffFiles.length} {diffFiles.length === 1 ? "file" : "files"}
                  </span>
                )}
              </div>

              <ScrollArea className="flex-1">
                {!selectedCommit ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    {t("gitLog.selectCommit")}
                  </div>
                ) : diffFilesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : diffFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No changed files
                  </div>
                ) : (
                  <div className="divide-y">
                    {diffFiles.map((file, index) => (
                      <button
                        key={`${file.path}-${index}`}
                        onClick={() => handleFileClick(file)}
                        className={`
                          w-full text-left px-4 py-2 hover:bg-accent transition-colors
                          ${selectedFile?.path === file.path ? "bg-accent" : ""}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className={`
                            text-sm truncate flex-1
                            ${file.status === "D" ? "line-through opacity-60" : ""}
                          `}>
                            {file.path}
                          </span>
                          <span className={`text-xs font-medium ${getStatusColor(file.status)}`}>
                            {getStatusLabel(file.status)}
                          </span>
                          {!file.isBinary && (file.additions > 0 || file.deletions > 0) && (
                            <span className="text-xs text-muted-foreground">
                              +{file.additions} -{file.deletions}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Diff viewer */}
            <div className="flex-1 overflow-hidden">
              {!selectedFile ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {t("gitLog.selectFile")}
                </div>
              ) : contentLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : contentError ? (
                <div className="flex items-center justify-center h-full text-sm text-destructive">
                  {contentError}
                </div>
              ) : selectedFile.isBinary ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {t("gitLog.binaryFile")}
                </div>
              ) : (
                <div className="h-full">
                  <DiffEditor
                    height="100%"
                    language={getLanguageFromFile(selectedFile.path)}
                    original={originalContent}
                    modified={modifiedContent}
                    theme={effectiveTheme === "dark" ? "vs-dark" : "light"}
                    options={{
                      readOnly: true,
                      renderSideBySide: true,
                      enableSplitViewResizing: false,
                      renderOverviewRuler: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12,
                      lineHeight: 18,
                      fontFamily: "JetBrains Mono, Menlo, Monaco, Courier New, monospace",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
