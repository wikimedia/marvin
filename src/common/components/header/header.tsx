import { h } from "preact";
import Wordmark from "../wordmark/wordmark";
import Link from "../link/link";
import { home } from "../../routers/api";

import "./header.css";

export default function Header(): JSX.Element {
  return (
    <div className="Header">
      <div className="Header-left">
        <Link href={home.toPath()} class="Header-wordmark">
          <Wordmark />
        </Link>
      </div>
      {/* The center placeholder will be used later for desktop sizes */}
      <div className="Header-center" />
      <div className="Header-right" />
    </div>
  );
}
