"use client";

import { useState } from "react";
import type { Contact } from "@/lib/types";
import { inputClass, labelClass, errorTextClass } from "@/lib/ui/ui";

interface ContactsManagerProps {
  contacts: Contact[];
  onAdd: (contact: Contact) => void;
  onUpdate: (index: number, contact: Contact) => void;
  onRemove: (index: number) => void;
}

export function ContactsManager({ contacts, onAdd, onUpdate, onRemove }: ContactsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [destTag, setDestTag] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setLabel("");
    setAddress("");
    setDestTag("");
    setFormError(null);
    setEditIndex(null);
    setShowForm(false);
  }

  function handleEdit(index: number) {
    const c = contacts[index];
    setLabel(c.label);
    setAddress(c.address);
    setDestTag(c.destinationTag !== undefined ? String(c.destinationTag) : "");
    setEditIndex(index);
    setShowForm(true);
    setFormError(null);
  }

  function handleSave() {
    const trimLabel = label.trim();
    const trimAddress = address.trim();
    if (!trimLabel) { setFormError("Label is required"); return; }
    if (!trimAddress) { setFormError("Address is required"); return; }

    const contact: Contact = { label: trimLabel, address: trimAddress };
    if (destTag.trim()) {
      const parsed = parseInt(destTag.trim(), 10);
      if (isNaN(parsed) || parsed < 0) {
        setFormError("Destination tag must be a non-negative integer");
        return;
      }
      contact.destinationTag = parsed;
    }

    if (editIndex !== null) {
      onUpdate(editIndex, contact);
    } else {
      onAdd(contact);
    }
    resetForm();
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Contacts</h2>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + Add Contact
          </button>
        )}
      </div>

      {contacts.length === 0 && !showForm && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No contacts yet. Add a contact to quickly send funds.
        </p>
      )}

      {contacts.length > 0 && (
        <div className="mt-3 space-y-2">
          {contacts.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.label}</p>
                <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{c.address}</p>
                {c.destinationTag !== undefined && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Tag: {c.destinationTag}</p>
                )}
              </div>
              <div className="ml-3 flex gap-2">
                <button
                  onClick={() => handleEdit(i)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove contact "${c.label}"?`)) {
                      onRemove(i);
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-3 space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
          <div>
            <label className={labelClass}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Exchange Hot Wallet"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="rXXXXXXXX..."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Destination Tag (optional)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={destTag}
              onChange={(e) => setDestTag(e.target.value)}
              placeholder="e.g. 12345"
              className={inputClass}
            />
          </div>
          {formError && <p className={errorTextClass}>{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {editIndex !== null ? "Update" : "Add"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
