import { useState } from "react";
import api from "../api";

export default function CreateAdminModal({ onCreated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function createAdmin() {
    setErr("");

    if (!username.trim() || !password.trim()) {
      setErr("Username and password are required.");
      return;
    }

    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/create-admin", { username: username.trim(), password });
      onCreated?.();
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to create admin account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1a1d29] p-6 rounded-2xl w-96 shadow-xl border border-white/10">
        <h2 className="text-xl mb-2 font-semibold">Initial Setup</h2>
        <p className="text-sm text-gray-400 mb-4">
          Create the first admin account before using StoragArr.
        </p>

        <input
          className="w-full mb-3 px-3 py-2 rounded bg-black/30 border border-white/10"
          placeholder="Admin username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="w-full mb-3 px-3 py-2 rounded bg-black/30 border border-white/10"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          className="w-full mb-3 px-3 py-2 rounded bg-black/30 border border-white/10"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {err && <p className="text-red-400 text-sm mb-2">{err}</p>}

        <button
          onClick={createAdmin}
          disabled={busy}
          className="mt-2 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create Admin"}
        </button>
      </div>
    </div>
  );
}
