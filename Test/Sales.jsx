import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import Notice from "../components/Notice";
import { api, money } from "../api/client";

const SEARCH_RESET_DELAY = 500;

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export default function Sales() {
  const navigate = useNavigate();

  const invoiceInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const discountRemarksRef = useRef(null);

  const productRowRefs = useRef([]);
  const saleRowRefs = useRef([]);

  const searchTimeoutRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [items, setItems] = useState([]);

  const [discountPercent, setDiscountPercent] = useState(20);
  const [discountRemarks, setDiscountRemarks] = useState("");

  const [activeSaleRow, setActiveSaleRow] = useState(-1);

  const [productPopupOpen, setProductPopupOpen] =
    useState(false);

  const [activeProductRow, setActiveProductRow] =
    useState(0);

  const [productSearchBuffer, setProductSearchBuffer] =
    useState("");

  const [productFilter, setProductFilter] =
    useState("");

  const [quantityPopupOpen, setQuantityPopupOpen] =
    useState(false);

  const [quantityDraft, setQuantityDraft] =
    useState("");

  const [discountPopupOpen, setDiscountPopupOpen] =
    useState(false);

  const [discountDraft, setDiscountDraft] =
    useState("20");

  const [discountRemarksDraft, setDiscountRemarksDraft] =
    useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("error");

  const [saving, setSaving] = useState(false);

  const popupOpen =
    productPopupOpen ||
    quantityPopupOpen ||
    discountPopupOpen;

  const notify = useCallback((text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await api(
        "/api/products/available"
      );

      setProducts(response.products);
    } catch (error) {
      notify(error.message);
    }
  }, [notify]);

  const loadNextInvoice = useCallback(async () => {
    try {
      const response = await api(
        "/api/sales/next-invoice"
      );

      setInvoiceNumber(response.invoiceNumber || "1");
    } catch (error) {
      notify(error.message);
    }
  }, [notify]);

  useEffect(() => {
    loadProducts();
    loadNextInvoice();
  }, [loadProducts, loadNextInvoice]);

  useEffect(() => {
    invoiceInputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!productFilter) {
      return products;
    }

    const normalizedFilter =
      normalizeSearchValue(productFilter);

    const startsWithResults = products.filter(
      product =>
        normalizeSearchValue(product.itemName)
          .startsWith(normalizedFilter) ||
        normalizeSearchValue(product.itemId)
          .startsWith(normalizedFilter)
    );

    const containsResults = products.filter(
      product =>
        !startsWithResults.includes(product) &&
        (
          normalizeSearchValue(product.itemName)
            .includes(normalizedFilter) ||
          normalizeSearchValue(product.itemId)
            .includes(normalizedFilter)
        )
    );

    return [
      ...startsWithResults,
      ...containsResults
    ];
  }, [productFilter, products]);

  useEffect(() => {
    if (!productPopupOpen) {
      return;
    }

    if (activeProductRow >= filteredProducts.length) {
      setActiveProductRow(
        Math.max(filteredProducts.length - 1, 0)
      );
    }
  }, [
    activeProductRow,
    filteredProducts.length,
    productPopupOpen
  ]);

  useEffect(() => {
    if (!productPopupOpen) {
      return;
    }

    requestAnimationFrame(() => {
      const row =
        productRowRefs.current[activeProductRow];

      row?.focus();

      row?.scrollIntoView({
        block: "nearest"
      });
    });
  }, [
    activeProductRow,
    filteredProducts,
    productPopupOpen
  ]);

  useEffect(() => {
    if (quantityPopupOpen) {
      requestAnimationFrame(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      });
    }
  }, [quantityPopupOpen]);

  useEffect(() => {
    if (discountPopupOpen) {
      requestAnimationFrame(() => {
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      });
    }
  }, [discountPopupOpen]);

  const focusSaleRow = useCallback(
    requestedIndex => {
      if (items.length === 0) {
        setActiveSaleRow(-1);
        invoiceInputRef.current?.focus();
        return;
      }

      const index = Math.max(
        0,
        Math.min(requestedIndex, items.length - 1)
      );

      setActiveSaleRow(index);

      requestAnimationFrame(() => {
        const row = saleRowRefs.current[index];

        row?.focus();

        row?.scrollIntoView({
          block: "nearest"
        });
      });
    },
    [items.length]
  );

  const openProductPopup = useCallback(() => {
    if (products.length === 0) {
      notify(
        "No products with available inventory were found."
      );

      return;
    }

    setProductSearchBuffer("");
    setProductFilter("");
    setActiveProductRow(0);
    setProductPopupOpen(true);
  }, [notify, products.length]);

  const closeProductPopup = useCallback(() => {
    setProductPopupOpen(false);
    setProductSearchBuffer("");
    setProductFilter("");

    requestAnimationFrame(() => {
      if (activeSaleRow >= 0) {
        saleRowRefs.current[activeSaleRow]?.focus();
      } else {
        invoiceInputRef.current?.focus();
      }
    });
  }, [activeSaleRow]);

  const addProduct = useCallback(
    product => {
      if (!product) {
        return;
      }

      let resultingIndex = 0;
      let stockMessage = "";

      setItems(currentItems => {
        const existingIndex =
          currentItems.findIndex(
            item => item.productId === product.itemId
          );

        if (existingIndex >= 0) {
          resultingIndex = existingIndex;

          return currentItems.map((item, index) => {
            if (index !== existingIndex) {
              return item;
            }

            if (item.quantity >= item.available) {
              stockMessage =
                `Maximum available quantity is ` +
                `${item.available}.`;

              return item;
            }

            return {
              ...item,
              quantity: item.quantity + 1
            };
          });
        }

        resultingIndex = currentItems.length;

        return [
          ...currentItems,
          {
            productId: product.itemId,
            name: product.itemName,
            priceCentavos: product.priceCentavos,
            available: product.quantity,
            quantity: 1,
            applyDiscount: false,

            // This allows the API to add a future
            // discountEligible field without requiring
            // another UI rewrite.
            discountEligible:
              product.discountEligible !== false
          }
        ];
      });

      setProductPopupOpen(false);
      setActiveSaleRow(resultingIndex);

      requestAnimationFrame(() => {
        saleRowRefs.current[resultingIndex]?.focus();
      });

      if (stockMessage) {
        notify(stockMessage);
      }
    },
    [notify]
  );

  const updateSearchBuffer = useCallback(
    key => {
      const normalizedKey =
        normalizeSearchValue(key);

      if (!normalizedKey) {
        return;
      }

      const nextBuffer =
        productSearchBuffer + normalizedKey;

      setProductSearchBuffer(nextBuffer);
      setProductFilter(nextBuffer);
      setActiveProductRow(0);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        // Only the key-entry buffer is cleared.
        // productFilter remains unchanged so the current
        // search results stay visible.
        setProductSearchBuffer("");
      }, SEARCH_RESET_DELAY);
    },
    [productSearchBuffer]
  );

  const handleProductPopupKeyDown =
    useCallback(
      event => {
        if (event.key === "ArrowDown") {
          event.preventDefault();

          setActiveProductRow(current =>
            Math.min(
              current + 1,
              filteredProducts.length - 1
            )
          );

          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();

          setActiveProductRow(current =>
            Math.max(current - 1, 0)
          );

          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();

          addProduct(
            filteredProducts[activeProductRow]
          );

          return;
        }

        if (
          event.key === "Escape" ||
          event.key === "Backspace"
        ) {
          event.preventDefault();
          closeProductPopup();
          return;
        }

        if (
          event.key.length === 1 &&
          /[a-z0-9]/i.test(event.key)
        ) {
          event.preventDefault();
          updateSearchBuffer(event.key);
        }
      },
      [
        activeProductRow,
        addProduct,
        closeProductPopup,
        filteredProducts,
        updateSearchBuffer
      ]
    );

  const openQuantityPopup = useCallback(() => {
    const selectedItem = items[activeSaleRow];

    if (!selectedItem) {
      return;
    }

    setQuantityDraft(
      String(selectedItem.quantity)
    );

    setQuantityPopupOpen(true);
  }, [activeSaleRow, items]);

  const closeQuantityPopup = useCallback(() => {
    setQuantityPopupOpen(false);
    setQuantityDraft("");

    requestAnimationFrame(() => {
      saleRowRefs.current[activeSaleRow]?.focus();
    });
  }, [activeSaleRow]);

  const saveQuantity = useCallback(() => {
    const selectedItem = items[activeSaleRow];

    if (!selectedItem) {
      closeQuantityPopup();
      return;
    }

    const requestedQuantity =
      Number.parseInt(quantityDraft, 10);

    if (
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity < 1
    ) {
      notify("Quantity must be at least 1.");
      quantityInputRef.current?.focus();
      return;
    }

    const finalQuantity = Math.min(
      requestedQuantity,
      selectedItem.available
    );

    setItems(currentItems =>
      currentItems.map((item, index) =>
        index === activeSaleRow
          ? {
              ...item,
              quantity: finalQuantity
            }
          : item
      )
    );

    if (
      requestedQuantity >
      selectedItem.available
    ) {
      notify(
        `Maximum available quantity is ` +
        `${selectedItem.available}.`
      );
    }

    closeQuantityPopup();
  }, [
    activeSaleRow,
    closeQuantityPopup,
    items,
    notify,
    quantityDraft
  ]);

  const toggleSelectedDiscount =
    useCallback(() => {
      const selectedItem = items[activeSaleRow];

      if (!selectedItem) {
        return;
      }

      if (!selectedItem.discountEligible) {
        notify(
          `${selectedItem.name} is not eligible ` +
          `for a discount.`
        );

        return;
      }

      setItems(currentItems =>
        currentItems.map((item, index) =>
          index === activeSaleRow
            ? {
                ...item,
                applyDiscount:
                  !item.applyDiscount
              }
            : item
        )
      );
    }, [activeSaleRow, items, notify]);

  const removeSelectedItem =
    useCallback(() => {
      if (activeSaleRow < 0) {
        return;
      }

      const nextFocusIndex = Math.max(
        activeSaleRow - 1,
        0
      );

      setItems(currentItems =>
        currentItems.filter(
          (_, index) => index !== activeSaleRow
        )
      );

      requestAnimationFrame(() => {
        if (items.length <= 1) {
          setActiveSaleRow(-1);
          invoiceInputRef.current?.focus();
        } else {
          focusSaleRow(nextFocusIndex);
        }
      });
    }, [
      activeSaleRow,
      focusSaleRow,
      items.length
    ]);

  const openDiscountPopup = useCallback(() => {
    setDiscountDraft(
      String(discountPercent || 20)
    );

    setDiscountRemarksDraft(
      discountRemarks
    );

    setDiscountPopupOpen(true);
  }, [discountPercent, discountRemarks]);

  const closeDiscountPopup = useCallback(() => {
    setDiscountPopupOpen(false);

    requestAnimationFrame(() => {
      if (activeSaleRow >= 0) {
        saleRowRefs.current[activeSaleRow]?.focus();
      } else {
        invoiceInputRef.current?.focus();
      }
    });
  }, [activeSaleRow]);

  const saveDiscountSettings =
    useCallback(() => {
      const value = Number.parseInt(
        discountDraft || "20",
        10
      );

      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 99
      ) {
        notify(
          "Discount must be between 0 and 99."
        );

        discountInputRef.current?.focus();
        return;
      }

      setDiscountPercent(value);
      setDiscountRemarks(
        discountRemarksDraft.trim()
      );

      closeDiscountPopup();
    }, [
      closeDiscountPopup,
      discountDraft,
      discountRemarksDraft,
      notify
    ]);

  const clearTransaction = useCallback(() => {
    setItems([]);
    setActiveSaleRow(-1);
    setMessage("");

    requestAnimationFrame(() => {
      invoiceInputRef.current?.focus();
      invoiceInputRef.current?.select();
    });
  }, []);

  const saveSale = useCallback(async () => {
    if (saving) {
      return;
    }

    if (!invoiceNumber.trim()) {
      notify("SI Number is empty.");
      invoiceInputRef.current?.focus();
      return;
    }

    if (items.length === 0) {
      notify("Sale has no items.");
      return;
    }

    try {
      setSaving(true);

      const response = await api(
        "/api/sales",
        {
          method: "POST",
          body: JSON.stringify({
            invoiceNumber,
            discountPercent,
            discountRemarks,

            items: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              applyDiscount:
                item.applyDiscount
            }))
          })
        }
      );

      setItems([]);
      setActiveSaleRow(-1);

      setInvoiceNumber(
        response.sale.nextSuggestedInvoice ||
        ""
      );

      notify(
        `Invoice ${response.sale.invoiceNumber} ` +
        `was saved successfully.`,
        "success"
      );

      await loadProducts();

      requestAnimationFrame(() => {
        invoiceInputRef.current?.focus();
        invoiceInputRef.current?.select();
      });
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }, [
    discountPercent,
    discountRemarks,
    invoiceNumber,
    items,
    loadProducts,
    notify,
    saving
  ]);

  useEffect(() => {
    function handleGlobalKeyDown(event) {
      if (productPopupOpen) {
        // The popup handles its own keyboard events.
        return;
      }

      if (quantityPopupOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeQuantityPopup();
        }

        return;
      }

      if (discountPopupOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDiscountPopup();
        }

        return;
      }

      if (event.key === "F5") {
        event.preventDefault();
        saveSale();
        return;
      }

      if (event.key === "F9") {
        event.preventDefault();
        clearTransaction();
        return;
      }

      if (event.key === "F10") {
        event.preventDefault();
        navigate("/home");
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        openDiscountPopup();
        return;
      }

      const target = event.target;

      const targetIsTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (
        target === invoiceInputRef.current &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        openProductPopup();
        return;
      }

      if (
        targetIsTextInput &&
        target !== invoiceInputRef.current
      ) {
        return;
      }

      if (activeSaleRow < 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSaleRow(activeSaleRow + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusSaleRow(activeSaleRow - 1);
        return;
      }

      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        openQuantityPopup();
        return;
      }

      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        toggleSelectedDiscount();
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        removeSelectedItem();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        openProductPopup();
      }
    }

    document.addEventListener(
      "keydown",
      handleGlobalKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleGlobalKeyDown
      );
    };
  }, [
    activeSaleRow,
    clearTransaction,
    closeDiscountPopup,
    closeQuantityPopup,
    discountPopupOpen,
    focusSaleRow,
    navigate,
    openDiscountPopup,
    openProductPopup,
    openQuantityPopup,
    productPopupOpen,
    quantityPopupOpen,
    removeSelectedItem,
    saveSale,
    toggleSelectedDiscount
  ]);

  const grossTotalCentavos =
    useMemo(() => {
      return items.reduce(
        (total, item) =>
          total +
          item.priceCentavos * item.quantity,
        0
      );
    }, [items]);

  const discountTotalCentavos =
    useMemo(() => {
      return items.reduce(
        (total, item) => {
          if (!item.applyDiscount) {
            return total;
          }

          const gross =
            item.priceCentavos * item.quantity;

          return (
            total +
            Math.round(
              gross * discountPercent / 100
            )
          );
        },
        0
      );
    }, [discountPercent, items]);

  const netTotalCentavos =
    grossTotalCentavos -
    discountTotalCentavos;

  const vatTotalCentavos =
    Math.round(
      netTotalCentavos * 12 / 112
    );

  return (
    <Layout title="Encode Sales">
      <section
        className={
          popupOpen
            ? "sales-encoding blurred"
            : "sales-encoding"
        }
      >
        <div className="sales-header-row">
          <label className="si-field">
            <span>SI</span>

            <input
              ref={invoiceInputRef}
              value={invoiceNumber}
              placeholder="SI Number"
              inputMode="numeric"
              onChange={event => {
                setInvoiceNumber(
                  event.target.value.replace(
                    /\D/g,
                    ""
                  )
                );
              }}
            />
          </label>

          <div className="discount-display">
            Discount:
            <strong>
              {discountPercent}%
            </strong>
          </div>
        </div>

        <div className="shortcut-help">
          Enter: items · ↑/↓: navigate ·
          Q: quantity · D: discount ·
          F2: remove · F4: discount settings ·
          F5: save · F9: clear
        </div>

        <Notice
          message={message}
          type={messageType}
        />

        <div className="sales-table-container">
          <table className="sales-encode-table">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Description</th>
                <th>Unit Price</th>
                <th>Apply Discount</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => {
                const gross =
                  item.priceCentavos *
                  item.quantity;

                const discount =
                  item.applyDiscount
                    ? Math.round(
                        gross *
                        discountPercent /
                        100
                      )
                    : 0;

                const amount =
                  gross - discount;

                return (
                  <tr
                    key={item.productId}
                    ref={element => {
                      saleRowRefs.current[index] =
                        element;
                    }}
                    tabIndex={0}
                    className={
                      index === activeSaleRow
                        ? "active-keyboard-row"
                        : ""
                    }
                    onFocus={() => {
                      setActiveSaleRow(index);
                    }}
                  >
                    <td>{item.quantity}</td>

                    <td>{item.name}</td>

                    <td>
                      {money(
                        item.priceCentavos
                      )}
                    </td>

                    <td>
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        disabled={
                          !item.discountEligible
                        }
                        checked={
                          item.applyDiscount
                        }
                        onChange={() => {
                          setActiveSaleRow(index);

                          if (
                            !item.discountEligible
                          ) {
                            return;
                          }

                          setItems(
                            currentItems =>
                              currentItems.map(
                                (
                                  currentItem,
                                  currentIndex
                                ) =>
                                  currentIndex ===
                                  index
                                    ? {
                                        ...currentItem,
                                        applyDiscount:
                                          !currentItem
                                            .applyDiscount
                                      }
                                    : currentItem
                              )
                          );
                        }}
                      />
                    </td>

                    <td>
                      {money(amount)}
                    </td>
                  </tr>
                );
              })}

              <tr className="summary-row">
                <td colSpan={3} />
                <td>Subtotal:</td>
                <td>
                  {money(
                    grossTotalCentavos
                  )}
                </td>
              </tr>

              <tr className="summary-row">
                <td colSpan={3} />
                <td>Discounts:</td>
                <td>
                  {money(
                    discountTotalCentavos
                  )}
                </td>
              </tr>

              <tr className="summary-row">
                <td colSpan={3} />
                <td>VAT (12% included):</td>
                <td>
                  {money(
                    vatTotalCentavos
                  )}
                </td>
              </tr>

              <tr className="summary-row total-row">
                <td colSpan={3} />
                <td>Total:</td>
                <td>
                  {money(
                    netTotalCentavos
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {productPopupOpen && (
        <div
          className="encoding-popup-backdrop"
          onKeyDown={
            handleProductPopupKeyDown
          }
        >
          <section
            className="product-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Select product"
          >
            <div className="product-popup-search">
              <div>
                Search:
                <strong>
                  {productFilter || "All items"}
                </strong>
              </div>

              <div>
                Current keys:
                <strong>
                  {productSearchBuffer || "—"}
                </strong>
              </div>
            </div>

            <div className="product-popup-price">
              {filteredProducts[
                activeProductRow
              ]
                ? money(
                    filteredProducts[
                      activeProductRow
                    ].priceCentavos
                  )
                : money(0)}
            </div>

            <div className="product-popup-table">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Item Code</th>
                    <th>Available</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product, index) => (
                      <tr
                        key={product.itemId}
                        ref={element => {
                          productRowRefs
                            .current[index] =
                            element;
                        }}
                        tabIndex={0}
                        className={
                          index ===
                          activeProductRow
                            ? "active-keyboard-row"
                            : ""
                        }
                        onFocus={() => {
                          setActiveProductRow(
                            index
                          );
                        }}
                        onDoubleClick={() => {
                          addProduct(product);
                        }}
                      >
                        <td>
                          {product.itemName}
                        </td>

                        <td>
                          {money(
                            product
                              .priceCentavos
                          )}
                        </td>

                        <td>
                          {product.itemId}
                        </td>

                        <td>
                          {product.quantity}
                        </td>
                      </tr>
                    )
                  )}

                  {filteredProducts.length ===
                    0 && (
                    <tr>
                      <td colSpan={4}>
                        No matching products
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="popup-help">
              Type to filter · ↑/↓ navigate ·
              Enter add · Escape or Backspace close
            </div>
          </section>
        </div>
      )}

      {quantityPopupOpen && (
        <div className="encoding-popup-backdrop">
          <section
            className="small-entry-popup"
            role="dialog"
            aria-modal="true"
          >
            <h2>Enter Quantity</h2>

            <div className="selected-item-name">
              {items[activeSaleRow]?.name}
            </div>

            <input
              ref={quantityInputRef}
              value={quantityDraft}
              inputMode="numeric"
              onChange={event => {
                setQuantityDraft(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                );
              }}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveQuantity();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  closeQuantityPopup();
                }
              }}
            />

            <div>
              Available:
              {" "}
              {items[activeSaleRow]?.available ||
                0}
            </div>
          </section>
        </div>
      )}

      {discountPopupOpen && (
        <div className="encoding-popup-backdrop">
          <section
            className="small-entry-popup"
            role="dialog"
            aria-modal="true"
          >
            <h2>Discount Settings</h2>

            <label>
              Discount percentage

              <input
                ref={discountInputRef}
                value={discountDraft}
                inputMode="numeric"
                placeholder="20"
                onChange={event => {
                  setDiscountDraft(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2)
                  );
                }}
                onKeyDown={event => {
                  if (
                    event.key === "Enter"
                  ) {
                    event.preventDefault();

                    discountRemarksRef
                      .current
                      ?.focus();
                  }

                  if (
                    event.key === "Escape"
                  ) {
                    event.preventDefault();
                    closeDiscountPopup();
                  }
                }}
              />
            </label>

            <label>
              Remarks

              <input
                ref={discountRemarksRef}
                value={
                  discountRemarksDraft
                }
                placeholder="Remarks"
                onChange={event => {
                  setDiscountRemarksDraft(
                    event.target.value
                  );
                }}
                onKeyDown={event => {
                  if (
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    saveDiscountSettings();
                  }

                  if (
                    event.key === "Escape"
                  ) {
                    event.preventDefault();
                    closeDiscountPopup();
                  }
                }}
              />
            </label>

            <div className="popup-help">
              Enter after remarks to apply
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}