import React from "react";

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  subtitle = "Step 1 shell ready. Content will be built in upcoming build-order steps.",
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold text-ink leading-tight">{title}</h1>
        <p className="text-sm text-ink-2 mt-1">{subtitle}</p>
      </div>

      <div className="bg-surface border border-line rounded-panel p-6">
        <div className="text-xs uppercase tracking-header-cap font-semibold text-ink-2 mb-2">
          App Shell &bull; Step 1
        </div>
        <p className="text-sm text-ink leading-relaxed">
          The app shell, design tokens, fonts, authentication, and sidebar navigation are active.
        </p>
      </div>
    </div>
  );
};

