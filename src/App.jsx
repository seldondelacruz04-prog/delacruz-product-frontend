import { useEffect, useState } from "react";
import api, { session, errorMessage, toList } from "./api";
import "./App.css";

const EMPTY = { product_name: "", description: "", price: "", quantity: "" };

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      session.save(data);
      onLogin(data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit} className="panel">
        <div>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to manage your product inventory.</p>
        </div>
        <label>Username
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoFocus />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ ...form, price: Number(form.price), quantity: parseInt(form.quantity, 10) });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onCancel}>
      <form className="panel modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PRODUCT DETAILS</p>
            <h2 id="product-form-title">{initial.id ? "Edit product" : "Add product"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close dialog">×</button>
        </div>
        <label>Product name
          <input value={form.product_name} onChange={set("product_name")} maxLength={100} required autoFocus />
        </label>
        <label>Description
          <textarea rows={3} value={form.description || ""} onChange={set("description")} />
        </label>
        <div className="row">
          <label>Price
            <input type="number" step="0.01" min="0" value={form.price} onChange={set("price")} required />
          </label>
          <label>Quantity
            <input type="number" min="0" step="1" value={form.quantity} onChange={set("quantity")} required />
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={busy}>{busy ? "Saving..." : initial.id ? "Save changes" : "Add product"}</button>
        </div>
      </form>
    </div>
  );
}

function Products({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const canWrite = user?.role === "admin";
  const visibleItems = items.filter((item) =>
    `${item.product_name} ${item.description || ""}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const totalUnits = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/products");
      setItems(toList(data));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (values) => {
    if (values.id) await api.put(`/products/${values.id}`, values);
    else await api.post("/products", values);
    setEditing(null);
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.product_name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout", { refresh_token: session.refresh }); } catch { /* ituloy pa rin */ }
    onLogout();
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#products"><span className="nav-glyph">▦</span>Products</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar" aria-hidden="true">{(user?.username || "U").slice(0, 1).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{user?.username || "User"}</strong>
              <span>{canWrite ? "Administrator" : "Read only"}</span>
            </div>
          </div>
          <button className="logout-button" onClick={logout}>Sign out <span aria-hidden="true">↗</span></button>
        </div>
      </aside>

      <section className="workspace" id="products">
        <header className="page-header">
          <div>
            <p className="eyebrow">INVENTORY / CATALOG</p>
            <div className="title-line">
              <h1>Products</h1>
              <span className="count-badge">{items.length}</span>
            </div>
            <p className="page-subtitle">A clear view of everything in your catalog.</p>
          </div>
          {canWrite && <button className="primary add-button" onClick={() => setEditing(EMPTY)}><span aria-hidden="true">+</span> Add product</button>}
        </header>

        <section className="metrics" aria-label="Inventory summary">
          <div className="metric"><span className="metric-label">TOTAL PRODUCTS</span><strong>{items.length}</strong></div>
          <div className="metric"><span className="metric-label">UNITS IN STOCK</span><strong>{totalUnits.toLocaleString()}</strong></div>
        </section>

        {error && <p className="error page-error" role="alert">{error}</p>}

        <section className="catalog" aria-label="Product catalog">
          <div className="catalog-toolbar">
            <div>
              <h2>All products</h2>
              <p className="muted">{search ? `${visibleItems.length} results` : "Your complete product list"}</p>
            </div>
            <div className="toolbar-actions">
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input aria-label="Search products" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} />
                {search && <button className="clear-search" type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
              </label>
              <button className="refresh-button" onClick={load} disabled={loading} aria-label="Refresh products" title="Refresh products">↻</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>DESCRIPTION</th>
                  <th className="num">PRICE</th>
                  <th className="num">QUANTITY</th>
                  {canWrite && <th className="action-heading">ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={canWrite ? 5 : 4} className="table-message">Loading products...</td></tr>}
                {!loading && visibleItems.length === 0 && (
                  <tr><td colSpan={canWrite ? 5 : 4} className="table-message">
                    <strong>{items.length ? "No matching products" : "Your catalog is empty"}</strong>
                    <span>{items.length ? "Try a different search term." : canWrite ? "Add your first product to get started." : "Products will appear here when they are added."}</span>
                  </td></tr>
                )}
                {!loading && visibleItems.map((product) => {
                  const quantity = Number(product.quantity) || 0;
                  return (
                    <tr key={product.id}>
                      <td className="product-cell">
                        <strong>{product.product_name}</strong>
                      </td>
                      <td className="description-cell">{product.description || "No description"}</td>
                      <td className="num price-cell">₱{Number(product.price).toFixed(2)}</td>
                      <td className="num quantity-cell">{quantity}</td>
                      {canWrite && <td><div className="row-actions">
                        <button className="icon-button row-icon-button" onClick={() => setEditing(product)} aria-label={`Edit ${product.product_name}`} title="Edit product">
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                        </button>
                        <button className="icon-button row-icon-button delete-button" onClick={() => remove(product)} aria-label={`Delete ${product.product_name}`} title="Delete product">
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
                        </button>
                      </div></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="catalog-footer"><span>Showing {visibleItems.length} of {items.length} products</span><span className="sync-indicator"><i /> Live inventory</span></footer>
        </section>
      </section>

      {canWrite && editing && <ProductForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(session.access ? session.user || {} : null);

  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, []);

  const logout = () => { session.clear(); setUser(null); };

  return user ? <Products user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}