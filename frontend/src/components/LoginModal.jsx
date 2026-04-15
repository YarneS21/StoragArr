import { useState } from "react";
import api from "../api";

export default function LoginModal({ close, onSuccess }) {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState("");

  async function login() {
    setErr("");
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
      onSuccess?.();
      close?.();
    } catch (e) {
      if (e?.response?.status === 400) {
        setErr("No admin exists yet. Create one first.");
        return;
      }
      setErr("Invalid username or password");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
      <div className="bg-[#1a1d29] p-6 rounded-2xl w-80 shadow-xl">
        <h2 className="text-xl mb-4 font-semibold">Admin Login</h2>

        <input
          className="w-full mb-3 px-3 py-2 rounded bg-black/30 border border-white/10"
          placeholder="Username"
          onChange={(e) => setUser(e.target.value)}
        />

        <input
          type="password"
          className="w-full mb-3 px-3 py-2 rounded bg-black/30 border border-white/10"
          placeholder="Password"
          onChange={(e) => setPass(e.target.value)}
        />

        {err && <p className="text-red-400 text-sm">{err}</p>}

        <button
          onClick={login}
          className="mt-4 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700"
        >
          Login
        </button>

        <button className="mt-2 w-full text-gray-400" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}