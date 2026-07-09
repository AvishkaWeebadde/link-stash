"use client";

import { useTransition } from "react";
import { toggleFavorite } from "@/app/actions/items";

export default function FavoriteButton({
  id,
  favorite,
  className = "",
}: {
  id: string;
  favorite: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(() => toggleFavorite(id));
      }}
      disabled={pending}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      title={favorite ? "Unfavorite" : "Favorite"}
      className={`transition ${favorite ? "opacity-100" : "opacity-40 hover:opacity-100"} ${className}`}
    >
      {favorite ? "⭐" : "☆"}
    </button>
  );
}
