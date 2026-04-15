import { useEffect, useState } from "react";
import api from "../api";

export default function Admin() {
  const [dirs, setDirs] = useState([]);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [draggingId, setDraggingId] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPath, setEditPath] = useState("");
  const [editColor, setEditColor] = useState("#8b5cf6");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/public/directories");
    setDirs(Array.isArray(res.data) ? res.data : []);
  }

  async function add() {
    const token = localStorage.getItem("token");
    try {
      await api.post(
        "/admin/add-directory",
        {
          name,
          path,
          color
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setName("");
      setPath("");
      setColor("#8b5cf6");
      load();
    } catch (err) {
      console.error("Failed to add directory", err);
    }
  }

  async function del(id) {
    const token = localStorage.getItem("token");
    await api.post(
      "/admin/delete-directory",
      { id },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    load();
  }

  function moveById(items, fromId, toId) {
    const fromIndex = items.findIndex((x) => x.id === fromId);
    const toIndex = items.findIndex((x) => x.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;

    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  }

  async function persistOrder(items) {
    const token = localStorage.getItem("token");
    setSavingOrder(true);
    try {
      await api.post(
        "/admin/reorder-directories",
        { ids: items.map((x) => x.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Failed to save directory order", err);
      await load();
    } finally {
      setSavingOrder(false);
    }
  }

  function startEdit(dir) {
    setEditingId(dir.id);
    setEditName(dir.name || "");
    setEditPath(dir.path || "");
    setEditColor(dir.color || "#8b5cf6");
  }

  function cancelEdit() {
    setEditingId("");
    setEditName("");
    setEditPath("");
    setEditColor("#8b5cf6");
  }

  async function saveEdit() {
    if (!editingId) return;
    const token = localStorage.getItem("token");
    setSavingEdit(true);
    try {
      await api.post(
        "/admin/update-directory",
        {
          id: editingId,
          name: editName,
          path: editPath,
          color: editColor
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      cancelEdit();
      await load();
    } catch (err) {
      console.error("Failed to update directory", err);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      <div className="bg-[#151821] p-4 rounded-xl border border-white/5 mb-8">
        <h2 className="text-xl mb-4">Add Directory</h2>

        <input
          className="w-full mb-2 px-3 py-2 rounded bg-black/20 border border-white/10"
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full mb-2 px-3 py-2 rounded bg-black/20 border border-white/10"
          placeholder="/media/movies"
          onChange={(e) => setPath(e.target.value)}
        />

        <input
          type="color"
          className="mb-3"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />

        <button
          onClick={add}
          className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-xl mt-3"
        >
          Add
        </button>
      </div>

      <h2 className="text-xl mb-3">Existing Directories</h2>
      <p className="text-xs text-gray-400 mb-3">
        Drag cards to reorder how libraries are shown on the dashboard.
        {savingOrder ? " Saving order..." : ""}
      </p>

      <div className="space-y-3">
        {dirs.map((d) => (
          <div
            key={d.id}
            draggable={editingId !== d.id}
            onDragStart={() => setDraggingId(d.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async () => {
              if (!draggingId || draggingId === d.id) return;
              const next = moveById(dirs, draggingId, d.id);
              setDirs(next);
              setDraggingId("");
              await persistOrder(next);
            }}
            onDragEnd={() => setDraggingId("")}
            className="bg-[#1b1f2d] p-4 rounded-xl border border-white/5 shadow"
          >
            {editingId === d.id ? (
              <div>
                <input
                  className="w-full mb-2 px-3 py-2 rounded bg-black/20 border border-white/10"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <input
                  className="w-full mb-2 px-3 py-2 rounded bg-black/20 border border-white/10"
                  value={editPath}
                  onChange={(e) => setEditPath(e.target.value)}
                />
                <input
                  type="color"
                  className="mb-3"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl disabled:opacity-60"
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="bg-gray-600 hover:bg-gray-700 py-2 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{d.name}</h3>
                    <p className="text-gray-400 text-sm">{d.path}</p>
                  </div>
                  <span className="text-xs text-gray-500 cursor-grab select-none">Drag</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => startEdit(d)}
                    className="bg-blue-600 hover:bg-blue-700 py-2 rounded-xl"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => del(d.id)}
                    className="bg-red-600 hover:bg-red-700 py-2 rounded-xl"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}