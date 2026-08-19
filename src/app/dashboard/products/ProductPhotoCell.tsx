"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { uploadProductImage } from "@/app/actions/products";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { t, type Lang } from "@/lib/i18n";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * The row thumbnail doubles as its own upload control. Adding photos to a
 * catalogue of a couple of hundred items through the edit drawer means four
 * taps each; here it is one, and the row updates in place.
 */
export function ProductPhotoCell({
  productId,
  imagePath,
  name,
  lang,
  className,
}: {
  productId: string;
  imagePath: string | null;
  name: string;
  lang: Lang;
  className: string;
}) {
  const d = t(lang);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) return setError(d.dash.imageTooBig);
    if (!TYPES.includes(file.type)) return setError(d.dash.imageBadType);

    // Show it immediately; the upload catches up.
    setPreview(URL.createObjectURL(file));
    setError("");
    setBusy(true);

    const body = new FormData();
    body.set("productId", productId);
    body.set("file", file);
    const result = await uploadProductImage(body);

    setBusy(false);
    if (result.ok) {
      router.refresh();
    } else {
      setPreview(null);
      setError(
        result.error === "imageTooBig"
          ? d.dash.imageTooBig
          : result.error === "imageBadType"
            ? d.dash.imageBadType
            : d.common.somethingWrong,
      );
    }
  }

  return (
    <span className="relative flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={`${d.dash.changePhoto} — ${name}`}
        className="group relative block cursor-pointer overflow-hidden rounded-md disabled:opacity-70"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className={`${className} object-cover`} />
        ) : (
          <ProductImage path={imagePath} alt="" className={className} />
        )}

        <span
          className={`absolute inset-0 flex items-center justify-center bg-ink/45 transition-opacity ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          <Icon
            name={busy ? "progress_activity" : imagePath ? "photo_camera" : "add_a_photo"}
            size={16}
            className="text-paper"
          />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={pick}
        className="hidden"
      />

      {error ? (
        <span role="alert" className="absolute -bottom-4 whitespace-nowrap text-[9px] text-bad-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}
