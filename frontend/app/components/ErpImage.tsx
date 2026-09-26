import React, { useState } from "react";
import { getImageUrl } from "../lib/utils";
import { Package, Layers, Tag } from "lucide-react";

interface ErpImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  alt?: string;
  fallbackType?: "product" | "ingredient" | "tool";
  containerClassName?: string;
}

export function ErpImage({
  src,
  alt = "Item",
  className = "w-full h-full object-cover",
  containerClassName = "w-full h-full flex items-center justify-center bg-slate-100 dark:bg-white/5",
  fallbackType = "product",
  ...props
}: ErpImageProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = getImageUrl(src);

  if (!resolvedSrc || hasError) {
    return (
      <div className={containerClassName}>
        {fallbackType === "tool" ? (
          <Tag className="w-1/2 h-1/2 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
        ) : fallbackType === "ingredient" ? (
          <Layers className="w-1/2 h-1/2 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
        ) : (
          <Package className="w-1/2 h-1/2 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
        )}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
      {...props}
    />
  );
}
