"use client";

import * as React from "react";

export type Category = {
  id: string;
  title: string;
  color: string;
  isPrivate: boolean;
  userId: string | null;
};

type CategoryPickerProps = {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onCreateCategory?: () => void;
  onEditCategory?: (category: Category) => void;
  isLoading?: boolean;
};

export function CategoryPicker({
  categories,
  selectedCategoryId,
  onSelect,
  onCreateCategory,
  onEditCategory,
  isLoading = false,
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              selectedCategoryId === category.id
                ? "border-2 border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:bg-muted"
            }`}
            onClick={() => {
              onSelect(category.id);
              setIsOpen(false);
            }}
            onDoubleClick={() => {
              if (onEditCategory) {
                onEditCategory(category);
              }
            }}
            title={onEditCategory ? "Double-click to edit" : undefined}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span
              className={`text-xs ${
                selectedCategoryId === category.id ? "font-bold" : "font-medium"
              }`}
            >
              {category.title}
            </span>
            {category.isPrivate && (
              <span className="material-symbols-outlined text-[12px] text-muted-foreground" title="Private category">
                lock
              </span>
            )}
          </button>
        ))}
        
        {onCreateCategory && (
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed border-border bg-card hover:bg-muted transition-all"
            onClick={onCreateCategory}
            disabled={isLoading}
          >
            <span className="material-symbols-outlined text-[16px] text-muted-foreground">add</span>
            <span className="text-xs font-medium text-muted-foreground">Create Category</span>
          </button>
        )}
      </div>
    </div>
  );
}
