import { useEffect } from "react";

/** Sets the tab title while the page is shown and puts the previous one back when it goes. */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} · DECA Masters`;
    return () => {
      document.title = before;
    };
  }, [title]);
}
