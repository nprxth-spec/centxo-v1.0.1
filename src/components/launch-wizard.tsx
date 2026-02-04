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

const launchSchema = z.object({
  videoFile: z.any().refine((files) => files?.length === 1, 'Video is required.'),
  adAccountId: z.string().min(1, 'Ad account is required.'),
  pageId: z.string().min(1, 'Facebook Page is required.'),
  adCount: z.coerce.number().min(1, 'Number of ads must be at least 1.').max(5, 'Cannot generate more than 5 ads.'),
  beneficiaryName: z.string().min(1, 'Beneficiary name is required for Thailand ads.'),
});

type LaunchFormValues = z.infer<typeof launchSchema>;

export default function LaunchWizard() {
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
  const hasNoPages = !accountsLoading && (allPages?.length ?? 0) === 0;
  // Use full lists (including team members' accounts/pages) for selection
  const displayAccounts = allAdAccounts ?? adAccounts ?? [];
  const displayPages = allPages ?? pages ?? [];

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
      title: "🚀 Launching Campaign...",
      description: "Your new ad campaign is being created. This may take a moment.",
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
                title: "✅ Campaign Launched Successfully!",
                description: `Campaign "${result.campaignName}" is now active.`,
                variant: 'default',
            });
            form.reset();
            setStep(1);
        } else if (result.redirectTo === '/create-ads') {
            toast({
                title: "ไปที่ระบบสร้างแอดออโต้",
                description: result.error || "ใช้ระบบสร้างแอดออโต้สำหรับการสร้างแคมเปญที่สมบูรณ์",
                variant: 'default',
            });
            router.push('/create-ads');
        } else {
            throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error) {
        toast({
            title: "🔥 Error Launching Campaign",
            description: error instanceof Error ? error.message : "Could not create campaign.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const steps = [
    { num: 1, title: 'Upload Video', icon: FileVideo },
    { num: 2, title: 'Select Page', icon: Facebook },
    { num: 3, title: 'Configure Ads', icon: Users },
    { num: 4, title: 'Review & Launch', icon: Rocket },
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
        <CardDescription>Step {step} of 4</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="min-h-[200px]">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="videoFile">Ad Video</Label>
              <Input id="videoFile" type="file" accept="video/mp4,video/quicktime" {...register('videoFile')} />
              {errors.videoFile && <p className="text-sm text-destructive">{errors.videoFile.message as string}</p>}
              {videoFile && videoFile.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600 pt-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>{videoFile[0].name} uploaded.</span>
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
                    <Label htmlFor="adAccountId">บัญชีโฆษณา (Ad Account)</Label>
                    <Select onValueChange={(v) => { setValue('adAccountId', v, { shouldValidate: true }); setValue('pageId', ''); }} value={adAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกบัญชีโฆษณา" />
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
                    <Label htmlFor="pageId">Facebook Page</Label>
                    <Select onValueChange={(value) => setValue('pageId', value, { shouldValidate: true })} value={pageId} disabled={!adAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกเพจที่จะใช้โฆษณา" />
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
                <Label htmlFor="adCount">Number of Ad Variations</Label>
                <Input id="adCount" type="number" min="1" max="5" {...register('adCount')} />
                <p className="text-sm text-muted-foreground">AI will generate this many ad copies.</p>
                {errors.adCount && <p className="text-sm text-destructive">{errors.adCount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryName">ชื่อผู้รับผลประโยชน์ (Beneficiary) *</Label>
                <Input 
                  id="beneficiaryName" 
                  type="text" 
                  placeholder="เช่น ชื่อบริษัทหรือชื่อบุคคล" 
                  {...register('beneficiaryName')} 
                />
                <p className="text-sm text-muted-foreground">ตามกฎหมายไทย ต้องระบุผู้รับผลประโยชน์ในโฆษณา</p>
                {errors.beneficiaryName && <p className="text-sm text-destructive">{errors.beneficiaryName.message}</p>}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Review your campaign settings:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground bg-secondary p-4 rounded-lg">
                <li><strong>Video:</strong> {form.getValues('videoFile')?.[0]?.name}</li>
                <li><strong>Ad Account:</strong> {displayAccounts.find(a => a.id === form.getValues('adAccountId'))?.name ?? form.getValues('adAccountId')}</li>
                <li><strong>Facebook Page:</strong> {displayPages.find(p => p.id === form.getValues('pageId'))?.name ?? form.getValues('pageId')}</li>
                <li><strong>Ad Variations:</strong> {form.getValues('adCount')}</li>
                <li><strong>Beneficiary:</strong> {form.getValues('beneficiaryName')}</li>
                <li><strong>Objective:</strong> Messages</li>
                <li><strong>Targeting:</strong> Broad (Thailand, 20+)</li>
                <li><strong>Daily Budget:</strong> $20 USD</li>
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1 || isSubmitting}>
            Back
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={nextStep} disabled={isSubmitting}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Launch Campaign
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
