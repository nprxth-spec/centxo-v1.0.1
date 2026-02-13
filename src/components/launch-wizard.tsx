'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Rocket, Facebook, Users, FileVideo, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { launchCampaign } from '@/lib/actions';
import { useAdAccount } from '@/contexts/AdAccountContext';
import { NoFacebookAccountsPrompt } from '@/components/NoFacebookAccountsPrompt';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LaunchWizard() {
  const { t } = useLanguage();
  const launchSchema = z.object({
    videoFile: z.any().refine((files) => files?.length === 1, t('launch.quick.validation.video')),
    adAccountId: z.string().min(1, t('launch.quick.validation.adAccount')),
    pageId: z.string().min(1, t('launch.quick.validation.page')),
    adCount: z.coerce.number().min(1, t('launch.quick.validation.adCount')).max(5, t('launch.quick.validation.adCountMax')),
    beneficiaryName: z.string().min(1, t('launch.quick.validation.beneficiary')),
  });
  type LaunchFormValues = z.infer<typeof launchSchema>;
  const {
    selectedAccounts: adAccounts,
    selectedPages: pages,
    adAccounts: allAdAccounts,
    pages: allPages,
    loading: accountsLoading,
  } = useAdAccount();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<LaunchFormValues>({
    resolver: zodResolver(launchSchema),
    defaultValues: {
      adCount: 3,
      adAccountId: '',
      pageId: '',
    },
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue } = form;
  const videoFile = watch('videoFile');
  const pageId = watch('pageId');
  const adAccountId = watch('adAccountId');

  const hasNoAccounts = !accountsLoading && (allAdAccounts?.length ?? 0) === 0;
  // Use only account-selected pages (from Account > Settings > เพจ) so launch only uses allowed pages
  const displayPages = pages ?? [];
  const hasNoPages = !accountsLoading && displayPages.length === 0;
  const displayAccounts = allAdAccounts ?? adAccounts ?? [];

  const nextStep = async () => {
    let fieldsToTrigger: (keyof LaunchFormValues)[] = [];
    if (step === 1) fieldsToTrigger = ['videoFile'];
    if (step === 2) fieldsToTrigger = ['adAccountId', 'pageId'];
    if (step === 3) fieldsToTrigger = ['adCount', 'beneficiaryName'];

    const isValid = await form.trigger(fieldsToTrigger);
    if (isValid) {
      setStep((s) => s + 1);
    }
  };
  const prevStep = () => setStep((s) => s - 1);

  const onSubmit = async (data: LaunchFormValues) => {
    setIsSubmitting(true);
    toast({
      title: `🚀 ${t('launch.quick.launching')}`,
      description: t('launch.quick.launchDesc'),
    });

    try {
        const formData = new FormData();
        formData.append('videoFile', data.videoFile[0]);
        formData.append('adAccountId', data.adAccountId);
        formData.append('pageId', data.pageId);
        formData.append('adCount', String(data.adCount));
        formData.append('beneficiaryName', data.beneficiaryName);
        
        const result = await launchCampaign(formData);

        if (result.success) {
            toast({
                title: `✅ ${t('launch.quick.success')}`,
                description: t('launch.quick.successDesc').replace('{name}', result.campaignName || ''),
                variant: 'default',
            });
            form.reset();
            setStep(1);
        } else if (result.redirectTo === '/create-ads') {
            toast({
                title: t('launch.quick.goCreateAds'),
                description: result.error || t('launch.quick.goCreateAdsDesc'),
                variant: 'default',
            });
            router.push('/create?tab=auto');
        } else {
            throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error) {
        toast({
            title: `🔥 ${t('launch.quick.error')}`,
            description: error instanceof Error ? error.message : t('launch.quick.errorDesc'),
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const steps = [
    { num: 1, title: t('launch.quick.steps.uploadVideo'), icon: FileVideo },
    { num: 2, title: t('launch.quick.steps.selectPage'), icon: Facebook },
    { num: 3, title: t('launch.quick.steps.configureAds'), icon: Users },
    { num: 4, title: t('launch.quick.steps.reviewLaunch'), icon: Rocket },
  ];

  const CurrentIcon = steps[step - 1].icon;

  return (
    <Card>
      <CardHeader>
        <Progress value={(step / 4) * 100} className="mb-4 h-2" />
        <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                {CurrentIcon && <CurrentIcon className="h-5 w-5" />}
            </div>
            {steps[step - 1].title}
        </CardTitle>
        <CardDescription>{t('launch.quick.stepOf').replace('{step}', String(step))}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="min-h-[200px]">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="videoFile">{t('launch.quick.adVideo')}</Label>
              <Input id="videoFile" type="file" accept="video/mp4,video/quicktime" {...register('videoFile')} />
              {errors.videoFile && <p className="text-sm text-destructive">{errors.videoFile.message as string}</p>}
              {videoFile && videoFile.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600 pt-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>{videoFile[0].name} {t('launch.quick.uploaded')}</span>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              {hasNoAccounts ? (
                <NoFacebookAccountsPrompt />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="adAccountId">{t('launch.quick.adAccount')}</Label>
                    <Select onValueChange={(v) => { setValue('adAccountId', v, { shouldValidate: true }); setValue('pageId', ''); }} value={adAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('launch.quick.selectAdAccount')} />
                      </SelectTrigger>
                      <SelectContent>
                        {displayAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.adAccountId && <p className="text-sm text-destructive">{errors.adAccountId.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pageId">{t('launch.quick.facebookPage')}</Label>
                    <Select onValueChange={(value) => setValue('pageId', value, { shouldValidate: true })} value={pageId} disabled={!adAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('launch.quick.selectPage')} />
                      </SelectTrigger>
                      <SelectContent>
                        {displayPages.map((page) => (
                          <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.pageId && <p className="text-sm text-destructive">{errors.pageId.message}</p>}
                  </div>
                </>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adCount">{t('launch.quick.adVariations')}</Label>
                <Input id="adCount" type="number" min="1" max="5" {...register('adCount')} />
                <p className="text-sm text-muted-foreground">{t('launch.quick.aiHint')}</p>
                {errors.adCount && <p className="text-sm text-destructive">{errors.adCount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryName">{t('launch.quick.beneficiary')}</Label>
                <Input 
                  id="beneficiaryName" 
                  type="text" 
                  placeholder={t('launch.quick.beneficiaryPlaceholder')} 
                  {...register('beneficiaryName')} 
                />
                <p className="text-sm text-muted-foreground">{t('launch.quick.beneficiaryNote')}</p>
                {errors.beneficiaryName && <p className="text-sm text-destructive">{errors.beneficiaryName.message}</p>}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold">{t('launch.quick.reviewTitle')}</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground bg-secondary p-4 rounded-lg">
                <li><strong>{t('launch.quick.review.video')}:</strong> {form.getValues('videoFile')?.[0]?.name}</li>
                <li><strong>{t('launch.quick.review.adAccount')}:</strong> {displayAccounts.find(a => a.id === form.getValues('adAccountId'))?.name ?? form.getValues('adAccountId')}</li>
                <li><strong>{t('launch.quick.review.page')}:</strong> {displayPages.find(p => p.id === form.getValues('pageId'))?.name ?? form.getValues('pageId')}</li>
                <li><strong>{t('launch.quick.review.variations')}:</strong> {form.getValues('adCount')}</li>
                <li><strong>{t('launch.quick.review.beneficiary')}:</strong> {form.getValues('beneficiaryName')}</li>
                <li><strong>{t('launch.quick.review.objective')}:</strong> {t('launch.quick.messages')}</li>
                <li><strong>{t('launch.quick.review.targeting')}:</strong> {t('launch.quick.broadTargeting')}</li>
                <li><strong>{t('launch.quick.review.budget')}:</strong> {t('launch.quick.budgetUsd')}</li>
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1 || isSubmitting}>
            {t('launch.quick.back')}
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={nextStep} disabled={isSubmitting}>
              {t('launch.quick.next')}
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              {t('launch.quick.launch')}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
