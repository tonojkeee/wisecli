import { useTranslation } from "react-i18next";
import { Settings, Download, Terminal } from "lucide-react";
import { Button } from "@renderer/components/ui/button";

interface HeaderProps {
  hasActiveAgent: boolean;
  onOpenAppSettings: () => void;
  onOpenClaudeSettings: () => void;
  onExportLogs: () => void;
}

export function Header({
  hasActiveAgent,
  onOpenAppSettings,
  onOpenClaudeSettings,
  onExportLogs,
}: HeaderProps) {
  const { t } = useTranslation("app");

  return (
    <header className="flex h-12 items-center justify-between border-b bg-muted/20 px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Terminal className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold tracking-tight">{t("title")}</h1>
          <span className="text-[10px] text-muted-foreground">{t("subtitle")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onOpenAppSettings}
          title={t("header.appSettings")}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onOpenClaudeSettings}
          title={t("header.claudeApiSettings")}
        >
          <Download className="h-4 w-4 rotate-180" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onExportLogs}
          disabled={!hasActiveAgent}
          title={t("header.exportLogs")}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
