import { redirect } from 'next/navigation';

export default function AdsManagerPage() {
  redirect('/ads?tab=campaigns');
}
