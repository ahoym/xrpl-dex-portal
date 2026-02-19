"use client";

import { useState } from "react";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";
import { inputClass, labelClass, errorTextClass } from "@/lib/ui/ui";

interface DomainSelectorProps {
  domainID: string | null;
  onDomainChange: (id: string) => void;
  onClear: () => void;
  expanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
  isActive: boolean;
}

export function DomainSelector({
  domainID,
  onDomainChange,
  onClear,
  expanded,
  onToggleExpanded,
  isActive,
}: DomainSelectorProps) {
  const [inputValue, setInputValue] = useState(domainID ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [prevDomainID, setPrevDomainID] = useState(domainID);

  // Sync input value when domainID changes externally (e.g. cleared)
  if (prevDomainID !== domainID) {
    setPrevDomainID(domainID);
    setInputValue(domainID ?? "");
    setValidationError(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase();
    setInputValue(val);
    if (val.length > 0 && !DOMAIN_ID_REGEX.test(val)) {
      setValidationError("Must be exactly 64 uppercase hex characters (0-9, A-F)");
    } else {
      setValidationError(null);
    }
  }

  function handleApply() {
    if (!DOMAIN_ID_REGEX.test(inputValue)) {
      setValidationError("Must be exactly 64 uppercase hex characters (0-9, A-F)");
      return;
    }
    setValidationError(null);
    onDomainChange(inputValue);
    onToggleExpanded(false);
  }

  function handleClear() {
    setInputValue("");
    setValidationError(null);
    onClear();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  }

  return (
    <div className="mt-3 border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      {/* Header / collapsed button */}
      <button
        type="button"
        onClick={() => onToggleExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Permissioned Domain
          </span>
          {isActive && domainID && (
            <>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                Active
              </span>
              <span className="break-all text-[10px] font-mono text-zinc-600 dark:text-zinc-300">
                {domainID}
              </span>
            </>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">
          <div>
            <label className={labelClass}>Domain ID (64-char hex)</label>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="0000000000000000000000000000000000000000000000000000000000000001"
              maxLength={64}
              className={inputClass}
              spellCheck={false}
              autoCapitalize="characters"
            />
            {validationError && <p className={`mt-1 ${errorTextClass}`}>{validationError}</p>}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={inputValue.length === 0 || validationError !== null}
              className="border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
            >
              Apply
            </button>
            {isActive && (
              <button
                type="button"
                onClick={handleClear}
                className="border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
