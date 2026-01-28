"use client";

import * as React from "react";
import { format, getDay, getDate, getMonth, getYear } from "date-fns";

// Recurrence types
export type RecurrenceType = 
  | "none"
  | "daily"
  | "weekly"
  | "monthly-day"      // e.g., Monthly on the 15th
  | "monthly-weekday"  // e.g., Monthly on the second Tuesday
  | "monthly-last-weekday" // e.g., Monthly on the last Tuesday
  | "annually"
  | "weekdays"
  | "custom";

export type RecurrenceEndType = "never" | "on" | "after";

export type CustomRecurrence = {
  interval: number;
  frequency: "day" | "week" | "month" | "year";
  weekDays: number[]; // 0 = Sunday, 6 = Saturday
  endType: RecurrenceEndType;
  endDate?: string;
  endCount?: number;
};

export type RecurrenceConfig = {
  type: RecurrenceType;
  custom?: CustomRecurrence;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

// Get the week of month (1-5)
function getWeekOfMonth(date: Date): number {
  const dayOfMonth = getDate(date);
  return Math.ceil(dayOfMonth / 7);
}

// Check if date is in the last week of month
function isLastWeekOfMonth(date: Date): boolean {
  const dayOfMonth = getDate(date);
  const daysInMonth = new Date(getYear(date), getMonth(date) + 1, 0).getDate();
  return dayOfMonth > daysInMonth - 7;
}

// Generate display label for recurrence
export function getRecurrenceLabel(config: RecurrenceConfig, startDate?: Date): string {
  if (!config || config.type === "none") return "Does not repeat";
  
  const date = startDate || new Date();
  const dayOfWeek = getDay(date);
  const dayName = WEEKDAY_NAMES[dayOfWeek];
  const dayOfMonth = getDate(date);
  const monthName = format(date, "MMMM");
  
  switch (config.type) {
    case "daily":
      return "Daily";
    case "weekly":
      return `Weekly on ${dayName}`;
    case "monthly-day":
      return `Monthly on day ${dayOfMonth}`;
    case "monthly-weekday": {
      const weekNum = getWeekOfMonth(date);
      return `Monthly on the ${ORDINALS[weekNum - 1]} ${dayName}`;
    }
    case "monthly-last-weekday":
      return `Monthly on the last ${dayName}`;
    case "annually":
      return `Annually on ${monthName} ${dayOfMonth}`;
    case "weekdays":
      return "Every weekday (Monday to Friday)";
    case "custom":
      if (config.custom) {
        const { interval, frequency, weekDays, endType, endDate, endCount } = config.custom;
        let label = `Every ${interval > 1 ? `${interval} ${frequency}s` : frequency}`;
        
        if (frequency === "week" && weekDays.length > 0) {
          const dayNames = weekDays.map(d => WEEKDAY_SHORT[d]).join(", ");
          label += ` on ${dayNames}`;
        }
        
        if (endType === "on" && endDate) {
          label += ` until ${format(new Date(endDate), "MMM d, yyyy")}`;
        } else if (endType === "after" && endCount) {
          label += `, ${endCount} times`;
        }
        
        return label;
      }
      return "Custom";
    default:
      return "Does not repeat";
  }
}

// Generate RRULE string from config
export function generateRRule(config: RecurrenceConfig, startDate: Date): string | null {
  if (!config || config.type === "none") return null;
  
  const dayOfWeek = getDay(startDate);
  const dayOfMonth = getDate(startDate);
  const rruleDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  
  let rule = "";
  
  switch (config.type) {
    case "daily":
      rule = "FREQ=DAILY";
      break;
    case "weekly":
      rule = `FREQ=WEEKLY;BYDAY=${rruleDays[dayOfWeek]}`;
      break;
    case "monthly-day":
      rule = `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
      break;
    case "monthly-weekday": {
      const weekNum = getWeekOfMonth(startDate);
      rule = `FREQ=MONTHLY;BYDAY=${weekNum}${rruleDays[dayOfWeek]}`;
      break;
    }
    case "monthly-last-weekday":
      rule = `FREQ=MONTHLY;BYDAY=-1${rruleDays[dayOfWeek]}`;
      break;
    case "annually":
      rule = `FREQ=YEARLY;BYMONTH=${getMonth(startDate) + 1};BYMONTHDAY=${dayOfMonth}`;
      break;
    case "weekdays":
      rule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
      break;
    case "custom":
      if (config.custom) {
        const { interval, frequency, weekDays, endType, endDate, endCount } = config.custom;
        const freqMap = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" };
        rule = `FREQ=${freqMap[frequency]}`;
        
        if (interval > 1) {
          rule += `;INTERVAL=${interval}`;
        }
        
        if (frequency === "week" && weekDays.length > 0) {
          const days = weekDays.map(d => rruleDays[d]).join(",");
          rule += `;BYDAY=${days}`;
        }
        
        if (endType === "on" && endDate) {
          const endDateObj = new Date(endDate);
          rule += `;UNTIL=${format(endDateObj, "yyyyMMdd")}T235959Z`;
        } else if (endType === "after" && endCount) {
          rule += `;COUNT=${endCount}`;
        }
      }
      break;
  }
  
  return rule || null;
}

type RecurrencePickerProps = {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  startDate?: Date;
};

export function RecurrencePicker({ value, onChange, startDate }: RecurrencePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  const date = startDate || new Date();
  const dayOfWeek = getDay(date);
  const dayName = WEEKDAY_NAMES[dayOfWeek];
  const dayOfMonth = getDate(date);
  const monthName = format(date, "MMMM");
  const weekNum = getWeekOfMonth(date);
  const isLastWeek = isLastWeekOfMonth(date);
  
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
  
  const options: { type: RecurrenceType; label: string }[] = [
    { type: "none", label: "Does not repeat" },
    { type: "daily", label: "Daily" },
    { type: "weekly", label: `Weekly on ${dayName}` },
    { type: "monthly-weekday", label: `Monthly on the ${ORDINALS[weekNum - 1]} ${dayName}` },
    ...(isLastWeek ? [{ type: "monthly-last-weekday" as RecurrenceType, label: `Monthly on the last ${dayName}` }] : []),
    { type: "annually", label: `Annually on ${monthName} ${dayOfMonth}` },
    { type: "weekdays", label: "Every weekday (Monday to Friday)" },
    { type: "custom", label: "Custom..." },
  ];
  
  const handleSelect = (type: RecurrenceType) => {
    if (type === "custom") {
      setShowCustomModal(true);
      setIsOpen(false);
    } else {
      onChange({ type });
      setIsOpen(false);
    }
  };
  
  const handleCustomSave = (custom: CustomRecurrence) => {
    onChange({ type: "custom", custom });
    setShowCustomModal(false);
  };
  
  const displayLabel = getRecurrenceLabel(value, date);
  
  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className={`flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors ${
            value.type !== "none"
              ? "bg-primary/10 border-primary text-primary"
              : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-xs font-medium">{displayLabel}</span>
          <span className="material-symbols-outlined text-[16px]">
            {isOpen ? "expand_less" : "expand_more"}
          </span>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-card rounded-lg shadow-xl border border-border z-50 py-1 overflow-hidden">
            {options.map((option) => (
              <button
                key={option.type}
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${
                  value.type === option.type ? "bg-primary/10 text-primary font-medium" : ""
                }`}
                onClick={() => handleSelect(option.type)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {showCustomModal && (
        <CustomRecurrenceModal
          initialValue={value.custom}
          startDate={date}
          onSave={handleCustomSave}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </>
  );
}

// Custom Recurrence Modal
type CustomRecurrenceModalProps = {
  initialValue?: CustomRecurrence;
  startDate: Date;
  onSave: (config: CustomRecurrence) => void;
  onClose: () => void;
};

function CustomRecurrenceModal({ initialValue, startDate, onSave, onClose }: CustomRecurrenceModalProps) {
  const [interval, setInterval] = React.useState(initialValue?.interval ?? 1);
  const [frequency, setFrequency] = React.useState<CustomRecurrence["frequency"]>(initialValue?.frequency ?? "week");
  const [weekDays, setWeekDays] = React.useState<number[]>(initialValue?.weekDays ?? [getDay(startDate)]);
  const [endType, setEndType] = React.useState<RecurrenceEndType>(initialValue?.endType ?? "never");
  const [endDate, setEndDate] = React.useState(initialValue?.endDate ?? format(new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [endCount, setEndCount] = React.useState(initialValue?.endCount ?? 13);
  
  const toggleWeekDay = (day: number) => {
    setWeekDays((prev) => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };
  
  const handleSave = () => {
    onSave({
      interval,
      frequency,
      weekDays: frequency === "week" ? weekDays : [],
      endType,
      endDate: endType === "on" ? endDate : undefined,
      endCount: endType === "after" ? endCount : undefined,
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-6">Custom recurrence</h3>
          
          {/* Repeat every */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-muted-foreground">Repeat every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-3 py-2 rounded-lg border border-border bg-muted/50 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CustomRecurrence["frequency"])}
              className="px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="day">day{interval > 1 ? "s" : ""}</option>
              <option value="week">week{interval > 1 ? "s" : ""}</option>
              <option value="month">month{interval > 1 ? "s" : ""}</option>
              <option value="year">year{interval > 1 ? "s" : ""}</option>
            </select>
          </div>
          
          {/* Repeat on (for weekly) */}
          {frequency === "week" && (
            <div className="mb-6">
              <span className="text-sm text-muted-foreground block mb-3">Repeat on</span>
              <div className="flex gap-2">
                {WEEKDAY_SHORT.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                      weekDays.includes(index)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    onClick={() => toggleWeekDay(index)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Ends */}
          <div className="mb-6">
            <span className="text-sm text-muted-foreground block mb-3">Ends</span>
            <div className="space-y-3">
              {/* Never */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === "never"}
                  onChange={() => setEndType("never")}
                  className="w-5 h-5 text-primary border-border focus:ring-primary"
                />
                <span className="text-sm">Never</span>
              </label>
              
              {/* On date */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === "on"}
                  onChange={() => setEndType("on")}
                  className="w-5 h-5 text-primary border-border focus:ring-primary"
                />
                <span className="text-sm">On</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={endType !== "on"}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </label>
              
              {/* After occurrences */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === "after"}
                  onChange={() => setEndType("after")}
                  className="w-5 h-5 text-primary border-border focus:ring-primary"
                />
                <span className="text-sm">After</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={endCount}
                  onChange={(e) => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={endType !== "after"}
                  className="w-16 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
                <span className="text-sm text-muted-foreground">occurrences</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            onClick={handleSave}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
