"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, Upload, X } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ACCEPT_ATTR = ".pdf,image/jpeg,image/png,image/webp,application/pdf";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeFromName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "";
}

function validateFile(file: File): string | null {
  const mime = file.type || mimeFromName(file.name);
  if (!ACCEPTED_MIMES.has(mime)) {
    return "Please use a PDF, JPEG, PNG, or WebP file.";
  }
  if (file.size > MAX_BYTES) {
    return "File is too large — maximum size is 5 MB.";
  }
  return null;
}

function assignFilesToInput(input: HTMLInputElement, file: File | null) {
  const dt = new DataTransfer();
  if (file) {
    dt.items.add(file);
  }
  input.files = dt.files;
}

export type CoachDocumentDropzoneProps = {
  id: string;
  name: string;
  required: boolean;
  hasExistingServerFile: boolean;
  /** Short name for screen readers (e.g. "Proof of credentials"). */
  groupAriaLabel: string;
  /** Increment after a successful submit so the zone clears staged files. */
  clearStagedSignal?: number;
  /** Shown when a file was already saved for this field (optional replace). */
  serverFileHint?: string | null;
  className?: string;
};

export function CoachDocumentDropzone({
  id,
  name,
  required,
  hasExistingServerFile,
  groupAriaLabel,
  clearStagedSignal = 0,
  serverFileHint,
  className,
}: CoachDocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const hintId = useId();
  const errorId = useId();

  const [staged, setStaged] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFile = useCallback((file: File | null) => {
    const input = inputRef.current;
    if (!input) return;
    if (!file) {
      assignFilesToInput(input, null);
      setStaged(null);
      setError(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      setError(err);
      assignFilesToInput(input, null);
      setStaged(null);
      return;
    }
    setError(null);
    assignFilesToInput(input, file);
    setStaged(file);
  }, []);

  useEffect(() => {
    if (clearStagedSignal === 0) return;
    applyFile(null);
  }, [clearStagedSignal, applyFile]);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const replaceFile = useCallback(() => {
    applyFile(null);
    requestAnimationFrame(() => {
      inputRef.current?.click();
    });
  }, [applyFile]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) {
        applyFile(null);
        return;
      }
      applyFile(f);
    },
    [applyFile],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (!files?.length) return;
      if (files.length > 1) {
        setError("Please drop one file at a time.");
        return;
      }
      applyFile(files[0]);
    },
    [applyFile],
  );

  const onKeyDownZone = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (staged) replaceFile();
        else openPicker();
      }
      if (e.key === "Escape" && staged) {
        e.preventDefault();
        applyFile(null);
      }
    },
    [openPicker, replaceFile, staged, applyFile],
  );

  const describedBy =
    [hintId, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="group"
        tabIndex={0}
        aria-label={groupAriaLabel}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onKeyDown={onKeyDownZone}
        onClick={(e) => {
          if (staged) return;
          if ((e.target as HTMLElement).closest("button")) return;
          openPicker();
        }}
        className={cn(
          "relative rounded-lg border border-dashed bg-background outline-none transition-colors",
          "min-h-[148px] px-4 py-5",
          "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDragging && "border-primary bg-primary/5 ring-2 ring-primary/30",
          !isDragging &&
            !error &&
            !staged &&
            "cursor-pointer border-input hover:border-muted-foreground/40",
          staged && "border-input",
          error && "border-destructive/60 bg-destructive/[0.03]",
        )}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          required={required && !staged}
          accept={ACCEPT_ATTR}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={onInputChange}
        />

        {!staged ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-full bg-muted/80 text-muted-foreground",
                isDragging && "bg-primary/15 text-primary",
              )}
            >
              <Upload className="size-5" aria-hidden />
            </div>
            <div className="max-w-[280px] space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isDragging ? "Drop file here" : "Drag and drop a file here"}
              </p>
              <p id={hintId} className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, or WebP · max {formatBytes(MAX_BYTES)}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={openPicker}>
                <FileText className="size-3.5" aria-hidden />
                Browse files
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Press Space or Enter to choose · or drop a file anywhere in this box
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={staged.name}>
                    {staged.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(staged.size)}
                    {staged.type
                      ? ` · ${staged.type.replace("application/", "").replace("image/", "")}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={replaceFile}>
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => applyFile(null)}
                >
                  <X className="size-4 sm:mr-1" aria-hidden />
                  Remove
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Esc removes this file · Replace opens the picker again
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {hasExistingServerFile ? (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {serverFileHint?.trim() ||
            "We already have a file on record — upload again only if you want to replace it before you submit."}
        </p>
      ) : null}
    </div>
  );
}
