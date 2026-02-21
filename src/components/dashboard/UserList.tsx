"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatRelativeTime } from "@/lib/utils";

export default function UserList() {
  const { user: clerkUser } = useUser();
  const users = useQuery(api.users.listAll);
  const updateProfile = useMutation(api.users.updateProfile);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  if (users === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">No registered users yet.</p>
    );
  }

  const handleStartEdit = (userClerkId: string, currentName: string) => {
    setEditingId(userClerkId);
    setEditName(currentName);
  };

  const handleSave = async (userClerkId: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ clerkId: userClerkId, name: editName.trim() });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditName("");
  };

  const isOwnUser = (userClerkId: string) => clerkUser?.id === userClerkId;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">User</th>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</th>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Last Seen</th>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Joined</th>
            <th className="w-20 px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u._id}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {u.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.imageUrl}
                      alt={u.name}
                      className="h-7 w-7 rounded-full"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {editingId === u.clerkId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSave(u.clerkId);
                          if (e.key === "Escape") handleCancel();
                        }}
                        autoFocus
                        className="w-40 rounded border border-blue-300 bg-white px-2 py-0.5 text-sm text-zinc-900 outline-none focus:ring-1 focus:ring-blue-400 dark:border-blue-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        onClick={() => handleSave(u.clerkId)}
                        disabled={saving || !editName.trim()}
                        className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {u.name}
                      {isOwnUser(u.clerkId) && (
                        <span className="ml-1.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
                          You
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                {u.email}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-400">
                {formatRelativeTime(u.lastSeenAt)}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-400">
                {formatRelativeTime(u.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {isOwnUser(u.clerkId) && editingId !== u.clerkId && (
                  <button
                    onClick={() => handleStartEdit(u.clerkId, u.name)}
                    className="rounded px-2 py-1 text-[10px] font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Edit Name
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
