"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  createCategory,
  removeProductImage,
  saveProduct,
  uploadProductImage,
} from "@/app/actions/products";
import { Icon } from "@/components/Icon";
import { useDialog } from "@/components/useDialog";
import { t, type Lang } from "@/lib/i18n";
import { parsePrice } from "@/lib/money";
import type { Category, ProductWithVariants } from "@/lib/types";

type DraftVariant = { label: string; qty: number };

export function ProductDrawer({
  lang,
  product,
  categories,
  shopSlug,
}: {
  lang: Lang;
  product: ProductWithVariants | null;
  categories: Category[];
  shopSlug: string;
}) {
  const d = t(lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  /**
   * Closing returns to the list with any category filter intact. Dropping it
   * on every save would make working through a filtered catalogue reset the
   * view each time.
   */
  const listHref = (() => {
    const cat = searchParams.get("cat");
    return cat ? `/dashboard/products?cat=${cat}` : "/dashboard/products";
  })();

  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(
    product ? String(Number(product.price).toFixed(3)) : "",
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    product?.category_id ?? null,
  );
  const [cats, setCats] = useState(categories);
  const [newCat, setNewCat] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [stock, setStock] = useState(product?.stock ?? 1);
  const [track, setTrack] = useState(product?.track_stock ?? true);
  const [desc, setDesc] = useState(product?.description ?? "");
  // New products start published; imported drafts keep whatever they have.
  const [active, setActive] = useState(product?.active ?? true);
  const [variants, setVariants] = useState<DraftVariant[]>(
    product?.product_variants?.map((v) => ({ label: v.label, qty: v.qty })) ?? [],
  );

  const [vOpen, setVOpen] = useState(false);
  const [vLabel, setVLabel] = useState("");
  const [vQty, setVQty] = useState("1");

  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.image_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${product.image_path}`
      : null,
  );
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");

  function close() {
    router.push(listHref);
  }

  const panelRef = useDialog(close);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // A new product has no row to attach the file to yet, so hold it and
    // upload once the product is created. Blocking here meant a photo could
    // never be added while creating a product, only by editing afterwards.
    if (!product) {
      if (file.size > 5 * 1024 * 1024) return setError(d.dash.imageTooBig);
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        return setError(d.dash.imageBadType);
      }
      setPendingFile(file);
      setImageUrl(URL.createObjectURL(file));
      setError("");
      return;
    }

    setUploading(true);
    setError("");

    const body = new FormData();
    body.set("productId", product.id);
    body.set("file", file);

    const result = await uploadProductImage(body);
    setUploading(false);

    if (result.ok) {
      setImageUrl(`${result.url}?v=${Date.now()}`);
      router.refresh();
    } else {
      const messages: Record<string, string> = {
        imageTooBig: d.dash.imageTooBig,
        imageBadType: d.dash.imageBadType,
      };
      setError(messages[result.error] ?? d.common.somethingWrong);
    }
  }

  function addVariant() {
    const label = vLabel.trim();
    if (!label) {
      setError(d.dash.nameTheOption);
      return;
    }
    setVariants((v) => [
      ...v,
      { label, qty: Math.max(0, parseInt(vQty, 10) || 0) },
    ]);
    setVLabel("");
    setVQty("1");
    setVOpen(false);
    setError("");
  }

  function addCategory() {
    const value = newCat.trim();
    if (!value) return;

    start(async () => {
      const result = await createCategory(value);
      if (result.ok) {
        setCats((c) => [...c, { id: result.id, shop_id: "", name: result.name, sort: 0 }]);
        setCategoryId(result.id);
        setNewCat("");
        setCatOpen(false);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError(d.dash.needName);

    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) return setError(d.dash.needPrice);

    start(async () => {
      const result = await saveProduct({
        id: product?.id ?? null,
        name: name.trim(),
        sku: sku.trim() || null,
        category_id: categoryId,
        price: parsedPrice,
        stock,
        track_stock: track,
        description: desc.trim() || null,
        active,
        variants,
      });

      if (!result.ok) {
        const messages: Record<string, string> = {
          needName: d.dash.needName,
          needPrice: d.dash.needPrice,
          skuTaken: d.dash.skuTaken,
          needPriceToPublish: d.dash.needPriceToPublish,
        };
        setError(messages[result.error] ?? d.common.somethingWrong);
        return;
      }

      // Attach the photo staged before the product existed.
      if (pendingFile) {
        const body = new FormData();
        body.set("productId", result.id);
        body.set("file", pendingFile);
        await uploadProductImage(body);
      }

      // Save closes, for both new and edited products. Sending a new one
      // straight to its QR dialog meant the drawer never felt closed, and it
      // interrupts anyone working down a list. The QR is one tap from the row.
      router.push(listHref);
      router.refresh();
    });
  }

  return (
    <div
      className="no-print fixed inset-0 z-40 flex justify-end bg-ink/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={product ? d.dash.editProduct : d.dash.newProduct}
        className="flex h-dvh w-full max-w-[520px] flex-col bg-paper animate-pop"
      >
        <header className="sticky top-0 z-2 flex items-center gap-3 border-b border-line-3 bg-paper px-6 py-5">
          <h2 className="text-[17px] font-medium">
            {product ? d.dash.editProduct : d.dash.newProduct}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={d.common.close}
            className="ms-auto cursor-pointer text-mute"
          >
            <Icon name="close" size={22} />
          </button>
        </header>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          noValidate
        >
          <div className="flex flex-col gap-4 px-6 py-5">
            {/* -------------------------------------------------- photo */}
            <div className="flex flex-col gap-2">
              <span className="label">{d.dash.photo}</span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-line-5 bg-soft transition-colors hover:border-ink disabled:opacity-60"
                >
                  <Icon
                    name={uploading ? "progress_activity" : "add_a_photo"}
                    size={24}
                    className="text-mute-4"
                  />
                  <span className="font-mono text-[9px] text-mute-4">
                    {uploading
                      ? d.shop.uploading
                      : imageUrl
                        ? d.dash.changePhoto
                        : d.dash.photo}
                  </span>
                </button>

                {imageUrl ? (
                  <div className="relative h-24 w-24 overflow-hidden rounded-[14px] border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={d.dash.removePhoto}
                      onClick={() => {
                        if (!product) {
                          setPendingFile(null);
                          setImageUrl(null);
                          return;
                        }
                        start(async () => {
                          await removeProductImage(product.id);
                          setImageUrl(null);
                          router.refresh();
                        });
                      }}
                      className="absolute end-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-ink/75 text-paper"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-[14px] bg-[repeating-linear-gradient(135deg,#e7e3d9_0_6px,#f3f0e9_6px_12px)]" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={pickImage}
                className="hidden"
              />
            </div>

            {/* --------------------------------------------------- name */}
            <label className="flex flex-col gap-2">
              <span className="label">{d.dash.name}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={d.dash.namePh}
                className="field text-[15px]"
              />
            </label>

            {/* -------------------------------------------- price + sku */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="label">{d.dash.price}</span>
                <span className="flex items-center gap-1.5 rounded-[11px] border border-line-2 bg-white px-3 focus-within:border-ink">
                  <input
                    value={price}
                    dir="ltr"
                    inputMode="decimal"
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="3.200"
                    aria-label={d.dash.price}
                    className="w-full min-w-0 border-0 bg-transparent py-3.5 font-mono text-sm text-ink outline-none"
                  />
                  <span className="shrink-0 font-mono text-[11px] text-mute-2">
                    BHD
                  </span>
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">{d.dash.sku}</span>
                <input
                  value={sku}
                  dir="ltr"
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="NB-A5-DOT"
                  className="field font-mono text-[13px]"
                />
              </label>
            </div>

            {/* ----------------------------------------------- category */}
            <div className="flex flex-col gap-2.5">
              <span className="label">{d.dash.category}</span>
              <div className="flex flex-wrap gap-2">
                <Chip
                  label={d.dash.noCategory}
                  on={categoryId === null}
                  onClick={() => setCategoryId(null)}
                />
                {cats.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    on={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setCatOpen((v) => !v)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-dashed border-line-5 px-3.5 py-2.5 text-xs text-mute-2 hover:border-ink"
                >
                  <Icon name="add" size={14} />
                  <span>{d.dash.newCategory}</span>
                </button>
              </div>

              {catOpen ? (
                <div className="flex gap-2">
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCategory();
                      }
                    }}
                    placeholder={d.dash.categoryPh}
                    aria-label={d.dash.newCategory}
                    className="field !py-2.5 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={addCategory}
                    className="btn btn-ink shrink-0 !py-2.5"
                  >
                    {d.dash.addVariant}
                  </button>
                </div>
              ) : null}
            </div>

            {/* -------------------------------------------- stock/track */}
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="flex flex-col gap-2.5">
                <span className="label">{d.dash.stock}</span>
                <div className="flex items-center gap-2.5 rounded-[11px] border border-line-2 bg-white px-2.5 py-1.5">
                  <button
                    type="button"
                    aria-label="−"
                    onClick={() => setStock((s) => Math.max(0, s - 1))}
                    className="cursor-pointer rounded-lg bg-sand p-1.5 text-mute"
                  >
                    <Icon name="remove" size={19} />
                  </button>
                  <input
                    value={stock}
                    inputMode="numeric"
                    aria-label={d.dash.stock}
                    onChange={(e) =>
                      setStock(
                        Math.max(0, parseInt(e.target.value, 10) || 0),
                      )
                    }
                    className="num w-full min-w-0 border-0 bg-transparent text-center text-sm font-medium outline-none"
                  />
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => setStock((s) => s + 1)}
                    className="cursor-pointer rounded-lg bg-sand p-1.5 text-mute"
                  >
                    <Icon name="add" size={19} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="label">{d.dash.trackStock}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={track}
                  onClick={() => setTrack((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-[11px] border border-line-2 bg-white px-3 py-3"
                >
                  <span className="text-[13px]">
                    {track ? d.dash.on : d.dash.off}
                  </span>
                  <span
                    className={`flex h-[23px] w-10 items-center rounded-[20px] p-0.5 transition-colors ${
                      track ? "justify-end bg-ok" : "justify-start bg-line-2"
                    }`}
                  >
                    <span className="h-[19px] w-[19px] rounded-full bg-white" />
                  </span>
                </button>
              </div>
            </div>

            {/* -------------------------------------------------- status */}
            <div className="flex flex-col gap-2.5">
              <span className="label">{d.dash.publishLabel}</span>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive((v) => !v)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[11px] border p-3 text-start transition-colors ${
                  active ? "border-ink bg-white" : "border-line bg-soft"
                }`}
              >
                <Icon
                  name={active ? "visibility" : "visibility_off"}
                  size={20}
                  className={active ? "text-ok" : "text-mute-2"}
                />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-medium">
                    {active ? d.dash.published : d.dash.draft}
                  </span>
                  <span className="text-[11px] leading-[1.4] text-mute-2">
                    {active
                      ? lang === "ar"
                        ? "يظهر في المتجر ويمكن شراؤه"
                        : "Visible in the store and purchasable"
                      : lang === "ar"
                        ? "مخفي عن العملاء"
                        : "Hidden from customers"}
                  </span>
                </span>
                <span
                  className={`flex h-[23px] w-10 items-center rounded-[20px] p-0.5 transition-colors ${
                    active ? "justify-end bg-ok" : "justify-start bg-line-2"
                  }`}
                >
                  <span className="h-[19px] w-[19px] rounded-full bg-white" />
                </span>
              </button>
            </div>

            {/* ------------------------------------------------ variants */}
            <div className="flex flex-col gap-2.5">
              <span className="label">{d.dash.variants}</span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => (
                  <button
                    key={`${v.label}-${i}`}
                    type="button"
                    onClick={() =>
                      setVariants((list) => list.filter((_, j) => j !== i))
                    }
                    className="flex cursor-pointer items-center gap-1.5 rounded-[11px] bg-sand px-3 py-2.5 text-xs"
                  >
                    <span>
                      {v.label} <span className="num">×{v.qty}</span>
                    </span>
                    <Icon name="close" size={14} className="text-mute-2" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVOpen(true)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[11px] border border-dashed border-line-5 px-3 py-2.5 text-xs text-mute-2 hover:border-ink"
                >
                  <Icon name="add" size={14} />
                  <span>{d.dash.addVariant}</span>
                </button>
              </div>

              {vOpen ? (
                <div className="flex flex-col gap-2.5 rounded-[13px] border border-line-2 bg-soft p-3">
                  <div className="grid grid-cols-[3fr_1fr] items-end gap-2.5">
                    <label className="flex flex-col gap-1.5">
                      <span className="label">{d.dash.variantName}</span>
                      <input
                        value={vLabel}
                        autoFocus
                        onChange={(e) => setVLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addVariant();
                          }
                        }}
                        placeholder={d.dash.variantPh}
                        className="field !py-2.5 text-[13px]"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="label">{d.dash.variantQty}</span>
                      <input
                        value={vQty}
                        inputMode="numeric"
                        onChange={(e) => setVQty(e.target.value)}
                        placeholder="1"
                        className="field num !py-2.5 text-center text-[13px]"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setVOpen(false)}
                      className="btn btn-ghost !py-2.5 text-xs"
                    >
                      {d.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="btn btn-ink !py-2.5 text-xs"
                    >
                      {d.dash.addVariant}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* --------------------------------------------- description */}
            <label className="flex flex-col gap-2.5">
              <span className="label">{d.dash.description}</span>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={d.dash.descPh}
                rows={3}
                className="field resize-none text-[13px] leading-[1.6]"
              />
            </label>

            {error ? (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-[11px] border border-bad-line bg-bad-soft px-3 py-3 text-xs font-medium text-bad-ink"
              >
                <Icon name="error" size={17} />
                <span>{error}</span>
              </p>
            ) : null}
          </div>

          <footer className="sticky bottom-0 mt-auto flex gap-2.5 border-t border-line bg-paper px-6 py-4">
            <button
              type="button"
              onClick={close}
              className="btn btn-ghost"
            >
              {d.common.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary flex-1"
            >
              {pending
                ? d.common.saving
                : product
                  ? d.dash.saveEdit
                  : d.dash.saveGenerate}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Chip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`cursor-pointer rounded-[20px] border px-3.5 py-2.5 text-xs transition-colors ${
        on
          ? "border-ink bg-ink text-paper"
          : "border-line-2 text-mute hover:border-ink"
      }`}
    >
      {label}
    </button>
  );
}
