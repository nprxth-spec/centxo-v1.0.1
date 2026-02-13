'use client';

/**
 * ExportContent - Google Sheets export functionality
 * Re-exports the existing Google Sheets export page
 */

import { useState } from 'react';
import GoogleSheetsConfigContent, { ExportConfig } from "@/components/GoogleSheetsConfigContent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ExportContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("export");
  const [editConfig, setEditConfig] = useState<ExportConfig | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden px-6 md:px-8 py-4">
      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 rounded-lg border bg-card text-card-foreground shadow flex flex-col overflow-hidden p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 w-full min-w-0">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] shrink-0 mb-4 md:mb-6">
              <TabsTrigger value="export" onClick={() => setEditConfig(null)}>
                {t("reportTools.newExport", "Create New Export")}
              </TabsTrigger>
              <TabsTrigger value="saved">
                {t("reportTools.savedConfigs", "Saved Configs")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="flex-1 min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden">
              <GoogleSheetsConfigContent
                dataType="ads"
                standalone={false}
                mode="export"
                initialConfig={editConfig}
              />
            </TabsContent>

            <TabsContent value="saved" className="flex-1 min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden">
              <GoogleSheetsConfigContent
                dataType="ads"
                standalone={false}
                mode="saved"
                onEdit={(config) => {
                  setEditConfig(config);
                  setActiveTab("export");
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
