import { useState, useEffect, useRef, useMemo } from "react";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import {
  defaults,
  paramsFor,
  israelDay,
  addDays,
  scopeKey,
} from "../../utils/reportParams.mjs";
import "./Reports.v2.css";

const modeLabels = {
  transactions: "עסקאות מפורטות",
  officers: "לקיחות לפי קצין ניהול",
  wallets: "תנועות ארנק",
  products: "מוצרים וקטגוריות",
  inventory: "מלאי נוכחי",
  credits: "הפקדות ומשיכות",
};
const typeLabels = {
  sale: "רכישה",
  return: "החזרה",
  deposit: "הפקדה",
  withdrawal: "משיכה",
};
const money = (v) =>
  v == null
    ? "לא תועד"
    : Number(v).toLocaleString("he-IL", { style: "currency", currency: "ILS" });
const date = (v) =>
  v
    ? new Date(v).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })
    : "לא תועד";
const idPattern = /^[a-f\d]{24}$/i;

function Multi({ label, options = [], value, onChange, disabled }) {
  const [search, setSearch] = useState("");
  const box = useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (box.current && !box.current.contains(e.target))
        box.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const shown = options.filter((o) =>
    o.label
      .toLocaleLowerCase("he-IL")
      .includes(search.toLocaleLowerCase("he-IL")),
  );
  return (
    <details
      className="marcol-report-multi"
      ref={box}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          box.current.open = false;
          box.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        aria-disabled={disabled || undefined}
      >
        {label}
        <span>{value.length ? `${value.length} נבחרו` : "הכול"}</span>
      </summary>
      <div>
        <input
          aria-label={`חיפוש ${label}`}
          placeholder="חיפוש ברשימה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="secondary"
          onClick={() => onChange([])}
          disabled={disabled}
        >
          נקה בחירה
        </button>
        <section aria-label={label}>
          {shown.length ? (
            shown.map((o) => (
              <label key={o.id}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={value.includes(o.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...value, o.id]
                        : value.filter((id) => id !== o.id),
                    )
                  }
                />
                {o.label}
              </label>
            ))
          ) : (
            <p>אין ערכים בטווח שנטען.</p>
          )}
        </section>
      </div>
    </details>
  );
}

export default function Reports() {
  const { user } = useAuthStore();
  const [form, setForm] = useState(() => defaults());
  const [report, setReport] = useState(null);
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [sort, setSort] = useState({ key: "", direction: 1 });
  const request = useRef(0),
    exportRequest = useRef(0),
    dialogRef = useRef(null);
  const allowed =
    ["admin", "superadmin"].includes(user?.role) && !!user?.environmentId;
  const identity = scopeKey(user);
  const current =
    allowed &&
    report?.owner === identity &&
    report?.environment?.id === user?.environmentId;
  const dirty = applied?.form !== JSON.stringify(form);
  const change = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function load(snapshot) {
    if (!allowed) return;
    const version = ++request.current,
      owner = identity;
    exportRequest.current++;
    setExporting(false);
    setBusy(true);
    setError("");
    setExpanded(null);
    try {
      const params = paramsFor(snapshot, user.environmentId);
      const { data } = await api.get("/reports/detailed", { params });
      if (
        version !== request.current ||
        owner !== scopeKey(useAuthStore.getState().user)
      )
        return;
      if (
        !data ||
        data.environment?.id !== user.environmentId ||
        data.mode !== snapshot.mode ||
        !Array.isArray(data.rows) ||
        !data.summary
      )
        throw new Error("התקבלה תשובת דוח לא תקינה");
      setReport({ ...data, owner });
      setApplied({ form: JSON.stringify(snapshot), params });
      setPage(1);
      setSort({ key: "", direction: 1 });
    } catch (e) {
      if (
        version === request.current &&
        owner === scopeKey(useAuthStore.getState().user)
      ) {
        setReport(null);
        setApplied(null);
        setError(
          e.response?.data?.error || e.message || "לא ניתן לטעון את הדוח",
        );
      }
    } finally {
      if (version === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    setReport(null);
    setApplied(null);
    setError("");
    setExpanded(null);
    setPage(1);
    setExporting(false);
    const initial = defaults();
    setForm(initial);
    if (allowed) load(initial);
    return () => {
      request.current++;
      exportRequest.current++;
    };
  }, [identity, allowed]);

  useEffect(() => {
    if (!expanded || !current) return;
    const previous = document.activeElement,
      dialog = dialogRef.current;
    dialog?.querySelector("button")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(null);
      if (e.key !== "Tab") return;
      const controls = [
        ...dialog.querySelectorAll("button,a[href],input,select,textarea"),
      ].filter((x) => !x.disabled);
      if (controls.length === 1) {
        e.preventDefault();
        controls[0].focus();
      } else if (e.shiftKey && document.activeElement === controls[0]) {
        e.preventDefault();
        controls.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === controls.at(-1)) {
        e.preventDefault();
        controls[0]?.focus();
      }
    };
    dialog?.addEventListener("keydown", onKey);
    return () => {
      dialog?.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [expanded, current]);

  async function exportExcel() {
    if (!applied || !current || dirty || busy || exporting) return;
    const version = ++exportRequest.current,
      owner = identity;
    const params = { ...applied.params },
      from = form.start,
      to = form.end;
    setExporting(true);
    setError("");
    try {
      const result = await api.get("/reports/export", {
        params,
        responseType: "blob",
      });
      if (
        version !== exportRequest.current ||
        owner !== scopeKey(useAuthStore.getState().user)
      )
        return;
      if (!(result.data instanceof Blob) || result.data.size < 4)
        throw new Error("קובץ הייצוא אינו תקין");
      const magic = new Uint8Array(await result.data.slice(0, 4).arrayBuffer());
      if (
        magic[0] !== 0x50 ||
        magic[1] !== 0x4b ||
        magic[2] !== 3 ||
        magic[3] !== 4
      )
        throw new Error("השרת לא החזיר קובץ Excel תקין");
      if (
        version !== exportRequest.current ||
        owner !== scopeKey(useAuthStore.getState().user)
      )
        return;
      const url = URL.createObjectURL(result.data),
        link = document.createElement("a");
      link.href = url;
      link.download = `Marcol-${params.mode}-${from}-${to}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (
        version !== exportRequest.current ||
        owner !== scopeKey(useAuthStore.getState().user)
      )
        return;
      let message = e.message || "הייצוא נכשל; לא הופק דוח חלקי";
      try {
        const body = e.response?.data;
        if (body instanceof Blob)
          message = JSON.parse(await body.text()).error || message;
        else message = body?.error || message;
      } catch {
        /* Preserve the non-sensitive error. */
      }
      setError(message);
    } finally {
      if (version === exportRequest.current) setExporting(false);
    }
  }

  const isInventory = form.mode === "inventory";
  const group = current && ["officers", "products"].includes(report.mode);
  const inventory = current && report.mode === "inventory";
  const rawRows = current
    ? group
      ? report.groups?.[report.mode] || []
      : report.rows
    : [];
  const rows = useMemo(() => {
    if (!sort.key) return rawRows;
    return [...rawRows].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return (
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "he", { numeric: true })) *
        sort.direction
      );
    });
  }, [rawRows, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 50)),
    visible = rows.slice((page - 1) * 50, page * 50);
  const summary = current ? report.summary : {};
  const options = current ? report.options : {};
  const headers = inventory
    ? [
        ["מוצר", "name"],
        ["קטגוריה", "category"],
        ["ספק", "supplierName"],
        ["כמות", "quantity"],
        ["סף יחידות", "minStockAlert"],
        ["עלות יחידה", "costPerUnit"],
        ["שווי מלאי", "inventoryValue"],
      ]
    : group
      ? [
          ["שם", "name"],
          ["עסקאות", "transactions"],
          ["יחידות שנלקחו", "quantityTaken"],
          ["יחידות שהוחזרו", "quantityReturned"],
          ["רכישות", "sales"],
          ["החזרות", "returns"],
          ["נטו", "net"],
          ["מועד אחרון", "lastAt"],
          ["פירוט", ""],
        ]
      : [
          ["מספר עסקה", "transactionNumber"],
          ["תאריך ושעה", "createdAt"],
          ["סוג", "transactionType"],
          ["קצין ניהול / מפקיד", "officerName"],
          ["ארנק", "walletName"],
          ["סכום מסונן", "matchedAmount"],
          ["סכום מלא", "totalAmount"],
          ["פירוט", ""],
        ];
  function isQuickRange(which) {
    if (isInventory) return false;
    const end = israelDay();
    const start =
      which === "today"
        ? end
        : which === "week"
          ? addDays(end, -6)
          : end.slice(0, 8) + "01";
    return form.start === start && form.end === end;
  }
  function quickDates(which) {
    const end = israelDay(),
      start =
        which === "today"
          ? end
          : which === "week"
            ? addDays(end, -6)
            : end.slice(0, 8) + "01";
    setForm((prev) => ({ ...prev, start, end }));
  }
  function drill(row) {
    const kind = report.mode === "officers" ? "officerIds" : "productIds";
    const next = {
      ...JSON.parse(applied.form),
      mode: "transactions",
      [kind]: [row.id],
    };
    setForm(next);
    load(next);
  }
  if (!allowed)
    return (
      <div className="marcol-reports" dir="rtl">
        <p role="alert">
          הדוחות זמינים למנהל מערכת ולמנהל־על לאחר בחירת סביבת עבודה.
        </p>
      </div>
    );
  return (
    <div className="marcol-reports" dir="rtl" data-tour="reports-page">
      <header>
        <div>
          <h1>דוחות</h1>
          <p>מי לקח, מה נלקח ומתי — פירוט עסקאות וייצוא מסודר</p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={!current || dirty || busy || exporting}
        >
          {exporting ? "מפיק Excel..." : "ייצוא מלא ל־Excel"}
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(form);
        }}
        className="marcol-report-filters"
      >
        <div className="marcol-report-primary">
          <label>
            סוג דוח
            <select
              aria-label="סוג דוח"
              value={form.mode}
              onChange={(e) => {
                const mode = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  mode,
                  ...(mode === "inventory"
                    ? {
                        walletIds: [],
                        officerIds: [],
                        cashierIds: [],
                        actorIds: [],
                        types: [],
                        min: "",
                        max: "",
                        q: "",
                      }
                    : {}),
                }));
              }}
            >
              {Object.entries(modeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {!isInventory && (
            <>
              <label>
                מתאריך
                <input
                  aria-label="מתאריך"
                  type="date"
                  required
                  value={form.start}
                  onChange={(e) => change("start", e.target.value)}
                />
              </label>
              <label>
                עד תאריך — כולל
                <input
                  aria-label="עד תאריך — כולל"
                  type="date"
                  required
                  value={form.end}
                  onChange={(e) => change("end", e.target.value)}
                />
              </label>
            </>
          )}
          <label className="marcol-report-search">
            חיפוש לפי שם או מספר
            <input
              aria-label="חיפוש לפי שם או מספר"
              value={form.q}
              maxLength={120}
              onChange={(e) => change("q", e.target.value)}
              placeholder={
                isInventory
                  ? "מוצר, SKU, ברקוד או ספק"
                  : "קצין, מספר אישי, ארנק, מוצר או עסקה"
              }
            />
          </label>
        </div>
        {!isInventory && (
          <div
            className="marcol-report-presets"
            role="group"
            aria-label="טווחי תאריכים מהירים"
          >
            <span>טווח מהיר:</span>
            <button
              type="button"
              className={`secondary${isQuickRange("today") ? " is-active" : ""}`}
              aria-pressed={isQuickRange("today")}
              onClick={() => quickDates("today")}
            >
              היום
            </button>
            <button
              type="button"
              className={`secondary${isQuickRange("week") ? " is-active" : ""}`}
              aria-pressed={isQuickRange("week")}
              onClick={() => quickDates("week")}
            >
              7 ימים
            </button>
            <button
              type="button"
              className={`secondary${isQuickRange("month") ? " is-active" : ""}`}
              aria-pressed={isQuickRange("month")}
              onClick={() => quickDates("month")}
            >
              החודש
            </button>
          </div>
        )}
        <details className="marcol-report-advanced">
          <summary>
            <span>מסננים נוספים</span>
            <small>קצינים, ארנקים, מוצרים וקטגוריות</small>
          </summary>
          <section
            className="marcol-report-filter-section"
            aria-label="מסננים מרכזיים"
          >
            <p className="marcol-report-filter-section__title">סינון מרכזי</p>
            <div className="marcol-report-filter-grid marcol-report-filter-grid--primary">
              {!isInventory && (
                <>
                  <Multi
                    label="קציני ניהול"
                    value={form.officerIds}
                    options={options?.officers}
                    onChange={(v) => change("officerIds", v)}
                    disabled={busy}
                  />
                  <Multi
                    label="ארנקים"
                    value={form.walletIds}
                    options={options?.wallets}
                    onChange={(v) => change("walletIds", v)}
                    disabled={busy}
                  />
                </>
              )}
              <Multi
                label="מוצרים"
                value={form.productIds}
                options={options?.products}
                onChange={(v) => change("productIds", v)}
                disabled={busy}
              />
              <Multi
                label="קטגוריות"
                value={form.categories}
                options={options?.categories}
                onChange={(v) => change("categories", v)}
                disabled={busy}
              />
              {isInventory && (
                <label className="marcol-report-checkbox">
                  <input
                    type="checkbox"
                    checked={form.includeInactive}
                    onChange={(e) =>
                      change("includeInactive", e.target.checked)
                    }
                  />
                  כולל מוצרים לא פעילים
                </label>
              )}
            </div>
            {!isInventory && (
              <div className="marcol-report-more">
                <p className="marcol-report-filter-section__title">
                  סינון משני
                </p>
                <div className="marcol-report-filter-grid marcol-report-filter-grid--secondary">
                  <Multi
                    label="קופאים"
                    value={form.cashierIds}
                    options={options?.cashiers}
                    onChange={(v) => change("cashierIds", v)}
                    disabled={busy}
                  />
                  <Multi
                    label="מבצעי פעולה"
                    value={form.actorIds}
                    options={options?.actors}
                    onChange={(v) => change("actorIds", v)}
                    disabled={busy}
                  />
                  <Multi
                    label="סוגי תנועות"
                    value={form.types}
                    options={Object.entries(typeLabels).map(([id, label]) => ({
                      id,
                      label,
                    }))}
                    onChange={(v) => change("types", v)}
                    disabled={busy}
                  />
                  <input
                    type="number"
                    placeholder="סכום עסקה מ־"
                    min="0"
                    step="0.01"
                    value={form.min}
                    onChange={(e) => change("min", e.target.value)}
                  />

                  <input
                    type="number"
                    placeholder="סכום עסקה עד"
                    min="0"
                    step="0.01"
                    value={form.max}
                    onChange={(e) => change("max", e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>
        </details>
        <div className="marcol-report-actions">
          <button disabled={busy} type="submit">
            {busy ? "טוען..." : "הצג דוח"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              const reset = defaults();
              setForm(reset);
              load(reset);
            }}
          >
            איפוס מסננים
          </button>
        </div>
        <p className="marcol-report-note">
          {isInventory
            ? "המלאי הוא נוכחי בלבד; סינון קצינים ותאריכים אינו חל עליו."
            : "התאריכים והשעות לפי זמן ישראל. עד 5,000 תנועות בטווח; מעל לכך תתבקש לצמצם תאריכים, בלי ייצוא חלקי."}{" "}
          אפשרויות הבחירה מתעדכנות אחרי ״הצג דוח״.
        </p>
      </form>
      {error && (
        <p role="alert" className="marcol-report-error">
          {error}
        </p>
      )}
      {busy && <p role="status">טוען את נתוני הדוח...</p>}
      {dirty && current && (
        <p role="status" className="marcol-report-notice">
          המסננים השתנו. למטה מוצגות התוצאות מההפקה הקודמת; לחץ על ״הצג דוח״
          לעדכון ולייצוא.
        </p>
      )}
      {current && (
        <section
          aria-busy={busy}
          className={
            busy ? "marcol-report-result is-loading" : "marcol-report-result"
          }
        >
          <div className="marcol-report-result-heading">
            <h2>{modeLabels[report.mode]}</h2>
            <span>
              {report.environment.name} · הופק: {date(report.generatedAt)}
            </span>
          </div>
          <section className="marcol-report-kpis">
            {(inventory
              ? [
                  ["מוצרים", summary.products],
                  ["יחידות", summary.units],
                  ["שווי מלאי מתועד", money(summary.knownInventoryValue)],
                  ["ללא עלות מתועדת", summary.missingCosts],
                ]
              : [
                  ["תנועות", summary.transactions],
                  ["מכירות נטו", money(summary.netSales)],
                  ["הפקדות", money(summary.deposits)],
                  ["משיכות", money(summary.withdrawals)],
                ]
            ).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <p className="marcol-report-note">
            {inventory
              ? "עלות שלא תועדה מסומנת כחסרה; אין כאן חישוב רווח היסטורי."
              : `${report.lineFiltered ? "הסיכומים מתייחסים רק לשורות המוצרים שנבחרו." : "הפקדות אינן נספרות כמכירות."} בנתונים ישנים מוצג הקצין שנרשם בעסקה; אין בכך אימות מסירה בפועל.`}{" "}
            הייצוא קורא מחדש את הנתונים באותם מסננים.
          </p>
          <div className="marcol-report-table">
            <table>
              <thead>
                <tr>
                  {headers.map(([label, key]) => (
                    <th
                      key={label}
                      aria-sort={
                        !key || sort.key !== key
                          ? undefined
                          : sort.direction === 1
                            ? "ascending"
                            : "descending"
                      }
                    >
                      {key ? (
                        <button
                          type="button"
                          className="marcol-report-sort"
                          onClick={() => {
                            setSort((prev) => ({
                              key,
                              direction: prev.key === key ? -prev.direction : 1,
                            }));
                            setPage(1);
                          }}
                        >
                          {label}
                          {sort.key === key
                            ? sort.direction === 1
                              ? " ↑"
                              : " ↓"
                            : ""}
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!visible.length && (
                  <tr>
                    <td
                      colSpan={headers.length}
                      className="marcol-report-empty"
                    >
                      לא נמצאו תוצאות למסננים שנבחרו.
                    </td>
                  </tr>
                )}
                {visible.map((row) =>
                  inventory ? (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.category || "—"}</td>
                      <td>{row.supplierName || "—"}</td>
                      <td>{row.quantity}</td>
                      <td>{row.minStockAlert}</td>
                      <td>{money(row.costPerUnit)}</td>
                      <td>{money(row.inventoryValue)}</td>
                    </tr>
                  ) : group ? (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.transactions}</td>
                      <td>{row.quantityTaken}</td>
                      <td>{row.quantityReturned}</td>
                      <td>{money(row.sales)}</td>
                      <td>{money(row.returns)}</td>
                      <td>{money(row.net)}</td>
                      <td>{date(row.lastAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy || dirty || !idPattern.test(row.id)}
                          onClick={() => drill(row)}
                        >
                          עסקאות
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>{row.transactionNumber}</td>
                      <td>{date(row.createdAt)}</td>
                      <td>
                        {typeLabels[row.transactionType] || row.transactionType}
                      </td>
                      <td>{row.officerName || row.actorName}</td>
                      <td>{row.walletName}</td>
                      <td>{money(row.matchedAmount)}</td>
                      <td>{money(row.totalAmount)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => setExpanded(row)}
                        >
                          פתח
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <footer>
            <button
              type="button"
              className="secondary"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              הקודם
            </button>
            <span>
              עמוד {page} מתוך {pages} · {rows.length} תוצאות · ה־Excel כולל את
              כולן
            </span>
            <button
              type="button"
              className="secondary"
              disabled={page >= pages || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              הבא
            </button>
          </footer>
        </section>
      )}
      {expanded && current && (
        <div
          className="marcol-report-overlay"
          onClick={() => setExpanded(null)}
        >
          <section
            ref={dialogRef}
            data-report-modal-layout="compact-balances-v1"
            role="dialog"
            aria-modal="true"
            aria-label="פרטי עסקה"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="secondary"
              onClick={() => setExpanded(null)}
            >
              סגירה
            </button>
            <h2>{expanded.transactionNumber}</h2>
            <p>
              {date(expanded.createdAt)} ·
              <p>
                 ארנק:{" "}
               {expanded.walletName}
              </p>
              
            </p>
            <p>
              מקבל: {expanded.officerName || "לא רלוונטי"} 
              <p>
               מבצע:{" "}  {expanded.actorName}
              </p>
            </p>
            {/* <p>{expanded.receiverEvidence}</p> */}
            <p>
              יתרה לפני העסקה: {money(expanded.walletBalanceBefore)} 
              <p>

               יתרה אחרי
              העסקה: {money(expanded.walletBalanceAfter)}
              </p>
              
            </p>
            <p>
              <strong>יתרת הארנק בעת הפקת הדוח: </strong>
              {Number.isFinite(expanded.walletCurrentBalance)
                ? money(expanded.walletCurrentBalance)
                : "לא זמינה"}
              {report.walletBalancesReadAt && (
                <small> · נכון ל־{date(report.walletBalancesReadAt)}</small>
              )}
            </p>
            <div className="marcol-report-table">
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>קטגוריה</th>
                    <th>כמות</th>
                    <th>מחיר</th>
                    <th>סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {expanded.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.productName}</td>
                      <td>{item.categoryName || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice)}</td>
                      <td>{money(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{expanded.notes}</p>
          </section>
        </div>
      )}
    </div>
  );
}
