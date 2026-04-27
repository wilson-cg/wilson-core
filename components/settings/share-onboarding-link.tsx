"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check, ExternalLink } from "lucide-react";

/**
 * Copy the public typeform-style onboarding URL to the clipboard. Renders
 * inline next to the onboarding section header. The URL is built client-
 * side from window.location.origin so it works on any deployment.
 */
export function ShareOnboardingLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  function copy() {
    const url = `${window.location.origin}/onboard/${token}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback: prompt
        window.prompt("Copy this URL", url);
      });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <Link2 className="h-3.5 w-3.5" /> Share link
          </>
        )}
      </Button>
      <Button type="button" variant="ghost" size="sm" asChild>
        <a
          href={`/onboard/${token}`}
          target="_blank"
          rel="noreferrer"
        >
          Preview <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}
