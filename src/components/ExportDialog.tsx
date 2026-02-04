'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    FileSpreadsheet,
    FileText,
    FileCode,
    Share2,
    ChevronLeft,
    Download,
    Loader2
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import GoogleSheetsConfigContent, { ExportConfig } from './GoogleSheetsConfigContent';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import 'jspdf-autotable';
import { toast } from 'sonner';

interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: any[];
    dataType: 'campaigns' | 'adsets' | 'ads';
}

export function ExportDialog({ open, onOpenChange, data, dataType }: ExportDialogProps) {
    const { t, language } = useLanguage();
    const [view, setView] = useState<'menu' | 'google-sheets'>('menu');
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState("export");
    const [editConfig, setEditConfig] = useState<ExportConfig | null>(null);

    const getFilename = (ext: string) => {
        const date = new Date().toISOString().split('T')[0];
        return `centxo_${dataType}_export_${date}.${ext}`;
    };

    const prepareData = () => {
        if (!data || data.length === 0) return [];

        // Simple mapping based on dataType
        return data.map(item => {
            const row: any = {};
            if (dataType === 'campaigns') {
                row['ID'] = item.id;
                row['Name'] = item.name;
                row['Status'] = item.status || item.effectiveStatus;
                row['Budget'] = item.dailyBudget || item.budget || 0;
                row['Spend'] = item.amountSpent || 0;
                row['Results'] = item.results || 0;
                row['Cost Per Result'] = item.costPerResult || 0;
                row['Reach'] = item.reach || 0;
                row['Impressions'] = item.impressions || 0;
            } else if (dataType === 'adsets') {
                row['ID'] = item.id;
                row['Name'] = item.name;
                row['Campaign ID'] = item.campaignId;
                row['Status'] = item.status || item.effectiveStatus;
                row['Budget'] = item.dailyBudget || item.budget || 0;
                row['Spend'] = item.amountSpent || 0;
                row['Results'] = item.results || 0;
                row['Reach'] = item.reach || 0;
                row['Impressions'] = item.impressions || 0;
            } else {
                row['ID'] = item.id;
                row['Name'] = item.name;
                row['Campaign ID'] = item.campaignId;
                row['AdSet ID'] = item.adsetId;
                row['Status'] = item.status || item.effectiveStatus;
                row['Spend'] = item.amountSpent || 0;
                row['Results'] = item.results || 0;
                row['Impressions'] = item.impressions || 0;
                row['Clicks'] = item.clicks || 0;
            }
            return row;
        });
    };

    const handleExportXLSX = () => {
        setIsExporting(true);
        try {
            const exportData = prepareData();
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
            XLSX.writeFile(workbook, getFilename('xlsx'));
            toast.success(t('export.success.xlsx', 'Excel file exported successfully'));
        } catch (error) {
            console.error('Export XLSX error:', error);
            toast.error(t('export.error', 'Failed to export data'));
        } finally {
            setIsExporting(false);
            onOpenChange(false);
        }
    };

    const handleExportCSV = () => {
        setIsExporting(true);
        try {
            const exportData = prepareData();
            if (exportData.length === 0) return;

            const headers = Object.keys(exportData[0]);
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', getFilename('csv'));
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(t('export.success.csv', 'CSV file exported successfully'));
        } catch (error) {
            console.error('Export CSV error:', error);
            toast.error(t('export.error', 'Failed to export data'));
        } finally {
            setIsExporting(false);
            onOpenChange(false);
        }
    };

    const handleExportPDF = () => {
        setIsExporting(true);
        try {
            const exportData = prepareData();
            const doc = new jsPDF('l', 'pt');

            const headers = Object.keys(exportData[0]);
            const rows = exportData.map(row => headers.map(h => row[h]));

            (doc as any).autoTable({
                head: [headers],
                body: rows,
                styles: { fontSize: 8 },
                margin: { top: 40 },
                didDrawPage: (data: any) => {
                    doc.text(`Centxo - ${dataType.toUpperCase()} Export`, 40, 30);
                }
            });

            doc.save(getFilename('pdf'));
            toast.success(t('export.success.pdf', 'PDF file exported successfully'));
        } catch (error) {
            console.error('Export PDF error:', error);
            toast.error(t('export.error', 'Failed to export data'));
        } finally {
            setIsExporting(false);
            onOpenChange(false);
        }
    };

    const renderMenu = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 mt-2">
            <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all text-gray-700 dark:text-gray-300"
                onClick={handleExportXLSX}
            >
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">Excel (.xlsx)</span>
            </Button>

            <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all text-gray-700 dark:text-gray-300"
                onClick={handleExportPDF}
            >
                <FileText className="h-8 w-8 text-red-600" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">PDF Document</span>
            </Button>

            <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all text-gray-700 dark:text-gray-300"
                onClick={handleExportCSV}
            >
                <FileCode className="h-8 w-8 text-blue-600" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">CSV Text</span>
            </Button>

            <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all text-gray-700 dark:text-gray-300"
                onClick={() => setView('google-sheets')}
            >
                <div className="relative">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <Share2 className="h-4 w-4 absolute -bottom-1 -right-1 text-blue-500 bg-white dark:bg-zinc-900 rounded-full" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">Google Sheets</span>
            </Button>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                setTimeout(() => setView('menu'), 300); // Reset view after close animation
            }
        }}>
            <DialogContent className={cn(
                "sm:max-w-[450px] transition-all duration-300",
                view === 'google-sheets' && "sm:max-w-[1000px] h-[90vh] p-0 overflow-hidden flex flex-col"
            )}>
                <DialogHeader className={cn(
                    "p-6 border-b flex-shrink-0",
                    view === 'google-sheets' ? "bg-muted/30" : ""
                )}>
                    <div className="flex items-center gap-3">
                        {view === 'google-sheets' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setView('menu')}
                                className="h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Download className="h-5 w-5" />
                                {view === 'menu' ? t('export.title', 'Export Data') : t('export.googleSheets', 'Google Sheets Export')}
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                {view === 'menu'
                                    ? t('export.description', 'Choose your preferred export format')
                                    : t('export.googleSheetsDescription', 'Configure your automated or manual Google Sheets export')}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {isExporting ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">
                            {t('export.processing', 'Preparing your data...')}
                        </p>
                    </div>
                ) : (
                    <div className={cn(
                        "flex-1",
                        view === 'google-sheets' ? "overflow-y-auto" : ""
                    )}>
                        {view === 'menu' ? renderMenu() : (
                            <div className="p-6 pt-2 h-full flex flex-col">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                                    <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4 flex-shrink-0">
                                        <TabsTrigger value="export" onClick={() => setEditConfig(null)}>
                                            {language === 'th' ? 'สร้างการส่งออกใหม่' : 'Create New Export'}
                                        </TabsTrigger>
                                        <TabsTrigger value="saved">
                                            {language === 'th' ? 'การตั้งค่าที่บันทึกไว้' : 'Saved Configs'}
                                        </TabsTrigger>
                                    </TabsList>

                                    <div className="flex-1 overflow-y-auto min-h-0">
                                        <TabsContent value="export" className="mt-0 h-full">
                                            <GoogleSheetsConfigContent
                                                dataType={dataType}
                                                standalone={false}
                                                mode="export"
                                                initialConfig={editConfig}
                                                onClose={() => onOpenChange(false)}
                                            />
                                        </TabsContent>

                                        <TabsContent value="saved" className="mt-0 h-full">
                                            <GoogleSheetsConfigContent
                                                dataType={dataType}
                                                standalone={false}
                                                mode="saved"
                                                onEdit={(config) => {
                                                    setEditConfig(config)
                                                    setActiveTab("export")
                                                }}
                                                onSwitchToSaved={() => setActiveTab("saved")}
                                                onClose={() => onOpenChange(false)}
                                            />
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Helper function
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
