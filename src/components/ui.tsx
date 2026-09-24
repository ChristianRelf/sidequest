"use client";
import {
  useEffect,
  useRef,
  useId,
  useState,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { X, LoaderCircle } from "lucide-react";
export function Button({
  children,
  variant = "primary",
  busy = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${props.className ?? ""}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.activeElement;
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-content">
        <header className="modal-header">
          <div>
            <span className="eyebrow">MAKE A LITTLE ROOM</span>
            <h2>{title}</h2>
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId(),
    controlId = id + "-input";
  function describe(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (child) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) return child;
      if (
        typeof child.type === "string" &&
        ["input", "select", "textarea"].includes(child.type)
      )
        return cloneElement(child as ReactElement<Record<string, unknown>>, {
          id: controlId,
          "aria-describedby": hint ? id + "-hint" : undefined,
        });
      if (child.props.children)
        return cloneElement(child, {
          children: describe(child.props.children),
        });
      return child;
    });
  }
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {describe(children)}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [value,setValue]=useState(checked),[saving,setSaving]=useState(false);
  useEffect(()=>setValue(checked),[checked]);
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={async(e)=>{const next=e.target.checked;setValue(next);setSaving(true);try{await onChange(next);}catch{setValue(checked);}finally{setSaving(false);}}}
        disabled={disabled||saving}
      />
    </label>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">↗</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ProgressRing({
  value,
  size = 64,
}: {
  value: number;
  size?: number;
}) {
  const r = 25,
    c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="progress-ring"
      role="img"
      aria-label={`${Math.round(value)} percent complete`}
    >
      <circle cx="32" cy="32" r={r} className="ring-track" />
      <circle
        cx="32"
        cy="32"
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}
