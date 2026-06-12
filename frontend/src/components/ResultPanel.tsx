import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function ResultPanel({
  title,
  count,
  emptyText,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  emptyText: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="panel">
      <button
        className="result-panel-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="result-heading">
          <h2>{title}</h2>
          <span>{count}</span>
        </div>
        <ChevronDown size={18} />
      </button>
      {isOpen && <div className="result-list">{count > 0 ? children : <p className="muted">{emptyText}</p>}</div>}
    </div>
  );
}
