"use client";

import * as React from "react";

const DEFAULT_COLORS = [
  "#86efac", // green
  "#ef4444", // red
  "#2563eb", // blue
  "#374151", // gray
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

type CategoryCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => Promise<void>;
  isSubmitting?: boolean;
};

export function CategoryCreateModal({
  isOpen,
  onClose,
  onSave,
  isSubmitting = false,
}: CategoryCreateModalProps) {
  const [title, setTitle] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState(DEFAULT_COLORS[0]);

  React.useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setSelectedColor(DEFAULT_COLORS[0]);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!title.trim()) return;
    await onSave(title.trim(), selectedColor);
    setTitle("");
    setSelectedColor(DEFAULT_COLORS[0]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-6">Create Category</h3>

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Category Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Work, Personal, Study"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-muted-foreground mb-3">
              Color
            </label>
            <div className="flex flex-wrap gap-3">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-10 h-10 rounded-full transition-all ${
                    selectedColor === color
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-3 bg-muted/50 rounded-lg mb-6">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-sm text-muted-foreground">info</span>
              <p className="text-xs text-muted-foreground">
                This category will be private and only visible to you.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
