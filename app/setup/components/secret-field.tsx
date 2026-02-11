"use client";

import { useState } from "react";

interface SecretFieldProps {
  label: string;
  value: string;
}

export function SecretField({ label, value }: SecretFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">{label}: </span>
      {show ? (
        <span className="break-all font-mono text-xs">{value}</span>
      ) : (
        <span className="text-zinc-400">••••••••••••</span>
      )}
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? "Hide secret" : "Show secret"}
        className="px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
