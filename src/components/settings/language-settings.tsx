'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';

export function LanguageSettings() {
    const { language, setLanguage, t } = useLanguage();

    const languages = [
        { code: 'en' as const, name: 'English', nativeName: 'English', flag: '🇬🇧' },
        { code: 'th' as const, name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
    ];

    const currentLanguage = languages.find(lang => lang.code === language);

    return (
        <div className="space-y-6">
            {/* Header removed - moved to layout */}

            <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    {language === 'th' ? 'เลือกภาษา' : 'Choose Language'}
                </h3>

                <div className="max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <label className="text-sm font-medium text-gray-700">
                            {language === 'th' ? 'ภาษาที่ใช้งาน' : 'Application Language'}
                        </label>
                    </div>

                    <Select value={language} onValueChange={(value) => setLanguage(value as 'en' | 'th')}>
                        <SelectTrigger className="w-full h-12">
                            <SelectValue>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{currentLanguage?.flag}</span>
                                    <span className="font-medium">{currentLanguage?.nativeName}</span>
                                </div>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {languages.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{lang.flag}</span>
                                        <div>
                                            <div className="font-medium">{lang.nativeName}</div>
                                            <div className="text-xs text-muted-foreground">{lang.name}</div>
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                        {language === 'th'
                            ? '💡 การเปลี่ยนภาษาจะมีผลทันทีในทุกส่วนของแอปพลิเคชัน'
                            : '💡 Language changes will take effect immediately across the entire application'}
                    </p>
                </div>
            </div>
        </div>
    );
}
