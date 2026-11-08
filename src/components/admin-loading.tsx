"use client";

import { useI18n } from "@/components/i18n-provider";

export function AdminLoading() {
  const { t } = useI18n();
  return (
    <main className="adm-loading">
      <span className="adm-loading-dot" />
      <p>{t("adm.loading")}</p>
    </main>
  );
}
