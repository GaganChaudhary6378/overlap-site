"use client";

import { useEffect } from "react";

export default function AuthRedirect() {
  useEffect(() => {
    // Supabase may fall back to Site URL; hand its fragment to the room client's session handler.
    const fields = new URLSearchParams(window.location.hash.slice(1));
    if (fields.has("access_token") || fields.has("error_description")) window.location.replace(`/app${window.location.hash}`);
  }, []);
  return null;
}
