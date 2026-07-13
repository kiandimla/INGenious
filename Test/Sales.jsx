import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Notice from "../components/Notice";
import { api, money } from "../api/client";

const SEARCH_DELAY_MS = 500;
const clean = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function Sales() {
  const navigate = useNavigate();
  const invoiceRef = useRef(null);
  const quantityRef = useRef(null);
  const discountRef = useRef(null);
  const remarksRef = useRef(null);
  const productRows = useRef([]);
  const saleRows = useRef([]);
  const searchTimer = useRef(null);

  const [products, setProducts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState([]);
  const [saleIndex, setSaleIndex] = useState(-1);
  const [productIndex, setProductIndex] = useState(0);
  const [productPopup, setProductPopup] = useState(false);
  const [searchBuffer, setSearchBuffer] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [quantityPopup, setQuantityPopup] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [discountPopup, setDiscountPopup] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [discountRemarks, setDiscountRemarks] = useState("");
  const [discountDraft, setDiscountDraft] = useState("20");
  const [remarksDraft, setRemarksDraft] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [saving, setSaving] = useState(false);

  const notify = useCallback((text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await api("/api/products/available");
      setProducts(response.products);
    } catch (error) {
      notify(error.message);
    }
  }, [notify]);

  const loadNextInvoice = useCallback(async () => {
    try {
      const response = await api("/api/sales/next-invoice");
      setInvoiceNumber(response.invoiceNumber || "1");
    } catch (error) {
      notify(error.message);
    }
  }, [notify]);

  useEffect(() => {
    loadProducts();
    loadNextInvoice();
    requestAnimationFrame(() => invoiceRef.current?.focus());
    return () => clearTimeout(searchTimer.current);
  }, [loadNextInvoice, loadProducts]);

  const filteredProducts = useMemo(() => {
    const needle = clean(searchFilter);
    if (!needle) return products;
    const begins = [];
    const contains = [];
    for (const product of products) {
      const name = clean(product.itemName);
      const id = clean(product.itemId);
      if (name.startsWith(needle) || id.startsWith(needle)) begins.push(product);
      else if (name.includes(needle) || id.includes(needle)) contains.push(product);
    }
    return [...begins, ...contains];
  }, [products, searchFilter]);

  useEffect(() => {
    if (!productPopup) return;
    setProductIndex(current => Math.min(current, Math.max(filteredProducts.length - 1, 0)));
  }, [filteredProducts.length, productPopup]);

  useEffect(() => {
    if (!productPopup) return;
    requestAnimationFrame(() => {
      const row = productRows.current[productIndex];
      row?.focus();
      row?.scrollIntoView({ block: "nearest" });
    });
  }, [productIndex, productPopup, filteredProducts]);

  const focusSaleRow = useCallback(index => {
    if (!items.length) {
      setSaleIndex(-1);
      invoiceRef.current?.focus();
      return;
    }
    const next = Math.max(0, Math.min(index, items.length - 1));
    setSaleIndex(next);
    requestAnimationFrame(() => saleRows.current[next]?.focus());
  }, [items.length]);

  const openProducts = useCallback(() => {
    if (!products.length) return notify("No products currently have available stock.");
    setSearchBuffer("");
    setSearchFilter("");
    setProductIndex(0);
    setProductPopup(true);
  }, [notify, products.length]);

  const closeProducts = useCallback((focusIndex = saleIndex) => {
    setProductPopup(false);
    requestAnimationFrame(() => {
      if (focusIndex >= 0) saleRows.current[focusIndex]?.focus();
      else invoiceRef.current?.focus();
    });
  }, [saleIndex]);

  const addProduct = useCallback(product => {
    if (!product) return;
    let targetIndex = 0;
    let warning = "";
    setItems(current => {
      const existing = current.findIndex(item => item.productId === product.itemId);
      if (existing >= 0) {
        targetIndex = existing;
        return current.map((item, index) => {
          if (index !== existing) return item;
          if (item.quantity >= item.available) {
            warning = `Maximum available quantity is ${item.available}.`;
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        });
      }
      targetIndex = current.length;
      return [...current, {
        productId: product.itemId,
        name: product.itemName,
        priceCentavos: product.priceCentavos,
        available: product.quantity,
        quantity: 1,
        applyDiscount: false,
        discountEligible: product.discountEligible !== false
      }];
    });

    // Close immediately. The popup key event is also stopped below so Enter cannot reopen it.
    setProductPopup(false);
    setSaleIndex(targetIndex);
    requestAnimationFrame(() => saleRows.current[targetIndex]?.focus());
    if (warning) notify(warning);
  }, [notify]);

  const typeSearch = useCallback(key => {
    const next = searchBuffer + clean(key);
    setSearchBuffer(next);
    setSearchFilter(next);
    setProductIndex(0);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchBuffer(""), SEARCH_DELAY_MS);
  }, [searchBuffer]);

  function handleProductKey(event) {
    // Critical: prevent the same Enter from reaching the page-level handler.
    event.stopPropagation();

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setProductIndex(value => Math.min(value + 1, filteredProducts.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setProductIndex(value => Math.max(value - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      addProduct(filteredProducts[productIndex]);
      return;
    }
    if (event.key === "Escape" || event.key === "Backspace") {
      event.preventDefault();
      closeProducts();
      return;
    }
    if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
      event.preventDefault();
      typeSearch(event.key);
    }
  }

  const openQuantity = useCallback(() => {
    if (!items[saleIndex]) return;
    setQuantityDraft(String(items[saleIndex].quantity));
    setQuantityPopup(true);
    requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
  }, [items, saleIndex]);

  const closeQuantity = useCallback(() => {
    setQuantityPopup(false);
    requestAnimationFrame(() => saleRows.current[saleIndex]?.focus());
  }, [saleIndex]);

  const commitQuantity = useCallback(() => {
    const item = items[saleIndex];
    const requested = Number.parseInt(quantityDraft, 10);
    if (!item || !Number.isInteger(requested) || requested < 1) {
      notify("Quantity must be at least 1.");
      return;
    }
    const finalQuantity = Math.min(requested, item.available);
    setItems(current => current.map((value, index) => index === saleIndex
      ? { ...value, quantity: finalQuantity }
      : value));
    if (requested > item.available) notify(`Maximum available quantity is ${item.available}.`);
    closeQuantity();
  }, [closeQuantity, items, notify, quantityDraft, saleIndex]);

  const toggleDiscount = useCallback(() => {
    const item = items[saleIndex];
    if (!item) return;
    if (!item.discountEligible) return notify(`${item.name} is not eligible for a discount.`);
    setItems(current => current.map((value, index) => index === saleIndex
      ? { ...value, applyDiscount: !value.applyDiscount }
      : value));
  }, [items, notify, saleIndex]);

  const removeItem = useCallback(() => {
    if (saleIndex < 0) return;
    const remaining = items.length - 1;
    const nextIndex = Math.max(0, saleIndex - 1);
    setItems(current => current.filter((_, index) => index !== saleIndex));
    setSaleIndex(remaining ? nextIndex : -1);
    requestAnimationFrame(() => remaining
      ? saleRows.current[nextIndex]?.focus()
      : invoiceRef.current?.focus());
  }, [items.length, saleIndex]);

  const openDiscount = useCallback(() => {
    setDiscountDraft(String(discountPercent));
    setRemarksDraft(discountRemarks);
    setDiscountPopup(true);
    requestAnimationFrame(() => {
      discountRef.current?.focus();
      discountRef.current?.select();
    });
  }, [discountPercent, discountRemarks]);

  const closeDiscount = useCallback(() => {
    setDiscountPopup(false);
    requestAnimationFrame(() => saleIndex >= 0
      ? saleRows.current[saleIndex]?.focus()
      : invoiceRef.current?.focus());
  }, [saleIndex]);

  const commitDiscount = useCallback(() => {
    const percent = Number.parseInt(discountDraft || "20", 10);
    if (!Number.isInteger(percent) || percent < 0 || percent > 99) {
      return notify("Discount must be between 0 and 99.");
    }
    setDiscountPercent(percent);
    setDiscountRemarks(remarksDraft.trim());
    closeDiscount();
  }, [closeDiscount, discountDraft, notify, remarksDraft]);

  const clearSale = useCallback(() => {
    setItems([]);
    setSaleIndex(-1);
    setMessage("");
    requestAnimationFrame(() => {
      invoiceRef.current?.focus();
      invoiceRef.current?.select();
    });
  }, []);

  const saveSale = useCallback(async () => {
    if (saving) return;
    if (!invoiceNumber.trim()) {
      notify("SI Number is empty.");
      return invoiceRef.current?.focus();
    }
    if (!items.length) return notify("Sale has no items.");
    try {
      setSaving(true);
      const response = await api("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          invoiceNumber,
          discountPercent,
          discountRemarks,
          items: items.map(({ productId, quantity, applyDiscount }) => ({
            productId, quantity, applyDiscount
          }))
        })
      });
      setItems([]);
      setSaleIndex(-1);
      setInvoiceNumber(response.sale.nextSuggestedInvoice || "");
      notify(`Invoice ${response.sale.invoiceNumber} saved.`, "success");
      await loadProducts();
      requestAnimationFrame(() => invoiceRef.current?.focus());
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }, [discountPercent, discountRemarks, invoiceNumber, items, loadProducts, notify, saving]);

  useEffect(() => {
    function handlePageKey(event) {
      if (productPopup || quantityPopup || discountPopup) return;

      if (event.key === "F5") { event.preventDefault(); saveSale(); return; }
      if (event.key === "F9") { event.preventDefault(); clearSale(); return; }
      if (event.key === "F10") { event.preventDefault(); navigate("/home"); return; }
      if (event.key === "F4") { event.preventDefault(); openDiscount(); return; }

      if (event.target === invoiceRef.current && event.key === "Enter") {
        event.preventDefault();
        openProducts();
        return;
      }

      if (saleIndex < 0) return;
      if (event.key === "ArrowDown") { event.preventDefault(); focusSaleRow(saleIndex + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); focusSaleRow(saleIndex - 1); }
      else if (event.key.toLowerCase() === "q") { event.preventDefault(); openQuantity(); }
      else if (event.key.toLowerCase() === "d") { event.preventDefault(); toggleDiscount(); }
      else if (event.key === "F2") { event.preventDefault(); removeItem(); }
      else if (event.key === "Enter") { event.preventDefault(); openProducts(); }
    }
    document.addEventListener("keydown", handlePageKey);
    return () => document.removeEventListener("keydown", handlePageKey);
  }, [clearSale, discountPopup, focusSaleRow, navigate, openDiscount, openProducts, openQuantity, productPopup, quantityPopup, removeItem, saleIndex, saveSale, toggleDiscount]);

  const gross = useMemo(() => items.reduce((sum, item) => sum + item.priceCentavos * item.quantity, 0), [items]);
  const discounts = useMemo(() => items.reduce((sum, item) => item.applyDiscount
    ? sum + Math.round(item.priceCentavos * item.quantity * discountPercent / 100)
    : sum, 0), [discountPercent, items]);
  const total = gross - discounts;
  const vat = Math.round(total * 12 / 112);

  return <Layout title="Encode Sales">
    <section className={productPopup || quantityPopup || discountPopup ? "sales-screen blurred" : "sales-screen"}>
      <div className="encode-toolbar">
        <label>SI <input ref={invoiceRef} value={invoiceNumber} inputMode="numeric"
          onChange={event => setInvoiceNumber(event.target.value.replace(/\D/g, ""))}
          placeholder="SI Number" /></label>
        <span>Discount: <strong>{discountPercent}%</strong></span>
      </div>
      <div className="shortcut-help">Enter Items · ↑/↓ Navigate · Q Quantity · D Discount · F2 Remove · F4 Discount Setup · F5 Save · F9 Clear</div>
      <Notice message={message} type={messageType} />

      <div className="sale-table-scroll">
        <table className="sale-table">
          <thead>
            <tr><th>Qty</th><th>Description</th><th>Unit Price</th><th>Apply Discount</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lineGross = item.priceCentavos * item.quantity;
              const lineDiscount = item.applyDiscount ? Math.round(lineGross * discountPercent / 100) : 0;
              return <tr key={item.productId} ref={node => saleRows.current[index] = node}
                tabIndex={0} className={index === saleIndex ? "active-keyboard-row" : ""}
                onFocus={() => setSaleIndex(index)}>
                <td>{item.quantity}</td><td>{item.name}</td><td>{money(item.priceCentavos)}</td>
                <td><input type="checkbox" tabIndex={-1} disabled={!item.discountEligible}
                  checked={item.applyDiscount} readOnly /></td>
                <td>{money(lineGross - lineDiscount)}</td>
              </tr>;
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}></td><th>Subtotal:</th><td>{money(gross)}</td></tr>
            <tr><td colSpan={3}></td><th>Discounts:</th><td>{money(discounts)}</td></tr>
            <tr><td colSpan={3}></td><th>VAT (12% included):</th><td>{money(vat)}</td></tr>
            <tr className="grand-total"><td colSpan={3}></td><th>Total:</th><td>{money(total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>

    {productPopup && <div className="encode-modal" role="dialog" aria-modal="true" onKeyDown={handleProductKey}>
      <section className="product-picker">
        <header className="picker-status">
          <span>Filter: <strong>{searchFilter || "All items"}</strong></span>
          <span>Keys: <strong>{searchBuffer || "—"}</strong></span>
          <b>{filteredProducts[productIndex] ? money(filteredProducts[productIndex].priceCentavos) : money(0)}</b>
        </header>
        <div className="picker-scroll">
          <table className="picker-table">
            <thead><tr><th>Description</th><th>Price</th><th>Item Code</th><th>Available</th></tr></thead>
            <tbody>
              {filteredProducts.map((product, index) => <tr key={product.itemId}
                ref={node => productRows.current[index] = node} tabIndex={0}
                className={index === productIndex ? "active-keyboard-row" : ""}
                onFocus={() => setProductIndex(index)} onDoubleClick={() => addProduct(product)}>
                <td>{product.itemName}</td><td>{money(product.priceCentavos)}</td><td>{product.itemId}</td><td>{product.quantity}</td>
              </tr>)}
              {!filteredProducts.length && <tr><td colSpan={4}>No matching products</td></tr>}
            </tbody>
          </table>
        </div>
        <footer>Type to filter · ↑/↓ Navigate · Enter Add · Escape/Backspace Close</footer>
      </section>
    </div>}

    {quantityPopup && <div className="encode-modal" role="dialog" aria-modal="true">
      <section className="entry-dialog"><h2>Enter Quantity</h2><b>{items[saleIndex]?.name}</b>
        <input ref={quantityRef} value={quantityDraft} inputMode="numeric"
          onChange={event => setQuantityDraft(event.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") commitQuantity(); if (event.key === "Escape") closeQuantity(); }} />
        <span>Available: {items[saleIndex]?.available || 0}</span>
      </section>
    </div>}

    {discountPopup && <div className="encode-modal" role="dialog" aria-modal="true">
      <section className="entry-dialog"><h2>Discount Settings</h2>
        <label>Percentage<input ref={discountRef} value={discountDraft} inputMode="numeric"
          onChange={event => setDiscountDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
          onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") remarksRef.current?.focus(); if (event.key === "Escape") closeDiscount(); }} /></label>
        <label>Remarks<input ref={remarksRef} value={remarksDraft}
          onChange={event => setRemarksDraft(event.target.value)}
          onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") commitDiscount(); if (event.key === "Escape") closeDiscount(); }} /></label>
      </section>
    </div>}
  </Layout>;
}
