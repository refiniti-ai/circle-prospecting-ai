import { Link } from "react-router-dom";

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  className?: string;
  /** Defaults to header CTA: “Start prospecting”. */
  label?: string;
};

/** Primary gradient CTA — matches site header “Start prospecting” button. */
export function StartProspectingButton({ className = "", label = "Start prospecting" }: Props) {
  return (
    <Link
      to="/buy-leads"
      className={["btn", "btn-primary", "cp-start-prospecting-btn", className].filter(Boolean).join(" ")}
    >
      {label}
      <IconArrow />
    </Link>
  );
}
