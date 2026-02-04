'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemeColor } from '@/contexts/ThemeColorContext';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Theme = 'light' | 'dark' | 'system';

export function AppearanceSettings() {
    const { t } = useLanguage();
    const { theme, setTheme } = useTheme();
    const { colors, setPrimaryColor, resetColors } = useThemeColor();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
        { value: 'light', label: t('settings.appearance.theme.light', 'Light'), icon: <Sun className="h-3.5 w-3.5" /> },
        { value: 'dark', label: t('settings.appearance.theme.dark', 'Dark'), icon: <Moon className="h-3.5 w-3.5" /> },
        { value: 'system', label: t('settings.appearance.theme.system', 'System'), icon: <Monitor className="h-3.5 w-3.5" /> },
    ];

    const primaryColors = [
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Purple', value: '#a855f7' },
        { name: 'Green', value: '#22c55e' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Pink', value: '#ec4899' },
    ];

    return (
        <div className="space-y-6 max-w-xl">
            {/* Theme */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.appearance.theme', 'Theme')}</Label>
                <div className="flex gap-2">
                    {themes.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setTheme(opt.value)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors',
                                theme === opt.value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                            )}
                        >
                            {opt.icon}
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Theme Color */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.appearance.color', 'Theme Color')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {primaryColors.map((color) => (
                        <button
                            key={color.value}
                            onClick={() => setPrimaryColor(color.value)}
                            className={cn(
                                'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0',
                                colors.primary === color.value ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:scale-105'
                            )}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                        >
                            {colors.primary === color.value && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
                        </button>
                    ))}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={cn(
                                    'h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
                                    !primaryColors.find(c => c.value === colors.primary) ? 'border-primary' : 'border-transparent hover:scale-105'
                                )}
                                title={t('settings.appearance.customColor', 'Custom')}
                            >
                                {!primaryColors.find(c => c.value === colors.primary) && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                            <div className="space-y-2">
                                <Label className="text-xs">{t('settings.appearance.customColor', 'Custom')}</Label>
                                <input
                                    type="color"
                                    value={colors.primary}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="h-8 w-full cursor-pointer rounded border"
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Language */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.language', 'Language')}</Label>
                <LanguageSelector />
            </div>

            {/* Reset */}
            <div className="pt-2">
                <Button onClick={resetColors} variant="outline" size="sm">
                    {t('settings.appearance.resetDefaults', 'Reset Defaults')}
                </Button>
            </div>
        </div>
    );
}

function LanguageSelector() {
    const { language, setLanguage } = useLanguage();

    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'th', name: 'ไทย', flag: '🇹🇭' },
    ];

    const current = languages.find(lang => lang.code === language);

    return (
        <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'th')}>
            <SelectTrigger className="w-full max-w-[200px] h-9">
                <SelectValue>
                    <span className="flex items-center gap-2">
                        <span className="text-base">{current?.flag}</span>
                        <span className="text-sm">{current?.name}</span>
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                            <span className="text-base">{lang.flag}</span>
                            {lang.name}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
