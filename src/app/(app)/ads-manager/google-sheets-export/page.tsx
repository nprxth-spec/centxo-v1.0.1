"use client"

import { useState } from 'react'
import GoogleSheetsConfigContent, { ExportConfig } from "@/components/GoogleSheetsConfigContent"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/LanguageContext"

export default function GoogleSheetsExportPage() {
    const { t } = useLanguage()
    const [activeTab, setActiveTab] = useState("export")
    const [editConfig, setEditConfig] = useState<ExportConfig | null>(null)

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full p-4 md:p-6 lg:p-8">
            <div className="shrink-0 mb-4 md:mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                    {t("reportTools.googleSheetsExport", "Google Sheets Export")}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {t("reportTools.googleSheetsExportDesc", "Export your ad data to Google Sheets with custom column mapping")}
                </p>
            </div>

            <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col">
                <div className="flex-1 min-h-0 rounded-xl border bg-card text-card-foreground shadow flex flex-col overflow-hidden p-4 md:p-6">
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
                                    setEditConfig(config)
                                    setActiveTab("export")
                                }}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
