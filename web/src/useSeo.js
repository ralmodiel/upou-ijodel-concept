import { useEffect } from "react";
// Keeps document.title and the meta description in step with the hash route.
export function useSeo(title, description) {
  useEffect(() => {
    document.title = title.replace(/[\u0000-\u001f\u007f]/g, " "); // R129
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 160));
  }, [title, description]);
}
